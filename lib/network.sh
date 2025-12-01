#!/usr/bin/env bash
#
# network.sh - Network Validation Utilities
#
# Provides network connectivity and DNS resolution checks for Docker containers.
# Used by startup scripts to validate inter-project communication.
#
# Usage:
#   source "$(dirname "$0")/lib/network.sh"
#   check_bridge_network "sporterp-ai-unified"
#   check_container_connectivity "supabase-erp-db" "supabase-ai-db"
#

# Source logging functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/logging.sh" ]; then
    source "$SCRIPT_DIR/logging.sh"
else
    echo "[ERROR] Required library not found: $SCRIPT_DIR/logging.sh"
    exit 1
fi

#------------------------------------------------------------------------------
# Network Validation Functions
#------------------------------------------------------------------------------

# Check if a Docker bridge network exists
# Args: $1 = network name
# Returns: 0 if exists, 1 if not
check_bridge_network() {
    local network_name="$1"

    if docker network ls | grep -q "$network_name"; then
        log_success "Bridge network '$network_name' exists"
        return 0
    else
        log_error "Bridge network '$network_name' not found"
        return 1
    fi
}

# Ensure a Docker bridge network exists (create if missing)
# Args: $1 = network name, $2 = subnet (optional, default: 172.19.0.0/16)
# Returns: 0 if exists or created, 1 on error
ensure_bridge_network() {
    local network_name="$1"
    local subnet="${2:-172.19.0.0/16}"

    # Check if network already exists
    if docker network inspect "$network_name" &>/dev/null; then
        log_success "Bridge network '$network_name' already exists"
        return 0
    fi

    # Network doesn't exist, create it
    log_info "Creating bridge network '$network_name' (subnet: $subnet)..."
    if docker network create "$network_name" --driver bridge --subnet "$subnet" &>/dev/null; then
        log_success "Bridge network '$network_name' created successfully"
        return 0
    else
        log_error "Failed to create bridge network '$network_name'"
        return 1
    fi
}

# Check connectivity between two containers
# Args: $1 = source container name, $2 = target container name
# Returns: 0 if connected, 1 if not
check_container_connectivity() {
    local source_container="$1"
    local target_container="$2"

    # Check if source container exists
    if ! docker ps --filter "name=^${source_container}\$" --format "{{.Names}}" | grep -q "^${source_container}\$"; then
        log_error "Source container '$source_container' not found"
        return 1
    fi

    # Check if target container exists
    if ! docker ps --filter "name=^${target_container}\$" --format "{{.Names}}" | grep -q "^${target_container}\$"; then
        log_error "Target container '$target_container' not found"
        return 1
    fi

    # Test connectivity using docker exec with nc or wget
    # Try wget first (more commonly available in containers)
    if docker exec "$source_container" which wget &>/dev/null; then
        if docker exec "$source_container" wget --spider --timeout=2 "http://$target_container" &>/dev/null; then
            log_success "Connectivity: $source_container → $target_container"
            return 0
        fi
    fi

    # Fallback: Test if DNS resolution works
    if docker exec "$source_container" getent hosts "$target_container" &>/dev/null; then
        log_success "DNS resolution: $source_container can resolve $target_container"
        return 0
    fi

    log_error "No connectivity: $source_container → $target_container"
    return 1
}

# Validate a container is on a specific network
# Args: $1 = container name, $2 = network name
# Returns: 0 if on network, 1 if not
check_container_on_network() {
    local container_name="$1"
    local network_name="$2"

    local networks
    networks=$(docker inspect "$container_name" --format '{{range $key, $value := .NetworkSettings.Networks}}{{$key}} {{end}}' 2>/dev/null)

    if echo "$networks" | grep -q "$network_name"; then
        log_success "Container '$container_name' is on network '$network_name'"
        return 0
    else
        log_warn "Container '$container_name' is NOT on network '$network_name'"
        return 1
    fi
}

#------------------------------------------------------------------------------
# VPN Validation Functions
#------------------------------------------------------------------------------

# Check if VPN is connected via tunnel interface
# Returns: 0 if connected, 1 if not
check_vpn_connected() {
    # Check if VPN tunnel interface exists and has IP
    if ip addr show 2>/dev/null | grep -q "tun[0-9]"; then
        local tun_interface
        tun_interface=$(ip addr show 2>/dev/null | grep -oP 'tun[0-9]+' | head -1 || echo "")
        if [ -n "$tun_interface" ]; then
            local tun_ip
            tun_ip=$(ip addr show "$tun_interface" 2>/dev/null | grep -oP 'inet \K[\d.]+' || echo "")
            [ -n "$tun_ip" ]
        else
            return 1
        fi
    else
        return 1
    fi
}

# Get detailed VPN status information
# Returns: 0 always (informational only)
get_vpn_status() {
    echo ""
    log_info "VPN Status:"

    # Check for tunnel interface
    if ip addr show 2>/dev/null | grep -q "tun[0-9]"; then
        local tun_interface
        tun_interface=$(ip addr show 2>/dev/null | grep -oP 'tun[0-9]+' | head -1 || echo "")
        local tun_ip
        tun_ip=$(ip addr show "$tun_interface" 2>/dev/null | grep -oP 'inet \K[\d.]+' || echo "unknown")

        log_success "  Interface: $tun_interface"
        log_success "  IP Address: $tun_ip"

        # Show OpenVPN3 session if available
        if command -v openvpn3 &>/dev/null; then
            log_info "  Active sessions:"
            openvpn3 sessions-list 2>/dev/null | grep -E "(Path|Status|Server)" || log_warn "    No active sessions found"
        fi
    else
        log_warn "  No VPN tunnel interface found"
    fi
    echo ""
}

# Handle VPN connection prompt for hybrid-dev mode
# Offers user 3 options: connect now, switch to local mode, or exit
# Modifies global MODE variable if user chooses option 2
handle_vpn_prompt() {
    echo ""
    log_warn "VPN is not connected (required for hybrid-dev mode)"
    echo ""
    echo "Options:"
    echo "  1) Connect VPN now (will run vpn-sso-auth.sh)"
    echo "  2) Switch to local-supabase mode (use local Supabase, no VPN needed)"
    echo "  3) Exit and connect manually"
    echo ""

    while true; do
        read -r -p "Enter choice [1-3]: " vpn_choice

        case "$vpn_choice" in
            1)
                log_info "Connecting VPN..."

                # VPN script is in sporterp-apps (shared across projects)
                local VPN_SCRIPT="$SCRIPT_DIR/../../sporterp-apps/scripts/vpn-sso-auth.sh"

                if [ -f "$VPN_SCRIPT" ]; then
                    # Run VPN authentication script
                    if bash "$VPN_SCRIPT"; then
                        log_success "VPN authentication completed successfully"
                        sleep 10  # Give VPN time to stabilize

                        # Verify tunnel exists
                        if ip addr show 2>/dev/null | grep -q "tun[0-9]"; then
                            log_success "VPN tunnel active"
                            return 0
                        else
                            log_warn "VPN authenticated but tunnel not yet visible"
                            log_info "Waiting additional 10 seconds..."
                            sleep 10

                            # Final check
                            if ip addr show 2>/dev/null | grep -q "tun[0-9]"; then
                                log_success "VPN tunnel now active"
                                return 0
                            else
                                log_error "VPN tunnel still not visible after authentication"
                                log_error "Please check VPN manually: openvpn3 sessions-list"
                                exit 1
                            fi
                        fi
                    else
                        log_error "VPN authentication failed"
                        log_error "Please connect manually and try again"
                        exit 1
                    fi
                else
                    log_error "VPN authentication script not found: $VPN_SCRIPT"
                    log_error "Please ensure sporterp-apps is available at: $(dirname "$(dirname "$SCRIPT_DIR")")/sporterp-apps"
                    exit 1
                fi
                break
                ;;
            2)
                log_info "Switching to local-supabase mode..."
                MODE="local-supabase"
                REQUIRE_VPN=false
                log_warn "Using local Supabase database instead of cloud"
                log_info "Mode changed to: $MODE"
                return 0
                ;;
            3)
                log_info "Exiting. Please connect VPN and try again."
                log_info "To connect VPN: bash ../sporterp-apps/scripts/vpn-sso-auth.sh"
                exit 0
                ;;
            *)
                log_error "Invalid choice: $vpn_choice"
                log_info "Please enter 1, 2, or 3"
                echo ""
                ;;
        esac
    done
}

#------------------------------------------------------------------------------
# HTTP Service Availability Functions
#------------------------------------------------------------------------------

# Check if HTTP service responds within timeout
# Args: $1 = URL, $2 = timeout in seconds (default 10)
# Returns: 0 if responding (HTTP 200-399), 1 if not
service_is_responding() {
    local url="$1"
    local timeout="${2:-10}"

    if [ -z "$url" ]; then
        log_error "service_is_responding: URL argument required"
        return 1
    fi

    # Use curl with timeout, check HTTP status code
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")

    # Success: 200-399 range (2xx success, 3xx redirects)
    if [[ "$http_code" =~ ^[23][0-9][0-9]$ ]]; then
        return 0
    else
        return 1
    fi
}

# Check if a port is accessible (listening)
# Args: $1 = port number, $2 = host (default localhost), $3 = timeout (default 2)
# Returns: 0 if port is open, 1 if not
port_is_available_check() {
    local port="$1"
    local host="${2:-localhost}"
    local timeout="${3:-2}"

    if [ -z "$port" ]; then
        log_error "port_is_available_check: Port argument required"
        return 1
    fi

    # Try to connect using timeout + bash built-in /dev/tcp
    if timeout "$timeout" bash -c "cat < /dev/tcp/$host/$port" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Export functions for use in subshells
export -f check_bridge_network
export -f ensure_bridge_network
export -f check_container_connectivity
export -f check_container_on_network
export -f check_vpn_connected
export -f get_vpn_status
export -f handle_vpn_prompt
export -f service_is_responding
export -f port_is_available_check
