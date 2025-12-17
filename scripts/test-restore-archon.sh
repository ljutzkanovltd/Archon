#!/usr/bin/env bash
#
# test-restore-archon.sh - Automated Archon Database Restore Testing
#
# This script performs monthly validation of Archon backups by:
# 1. Creating a temporary test database
# 2. Restoring the latest backup to the test database
# 3. Validating all Archon tables exist and contain data
# 4. Cleaning up the test database
# 5. Generating a test report
#
# Schedule: First Sunday of each month at 4 AM
# Cron: 0 4 1 * * /path/to/test-restore-archon.sh
#

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Paths
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly BACKUP_DIR="${PROJECT_ROOT}/backups"
readonly LOG_DIR="${PROJECT_ROOT}/logs"
readonly LOG_FILE="${LOG_DIR}/restore-test-$(date +%Y%m%d_%H%M%S).log"

# Database config
readonly DB_CONTAINER="supabase-ai-db"
readonly DB_USER="postgres"
readonly TEST_DB="archon_restore_test"
readonly PROD_DB="postgres"

# Expected Archon tables
readonly EXPECTED_TABLES=(
    "archon_code_examples"
    "archon_crawled_pages"
    "archon_document_versions"
    "archon_migrations"
    "archon_page_metadata"
    "archon_project_sources"
    "archon_projects"
    "archon_prompts"
    "archon_settings"
    "archon_sources"
    "archon_tasks"
)

# Test results
declare -A TEST_RESULTS
TEST_START_TIME=$(date +%s)
ERRORS=0

#
# Logging functions
#
log() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" | tee -a "$LOG_FILE"
}

log_error() {
    local message="$1"
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}ERROR${NC}: $message" | tee -a "$LOG_FILE"
    ((ERRORS++))
}

log_success() {
    local message="$1"
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}SUCCESS${NC}: $message" | tee -a "$LOG_FILE"
}

log_warning() {
    local message="$1"
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}WARNING${NC}: $message" | tee -a "$LOG_FILE"
}

#
# Print section header
#
print_section() {
    local title="$1"
    echo "" | tee -a "$LOG_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
    echo "  $title" | tee -a "$LOG_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
}

#
# Initialize log directory
#
init_logging() {
    mkdir -p "$LOG_DIR"
    log "Archon Restore Test Started"
    log "Log file: $LOG_FILE"
}

#
# Verify prerequisites
#
verify_prerequisites() {
    print_section "Verifying Prerequisites"

    # Check if Docker container is running
    if ! docker ps --filter "name=${DB_CONTAINER}" --filter "status=running" --quiet | grep -q .; then
        log_error "Database container '${DB_CONTAINER}' is not running"
        return 1
    fi
    log_success "Database container is running"

    # Check if PostgreSQL is ready
    if ! docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" >/dev/null 2>&1; then
        log_error "PostgreSQL is not ready"
        return 1
    fi
    log_success "PostgreSQL is ready"

    # Check if production database exists
    if ! docker exec "$DB_CONTAINER" psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$PROD_DB"; then
        log_error "Production database '${PROD_DB}' does not exist"
        return 1
    fi
    log_success "Production database exists"

    # Check backup directory
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_error "Backup directory not found: $BACKUP_DIR"
        return 1
    fi
    log_success "Backup directory exists"

    return 0
}

#
# Find latest backup
#
find_latest_backup() {
    print_section "Finding Latest Backup"

    local latest_backup
    latest_backup=$(find "$BACKUP_DIR" -name "archon_postgres-*.dump" -type f | sort -r | head -1)

    if [[ -z "$latest_backup" ]]; then
        log_error "No backup files found in $BACKUP_DIR"
        return 1
    fi

    log "Latest backup: $(basename "$latest_backup")"

    # Get backup size and age
    local backup_size
    backup_size=$(du -h "$latest_backup" | cut -f1)
    local backup_age
    backup_age=$(stat -c %y "$latest_backup" | cut -d' ' -f1,2)

    log "  Size: $backup_size"
    log "  Created: $backup_age"

    echo "$latest_backup"
    return 0
}

#
# Create test database
#
create_test_database() {
    print_section "Creating Test Database"

    # Drop test database if it exists (cleanup from previous failed run)
    if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$TEST_DB"; then
        log_warning "Test database already exists, dropping..."
        docker exec "$DB_CONTAINER" psql -U "$DB_USER" -c "DROP DATABASE ${TEST_DB};" >/dev/null 2>&1 || true
    fi

    # Create test database
    if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -c "CREATE DATABASE ${TEST_DB};" >/dev/null 2>&1; then
        log_success "Created test database: $TEST_DB"
        return 0
    else
        log_error "Failed to create test database"
        return 1
    fi
}

#
# Restore backup to test database
#
restore_backup() {
    local backup_file="$1"
    print_section "Restoring Backup to Test Database"

    log "Restoring: $(basename "$backup_file")"

    # Restore using pg_restore
    if cat "$backup_file" | docker exec -i "$DB_CONTAINER" pg_restore \
        --username="$DB_USER" \
        --dbname="$TEST_DB" \
        --no-owner \
        --no-privileges \
        --verbose 2>&1 | tee -a "$LOG_FILE" | grep -q "processing"; then

        log_success "Backup restored successfully"
        return 0
    else
        log_error "Failed to restore backup"
        return 1
    fi
}

#
# Validate Archon tables exist
#
validate_tables() {
    print_section "Validating Archon Tables"

    local missing_tables=0
    local total_tables=${#EXPECTED_TABLES[@]}

    for table in "${EXPECTED_TABLES[@]}"; do
        if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -tAc \
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" | grep -q "t"; then

            log_success "✓ Table exists: $table"
            TEST_RESULTS["$table"]="EXISTS"
        else
            log_error "✗ Table missing: $table"
            TEST_RESULTS["$table"]="MISSING"
            ((missing_tables++))
        fi
    done

    log ""
    log "Table validation: $((total_tables - missing_tables))/${total_tables} tables found"

    if [[ $missing_tables -gt 0 ]]; then
        log_error "Missing $missing_tables tables"
        return 1
    fi

    return 0
}

#
# Validate data integrity
#
validate_data() {
    print_section "Validating Data Integrity"

    log "Checking row counts in Archon tables..."
    echo "" >> "$LOG_FILE"

    local empty_tables=0
    local total_rows=0

    for table in "${EXPECTED_TABLES[@]}"; do
        local row_count
        row_count=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -tAc \
            "SELECT COUNT(*) FROM $table;")

        total_rows=$((total_rows + row_count))

        if [[ $row_count -eq 0 ]]; then
            log_warning "  $table: $row_count rows (empty)"
            ((empty_tables++))
        else
            log "  $table: $row_count rows"
        fi

        TEST_RESULTS["${table}_rows"]="$row_count"
    done

    log ""
    log "Total rows across all Archon tables: $total_rows"

    if [[ $empty_tables -gt 0 ]]; then
        log_warning "$empty_tables tables are empty (may be normal for new installations)"
    fi

    # Check database size
    local db_size
    db_size=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TEST_DB" -tAc \
        "SELECT pg_size_pretty(pg_database_size('${TEST_DB}'));")
    log "Test database size: $db_size"

    return 0
}

#
# Compare with production database
#
compare_with_production() {
    print_section "Comparing with Production Database"

    log "Comparing row counts between test and production..."
    echo "" >> "$LOG_FILE"

    local differences=0

    for table in "${EXPECTED_TABLES[@]}"; do
        local test_count="${TEST_RESULTS[${table}_rows]}"

        local prod_count
        prod_count=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$PROD_DB" -tAc \
            "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")

        local diff=$((prod_count - test_count))

        if [[ $diff -eq 0 ]]; then
            log "  ✓ $table: test=$test_count, prod=$prod_count (match)"
        elif [[ $diff -gt 0 ]]; then
            log_warning "  ⚠ $table: test=$test_count, prod=$prod_count (+$diff new rows in production)"
            ((differences++))
        else
            log_error "  ✗ $table: test=$test_count, prod=$prod_count ($diff rows - backup may be corrupt!)"
            ((differences++))
        fi
    done

    log ""
    if [[ $differences -gt 0 ]]; then
        log_warning "Found $differences differences (expected if data added since backup)"
    else
        log_success "Test database matches production exactly"
    fi

    return 0
}

#
# Cleanup test database
#
cleanup_test_database() {
    print_section "Cleaning Up"

    if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -c "DROP DATABASE ${TEST_DB};" >/dev/null 2>&1; then
        log_success "Dropped test database"
        return 0
    else
        log_error "Failed to drop test database (manual cleanup may be required)"
        return 1
    fi
}

#
# Generate test report
#
generate_report() {
    print_section "Test Report"

    local test_end_time=$(date +%s)
    local duration=$((test_end_time - TEST_START_TIME))

    log "Test Duration: ${duration} seconds"
    log "Total Errors: $ERRORS"

    if [[ $ERRORS -eq 0 ]]; then
        log_success "✓ ALL TESTS PASSED"
        log_success "Backup is valid and restorable"
        return 0
    else
        log_error "✗ TESTS FAILED ($ERRORS errors)"
        log_error "Review log file: $LOG_FILE"
        return 1
    fi
}

#
# Send email notification (optional)
#
send_notification() {
    local status="$1"
    local subject="Archon Restore Test: $status"
    local body="Test completed at $(date)\nLog file: $LOG_FILE\nErrors: $ERRORS"

    # Uncomment and configure email notification if needed
    # echo -e "$body" | mail -s "$subject" admin@example.com

    log "Email notification: $status (configure send_notification() to enable)"
}

#
# Main execution
#
main() {
    init_logging
    print_section "Archon Database Restore Test"

    # Step 1: Verify prerequisites
    if ! verify_prerequisites; then
        generate_report
        send_notification "FAILED - Prerequisites"
        exit 1
    fi

    # Step 2: Find latest backup
    local backup_file
    if ! backup_file=$(find_latest_backup); then
        generate_report
        send_notification "FAILED - No Backup"
        exit 1
    fi

    # Step 3: Create test database
    if ! create_test_database; then
        generate_report
        send_notification "FAILED - Database Creation"
        exit 1
    fi

    # Step 4: Restore backup
    if ! restore_backup "$backup_file"; then
        cleanup_test_database || true
        generate_report
        send_notification "FAILED - Restore"
        exit 1
    fi

    # Step 5: Validate tables
    if ! validate_tables; then
        cleanup_test_database || true
        generate_report
        send_notification "FAILED - Table Validation"
        exit 1
    fi

    # Step 6: Validate data
    if ! validate_data; then
        cleanup_test_database || true
        generate_report
        send_notification "FAILED - Data Validation"
        exit 1
    fi

    # Step 7: Compare with production
    compare_with_production || true  # Non-critical

    # Step 8: Cleanup
    cleanup_test_database

    # Step 9: Generate report
    if generate_report; then
        send_notification "SUCCESS"
        exit 0
    else
        send_notification "FAILED"
        exit 1
    fi
}

main "$@"
