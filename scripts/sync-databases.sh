#!/bin/bash

# ============================================================================
# Archon Bidirectional Database Sync
# ============================================================================
# Version: 1.0.0
# Date: 2026-01-12
#
# Purpose: Unified script for bidirectional database synchronization between
#          Local Supabase and Remote Supabase Cloud
#
# Usage:
#   ./sync-databases.sh --direction=<local-to-remote|remote-to-local>
#
# Options:
#   --direction=DIR    Sync direction (required)
#                      - local-to-remote: Local → Remote (backup to cloud)
#                      - remote-to-local: Remote → Local (restore from cloud)
#   --dry-run         Show what would be synced without executing
#   --skip-confirm    Skip confirmation prompts (use with caution)
#   --help           Show this help message
#
# Examples:
#   ./sync-databases.sh --direction=local-to-remote
#   ./sync-databases.sh --direction=remote-to-local --dry-run
#
# Exit Codes:
#   0 - Success
#   1 - Invalid arguments
#   2 - Connection failed
#   3 - Export/Import failed
#   4 - Verification failed
#   5 - User cancelled
# ============================================================================

set -e  # Exit on error
set -o pipefail  # Catch errors in pipes

# ============================================================================
# GLOBAL VARIABLES
# ============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="/tmp/archon-sync"
SYNC_ID="sync_$(date +%Y%m%d_%H%M%S)"
START_TIME=$(date +%s)
DRY_RUN=false
SKIP_CONFIRM=false
DIRECTION=""

# Database connection variables (will be loaded from .env)
declare -A LOCAL_DB REMOTE_DB

# Tables to sync (17 tables, excluding MCP tracking)
SYNC_TABLES=(
  "archon_settings"
  "archon_sources"
  "archon_page_metadata"
  "archon_crawled_pages"
  "archon_code_examples"
  "archon_crawl_state"
  "archon_projects"
  "archon_tasks"
  "archon_task_history"
  "archon_document_versions"
  "archon_project_sources"
  "archon_configured_repositories"
  "archon_agent_work_orders"
  "archon_agent_work_order_steps"
  "archon_migrations"
  "archon_prompts"
  "archon_llm_pricing"
)

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $(date +'%Y-%m-%d %H:%M:%S') - $*"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $(date +'%Y-%m-%d %H:%M:%S') - $*"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $(date +'%Y-%m-%d %H:%M:%S') - $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date +'%Y-%m-%d %H:%M:%S') - $*" >&2
}

log_progress() {
  local phase="$1"
  local message="$2"
  echo -e "${BLUE}[$phase]${NC} $message"
}

log_header() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$1"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# ============================================================================
# DATABASE FUNCTIONS
# ============================================================================

# Initialize sync record in archon_sync_history
init_sync_record() {
  local direction="$1"
  local source_db="$2"
  local target_db="$3"

  log_info "Initializing sync record: $SYNC_ID"

  # Determine which database to use for tracking (target database)
  local db_host="${target_db[HOST]}"
  local db_port="${target_db[PORT]}"
  local db_user="${target_db[USER]}"
  local db_name="${target_db[DB]}"
  local db_pass="${target_db[PASS]}"

  PGPASSWORD="$db_pass" psql \
    -h "$db_host" \
    -p "$db_port" \
    -U "$db_user" \
    -d "$db_name" \
    -v ON_ERROR_STOP=1 \
    -c "
    INSERT INTO archon_sync_history (
      sync_id,
      direction,
      status,
      started_at,
      current_phase,
      source_db,
      target_db,
      triggered_by
    ) VALUES (
      '$SYNC_ID',
      '$direction',
      'running',
      NOW(),
      'validation',
      '$source_db',
      '$target_db',
      'CLI'
    );
    " > /dev/null 2>&1 || {
      log_warning "Could not create sync record (table may not exist yet)"
    }
}

# Update sync record progress
update_sync_progress() {
  local phase="$1"
  local current_table="${2:-}"
  local synced_rows="${3:-0}"
  local total_rows="${4:-0}"
  local percent="${5:-0}"

  # Use target database for tracking
  local db_host="${LOCAL_DB[HOST]}"  # Will be set based on direction
  local db_port="${LOCAL_DB[PORT]}"
  local db_user="${LOCAL_DB[USER]}"
  local db_name="${LOCAL_DB[DB]}"
  local db_pass="${LOCAL_DB[PASS]}"

  if [ "$DIRECTION" = "local-to-remote" ]; then
    db_host="${REMOTE_DB[HOST]}"
    db_port="${REMOTE_DB[PORT]}"
    db_user="${REMOTE_DB[USER]}"
    db_name="${REMOTE_DB[DB]}"
    db_pass="${REMOTE_DB[PASS]}"
  fi

  PGPASSWORD="$db_pass" psql \
    -h "$db_host" \
    -p "$db_port" \
    -U "$db_user" \
    -d "$db_name" \
    -v ON_ERROR_STOP=1 \
    -c "
    UPDATE archon_sync_history
    SET
      current_phase = '$phase',
      current_table = NULLIF('$current_table', ''),
      synced_rows = NULLIF($synced_rows, 0),
      total_rows = NULLIF($total_rows, 0),
      percent_complete = $percent,
      updated_at = NOW()
    WHERE sync_id = '$SYNC_ID';
    " > /dev/null 2>&1 || true
}

# Complete sync record with final status
complete_sync_record() {
  local status="$1"  # 'completed', 'failed', 'cancelled'
  local error_message="${2:-}"
  local duration=$(($(date +%s) - START_TIME))

  # Use target database
  local db_host="${LOCAL_DB[HOST]}"
  local db_port="${LOCAL_DB[PORT]}"
  local db_user="${LOCAL_DB[USER]}"
  local db_name="${LOCAL_DB[DB]}"
  local db_pass="${LOCAL_DB[PASS]}"

  if [ "$DIRECTION" = "local-to-remote" ]; then
    db_host="${REMOTE_DB[HOST]}"
    db_port="${REMOTE_DB[PORT]}"
    db_user="${REMOTE_DB[USER]}"
    db_name="${REMOTE_DB[DB]}"
    db_pass="${REMOTE_DB[PASS]}"
  fi

  local error_sql=""
  if [ -n "$error_message" ]; then
    # Escape single quotes in error message
    error_message="${error_message//\'/\'\'}"
    error_sql=", error_message = '$error_message'"
  fi

  PGPASSWORD="$db_pass" psql \
    -h "$db_host" \
    -p "$db_port" \
    -U "$db_user" \
    -d "$db_name" \
    -v ON_ERROR_STOP=1 \
    -c "
    UPDATE archon_sync_history
    SET
      status = '$status',
      completed_at = NOW(),
      duration_seconds = $duration,
      percent_complete = CASE WHEN '$status' = 'completed' THEN 100 ELSE percent_complete END
      $error_sql
    WHERE sync_id = '$SYNC_ID';
    " > /dev/null 2>&1 || true
}

# Test database connectivity
test_connection() {
  local label="$1"
  declare -n db_ref="$2"

  log_info "Testing $label database connection..."

  # Use docker exec for local database
  if [[ "$label" == *"Local"* ]]; then
    docker exec supabase-ai-db psql \
      -U "${db_ref[USER]}" \
      -d "${db_ref[DB]}" \
      -c "SELECT 1;" > /dev/null 2>&1 || {
        log_error "$label database connection failed"
        return 1
      }
  else
    # Direct connection for remote database
    PGPASSWORD="${db_ref[PASS]}" psql \
      -h "${db_ref[HOST]}" \
      -p "${db_ref[PORT]}" \
      -U "${db_ref[USER]}" \
      -d "${db_ref[DB]}" \
      -c "SELECT 1;" > /dev/null 2>&1 || {
        log_error "$label database connection failed"
        return 1
      }
  fi

  log_success "$label database connection OK"
  return 0
}

# Export database to SQL file
export_database() {
  local direction="$1"
  local backup_file="$2"
  local export_start=$(date +%s)

  # Determine source database based on direction
  if [ "$direction" = "local-to-remote" ]; then
    local db_host="${LOCAL_DB[HOST]}"
    local db_port="${LOCAL_DB[PORT]}"
    local db_user="${LOCAL_DB[USER]}"
    local db_name="${LOCAL_DB[DB]}"
    local db_pass="${LOCAL_DB[PASS]}"
    local db_label="Local"
    local use_docker=true
  else
    local db_host="${REMOTE_DB[HOST]}"
    local db_port="${REMOTE_DB[PORT]}"
    local db_user="${REMOTE_DB[USER]}"
    local db_name="${REMOTE_DB[DB]}"
    local db_pass="${REMOTE_DB[PASS]}"
    local db_label="Remote"
    local use_docker=false
  fi

  log_info "Exporting from $db_label database..."
  log_info "Backup file: $backup_file"

  # Check if target database has schema (to decide data-only vs full dump)
  local target_has_schema=true
  local target_pg_host="localhost"
  local target_pg_port="5432"
  local target_db_user="postgres"
  local target_db_pass="${LOCAL_DB[PASS]}"

  if [ "$direction" = "local-to-remote" ]; then
    # Target is remote
    target_pg_host="${REMOTE_DB[HOST]}"
    target_pg_port="${REMOTE_DB[PORT]}"
    target_db_user="${REMOTE_DB[USER]}"
    target_db_pass="${REMOTE_DB[PASS]}"
  fi

  local target_table_count
  target_table_count=$(docker exec -e PGPASSWORD="$target_db_pass" supabase-ai-db \
    psql -h "$target_pg_host" -p "$target_pg_port" -U "$target_db_user" -d postgres \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='archon_settings';" \
    2>/dev/null | tr -d ' ' || echo "0")

  if [ "$target_table_count" = "0" ]; then
    target_has_schema=false
    log_warning "Target database has no schema - using full dump (schema + data)"
  else
    log_info "Target database has schema - using data-only dump"
  fi

  # Build table exclusion list for pg_dump
  local exclude_args=""
  exclude_args="$exclude_args --exclude-table=archon_mcp_sessions"
  exclude_args="$exclude_args --exclude-table=archon_mcp_requests"

  # Determine dump mode
  local dump_mode_args="--data-only"
  if [ "$target_has_schema" = false ]; then
    dump_mode_args=""  # Plain full dump (schema + data, no cleanup needed)
  fi

  # Execute pg_dump (always use docker exec to avoid version mismatches)
  log_info "Using containerized pg_dump (PostgreSQL 17)..."

  # Export inside container, then copy to host
  local container_file="/tmp/archon-sync-$SYNC_ID.sql"

  # Set connection host based on direction
  local pg_host="localhost"
  local pg_port="5432"
  if [ "$use_docker" = false ]; then
    # For remote database, use actual remote host
    pg_host="$db_host"
    pg_port="$db_port"
  fi

  docker exec -e PGPASSWORD="$db_pass" supabase-ai-db \
    pg_dump \
      -h "$pg_host" \
      -p "$pg_port" \
      -U "$db_user" \
      -d "$db_name" \
      --schema=public \
      --table='archon_*' \
      $exclude_args \
      $dump_mode_args \
      --no-owner \
      --no-privileges \
      --no-acl \
      --verbose \
      --file="$container_file" 2>&1 | grep -E "(archon_|Dumping|completed|ERROR|error)" | head -50 || true

  # Copy file from container to host
  docker cp "supabase-ai-db:$container_file" "$backup_file" || {
    log_error "Failed to copy backup file from container"
    return 1
  }

  # Remove file from container
  docker exec supabase-ai-db rm -f "$container_file" || true

  # Check if export was successful
  if [ ! -f "$backup_file" ]; then
    log_error "Backup file not created"
    return 1
  fi

  # Get file size and calculate duration
  local backup_size_mb=$(du -m "$backup_file" | cut -f1)
  local backup_size_human=$(du -h "$backup_file" | cut -f1)
  local export_duration=$(($(date +%s) - export_start))

  log_success "Export completed!"
  log_info "  File: $backup_file"
  log_info "  Size: ${backup_size_human} (${backup_size_mb} MB)"
  log_info "  Duration: ${export_duration}s"

  # Update sync record with export details
  update_sync_progress "export" "" 0 0 33

  # Store export metadata in database
  local db_host_target="${LOCAL_DB[HOST]}"
  local db_port_target="${LOCAL_DB[PORT]}"
  local db_user_target="${LOCAL_DB[USER]}"
  local db_name_target="${LOCAL_DB[DB]}"
  local db_pass_target="${LOCAL_DB[PASS]}"

  if [ "$DIRECTION" = "local-to-remote" ]; then
    db_host_target="${REMOTE_DB[HOST]}"
    db_port_target="${REMOTE_DB[PORT]}"
    db_user_target="${REMOTE_DB[USER]}"
    db_name_target="${REMOTE_DB[DB]}"
    db_pass_target="${REMOTE_DB[PASS]}"
  fi

  PGPASSWORD="$db_pass_target" psql \
    -h "$db_host_target" \
    -p "$db_port_target" \
    -U "$db_user_target" \
    -d "$db_name_target" \
    -v ON_ERROR_STOP=1 \
    -c "
    UPDATE archon_sync_history
    SET
      export_size_mb = $backup_size_mb,
      export_duration_seconds = $export_duration,
      backup_file_path = '$backup_file',
      updated_at = NOW()
    WHERE sync_id = '$SYNC_ID';
    " > /dev/null 2>&1 || true

  return 0
}

# Import database from SQL file
import_database() {
  local direction="$1"
  local backup_file="$2"
  local import_start=$(date +%s)

  # Determine target database based on direction
  if [ "$direction" = "local-to-remote" ]; then
    local db_host="${REMOTE_DB[HOST]}"
    local db_port="${REMOTE_DB[PORT]}"
    local db_user="${REMOTE_DB[USER]}"
    local db_name="${REMOTE_DB[DB]}"
    local db_pass="${REMOTE_DB[PASS]}"
    local db_label="Remote"
    local use_docker=false
  else
    local db_host="${LOCAL_DB[HOST]}"
    local db_port="${LOCAL_DB[PORT]}"
    local db_user="${LOCAL_DB[USER]}"
    local db_name="${LOCAL_DB[DB]}"
    local db_pass="${LOCAL_DB[PASS]}"
    local db_label="Local"
    local use_docker=true
  fi

  log_info "Importing to $db_label database..."
  log_info "Source file: $backup_file"

  # Step 0: Ensure pgvector extension exists (required for vector columns)
  log_info "Checking pgvector extension..."
  local pg_host_ext="localhost"
  local pg_port_ext="5432"
  local db_user_ext="postgres"
  local db_pass_ext="${LOCAL_DB[PASS]}"

  if [ "$use_docker" = false ]; then
    pg_host_ext="$db_host"
    pg_port_ext="$db_port"
    db_user_ext="$db_user"
    db_pass_ext="$db_pass"
  fi

  docker exec -e PGPASSWORD="$db_pass_ext" supabase-ai-db \
    psql -h "$pg_host_ext" -p "$pg_port_ext" -U "$db_user_ext" -d postgres \
    -c "CREATE EXTENSION IF NOT EXISTS vector;" > /dev/null 2>&1 || {
    log_warning "Could not create pgvector extension (may not be installed)"
  }

  # Step 1: Truncate target tables
  log_info "Truncating target tables (CASCADE)..."
  truncate_tables "$direction" || {
    log_error "Failed to truncate tables"
    return 1
  }

  # Step 2: Import SQL file
  log_info "Importing database from SQL file..."

  # Use containerized psql for consistency
  local pg_host="localhost"
  local pg_port="5432"
  if [ "$use_docker" = false ]; then
    pg_host="$db_host"
    pg_port="$db_port"
  fi

  # Always copy backup file to container (needed for both local and remote imports)
  local container_file="/tmp/archon-import-$SYNC_ID.sql"
  docker cp "$backup_file" "supabase-ai-db:$container_file" || {
    log_error "Failed to copy backup file to container"
    return 1
  }

  # Execute psql import and capture output
  local import_output
  local import_exit_code

  import_output=$(docker exec -e PGPASSWORD="$db_pass" supabase-ai-db \
    psql \
      -h "$pg_host" \
      -p "$pg_port" \
      -U "$db_user" \
      -d "$db_name" \
      -f "$container_file" \
      -v ON_ERROR_STOP=1 \
      2>&1)
  import_exit_code=$?

  # Check psql exit code
  if [ $import_exit_code -ne 0 ]; then
    log_error "Import failed with exit code $import_exit_code"
    log_error "Last 50 lines of output:"
    echo "$import_output" | tail -50 >&2
    return 1
  fi

  # Show summary of import (last 20 lines for success)
  log_info "Import output (last 20 lines):"
  echo "$import_output" | grep -E "(CREATE|INSERT|COPY|ALTER)" | tail -20 || echo "  (No CREATE/INSERT/COPY statements found)"

  # Remove temp file from container if used
  if [ "$use_docker" = true ]; then
    docker exec supabase-ai-db rm -f "$container_file" || true
  fi

  # Calculate import duration
  local import_duration=$(($(date +%s) - import_start))

  log_success "Import completed!"
  log_info "  Duration: ${import_duration}s"

  # Update sync record with import details
  update_sync_progress "verification" "" 0 0 66

  # Store import metadata
  local db_host_target="${LOCAL_DB[HOST]}"
  local db_port_target="${LOCAL_DB[PORT]}"
  local db_user_target="${LOCAL_DB[USER]}"
  local db_name_target="${LOCAL_DB[DB]}"
  local db_pass_target="${LOCAL_DB[PASS]}"

  if [ "$DIRECTION" = "local-to-remote" ]; then
    db_host_target="${REMOTE_DB[HOST]}"
    db_port_target="${REMOTE_DB[PORT]}"
    db_user_target="${REMOTE_DB[USER]}"
    db_name_target="${REMOTE_DB[DB]}"
    db_pass_target="${REMOTE_DB[PASS]}"
  fi

  # Use docker exec for local database updates
  if [[ "$db_label" == "Local" ]]; then
    docker exec supabase-ai-db psql \
      -U postgres -d postgres \
      -c "
      UPDATE archon_sync_history
      SET
        import_duration_seconds = $import_duration,
        updated_at = NOW()
      WHERE sync_id = '$SYNC_ID';
      " > /dev/null 2>&1 || true
  else
    PGPASSWORD="$db_pass_target" psql \
      -h "$db_host_target" \
      -p "$db_port_target" \
      -U "$db_user_target" \
      -d "$db_name_target" \
      -v ON_ERROR_STOP=1 \
      -c "
      UPDATE archon_sync_history
      SET
        import_duration_seconds = $import_duration,
        updated_at = NOW()
      WHERE sync_id = '$SYNC_ID';
      " > /dev/null 2>&1 || true
  fi

  return 0
}

# Truncate target tables before import
truncate_tables() {
  local direction="$1"

  # Determine target database
  local db_label="Remote"
  local use_docker=false
  if [ "$direction" = "remote-to-local" ]; then
    db_label="Local"
    use_docker=true
  fi

  log_info "Truncating tables in $db_label database..."

  # First check if tables exist (for initial sync scenario)
  local check_sql="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='archon_settings';"

  # Always use containerized psql for consistency
  local pg_host_check="localhost"
  local pg_port_check="5432"
  local db_user_check="postgres"
  local db_pass_check="${LOCAL_DB[PASS]}"

  if [ "$use_docker" = false ]; then
    pg_host_check="${REMOTE_DB[HOST]}"
    pg_port_check="${REMOTE_DB[PORT]}"
    db_user_check="${REMOTE_DB[USER]}"
    db_pass_check="${REMOTE_DB[PASS]}"
  fi

  local table_exists
  table_exists=$(docker exec -e PGPASSWORD="$db_pass_check" supabase-ai-db \
    psql -h "$pg_host_check" -p "$pg_port_check" -U "$db_user_check" -d postgres \
    -t -c "$check_sql" 2>/dev/null | tr -d ' ' || echo "0")

  if [ "$table_exists" = "0" ]; then
    log_warning "Tables do not exist in target database - skipping TRUNCATE"
    log_warning "Note: Import will fail if schema is not present. Run migrations first or use full dump."
    return 0
  fi

  # Build TRUNCATE statement for all tables (with schema prefix for remote compatibility)
  local truncate_sql="
  TRUNCATE TABLE
    public.archon_task_history,
    public.archon_tasks,
    public.archon_project_sources,
    public.archon_projects,
    public.archon_document_versions,
    public.archon_code_examples,
    public.archon_crawled_pages,
    public.archon_page_metadata,
    public.archon_crawl_state,
    public.archon_sources,
    public.archon_agent_work_order_steps,
    public.archon_agent_work_orders,
    public.archon_configured_repositories,
    public.archon_settings,
    public.archon_prompts,
    public.archon_llm_pricing,
    public.archon_migrations
  CASCADE;
  "

  # Always use containerized psql for consistency
  local pg_host="localhost"
  local pg_port="5432"
  local db_user="postgres"
  local db_pass="${LOCAL_DB[PASS]}"

  if [ "$use_docker" = false ]; then
    # For remote database, use actual remote connection details
    pg_host="${REMOTE_DB[HOST]}"
    pg_port="${REMOTE_DB[PORT]}"
    db_user="${REMOTE_DB[USER]}"
    db_pass="${REMOTE_DB[PASS]}"
  fi

  local truncate_output
  truncate_output=$(docker exec -e PGPASSWORD="$db_pass" supabase-ai-db \
    psql \
      -h "$pg_host" \
      -p "$pg_port" \
      -U "$db_user" \
      -d postgres \
      -c "$truncate_sql" 2>&1)

  local truncate_exit_code=$?

  if [ $truncate_exit_code -ne 0 ]; then
    log_error "TRUNCATE failed on $db_label database (exit code: $truncate_exit_code)"
    log_error "Error output:"
    echo "$truncate_output" | tail -20 >&2
    return 1
  fi

  log_success "Tables truncated successfully"
  return 0
}

# Verify row counts after import
verify_row_counts() {
  local direction="$1"

  log_header "Phase 5: Verification"
  log_info "Verifying row counts..."

  # Determine source and target databases
  local source_use_docker=true
  local target_use_docker=false
  if [ "$direction" = "remote-to-local" ]; then
    source_use_docker=false
    target_use_docker=true
  fi

  # Get row counts from both databases
  local verification_results=""
  local total_tables=0
  local matched_tables=0

  for table in "${SYNC_TABLES[@]}"; do
    ((total_tables++))

    # Get source count
    local source_count=0
    if [ "$source_use_docker" = true ]; then
      source_count=$(docker exec supabase-ai-db psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "0")
    else
      source_count=$(PGPASSWORD="${REMOTE_DB[PASS]}" psql -h "${REMOTE_DB[HOST]}" -p "${REMOTE_DB[PORT]}" -U "${REMOTE_DB[USER]}" -d "${REMOTE_DB[DB]}" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "0")
    fi

    # Get target count
    local target_count=0
    if [ "$target_use_docker" = true ]; then
      target_count=$(docker exec supabase-ai-db psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "0")
    else
      target_count=$(PGPASSWORD="${REMOTE_DB[PASS]}" psql -h "${REMOTE_DB[HOST]}" -p "${REMOTE_DB[PORT]}" -U "${REMOTE_DB[USER]}" -d "${REMOTE_DB[DB]}" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "0")
    fi

    # Compare counts
    if [ "$source_count" = "$target_count" ]; then
      log_success "  $table: $source_count rows ✓"
      ((matched_tables++))
    else
      log_error "  $table: source=$source_count, target=$target_count ✗"
    fi

    verification_results="${verification_results}${table}:${source_count}:${target_count},"
  done

  # Summary
  log_info "Verification complete: $matched_tables/$total_tables tables matched"

  if [ "$matched_tables" -eq "$total_tables" ]; then
    log_success "All row counts match!"
    return 0
  else
    log_error "Row count mismatch detected"
    return 1
  fi
}

# ============================================================================
# CLEANUP AND TRAP HANDLERS
# ============================================================================

cleanup() {
  log_info "Cleaning up temporary files..."
  # Remove backup files older than 24 hours
  find "$BACKUP_DIR" -name "archon-sync-*.sql" -mtime +1 -delete 2>/dev/null || true
}

# Handle script interruption
handle_interrupt() {
  log_warning "Sync interrupted by user (SIGINT/SIGTERM)"
  complete_sync_record "cancelled" "User interrupted sync"
  cleanup
  exit 130
}

# Handle script errors
handle_error() {
  local exit_code=$?
  local line_number=$1
  log_error "Script failed at line $line_number with exit code $exit_code"
  complete_sync_record "failed" "Script error at line $line_number (exit code $exit_code)"
  cleanup
  exit "$exit_code"
}

# Set trap handlers
trap 'handle_interrupt' SIGINT SIGTERM
trap 'handle_error ${LINENO}' ERR

# ============================================================================
# CONFIGURATION LOADING
# ============================================================================

load_env_config() {
  log_info "Loading configuration from .env..."

  local env_file="$PROJECT_ROOT/.env"

  if [ ! -f "$env_file" ]; then
    log_error ".env file not found at $env_file"
    exit 2
  fi

  # Source .env file to load variables
  set -a  # Export all variables
  source "$env_file"
  set +a

  # Load local database config (from LOCAL_DATABASE_URI)
  # Format: postgresql://user:pass@host:port/db
  if [ -n "${LOCAL_DATABASE_URI:-}" ]; then
    if [[ $LOCAL_DATABASE_URI =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
      LOCAL_DB[USER]="${BASH_REMATCH[1]}"
      LOCAL_DB[PASS]="${BASH_REMATCH[2]}"
      LOCAL_DB[HOST]="${BASH_REMATCH[3]}"
      LOCAL_DB[PORT]="${BASH_REMATCH[4]}"
      LOCAL_DB[DB]="${BASH_REMATCH[5]}"
    else
      log_error "Failed to parse LOCAL_DATABASE_URI"
      exit 2
    fi
  else
    log_error "LOCAL_DATABASE_URI not set in .env"
    exit 2
  fi

  # Load remote database config (from REMOTE_DATABASE_URI)
  # Format: postgresql://user:pass@host:port/db
  if [ -n "${REMOTE_DATABASE_URI:-}" ]; then
    if [[ $REMOTE_DATABASE_URI =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
      REMOTE_DB[USER]="${BASH_REMATCH[1]}"
      REMOTE_DB[PASS]="${BASH_REMATCH[2]}"
      REMOTE_DB[HOST]="${BASH_REMATCH[3]}"
      REMOTE_DB[PORT]="${BASH_REMATCH[4]}"
      REMOTE_DB[DB]="${BASH_REMATCH[5]}"
    else
      log_error "Failed to parse REMOTE_DATABASE_URI"
      exit 2
    fi
  else
    log_error "REMOTE_DATABASE_URI not set in .env"
    exit 2
  fi

  log_success "Configuration loaded successfully"
}

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

show_usage() {
  head -n 40 "$0" | grep "^#" | sed 's/^# //'
  exit 0
}

parse_arguments() {
  if [ $# -eq 0 ]; then
    log_error "No arguments provided"
    show_usage
  fi

  for arg in "$@"; do
    case $arg in
      --direction=*)
        DIRECTION="${arg#*=}"
        ;;
      --dry-run)
        DRY_RUN=true
        ;;
      --skip-confirm)
        SKIP_CONFIRM=true
        ;;
      --help|-h)
        show_usage
        ;;
      *)
        log_error "Unknown argument: $arg"
        show_usage
        ;;
    esac
  done

  # Validate direction
  if [ -z "$DIRECTION" ]; then
    log_error "--direction is required"
    show_usage
  fi

  if [[ ! "$DIRECTION" =~ ^(local-to-remote|remote-to-local)$ ]]; then
    log_error "Invalid direction: $DIRECTION"
    log_error "Must be 'local-to-remote' or 'remote-to-local'"
    exit 1
  fi

  log_success "Arguments parsed: direction=$DIRECTION, dry_run=$DRY_RUN"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
  log_header "Archon Bidirectional Database Sync - $SYNC_ID"

  # Parse command-line arguments
  parse_arguments "$@"

  # Load configuration
  load_env_config

  # Create backup directory
  mkdir -p "$BACKUP_DIR"

  # Show sync summary
  echo "Sync Configuration:"
  echo "  Direction: $DIRECTION"
  echo "  Sync ID: $SYNC_ID"
  echo "  Source: ${DIRECTION%-to-*}"
  echo "  Target: ${DIRECTION#*-to-}"
  echo "  Tables: ${#SYNC_TABLES[@]} tables"
  echo "  Dry Run: $DRY_RUN"
  echo ""

  # Confirmation prompt (unless --skip-confirm)
  if [ "$SKIP_CONFIRM" = false ]; then
    log_warning "This will OVERWRITE all data in the target database!"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log_info "Sync cancelled by user"
      exit 5
    fi
  fi

  # Test database connections (select based on direction)
  log_header "Phase 1: Validation"
  update_sync_progress "validation"

  if [ "$DIRECTION" = "local-to-remote" ]; then
    test_connection "Local (Source)" "LOCAL_DB" || exit 2
    test_connection "Remote (Target)" "REMOTE_DB" || exit 2
    init_sync_record "$DIRECTION" "local" "remote"
  else
    test_connection "Remote (Source)" "REMOTE_DB" || exit 2
    test_connection "Local (Target)" "LOCAL_DB" || exit 2
    init_sync_record "$DIRECTION" "remote" "local"
  fi

  # Phase 2: Export
  log_header "Phase 2: Export"
  update_sync_progress "export"

  BACKUP_FILE="$BACKUP_DIR/archon-sync-$SYNC_ID.sql"
  export_database "$DIRECTION" "$BACKUP_FILE" || {
    complete_sync_record "failed" "Export failed"
    cleanup
    exit 3
  }

  # Phase 3: Import
  log_header "Phase 3: Import"
  update_sync_progress "import"

  import_database "$DIRECTION" "$BACKUP_FILE" || {
    complete_sync_record "failed" "Import failed"
    cleanup
    exit 3
  }

  # Phase 4: Verification
  verify_row_counts "$DIRECTION" || {
    complete_sync_record "failed" "Row count verification failed"
    cleanup
    exit 4
  }

  # TODO: Phase 5 will be implemented in Task 2.5
  # Phase 5: Vector Index Rebuild (only for remote-to-local)

  log_success "Sync completed successfully!"
  log_warning "Vector index rebuild not yet implemented (see Task 2.5)"

  # Mark as completed
  update_sync_progress "completed" "" 0 0 100
  complete_sync_record "completed" ""

  # Cleanup
  cleanup

  log_header "Sync Summary"
  local duration=$(($(date +%s) - START_TIME))
  echo "  Sync ID: $SYNC_ID"
  echo "  Status: Core structure complete (export/import pending)"
  echo "  Duration: ${duration}s"
  echo ""
  log_success "Sync core structure created successfully!"
}

# Run main function
main "$@"
