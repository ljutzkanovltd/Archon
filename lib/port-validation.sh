#!/usr/bin/env bash
# port-validation.sh - Port validation utilities for Archon scripts

# Check if a port is available (not in use)
port_is_available() {
    local port="$1"
    ! ss -tuln | grep -q ":${port} "
}

# Check if a port is accessible (service responding)
port_is_available_check() {
    local port="$1"
    local host="${2:-localhost}"

    # Try to connect to the port
    timeout 2 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null
}

# Get process using a port
get_port_process() {
    local port="$1"
    ss -tulnp | grep ":${port} " | awk '{print $NF}' | head -1
}

# Validate all required ports are available
validate_ports() {
    local ports=("$@")
    local blocked=()

    for port in "${ports[@]}"; do
        if ! port_is_available "$port"; then
            blocked+=("$port")
        fi
    done

    if [ ${#blocked[@]} -gt 0 ]; then
        log_error "Blocked ports: ${blocked[*]}"
        return 1
    fi

    return 0
}

# Wait for a port to become available
wait_for_port() {
    local port="$1"
    local timeout="${2:-30}"
    local elapsed=0

    while [ $elapsed -lt $timeout ]; do
        if port_is_available_check "$port"; then
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    return 1
}
