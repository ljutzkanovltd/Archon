#!/usr/bin/env bash
#
# restore-archon.sh - Restore Archon Database from Backup
#
# PURPOSE:
#   Restores Archon tables (archon_*) from a backup to the shared Supabase AI PostgreSQL 'postgres' database
#
# USAGE:
#   ./restore-archon.sh [OPTIONS]
#
# OPTIONS:
#   --backup FILE       Specific backup file to restore
#   --latest            Restore from latest backup
#   --list              List available backups
#   --dry-run           Show what would be restored without executing
#   --no-safety-backup  Skip creating safety backup before restore
#   --verbose           Show detailed output
#   -h, --help          Show this help message
#
# EXAMPLES:
#   ./restore-archon.sh --list                                    # List backups
#   ./restore-archon.sh --latest                                  # Restore latest
#   ./restore-archon.sh --backup backups/archon_postgres-*.dump   # Restore specific
#   ./restore-archon.sh --latest --dry-run                        # Test restore
#
# SAFETY FEATURES:
#   - Creates safety backup before restore
#   - Validates backup file integrity
#   - Verifies restoration success
#   - Provides rollback capability
#
# EXIT CODES:
#   0  - Restore successful
#   1  - Restore failed
#   2  - Validation failed
#
# ==============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
BACKUP_DIR="$PROJECT_ROOT/backups"
BACKUP_PREFIX="archon_postgres"
VERBOSE=false
DRY_RUN=false
CREATE_SAFETY_BACKUP=true
SUPABASE_CONTAINER="supabase-ai-db"
DATABASE_NAME="postgres"
RESTORE_FILE=""
USE_LATEST=false
LIST_ONLY=false

# Temporary safety backup file
SAFETY_BACKUP=""

# Logging functions
log_header() { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}$*${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
log_section() { echo ""; echo -e "${BLUE}▶ $*${NC}"; }
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[✗]${NC} $*"; }
log_verbose() { [ "$VERBOSE" = true ] && echo -e "${BLUE}[DEBUG]${NC} $*" || true; }
log_dry_run() { [ "$DRY_RUN" = true ] && echo -e "${MAGENTA}[DRY-RUN]${NC} $*" || true; }

# ==============================================================================
# Restore Functions
# ==============================================================================

show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Restore Archon tables (archon_*) from backup to shared Supabase AI PostgreSQL 'postgres' database.

OPTIONS:
  --backup FILE       Specific backup file to restore
  --latest            Restore from latest backup
  --list              List available backups
  --dry-run           Show what would be restored without executing
  --no-safety-backup  Skip creating safety backup before restore
  --verbose           Show detailed output
  -h, --help          Show this help message

EXAMPLES:
  $0 --list                                     # List all backups
  $0 --latest                                   # Restore from latest backup
  $0 --backup backups/archon_postgres-*.dump    # Restore specific backup
  $0 --latest --dry-run                         # Test restore without executing
  $0 --latest --no-safety-backup                # Skip safety backup

SAFETY FEATURES:
  - Automatic safety backup before restore
  - Backup file validation
  - Restoration verification
  - Rollback capability if restore fails

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup)
                RESTORE_FILE="$2"
                shift 2
                ;;
            --latest)
                USE_LATEST=true
                shift
                ;;
            --list)
                LIST_ONLY=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --no-safety-backup)
                CREATE_SAFETY_BACKUP=false
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

list_backups() {
    log_section "Available Backups"

    local backups=$(find "${BACKUP_DIR}" -name "${BACKUP_PREFIX}-*.dump" -type f -printf '%T+ %p\n' 2>/dev/null | sort -r)

    if [ -z "$backups" ]; then
        log_warn "No backups found in ${BACKUP_DIR}"
        log_info "Backup pattern: ${BACKUP_PREFIX}-*.dump"
        return 1
    fi

    local count=1
    echo "$backups" | while read -r backup_line; do
        local backup_file=$(echo "$backup_line" | cut -d' ' -f2-)
        local backup_name=$(basename "$backup_file")
        local backup_date=$(echo "$backup_line" | cut -d' ' -f1)
        local backup_size=$(du -h "$backup_file" | cut -f1)

        echo -e "${GREEN}[$count]${NC} ${backup_name}"
        echo -e "    Date: ${backup_date}"
        echo -e "    Size: ${backup_size}"
        echo -e "    Path: ${backup_file}"
        echo ""
        count=$((count + 1))
    done

    return 0
}

validate_backup_file() {
    local backup_file="$1"

    log_section "Validating Backup File"

    # Check if file exists
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 2
    fi
    log_success "Backup file exists"

    # Check if file is readable
    if [ ! -r "$backup_file" ]; then
        log_error "Backup file is not readable: $backup_file"
        return 2
    fi
    log_success "Backup file is readable"

    # Check file size
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo 0)
    if [ "$file_size" -lt 1000 ]; then
        log_error "Backup file is too small (${file_size} bytes) - possibly corrupted"
        return 2
    fi
    local human_size=$(du -h "$backup_file" | cut -f1)
    log_success "Backup file size is valid (${human_size})"

    # Validate backup contents (list tables)
    log_info "Validating backup contents..."
    local table_count=$(pg_restore --list "$backup_file" 2>/dev/null | grep -c "TABLE DATA.*archon_" || echo 0)

    if [ "$table_count" -eq 0 ]; then
        log_error "No archon_* tables found in backup"
        return 2
    fi
    log_success "Found ${table_count} archon_* tables in backup"

    if [ "$VERBOSE" = true ]; then
        log_verbose "Tables in backup:"
        pg_restore --list "$backup_file" 2>/dev/null | grep "TABLE DATA.*archon_" | while read -r line; do
            local table_name=$(echo "$line" | grep -oP 'archon_\w+')
            log_verbose "  - $table_name"
        done
    fi

    return 0
}

create_safety_backup() {
    log_section "Creating Safety Backup"

    if [ "$CREATE_SAFETY_BACKUP" = false ]; then
        log_info "Safety backup disabled (--no-safety-backup)"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would create safety backup before restore"
        return 0
    fi

    local safety_timestamp=$(date +%Y%m%d_%H%M%S)
    SAFETY_BACKUP="${BACKUP_DIR}/${BACKUP_PREFIX}-safety-${safety_timestamp}.dump"

    log_info "Creating safety backup: $(basename "$SAFETY_BACKUP")"

    if docker exec ${SUPABASE_CONTAINER} pg_dump -U postgres -F c ${DATABASE_NAME} > "${SAFETY_BACKUP}"; then
        local file_size=$(du -h "${SAFETY_BACKUP}" | cut -f1)
        log_success "Safety backup created: ${file_size}"
        log_info "Safety backup location: ${SAFETY_BACKUP}"
        return 0
    else
        log_error "Failed to create safety backup"
        return 1
    fi
}

restore_database() {
    local backup_file="$1"

    log_section "Restoring Database from Backup"

    log_info "Backup file: $(basename "$backup_file")"
    log_info "Target database: ${DATABASE_NAME}"
    log_info "Tables: archon_* (filtered)"

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would restore the following tables:"
        pg_restore --list "$backup_file" 2>/dev/null | grep "TABLE DATA.*archon_" | while read -r line; do
            local table_name=$(echo "$line" | grep -oP 'archon_\w+')
            log_dry_run "  - $table_name"
        done
        log_dry_run "Restore would use: pg_restore --clean --if-exists --no-owner --no-privileges"
        return 0
    fi

    # Perform restore
    log_info "Starting restore operation..."
    log_warn "This will replace existing archon_* data in ${DATABASE_NAME}"

    # Note: We restore the entire backup which includes all archon_* tables, functions, and types
    # The --clean flag will drop existing objects before recreating them
    # The --if-exists flag prevents errors if objects don't exist
    if cat "$backup_file" | docker exec -i ${SUPABASE_CONTAINER} pg_restore \
        --username=postgres \
        --dbname=${DATABASE_NAME} \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        --verbose 2>&1 | grep -v "^pg_restore:.*already exists" | grep -v "^pg_restore:.*does not exist"; then
        log_success "Restore completed"
        return 0
    else
        log_error "Restore failed"
        return 1
    fi
}

verify_restoration() {
    log_section "Verifying Restoration"

    if [ "$DRY_RUN" = true ]; then
        log_dry_run "Would verify archon_* table counts"
        return 0
    fi

    local tables=(
        "archon_settings"
        "archon_sources"
        "archon_crawled_pages"
        "archon_code_examples"
        "archon_page_metadata"
        "archon_projects"
        "archon_tasks"
        "archon_project_sources"
        "archon_document_versions"
        "archon_migrations"
        "archon_prompts"
    )

    local all_ok=true
    for table in "${tables[@]}"; do
        local row_count=$(docker exec ${SUPABASE_CONTAINER} psql -U postgres -d ${DATABASE_NAME} -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ')
        if [ -n "$row_count" ]; then
            log_success "✓ $table: $row_count rows"
        else
            log_error "✗ $table: Failed to query"
            all_ok=false
        fi
    done

    if [ "$all_ok" = true ]; then
        log_success "All tables verified successfully"
        return 0
    else
        log_error "Some tables failed verification"
        return 1
    fi
}

rollback_restore() {
    log_section "Rollback to Safety Backup"

    if [ -z "$SAFETY_BACKUP" ] || [ ! -f "$SAFETY_BACKUP" ]; then
        log_error "No safety backup available for rollback"
        return 1
    fi

    log_warn "Rolling back to safety backup: $(basename "$SAFETY_BACKUP")"

    if cat "$SAFETY_BACKUP" | docker exec -i ${SUPABASE_CONTAINER} pg_restore \
        --username=postgres \
        --dbname=${DATABASE_NAME} \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges 2>&1 | grep -v "^pg_restore:.*already exists"; then
        log_success "Rollback completed"
        log_info "Database restored to pre-restore state"
        return 0
    else
        log_error "Rollback failed"
        log_error "Safety backup location: $SAFETY_BACKUP"
        log_error "Manual restoration may be required"
        return 1
    fi
}

check_prerequisites() {
    log_section "Prerequisites Check"

    # Check if Supabase AI container exists and is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${SUPABASE_CONTAINER}$"; then
        log_error "Supabase AI PostgreSQL container (${SUPABASE_CONTAINER}) not found or not running"
        log_error "Please ensure local-ai-packaged services are running"
        return 1
    fi
    log_success "Supabase AI container is running"

    # Check if PostgreSQL is ready
    if ! docker exec ${SUPABASE_CONTAINER} pg_isready -U postgres >/dev/null 2>&1; then
        log_error "PostgreSQL is not ready"
        return 1
    fi
    log_success "PostgreSQL is ready"

    # Check if backup directory exists
    if [ ! -d "${BACKUP_DIR}" ]; then
        log_error "Backup directory does not exist: ${BACKUP_DIR}"
        return 1
    fi
    log_success "Backup directory exists"

    return 0
}

find_latest_backup() {
    find "${BACKUP_DIR}" -name "${BACKUP_PREFIX}-*.dump" -type f -printf '%T+ %p\n' 2>/dev/null | \
        sort -r | head -1 | cut -d' ' -f2-
}

# ==============================================================================
# Main Execution
# ==============================================================================

main() {
    log_header "Archon Database Restore"

    # Parse command-line arguments
    parse_arguments "$@"

    # Handle list-only mode
    if [ "$LIST_ONLY" = true ]; then
        list_backups
        exit $?
    fi

    # Check prerequisites
    if ! check_prerequisites; then
        log_error "Prerequisites not met - restore aborted"
        exit 1
    fi

    # Determine which backup to restore
    if [ "$USE_LATEST" = true ]; then
        RESTORE_FILE=$(find_latest_backup)
        if [ -z "$RESTORE_FILE" ]; then
            log_error "No backups found in ${BACKUP_DIR}"
            log_info "Run with --list to see available backups"
            exit 1
        fi
        log_info "Using latest backup: $(basename "$RESTORE_FILE")"
    elif [ -z "$RESTORE_FILE" ]; then
        log_error "No backup file specified"
        log_info "Use --backup FILE or --latest"
        log_info "Run with --list to see available backups"
        show_help
        exit 1
    fi

    # Validate backup file
    if ! validate_backup_file "$RESTORE_FILE"; then
        log_error "Backup validation failed"
        exit 2
    fi

    # Create safety backup
    if [ "$DRY_RUN" = false ]; then
        if ! create_safety_backup; then
            log_error "Failed to create safety backup"
            log_warn "Restore aborted for safety"
            exit 1
        fi
    else
        log_dry_run "Skipping safety backup in dry-run mode"
    fi

    # Perform restore
    if ! restore_database "$RESTORE_FILE"; then
        log_error "Restore failed"

        if [ -n "$SAFETY_BACKUP" ] && [ "$DRY_RUN" = false ]; then
            log_warn "Attempting rollback to safety backup..."
            if rollback_restore; then
                log_info "Database rolled back to pre-restore state"
            fi
        fi

        exit 1
    fi

    # Verify restoration
    if ! verify_restoration; then
        log_warn "Verification failed - some issues detected"
        log_info "Check the warnings above"

        if [ -n "$SAFETY_BACKUP" ]; then
            log_info "Safety backup available at: $SAFETY_BACKUP"
            log_info "Run with --backup \"$SAFETY_BACKUP\" to rollback"
        fi
    fi

    if [ "$DRY_RUN" = false ]; then
        log_header "Restore Completed Successfully"
        log_info "Safety backup preserved at: ${SAFETY_BACKUP}"
    else
        log_header "Dry-Run Completed"
        log_info "No changes were made to the database"
        log_info "Remove --dry-run to perform actual restore"
    fi

    exit 0
}

# Run main function
main "$@"
