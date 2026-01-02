#!/usr/bin/env bash
# network.sh - Network utilities for Archon scripts

# Check if VPN is connected
check_vpn_connected() {
    # Check for common VPN interfaces
    if ip link show | grep -qE 'tun0|wg0|tailscale0|nordlynx'; then
        return 0
    fi

    # Check for VPN processes
    if pgrep -x "openvpn\|wireguard\|tailscaled" >/dev/null 2>&1; then
        return 0
    fi

    return 1
}

# Get VPN status details
get_vpn_status() {
    echo "VPN Status:"

    # Check for tunnel interfaces
    local tunnels
    tunnels=$(ip link show 2>/dev/null | grep -E 'tun|wg|tailscale|nordlynx' | awk -F': ' '{print $2}' | tr '\n' ' ')

    if [ -n "$tunnels" ]; then
        echo "  Active interfaces: $tunnels"
    else
        echo "  No VPN interfaces detected"
    fi
}

# Interactive VPN prompt
handle_vpn_prompt() {
    echo ""
    echo "VPN Connection Required"
    echo "======================="
    echo ""
    echo "Options:"
    echo "  1) Continue without VPN (switch to local-supabase mode)"
    echo "  2) Cancel and connect VPN manually"
    echo ""
    read -p "Selection [1-2]: " -r choice

    case $choice in
        1)
            log_info "Switching to local-supabase mode (no VPN)"
            MODE="local-supabase"
            REQUIRE_VPN=false
            return 0
            ;;
        2)
            log_info "Please connect VPN and restart the script"
            exit 0
            ;;
        *)
            log_error "Invalid selection"
            exit 1
            ;;
    esac
}

# Check if bridge network exists
check_bridge_network() {
    local network="$1"
    docker network ls --format '{{.Name}}' | grep -q "^${network}$"
}

# Create bridge network if it doesn't exist
ensure_bridge_network() {
    local network="$1"

    if ! check_bridge_network "$network"; then
        log_info "Creating bridge network: $network"
        docker network create "$network"
    fi
}
