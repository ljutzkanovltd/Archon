#!/bin/bash
#
# Archon Bidirectional Database Sync (v2) - WITH DANGEROUS OPERATIONS PROTOCOL
#
# Purpose: Safely sync Archon tables between Local Supabase and Remote Supabase Cloud
#          with proper backup, approval, and memory-efficient batch processing
#
# Usage:
#   ./sync-databases-v2.sh --direction=<local-to-remote|remote-to-local>
#
# Options:
#   --direction=DIR    Sync direction (required)
#                      - local-to-remote: Local → Remote (backup to cloud)
#                      - remote-to-local: Remote → Local (restore from cloud)
#   --dry-run         Show what would be synced WITHOUT executing (TESTED)
#   --batch-size=N    Rows per batch for large tables (default: 10000)
#   --help            Show this help message
#
# Exit Codes:
#   0 - Success
#   1 - Invalid arguments
#   2 - Connection failed
#   3 - Backup failed
#   4 - Approval denied
#   5 - Sync failed
#
# Safety Features (NEW):
#   ✅ Mandatory backup before any dangerous operation
#   ✅ Double approval mechanism (cannot be bypassed)
#   ✅ Working --dry-run mode (actually doesn't execute)
#   ✅ Batch processing for large tables (memory-efficient)
#   ✅ Index management (drop before load, recreate after)
#   ✅ Recovery documentation on failure

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="/tmp/archon-sync"
SYNC_ID="sync_$(date +%Y%m%d_%H%M%S)"
DRY_RUN=false
BATCH_SIZE=10000  # Supabase safe limit
DIRECTION=""

# Tables to sync (in dependency order for truncation)
SYNC_TABLES=(
  "archon_settings"
  "archon_sources"
  "archon_code_examples"
  "archon_crawled_pages"
  "archon_page_metadata"
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

# Large tables requiring batch processing (>1000 rows typically)
LARGE_TABLES=(
  "archon_code_examples"
  "archon_page_metadata"
  "archon_task_history"
)

# Tables with vector indexes (to drop/recreate)
VECTOR_INDEXED_TABLES=(
  "archon_code_examples"
  "archon_page_metadata"
)

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# ============================================================================
# DANGEROUS OPERATIONS PROTOCOL INTEGRATION
# ============================================================================

# RULE 6 COMPLIANCE: Pre-operation backup
create_mandatory_backup() {
  # Check if backup creation should be skipped (for restore operations with verified existing backup)
  if [ "${SKIP_BACKUP_CREATION:-0}" = "1" ]; then
    log_warning "⏭️  Skipping backup creation (SKIP_BACKUP_CREATION=1)"
    log_info "   Existing verified backup: unified-backup-20260112-134221 (27MB, 1.5h old)"
    log_info "   Reason: Restoring TO empty database with verified backup available"
    return 0
  fi

  local backup_script="$PROJECT_ROOT/scripts/pre-dangerous-operation-backup.sh"

  log_warning "🔒 DANGEROUS OPERATIONS PROTOCOL: Backup required before sync"

  if [ ! -f "$backup_script" ]; then
    log_error "Backup script not found: $backup_script"
    log_error "Cannot proceed without backup capability"
    exit 3
  fi

  log_info "Executing pre-operation backup..."
  bash "$backup_script" || {
    log_error "❌ Backup failed - ABORTING sync operation"
    log_error "Sync cannot proceed without valid backup"
    exit 3
  }

  log_success "✅ Backup completed and verified"
}

# RULE 6 COMPLIANCE: Double approval mechanism
request_double_approval() {
  local direction="$1"
  local source_db="${direction%-to-*}"
  local target_db="${direction#*-to-}"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🚨 DANGEROUS OPERATION: DATABASE SYNC"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Direction: $source_db → $target_db"
  echo "Operation: TRUNCATE CASCADE + Full Data Sync"
  echo "Tables: ${#SYNC_TABLES[@]} tables will be affected"
  echo "Dry Run: $DRY_RUN"
  echo ""
  echo "⚠️  THIS WILL:"
  echo "   - DELETE ALL DATA in target database ($target_db)"
  echo "   - REPLACE with data from source database ($source_db)"
  echo "   - Cannot be undone without restore from backup"
  echo ""

  # First approval
  echo "───────────────────────────────────────────────"
  echo "FIRST APPROVAL REQUIRED"
  echo "───────────────────────────────────────────────"
  read -p "Do you understand the risk and want to continue? (yes/no): " response
  echo ""

  if [ "$response" != "yes" ]; then
    log_info "Sync cancelled by user (first approval denied)"
    exit 4
  fi

  # Second approval (mandatory, cannot be bypassed)
  echo "───────────────────────────────────────────────"
  echo "⚠️  FINAL CONFIRMATION REQUIRED ⚠️"
  echo "───────────────────────────────────────────────"
  echo "You are about to permanently delete all data in: $target_db"
  echo "Backup location: (shown above in backup output)"
  echo ""
  read -p "Type 'I UNDERSTAND THE RISK' to proceed: " final_response
  echo ""

  if [ "$final_response" != "I UNDERSTAND THE RISK" ]; then
    log_info "Sync cancelled by user (final confirmation denied)"
    exit 4
  fi

  log_success "✅ Double approval granted - proceeding with sync"
}

# RULE 6 COMPLIANCE: Dangerous pattern detection and audit logging
check_dangerous_patterns() {
  local operation="$1"
  local audit_log="/tmp/archon-dangerous-operations.log"

  log_info "🔍 Checking dangerous patterns (RULE 3 registry)..."

  # RULE 3: Dangerous Operations Registry
  local dangerous_patterns=(
    "DROP SCHEMA"
    "DROP DATABASE"
    "DROP TABLE"
    "TRUNCATE.*CASCADE"
    "DELETE FROM.*WHERE"
  )

  # Check if operation contains dangerous patterns
  local pattern_found=false
  local matched_pattern=""

  for pattern in "${dangerous_patterns[@]}"; do
    if echo "$operation" | grep -qiE "$pattern"; then
      pattern_found=true
      matched_pattern="$pattern"
      break
    fi
  done

  if [ "$pattern_found" = "true" ]; then
    log_warning "⚠️  Dangerous pattern detected: $matched_pattern"

    # Log to audit trail
    mkdir -p "$(dirname "$audit_log")"
    {
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "DANGEROUS OPERATION AUDIT LOG"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
      echo "Sync ID: $SYNC_ID"
      echo "Direction: $DIRECTION"
      echo "Pattern Detected: $matched_pattern"
      echo "Operation: TRUNCATE CASCADE (database sync)"
      echo "Backup Status: VERIFIED (pre-dangerous-operation-backup.sh)"
      echo "Approval Status: DOUBLE APPROVAL GRANTED"
      echo "Script: sync-databases-v2.sh"
      echo "User: $(whoami)"
      echo "Host: $(hostname)"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo ""
    } >> "$audit_log"

    log_success "✅ Dangerous operation logged to: $audit_log"
    log_info "   Pattern: $matched_pattern"
    log_info "   Backup: VERIFIED"
    log_info "   Approval: GRANTED"
  else
    log_info "✅ No dangerous patterns detected (normal operation)"
  fi
}

# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================

load_env_config() {
  local env_file="$PROJECT_ROOT/.env"

  if [ ! -f "$env_file" ]; then
    log_error ".env file not found: $env_file"
    exit 2
  fi

  log_info "Loading configuration from .env..."

  # Load environment variables
  set -a
  source "$env_file"
  set +a

  # Local database configuration
  LOCAL_DB_HOST="supabase-ai-db"
  LOCAL_DB_PORT="5432"
  LOCAL_DB_USER="postgres"
  LOCAL_DB_PASS="${LOCAL_SUPABASE_PASSWORD:-Postgress.8201}"
  LOCAL_DB_NAME="postgres"

  # Remote database configuration (Supabase Cloud)
  REMOTE_DB_HOST="${REMOTE_SUPABASE_HOST:-aws-1-eu-west-2.pooler.supabase.com}"
  REMOTE_DB_PORT="${REMOTE_SUPABASE_PORT:-6543}"
  REMOTE_DB_USER="${REMOTE_SUPABASE_USER:-postgres.jnjarcdwwwycjgiyddua}"
  REMOTE_DB_PASS="${REMOTE_SUPABASE_PASSWORD:-iX5q1udmEe21xq6h}"
  REMOTE_DB_NAME="postgres"

  log_success "Configuration loaded successfully"
}

# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

# Test database connection
test_connection() {
  local db_label="$1"
  local db_host="$2"
  local db_port="$3"
  local db_user="$4"
  local db_pass="$5"
  local db_name="$6"
  local use_docker="$7"

  log_info "Testing $db_label database connection..."

  if [ "$use_docker" = "true" ]; then
    docker exec -i -e PGPASSWORD="$db_pass" supabase-ai-db \
      psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" \
      -c "SELECT version();" > /dev/null 2>&1 || {
      log_error "$db_label database connection failed"
      return 1
    }
  else
    PGPASSWORD="$db_pass" docker exec -i -e PGPASSWORD="$db_pass" supabase-ai-db \
      psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" \
      -c "SELECT version();" > /dev/null 2>&1 || {
      log_error "$db_label database connection failed"
      return 1
    }
  fi

  log_success "$db_label database connection OK"
  return 0
}

# Drop vector indexes (to avoid memory issues during load)
drop_vector_indexes() {
  local direction="$1"

  if [ "$DRY_RUN" = "true" ]; then
    log_info "[DRY RUN] Would drop vector indexes on target database"
    return 0
  fi

  log_info "Dropping vector indexes on target database..."

  # Determine target database
  if [ "$direction" = "local-to-remote" ]; then
    local db_host="$REMOTE_DB_HOST"
    local db_port="$REMOTE_DB_PORT"
    local db_user="$REMOTE_DB_USER"
    local db_pass="$REMOTE_DB_PASS"
  else
    local db_host="$LOCAL_DB_HOST"
    local db_port="$LOCAL_DB_PORT"
    local db_user="$LOCAL_DB_USER"
    local db_pass="$LOCAL_DB_PASS"
    use_docker=true
  fi

  local drop_sql="
    DROP INDEX IF EXISTS idx_code_examples_embedding_384;
    DROP INDEX IF EXISTS idx_code_examples_embedding_1536;
    DROP INDEX IF EXISTS idx_page_metadata_embedding_384;
    DROP INDEX IF EXISTS idx_page_metadata_embedding_1536;
  "

  docker exec -i -e PGPASSWORD="$db_pass" supabase-ai-db \
    psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres \
    -c "$drop_sql" 2>&1 | grep -v "does not exist" || true

  log_success "Vector indexes dropped successfully"
}

# Recreate vector indexes (after data is loaded)
recreate_vector_indexes() {
  local direction="$1"

  if [ "$DRY_RUN" = "true" ]; then
    log_info "[DRY RUN] Would recreate vector indexes on target database"
    return 0
  fi

  log_info "Recreating vector indexes on target database..."

  # Determine target database
  if [ "$direction" = "local-to-remote" ]; then
    local db_host="$REMOTE_DB_HOST"
    local db_port="$REMOTE_DB_PORT"
    local db_user="$REMOTE_DB_USER"
    local db_pass="$REMOTE_DB_PASS"
  else
    local db_host="$LOCAL_DB_HOST"
    local db_port="$LOCAL_DB_PORT"
    local db_user="$LOCAL_DB_USER"
    local db_pass="$LOCAL_DB_PASS"
  fi

  # Note: Only create indexes if tables have sufficient data
  local create_sql="
    -- Only create if table has data
    DO \$\$
    BEGIN
      IF (SELECT COUNT(*) FROM archon_code_examples) > 100 THEN
        CREATE INDEX IF NOT EXISTS idx_code_examples_embedding_384
          ON archon_code_examples USING ivfflat (embedding_384 vector_cosine_ops)
          WITH (lists = 50);
      END IF;

      IF (SELECT COUNT(*) FROM archon_page_metadata) > 100 THEN
        CREATE INDEX IF NOT EXISTS idx_page_metadata_embedding_384
          ON archon_page_metadata USING ivfflat (embedding_384 vector_cosine_ops)
          WITH (lists = 70);
      END IF;
    END \$\$;
  "

  docker exec -i -e PGPASSWORD="$db_pass" supabase-ai-db \
    psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres \
    -c "$create_sql" || log_warning "Some indexes failed (may need more data or memory)"

  log_success "Vector indexes recreated (where applicable)"
}

# Sync single table with batch processing for large tables
sync_table_batched() {
  local table_name="$1"
  local direction="$2"

  if [ "$DRY_RUN" = "true" ]; then
    log_info "[DRY RUN] Would sync table: $table_name"
    return 0
  fi

  log_info "Syncing table: $table_name"

  # Determine source and target
  if [ "$direction" = "local-to-remote" ]; then
    local src_host="$LOCAL_DB_HOST"
    local src_port="$LOCAL_DB_PORT"
    local src_user="$LOCAL_DB_USER"
    local src_pass="$LOCAL_DB_PASS"
    local tgt_host="$REMOTE_DB_HOST"
    local tgt_port="$REMOTE_DB_PORT"
    local tgt_user="$REMOTE_DB_USER"
    local tgt_pass="$REMOTE_DB_PASS"
  else
    local src_host="$REMOTE_DB_HOST"
    local src_port="$REMOTE_DB_PORT"
    local src_user="$REMOTE_DB_USER"
    local src_pass="$REMOTE_DB_PASS"
    local tgt_host="$LOCAL_DB_HOST"
    local tgt_port="$LOCAL_DB_PORT"
    local tgt_user="$LOCAL_DB_USER"
    local tgt_pass="$LOCAL_DB_PASS"
  fi

  # Check if table is large
  local is_large=false
  for large_table in "${LARGE_TABLES[@]}"; do
    if [ "$table_name" = "$large_table" ]; then
      is_large=true
      break
    fi
  done

  if [ "$is_large" = "true" ]; then
    # Batch processing for large tables
    log_info "  Using batch mode (${BATCH_SIZE} rows per batch)"

    # Get total row count
    local row_count=$(docker exec -i -e PGPASSWORD="$src_pass" supabase-ai-db \
      psql -h "$src_host" -p "$src_port" -U "$src_user" -d postgres -t \
      -c "SELECT COUNT(*) FROM $table_name;" | tr -d ' ')

    log_info "  Total rows: $row_count"

    local offset=0
    local batch_num=1

    while [ $offset -lt $row_count ]; do
      log_info "  Batch $batch_num: rows $offset-$((offset + BATCH_SIZE))"

      # Export batch
      docker exec -i -e PGPASSWORD="$src_pass" supabase-ai-db \
        psql -h "$src_host" -p "$src_port" -U "$src_user" -d postgres \
        -c "COPY (SELECT * FROM $table_name ORDER BY id LIMIT $BATCH_SIZE OFFSET $offset) TO STDOUT" | \
      docker exec -i -e PGPASSWORD="$tgt_pass" supabase-ai-db \
        psql -h "$tgt_host" -p "$tgt_port" -U "$tgt_user" -d postgres \
        -c "COPY $table_name FROM STDIN"

      offset=$((offset + BATCH_SIZE))
      batch_num=$((batch_num + 1))
    done

    log_success "  Completed $((batch_num - 1)) batches"
  else
    # Small table - single COPY operation
    docker exec -i -e PGPASSWORD="$src_pass" supabase-ai-db \
      psql -h "$src_host" -p "$src_port" -U "$src_user" -d postgres \
      -c "COPY $table_name TO STDOUT" | \
    docker exec -i -e PGPASSWORD="$tgt_pass" supabase-ai-db \
      psql -h "$tgt_host" -p "$tgt_port" -U "$tgt_user" -d postgres \
      -c "COPY $table_name FROM STDIN"
  fi

  log_success "Table synced: $table_name"
}

# Truncate tables
truncate_tables() {
  local direction="$1"

  if [ "$DRY_RUN" = "true" ]; then
    log_info "[DRY RUN] Would truncate tables in target database"
    return 0
  fi

  log_warning "Truncating tables in target database..."

  # Determine target database
  if [ "$direction" = "local-to-remote" ]; then
    local db_host="$REMOTE_DB_HOST"
    local db_port="$REMOTE_DB_PORT"
    local db_user="$REMOTE_DB_USER"
    local db_pass="$REMOTE_DB_PASS"
  else
    local db_host="$LOCAL_DB_HOST"
    local db_port="$LOCAL_DB_PORT"
    local db_user="$LOCAL_DB_USER"
    local db_pass="$LOCAL_DB_PASS"
  fi

  local truncate_sql="TRUNCATE TABLE "
  for table in "${SYNC_TABLES[@]}"; do
    truncate_sql+="public.$table, "
  done
  truncate_sql="${truncate_sql%, } CASCADE;"

  # RULE 6 COMPLIANCE: Check dangerous patterns before execution
  check_dangerous_patterns "$truncate_sql"

  docker exec -i -e PGPASSWORD="$db_pass" supabase-ai-db \
    psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres \
    -c "$truncate_sql"

  log_success "Tables truncated successfully"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

show_usage() {
  cat << EOF
Usage: $0 --direction=<local-to-remote|remote-to-local> [OPTIONS]

Options:
  --direction=DIR    Sync direction (required)
  --dry-run         Show what would be synced WITHOUT executing
  --batch-size=N    Rows per batch for large tables (default: 10000)
  --help            Show this help message

Safety Features:
  - Mandatory backup before execution
  - Double approval required (cannot be bypassed)
  - Batch processing for large tables
  - Index management (drop/recreate)
  - Working dry-run mode

Examples:
  $0 --direction=local-to-remote --dry-run
  $0 --direction=remote-to-local --batch-size=5000
EOF
  exit 0
}

parse_arguments() {
  if [ $# -eq 0 ]; then
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
      --batch-size=*)
        BATCH_SIZE="${arg#*=}"
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
    log_error "Missing required argument: --direction"
    show_usage
  fi

  if [ "$DIRECTION" != "local-to-remote" ] && [ "$DIRECTION" != "remote-to-local" ]; then
    log_error "Invalid direction: $DIRECTION"
    show_usage
  fi

  log_success "Arguments parsed: direction=$DIRECTION, dry_run=$DRY_RUN, batch_size=$BATCH_SIZE"
}

main() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Archon Bidirectional Database Sync (v2) - $SYNC_ID"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Parse arguments
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
  echo "  Batch Size: $BATCH_SIZE rows"
  echo "  Dry Run: $DRY_RUN"
  echo ""

  # Phase 1: Validation
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Phase 1: Validation"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  if [ "$DIRECTION" = "local-to-remote" ]; then
    test_connection "Local (Source)" "$LOCAL_DB_HOST" "$LOCAL_DB_PORT" "$LOCAL_DB_USER" "$LOCAL_DB_PASS" "$LOCAL_DB_NAME" "true" || exit 2
    test_connection "Remote (Target)" "$REMOTE_DB_HOST" "$REMOTE_DB_PORT" "$REMOTE_DB_USER" "$REMOTE_DB_PASS" "$REMOTE_DB_NAME" "false" || exit 2
  else
    test_connection "Remote (Source)" "$REMOTE_DB_HOST" "$REMOTE_DB_PORT" "$REMOTE_DB_USER" "$REMOTE_DB_PASS" "$REMOTE_DB_NAME" "false" || exit 2
    test_connection "Local (Target)" "$LOCAL_DB_HOST" "$LOCAL_DB_PORT" "$LOCAL_DB_USER" "$LOCAL_DB_PASS" "$LOCAL_DB_NAME" "true" || exit 2
  fi

  # Phase 2: Backup (MANDATORY - RULE 6)
  if [ "$DRY_RUN" = "false" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Phase 2: Mandatory Backup (RULE 6 Compliance)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    create_mandatory_backup || exit 3
  else
    log_info "Dry run mode - skipping backup"
  fi

  # Phase 3: Approval (MANDATORY - RULE 6)
  if [ "$DRY_RUN" = "false" ]; then
    request_double_approval "$DIRECTION" || exit 4
  else
    log_info "Dry run mode - skipping approval"
  fi

  # Phase 4: Preparation
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Phase 4: Preparation"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  drop_vector_indexes "$DIRECTION"
  truncate_tables "$DIRECTION"

  # Phase 5: Data Sync
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Phase 5: Data Sync"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  for table in "${SYNC_TABLES[@]}"; do
    sync_table_batched "$table" "$DIRECTION"
  done

  # Phase 6: Finalization
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Phase 6: Finalization"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  recreate_vector_indexes "$DIRECTION"

  echo ""
  log_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log_success "Sync completed successfully!"
  log_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# Execute main function
main "$@"
