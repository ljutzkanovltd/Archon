#!/usr/bin/env bash
#
# start-archon.sh - Start Archon Standalone Infrastructure
#
# PURPOSE:
#   Starts Archon coding agent infrastructure as a standalone project alongside
#   sporterp-apps and local-ai-packaged, sharing AI infrastructure via bridge network.
#
# ARCHITECTURE:
#   - Archon runs independently with its own start/stop scripts
#   - Connects to shared AI infrastructure (LLMs, Supabase AI, Qdrant, Neo4j)
#   - Uses sporterp-ai-unified bridge network from local-ai-packaged
#   - Database: archon_db database in supabase-ai PostgreSQL instance (via PostgREST on port 18000)
#
# PREREQUISITES:
#   - local-ai-packaged must be running (provides bridge network and AI services)
#   - Docker and Docker Compose installed
#   - User must be in docker, video, and render groups
#
# USAGE:
#   ./start-archon.sh [OPTIONS]
#
# OPTIONS:
#   --mode MODE                 Deployment mode: hybrid-dev (default) or local-supabase
#   --conflict-mode MODE        Handle running containers: interactive (default), skip-if-running, force-restart
#   --skip-backup               Skip database backup before start
#   --skip-dependency-check     Skip AI dependency validation
#   --skip-health-checks        Skip post-startup health checks
#   --auto-vpn                  Automatically connect VPN if needed
#   --help                      Show this help message
#
# EXIT CODES:
#   0  - All services started successfully
#   1  - Critical error occurred
#
# ==============================================================================

set -euo pipefail

# ==============================================================================
# Section 1: Header & Configuration (Lines 1-50)
# ==============================================================================

# Script version and metadata
VERSION="1.0.0"
SCRIPT_NAME="start-archon.sh"

# Resolve script directory (handles symlinks)
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Display version header
cat << EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Archon Standalone Infrastructure - Startup Script
  Version: $VERSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

# ==============================================================================
# Section 2: Library Loading (Lines 51-70)
# ==============================================================================

# Load shared libraries
LIB_DIR="$SCRIPT_DIR/lib"

if [ ! -d "$LIB_DIR" ]; then
    echo "ERROR: Library directory not found: $LIB_DIR"
    echo "Please ensure lib/ directory exists with shared libraries"
    exit 1
fi

# shellcheck source=lib/logging.sh
source "$LIB_DIR/logging.sh"

# shellcheck source=lib/health-checks.sh
source "$LIB_DIR/health-checks.sh"

# shellcheck source=lib/network.sh
source "$LIB_DIR/network.sh"

# shellcheck source=lib/port-validation.sh
source "$LIB_DIR/port-validation.sh"

# shellcheck source=lib/config.sh
source "$LIB_DIR/config.sh"

# shellcheck source=lib/postgres-utils.sh
source "$LIB_DIR/postgres-utils.sh"

log_success "Shared libraries loaded"

# Load environment variables
# Note: Use PROJECT_ROOT instead of SCRIPT_DIR because library files may overwrite SCRIPT_DIR
ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
    log_info "Loading environment from .env (path: $ENV_FILE)"
    set -a
    # shellcheck source=.env
    source "$ENV_FILE"
    set +a
    log_info "Environment loaded: MODE=$MODE"
else
    log_warn ".env file not found at: $ENV_FILE"
    log_warn "Copy .env.example to .env and configure before production use"
    log_info "Using default configuration values"
fi

# ==============================================================================
# Section 3: Default Configuration (Lines 71-90)
# ==============================================================================

# Deployment mode (simplified: local or remote)
MODE="${MODE:-local}"

# LLM mode (for remote deployment)
LLM_MODE="${LLM_MODE:-}"

# Conflict resolution mode
CONFLICT_MODE="${CONFLICT_MODE:-interactive}"

# Backup configuration
BACKUP_ON_START="${BACKUP_ON_START:-true}"
SKIP_BACKUP=false

# Dependency check configuration
SKIP_DEPENDENCY_CHECK=false
REQUIRED_DISK_SPACE_GB=10

# Health check configuration
SKIP_HEALTH_CHECKS=false
HEALTH_CHECK_TIMEOUT=60

# VPN configuration (will be set based on MODE after argument parsing)
REQUIRE_VPN=false
AUTO_VPN="${AUTO_VPN:-false}"

# Optional services configuration
SKIP_OPTIONAL_SERVICES=false
SKIP_NEXTJS=false

# Core containers (always started)
CORE_CONTAINER_PATTERNS=(
    "archon-server"
    "archon-mcp"
    "archon-ui"
    "archon-ui-nextjs"
)

# Optional containers (can be skipped with --skip-optional)
OPTIONAL_CONTAINER_PATTERNS=(
    "archon-agents"
    "archon-agent-work-orders"
)

# Build final container list (populated after argument parsing)
ARCHON_CONTAINER_PATTERNS=()

# Network configuration
BRIDGE_NETWORK="sporterp-ai-unified"
SUPABASE_CONTAINER="supabase-ai-db"

# Service ports
ARCHON_SERVER_PORT="${ARCHON_SERVER_PORT:-8181}"
ARCHON_MCP_PORT="${ARCHON_MCP_PORT:-8051}"
ARCHON_UI_PORT="${ARCHON_UI_PORT:-3737}"
ARCHON_UI_NEXTJS_PORT="${ARCHON_UI_NEXTJS_PORT:-3738}"

log_info "Default configuration loaded"

# ==============================================================================
# Section 4: Argument Parsing (Lines 91-150)
# ==============================================================================

show_help() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS]

Start Archon coding agent infrastructure as a standalone project.

OPTIONS:
  --mode MODE                 Deployment mode: local or remote
  --llm-mode MODE             LLM mode (for remote): local or remote
  --conflict-mode MODE        Handle running containers: interactive (default), skip-if-running, force-restart
  --skip-backup               Skip database backup before start
  --skip-dependency-check     Skip AI dependency validation
  --skip-health-checks        Skip post-startup health checks
  --skip-optional             Skip optional services (archon-agents, archon-agent-work-orders)
  --skip-nextjs               Skip Next.js frontend (for local development on port 3738)
  -h, --help                  Show this help message

CONFLICT MODES:
  interactive        - Show menu to choose action (default)
  skip-if-running    - Exit gracefully if containers already running
  force-restart      - Automatically stop and restart containers

DEPLOYMENT MODES:
  local              - Local Supabase (requires local-ai-packaged running)
  remote             - Supabase Cloud (no local dependencies, interactive LLM choice)

LLM MODES (for remote deployment):
  local              - Use local LLMs (Ollama on host machine)
  remote             - Use remote LLMs (OpenAI/Anthropic API keys required)

EXAMPLES:
  $SCRIPT_NAME                                    # Interactive startup (local mode)
  $SCRIPT_NAME --mode remote                      # Remote Supabase (prompts for LLM choice)
  $SCRIPT_NAME --mode remote --llm-mode local     # Remote Supabase + local Ollama
  $SCRIPT_NAME --mode remote --llm-mode remote    # Remote Supabase + OpenAI/Anthropic
  $SCRIPT_NAME --conflict-mode force-restart      # Force restart if running
  $SCRIPT_NAME --skip-backup                      # Skip backup step

PREREQUISITES:
  For local mode:
    - local-ai-packaged must be running (bridge network + AI services)
  For remote mode:
    - Configure SUPABASE_URL, SUPABASE_SERVICE_KEY, DATABASE_URI in .env
    - If --llm-mode remote: Set OPENAI_API_KEY or ANTHROPIC_API_KEY
  All modes:
    - Docker and Docker Compose installed
    - User in docker, video, render groups

EOF
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode)
            MODE="$2"
            shift 2
            ;;
        --llm-mode)
            LLM_MODE="$2"
            shift 2
            ;;
        --conflict-mode)
            CONFLICT_MODE="$2"
            shift 2
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --skip-dependency-check)
            SKIP_DEPENDENCY_CHECK=true
            shift
            ;;
        --skip-health-checks)
            SKIP_HEALTH_CHECKS=true
            shift
            ;;
        --skip-optional)
            SKIP_OPTIONAL_SERVICES=true
            shift
            ;;
        --skip-nextjs)
            SKIP_NEXTJS=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Build container patterns based on flags
# Start with core containers
ARCHON_CONTAINER_PATTERNS=("${CORE_CONTAINER_PATTERNS[@]}")

# Remove archon-ui-nextjs if --skip-nextjs flag is set
if [ "$SKIP_NEXTJS" = true ]; then
    ARCHON_CONTAINER_PATTERNS=()
    for container in "${CORE_CONTAINER_PATTERNS[@]}"; do
        if [ "$container" != "archon-ui-nextjs" ]; then
            ARCHON_CONTAINER_PATTERNS+=("$container")
        fi
    done
    log_info "Skipping Next.js frontend (--skip-nextjs flag) - run locally with: cd archon-ui-nextjs && npm run dev"
fi

# Add optional containers unless --skip-optional flag is set
if [ "$SKIP_OPTIONAL_SERVICES" = true ]; then
    log_info "Skipping optional services (--skip-optional flag)"
else
    ARCHON_CONTAINER_PATTERNS+=("${OPTIONAL_CONTAINER_PATTERNS[@]}")
fi

# Validate deployment mode (simplified: local or remote)
if [[ ! "$MODE" =~ ^(local|remote)$ ]]; then
    log_error "Invalid mode: $MODE"
    log_error "Valid modes: local, remote"
    exit 1
fi

# Set remote mode flag
REMOTE_SUPABASE=false
if [ "$MODE" = "remote" ]; then
    REMOTE_SUPABASE=true
    log_info "Using remote Supabase (cloud-hosted)"
fi

# Validate LLM mode if specified
if [ -n "$LLM_MODE" ] && [[ ! "$LLM_MODE" =~ ^(local|remote)$ ]]; then
    log_error "Invalid LLM mode: $LLM_MODE"
    log_error "Valid LLM modes: local, remote"
    exit 1
fi

if [[ ! "$CONFLICT_MODE" =~ ^(interactive|skip-if-running|force-restart)$ ]]; then
    log_error "Invalid conflict mode: $CONFLICT_MODE"
    log_error "Valid modes: interactive, skip-if-running, force-restart"
    exit 1
fi

# VPN is not required for simplified modes (local uses local network, remote uses cloud)
REQUIRE_VPN=false

# Log final configuration
log_info "Configuration:"
log_info "  Mode: $MODE"
if [ "$REMOTE_SUPABASE" = true ] && [ -n "$LLM_MODE" ]; then
    log_info "  LLM Mode: $LLM_MODE"
fi
log_info "  Conflict Mode: $CONFLICT_MODE"
log_info "  Backup on Start: $([ "$SKIP_BACKUP" = true ] && echo "No" || [ "$REMOTE_SUPABASE" = true ] && echo "Skipped (cloud)" || echo "$BACKUP_ON_START")"

# ==============================================================================
# Section 5: VPN Handling (Lines 151-210)
# ==============================================================================

log_info "Step 1: VPN Validation"

if [ "$REQUIRE_VPN" = true ]; then
    log_info "VPN required for hybrid-dev mode"

    if ! check_vpn_connected; then
        log_warn "VPN is not connected"

        if [ "$AUTO_VPN" = true ]; then
            log_info "Auto-connecting VPN (--auto-vpn flag)..."

            # Attempt to connect VPN
            VPN_SCRIPT="$SCRIPT_DIR/../sporterp-apps/scripts/vpn-sso-auth.sh"
            if [ -f "$VPN_SCRIPT" ]; then
                if bash "$VPN_SCRIPT"; then
                    log_success "VPN connected successfully"
                else
                    log_error "VPN auto-connect failed"
                    exit 1
                fi
            else
                log_error "VPN script not found: $VPN_SCRIPT"
                log_error "Cannot auto-connect VPN"
                exit 1
            fi
        else
            # Interactive prompt
            # handle_vpn_prompt validates VPN thoroughly and may switch to local-supabase mode
            # Trust its success/failure - no need to re-check
            handle_vpn_prompt
        fi
    else
        log_success "VPN is connected"
        get_vpn_status
    fi
else
    log_info "VPN not required for $MODE mode - skipping"
fi

# ==============================================================================
# Section 5.5: LLM Mode Selection (for remote mode)
# ==============================================================================

# Prompt user for LLM mode if not specified via --llm-mode (only for remote mode)
prompt_llm_mode() {
    # Skip if LLM_MODE already set via flag or environment
    if [ -n "${LLM_MODE:-}" ]; then
        log_info "LLM mode: $LLM_MODE (from flag/env)"
        return 0
    fi

    echo ""
    log_info "Choose LLM configuration for remote mode:"
    echo "  1) Local LLMs (Ollama on host machine)"
    echo "  2) Remote LLMs (OpenAI/Anthropic API keys)"
    echo ""
    read -p "Selection [1-2]: " -r choice

    case $choice in
        1)
            LLM_MODE="local"
            log_info "Selected: Local LLMs (Ollama)"
            ;;
        2)
            LLM_MODE="remote"
            log_info "Selected: Remote LLMs (API keys)"
            ;;
        *)
            log_error "Invalid selection: $choice"
            log_error "Please enter 1 or 2"
            exit 1
            ;;
    esac
}

# Validate LLM configuration based on selected mode (INFORMATIONAL ONLY - never blocks startup)
validate_llm_config() {
    if [ "$LLM_MODE" = "local" ]; then
        log_info "Checking local LLM availability..."
        if curl -sf http://localhost:11434/v1/models >/dev/null 2>&1; then
            local model_count
            model_count=$(curl -s http://localhost:11434/v1/models 2>/dev/null | grep -o '"id"' | wc -l)
            log_success "Local LLM (Ollama) is available ($model_count models)"
        else
            log_warn "Local LLM not available on port 11434"
            log_info "Archon will work - configure LLM via Settings page"
        fi
    else
        log_info "Remote LLM mode selected"
        # Check .env for informational purposes only - NOT a requirement
        # API keys are managed via the Settings UI in Archon dashboard
        if [ -n "${OPENAI_API_KEY:-}" ] || [ -n "${ANTHROPIC_API_KEY:-}" ]; then
            log_success "API keys found in .env (will be used as fallback)"
        else
            log_info "No API keys in .env - configure via Settings page"
        fi
    fi

    # NEVER return error - LLM config is managed via Settings UI, not startup script
    return 0
}

# ==============================================================================
# Section 6: Dependency Validation (Lines 211-290)
# ==============================================================================

check_ai_dependencies() {
    # Check 1: Disk space
    log_info "Validating disk space..."
    local available_space_kb
    available_space_kb=$(df -k "$SCRIPT_DIR" | awk 'NR==2 {print $4}')
    local available_space_gb=$((available_space_kb / 1024 / 1024))
    local required_space_kb=$((REQUIRED_DISK_SPACE_GB * 1024 * 1024))

    if [ "$available_space_kb" -lt "$required_space_kb" ]; then
        log_warn "Low disk space: ${available_space_gb}GB available (${REQUIRED_DISK_SPACE_GB}GB recommended)"
        read -p "Continue anyway? [y/N]: " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Startup cancelled due to low disk space"
            return 1
        fi
    else
        log_success "Disk space validated (${available_space_gb}GB available)"
    fi

    # Check 2-3: Local infrastructure (skip for remote mode)
    if [ "$REMOTE_SUPABASE" = true ]; then
        log_info "Skipping local infrastructure checks (remote mode)"
        log_info "Using Supabase Cloud: $SUPABASE_URL"

        # Validate Supabase URL format
        if [[ ! "$SUPABASE_URL" =~ ^https://.*\.supabase\.co ]]; then
            log_warn "SUPABASE_URL doesn't look like Supabase Cloud"
            log_info "Expected format: https://xxxxx.supabase.co"
            log_info "Got: $SUPABASE_URL"
        fi

        # Test remote Supabase connectivity
        log_info "Testing remote Supabase connectivity..."
        if curl -sf --max-time 10 "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_SERVICE_KEY" >/dev/null 2>&1; then
            log_success "Remote Supabase is reachable"
        else
            log_warn "Could not verify remote Supabase connectivity (may still work)"
        fi

        # Prompt for LLM mode (interactive) and validate
        prompt_llm_mode
        if ! validate_llm_config; then
            return 1
        fi
    else
        # Local mode: Check bridge network
        log_info "Validating bridge network: $BRIDGE_NETWORK"
        if ! check_bridge_network "$BRIDGE_NETWORK"; then
            log_error "Bridge network '$BRIDGE_NETWORK' not found"
            log_error ""
            log_error "This network is created by local-ai-packaged and provides:"
            log_error "  - Shared Supabase AI PostgreSQL (port 54323)"
            log_error "  - LLM APIs (ports 11434-11437)"
            log_error "  - Vector DB (Qdrant on port 6333)"
            log_error "  - Knowledge Graph (Neo4j on port 7687)"
            log_error ""
            log_error "Resolution:"
            log_error "  cd ../local-ai-packaged"
            log_error "  ./start-ai.sh   # or python start_services.py --profile gpu-amd"
            log_error ""
            return 1
        fi
        log_success "Bridge network exists"

        # Local mode: Check Supabase AI container and PostgreSQL initialization
        log_info "Validating Supabase AI container..."
        if ! container_exists "$SUPABASE_CONTAINER"; then
            log_error "Supabase AI container not found: $SUPABASE_CONTAINER"
            log_error "Please start local-ai-packaged first"
            return 1
        fi

        if ! container_is_running "$SUPABASE_CONTAINER"; then
            log_error "Supabase AI container is not running"
            log_error "Please start local-ai-packaged first"
            return 1
        fi

        # Initialize PostgreSQL with robust 4-step validation
        if ! initialize_postgres_complete "$SUPABASE_CONTAINER" 5432; then
            log_error "PostgreSQL initialization failed"
            return 1
        fi
        log_success "PostgreSQL fully initialized and ready"
    fi

    # Note: Database initialization moved to separate function (initialize_archon_database)
    # This function only validates that prerequisites are available

    # Check 6: LLM API (optional)
    log_info "Checking LLM API availability (optional)..."
    if curl -sf http://localhost:11434/v1/models >/dev/null 2>&1; then
        local model_count
        model_count=$(curl -s http://localhost:11434/v1/models 2>/dev/null | grep -o '"id"' | wc -l)
        log_success "LLM API available (port 11434, $model_count models)"
    else
        log_warn "LLM API not available on port 11434 (optional)"
        log_warn "Archon will use fallback configuration if LLM needed"
    fi

    # Check 7: Qdrant vector DB (optional)
    log_info "Checking Qdrant vector database (optional)..."
    if curl -sf http://localhost:6333/health >/dev/null 2>&1; then
        log_success "Qdrant vector DB available (port 6333)"
    else
        log_warn "Qdrant not available on port 6333 (optional)"
        log_warn "Vector search features may not work"
    fi

    log_success "All critical dependencies validated"
    return 0
}

# Initialize Archon database (separate from dependency validation)
initialize_archon_database() {
    log_info "Initializing Archon database..."

    # Archon shares Supabase 'postgres' database with other services
    # All Archon tables are prefixed with 'archon_' for namespace isolation
    local target_db="postgres"

    # Check if archon_settings table exists (schema verification)
    log_info "Verifying Archon schema in '$target_db' database..."
    if docker exec "$SUPABASE_CONTAINER" psql -U postgres -d "$target_db" \
        -c "\dt public.archon_settings" 2>/dev/null | grep -q "archon_settings"; then
        log_success "Archon schema verified (archon_settings table exists)"
        return 0
    fi

    # Schema missing - need to run migrations
    log_warn "Archon schema not found in '$target_db' database"
    log_info "Running database initialization script..."

    # Check if migration script exists (use PROJECT_ROOT, not SCRIPT_DIR)
    local migration_script="$PROJECT_ROOT/migration/complete_setup.sql"
    if [ ! -f "$migration_script" ]; then
        log_error "Migration script not found: $migration_script"
        return 1
    fi

    # Run initialization script on postgres database
    if docker exec -i "$SUPABASE_CONTAINER" psql -U postgres "$target_db" < \
        "$migration_script" >/dev/null 2>&1; then
        log_success "Database schema initialized successfully"
    else
        log_error "Database initialization failed"
        log_error "Check migration/complete_setup.sql for errors"
        return 1
    fi

    # Verify schema was created
    log_info "Verifying schema creation..."
    if docker exec "$SUPABASE_CONTAINER" psql -U postgres -d "$target_db" \
        -c "\dt public.archon_settings" 2>/dev/null | grep -q "archon_settings"; then
        log_success "Schema verification passed"
    else
        log_error "Schema verification failed - archon_settings table not found"
        return 1
    fi

    # Wait for PostgREST to refresh schema cache
    log_info "Waiting for PostgREST to refresh schema cache (3 seconds)..."
    sleep 3

    log_success "Database initialization complete"
    return 0
}

# Execute dependency check
log_info "Step 2: Dependency Validation"
if [ "$SKIP_DEPENDENCY_CHECK" = false ]; then
    if ! check_ai_dependencies; then
        log_error "Dependency validation failed"
        log_error "Please resolve issues and retry"
        exit 1
    fi
else
    log_warn "Dependency checks skipped (--skip-dependency-check flag)"
fi

# ==============================================================================
# Section 6.5: Database Initialization (Lines 476-495)
# ==============================================================================

log_info "Step 2.5: Database Initialization"

if [ "$REMOTE_SUPABASE" = true ]; then
    log_info "Using remote Supabase - schema managed via Supabase Dashboard or migrations"
    log_info "Ensure Archon tables exist in your remote database"
elif [ "$SKIP_DEPENDENCY_CHECK" = false ]; then
    if ! initialize_archon_database; then
        log_error "Database initialization failed"
        log_error "Please check Supabase connection and retry"
        exit 1
    fi
else
    log_warn "Database initialization skipped (--skip-dependency-check flag)"
fi

# ==============================================================================
# Section 7: Backup on Start (Lines 496-525)
# ==============================================================================

log_info "Step 3: Backup Before Start"

if [ "$REMOTE_SUPABASE" = true ]; then
    log_info "Backup skipped for remote mode (managed by Supabase Cloud)"
elif [ "$SKIP_BACKUP" = true ]; then
    log_info "Backup skipped (--skip-backup flag)"
elif [ "$BACKUP_ON_START" != "true" ]; then
    log_info "Backup skipped (BACKUP_ON_START=false)"
else
    log_info "Creating backup before start..."

    if [ ! -f "$SCRIPT_DIR/scripts/backup-archon.sh" ]; then
        log_warn "Backup script not found: scripts/backup-archon.sh"
        log_warn "Continuing without backup"
    else
        if bash "$SCRIPT_DIR/scripts/backup-archon.sh"; then
            log_success "Backup completed successfully"
        else
            log_warn "Backup failed (exit code: $?)"
            log_warn "Continuing with startup anyway"
            log_warn "Use --skip-backup to suppress this warning"
        fi
    fi
fi

# ==============================================================================
# Section 8: Conflict Resolution (Lines 321-400)
# ==============================================================================

log_info "Step 4: Conflict Resolution"

# Find existing Archon containers
mapfile -t EXISTING_CONTAINERS < <(get_containers_by_pattern "archon")

if [ ${#EXISTING_CONTAINERS[@]} -eq 0 ]; then
    log_info "No existing Archon containers found"
    SKIP_DOCKER_COMPOSE=false
else
    log_warn "Found ${#EXISTING_CONTAINERS[@]} existing Archon container(s):"
    for container in "${EXISTING_CONTAINERS[@]}"; do
        status=$(docker inspect --format='{{.State.Status}}' "$container")
        echo "  - $container ($status)"
    done
    echo ""

    # Handle based on conflict mode
    case "$CONFLICT_MODE" in
        interactive)
            log_info "Conflict resolution: INTERACTIVE mode"
            echo "Choose an action:"
            echo "  1) Continue (leave existing containers running)"
            echo "  2) Restart (stop and restart all containers)"
            echo "  3) Cancel (exit without changes)"
            echo ""
            read -p "Selection [1-3]: " -r choice

            case $choice in
                1)
                    log_info "User chose: Continue with existing containers"
                    log_warn "Skipping docker compose up (containers already running)"
                    SKIP_DOCKER_COMPOSE=true
                    ;;
                2)
                    log_info "User chose: Restart containers"
                    log_info "Stopping existing containers..."
                    cd "$SCRIPT_DIR" && docker compose down
                    log_success "Containers stopped"
                    SKIP_DOCKER_COMPOSE=false
                    ;;
                3)
                    log_info "User chose: Cancel"
                    log_info "Startup cancelled by user"
                    exit 0
                    ;;
                *)
                    log_error "Invalid selection: $choice"
                    log_error "Please choose 1, 2, or 3"
                    exit 1
                    ;;
            esac
            ;;

        skip-if-running)
            log_info "Conflict resolution: SKIP-IF-RUNNING mode"
            log_info "Containers already running, skipping startup"
            log_success "Archon is already running"
            exit 0
            ;;

        force-restart)
            log_info "Conflict resolution: FORCE-RESTART mode"
            log_info "Forcing restart of existing containers..."
            cd "$SCRIPT_DIR" && docker compose down
            log_success "Containers stopped"
            SKIP_DOCKER_COMPOSE=false
            ;;

        *)
            log_error "Unknown CONFLICT_MODE: $CONFLICT_MODE"
            exit 1
            ;;
    esac
fi

# ==============================================================================
# Section 9: Service Startup (Lines 401-440)
# ==============================================================================

log_info "Step 5: Service Startup"

if [ "${SKIP_DOCKER_COMPOSE:-false}" = true ]; then
    log_info "Docker compose skipped (containers already running)"
else
    log_info "Starting Docker services..."

    # Build docker compose command based on mode
    cd "$SCRIPT_DIR"
    if [ "$REMOTE_SUPABASE" = true ]; then
        log_info "Running: docker compose -f docker-compose.yml -f docker-compose.remote-overlay.yml up -d"
        COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.remote-overlay.yml up -d"
    else
        log_info "Running: docker compose up -d"
        COMPOSE_CMD="docker compose up -d"
    fi

    # Start services in background
    if $COMPOSE_CMD; then
        log_success "Docker compose completed"
    else
        exit_code=$?
        log_error "Docker compose failed (exit code: $exit_code)"
        log_error ""
        if [ "$REMOTE_SUPABASE" = true ]; then
            log_error "Common causes (remote mode):"
            log_error "  - Port conflicts (check with: docker ps)"
            log_error "  - Invalid docker-compose.yml syntax"
            log_error "  - Network connectivity issues"
        else
            log_error "Common causes:"
            log_error "  - Bridge network not found (start local-ai-packaged first)"
            log_error "  - Port conflicts (check with: docker ps)"
            log_error "  - Invalid docker-compose.yml syntax"
        fi
        log_error ""
        log_error "Check docker compose logs:"
        log_error "  docker compose logs"
        exit 1
    fi

    # Give containers a moment to start
    sleep 2
fi

# Show running containers
log_info "Running Archon containers:"
docker ps --filter "name=archon" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || true
echo ""

# ==============================================================================
# Section 10: Post-Startup Validation (Lines 441-650)
# ==============================================================================

log_info "Step 6: Post-Startup Validation"

if [ "$SKIP_HEALTH_CHECKS" = true ]; then
    log_warn "Health checks skipped (--skip-health-checks flag)"
else
    log_info "Waiting for services to become healthy..."
    log_info "This may take up to $HEALTH_CHECK_TIMEOUT seconds per service"
    echo ""

    # Wait for each container
    for container in "${ARCHON_CONTAINER_PATTERNS[@]}"; do
        if container_exists "$container"; then
            log_info "Waiting for $container..."

            if wait_for_healthy "$container" "$HEALTH_CHECK_TIMEOUT"; then
                log_success "$container is healthy"
            else
                log_error "$container failed to become healthy within ${HEALTH_CHECK_TIMEOUT}s"
                log_error ""
                log_error "Container logs (last 50 lines):"
                container_logs_tail "$container" 50
                log_error ""
                log_error "Check full logs with: docker logs $container"
                exit 1
            fi
        else
            log_info "$container not found (may not be started)"
        fi
    done

    echo ""
    log_success "All containers are healthy"
    echo ""

    # Test health endpoints
    log_info "Testing service endpoints..."

    # Server health endpoint
    log_info "Testing archon-server health..."
    if service_is_responding "http://localhost:$ARCHON_SERVER_PORT/health" 10; then
        response=$(curl -s "http://localhost:$ARCHON_SERVER_PORT/health" 2>/dev/null || echo "unknown")
        log_success "Server health: $response"
    else
        log_error "Server health check failed"
        log_error "Endpoint: http://localhost:$ARCHON_SERVER_PORT/health"
        exit 1
    fi

    # MCP health endpoint (with retry logic)
    log_info "Testing archon-mcp health..."
    mcp_retries=3
    mcp_delay=2
    mcp_success=false

    for ((i=1; i<=mcp_retries; i++)); do
        if port_is_available_check "$ARCHON_MCP_PORT"; then
            log_success "MCP port $ARCHON_MCP_PORT is accessible"
            mcp_success=true
            break
        fi
        if [ $i -lt $mcp_retries ]; then
            sleep $mcp_delay
        fi
    done

    if [ "$mcp_success" = false ]; then
        log_warn "MCP port $ARCHON_MCP_PORT check inconclusive after $mcp_retries attempts"
        log_info "Container may still be initializing - Docker healthcheck will continue monitoring"
    fi

    # Frontend accessibility
    log_info "Testing archon-frontend..."
    if service_is_responding "http://localhost:$ARCHON_UI_PORT" 10; then
        log_success "Frontend accessible"
    else
        log_warn "Frontend not accessible (may still be loading)"
    fi

    echo ""

    # Database connectivity test (with retry logic)
    log_info "Testing database connectivity from archon-server..."
    db_retries=3
    db_delay=3
    db_success=false

    for ((i=1; i<=db_retries; i++)); do
        if docker exec archon-server sh -c 'psql "$DATABASE_URI" -c "SELECT 1;"' >/dev/null 2>&1; then
            log_success "Database connection successful"
            db_success=true
            break
        fi
        if [ $i -lt $db_retries ]; then
            log_info "Database not ready, waiting ${db_delay}s before retry $((i+1))/$db_retries..."
            sleep $db_delay
        fi
    done

    if [ "$db_success" = false ]; then
        log_warn "Database connection check inconclusive after $db_retries attempts"
        log_info "Container may still be initializing - check 'docker logs archon-server' for details"
        log_info "Service will continue attempting to connect in the background"
    fi

    # File system mount test
    log_info "Testing file system mount..."
    if docker exec archon-server ls /app/projects >/dev/null 2>&1; then
        project_count=$(docker exec archon-server ls /app/projects 2>/dev/null | wc -l)
        log_success "File system mounted ($project_count directories accessible)"
    else
        log_error "File system mount failed"
        log_error "Expected mount: /home/ljutzkanov/Documents/Projects -> /app/projects"
        exit 1
    fi

    # Read-only verification
    log_info "Verifying read-only file system..."
    if docker exec archon-server touch /app/projects/test.txt 2>/dev/null; then
        log_error "File system is NOT read-only (security risk!)"
        log_error "Update docker-compose.yml to use :ro flag"
        exit 1
    else
        log_success "File system is read-only (correct)"
    fi
fi

# Final success message
echo ""
echo "========================================"
log_success "Archon infrastructure started successfully!"
echo "========================================"
echo ""
log_info "Service URLs:"
log_info "  - Server:          http://localhost:$ARCHON_SERVER_PORT"
log_info "  - MCP:             http://localhost:$ARCHON_MCP_PORT"
log_info "  - Frontend (Vite): http://localhost:$ARCHON_UI_PORT"
if [ "$SKIP_NEXTJS" = true ]; then
    log_info "  - Frontend (Next): SKIPPED - run locally: cd archon-ui-nextjs && npm run dev"
else
    log_info "  - Frontend (Next): http://localhost:$ARCHON_UI_NEXTJS_PORT"
fi
echo ""
log_info "Useful commands:"
log_info "  - View logs:    docker compose logs -f"
log_info "  - Check status: docker ps | grep archon"
log_info "  - Stop all:     ./stop-archon.sh"
echo ""

exit 0
