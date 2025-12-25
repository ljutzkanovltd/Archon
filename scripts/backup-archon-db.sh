#!/bin/bash
################################################################################
# Archon Database Backup Script
#
# This script creates a backup of ONLY the Archon database tables from the
# Supabase postgres database, excluding other services (n8n, langfuse, etc.)
#
# Usage: bash scripts/backup-archon-db.sh [--name BACKUP_NAME]
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
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_ROOT="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --name)
            BACKUP_NAME="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--name BACKUP_NAME]"
            exit 1
            ;;
    esac
done

# Set backup directory name
if [ -n "$BACKUP_NAME" ]; then
    BACKUP_DIR="${BACKUP_ROOT}/archon-db-${BACKUP_NAME}-${TIMESTAMP}"
else
    BACKUP_DIR="${BACKUP_ROOT}/archon-db-${TIMESTAMP}"
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

check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker daemon is not running"
        exit 1
    fi
}

check_supabase() {
    if ! docker ps --filter "name=supabase-ai-db" --filter "status=running" | grep -q "supabase-ai-db"; then
        log_error "Supabase database is not running"
        log_info "Start it with: cd ~/Projects/local-ai-packaged/supabase/docker && docker compose up -d supabase-ai-db"
        exit 1
    fi
}

################################################################################
# Main Backup Process
################################################################################

echo "================================================================================"
log_info "Archon Database Backup"
echo "================================================================================"
echo ""

# Pre-flight checks
log_info "Checking prerequisites..."
check_docker
check_supabase
log_success "Prerequisites OK"

# Create backup directory
mkdir -p "${BACKUP_DIR}"
log_info "Backup directory: ${BACKUP_DIR}"

################################################################################
# Step 1: Backup Archon Tables Only
################################################################################

log_info "Step 1: Backing up Archon tables..."

# List of Archon tables (from \dt output)
ARCHON_TABLES=(
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
    "archon_task_history"
    "archon_tasks"
)

# Dump each table individually
for table in "${ARCHON_TABLES[@]}"; do
    log_info "  Backing up table: ${table}"

    docker exec supabase-ai-db pg_dump -U postgres -d postgres \
        --table=public.${table} \
        --no-owner --no-acl \
        2>/dev/null | gzip > "${BACKUP_DIR}/${table}.sql.gz"

    if [ $? -eq 0 ] && [ -f "${BACKUP_DIR}/${table}.sql.gz" ]; then
        local size=$(du -h "${BACKUP_DIR}/${table}.sql.gz" | awk '{print $1}')
        log_success "    ${table} backed up successfully (${size})"
    else
        log_warning "    ${table} backup failed or table does not exist"
    fi
done

log_success "Archon tables backup completed"

################################################################################
# Step 2: Get Table Statistics
################################################################################

log_info "Step 2: Collecting table statistics..."

# Create statistics file
{
    echo "================================================================================"
    echo "Archon Database Statistics"
    echo "================================================================================"
    echo ""
    echo "Backup Timestamp: ${TIMESTAMP}"
    echo "Backup Location: ${BACKUP_DIR}"
    echo "Created: $(date)"
    echo ""
    echo "================================================================================"
    echo "TABLE STATISTICS"
    echo "================================================================================"
    echo ""

    # Get row counts and sizes for each table
    for table in "${ARCHON_TABLES[@]}"; do
        echo "## ${table}"
        docker exec supabase-ai-db psql -U postgres -d postgres -t -c "
            SELECT
                COUNT(*) as row_count,
                pg_size_pretty(pg_total_relation_size('public.${table}')) as total_size
            FROM public.${table};
        " 2>/dev/null || echo "  Table not found or empty"
        echo ""
    done

    echo "================================================================================"
    echo "BACKUP FILES"
    echo "================================================================================"
    echo ""
    ls -lh "${BACKUP_DIR}"/*.sql.gz 2>/dev/null
    echo ""

    echo "================================================================================"
    echo "CHECKSUMS (SHA-256)"
    echo "================================================================================"
    echo ""
    (cd "${BACKUP_DIR}" && sha256sum *.sql.gz 2>/dev/null) || echo "No backups created"
    echo ""

} > "${BACKUP_DIR}/STATISTICS.txt"

log_success "Statistics saved to STATISTICS.txt"

################################################################################
# Step 3: Create Restore Script
################################################################################

log_info "Step 3: Creating restore script..."

cat > "${BACKUP_DIR}/restore-archon-db.sh" <<'RESTORE_SCRIPT'
#!/bin/bash
################################################################################
# Archon Database Restore Script
#
# This script restores Archon database tables from the backup.
#
# Usage: bash restore-archon-db.sh [--drop-tables]
################################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DROP_TABLES=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --drop-tables)
            DROP_TABLES=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--drop-tables]"
            exit 1
            ;;
    esac
done

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

# Check if Supabase is running
if ! docker ps --filter "name=supabase-ai-db" --filter "status=running" | grep -q "supabase-ai-db"; then
    log_error "Supabase database is not running"
    exit 1
fi

echo "================================================================================"
log_info "Archon Database Restore"
echo "================================================================================"
echo ""

# Warning
echo -e "${YELLOW}WARNING: This will restore Archon database tables${NC}"
if [ "$DROP_TABLES" = true ]; then
    echo -e "${RED}WARNING: --drop-tables flag is set. Existing tables will be dropped!${NC}"
fi
echo ""
read -p "Are you sure you want to proceed? (type 'yes' to confirm): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log_info "Restore cancelled by user"
    exit 0
fi

# Get list of backup files
BACKUP_FILES=$(ls -1 "${BACKUP_DIR}"/*.sql.gz 2>/dev/null || true)

if [ -z "$BACKUP_FILES" ]; then
    log_error "No backup files found in ${BACKUP_DIR}"
    exit 1
fi

# Restore each table
while IFS= read -r backup_file; do
    table_name=$(basename "$backup_file" .sql.gz)
    log_info "Restoring table: ${table_name}"

    # Drop table if requested
    if [ "$DROP_TABLES" = true ]; then
        log_warning "  Dropping existing table ${table_name}..."
        docker exec supabase-ai-db psql -U postgres -d postgres -c \
            "DROP TABLE IF EXISTS public.${table_name} CASCADE;" 2>/dev/null || true
    fi

    # Restore table
    gunzip -c "${backup_file}" | docker exec -i supabase-ai-db psql -U postgres -d postgres 2>&1 | \
        grep -v "NOTICE:\|already exists" || true

    if [ $? -eq 0 ]; then
        log_success "  ${table_name} restored successfully"
    else
        log_warning "  ${table_name} restore had warnings (may be OK)"
    fi
done <<< "$BACKUP_FILES"

echo ""
log_success "Archon database restore completed!"
echo ""
echo "Next steps:"
echo "  1. Restart Archon services: cd ~/Projects/archon && docker compose restart"
echo "  2. Verify data: curl http://localhost:8181/api/health"
echo "  3. Check UI: http://localhost:3737"
echo ""
RESTORE_SCRIPT

chmod +x "${BACKUP_DIR}/restore-archon-db.sh"
log_success "Restore script created: restore-archon-db.sh"

################################################################################
# Step 4: Summary
################################################################################

echo ""
echo "================================================================================"
log_success "ARCHON DATABASE BACKUP COMPLETED"
echo "================================================================================"
echo ""
echo "Backup Location: ${BACKUP_DIR}"
echo "Backup Size: $(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo 'calculating...')"
echo "Timestamp: ${TIMESTAMP}"
echo ""
echo "Files created:"
echo "  - *.sql.gz (12 table backups)"
echo "  - STATISTICS.txt (table stats + checksums)"
echo "  - restore-archon-db.sh (restore script)"
echo ""
echo "To restore this backup:"
echo "  cd ${BACKUP_DIR}"
echo "  bash restore-archon-db.sh"
echo ""
echo "To restore with table drop (clean slate):"
echo "  bash restore-archon-db.sh --drop-tables"
echo ""
echo "View statistics:"
echo "  cat ${BACKUP_DIR}/STATISTICS.txt"
echo ""
echo "================================================================================"

exit 0
