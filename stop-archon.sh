#!/usr/bin/env bash
#
# stop-archon.sh - Stop Archon Standalone Infrastructure
#
# PURPOSE:
#   Gracefully stops all Archon services with optional backup and cleanup.
#
# USAGE:
#   ./stop-archon.sh [OPTIONS]
#
# OPTIONS:
#   --skip-backup       Skip database backup before stop
#   --force             Force stop with shorter timeout (10s instead of 30s)
#   --no-cleanup        Skip log and temp file cleanup
#   --help              Show this help message
#
# EXIT CODES:
#   0  - All services stopped successfully
#   1  - Critical error occurred
#
# ==============================================================================

set -euo pipefail

# Script version and metadata
VERSION="1.0.0"
SCRIPT_NAME="stop-archon.sh"

# Resolve script directory
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Display version header
cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Archon Standalone Infrastructure - Shutdown Script
  Version: $VERSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

# ==============================================================================
# Library Loading
# ==============================================================================

# Load shared libraries
LIB_DIR="$SCRIPT_DIR/lib"

if [ ! -d "$LIB_DIR" ]; then
    echo "ERROR: Library directory not found: $LIB_DIR"
    exit 1
fi

# shellcheck source=lib/logging.sh
source "$LIB_DIR/logging.sh"

log_success "Shared libraries loaded"

# Load environment variables
if [ -f "$SCRIPT_DIR/.env" ]; then
    log_info "Loading environment from .env"
    set -a
    # shellcheck source=.env
    source "$SCRIPT_DIR/.env"
    set +a
fi

# ==============================================================================
# Default Configuration
# ==============================================================================

# Backup configuration
BACKUP_ON_STOP="${BACKUP_ON_STOP:-true}"
SKIP_BACKUP=false

# Cleanup configuration
CLEANUP_LOGS="${CLEANUP_LOGS:-true}"
CLEANUP_LOGS_DAYS="${CLEANUP_LOGS_DAYS:-7}"
NO_CLEANUP=false

# Docker configuration
FORCE_STOP=false
STOP_TIMEOUT=30

log_info "Default configuration loaded"

# ==============================================================================
# Argument Parsing
# ==============================================================================

show_help() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS]

Gracefully stop all Archon services with optional backup and cleanup.

OPTIONS:
  --skip-backup       Skip database backup before stop
  --force             Force stop with shorter timeout (10s instead of 30s)
  --no-cleanup        Skip log and temp file cleanup
  -h, --help          Show this help message

EXAMPLES:
  $SCRIPT_NAME                    # Normal shutdown with backup
  $SCRIPT_NAME --skip-backup      # Skip backup step
  $SCRIPT_NAME --force            # Fast shutdown (10s timeout)
  $SCRIPT_NAME --no-cleanup       # Keep logs and temp files

CLEANUP:
  By default, stops Archon and cleans up:
  - Logs older than ${CLEANUP_LOGS_DAYS} days
  - Temporary files

EOF
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --force)
            FORCE_STOP=true
            STOP_TIMEOUT=10
            shift
            ;;
        --no-cleanup)
            NO_CLEANUP=true
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

log_info "Configuration:"
log_info "  Backup on Stop: $([ "$SKIP_BACKUP" = true ] && echo "No" || echo "$BACKUP_ON_STOP")"
log_info "  Force Stop: $FORCE_STOP (timeout: ${STOP_TIMEOUT}s)"
log_info "  Cleanup: $([ "$NO_CLEANUP" = true ] && echo "No" || echo "$CLEANUP_LOGS")"

# ==============================================================================
# Container Status Check
# ==============================================================================

log_info "Step 1: Checking Container Status"

# Check if any Archon containers are running
RUNNING_CONTAINERS=$(docker ps --filter "name=archon" --format "{{.Names}}" 2>/dev/null || echo "")

if [ -z "$RUNNING_CONTAINERS" ]; then
    log_warn "No Archon containers are running"
    log_info "Nothing to stop"
    exit 0
fi

log_info "Found running Archon containers:"
echo "$RUNNING_CONTAINERS" | while read -r container; do
    status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
    echo "  - $container ($status)"
done
echo ""

# ==============================================================================
# Backup Before Stop
# ==============================================================================

log_info "Step 2: Backup Before Stop"

if [ "$SKIP_BACKUP" = true ]; then
    log_info "Backup skipped (--skip-backup flag)"
elif [ "$BACKUP_ON_STOP" != "true" ]; then
    log_info "Backup skipped (BACKUP_ON_STOP=false)"
else
    log_info "Creating backup before stop..."

    if [ ! -f "$SCRIPT_DIR/scripts/backup-archon.sh" ]; then
        log_warn "Backup script not found: scripts/backup-archon.sh"
        log_warn "Continuing without backup"
    else
        if bash "$SCRIPT_DIR/scripts/backup-archon.sh"; then
            log_success "Backup completed successfully"
        else
            log_warn "Backup failed (exit code: $?)"
            log_warn "Continuing with shutdown anyway"
        fi
    fi
fi

# ==============================================================================
# Stop Docker Services
# ==============================================================================

log_info "Step 3: Stopping Docker Services"

cd "$SCRIPT_DIR"

if [ "$FORCE_STOP" = true ]; then
    log_info "Force stopping containers (${STOP_TIMEOUT}s timeout)..."
else
    log_info "Gracefully stopping containers (${STOP_TIMEOUT}s timeout)..."
fi

if docker compose down --timeout "$STOP_TIMEOUT"; then
    log_success "Docker services stopped"
else
    exit_code=$?
    log_error "Docker compose down failed (exit code: $exit_code)"
    log_error "Some containers may still be running"
    exit 1
fi

# ==============================================================================
# Cleanup
# ==============================================================================

log_info "Step 4: Cleanup"

if [ "$NO_CLEANUP" = true ]; then
    log_info "Cleanup skipped (--no-cleanup flag)"
else
    if [ "$CLEANUP_LOGS" = "true" ]; then
        log_info "Cleaning up old logs (>${CLEANUP_LOGS_DAYS} days)..."

        # Clean up logs directory
        if [ -d "$SCRIPT_DIR/logs" ]; then
            deleted_count=0
            deleted_count=$(find "$SCRIPT_DIR/logs" -name "*.log" -type f -mtime +"${CLEANUP_LOGS_DAYS}" -delete -print 2>/dev/null | wc -l)

            if [ "$deleted_count" -gt 0 ]; then
                log_success "Deleted $deleted_count old log file(s)"
            else
                log_info "No old log files to delete"
            fi
        else
            log_info "Logs directory not found - skipping log cleanup"
        fi
    fi

    # Clean up temporary files
    log_info "Cleaning up temporary files..."
    if [ -d "/tmp/archon" ]; then
        rm -rf /tmp/archon 2>/dev/null || true
        log_success "Temporary files cleaned up"
    else
        log_info "No temporary files to clean"
    fi
fi

# ==============================================================================
# Final Verification
# ==============================================================================

log_info "Step 5: Final Verification"

# Verify all containers stopped
REMAINING_CONTAINERS=$(docker ps --filter "name=archon" --format "{{.Names}}" 2>/dev/null || echo "")

if [ -z "$REMAINING_CONTAINERS" ]; then
    log_success "All Archon containers stopped"
else
    log_warn "Some containers still running:"
    echo "$REMAINING_CONTAINERS" | while read -r container; do
        echo "  - $container"
    done
    log_warn "You may need to manually stop these containers:"
    log_warn "  docker stop $REMAINING_CONTAINERS"
fi

# Final success message
echo ""
echo "========================================"
log_success "Archon infrastructure stopped successfully!"
echo "========================================"
echo ""
log_info "To restart Archon:"
log_info "  ./start-archon.sh"
echo ""

exit 0
