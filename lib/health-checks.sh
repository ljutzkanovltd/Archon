#!/usr/bin/env bash
#
# health-checks.sh - Shared Health Check Library
#
# Provides comprehensive health checking functions for Docker containers.
# This library is sourced by startup scripts to perform health-aware
# service detection, restart logic, and status reporting.
#
# Features:
# - Container health status detection (healthy, unhealthy, starting, none)
# - Service state queries (running, stopped, missing)
# - Wait-for-healthy with exponential backoff
# - Batch health checking for multiple containers
# - Detailed status reporting
#

# Ensure colors are defined if not already
if [ -z "$RED" ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    NC='\033[0m'
fi

# Health check library logging (prefixed to avoid conflicts)
_hc_log_info() {
    echo -e "${BLUE}[HEALTH]${NC} $*"
}

_hc_log_success() {
    echo -e "${GREEN}[HEALTH]${NC} $*"
}

_hc_log_warn() {
    echo -e "${YELLOW}[HEALTH]${NC} $*"
}

_hc_log_error() {
    echo -e "${RED}[HEALTH]${NC} $*"
}

#------------------------------------------------------------------------------
# Core Health Check Functions
#------------------------------------------------------------------------------

# Check if container exists (running or stopped)
# Args: $1 = container name
# Returns: 0 if exists, 1 if not
container_exists() {
    local container_name="$1"
    docker ps -a --filter "name=^${container_name}\$" --format "{{.Names}}" 2>/dev/null | grep -q "^${container_name}\$"
}

# Check if container is running
# Args: $1 = container name
# Returns: 0 if running, 1 if not
container_is_running() {
    local container_name="$1"
    local state
    state=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || echo "missing")
    [ "$state" = "running" ]
}

# Get container health status
# Args: $1 = container name
# Returns: "healthy", "unhealthy", "starting", "none", "stopped", "missing"
get_container_health() {
    local container_name="$1"

    # Check if container exists
    if ! container_exists "$container_name"; then
        echo "missing"
        return
    fi

    # Check if container is running
    if ! container_is_running "$container_name"; then
        echo "stopped"
        return
    fi

    # Get health status
    local health_status
    health_status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_name" 2>/dev/null || echo "none")

    echo "$health_status"
}

# Get comprehensive container status
# Args: $1 = container name
# Returns: JSON-like status string
get_container_status() {
    local container_name="$1"

    if ! container_exists "$container_name"; then
        echo "status=missing"
        return
    fi

    local state health uptime
    state=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || echo "unknown")
    health=$(get_container_health "$container_name")

    if [ "$state" = "running" ]; then
        uptime=$(docker inspect --format='{{.State.StartedAt}}' "$container_name" 2>/dev/null || echo "unknown")
    else
        uptime="N/A"
    fi

    echo "status=$state health=$health uptime=$uptime"
}

# Check if container is healthy (running AND healthy or no healthcheck)
# Args: $1 = container name
# Returns: 0 if healthy, 1 if not
is_container_healthy() {
    local container_name="$1"
    local health
    health=$(get_container_health "$container_name")

    # Consider healthy if: explicitly healthy OR running with no healthcheck
    [ "$health" = "healthy" ] || [ "$health" = "none" ]
}

# Check if container is unhealthy (running but failing healthcheck)
# Args: $1 = container name
# Returns: 0 if unhealthy, 1 if not
is_container_unhealthy() {
    local container_name="$1"
    local health
    health=$(get_container_health "$container_name")

    [ "$health" = "unhealthy" ] || [ "$health" = "starting" ]
}

#------------------------------------------------------------------------------
# Pattern-Based Service Queries
#------------------------------------------------------------------------------

# Get all containers matching patterns (supports wildcards)
# Args: $@ = patterns (e.g., "supabase-" "n8n")
# Returns: Array of container names
get_containers_by_pattern() {
    local patterns=("$@")
    local containers=()

    for pattern in "${patterns[@]}"; do
        local matches
        matches=$(docker ps -a --filter "name=${pattern}" --format "{{.Names}}" 2>/dev/null || true)
        if [ -n "$matches" ]; then
            while IFS= read -r container; do
                # Only add non-empty container names
                if [ -n "$container" ]; then
                    containers+=("$container")
                fi
            done <<< "$matches"
        fi
    done

    # Remove duplicates and return (only if array has elements)
    if [ ${#containers[@]} -gt 0 ]; then
        printf '%s\n' "${containers[@]}" | sort -u
    fi
}

# Get running containers matching patterns
# Args: $@ = patterns
# Returns: Array of running container names
get_running_containers_by_pattern() {
    local patterns=("$@")
    local containers=()

    for pattern in "${patterns[@]}"; do
        local matches
        matches=$(docker ps --filter "name=${pattern}" --format "{{.Names}}" 2>/dev/null || true)
        if [ -n "$matches" ]; then
            while IFS= read -r container; do
                # Only add non-empty container names
                if [ -n "$container" ]; then
                    containers+=("$container")
                fi
            done <<< "$matches"
        fi
    done

    # Remove duplicates and return (only if array has elements)
    if [ ${#containers[@]} -gt 0 ]; then
        printf '%s\n' "${containers[@]}" | sort -u
    fi
}

# Get healthy containers matching patterns
# Args: $@ = patterns
# Returns: Array of healthy container names
get_healthy_containers_by_pattern() {
    local patterns=("$@")
    local healthy_containers=()

    local all_containers
    all_containers=$(get_running_containers_by_pattern "${patterns[@]}")

    while IFS= read -r container; do
        if [ -n "$container" ] && is_container_healthy "$container"; then
            healthy_containers+=("$container")
        fi
    done <<< "$all_containers"

    printf '%s\n' "${healthy_containers[@]}"
}

# Get unhealthy containers matching patterns
# Args: $@ = patterns
# Returns: Array of unhealthy container names
get_unhealthy_containers_by_pattern() {
    local patterns=("$@")
    local unhealthy_containers=()

    local all_containers
    all_containers=$(get_running_containers_by_pattern "${patterns[@]}")

    while IFS= read -r container; do
        if [ -n "$container" ] && is_container_unhealthy "$container"; then
            unhealthy_containers+=("$container")
        fi
    done <<< "$all_containers"

    printf '%s\n' "${unhealthy_containers[@]}"
}

#------------------------------------------------------------------------------
# Wait and Retry Functions
#------------------------------------------------------------------------------

# Wait for container to become healthy with exponential backoff
# Args: $1 = container name, $2 = timeout (seconds, default 120)
# Returns: 0 if healthy, 1 if timeout
wait_for_healthy() {
    local container_name="$1"
    local timeout="${2:-120}"
    local elapsed=0
    local wait_interval=2
    local max_interval=30

    _hc_log_info "Waiting for $container_name to be healthy (timeout: ${timeout}s)..."

    while [ $elapsed -lt $timeout ]; do
        local health
        health=$(get_container_health "$container_name")

        case "$health" in
            healthy|none)
                _hc_log_success "$container_name is healthy (${elapsed}s elapsed)"
                return 0
                ;;
            starting)
                echo -n "."
                ;;
            unhealthy)
                _hc_log_warn "$container_name is unhealthy (${elapsed}s elapsed)"
                echo -n "!"
                ;;
            stopped)
                _hc_log_error "$container_name is stopped"
                return 1
                ;;
            missing)
                _hc_log_error "$container_name does not exist"
                return 1
                ;;
        esac

        sleep $wait_interval
        elapsed=$((elapsed + wait_interval))

        # Exponential backoff
        wait_interval=$((wait_interval * 2))
        if [ $wait_interval -gt $max_interval ]; then
            wait_interval=$max_interval
        fi
    done

    echo ""
    _hc_log_error "Timeout waiting for $container_name to be healthy (${timeout}s)"
    return 1
}

# Wait for multiple containers to become healthy
# Args: $1 = timeout (seconds), $@ = container names
# Returns: 0 if all healthy, 1 if any failed
wait_for_all_healthy() {
    local timeout="$1"
    shift
    local containers=("$@")

    local failed=()

    for container in "${containers[@]}"; do
        if ! wait_for_healthy "$container" "$timeout"; then
            failed+=("$container")
        fi
    done

    if [ ${#failed[@]} -gt 0 ]; then
        _hc_log_error "Failed containers: ${failed[*]}"
        return 1
    fi

    return 0
}

# Wait for container to exist with retry
# Args: $1 = container name, $2 = timeout (seconds, default 60)
# Returns: 0 if exists, 1 if timeout
wait_for_container_exists() {
    local container_name="$1"
    local timeout="${2:-60}"
    local elapsed=0
    local wait_interval=2

    while [ $elapsed -lt $timeout ]; do
        if container_exists "$container_name"; then
            return 0
        fi

        sleep $wait_interval
        elapsed=$((elapsed + wait_interval))
    done

    _hc_log_error "Timeout waiting for $container_name to exist (${timeout}s)"
    return 1
}

#------------------------------------------------------------------------------
# Status Reporting Functions
#------------------------------------------------------------------------------

# Print detailed status for container
# Args: $1 = container name
print_container_status() {
    local container_name="$1"
    local health
    health=$(get_container_health "$container_name")

    local symbol color
    case "$health" in
        healthy)
            symbol="✓"
            color="$GREEN"
            ;;
        unhealthy)
            symbol="✗"
            color="$RED"
            ;;
        starting)
            symbol="⟳"
            color="$YELLOW"
            ;;
        none)
            symbol="○"
            color="$CYAN"
            ;;
        stopped)
            symbol="■"
            color="$YELLOW"
            ;;
        missing)
            symbol="?"
            color="$RED"
            ;;
        *)
            symbol="?"
            color="$NC"
            ;;
    esac

    echo -e "  ${color}${symbol}${NC} ${container_name} [${health}]"
}

# Print status for all containers matching patterns
# Args: $@ = patterns
print_services_status() {
    local patterns=("$@")
    local containers
    containers=$(get_containers_by_pattern "${patterns[@]}")

    if [ -z "$containers" ]; then
        echo -e "  ${YELLOW}No services found matching patterns${NC}"
        return
    fi

    echo "Service Status:"
    while IFS= read -r container; do
        if [ -n "$container" ]; then
            print_container_status "$container"
        fi
    done <<< "$containers"
}

# Get summary counts for containers matching patterns
# Args: $@ = patterns
# Returns: "healthy=X unhealthy=Y stopped=Z missing=W"
get_services_summary() {
    local patterns=("$@")
    local containers
    containers=$(get_containers_by_pattern "${patterns[@]}")

    local healthy=0 unhealthy=0 stopped=0 missing=0

    while IFS= read -r container; do
        if [ -z "$container" ]; then
            continue
        fi

        local health
        health=$(get_container_health "$container")

        case "$health" in
            healthy|none)
                healthy=$((healthy + 1))
                ;;
            unhealthy|starting)
                unhealthy=$((unhealthy + 1))
                ;;
            stopped)
                stopped=$((stopped + 1))
                ;;
            missing)
                missing=$((missing + 1))
                ;;
        esac
    done <<< "$containers"

    echo "healthy=$healthy unhealthy=$unhealthy stopped=$stopped missing=$missing"
}

#------------------------------------------------------------------------------
# Service Management Functions
#------------------------------------------------------------------------------

# Restart container
# Args: $1 = container name
# Returns: 0 if success, 1 if failure
restart_container() {
    local container_name="$1"

    if ! container_exists "$container_name"; then
        _hc_log_error "Cannot restart $container_name: container does not exist"
        return 1
    fi

    _hc_log_info "Restarting $container_name..."
    if docker restart "$container_name" >/dev/null 2>&1; then
        return 0
    else
        _hc_log_error "Failed to restart $container_name"
        return 1
    fi
}

# Restart all unhealthy containers matching patterns
# Args: $@ = patterns
# Returns: 0 if all restarted, 1 if any failed
restart_unhealthy_containers() {
    local patterns=("$@")
    local unhealthy
    unhealthy=$(get_unhealthy_containers_by_pattern "${patterns[@]}")

    if [ -z "$unhealthy" ]; then
        _hc_log_info "No unhealthy containers to restart"
        return 0
    fi

    local failed=()
    while IFS= read -r container; do
        if [ -n "$container" ]; then
            if ! restart_container "$container"; then
                failed+=("$container")
            fi
        fi
    done <<< "$unhealthy"

    if [ ${#failed[@]} -gt 0 ]; then
        _hc_log_error "Failed to restart: ${failed[*]}"
        return 1
    fi

    return 0
}

#------------------------------------------------------------------------------
# Database-Specific Checks
#------------------------------------------------------------------------------

# Check if PostgreSQL database is ready
# Args: $1 = container name (default: supabase-db)
# Returns: 0 if ready, 1 if not
check_postgres_ready() {
    local container_name="${1:-supabase-db}"

    if ! container_is_running "$container_name"; then
        return 1
    fi

    docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1
}

# Wait for PostgreSQL to be ready
# Args: $1 = container name, $2 = timeout (default 120)
# Returns: 0 if ready, 1 if timeout
wait_for_postgres_ready() {
    local container_name="${1:-supabase-db}"
    local timeout="${2:-120}"
    local elapsed=0
    local wait_interval=2

    _hc_log_info "Waiting for PostgreSQL in $container_name to be ready..."

    while [ $elapsed -lt $timeout ]; do
        if check_postgres_ready "$container_name"; then
            _hc_log_success "PostgreSQL is ready (${elapsed}s elapsed)"
            return 0
        fi

        sleep $wait_interval
        elapsed=$((elapsed + wait_interval))
    done

    _hc_log_error "Timeout waiting for PostgreSQL (${timeout}s)"
    return 1
}

#------------------------------------------------------------------------------
# Validation Functions
#------------------------------------------------------------------------------

# Validate that all containers in list exist and are healthy
# Args: $@ = container names
# Returns: 0 if all valid, 1 if any invalid
validate_containers_healthy() {
    local containers=("$@")
    local failed=()

    for container in "${containers[@]}"; do
        if ! is_container_healthy "$container"; then
            failed+=("$container")
        fi
    done

    if [ ${#failed[@]} -gt 0 ]; then
        _hc_log_error "Unhealthy containers: ${failed[*]}"
        return 1
    fi

    return 0
}

# Check if Docker network exists
# Args: $1 = network name
# Returns: 0 if exists, 1 if not
docker_network_exists() {
    local network_name="$1"
    docker network inspect "$network_name" >/dev/null 2>&1
}

# Validate Docker network exists
# Args: $1 = network name
# Returns: 0 if valid, 1 if not
validate_docker_network() {
    local network_name="$1"

    if docker_network_exists "$network_name"; then
        _hc_log_success "Docker network '$network_name' exists"
        return 0
    else
        _hc_log_error "Docker network '$network_name' does not exist"
        return 1
    fi
}

#------------------------------------------------------------------------------
# Container Log Functions
#------------------------------------------------------------------------------

# Get last N lines from container logs
# Args: $1 = container name, $2 = number of lines (default 50)
# Returns: 0 if successful, 1 if container doesn't exist
container_logs_tail() {
    local container_name="$1"
    local num_lines="${2:-50}"

    if [ -z "$container_name" ]; then
        _hc_log_error "container_logs_tail: Container name required"
        return 1
    fi

    if ! container_exists "$container_name"; then
        _hc_log_error "Container '$container_name' does not exist"
        return 1
    fi

    # Get logs from container (both stdout and stderr)
    docker logs --tail "$num_lines" "$container_name" 2>&1
    return 0
}

#------------------------------------------------------------------------------
# Export functions (optional - for explicit sourcing)
#------------------------------------------------------------------------------

# Mark library as loaded
HEALTH_CHECKS_LIB_LOADED=1
