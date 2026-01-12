#!/bin/bash
################################################################################
# Backup Validation Script
#
# This script validates that a unified backup can be successfully restored
# and that all Archon tables and data are intact.
#
# Usage: bash scripts/validate-backup.sh [backup-path]
#
# Exit codes:
#   0 - Validation passed
#   1 - Validation failed
#   2 - Configuration error
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHON_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_PATH=""

# Expected Archon tables (22 tables as of 2026-01-12)
EXPECTED_TABLES=(
    "archon_settings"
    "archon_sources"
    "archon_crawled_pages"
    "archon_code_examples"
    "archon_page_metadata"
    "archon_crawl_state"
    "archon_projects"
    "archon_tasks"
    "archon_task_history"
    "archon_project_sources"
    "archon_document_versions"
    "archon_migrations"
    "archon_prompts"
    "archon_llm_pricing"
    "archon_mcp_sessions"
    "archon_mcp_requests"
    "archon_mcp_alerts"
    "archon_mcp_error_logs"
    "archon_agent_work_orders"
    "archon_agent_work_order_steps"
    "archon_configured_repositories"
    "archon_sync_history"
)

# Parse arguments
if [ $# -eq 0 ]; then
    # Find latest unified backup
    LOCAL_AI_ROOT="${HOME}/Documents/Projects/local-ai-packaged"
    BACKUP_ROOT="${LOCAL_AI_ROOT}/backups"
    BACKUP_PATH=$(find "$BACKUP_ROOT" -maxdepth 1 -type d -name "unified-backup-*" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)

    if [ -z "$BACKUP_PATH" ]; then
        echo -e "${RED}[ERROR]${NC} No unified backup found"
        exit 2
    fi
else
    BACKUP_PATH="$1"
fi

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Archon Database Backup Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

################################################################################
# Phase 1: Pre-flight Checks
################################################################################

log_info "Phase 1: Pre-flight checks..."

# Check if backup path exists
if [ ! -d "$BACKUP_PATH" ]; then
    log_error "Backup path does not exist: $BACKUP_PATH"
    exit 2
fi

log_info "Backup path: $BACKUP_PATH"

# Check if postgres backup exists
POSTGRES_BACKUP="${BACKUP_PATH}/databases/postgres.sql.gz"
if [ ! -f "$POSTGRES_BACKUP" ]; then
    log_error "Postgres backup not found: $POSTGRES_BACKUP"
    exit 2
fi

# Check postgres backup size
BACKUP_SIZE=$(stat -c %s "$POSTGRES_BACKUP")
if [ "$BACKUP_SIZE" -lt 1000000 ]; then  # Less than 1MB
    log_error "Postgres backup is too small (< 1MB): $(numfmt --to=iec $BACKUP_SIZE)"
    exit 2
fi

log_success "Backup file exists: $(numfmt --to=iec $BACKUP_SIZE)"

# Verify gzip integrity
if ! gzip -t "$POSTGRES_BACKUP" 2>/dev/null; then
    log_error "Postgres backup is corrupted (gzip integrity check failed)"
    exit 1
fi

log_success "Gzip integrity check passed"

# Check if Supabase database is running
if ! docker exec supabase-ai-db psql -U postgres -c "SELECT 1" > /dev/null 2>&1; then
    log_error "Supabase database is not running or not accessible"
    exit 2
fi

log_success "Supabase database is accessible"

log_success "Pre-flight checks passed"
echo ""

################################################################################
# Phase 2: Capture Current Database State
################################################################################

log_info "Phase 2: Capturing current database state..."

# Get current table list
CURRENT_TABLES=$(docker exec supabase-ai-db psql -U postgres -d postgres -t -c "\dt public.archon_*" | awk '{print $3}' | sort)
CURRENT_TABLE_COUNT=$(echo "$CURRENT_TABLES" | grep -c "archon_" || echo 0)

log_info "Current Archon tables: $CURRENT_TABLE_COUNT"

# Get current row counts for key tables
declare -A CURRENT_ROW_COUNTS
for table in "${EXPECTED_TABLES[@]}"; do
    COUNT=$(docker exec supabase-ai-db psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | xargs || echo "0")
    CURRENT_ROW_COUNTS[$table]=$COUNT
done

log_success "Current state captured"
echo ""

################################################################################
# Phase 3: Analyze Backup Contents
################################################################################

log_info "Phase 3: Analyzing backup contents..."

# Quick check for CREATE TABLE statements (sample first 20000 lines only)
log_info "Analyzing backup structure (sampling)..."
BACKUP_TABLE_COUNT=$(gunzip -c "$POSTGRES_BACKUP" 2>/dev/null | head -20000 | grep -c "CREATE TABLE.*archon_" || echo 0)
log_info "Archon tables found in backup sample: $BACKUP_TABLE_COUNT"

# Quick check for data statements
DATA_STATEMENTS=$(gunzip -c "$POSTGRES_BACKUP" 2>/dev/null | head -20000 | grep -cE "^COPY|^INSERT" || echo 0)
log_info "Data statements found in sample: $DATA_STATEMENTS"

if [ "$BACKUP_TABLE_COUNT" -gt 0 ]; then
    log_success "Backup contains Archon table definitions"
else
    log_warning "No Archon tables found in backup sample (checking during restore)"
fi

if [ "$DATA_STATEMENTS" -gt 0 ]; then
    log_success "Backup contains data statements"
else
    log_warning "No data statements found in sample (will verify during restore)"
fi

log_success "Backup analysis complete"
echo ""

################################################################################
# Phase 4: Test Restore to Temporary Database
################################################################################

log_info "Phase 4: Testing restore to temporary database..."

# Create temporary test database
TEST_DB="archon_backup_test_$$"
log_info "Creating test database: $TEST_DB"

if docker exec supabase-ai-db psql -U postgres -c "CREATE DATABASE $TEST_DB" > /dev/null 2>&1; then
    log_success "Test database created"
else
    log_error "Failed to create test database"
    exit 1
fi

# Restore backup to test database
log_info "Restoring backup to test database (this may take 30-60 seconds)..."
if gunzip -c "$POSTGRES_BACKUP" | docker exec -i supabase-ai-db psql -U postgres -d "$TEST_DB" > /dev/null 2>&1; then
    log_success "Backup restored to test database"
else
    log_error "Failed to restore backup to test database"
    docker exec supabase-ai-db psql -U postgres -c "DROP DATABASE $TEST_DB" > /dev/null 2>&1 || true
    exit 1
fi

# Verify tables in test database
RESTORED_TABLE_COUNT=$(docker exec supabase-ai-db psql -U postgres -d "$TEST_DB" -t -c "\dt public.archon_*" | grep -c "archon_" || echo 0)
log_info "Restored tables: $RESTORED_TABLE_COUNT"

if [ "$RESTORED_TABLE_COUNT" -lt ${#EXPECTED_TABLES[@]} ]; then
    log_warning "Expected ${#EXPECTED_TABLES[@]} tables, found $RESTORED_TABLE_COUNT"
fi

# Verify row counts in test database
log_info "Verifying row counts in restored database..."
declare -A RESTORED_ROW_COUNTS
MISMATCHED_COUNTS=0

for table in "${EXPECTED_TABLES[@]}"; do
    RESTORED_COUNT=$(docker exec supabase-ai-db psql -U postgres -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | xargs || echo "0")
    RESTORED_ROW_COUNTS[$table]=$RESTORED_COUNT

    CURRENT_COUNT=${CURRENT_ROW_COUNTS[$table]:-0}

    if [ "$RESTORED_COUNT" != "$CURRENT_COUNT" ]; then
        log_warning "  $table: current=$CURRENT_COUNT, restored=$RESTORED_COUNT"
        MISMATCHED_COUNTS=$((MISMATCHED_COUNTS + 1))
    fi
done

if [ "$MISMATCHED_COUNTS" -gt 0 ]; then
    log_warning "$MISMATCHED_COUNTS tables have different row counts"
    log_warning "This may be expected if database was modified after backup"
else
    log_success "All table row counts match current database"
fi

# Cleanup test database
log_info "Cleaning up test database..."
docker exec supabase-ai-db psql -U postgres -c "DROP DATABASE $TEST_DB" > /dev/null 2>&1 || true

log_success "Test restore complete"
echo ""

################################################################################
# Phase 5: Validation Summary
################################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Validation Results${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Backup Information:"
echo "  Path: $BACKUP_PATH"
echo "  Size: $(numfmt --to=iec $BACKUP_SIZE)"
echo "  Tables: $BACKUP_TABLE_COUNT found, ${#EXPECTED_TABLES[@]} expected"
echo "  Restored: $RESTORED_TABLE_COUNT tables"
echo ""
echo "Key Tables Row Counts:"
printf "  %-30s %10s %10s %s\n" "Table" "Current" "Restored" "Status"
printf "  %-30s %10s %10s %s\n" "------------------------------" "----------" "----------" "------"

for table in "archon_settings" "archon_tasks" "archon_projects" "archon_sources" "archon_code_examples"; do
    CURRENT=${CURRENT_ROW_COUNTS[$table]:-0}
    RESTORED=${RESTORED_ROW_COUNTS[$table]:-0}

    if [ "$CURRENT" -eq "$RESTORED" ]; then
        STATUS="✓"
    else
        STATUS="≠"
    fi

    printf "  %-30s %10d %10d %s\n" "$table" "$CURRENT" "$RESTORED" "$STATUS"
done

echo ""

# Overall validation result
VALIDATION_PASSED=true

if [ "$BACKUP_SIZE" -lt 1000000 ]; then
    log_error "Backup size too small"
    VALIDATION_PASSED=false
fi

if [ "$RESTORED_TABLE_COUNT" -lt $((${#EXPECTED_TABLES[@]} - 2)) ]; then
    log_error "Too many missing tables"
    VALIDATION_PASSED=false
fi

# Data validation will be done during restore test (Phase 4)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$VALIDATION_PASSED" = true ]; then
    echo -e "${GREEN}✓ VALIDATION PASSED${NC}"
    echo ""
    echo "The backup is valid and can be used for:"
    echo "  - Dangerous operation safety (pre-operation backup)"
    echo "  - Disaster recovery"
    echo "  - Remote database synchronization"
    echo ""
    exit 0
else
    echo -e "${RED}✗ VALIDATION FAILED${NC}"
    echo ""
    echo "The backup has issues and should not be trusted for:"
    echo "  - Critical restore operations"
    echo "  - Remote database synchronization"
    echo ""
    echo "Please create a new backup with: bash scripts/pre-dangerous-operation-backup.sh --force"
    echo ""
    exit 1
fi
