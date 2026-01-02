#!/usr/bin/env bash
# postgres-utils.sh - PostgreSQL utilities for Archon scripts

# Initialize PostgreSQL with robust validation
# Args: container_name, port
initialize_postgres_complete() {
    local container="$1"
    local port="${2:-5432}"
    local max_attempts=30
    local attempt=0

    log_info "Waiting for PostgreSQL to be ready..."

    # Step 1: Wait for container to be running
    while [ $attempt -lt $max_attempts ]; do
        if container_is_running "$container"; then
            break
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    if [ $attempt -ge $max_attempts ]; then
        log_error "Container $container failed to start"
        return 1
    fi

    # Step 2: Wait for PostgreSQL to accept connections
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec "$container" pg_isready -U postgres -p "$port" >/dev/null 2>&1; then
            break
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    if [ $attempt -ge $max_attempts ]; then
        log_error "PostgreSQL not accepting connections"
        return 1
    fi

    # Step 3: Verify we can execute queries
    attempt=0
    while [ $attempt -lt 10 ]; do
        if docker exec "$container" psql -U postgres -c "SELECT 1;" >/dev/null 2>&1; then
            log_success "PostgreSQL ready and accepting queries"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    log_error "PostgreSQL not responding to queries"
    return 1
}

# Check if database exists
database_exists() {
    local container="$1"
    local dbname="$2"

    docker exec "$container" psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$dbname"
}

# Create database if not exists
ensure_database() {
    local container="$1"
    local dbname="$2"

    if ! database_exists "$container" "$dbname"; then
        log_info "Creating database: $dbname"
        docker exec "$container" psql -U postgres -c "CREATE DATABASE $dbname OWNER postgres;" >/dev/null 2>&1
    fi
}

# Check if extension exists in database
extension_exists() {
    local container="$1"
    local dbname="$2"
    local extension="$3"

    docker exec "$container" psql -U postgres -d "$dbname" \
        -c "SELECT 1 FROM pg_extension WHERE extname = '$extension';" 2>/dev/null | grep -q "1"
}

# Enable extension in database
ensure_extension() {
    local container="$1"
    local dbname="$2"
    local extension="$3"

    if ! extension_exists "$container" "$dbname" "$extension"; then
        log_info "Enabling extension: $extension in $dbname"
        docker exec "$container" psql -U postgres -d "$dbname" \
            -c "CREATE EXTENSION IF NOT EXISTS $extension;" >/dev/null 2>&1
    fi
}

# Execute SQL file in database
execute_sql_file() {
    local container="$1"
    local dbname="$2"
    local sql_file="$3"

    if [ ! -f "$sql_file" ]; then
        log_error "SQL file not found: $sql_file"
        return 1
    fi

    docker exec -i "$container" psql -U postgres -d "$dbname" < "$sql_file"
}

# Check table exists
table_exists() {
    local container="$1"
    local dbname="$2"
    local table="$3"

    docker exec "$container" psql -U postgres -d "$dbname" \
        -c "\dt public.$table" 2>/dev/null | grep -q "$table"
}
