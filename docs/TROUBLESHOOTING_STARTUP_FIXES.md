# Archon Startup Troubleshooting and Fixes

## Summary

This document details the resolution of critical startup issues with the Archon platform. The primary issue was the archon-server container failing with a PGRST205 error due to missing database schema in the wrong database.

## Issues Resolved

### 1. Critical: Missing Database Schema (PGRST205)

**Problem**:
- archon-server container was failing with `postgrest.exceptions.APIError: Could not find the table 'public.archon_settings' in the schema cache`
- PostgREST (the Supabase API layer) couldn't find required tables

**Root Cause**:
- Database migration was initially run in the `archon_db` database
- PostgREST is configured to connect to the `postgres` database (hardcoded in Supabase configuration)
- These are **separate databases**, not schemas within the same database

**Discovery Process**:
1. Initial assumption: PostgREST schema cache needed reloading
2. Attempted: Created event trigger for automatic schema reloads
3. Error persisted: Tables still not found
4. Web research: Found PostgREST connects to specific database in `PGRST_DB_URI`
5. Investigation: Confirmed `PGRST_DB_URI=postgres://authenticator:Postgress.8201@db:5432/postgres`
6. Solution: Ran migration in the `postgres` database where PostgREST looks

**Fix Applied**:
```bash
# Run migration in correct database
docker exec -i supabase-ai-db psql -U postgres -d postgres < migration/complete_setup.sql

# Verify tables created
docker exec -i supabase-ai-db psql -U postgres -d postgres -c "\dt public.*"
```

**Files Modified**: None (migration script was correct, just needed to target right database)

**Verification**:
- archon-server started successfully and became healthy
- Health endpoint responding: `{"status":"healthy","service":"knowledge-api"}`
- No more PGRST205 errors in logs

---

### 2. VPN Validation Logic Issue

**Problem**:
- VPN validation script path resolution was failing
- Script was blocking local-supabase mode even after user selected that option
- Error: "VPN still not connected after prompt" despite choosing local mode

**Root Cause**:
- Incorrect relative path to VPN script: `$SCRIPT_DIR/../sporterp-apps` (sporterp-apps is a sibling, not parent)
- Re-validation logic was checking VPN status again after `handle_vpn_prompt` returned, ignoring the mode switch

**Fix Applied**:

**File**: `lib/network.sh` (line 194)
```bash
# OLD (incorrect):
local VPN_SCRIPT="$SCRIPT_DIR/../sporterp-apps/scripts/vpn-sso-auth.sh"

# NEW (correct):
local VPN_SCRIPT="$SCRIPT_DIR/../../sporterp-apps/scripts/vpn-sso-auth.sh"
```

**File**: `lib/network.sh` (line 228)
```bash
# OLD:
log_error "Please ensure sporterp-apps is available at: $(dirname "$SCRIPT_DIR")/sporterp-apps"

# NEW:
log_error "Please ensure sporterp-apps is available at: $(dirname "$(dirname "$SCRIPT_DIR")")/sporterp-apps"
```

**File**: `start-archon.sh` (lines 277-282)
```bash
# OLD (buggy - re-validated after mode switch):
else
    handle_vpn_prompt
    if [ "$REQUIRE_VPN" = true ] && ! check_vpn_connected; then
        log_error "VPN still not connected after prompt"
        exit 1
    fi
fi

# NEW (aligned with SportERP pattern - trust function result):
else
    # handle_vpn_prompt validates VPN thoroughly and may switch to local-supabase mode
    # Trust its success/failure - no need to re-check
    handle_vpn_prompt
fi
```

**Verification**:
- VPN script path now resolves correctly
- Local-supabase mode works without re-validation errors
- Aligned with sporterp-apps/start-sporterp.sh pattern

---

### 3. Container Detection Returning Empty Strings

**Problem**:
- Docker inspect was failing with "invalid container name or ID: value is empty"
- Conflict resolution logic was breaking during startup

**Root Cause**:
- Bash arrays were including empty string elements
- Empty strings were being passed to `docker inspect`, causing errors

**Fix Applied**:

**File**: `lib/health-checks.sh` (lines 145-166)
```bash
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
```

**File**: `lib/health-checks.sh` (lines 171-192) - Same fix applied to `get_running_containers_by_pattern()`

**Verification**:
- No more "invalid container name" errors
- Container detection works correctly
- Conflict resolution completes successfully

---

### 4. Environment Variable Warning

**Problem**:
- Docker Compose was showing warning: "GITHUB_PAT_TOKEN variable is not set. Defaulting to a blank string"

**Root Cause**:
- Variable referenced in docker-compose.yml but not defined in .env file

**Fix Applied**:

**File**: `.env` (line 13)
```bash
# Optional: Agent work orders service (not running by default)
GITHUB_PAT_TOKEN=
```

**Verification**:
- No more warnings during docker-compose up
- Agent work orders service can be enabled when needed

---

### 5. File System Mount Failure - inotify Watch Limit

**Problem**:
- File system mount validation was failing with error: "Expected mount: /home/ljutzkanov/Documents/Projects -> /app/projects"
- archon-server container couldn't access `/app/projects` directory
- Startup script exiting with critical error

**Root Cause**:
- Volume mount in docker-compose.yml was **intentionally commented out** to prevent exhausting the system's inotify watch limit
- Default Linux inotify limit: 65,536 watches
- Required for large project directory: 524,288 watches
- The validation logic expected the mount to be present, causing startup failure

**System Background**:
inotify is the Linux kernel subsystem that monitors file system events. Docker containers with large directory mounts can quickly exhaust the default watch limit, causing:
- "no space left on device" errors (despite having free disk space)
- Container startup failures
- File watching breakdowns in development tools

**Fix Applied**:

**Step 1: Increase inotify watch limit (requires manual execution)**:
```bash
# Set runtime value (temporary, until reboot)
sudo sysctl -w fs.inotify.max_user_watches=524288

# Make persistent across reboots
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify
sysctl fs.inotify.max_user_watches
# Should output: fs.inotify.max_user_watches = 524288
```

**Step 2: File**: `docker-compose.yml` (line 49)
```yaml
# BEFORE (disabled):
# TEMPORARILY DISABLED: Exhausts inotify watch limit (65536 -> need 524288)
# Uncomment after running: sudo sysctl fs.inotify.max_user_watches=524288
# - /home/ljutzkanov/Documents/Projects:/app/projects:ro

# AFTER (enabled with better documentation):
# Read-only access to all projects for code analysis
# REQUIRES: inotify watch limit of 524288 (see TROUBLESHOOTING_STARTUP_FIXES.md)
# Run: sudo sysctl -w fs.inotify.max_user_watches=524288
- /home/ljutzkanov/Documents/Projects:/app/projects:ro
```

**Step 3: Improved logging in start-archon.sh** (line 87-92)
```bash
# OLD (misleading warning):
if [ -f "$SCRIPT_DIR/.env" ]; then
    log_info "Loading environment from .env"
    # ...
else
    log_warn ".env file not found - using defaults"
fi

# NEW (better debugging):
ENV_FILE="$SCRIPT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    log_info "Loading environment from .env (path: $ENV_FILE)"
    set -a
    source "$ENV_FILE"
    set +a
    log_info "Environment loaded: MODE=$MODE"
else
    log_warn ".env file not found at: $ENV_FILE"
    log_info "Using default configuration values"
fi
```

**Verification**:
```bash
# Check inotify limit
sysctl fs.inotify.max_user_watches

# Start Archon (mount should now work)
./start-archon.sh

# Verify mount inside container
docker exec archon-server ls /app/projects
# Should list: archon, badmintoo, local-ai-packaged, sporterp-apps, etc.
```

**Related Improvements**:
- **VPN Status Detection** (`lib/network.sh` lines 146-183): Improved pattern matching to correctly identify tun0 interface and provide clearer status messages
- **Healthcheck Retry Logic** (`start-archon.sh`):
  - MCP port check: 3 retries with 2-second delays
  - Database connection: 3 retries with 3-second delays
  - Better messaging for timing-dependent checks

---

### 6. Bash Script Variable Scope Errors

**Problem**:
- Script crashes with: `local: can only be used in a function` at line 639
- .env file lookup fails, searches in wrong directory: `/home/ljutzkanov/Documents/Projects/archon/lib/.env`

**Root Causes**:

**Issue A - Local Variables Outside Function**:
The retry logic for MCP and database healthchecks used `local` keyword in the main script body. In bash, `local` can only be used inside function declarations.

**Issue B - SCRIPT_DIR Variable Overwritten**:
Sourced library files (`logging.sh`, `health-checks.sh`, `network.sh`) were overwriting the `SCRIPT_DIR` variable with their own location (`lib/`), breaking the .env file lookup.

**Variable Collision Timeline**:
1. Line 49: `SCRIPT_DIR` set to project root
2. Line 50: `PROJECT_ROOT` captures correct value
3. Lines 74-80: Library files sourced → one resets `SCRIPT_DIR` to `lib/`
4. Line 85: `.env` lookup fails (wrong directory)

**Fixes Applied**:

**Fix A**: `start-archon.sh` lines 639-641, 671-673
```bash
# BEFORE (incorrect):
local mcp_retries=3
local mcp_delay=2
local mcp_success=false

# AFTER (correct):
mcp_retries=3  # No 'local' keyword in main script body
mcp_delay=2
mcp_success=false
```

**Fix B**: `start-archon.sh` line 86
```bash
# BEFORE (broken by library sourcing):
ENV_FILE="$SCRIPT_DIR/.env"

# AFTER (immune to library modifications):
ENV_FILE="$PROJECT_ROOT/.env"
```

**Why PROJECT_ROOT Works**:
`PROJECT_ROOT` is captured at line 50, before any libraries are sourced, ensuring it always points to the project root regardless of what library files do to `SCRIPT_DIR`.

**Verification**:
```bash
# Check script syntax
bash -n start-archon.sh
# Should report no errors

# Run script - .env should load correctly
./start-archon.sh
# Should show: "Loading environment from .env (path: /home/ljutzkanov/Documents/Projects/archon/.env)"
```

**Lessons Learned**:
- Never use `local` keyword outside function bodies
- Capture critical path variables before sourcing external scripts
- Use distinct variable names (`PROJECT_ROOT` vs `SCRIPT_DIR`) to preserve important values
- Test bash syntax with `bash -n` before running

---

## Complete Verification

All services are now healthy and operational:

### Container Status
```
NAME            STATUS
archon-mcp      Up 2 minutes (healthy)
archon-server   Up 3 minutes (healthy)
archon-ui       Up 2 minutes (healthy)
```

### Health Endpoints
```bash
# archon-server (port 8181)
{"status":"healthy","service":"knowledge-api","timestamp":"2025-12-01T11:07:22.160914"}

# archon-mcp (port 8051)
{"success":true,"status":"ready","uptime_seconds":133.20597505569458,"message":"MCP server is running (no active connections yet)","timestamp":"2025-12-01T11:07:22.762312"}

# archon-ui (port 3737)
HTTP/1.1 200 OK
```

## Lessons Learned

### Database Architecture
- **Key Insight**: Supabase's PostgREST connects to a specific database, not a schema
- **Configuration**: `PGRST_DB_URI` explicitly specifies the database name
- **Best Practice**: Always verify which database PostgREST is configured to use
- **Migration Strategy**: Run migrations in the database that PostgREST connects to

### VPN Validation Patterns
- **Pattern**: Trust function return values, don't re-validate after mode changes
- **Consistency**: Align with established patterns (SportERP pattern)
- **Path Resolution**: Be careful with relative paths in sibling directory structures

### Bash Array Handling
- **Issue**: Empty arrays can produce empty string elements
- **Solution**: Always filter empty strings before processing
- **Best Practice**: Add validation checks for empty values

### Troubleshooting Approach
1. Check logs first (`docker compose logs`)
2. Research error codes (PGRST205 led to understanding PostgREST)
3. Verify configuration (found PGRST_DB_URI pointing to postgres database)
4. Test hypothesis (ran migration in correct database)
5. Verify fix (all health checks passed)

## Future Improvements

### Database Migration Strategy
- Consider adding database validation to migration scripts
- Add checks to verify PostgREST configuration before running migrations
- Document database vs schema distinction prominently

### Startup Script Enhancements
- Add pre-flight checks for common issues
- Validate database schema exists before starting services
- Improve error messages with actionable guidance

### Automatic Schema Reload
Already implemented: Event trigger automatically notifies PostgREST of schema changes
```sql
CREATE OR REPLACE FUNCTION pgrst_watch() RETURNS event_trigger
  LANGUAGE plpgsql AS $$ BEGIN NOTIFY pgrst, 'reload schema'; END; $$;
CREATE EVENT TRIGGER pgrst_watch ON ddl_command_end EXECUTE PROCEDURE pgrst_watch();
```

## Quick Reference

### System Requirements (One-Time Setup)

**Increase inotify watch limit** (required for file system mount):
```bash
# Set limit
sudo sysctl -w fs.inotify.max_user_watches=524288

# Make persistent
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf

# Verify
sysctl fs.inotify.max_user_watches
```

### Start Archon Platform
```bash
cd /home/ljutzkanov/Documents/Projects/archon
./start-archon.sh
```

### Check Platform Health
```bash
# Container status
docker ps --filter "name=archon-"

# Health endpoints
curl http://localhost:8181/api/health
curl http://localhost:8051/health
curl -I http://localhost:3737

# View logs
docker compose logs -f archon-server
docker compose logs -f archon-mcp
docker compose logs -f archon-ui
```

### Common Issues

**Issue**: File system mount failed - "Expected mount: /home/ljutzkanov/Documents/Projects -> /app/projects"
**Solution**:
1. Increase inotify limit: `sudo sysctl -w fs.inotify.max_user_watches=524288`
2. Make persistent: `echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf`
3. Restart Archon: `./stop-archon.sh && ./start-archon.sh`

**Issue**: PGRST205 error about missing tables
**Solution**: Verify migration ran in correct database (postgres, not archon_db)

**Issue**: VPN validation blocking local-supabase mode
**Solution**: Check VPN re-validation logic isn't overriding mode switch

**Issue**: "invalid container name: value is empty"
**Solution**: Ensure container detection filters empty strings

**Issue**: MCP port check inconclusive / Database connection check inconclusive
**Solution**: These are timing issues during startup. Checks now retry automatically. If issues persist, check `docker logs archon-server` or `docker logs archon-mcp`

**Issue**: `local: can only be used in a function` error
**Solution**: Fixed in Section 6. Script was using `local` keyword outside function bodies. Upgrade to latest version.

**Issue**: .env file not found at `/archon/lib/.env` (wrong path)
**Solution**: Fixed in Section 6. Library files were overwriting `SCRIPT_DIR`. Now uses `PROJECT_ROOT` instead. Upgrade to latest version.

## Related Documentation

- **Architecture**: `PRPs/ai_docs/ARCHITECTURE.md`
- **API Conventions**: `PRPs/ai_docs/API_NAMING_CONVENTIONS.md`
- **Health Checks Library**: `lib/health-checks.sh`
- **Network Utilities**: `lib/network.sh`
- **Startup Script**: `start-archon.sh`

## Completion Date

**Fixed**: 2025-12-01
**Final Status**: All services healthy and operational
**Platform Ready**: ✅ Yes
