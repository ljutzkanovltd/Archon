name: "Cross-Project Infrastructure Standardization - Archon Startup Fix & Bash Library Enhancement"
description: |
  Fix critical Archon startup bug (missing wait_for_port_occupied function) and standardize
  infrastructure patterns across Archon, SportERP, and Local AI projects through shared bash libraries.

---

## Goal

**Feature Goal**: Create missing bash port validation functions and standardize PostgreSQL initialization patterns across all projects to fix immediate Archon startup failure and prevent future inconsistencies.

**Deliverable**:
1. Working Archon startup script (no missing function errors)
2. Shared bash library infrastructure (`~/Documents/Projects/lib/`)
3. Standardized PostgreSQL initialization across Archon and SportERP
4. Comprehensive validation suite for startup scenarios

**Success Definition**:
- Archon starts successfully without `wait_for_port_occupied` error
- PostgreSQL initialization completes reliably in <60 seconds
- All validation gates pass (syntax, unit, integration, domain-specific)
- Cross-project patterns documented and tested

## User Persona

**Target User**: DevOps engineer / Platform developer maintaining multi-project infrastructure

**Use Case**: Starting Archon services for development, debugging startup issues, ensuring reliable service orchestration

**User Journey**:
1. Run `./start-archon.sh` to start Archon services
2. Script validates dependencies (Supabase, bridge network)
3. PostgreSQL initializes with retry logic and health checks
4. All Archon containers start and report healthy
5. Developer can immediately use Archon MCP server and dashboard

**Pain Points Addressed**:
- ❌ **Current**: Archon startup fails immediately with "command not found" error
- ✅ **Fixed**: Startup works reliably with clear progress indication
- ❌ **Current**: PostgreSQL race conditions cause intermittent failures
- ✅ **Fixed**: Robust 4-step initialization with retries
- ❌ **Current**: Duplicate bash libraries across projects
- ✅ **Fixed**: Shared workspace-level libraries with symlinks

## Why

- **Critical Bug**: Archon cannot start due to missing `wait_for_port_occupied()` function (line 390 in start-archon.sh)
- **Development Blocker**: Prevents all Archon-dependent work, MCP server unavailable
- **Inconsistent Patterns**: Port validation exists in Python but not bash, PostgreSQL init varies across projects
- **Maintenance Burden**: Duplicate bash libraries require updating in multiple places
- **Future-Proofing**: Standardized patterns prevent similar issues in other projects

**Business Value**:
- Unblocks Archon development (MCP server, knowledge base, task management)
- Reduces startup failures by 80% (estimated, based on PostgreSQL retry logic)
- Cuts library maintenance time by 50% (single source of truth)
- Enables reliable CI/CD pipelines (consistent startup behavior)

## What

### User-Visible Behavior
1. **Immediate Fix**: `./start-archon.sh` runs without errors
2. **Progress Visibility**: Clear step-by-step logging during PostgreSQL initialization
3. **Error Clarity**: Detailed messages when dependencies missing (e.g., "Supabase AI not running, start local-ai-packaged first")
4. **Retry Transparency**: Shows retry attempts for PostgreSQL readiness (e.g., "Attempt 3/5...")
5. **Time Tracking**: Logs duration for each initialization step

### Technical Requirements
1. **Port Validation Library** (`lib/port-validation.sh`):
   - `port_is_available(port, host)` - Check if port is free
   - `wait_for_port_release(port, timeout)` - Wait for port to be freed with exponential backoff
   - `wait_for_port_occupied(port, timeout)` - Wait for port to be bound (linear retry)
   - `verify_service_port(service, port, timeout)` - High-level service validation

2. **PostgreSQL Utilities Library** (`lib/postgres-utils.sh`):
   - `wait_for_postgres_ready(container, retries, delay)` - Retry pg_isready
   - `initialize_postgres_complete(container, port)` - Full 4-step initialization
   - `create_database_if_missing(container, db_name, user)` - Idempotent DB creation
   - `run_migrations(container, db_name, sql_file)` - Execute SQL with stabilization wait

3. **Shared Configuration** (`lib/config.sh`):
   - Timeout constants (aligned with Supabase start_period=45s)
   - Retry counts and delays
   - Infrastructure identifiers (network names, container names)

4. **Integration**:
   - Update `archon/start-archon.sh` to source new libraries
   - Replace manual PostgreSQL init (lines 338-395) with `initialize_postgres_complete()`
   - Fix line 390 to use `wait_for_port_occupied()` correctly

### Success Criteria

- [ ] **Archon Startup**: `./start-archon.sh` completes without errors
- [ ] **Cold Start Handling**: Clear error when Supabase not running
- [ ] **Warm Start Performance**: Archon starts in <20 seconds when Supabase already up
- [ ] **PostgreSQL Reliability**: 100% success rate for PostgreSQL initialization (tested 10+ times)
- [ ] **Port Validation**: All 4 functions work correctly (tested with real services)
- [ ] **Syntax Clean**: `shellcheck lib/*.sh` passes with no errors
- [ ] **Integration Tests**: All startup scenarios pass (cold, warm, restart recovery)
- [ ] **Documentation**: README.md and CLAUDE.md updated with new patterns

## All Needed Context

### Context Completeness Check

_This PRP includes everything needed to implement successfully:_
- ✅ Python reference implementation for port validation logic
- ✅ Existing bash patterns from lib/network.sh and lib/health-checks.sh
- ✅ Complete code snippets (not pseudo-code)
- ✅ Exact file paths and line numbers
- ✅ Validation commands that can be executed
- ✅ Error messages and remediation steps
- ✅ Testing procedures with expected outcomes

### Documentation & References

```yaml
# Python Reference Implementation (port validation)
- file: /home/ljutzkanov/Documents/Projects/local-ai-packaged/start_services.py
  lines: 244-266
  why: Reference for wait_for_port_occupied() logic to port to bash
  pattern: Linear retry with 1-second intervals, returns True/False
  gotcha: Python uses socket.connect_ex(), bash needs nc or /dev/tcp

- file: /home/ljutzkanov/Documents/Projects/local-ai-packaged/start_services.py
  lines: 213-242
  why: Reference for wait_for_port_release() with exponential backoff
  pattern: Starts at 1s interval, doubles (capped at 5s)
  gotcha: Exponential backoff prevents tight polling loops

# Bash Library Patterns
- file: /home/ljutzkanov/Documents/Projects/archon/lib/network.sh
  lines: 1-50
  why: Shows bash library structure (shebang, sourcing, function exports)
  pattern: Source logging.sh first, define functions, export with export -f
  gotcha: Must export functions for use in subshells

- file: /home/ljutzkanov/Documents/Projects/archon/lib/health-checks.sh
  lines: 229-277
  why: Shows exponential backoff pattern in wait_for_healthy()
  pattern: wait_interval starts at 2, doubles, caps at 30
  critical: Visual progress indicators (echo -n ".") for long operations

# Archon Startup Script
- file: /home/ljutzkanov/Documents/Projects/archon/start-archon.sh
  line: 390
  why: THE BUG - wait_for_port_occupied called but doesn't exist
  fix: Source lib/port-validation.sh and use the function

- file: /home/ljutzkanov/Documents/Projects/archon/start-archon.sh
  lines: 338-395
  why: Excellent PostgreSQL initialization pattern to extract into library
  pattern: 4-step sequence (health → stabilization → pg_isready → port)
  critical: 15-second stabilization aligned with Supabase start_period=45s

# Bash Documentation
- url: https://www.gnu.org/software/bash/manual/html_node/Redirections.html#Redirections
  section: /dev/tcp Special Files
  why: Bash built-in TCP connectivity for port checking (fallback when nc unavailable)
  critical: Syntax is "exec 3<> /dev/tcp/$host/$port" then close with "exec 3>&-"

- url: https://github.com/koalaman/shellcheck/wiki
  why: Understand shellcheck warnings and how to fix them
  critical: SC2086 (double quote), SC2155 (declare and assign separately)
```

### Current Codebase Tree

```bash
~/Documents/Projects/
├── archon/
│   ├── lib/
│   │   ├── logging.sh              # Exists (1177 bytes)
│   │   ├── health-checks.sh        # Exists (17521 bytes)
│   │   └── network.sh              # Exists (11824 bytes)
│   ├── start-archon.sh             # 796 lines, BUG on line 390
│   ├── stop-archon.sh
│   ├── docker-compose.yml
│   └── migration/
│       └── complete_setup.sql
│
├── sporterp-apps/
│   ├── lib/
│   │   ├── logging.sh              # Duplicate (same as archon)
│   │   ├── health-checks.sh        # Duplicate (slightly different)
│   │   ├── network.sh              # Duplicate (older version)
│   │   └── supabase-manager.sh
│   ├── start-sporterp.sh           # 643 lines
│   └── docker-compose.yml
│
├── local-ai-packaged/
│   ├── start_services.py           # Python (has port validation)
│   ├── docker-compose.yml
│   └── supabase/
│       └── docker/
│           └── docker-compose.yml  # Supabase services
│
└── (no shared lib directory yet)
```

### Desired Codebase Tree (after implementation)

```bash
~/Documents/Projects/
├── lib/                            # NEW - Workspace-level shared libraries
│   ├── logging.sh                  # Moved from projects (canonical version)
│   ├── health-checks.sh            # Moved from projects
│   ├── network.sh                  # Moved from projects
│   ├── port-validation.sh          # NEW - Port management functions
│   ├── postgres-utils.sh           # NEW - PostgreSQL initialization
│   ├── docker-context.sh           # NEW - Phase 2 (optional)
│   ├── config.sh                   # NEW - Shared constants
│   └── README.md                   # NEW - Library documentation
│
├── archon/
│   ├── lib/                        # All files become SYMLINKS to ~/Documents/Projects/lib/
│   │   ├── logging.sh -> ../../lib/logging.sh
│   │   ├── health-checks.sh -> ../../lib/health-checks.sh
│   │   ├── network.sh -> ../../lib/network.sh
│   │   ├── port-validation.sh -> ../../lib/port-validation.sh     # NEW
│   │   ├── postgres-utils.sh -> ../../lib/postgres-utils.sh       # NEW
│   │   └── config.sh -> ../../lib/config.sh                       # NEW
│   ├── lib.backup-YYYYMMDD/        # Backup of original files
│   └── start-archon.sh             # MODIFIED - sources new libs, uses functions
│
├── sporterp-apps/
│   ├── lib/                        # Symlinks to shared libs
│   │   ├── logging.sh -> ../../lib/logging.sh
│   │   ├── health-checks.sh -> ../../lib/health-checks.sh
│   │   ├── network.sh -> ../../lib/network.sh
│   │   ├── port-validation.sh -> ../../lib/port-validation.sh     # NEW
│   │   ├── postgres-utils.sh -> ../../lib/postgres-utils.sh       # NEW
│   │   └── supabase-manager.sh     # Keep (project-specific)
│   └── start-sporterp.sh           # MODIFIED (optional Phase 2)
│
└── scripts/                        # NEW - Workspace utilities
    ├── setup-shared-libraries.sh   # Automate symlink creation
    └── test-startup-scenarios.sh   # Integration testing
```

### Known Gotchas & Library Quirks

```bash
# CRITICAL: Bash port checking has two methods with different availability
# Method 1: netcat (nc) - standard but not always installed
nc -z localhost $port 2>/dev/null
# Exit code 0 = port in use, 1 = port free

# Method 2: bash built-in /dev/tcp - always available but requires exec
(timeout 1 bash -c "echo >/dev/tcp/localhost/$port" 2>/dev/null)
# Exit code 0 = port in use, non-zero = port free or timeout

# GOTCHA: Must use (subshell) for /dev/tcp to avoid polluting main shell
# GOTCHA: Timeout needed to prevent hanging on unresponsive ports

# CRITICAL: Bash functions must be exported to be available in subshells
export -f function_name

# GOTCHA: Sourcing libraries must happen BEFORE using functions
# Order matters: logging.sh → health-checks.sh → network.sh → port-validation.sh

# CRITICAL: Supabase healthcheck has start_period=45s
# Container reports healthy before PostgreSQL fully ready
# Solution: 15-second stabilization wait after container healthy

# GOTCHA: pg_isready can succeed but port not yet bound
# Solution: 4-step validation (health → wait → pg_isready → port binding)

# CRITICAL: Symlinks are relative paths for portability
ln -s ../../lib/file.sh project/lib/file.sh
# NOT: ln -s /home/user/Projects/lib/file.sh (absolute, breaks on different systems)

# GOTCHA: shellcheck may warn about SC2086 (unquoted variables)
# Solution: Double-quote all variable references: "$var" not $var
```

## Implementation Blueprint

### Core Architecture

```
Port Validation Flow:
┌─────────────────────────────────────────────────────────────┐
│ port_is_available(port, host)                              │
│ ├─ Try: nc -z $host $port                                  │
│ │  └─ Success → port occupied (return 1)                   │
│ │     Fail → port free (return 0)                          │
│ └─ Fallback: timeout 1 bash -c "echo >/dev/tcp/$host/$port"│
│    └─ Success → port occupied (return 1)                   │
│       Fail → port free (return 0)                          │
└─────────────────────────────────────────────────────────────┘
        ▲                           ▲
        │                           │
        │                           │
┌───────┴──────────┐       ┌────────┴──────────┐
│ wait_for_port_   │       │ wait_for_port_    │
│ release(port)    │       │ occupied(port)    │
│                  │       │                   │
│ Exponential      │       │ Linear retry      │
│ backoff:         │       │ 1s intervals      │
│ 1→2→4→5(cap)    │       │ 0→1→2→3...       │
└──────────────────┘       └───────────────────┘
```

```
PostgreSQL Initialization Sequence:
┌─────────────────────────────────────────────────────────────┐
│ initialize_postgres_complete(container, port)              │
│                                                             │
│ Step 1: Container Health (0-120s)                          │
│ ├─ is_container_healthy(container)?                        │
│ │  ├─ Yes → Continue                                       │
│ │  └─ No → wait_for_healthy(container, 120s)              │
│ │     └─ Exponential backoff: 2→4→8→16→30(cap)           │
│ │                                                           │
│ Step 2: Stabilization Wait (15s)                           │
│ ├─ sleep 15                                                │
│ └─ Why: Supabase start_period=45s, need buffer            │
│                                                             │
│ Step 3: PostgreSQL Readiness (0-15s)                       │
│ ├─ for i in 1..5:                                          │
│ │  ├─ docker exec $container pg_isready -U postgres       │
│ │  ├─ Success? → Break                                     │
│ │  └─ Fail? → sleep 3, continue                           │
│ └─ Total retries: 5 attempts × 3s = 15s max               │
│                                                             │
│ Step 4: Port Binding Verification (0-60s)                  │
│ └─ wait_for_port_occupied(port, 60s)                      │
│    └─ Linear retry every 1s until port bound              │
│                                                             │
│ Total Time: Best 15s, Worst 210s (3.5 minutes)            │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Tasks (ordered by dependencies)

```yaml
Task 1: CREATE ~/Documents/Projects/lib/port-validation.sh
  Description: Create bash port validation library with 4 core functions
  Dependencies: None (foundational)
  Estimated Time: 1.5 hours

  Implementation:
    - Port check_port_available() from Python (socket check → nc/bash)
    - Port wait_for_port_release() with exponential backoff
    - Port wait_for_port_occupied() with linear retry
    - Add verify_service_port() as high-level wrapper
    - Source logging.sh for consistent output
    - Export all functions with export -f

  FOLLOW pattern: /home/ljutzkanov/Documents/Projects/archon/lib/network.sh (lines 1-50)
    - Shebang: #!/usr/bin/env bash
    - Header comment block
    - Source logging.sh
    - Function definitions
    - Export functions at end

  NAMING: snake_case for all functions and variables

  PLACEMENT: ~/Documents/Projects/lib/port-validation.sh (workspace root)

  VALIDATION:
    - shellcheck lib/port-validation.sh (must pass)
    - bash -n lib/port-validation.sh (syntax check)
    - Manual test: Start nginx, verify wait_for_port_occupied works

---

Task 2: CREATE ~/Documents/Projects/lib/postgres-utils.sh
  Description: Extract Archon's PostgreSQL initialization into reusable library
  Dependencies: Task 1 (uses wait_for_port_occupied), lib/health-checks.sh (uses wait_for_healthy)
  Estimated Time: 1.5 hours

  Implementation:
    - Extract wait_for_postgres_ready() from start-archon.sh (lines 366-386)
    - Create initialize_postgres_complete() encapsulating 4-step sequence (lines 338-395)
    - Add create_database_if_missing() for idempotent DB creation (lines 437-456)
    - Add run_migrations() for SQL execution (lines 458-468)
    - Source logging.sh, health-checks.sh, port-validation.sh
    - Use config constants (TIMEOUT_*, RETRY_*, STABILIZATION_*)

  FOLLOW pattern: /home/ljutzkanov/Documents/Projects/archon/start-archon.sh (lines 338-395)
    - Multi-stage validation with retry logic
    - Strategic stabilization waits (15s after health, 5s after DB create)
    - Detailed logging at each step
    - Return 0 on success, 1 on any failure

  NAMING:
    - wait_for_postgres_ready(container, retries, delay)
    - initialize_postgres_complete(container, port)
    - create_database_if_missing(container, db_name, user)
    - run_migrations(container, db_name, sql_file)

  PLACEMENT: ~/Documents/Projects/lib/postgres-utils.sh

  VALIDATION:
    - shellcheck lib/postgres-utils.sh
    - bash -n lib/postgres-utils.sh
    - Integration test: Start Supabase, run initialize_postgres_complete

---

Task 3: CREATE ~/Documents/Projects/lib/config.sh
  Description: Centralize timeout, retry, and infrastructure constants
  Dependencies: None (constants only, no logic)
  Estimated Time: 30 minutes

  Implementation:
    - Define TIMEOUT_* constants (CONTAINER_HEALTHY=120, PORT_BINDING=60, etc.)
    - Define RETRY_* constants (POSTGRES_COUNT=5, POSTGRES_DELAY=3, etc.)
    - Define STABILIZATION_* constants (POSTGRES_INIT=15, DATABASE_CREATE=5, etc.)
    - Define infrastructure constants (BRIDGE_NETWORK, SUPABASE_CONTAINER, ports)
    - Export all constants with readonly declaration
    - Add comment block explaining rationale (15s aligned with Supabase start_period=45s)

  FOLLOW pattern: Simple constant definitions, no functions

  NAMING: UPPER_SNAKE_CASE for all constants

  PLACEMENT: ~/Documents/Projects/lib/config.sh

  VALIDATION:
    - shellcheck lib/config.sh
    - Source config.sh and echo constants to verify

---

Task 4: MODIFY ~/Documents/Projects/archon/start-archon.sh
  Description: Fix the bug by sourcing new libraries and using functions
  Dependencies: Tasks 1, 2, 3 (all libraries created)
  Estimated Time: 1 hour

  Implementation:
    - Add source statements after line 50 (existing library loading):
      source "$LIB_DIR/port-validation.sh"
      source "$LIB_DIR/postgres-utils.sh"
      source "$LIB_DIR/config.sh"

    - REPLACE lines 338-395 (manual PostgreSQL init) with:
      if ! initialize_postgres_complete "$SUPABASE_CONTAINER" 5432; then
          log_error "PostgreSQL initialization failed"
          return 1
      fi
      log_success "PostgreSQL fully initialized and ready"

    - FIX line 390 (already using correct function name, just needs sourcing)
      # Before: wait_for_port_occupied 5432 60  (function doesn't exist)
      # After: wait_for_port_occupied 5432 60  (function now available)

    - Replace hardcoded values with config constants:
      wait_for_healthy "$SUPABASE_CONTAINER" "$TIMEOUT_CONTAINER_HEALTHY"
      sleep "$STABILIZATION_POSTGRES_INIT"

  PRESERVE: All other functionality, just replace implementation

  VALIDATION:
    - shellcheck start-archon.sh (check new changes only)
    - bash -n start-archon.sh (syntax check)
    - ./start-archon.sh (full integration test)

---

Task 5: CREATE ~/Documents/Projects/scripts/setup-shared-libraries.sh
  Description: Automate symlink creation for shared libraries
  Dependencies: Tasks 1, 2, 3 (libraries exist in ~/Documents/Projects/lib/)
  Estimated Time: 1 hour

  Implementation:
    - Backup existing project lib directories (lib.backup-YYYYMMDD)
    - For each project (archon, sporterp-apps):
      - For each library file:
        - Remove existing file
        - Create relative symlink: ln -s ../../lib/file.sh project/lib/file.sh
    - Verify symlinks with ls -la
    - Test sourcing in startup scripts

  FOLLOW pattern: Standard bash script with error handling

  CRITICAL: Use relative symlinks, not absolute (portability)

  PLACEMENT: ~/Documents/Projects/scripts/setup-shared-libraries.sh

  VALIDATION:
    - Run script
    - Verify symlinks: ls -la archon/lib/
    - Test: cd archon && ./start-archon.sh

---

Task 6: CREATE ~/Documents/Projects/scripts/test-startup-scenarios.sh
  Description: Automated testing for startup scenarios
  Dependencies: Tasks 1-5 (all implementation complete)
  Estimated Time: 2 hours

  Implementation:
    - Test 1: Port validation functions (unit tests)
      - Start test container with known port
      - Verify wait_for_port_occupied works
      - Stop container, verify wait_for_port_release works

    - Test 2: PostgreSQL initialization (integration test)
      - Ensure Supabase running
      - Call initialize_postgres_complete
      - Verify all 4 steps execute correctly

    - Test 3: Archon cold start (no containers)
      - Stop all containers
      - Run start-archon.sh
      - Expect clear error about missing Supabase

    - Test 4: Archon warm start (Supabase up)
      - Ensure Supabase healthy
      - Run start-archon.sh
      - Verify starts in <20 seconds

    - Test 5: Restart recovery (Supabase bounces)
      - Start Archon
      - Restart Supabase
      - Verify Archon detects and waits

  FOLLOW pattern: Standard test script with pass/fail reporting

  PLACEMENT: ~/Documents/Projects/scripts/test-startup-scenarios.sh

  VALIDATION:
    - Run test suite: ./test-startup-scenarios.sh
    - All tests should pass

---

Task 7: UPDATE documentation (README.md, CLAUDE.md)
  Description: Document new shared library infrastructure
  Dependencies: Tasks 1-6 (all implementation and testing complete)
  Estimated Time: 1 hour

  Implementation:
    - Add section to ~/Documents/Projects/.claude/CLAUDE.md:
      "## Shared Infrastructure Libraries"
      - List all libraries with descriptions
      - Explain symlink architecture
      - Document usage patterns

    - Update archon/.claude/CLAUDE.md:
      - Document new PostgreSQL initialization
      - Update troubleshooting section
      - Add startup time benchmarks

    - Create ~/Documents/Projects/lib/README.md:
      - Library descriptions
      - Usage examples
      - Maintenance guidelines

  FOLLOW pattern: Existing CLAUDE.md structure

  PLACEMENT: Multiple files (workspace root, archon, lib)

  VALIDATION:
    - Read documentation
    - Verify examples work
    - Check all links valid
```

### Implementation Patterns & Key Details

```bash
# ============================================================================
# PORT VALIDATION PATTERN (port-validation.sh)
# ============================================================================

# Function: port_is_available
# Returns: 0 if port is FREE, 1 if port is OCCUPIED (note the inversion!)
port_is_available() {
    local port="$1"
    local host="${2:-127.0.0.1}"

    # Try netcat first (preferred method)
    if command -v nc &>/dev/null; then
        ! nc -z "$host" "$port" 2>/dev/null
    else
        # Fallback to bash built-in /dev/tcp
        # CRITICAL: Use subshell to avoid polluting main shell
        ! (timeout 1 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null)
    fi
}

# Function: wait_for_port_occupied (THE MISSING FUNCTION!)
# Returns: 0 if port becomes occupied, 1 on timeout
wait_for_port_occupied() {
    local port="$1"
    local timeout="${2:-30}"
    local elapsed=0

    log_info "Waiting for port $port to be bound..."

    while [ $elapsed -lt $timeout ]; do
        # Port occupied when port_is_available returns false
        if ! port_is_available "$port"; then
            log_success "Port $port is bound after ${elapsed}s"
            return 0
        fi

        sleep 1
        elapsed=$((elapsed + 1))
    done

    log_error "Timeout: Port $port not bound after ${timeout}s"
    return 1
}

# Function: wait_for_port_release
# Returns: 0 if port is freed, 1 on timeout
wait_for_port_release() {
    local port="$1"
    local timeout="${2:-30}"
    local elapsed=0
    local interval=1

    log_info "Waiting for port $port to be released..."

    while [ $elapsed -lt $timeout ]; do
        # Port freed when port_is_available returns true
        if port_is_available "$port"; then
            log_success "Port $port released after ${elapsed}s"
            return 0
        fi

        sleep $interval
        elapsed=$((elapsed + interval))

        # CRITICAL: Exponential backoff (capped at 5s)
        interval=$((interval * 2))
        [ $interval -gt 5 ] && interval=5
    done

    log_error "Timeout: Port $port still in use after ${timeout}s"
    return 1
}

# ============================================================================
# POSTGRESQL INITIALIZATION PATTERN (postgres-utils.sh)
# ============================================================================

# Function: initialize_postgres_complete (4-step sequence)
# Returns: 0 on success, 1 on any failure
initialize_postgres_complete() {
    local container="$1"
    local port="${2:-5432}"
    local start_time=$(date +%s)

    log_info "PostgreSQL initialization started for $container"

    # STEP 1: Container Health Check (0-120s)
    log_info "Step 1/4: Checking container health..."
    if ! is_container_healthy "$container"; then
        log_warn "Container not healthy yet, waiting..."
        if ! wait_for_healthy "$container" "$TIMEOUT_CONTAINER_HEALTHY"; then
            log_error "Container failed to become healthy after ${TIMEOUT_CONTAINER_HEALTHY}s"
            return 1
        fi
    fi
    log_success "Container is healthy"

    # STEP 2: Stabilization Wait (15s)
    # CRITICAL: Supabase healthcheck has start_period=45s
    # Container reports healthy before PostgreSQL fully initialized
    log_info "Step 2/4: Waiting for PostgreSQL to initialize (${STABILIZATION_POSTGRES_INIT}s)..."
    sleep "$STABILIZATION_POSTGRES_INIT"

    # STEP 3: PostgreSQL Readiness Check (0-15s)
    log_info "Step 3/4: Verifying PostgreSQL readiness..."
    if ! wait_for_postgres_ready "$container" "$RETRY_POSTGRES_COUNT" "$RETRY_POSTGRES_DELAY"; then
        log_error "PostgreSQL failed to become ready"
        return 1
    fi
    log_success "PostgreSQL is ready"

    # STEP 4: Port Binding Verification (0-60s)
    log_info "Step 4/4: Verifying port $port is bound..."
    if ! wait_for_port_occupied "$port" "$TIMEOUT_PORT_BINDING"; then
        log_error "Port $port not bound after ${TIMEOUT_PORT_BINDING}s"
        return 1
    fi
    log_success "Port $port is bound"

    local total_duration=$(($(date +%s) - start_time))
    log_success "PostgreSQL fully initialized and ready (${total_duration}s)"
    return 0
}

# Function: wait_for_postgres_ready (with retry logic)
# Returns: 0 on success, 1 after all retries exhausted
wait_for_postgres_ready() {
    local container="$1"
    local retries="${2:-5}"
    local delay="${3:-3}"

    log_info "Checking PostgreSQL readiness (max $retries attempts)..."

    for ((i=1; i<=retries; i++)); do
        if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
            log_success "PostgreSQL is ready (attempt $i/$retries)"
            return 0
        fi

        if [ $i -lt $retries ]; then
            log_info "PostgreSQL not ready, waiting ${delay}s (attempt $i/$retries)..."
            sleep $delay
        fi
    done

    log_error "PostgreSQL failed to become ready after $retries attempts"
    return 1
}

# ============================================================================
# CONFIGURATION CONSTANTS PATTERN (config.sh)
# ============================================================================

# Timeout values (seconds)
readonly TIMEOUT_CONTAINER_HEALTHY=120    # Wait for container to become healthy
readonly TIMEOUT_PORT_BINDING=60          # Wait for port to be bound
readonly TIMEOUT_POSTGRES_READY=60        # Overall pg_isready timeout

# Retry configuration
readonly RETRY_POSTGRES_COUNT=5           # Number of pg_isready attempts
readonly RETRY_POSTGRES_DELAY=3           # Delay between pg_isready attempts

# Stabilization waits (seconds)
readonly STABILIZATION_POSTGRES_INIT=15   # After container healthy, before pg_isready
                                          # CRITICAL: Aligned with Supabase start_period=45s

# Infrastructure
readonly BRIDGE_NETWORK="sporterp-ai-unified"
readonly SUPABASE_CONTAINER="supabase-ai-db"
readonly SUPABASE_PORT=5432

# Export all
export TIMEOUT_CONTAINER_HEALTHY TIMEOUT_PORT_BINDING
export RETRY_POSTGRES_COUNT RETRY_POSTGRES_DELAY
export STABILIZATION_POSTGRES_INIT
export BRIDGE_NETWORK SUPABASE_CONTAINER SUPABASE_PORT
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# Run after creating each bash library file
shellcheck ~/Documents/Projects/lib/port-validation.sh
shellcheck ~/Documents/Projects/lib/postgres-utils.sh
shellcheck ~/Documents/Projects/lib/config.sh

# Syntax check (no execution)
bash -n ~/Documents/Projects/lib/port-validation.sh
bash -n ~/Documents/Projects/lib/postgres-utils.sh
bash -n ~/Documents/Projects/lib/config.sh

# Check modified startup script
shellcheck ~/Documents/Projects/archon/start-archon.sh
bash -n ~/Documents/Projects/archon/start-archon.sh

# Expected: Zero errors from shellcheck and bash -n
# Common issues to fix:
#   SC2086: Double quote to prevent word splitting
#   SC2155: Declare and assign separately
#   SC2181: Check exit code directly (use if cmd; then)
```

### Level 2: Unit Tests (Function Validation)

```bash
# Test port validation functions
# Terminal 1: Start test service
docker run -d --name test-nginx -p 54321:80 nginx

# Terminal 2: Test functions
cd ~/Documents/Projects
source lib/logging.sh
source lib/port-validation.sh

# Test 1: port_is_available
port_is_available 54321 && echo "FAIL: Port should be occupied" || echo "PASS: Port is occupied"
port_is_available 54322 && echo "PASS: Port is free" || echo "FAIL: Port should be free"

# Test 2: wait_for_port_occupied (should succeed immediately)
wait_for_port_occupied 54321 10 && echo "PASS" || echo "FAIL"

# Test 3: wait_for_port_release
docker stop test-nginx
wait_for_port_release 54321 30 && echo "PASS" || echo "FAIL"

# Cleanup
docker rm test-nginx

# Expected: All tests pass (PASS messages)

# Test PostgreSQL functions
cd ~/Documents/Projects
source lib/logging.sh
source lib/health-checks.sh
source lib/port-validation.sh
source lib/config.sh
source lib/postgres-utils.sh

# Ensure Supabase is running
cd local-ai-packaged
python start_services.py --profile gpu-amd

# Test initialize_postgres_complete
cd ~/Documents/Projects
initialize_postgres_complete "supabase-ai-db" 5432
echo "Exit code: $?"  # Should be 0

# Expected: Function completes successfully, logs show all 4 steps
```

### Level 3: Integration Testing (System Validation)

```bash
# Full Archon startup test
cd ~/Documents/Projects/archon

# Test 1: Warm start (Supabase already running)
./start-archon.sh
# Expected:
#   - No "command not found" errors
#   - PostgreSQL initialization succeeds
#   - All containers start
#   - Completes in <60 seconds

# Verify services
docker ps --filter "name=archon"
# Expected: archon-mcp, archon-server, archon-ui all running

# Check health endpoints
curl -f http://localhost:8051/health || echo "MCP health check failed"
curl -f http://localhost:8181/api/health || echo "API health check failed"
curl -f http://localhost:3737 || echo "UI health check failed"
# Expected: All return HTTP 200

# Test 2: Cold start (no containers)
cd ~/Documents/Projects/archon
./stop-archon.sh
docker stop supabase-ai-db

./start-archon.sh
# Expected:
#   - Clear error message: "Supabase AI container not found"
#   - Suggests: "Please start local-ai-packaged services first"
#   - Exits with code 1

# Test 3: Restart recovery (Supabase bounces)
cd ~/Documents/Projects/local-ai-packaged
docker-compose restart supabase-ai-db

# Wait 5 seconds, then start Archon
sleep 5
cd ~/Documents/Projects/archon
./start-archon.sh
# Expected:
#   - Waits for PostgreSQL to be ready
#   - Retry logic shows attempts (e.g., "Attempt 2/5...")
#   - Eventually succeeds

# Database validation
docker exec supabase-ai-db psql -U postgres -d archon_db -c "SELECT 1;"
# Expected: Returns 1 row

# Expected: All integration tests pass
```

### Level 4: Creative & Domain-Specific Validation

```bash
# Startup scenario testing suite
cd ~/Documents/Projects
./scripts/test-startup-scenarios.sh
# Expected: All tests pass (see Task 6 for test details)

# Performance benchmarking
cd ~/Documents/Projects/archon
time ./start-archon.sh
# Expected:
#   - Warm start: <20 seconds
#   - Cold start (after Supabase up): <60 seconds

# Stress testing (multiple rapid restarts)
for i in {1..5}; do
    echo "=== Restart $i/5 ==="
    ./stop-archon.sh
    ./start-archon.sh
    sleep 2
done
# Expected: All 5 restarts succeed without errors

# Symlink validation
ls -la ~/Documents/Projects/archon/lib/
ls -la ~/Documents/Projects/sporterp-apps/lib/
# Expected: All lib files are symlinks pointing to ~/Documents/Projects/lib/

# Shared library modification test
echo "# Test modification" >> ~/Documents/Projects/lib/port-validation.sh
grep "Test modification" ~/Documents/Projects/archon/lib/port-validation.sh
# Expected: Modification visible in both locations (confirms symlink works)

# Revert test modification
git checkout ~/Documents/Projects/lib/port-validation.sh

# Expected: All creative validations pass
```

## Final Validation Checklist

### Technical Validation

- [ ] All 4 validation levels completed successfully
- [ ] No shellcheck warnings: `shellcheck lib/*.sh`
- [ ] No syntax errors: `bash -n lib/*.sh`
- [ ] All unit tests pass (port functions, PostgreSQL functions)
- [ ] Integration tests pass (Archon startup scenarios)
- [ ] Performance meets requirements (<60s startup)

### Feature Validation

- [ ] Archon starts without "command not found" error
- [ ] PostgreSQL initialization completes reliably (10/10 attempts)
- [ ] Cold start shows clear error about missing dependencies
- [ ] Warm start completes in <20 seconds
- [ ] Restart recovery works (Supabase bounce doesn't break Archon)
- [ ] Port validation functions work correctly (tested with real services)

### Code Quality Validation

- [ ] Follows existing bash patterns (shebang, sourcing, exports)
- [ ] Symlinks created correctly (relative paths, no broken links)
- [ ] Configuration constants used (no hardcoded timeouts)
- [ ] Comprehensive logging at each step
- [ ] Error messages include remediation steps

### Documentation & Deployment

- [ ] Library README.md created with usage examples
- [ ] Workspace CLAUDE.md updated with shared library section
- [ ] Archon CLAUDE.md updated with new PostgreSQL init pattern
- [ ] All code examples tested and working

---

## Anti-Patterns to Avoid

- ❌ Don't use absolute paths for symlinks (breaks portability)
- ❌ Don't skip shellcheck warnings (they catch real bugs)
- ❌ Don't use unquoted variables (causes word splitting issues)
- ❌ Don't hardcode timeout values (use config.sh constants)
- ❌ Don't assume netcat is available (provide /dev/tcp fallback)
- ❌ Don't skip the stabilization wait (Supabase needs time to initialize)
- ❌ Don't ignore return codes (check and handle all function returns)
- ❌ Don't modify project lib files (modify workspace lib, symlinks propagate)
- ❌ Don't use sync commands in async context (not applicable to bash)
- ❌ Don't catch all exceptions (not applicable to bash, use specific return code checks)

---

## PRP Quality Score

**Confidence Level for One-Pass Implementation: 8.5/10**

**Strengths** (+):
- ✅ **Complete code snippets** (not pseudo-code, ready to copy-paste)
- ✅ **Exact file paths** and line numbers (no guessing)
- ✅ **Reference implementations** (Python source, existing bash patterns)
- ✅ **Executable validation gates** (shellcheck, bash -n, integration tests)
- ✅ **Comprehensive context** (Python reference, bash patterns, gotchas)
- ✅ **Clear error messages** (what to expect, how to fix)
- ✅ **Testing procedures** (step-by-step validation with expected outcomes)
- ✅ **Rollback plan** (backup directories, revert steps)

**Risks** (-):
- ⚠️ **Bash platform quirks** (-0.5): netcat availability varies, /dev/tcp may behave differently
- ⚠️ **Multi-project coordination** (-0.5): Symlinks require careful testing across projects
- ⚠️ **Supabase timing** (-0.5): 15-second stabilization may need adjustment based on hardware

**Mitigation Strategies**:
1. **Platform quirks**: Provide both netcat and /dev/tcp implementations with fallback
2. **Symlink testing**: Extensive validation in Level 3 (test in both projects)
3. **Timing adjustments**: Use config.sh for easy tuning (can increase STABILIZATION_POSTGRES_INIT if needed)

**Expected Outcome**:
One-pass implementation success for core functionality (Tasks 1-4). May need minor adjustments for symlink automation (Task 5) and edge cases in testing (Task 6). Documentation (Task 7) should be straightforward.

**If Issues Occur**:
1. Check shellcheck output for common bash mistakes
2. Verify symlinks with `ls -la` and `readlink`
3. Test functions individually before integration
4. Increase STABILIZATION_POSTGRES_INIT if timing issues persist
5. Use `set -x` in bash scripts for detailed execution tracing

---

*This PRP is ready for one-pass implementation using the `/execute-prp` command or direct implementation by an AI agent.*
