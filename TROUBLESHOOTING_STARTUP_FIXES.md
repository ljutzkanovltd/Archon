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

**Issue**: PGRST205 error about missing tables
**Solution**: Verify migration ran in correct database (postgres, not archon_db)

**Issue**: VPN validation blocking local-supabase mode
**Solution**: Check VPN re-validation logic isn't overriding mode switch

**Issue**: "invalid container name: value is empty"
**Solution**: Ensure container detection filters empty strings

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
