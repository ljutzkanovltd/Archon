# Lazy Session Creation - Remaining Tests (2-6)

**Quick Reference Guide for Completing Tests**

---

## Prerequisites

1. **Restart Archon:**
   ```bash
   cd /home/ljutzkanov/Documents/Projects/archon
   ./start-archon.sh
   # Choose option 1 (Local LLMs)
   ```

2. **Verify Running:**
   ```bash
   curl http://localhost:8051/health
   # Expected: {"status":"ready"}

   docker logs archon-mcp --tail 50 | grep -i "global.*session"
   # Expected: No output (no global session creation)
   ```

---

## Test 2: First Tool Call Test

**Objective:** Verify session created lazily on first tool call

**Steps:**

1. **Make first MCP tool call** (via MCP client or curl):
   ```bash
   # Option A: Via MCP client (recommended)
   # Use Claude Code or cursor to call any MCP tool
   # Example: health_check, rag_search_knowledge_base, etc.

   # Option B: Via direct API call (testing only)
   curl -X POST http://localhost:8181/api/health
   ```

2. **Check logs for session creation:**
   ```bash
   docker logs archon-mcp --tail 100 | grep -i "session created"
   # Expected: "MCP session created" or "Created session" message
   ```

3. **Verify timing:**
   - Session creation should appear AFTER first tool call
   - NOT at server startup

**Expected Results:**
- ✅ Session created on first tool call
- ✅ Session ID logged
- ✅ No session creation at startup

---

## Test 3: Session Tracking Test

**Objective:** Verify session persisted in database

**Steps:**

1. **Query database for sessions:**
   ```bash
   docker exec supabase-ai-db psql -U postgres -d postgres -c "
   SELECT
     session_id,
     client_type,
     status,
     connected_at,
     last_activity_at
   FROM archon_mcp_sessions
   ORDER BY connected_at DESC
   LIMIT 5;
   "
   ```

2. **Verify session record:**
   - Check `session_id` exists
   - Verify `client_type` is correct (e.g., "Claude Code")
   - Confirm `status` is "active"

**Expected Results:**
- ✅ Session exists in database
- ✅ Status shows "active"
- ✅ Timestamps match first tool call time

---

## Test 4: Multiple Tool Calls Test

**Objective:** Verify all tool calls use same session

**Steps:**

1. **Make 3-5 different MCP tool calls:**
   ```bash
   # Via MCP client:
   # 1. health_check
   # 2. rag_search_knowledge_base(query="test")
   # 3. find_projects()
   # 4. find_tasks()
   # 5. health_check (again)
   ```

2. **Check session ID in logs:**
   ```bash
   docker logs archon-mcp --tail 200 | grep -E "session.*[0-9a-f-]{36}"
   # Look for session ID pattern (UUID)
   ```

3. **Query request tracking:**
   ```bash
   docker exec supabase-ai-db psql -U postgres -d postgres -c "
   SELECT
     session_id,
     COUNT(*) as request_count,
     MIN(created_at) as first_request,
     MAX(created_at) as last_request
   FROM archon_mcp_requests
   GROUP BY session_id
   ORDER BY first_request DESC
   LIMIT 5;
   "
   ```

**Expected Results:**
- ✅ All requests use same session_id
- ✅ No duplicate sessions
- ✅ Request count matches number of tool calls

---

## Test 5: Dashboard Verification

**Objective:** Verify session appears in dashboard UI

**Steps:**

1. **Open Archon Dashboard:**
   ```bash
   # In browser: http://localhost:3737
   ```

2. **Navigate to MCP section:**
   - Look for "MCP Sessions" or "Sessions" tab
   - Or check dashboard home for session stats

3. **Verify session info:**
   - Session ID displayed
   - Client type shown (e.g., "Claude Code")
   - Request history visible
   - Session created timestamp matches first tool call

**Expected Results:**
- ✅ Dashboard shows session info
- ✅ Request history displayed
- ✅ Session metadata correct

---

## Test 6: No HTTP 400 Errors

**Objective:** Verify no "Bad Request" errors from missing session

**Steps:**

1. **Make multiple MCP tool calls:**
   ```bash
   # Use various MCP tools:
   # - health_check
   # - rag_search_knowledge_base
   # - find_projects
   # - find_tasks
   # - manage_project (create)
   # - manage_task (create)
   ```

2. **Monitor for errors:**
   ```bash
   # Check for HTTP 400 errors
   docker logs archon-mcp --tail 200 | grep "400"
   # Expected: No output

   # Check for "Bad Request" errors
   docker logs archon-mcp --tail 200 | grep -i "bad request"
   # Expected: No output

   # Check for session-related errors
   docker logs archon-mcp --tail 200 | grep -i "no.*session"
   # Expected: No output
   ```

3. **Verify all tools functional:**
   - All MCP tools should work normally
   - No errors related to missing session IDs
   - Session tracking transparent to tool execution

**Expected Results:**
- ✅ Zero HTTP 400 errors
- ✅ No "Bad Request" errors
- ✅ No "missing session" errors
- ✅ All MCP tools functional

---

## Final Verification Checklist

After completing all tests:

- [ ] Test 1: ✅ Server startup without global session
- [ ] Test 2: ✅ First tool call creates session
- [ ] Test 3: ✅ Session tracked in database
- [ ] Test 4: ✅ Multiple calls use same session
- [ ] Test 5: ✅ Dashboard displays session info
- [ ] Test 6: ✅ No HTTP 400 errors

---

## If All Tests Pass

**Update task status:**
```bash
curl -X PUT http://localhost:8181/api/tasks/a05319c7-4960-4546-8fc9-f7773c82497b \
  -H "Content-Type: application/json" \
  -d '{"status": "review"}'
```

---

## If Any Test Fails

1. **Document the failure:**
   - Which test failed
   - Error messages
   - Log excerpts
   - Expected vs actual behavior

2. **Update task status to 'todo':**
   ```bash
   curl -X PUT http://localhost:8181/api/tasks/a05319c7-4960-4546-8fc9-f7773c82497b \
     -H "Content-Type: application/json" \
     -d '{
       "status": "todo",
       "description": "Test X failed: [describe failure]"
     }'
   ```

3. **Create bug report:**
   - File location: `/home/ljutzkanov/Documents/Projects/archon/docs/LAZY_SESSION_BUG_REPORT.md`
   - Include: Test number, failure description, logs, reproduction steps

---

## Troubleshooting

### Session Not Created

**Symptom:** No session in database after tool call

**Debug:**
```bash
# Check decorator is applied
docker exec archon-mcp grep -r "@track_tool_execution" /app/src/mcp_server/features/
# Should show decorator on all tool functions

# Check session manager logs
docker logs archon-mcp --tail 200 | grep -i "session manager"
```

### Multiple Sessions Created

**Symptom:** New session for each tool call

**Debug:**
```bash
# Check context preservation
docker logs archon-mcp --tail 200 | grep -i "context"

# Query all sessions
docker exec supabase-ai-db psql -U postgres -d postgres -c "
SELECT session_id, created_at FROM archon_mcp_sessions
ORDER BY created_at DESC LIMIT 10;
"
```

### HTTP 400 Errors

**Symptom:** "Bad Request: No valid session ID"

**Debug:**
```bash
# Check full error trace
docker logs archon-mcp --tail 500 | grep -B 5 -A 5 "400"

# Verify decorator logic
docker exec archon-mcp cat /app/src/server/services/mcp_session_manager.py | grep -A 20 "track_tool_execution"
```

---

**Document:** LAZY_SESSION_REMAINING_TESTS.md
**Created:** 2026-01-10
**Purpose:** Quick reference for completing tests 2-6
**Task ID:** a05319c7-4960-4546-8fc9-f7773c82497b
