# Step 2: Concurrent Client Stress Testing - Implementation Guide

**Date**: 2026-01-11
**Status**: ✅ Script Ready, ⏳ Execution Pending
**Next**: Execute tests and analyze results

---

## Overview

Comprehensive stress testing script for MCP session lifecycle with 5 concurrent clients. Tests all Phase 5 improvements: reduced timeout (5 min), heartbeat mechanism, disconnect detection, and session health metrics.

---

## Test Script Location

**File**: `/home/ljutzkanov/Documents/Projects/archon/scripts/test-concurrent-sessions.sh`
**Permissions**: Executable (`chmod +x` applied)
**Duration**: ~15 minutes total (including 6-minute heartbeat test)

---

## Test Scenarios

### Scenario 1: Normal Session Lifecycle ✅
**Duration**: ~10 seconds
**Clients**: 5 concurrent
**Steps**:
1. Initialize MCP session
2. Call `health_check` tool
3. Verify session in database
4. Record results

**Expected Outcome**:
- 5/5 clients successfully initialize
- All tool calls succeed
- All sessions appear in database with "active" status

---

### Scenario 2: Stale Session Cleanup ⏱️
**Duration**: 6 minutes
**Clients**: 2 concurrent
**Steps**:
1. Initialize session
2. Make one tool call (mark session as active)
3. Idle for 6 minutes (no heartbeat)
4. Verify session marked as "disconnected"

**Expected Outcome**:
- Sessions created successfully
- After 6 minutes, both sessions marked "disconnected"
- Disconnect reason: "timeout_no_activity"

**Detection Window**: Maximum 6 minutes (5 min timeout + 1 min cleanup)

---

### Scenario 3: Concurrent Clients (5 Simultaneous) ✅
**Duration**: ~30 seconds
**Clients**: 5 concurrent
**Steps**:
1. All 5 clients initialize simultaneously
2. Each client makes 5 tool calls
3. Monitor concurrent execution
4. Verify all sessions tracked separately

**Expected Outcome**:
- 5 distinct sessions created
- 25 total tool calls (5 clients × 5 calls)
- All calls succeed without conflicts
- Session health shows 5 active sessions

---

### Scenario 4: Reconnection 🔄
**Duration**: ~10 seconds
**Clients**: 3 concurrent
**Steps**:
1. Initialize first session
2. Make tool call
3. "Disconnect" (stop using session)
4. Initialize second session
5. Verify sessions are different

**Expected Outcome**:
- First session created
- Second session created with different ID
- Both sessions tracked in database
- First session eventually expires (after 5 min)

**Note**: Current implementation creates new sessions on reconnect (no session resume support - deferred to Step 3)

---

### Scenario 5: Long-running Session with Heartbeat ❤️
**Duration**: 6 minutes
**Clients**: 1
**Steps**:
1. Initialize session
2. Send heartbeat every 2 minutes (3 total)
3. Wait 6 minutes total
4. Verify session still active

**Expected Outcome**:
- Session initialized
- 3/3 heartbeats sent successfully
- After 6 minutes, session still "active"
- No timeout despite exceeding 5-minute limit

**Heartbeat Timing**:
- Interval: 120 seconds (2 minutes)
- Total duration: 360 seconds (6 minutes)
- Heartbeats sent: 3
- Timeout threshold: 300 seconds (5 minutes)

---

## Execution Instructions

### Prerequisites

**Services running**:
```bash
# 1. MCP Server (port 8051)
curl -s http://localhost:8051/mcp

# 2. API Server (port 8181)
curl -s http://localhost:8181/api/mcp/sessions/health

# 3. Database accessible
docker exec -it supabase-ai-db psql -U postgres -c "SELECT 1"
```

**Dependencies**:
- `curl` (HTTP requests)
- `jq` (JSON parsing)
- `bash` 4.0+

### Running the Tests

**Full test suite** (all 5 scenarios):
```bash
cd /home/ljutzkanov/Documents/Projects/archon
./scripts/test-concurrent-sessions.sh
```

**Expected output**:
```
================================================
   MCP Session Lifecycle - Concurrent Test
================================================

[INFO] Checking prerequisites...
[SUCCESS] MCP server is running
[SUCCESS] API server is running

============================================
Test 1: Normal Session Lifecycle
============================================
[INFO] Testing: Connect → Tool Call → Disconnect

[INFO] [Client 1] Starting normal lifecycle test...
[SUCCESS] [Client 1] Session initialized: 7e67a8b5-...
[SUCCESS] [Client 1] Tool call succeeded
[SUCCESS] [Client 1] Session verified in database
[SUCCESS] [Client 1] Normal lifecycle test completed

... (4 more clients)

[SUCCESS] Test 1 completed for all 5 clients

============================================
Test 2: Stale Session Cleanup
============================================
...
```

**Monitor real-time** (while tests run):
```bash
# In separate terminal - watch session health
watch -n 10 'curl -s http://localhost:8181/api/mcp/sessions/health | jq .status_breakdown'
```

### Test Results Location

**Directory**: `/tmp/mcp-concurrent-test-<timestamp>/`

**Files created**:
- `client_1_normal.json` ... `client_5_normal.json`
- `client_1_stale.json`, `client_2_stale.json`
- `client_1_concurrent.json` ... `client_5_concurrent.json`
- `client_1_reconnection.json` ... `client_3_reconnection.json`
- `client_1_heartbeat.json`

**Example result file**:
```json
{
  "client_id": 1,
  "session_id": "7e67a8b5-...",
  "success": true,
  "test": "normal_lifecycle"
}
```

---

## Expected Results

### Test 1: Normal Lifecycle
```
Test Results:
  Normal Lifecycle: 5/5 passed ✅
```

**Session health after**:
```json
{
  "status_breakdown": {
    "active": 5,
    "disconnected": 13,
    "total": 18
  }
}
```

### Test 2: Stale Cleanup (after 6 minutes)
```
[SUCCESS] [Client 1] Session correctly marked as disconnected
[SUCCESS] [Client 2] Session correctly marked as disconnected
```

**Database verification**:
```sql
SELECT session_id, status, disconnect_reason, disconnected_at
FROM archon_mcp_sessions
WHERE status = 'disconnected'
ORDER BY disconnected_at DESC
LIMIT 2;

-- Expected:
-- session_id | status       | disconnect_reason     | disconnected_at
-- -----------+--------------+-----------------------+----------------
-- xxx-1      | disconnected | timeout_no_activity   | 2026-01-11 ...
-- xxx-2      | disconnected | timeout_no_activity   | 2026-01-11 ...
```

### Test 3: Concurrent Clients
```
Test Results:
  Concurrent Clients: 5/5 passed ✅
```

**Tool call statistics**:
- Total calls: 25 (5 clients × 5 calls)
- Successes: 25/25 ✅
- Conflicts: 0
- Errors: 0

### Test 4: Reconnection
```
Test Results:
  Reconnection: 3/3 passed ✅
```

**Session differentiation**:
```json
{
  "client_id": 1,
  "session1_id": "7e67a8b5-...",
  "session2_id": "9a2f3c4d-...",
  "sessions_different": true,
  "success": true
}
```

### Test 5: Heartbeat
```
Test Results:
  Heartbeat: 1/1 passed ✅
```

**Heartbeat statistics**:
```json
{
  "client_id": 1,
  "session_id": "abc123...",
  "heartbeats_sent": 3,
  "heartbeats_expected": 3,
  "duration_seconds": 360,
  "final_status": "active",
  "success": true
}
```

**Session longevity**:
- Session created: 00:00:00
- Heartbeat 1: 00:02:00
- Heartbeat 2: 00:04:00
- Heartbeat 3: 00:06:00
- **Result**: Session still active after 6 minutes (exceeds 5-min timeout)

---

## Troubleshooting

### Test 1 Failures

**Symptom**: "Failed to initialize session"

**Possible Causes**:
- MCP server not running
- Missing MCP protocol headers
- Database connection issues

**Fix**:
```bash
# Check MCP server
docker logs archon-mcp-server | tail -n 50

# Restart if needed
docker compose restart archon-mcp
```

---

### Test 2 Failures

**Symptom**: Sessions not marked as disconnected after 6 minutes

**Possible Causes**:
- Cleanup task not running
- Timeout configuration incorrect
- Database update failing

**Fix**:
```bash
# Check cleanup task logs
docker logs archon-mcp-server | grep "Cleaned up"

# Verify timeout configuration
docker exec archon-mcp-server grep "timeout: int = " /app/src/server/services/mcp_session_manager.py
# Should show: timeout: int = 300

# Check database connectivity
docker exec archon-server curl -s http://host.docker.internal:8000/rest/v1/ | jq .
```

---

### Test 3 Failures

**Symptom**: Tool calls failing under concurrent load

**Possible Causes**:
- Database connection pool exhausted
- Rate limiting
- Session conflicts

**Fix**:
```bash
# Check database connections
docker exec supabase-ai-db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Increase connection pool (if needed)
# Edit docker-compose.yml:
# POSTGRES_MAX_CONNECTIONS: 200
```

---

### Test 4 Failures

**Symptom**: Same session ID returned for reconnection

**Possible Causes**:
- Session manager reusing IDs
- UUID generation collision

**Fix**: This would be unexpected - report as bug

---

### Test 5 Failures

**Symptom**: Session disconnected despite heartbeats

**Possible Causes**:
- Heartbeat tool not updating `last_activity`
- `@track_tool_execution` decorator not working
- Database timestamp not updating

**Fix**:
```bash
# Check heartbeat implementation
docker exec archon-mcp-server grep -A 10 "def heartbeat" /app/src/mcp_server/mcp_server.py

# Verify decorator applied
# Should see: @track_tool_execution

# Check database updates
docker exec supabase-ai-db psql -U postgres -d postgres -c "
SELECT session_id, last_activity, NOW() - last_activity as idle_time
FROM archon_mcp_sessions
WHERE status = 'active'
ORDER BY last_activity DESC;
"
```

---

## Performance Metrics

### Resource Usage (Expected)

**During Test 1 (5 concurrent clients)**:
- CPU: ~10-15% (normal load)
- Memory: +50MB (session storage)
- Network: ~25KB/s (5 clients × 5KB/s)
- Database connections: +5 (one per client)

**During Test 5 (heartbeat, 6 minutes)**:
- CPU: ~5% (idle with periodic heartbeat)
- Memory: +10MB (single session)
- Network: ~100B every 2 minutes
- Database connections: +1

**Total Test Duration**:
- Sequential execution: ~15 minutes
- Parallel components: ~7 minutes
- Heartbeat test: 6 minutes (longest)

---

## Validation Checklist

After running tests, verify:

**Phase 5 Features**:
- [ ] Timeout reduced to 5 minutes (from 1 hour)
- [ ] Cleanup runs every 1 minute (from 5 minutes)
- [ ] Heartbeat tool available and functional
- [ ] Disconnect detection within 6 minutes
- [ ] Session health API returns accurate metrics

**Session Lifecycle**:
- [ ] Sessions created successfully
- [ ] Sessions tracked in database
- [ ] Active sessions remain active during use
- [ ] Idle sessions disconnect after 5 minutes
- [ ] Heartbeat extends session lifetime

**Concurrent Behavior**:
- [ ] Multiple clients supported simultaneously
- [ ] No session ID conflicts
- [ ] Tool calls execute without errors
- [ ] Database handles concurrent writes

**Data Integrity**:
- [ ] Session IDs unique
- [ ] Timestamps accurate (timezone-aware UTC)
- [ ] Status transitions logged
- [ ] Disconnect reasons recorded

---

## Next Steps

### After Test Execution

1. **Analyze Results**:
   ```bash
   cd /tmp/mcp-concurrent-test-<timestamp>

   # Count successes
   grep -l '"success": true' *.json | wc -l

   # Check for failures
   grep -l '"success": false' *.json

   # View detailed results
   jq -s '.' *.json > all_results.json
   ```

2. **Generate Report**:
   - Total tests run: 16 (5+2+5+3+1)
   - Success rate: X/16
   - Average session duration: X seconds
   - Heartbeat effectiveness: X%

3. **Update Documentation**:
   - Add test results to `SESSION_LIFECYCLE_V2.1_CHANGELOG.md`
   - Create `CONCURRENT_TESTING_RESULTS.md`

4. **Proceed to Step 3**: Session Reconnection Support (if tests pass)

---

## Automated CI/CD Integration

**For future automation**, add to `.github/workflows/test-mcp-sessions.yml`:

```yaml
name: MCP Session Lifecycle Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'python/src/server/services/mcp_session_manager.py'
      - 'python/src/mcp_server/mcp_server.py'

jobs:
  concurrent-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: supabase/postgres:15.1.0.117
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Start Archon services
        run: docker-compose up -d

      - name: Wait for services
        run: sleep 30

      - name: Run concurrent tests
        run: ./scripts/test-concurrent-sessions.sh

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: /tmp/mcp-concurrent-test-*
```

---

**Status**: ✅ Script ready for execution
**Estimated Duration**: 15 minutes
**Prerequisites**: MCP server, API server, Supabase database running
**Next Action**: Execute `./scripts/test-concurrent-sessions.sh`
