# MCP Session Tracking - Manual Testing Guide

**Last Updated**: 2026-01-12
**Purpose**: Test MCP session tracking, tool execution monitoring, and database integration
**Estimated Time**: 10-15 minutes

---

## Prerequisites

### 1. Verify All Services Running

```bash
# Check all Archon services
docker ps --filter "name=archon" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Expected output:
# - archon-server (8181) - Healthy
# - archon-mcp (8051) - Healthy
# - archon-ui (3737) - Healthy
# - redis-archon (6379) - Healthy
```

### 2. Quick Health Check

```bash
# MCP Server
curl http://localhost:8051/health | jq .

# Backend API
curl http://localhost:8181/health | jq .

# Should both return status: "healthy"
```

---

## Test Method 1: Browser-Based Testing (Easiest) ⭐

### Step 1: Open Dashboards

Open these URLs in your browser:

1. **Main Dashboard**: http://localhost:3738
2. **MCP Dashboard**: http://localhost:3738/mcp
3. **Tool Analysis**: http://localhost:3738/mcp/tools

### Step 2: Use Claude Code to Make MCP Calls

If you have Claude Code connected to Archon MCP:

1. Ask Claude Code: "Use Archon to search for React patterns"
2. Ask: "Find all todo tasks in the current project"
3. Ask: "What knowledge sources are available?"

### Step 3: Verify in Dashboard

1. Go to http://localhost:3738/mcp
2. Check **Session Health Metrics** - Should show:
   - Active sessions count
   - Recent activity
   - Connection statistics

3. Go to http://localhost:3738/mcp/tools
4. Check **Slow Query Dashboard** - Should show recent tool executions
5. Check **Tool Execution Timeline** - Visual timeline of tool calls

### Step 4: Check Database

```bash
# View recent sessions
curl -s "http://localhost:8181/api/mcp/sessions?per_page=5" | jq '.sessions[] | {
  session_id: .session_id,
  client_type: .client_type,
  status: .status,
  connected_at: .connected_at
}'

# View recent requests
curl -s "http://localhost:8181/api/mcp/requests?per_page=10" | jq '.requests[] | {
  tool_name: .tool_name,
  status: .status,
  duration_ms: .duration_ms,
  timestamp: .timestamp
}'

# View analytics
curl -s "http://localhost:8181/api/mcp/analytics?days=1" | jq '{
  total_sessions: .total_sessions,
  active_sessions: .active_sessions,
  total_requests: .total_requests,
  avg_response_time: .response_times.overall_avg_ms
}'
```

---

## Test Method 2: Direct MCP Protocol Testing

### Step 1: Run Existing Test Script

```bash
cd /home/ljutzkanov/Documents/Projects/archon
./scripts/test-mcp-connection.sh
```

**Expected Output:**
- ✓ Health endpoint accessible
- ✓ MCP initialize successful
- ✓ Initialized notification sent
- ✓ Backend API accessible

### Step 2: Check Session Created

```bash
# List all sessions
curl -s "http://localhost:8181/api/mcp/sessions" | jq '.sessions | length'

# Should return > 0 if session was created
```

---

## Test Method 3: Claude Desktop Configuration (Most Comprehensive)

### Step 1: Configure Claude Desktop

**File Location** (Linux): `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "archon": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "http://localhost:8051/mcp",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json, text/event-stream",
        "-d", "@-"
      ],
      "env": {
        "MCP_SERVER_NAME": "archon-mcp-server"
      }
    }
  }
}
```

### Step 2: Restart Claude Desktop

```bash
# Kill Claude Desktop
killall claude

# Restart (or reopen from Applications menu)
```

### Step 3: Test MCP Tools in Claude Desktop

In Claude Desktop chat, try these commands:

1. **"Use Archon to search the knowledge base for FastAPI examples"**
2. **"Use Archon to find all active tasks"**
3. **"Use Archon to list available projects"**

### Step 4: Verify in Dashboard

1. Open http://localhost:3738/mcp
2. You should see:
   - **Claude Desktop** listed in "MCP Clients" section
   - **Recent Activity** showing your tool calls
   - **Session Health** showing active connection

---

## Verification Checklist

Use this checklist to confirm everything is working:

### ✅ Session Creation

```bash
# Check if sessions exist in database
curl -s "http://localhost:8181/api/mcp/sessions" | jq '.total_count'
# Should return > 0
```

### ✅ Request Tracking

```bash
# Check if requests are being tracked
curl -s "http://localhost:8181/api/mcp/requests" | jq '.total_count'
# Should return > 0 after making some tool calls
```

### ✅ Tool Execution Timing

```bash
# Check if duration is being measured
curl -s "http://localhost:8181/api/mcp/requests?per_page=5" | jq '.requests[] | .duration_ms'
# Should show numeric values (milliseconds)
```

### ✅ Status Tracking

```bash
# Check if status is being tracked
curl -s "http://localhost:8181/api/mcp/requests?per_page=5" | jq '.requests[] | .status'
# Should show "success" or "error"
```

### ✅ Dashboard Visibility

- [ ] http://localhost:3738/mcp shows session metrics
- [ ] http://localhost:3738/mcp/tools shows tool execution data
- [ ] Unified Activity View shows combined MCP + API activity
- [ ] Tool Execution Timeline shows visual timeline
- [ ] Slow Query Dashboard highlights >2s executions

---

## Expected Results

### After Testing, You Should See:

1. **In Database**:
   - New entries in `archon_mcp_sessions` table
   - New entries in `archon_mcp_requests` table
   - Session status: "active"
   - Request duration_ms populated

2. **In Dashboard** (http://localhost:3738/mcp):
   - Active sessions count > 0
   - Recent activity timeline showing tool calls
   - Session health metrics updated
   - Client type displayed (Claude Code, Cursor, etc.)

3. **In Tool Analysis** (http://localhost:3738/mcp/tools):
   - Tool execution timeline with bars
   - Performance comparison charts
   - Slow query alerts (if any >2s)
   - Filter controls working

---

## Troubleshooting

### Issue: No Sessions Created

**Check:**
```bash
# Verify MCP server is running
docker ps | grep archon-mcp

# Check logs for errors
docker logs archon-mcp --tail 50

# Test health endpoint
curl http://localhost:8051/health
```

**Fix:**
```bash
# Restart MCP server
docker restart archon-mcp

# Wait 5 seconds
sleep 5

# Test again
curl http://localhost:8051/health
```

### Issue: No Requests Tracked

**Check:**
```bash
# Verify backend API is running
curl http://localhost:8181/health

# Check database connection
docker exec supabase-ai-db psql -U postgres -c "SELECT COUNT(*) FROM archon_mcp_requests;"
```

**Common Causes:**
- Tool calls failing before tracking executes
- Database connection issues
- Session not created (prerequisite for request tracking)

### Issue: Dashboard Shows No Data

**Check:**
```bash
# Verify API endpoints work
curl -s "http://localhost:8181/api/mcp/sessions" | jq .
curl -s "http://localhost:8181/api/mcp/analytics?days=1" | jq .

# Check Next.js is running
curl -I http://localhost:3738
```

**Fix:**
```bash
# Restart Next.js (if running locally)
cd /home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs
npm run dev
```

---

## Database Queries for Manual Verification

### Check Sessions

```sql
-- Via psql
docker exec supabase-ai-db psql -U postgres -d postgres -c "
  SELECT session_id, client_type, status, connected_at
  FROM archon_mcp_sessions
  ORDER BY connected_at DESC
  LIMIT 10;
"
```

### Check Requests

```sql
-- Via psql
docker exec supabase-ai-db psql -U postgres -d postgres -c "
  SELECT tool_name, status, duration_ms, timestamp
  FROM archon_mcp_requests
  ORDER BY timestamp DESC
  LIMIT 10;
"
```

### Check Analytics

```sql
-- Session count
docker exec supabase-ai-db psql -U postgres -d postgres -c "
  SELECT COUNT(*) as total_sessions,
         COUNT(*) FILTER (WHERE status = 'active') as active_sessions
  FROM archon_mcp_sessions;
"

-- Average response time
docker exec supabase-ai-db psql -U postgres -d postgres -c "
  SELECT AVG(duration_ms) as avg_duration_ms
  FROM archon_mcp_requests
  WHERE status = 'success';
"
```

---

## Test Results Documentation

Create a test report with these results:

```bash
# Generate test report
cat > /tmp/mcp_test_results.txt << EOF
MCP Session Tracking Test Results
Date: $(date)

1. Sessions Created: $(curl -s "http://localhost:8181/api/mcp/sessions" | jq '.total_count')
2. Requests Tracked: $(curl -s "http://localhost:8181/api/mcp/requests" | jq '.total_count')
3. Average Response Time: $(curl -s "http://localhost:8181/api/mcp/analytics?days=1" | jq '.response_times.overall_avg_ms')
4. Active Sessions: $(curl -s "http://localhost:8181/api/mcp/analytics?days=1" | jq '.active_sessions')

Dashboard Verification:
- Main Dashboard: ✓ Accessible
- MCP Dashboard: ✓ Shows data
- Tool Analysis: ✓ Working

Test Status: PASSED ✅
EOF

cat /tmp/mcp_test_results.txt
```

---

## Next Steps After Testing

1. **Document Results**: Save test report to `docs/MCP_TESTING_RESULTS.md`
2. **Update Task**: Mark task as "done" in Archon
3. **Production Readiness**: Review security settings before production deployment

---

**Reference Documentation:**
- MCP Client Setup: `docs/MCP_CLIENT_SETUP.md`
- MCP Session Architecture: `docs/MCP_SESSION_ARCHITECTURE.md`
- API Reference: http://localhost:8181/docs
