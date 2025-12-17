#!/usr/bin/env bash
#
# install-systemd-units.sh - Install Archon systemd backup units
#
# This script installs the systemd service and timer units for automated
# Archon database backups. Requires sudo privileges.
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
readonly CONFIG_DIR="${PROJECT_ROOT}/config/systemd"
readonly SYSTEMD_DIR="/etc/systemd/system"

# Files to install
readonly SERVICE_FILE="archon-backup.service"
readonly TIMER_FILE="archon-backup.timer"

#
# Print colored message
#
print_msg() {
    local color="$1"
    local message="$2"
    echo -e "${color}${message}${NC}"
}

#
# Check if running as root/sudo
#
check_sudo() {
    if [[ $EUID -ne 0 ]]; then
        print_msg "$RED" "✗ This script must be run with sudo privileges"
        echo "  Run: sudo $0"
        exit 1
    fi
    print_msg "$GREEN" "✓ Running with sudo privileges"
}

#
# Verify source files exist
#
verify_files() {
    print_msg "$BLUE" "\n→ Verifying source files..."

    if [[ ! -f "${CONFIG_DIR}/${SERVICE_FILE}" ]]; then
        print_msg "$RED" "✗ Service file not found: ${CONFIG_DIR}/${SERVICE_FILE}"
        exit 1
    fi
    print_msg "$GREEN" "  ✓ Found ${SERVICE_FILE}"

    if [[ ! -f "${CONFIG_DIR}/${TIMER_FILE}" ]]; then
        print_msg "$RED" "✗ Timer file not found: ${CONFIG_DIR}/${TIMER_FILE}"
        exit 1
    fi
    print_msg "$GREEN" "  ✓ Found ${TIMER_FILE}"
}

#
# Install systemd units
#
install_units() {
    print_msg "$BLUE" "\n→ Installing systemd units..."

    # Copy service file
    cp "${CONFIG_DIR}/${SERVICE_FILE}" "${SYSTEMD_DIR}/${SERVICE_FILE}"
    chmod 644 "${SYSTEMD_DIR}/${SERVICE_FILE}"
    print_msg "$GREEN" "  ✓ Installed ${SERVICE_FILE}"

    # Copy timer file
    cp "${CONFIG_DIR}/${TIMER_FILE}" "${SYSTEMD_DIR}/${TIMER_FILE}"
    chmod 644 "${SYSTEMD_DIR}/${TIMER_FILE}"
    print_msg "$GREEN" "  ✓ Installed ${TIMER_FILE}"

    # Reload systemd daemon
    systemctl daemon-reload
    print_msg "$GREEN" "  ✓ Reloaded systemd daemon"
}

#
# Enable and start timer
#
enable_timer() {
    print_msg "$BLUE" "\n→ Enabling backup timer..."

    # Enable timer (will start on boot)
    systemctl enable archon-backup.timer
    print_msg "$GREEN" "  ✓ Enabled archon-backup.timer"

    # Start timer immediately
    systemctl start archon-backup.timer
    print_msg "$GREEN" "  ✓ Started archon-backup.timer"
}

#
# Display status and next run time
#
show_status() {
    print_msg "$BLUE" "\n→ Timer Status:"
    systemctl status archon-backup.timer --no-pager || true

    print_msg "$BLUE" "\n→ Next Scheduled Run:"
    systemctl list-timers archon-backup.timer --no-pager
}

#
# Show usage instructions
#
show_usage() {
    print_msg "$GREEN" "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_msg "$GREEN" "  Archon Backup Timer Installed Successfully!"
    print_msg "$GREEN" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    echo ""
    print_msg "$YELLOW" "Useful Commands:"
    echo "  # Check timer status"
    echo "  systemctl status archon-backup.timer"
    echo ""
    echo "  # Check service logs"
    echo "  journalctl -u archon-backup.service -f"
    echo ""
    echo "  # List all timers"
    echo "  systemctl list-timers"
    echo ""
    echo "  # Manually trigger backup"
    echo "  sudo systemctl start archon-backup.service"
    echo ""
    echo "  # Stop timer"
    echo "  sudo systemctl stop archon-backup.timer"
    echo ""
    echo "  # Disable timer"
    echo "  sudo systemctl disable archon-backup.timer"
    echo ""
    print_msg "$BLUE" "Schedule: Daily at 2:00 AM (with up to 30-minute random delay)"
    print_msg "$BLUE" "Retention: Last 10 backups (configurable in backup script)"
    echo ""
}

#
# Main execution
#
main() {
    print_msg "$GREEN" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_msg "$GREEN" "  Archon Systemd Backup Unit Installer"
    print_msg "$GREEN" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    check_sudo
    verify_files
    install_units
    enable_timer
    show_status
    show_usage

    print_msg "$GREEN" "\n✓ Installation complete!"
}

main "$@"
