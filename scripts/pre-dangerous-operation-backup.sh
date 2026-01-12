#!/bin/bash
################################################################################
# Pre-Dangerous-Operation Backup Script
#
# This script ensures a fresh backup exists before dangerous operations:
# - Checks if a recent unified backup exists (<1 hour old)
# - If not, triggers a new unified backup from local-ai-packaged
# - Verifies backup contains Archon database (postgres.sql.gz)
# - Returns backup path and metadata for recovery
#
# Usage: bash scripts/pre-dangerous-operation-backup.sh [--force]
#
# Exit codes:
#   0 - Success (backup available)
#   1 - Backup failed or verification failed
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
LOCAL_AI_ROOT="${HOME}/Documents/Projects/local-ai-packaged"
UNIFIED_BACKUP_SCRIPT="${LOCAL_AI_ROOT}/scripts/backup-unified.sh"
BACKUP_ROOT="${LOCAL_AI_ROOT}/backups"
BACKUP_MAX_AGE=3600  # 1 hour in seconds
FORCE_BACKUP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_BACKUP=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--force]"
            exit 2
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

################################################################################
# Phase 1: Check Configuration
################################################################################

log_info "Checking backup system configuration..."

# Check if local-ai-packaged exists
if [ ! -d "$LOCAL_AI_ROOT" ]; then
    log_error "local-ai-packaged not found at: $LOCAL_AI_ROOT"
    log_error "Please update LOCAL_AI_ROOT in this script"
    exit 2
fi

# Check if unified backup script exists
if [ ! -f "$UNIFIED_BACKUP_SCRIPT" ]; then
    log_error "Unified backup script not found at: $UNIFIED_BACKUP_SCRIPT"
    exit 2
fi

# Check if backup directory exists
if [ ! -d "$BACKUP_ROOT" ]; then
    log_error "Backup directory not found at: $BACKUP_ROOT"
    exit 2
fi

log_success "Configuration checks passed"

################################################################################
# Phase 2: Check for Recent Backup
################################################################################

log_info "Checking for recent backups..."

# Find most recent unified backup
LATEST_BACKUP=$(find "$BACKUP_ROOT" -maxdepth 1 -type d -name "unified-backup-*" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)

if [ -z "$LATEST_BACKUP" ]; then
    log_warning "No existing backups found"
    FORCE_BACKUP=true
else
    # Check backup age
    BACKUP_TIMESTAMP=$(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || echo 0)
    CURRENT_TIMESTAMP=$(date +%s)
    BACKUP_AGE=$((CURRENT_TIMESTAMP - BACKUP_TIMESTAMP))

    log_info "Latest backup: $(basename "$LATEST_BACKUP")"
    log_info "Backup age: $((BACKUP_AGE / 60)) minutes"

    if [ "$BACKUP_AGE" -gt "$BACKUP_MAX_AGE" ]; then
        log_warning "Latest backup is older than 1 hour"
        FORCE_BACKUP=true
    elif [ "$FORCE_BACKUP" = false ]; then
        # Check if backup contains Archon database
        if [ -f "${LATEST_BACKUP}/databases/postgres.sql.gz" ]; then
            POSTGRES_SIZE=$(stat -c %s "${LATEST_BACKUP}/databases/postgres.sql.gz")
            if [ "$POSTGRES_SIZE" -gt 1000000 ]; then  # At least 1MB
                log_success "Recent backup found and verified"
                log_info "Backup location: $LATEST_BACKUP"
                log_info "Archon database size: $(numfmt --to=iec $POSTGRES_SIZE)"

                # Output backup path for scripting
                echo ""
                echo "BACKUP_PATH=$LATEST_BACKUP"
                echo "POSTGRES_BACKUP=${LATEST_BACKUP}/databases/postgres.sql.gz"
                exit 0
            else
                log_warning "Postgres backup is too small (< 1MB), may be corrupted"
                FORCE_BACKUP=true
            fi
        else
            log_warning "Postgres backup not found in latest backup"
            FORCE_BACKUP=true
        fi
    fi
fi

################################################################################
# Phase 3: Trigger New Backup if Needed
################################################################################

if [ "$FORCE_BACKUP" = true ]; then
    log_info "Triggering new unified backup..."
    log_warning "This may take 2-5 minutes depending on data size"

    # Change to local-ai-packaged directory
    cd "$LOCAL_AI_ROOT"

    # Run unified backup with --dev flag for faster backup (only critical databases)
    # Note: May fail on Docker images phase but database backups should succeed
    if bash "$UNIFIED_BACKUP_SCRIPT" --dev 2>&1 | tee /tmp/unified-backup.log; then
        log_success "Unified backup completed successfully"
    else
        # Check if at least database backups succeeded (critical for our use case)
        if grep -q "Database backups completed" /tmp/unified-backup.log; then
            log_warning "Unified backup partially failed (Docker images phase)"
            log_warning "Database backups completed successfully - proceeding"
        else
            log_error "Unified backup failed - database backups did not complete"
            exit 1
        fi
    fi

    # Find the newly created backup
    LATEST_BACKUP=$(find "$BACKUP_ROOT" -maxdepth 1 -type d -name "unified-backup-*" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)

    if [ -z "$LATEST_BACKUP" ]; then
        log_error "New backup not found after creation"
        exit 1
    fi
fi

################################################################################
# Phase 4: Verify Backup
################################################################################

log_info "Verifying backup integrity..."

# Check if postgres backup exists
if [ ! -f "${LATEST_BACKUP}/databases/postgres.sql.gz" ]; then
    log_error "Postgres backup not found: ${LATEST_BACKUP}/databases/postgres.sql.gz"
    exit 1
fi

# Check postgres backup size
POSTGRES_SIZE=$(stat -c %s "${LATEST_BACKUP}/databases/postgres.sql.gz")
if [ "$POSTGRES_SIZE" -lt 1000000 ]; then  # At least 1MB
    log_error "Postgres backup is too small (< 1MB), may be corrupted"
    exit 1
fi

# Verify gzip integrity
if ! gzip -t "${LATEST_BACKUP}/databases/postgres.sql.gz" 2>/dev/null; then
    log_error "Postgres backup is corrupted (gzip integrity check failed)"
    exit 1
fi

log_success "Backup verification passed"

################################################################################
# Phase 5: Output Backup Information
################################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Backup Ready for Dangerous Operation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Backup Location:"
echo "  Directory: $LATEST_BACKUP"
echo "  Archon DB: ${LATEST_BACKUP}/databases/postgres.sql.gz"
echo "  Size: $(numfmt --to=iec $POSTGRES_SIZE)"
echo ""
echo "Recovery Command:"
echo "  gunzip -c ${LATEST_BACKUP}/databases/postgres.sql.gz | \\"
echo "    docker exec -i supabase-ai-db psql -U postgres -d postgres"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Output for scripting
echo "BACKUP_PATH=$LATEST_BACKUP"
echo "POSTGRES_BACKUP=${LATEST_BACKUP}/databases/postgres.sql.gz"
echo "BACKUP_SIZE=$POSTGRES_SIZE"

exit 0
