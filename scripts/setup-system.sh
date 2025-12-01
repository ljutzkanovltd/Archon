#!/usr/bin/env bash
#
# setup-system.sh - Archon System Configuration Script
#
# This script configures system-level settings required for Archon to run properly.
# It must be run with sudo privileges for system configuration changes.
#
# Usage:
#   sudo ./scripts/setup-system.sh              # Configure all settings
#   sudo ./scripts/setup-system.sh --check      # Check current configuration
#   sudo ./scripts/setup-system.sh --inotify    # Configure only inotify limits
#
# Configuration tasks:
#   - Set inotify file watch limits for development containers
#   - Verify Docker is installed and running
#   - Check available disk space
#
# Exit codes:
#   0 - Configuration successful
#   1 - Configuration failed
#   2 - Insufficient privileges (need sudo)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
ARCHON_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# Configuration constants
REQUIRED_INOTIFY_WATCHES=524288
MIN_DISK_SPACE_GB=10

#######################################
# Display usage information
#######################################
show_usage() {
    cat << EOF
Archon System Configuration Script

Usage: sudo $(basename "$0") [OPTIONS]

Options:
    --check      Check current system configuration without making changes
    --inotify    Configure only inotify file watch limits
    -h, --help   Show this help message

Configuration Tasks:
    1. inotify limits - Set fs.inotify.max_user_watches to ${REQUIRED_INOTIFY_WATCHES}
    2. Docker validation - Verify Docker installation and runtime
    3. Disk space check - Ensure at least ${MIN_DISK_SPACE_GB}GB available

Examples:
    sudo $(basename "$0")              # Configure all settings
    sudo $(basename "$0") --check      # Check current configuration
    sudo $(basename "$0") --inotify    # Configure only inotify

Note: This script requires sudo privileges for system configuration.

EOF
}

#######################################
# Check if running with sudo
#######################################
check_privileges() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run with sudo privileges"
        log_error "Usage: sudo $(basename "$0")"
        exit 2
    fi
}

#######################################
# Check current inotify configuration
#######################################
check_inotify() {
    local current_limit
    current_limit=$(sysctl -n fs.inotify.max_user_watches)

    log_info "Current inotify watches limit: $current_limit"

    if [ "$current_limit" -ge "$REQUIRED_INOTIFY_WATCHES" ]; then
        log_success "inotify limit is sufficient (${current_limit} >= ${REQUIRED_INOTIFY_WATCHES})"
        return 0
    else
        log_warn "inotify limit is too low (${current_limit} < ${REQUIRED_INOTIFY_WATCHES})"
        return 1
    fi
}

#######################################
# Configure inotify limits
#######################################
configure_inotify() {
    log_info "Configuring inotify file watch limits..."

    # Set runtime value
    if sysctl -w fs.inotify.max_user_watches=${REQUIRED_INOTIFY_WATCHES}; then
        log_success "Runtime inotify limit set to ${REQUIRED_INOTIFY_WATCHES}"
    else
        log_error "Failed to set runtime inotify limit"
        return 1
    fi

    # Make persistent across reboots
    local sysctl_conf="/etc/sysctl.conf"
    local config_line="fs.inotify.max_user_watches=${REQUIRED_INOTIFY_WATCHES}"

    if grep -q "^fs.inotify.max_user_watches" "$sysctl_conf"; then
        # Update existing line
        sed -i "s/^fs.inotify.max_user_watches.*/${config_line}/" "$sysctl_conf"
        log_success "Updated existing inotify configuration in $sysctl_conf"
    else
        # Add new line
        echo "" >> "$sysctl_conf"
        echo "# Archon - Increase inotify file watch limit for development containers" >> "$sysctl_conf"
        echo "$config_line" >> "$sysctl_conf"
        log_success "Added inotify configuration to $sysctl_conf"
    fi

    # Reload sysctl
    if sysctl -p > /dev/null 2>&1; then
        log_success "System configuration reloaded"
    else
        log_warn "Failed to reload sysctl, but changes were applied"
    fi

    return 0
}

#######################################
# Check Docker installation
#######################################
check_docker() {
    log_info "Checking Docker installation..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        log_error "Please install Docker: https://docs.docker.com/engine/install/"
        return 1
    fi

    log_success "Docker is installed: $(docker --version)"

    # Check if Docker daemon is running
    if ! docker info > /dev/null 2>&1; then
        log_warn "Docker daemon is not running"
        log_info "Start Docker with: sudo systemctl start docker"
        return 1
    fi

    log_success "Docker daemon is running"
    return 0
}

#######################################
# Check available disk space
#######################################
check_disk_space() {
    log_info "Checking available disk space..."

    local available_gb
    available_gb=$(df -BG "$ARCHON_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')

    if [ "$available_gb" -ge "$MIN_DISK_SPACE_GB" ]; then
        log_success "Sufficient disk space: ${available_gb}GB available"
        return 0
    else
        log_warn "Low disk space: ${available_gb}GB available (minimum: ${MIN_DISK_SPACE_GB}GB recommended)"
        return 1
    fi
}

#######################################
# Main configuration function
#######################################
main() {
    local check_only=false
    local inotify_only=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --check)
                check_only=true
                shift
                ;;
            --inotify)
                inotify_only=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}              ARCHON SYSTEM CONFIGURATION${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Check privileges (skip for check-only mode)
    if [ "$check_only" = false ]; then
        check_privileges
    fi

    local all_passed=true

    # inotify configuration
    echo -e "${BLUE}=== inotify Configuration ===${NC}"
    if check_inotify; then
        log_success "✓ inotify configuration"
    else
        if [ "$check_only" = true ]; then
            log_warn "✗ inotify configuration needs update"
            log_info "Run: sudo $(basename "$0") --inotify"
            all_passed=false
        else
            if configure_inotify; then
                log_success "✓ inotify configuration"
            else
                log_error "✗ inotify configuration failed"
                all_passed=false
            fi
        fi
    fi
    echo ""

    # If inotify-only mode, exit here
    if [ "$inotify_only" = true ]; then
        if [ "$all_passed" = true ]; then
            log_success "inotify configuration completed successfully"
            exit 0
        else
            log_error "inotify configuration failed"
            exit 1
        fi
    fi

    # Docker validation (no sudo required)
    echo -e "${BLUE}=== Docker Validation ===${NC}"
    if check_docker; then
        log_success "✓ Docker validation"
    else
        log_warn "✗ Docker validation"
        all_passed=false
    fi
    echo ""

    # Disk space check (no sudo required)
    echo -e "${BLUE}=== Disk Space Check ===${NC}"
    if check_disk_space; then
        log_success "✓ Disk space"
    else
        log_warn "✗ Disk space"
        all_passed=false
    fi
    echo ""

    # Summary
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    if [ "$all_passed" = true ]; then
        log_success "All system requirements met!"
        log_info "Archon is ready to start"
        exit 0
    else
        if [ "$check_only" = true ]; then
            log_warn "Some system requirements need attention"
            log_info "Run without --check to apply fixes: sudo $(basename "$0")"
        else
            log_error "Some system requirements could not be configured"
            log_info "Please check the errors above and resolve manually"
        fi
        exit 1
    fi
}

# Run main function
main "$@"
