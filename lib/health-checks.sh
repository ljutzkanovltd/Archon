#!/usr/bin/env bash
# health-checks.sh - Health check utilities for Archon scripts

# Wait for a container to become healthy
# Args: container_name, timeout_seconds
wait_for_healthy() {
    local container="$1"
    local timeout="${2:-60}"
    local elapsed=0
    local interval=2

    while [ $elapsed -lt $timeout ]; do
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")

        case "$health" in
            healthy)
                return 0
                ;;
            unhealthy)
                return 1
                ;;
            none)
                # No healthcheck defined, check if running
                local status
                status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "missing")
                if [ "$status" = "running" ]; then
                    return 0
                fi
                ;;
        esac

        sleep $interval
        elapsed=$((elapsed + interval))
    done

    return 1
}

# Check if a service endpoint is responding
# Args: url, timeout_seconds
service_is_responding() {
    local url="$1"
    local timeout="${2:-10}"

    curl -sf --max-time "$timeout" "$url" >/dev/null 2>&1
}

# Get last N lines of container logs
# Args: container_name, lines
container_logs_tail() {
    local container="$1"
    local lines="${2:-50}"

    docker logs --tail "$lines" "$container" 2>&1
}

# Check if container exists
container_exists() {
    local container="$1"
    docker ps -a --format '{{.Names}}' | grep -q "^${container}$"
}

# Check if container is running
container_is_running() {
    local container="$1"
    local status
    status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "missing")
    [ "$status" = "running" ]
}

# Get containers matching a pattern
get_containers_by_pattern() {
    local pattern="$1"
    docker ps -a --format '{{.Names}}' | grep "$pattern" || true
}
