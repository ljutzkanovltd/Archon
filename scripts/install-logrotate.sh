#!/usr/bin/env bash
#
# install-logrotate.sh - Install Archon logrotate configuration
#
# This script installs the logrotate configuration for Archon monitoring logs.
# Requires sudo privileges.
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
readonly CONFIG_FILE="${PROJECT_ROOT}/config/logrotate/archon-monitoring"
readonly INSTALL_PATH="/etc/logrotate.d/archon-monitoring"
readonly LOG_FILE="/var/log/archon-monitoring.log"

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
# Verify source file exists
#
verify_file() {
    print_msg "$BLUE" "\n→ Verifying configuration file..."

    if [[ ! -f "$CONFIG_FILE" ]]; then
        print_msg "$RED" "✗ Configuration file not found: $CONFIG_FILE"
        exit 1
    fi
    print_msg "$GREEN" "  ✓ Found logrotate configuration"
}

#
# Install logrotate configuration
#
install_config() {
    print_msg "$BLUE" "\n→ Installing logrotate configuration..."

    # Copy configuration file
    cp "$CONFIG_FILE" "$INSTALL_PATH"
    chmod 644 "$INSTALL_PATH"
    print_msg "$GREEN" "  ✓ Installed to $INSTALL_PATH"

    # Create log file if it doesn't exist
    if [[ ! -f "$LOG_FILE" ]]; then
        touch "$LOG_FILE"
        chown ljutzkanov:ljutzkanov "$LOG_FILE"
        chmod 640 "$LOG_FILE"
        print_msg "$GREEN" "  ✓ Created log file: $LOG_FILE"
    else
        print_msg "$GREEN" "  ✓ Log file already exists: $LOG_FILE"
    fi
}

#
# Test logrotate configuration
#
test_config() {
    print_msg "$BLUE" "\n→ Testing logrotate configuration..."

    # Test configuration syntax
    if logrotate -d "$INSTALL_PATH" >/dev/null 2>&1; then
        print_msg "$GREEN" "  ✓ Configuration syntax is valid"
    else
        print_msg "$YELLOW" "  ⚠ Configuration test showed warnings (may be normal)"
    fi

    # Force a rotation test (dry run)
    print_msg "$BLUE" "\n→ Running dry-run rotation test..."
    logrotate -d "$INSTALL_PATH" 2>&1 | head -20 || true
}

#
# Show status
#
show_status() {
    print_msg "$BLUE" "\n→ Logrotate Status:"

    # Show when logrotate will run
    if [[ -f /var/lib/logrotate/status ]]; then
        grep archon-monitoring /var/lib/logrotate/status || echo "  No rotation history yet"
    else
        echo "  No logrotate status file found"
    fi
}

#
# Show usage instructions
#
show_usage() {
    print_msg "$GREEN" "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_msg "$GREEN" "  Logrotate Configuration Installed Successfully!"
    print_msg "$GREEN" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    echo ""
    print_msg "$YELLOW" "Configuration Details:"
    echo "  Main log: /var/log/archon-monitoring.log (daily, 30 days)"
    echo "  Restore logs: ~/Projects/archon/logs/restore-test-*.log (weekly, 12 weeks)"
    echo "  Metrics: ~/Projects/archon/logs/metrics/db-size-*.csv (monthly, 24 months)"
    echo ""
    print_msg "$YELLOW" "Useful Commands:"
    echo "  # Test configuration"
    echo "  sudo logrotate -d /etc/logrotate.d/archon-monitoring"
    echo ""
    echo "  # Force rotation (for testing)"
    echo "  sudo logrotate -f /etc/logrotate.d/archon-monitoring"
    echo ""
    echo "  # View rotation status"
    echo "  sudo cat /var/lib/logrotate/status | grep archon"
    echo ""
    echo "  # View rotated logs"
    echo "  ls -lh /var/log/archon-monitoring.log*"
    echo ""
    print_msg "$BLUE" "Note: Logrotate runs automatically via cron (typically daily)"
    echo ""
}

#
# Main execution
#
main() {
    print_msg "$GREEN" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_msg "$GREEN" "  Archon Logrotate Configuration Installer"
    print_msg "$GREEN" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    check_sudo
    verify_file
    install_config
    test_config
    show_status
    show_usage

    print_msg "$GREEN" "\n✓ Installation complete!"
}

main "$@"
