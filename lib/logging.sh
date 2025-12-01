#!/usr/bin/env bash
#
# logging.sh - Shared Logging Functions
#
# Provides unified logging functions for all scripts in the local-ai-packaged project.
# This library ensures consistent log formatting across startup, shutdown, and utility scripts.
#
# Usage:
#   source "$(dirname "$0")/lib/logging.sh"
#   log_info "Starting service..."
#   log_success "Service started successfully"
#   log_warn "Configuration missing, using defaults"
#   log_error "Failed to connect to database"
#   log_debug "Variable value: $VAR" # Only shown if DEBUG=true
#

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $*"
    fi
}

# Export functions for use in subshells
export -f log_info
export -f log_success
export -f log_warn
export -f log_error
export -f log_debug
