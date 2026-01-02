#!/usr/bin/env bash
# config.sh - Configuration utilities for Archon scripts

# Load environment file
load_env_file() {
    local env_file="$1"

    if [ -f "$env_file" ]; then
        set -a
        # shellcheck source=/dev/null
        source "$env_file"
        set +a
        return 0
    fi

    return 1
}

# Get config value with default
get_config() {
    local key="$1"
    local default="${2:-}"

    local value="${!key:-$default}"
    echo "$value"
}

# Validate required config keys
validate_config() {
    local required_keys=("$@")
    local missing=()

    for key in "${required_keys[@]}"; do
        if [ -z "${!key:-}" ]; then
            missing+=("$key")
        fi
    done

    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required config: ${missing[*]}"
        return 1
    fi

    return 0
}

# Export config to environment
export_config() {
    local key="$1"
    local value="$2"

    export "$key=$value"
}
