#!/usr/bin/env bash
# Health Checks Script for Archon Infrastructure
#
# Standalone utility for manual health validation of Archon services
#
# Usage: ./scripts/health-checks.sh [OPTIONS]
#
# Options:
#   -v, --verbose    Show detailed output
#   -q, --quiet      Only show summary
#   -h, --help       Show this help message
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
ARCHON_DIR="$(dirname "$SCRIPT_DIR")"

# Load shared libraries
# shellcheck source=../lib/logging.sh
source "$ARCHON_DIR/lib/logging.sh"
# shellcheck source=../lib/health-checks.sh
source "$ARCHON_DIR/lib/health-checks.sh"

# Configuration
VERBOSE=false
QUIET=false

# Check results
CHECKS_PASSED=0
CHECKS_FAILED=0
FAILED_CHECKS=()

# Container names
ARCHON_CONTAINERS=(
    "archon-server"
    "archon-mcp"
    "archon-frontend"
)

OPTIONAL_CONTAINERS=(
    "archon-agents"
    "archon-agent-work-orders"
)

#######################################
# Display usage information
#######################################
show_usage() {
    cat << EOF
Health Checks Script for Archon Infrastructure

Usage: $(basename "$0") [OPTIONS]

Options:
    -v, --verbose    Show detailed output for each check
    -q, --quiet      Only show final summary
    -h, --help       Show this help message

Examples:
    $(basename "$0")              # Run all health checks
    $(basename "$0") -v           # Run with detailed output
    $(basename "$0") -q           # Show only summary

Exit codes:
    0 - All checks passed
    1 - One or more checks failed
EOF
}

#######################################
# Record a successful check
#######################################
record_success() {
    local check_name="$1"
    ((CHECKS_PASSED++))

    if [[ "$QUIET" != "true" ]]; then
        log_success "$check_name"
    fi
}

#######################################
# Record a failed check
#######################################
record_failure() {
    local check_name="$1"
    local reason="$2"
    ((CHECKS_FAILED++))
    FAILED_CHECKS+=("$check_name: $reason")

    if [[ "$QUIET" != "true" ]]; then
        log_error "$check_name - $reason"
    fi
}

#######################################
# Check container status
#######################################
check_container_status() {
    log_info "Checking Archon container status..."

    for container in "${ARCHON_CONTAINERS[@]}"; do
        if container_exists "$container"; then
            if container_is_running "$container"; then
                if is_container_healthy "$container"; then
                    record_success "Container $container is healthy"
                else
                    record_failure "Container $container" "running but not healthy"
                fi
            else
                record_failure "Container $container" "exists but not running"
            fi
        else
            record_failure "Container $container" "does not exist"
        fi
    done

    # Check optional containers (don't fail if missing)
    for container in "${OPTIONAL_CONTAINERS[@]}"; do
        if container_exists "$container"; then
            if container_is_running "$container"; then
                if is_container_healthy "$container"; then
                    record_success "Optional container $container is healthy"
                else
                    log_warn "Optional container $container is running but not healthy"
                fi
            else
                log_warn "Optional container $container exists but not running"
            fi
        else
            [[ "$VERBOSE" == "true" ]] && log_debug "Optional container $container not found (OK)"
        fi
    done
}

#######################################
# Check service endpoints
#######################################
check_service_endpoints() {
    log_info "Checking service endpoints..."

    # Check archon-server health endpoint
    if curl -sf http://localhost:8181/health >/dev/null 2>&1; then
        record_success "archon-server health endpoint (port 8181)"
    else
        record_failure "archon-server health endpoint" "not responding on port 8181"
    fi

    # Check archon-mcp health endpoint
    if curl -sf http://localhost:8051/health >/dev/null 2>&1; then
        record_success "archon-mcp health endpoint (port 8051)"
    else
        record_failure "archon-mcp health endpoint" "not responding on port 8051"
    fi

    # Check archon-frontend (just check if port responds)
    if curl -sf http://localhost:3737 >/dev/null 2>&1; then
        record_success "archon-frontend web interface (port 3737)"
    else
        record_failure "archon-frontend web interface" "not responding on port 3737"
    fi

    # Check optional agent work orders service
    if curl -sf http://localhost:8053/health >/dev/null 2>&1; then
        record_success "Optional: agent-work-orders health endpoint (port 8053)"
    else
        [[ "$VERBOSE" == "true" ]] && log_debug "Optional agent-work-orders service not responding (OK)"
    fi
}

#######################################
# Check database connectivity
#######################################
check_database_connectivity() {
    log_info "Checking database connectivity..."

    # Check if supabase-ai-db container is running
    if ! is_container_healthy "supabase-ai-db"; then
        record_failure "Supabase AI database" "container not healthy"
        return
    fi

    # Check if archon_db exists
    if docker exec supabase-ai-db psql -U postgres -lqt 2>/dev/null | \
       cut -d \| -f 1 | grep -qw "archon_db"; then
        record_success "Database archon_db exists"
    else
        record_failure "Database archon_db" "does not exist"
        return
    fi

    # Check database connectivity from archon-server
    if container_is_running "archon-server"; then
        if docker exec archon-server sh -c 'psql $DATABASE_URI -c "SELECT 1;" >/dev/null 2>&1'; then
            record_success "Database connectivity from archon-server"
        else
            record_failure "Database connectivity" "archon-server cannot connect"
        fi
    else
        [[ "$VERBOSE" == "true" ]] && log_debug "Skipping database connectivity test (archon-server not running)"
    fi
}

#######################################
# Check file system mounts
#######################################
check_file_system_mounts() {
    log_info "Checking file system mounts..."

    if ! container_is_running "archon-server"; then
        [[ "$VERBOSE" == "true" ]] && log_debug "Skipping file system checks (archon-server not running)"
        return
    fi

    # Check if projects directory is mounted
    if docker exec archon-server test -d /app/projects 2>/dev/null; then
        record_success "Projects directory mounted at /app/projects"
    else
        record_failure "Projects directory" "not mounted at /app/projects"
        return
    fi

    # Check if mount is read-only
    if docker exec archon-server touch /app/projects/test.txt 2>/dev/null; then
        record_failure "File system mount" "should be read-only but is writable"
        # Clean up test file
        docker exec archon-server rm -f /app/projects/test.txt 2>/dev/null || true
    else
        record_success "File system mount is read-only (as expected)"
    fi

    # Verify can read from mounted directory
    if docker exec archon-server ls /app/projects >/dev/null 2>&1; then
        record_success "Can read from /app/projects"
    else
        record_failure "File system access" "cannot read from /app/projects"
    fi
}

#######################################
# Check bridge network
#######################################
check_bridge_network() {
    log_info "Checking bridge network..."

    if docker network ls | grep -q "sporterp-ai-unified"; then
        record_success "Bridge network 'sporterp-ai-unified' exists"
    else
        record_failure "Bridge network" "sporterp-ai-unified not found"
    fi
}

#######################################
# Display summary report
#######################################
show_summary() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "                         HEALTH CHECK SUMMARY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [[ $CHECKS_FAILED -eq 0 ]]; then
        log_success "All checks passed! ($CHECKS_PASSED/$CHECKS_PASSED)"
        echo ""
        echo "✓ Archon infrastructure is healthy"
        echo ""
    else
        log_error "Some checks failed! ($CHECKS_PASSED passed, $CHECKS_FAILED failed)"
        echo ""
        echo "Failed checks:"
        for failed_check in "${FAILED_CHECKS[@]}"; do
            echo "  ✗ $failed_check"
        done
        echo ""
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

#######################################
# Parse command line arguments
#######################################
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
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
}

#######################################
# Main execution
#######################################
main() {
    parse_args "$@"

    if [[ "$QUIET" != "true" ]]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "              ARCHON INFRASTRUCTURE HEALTH CHECKS"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
    fi

    # Run all health checks
    check_bridge_network
    check_container_status
    check_service_endpoints
    check_database_connectivity
    check_file_system_mounts

    # Show summary
    show_summary

    # Exit with appropriate code
    if [[ $CHECKS_FAILED -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

main "$@"
