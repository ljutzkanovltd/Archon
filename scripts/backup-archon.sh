#!/usr/bin/env bash
#
# backup-archon.sh - Backup Archon Database
#
# PURPOSE:
#   Backs up Archon tables (archon_*) from the shared Supabase AI PostgreSQL 'postgres' database
#
# USAGE:
#   ./backup-archon.sh [OPTIONS]
#
# OPTIONS:
#   --backup-dir DIR    Custom backup directory (default: ./backups)
#   --retention N       Keep last N backups (default: 10)
#   --verbose           Show detailed output
#   -h, --help          Show this help message
#
# BACKUP FORMAT:
#   PostgreSQL custom format (pg_dump -F c)
#   Filename: archon_postgres-YYYYMMDD_HHMMSS.dump
#
# RETENTION POLICY:
#   Default: Keep last 10 backups
#   Older backups automatically deleted
#
# EXIT CODES:
#   0  - Backup successful
#   1  - Backup failed
#
# ==============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
BACKUP_DIR="$PROJECT_ROOT/backups"
RETENTION=10
VERBOSE=false
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SUPABASE_CONTAINER="supabase-ai-db"
DATABASE_NAME="postgres"
BACKUP_PREFIX="archon_postgres"

# Logging functions
log_header() { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}$*${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
log_section() { echo ""; echo -e "${BLUE}▶ $*${NC}"; }
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[✓]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[✗]${NC} $*"; }
log_verbose() { [ "$VERBOSE" = true ] && echo -e "${BLUE}[DEBUG]${NC} $*" || true; }

# ==============================================================================
# Backup Functions
# ==============================================================================

show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Backup Archon tables (archon_*) from shared Supabase AI PostgreSQL 'postgres' database.

OPTIONS:
  --backup-dir DIR    Custom backup directory (default: ./backups)
  --retention N       Keep last N backups (default: 10)
  --verbose           Show detailed output
  -h, --help          Show this help message

EXAMPLES:
  $0                                    # Basic backup
  $0 --backup-dir /mnt/backups          # Custom directory
  $0 --retention 20                     # Keep 20 backups
  $0 --verbose                          # Detailed output

EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup-dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            --retention)
                RETENTION="$2"
                shift 2
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

    # Check if database exists
    if ! docker exec ${SUPABASE_CONTAINER} psql -U postgres -lqt | \
         cut -d \| -f 1 | grep -qw "${DATABASE_NAME}"; then
        log_warn "Database ${DATABASE_NAME} does not exist yet"
        log_warn "This is expected on first run - skipping backup"
        return 1
    fi
    log_success "Database ${DATABASE_NAME} exists"

    # Create backup directory if it doesn't exist
    mkdir -p "${BACKUP_DIR}"
    log_verbose "Backup directory: ${BACKUP_DIR}"

    return 0
}

backup_database() {
    log_section "Backing Up Database: ${DATABASE_NAME} (Archon tables)"

    local backup_file="${BACKUP_DIR}/${BACKUP_PREFIX}-${TIMESTAMP}.dump"

    log_info "Starting backup..."
    log_verbose "Backup file: ${backup_file}"
    log_verbose "Format: PostgreSQL custom format (pg_dump -F c)"

    # Perform backup
    if docker exec ${SUPABASE_CONTAINER} pg_dump -U postgres -F c ${DATABASE_NAME} > "${backup_file}"; then
        local file_size=$(du -h "${backup_file}" | cut -f1)
        log_success "Backup completed: ${backup_file} (${file_size})"
        return 0
    else
        log_error "Backup failed for ${DATABASE_NAME}"
        rm -f "${backup_file}" 2>/dev/null || true
        return 1
    fi
}

cleanup_old_backups() {
    log_section "Retention Policy Management"

    local backup_pattern="${BACKUP_PREFIX}-*.dump"
    local backup_count=$(find "${BACKUP_DIR}" -name "${backup_pattern}" -type f 2>/dev/null | wc -l)

    log_info "Current backups: ${backup_count}"
    log_info "Retention limit: ${RETENTION}"

    if [ ${backup_count} -gt ${RETENTION} ]; then
        local to_delete=$((backup_count - RETENTION))
        log_info "Deleting ${to_delete} old backup(s)..."

        # Delete oldest backups beyond retention limit
        find "${BACKUP_DIR}" -name "${backup_pattern}" -type f -printf '%T+ %p\n' | \
            sort | head -n ${to_delete} | cut -d' ' -f2- | while read -r old_backup; do
            log_verbose "Deleting: ${old_backup}"
            rm -f "${old_backup}"
        done

        log_success "Retention policy applied"
    else
        log_info "No cleanup needed (within retention limit)"
    fi
}

show_backup_summary() {
    log_section "Backup Summary"

    local latest_backup=$(find "${BACKUP_DIR}" -name "${BACKUP_PREFIX}-*.dump" -type f -printf '%T+ %p\n' | \
                          sort -r | head -1 | cut -d' ' -f2-)

    if [ -n "${latest_backup}" ]; then
        local file_size=$(du -h "${latest_backup}" | cut -f1)
        local file_name=$(basename "${latest_backup}")
        log_info "Latest backup: ${file_name} (${file_size})"
    fi

    local total_backups=$(find "${BACKUP_DIR}" -name "${BACKUP_PREFIX}-*.dump" -type f | wc -l)
    log_info "Total backups: ${total_backups}"
    log_info "Backup directory: ${BACKUP_DIR}"
}

# ==============================================================================
# Main Execution
# ==============================================================================

main() {
    log_header "Archon Database Backup"

    # Parse command-line arguments
    parse_arguments "$@"

    # Check prerequisites
    if ! check_prerequisites; then
        log_warn "Prerequisites not met - backup skipped"
        exit 0  # Exit gracefully (not an error for first run)
    fi

    # Perform backup
    if ! backup_database; then
        log_error "Backup failed"
        exit 1
    fi

    # Apply retention policy
    cleanup_old_backups

    # Show summary
    show_backup_summary

    log_header "Backup Completed Successfully"
    exit 0
}

# Run main function
main "$@"
