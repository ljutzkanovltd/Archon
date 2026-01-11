# MCP Inspector Setup Guide

Official debugging tool for testing and inspecting MCP server functionality.

## Overview

**MCP Inspector** is the official debugging tool from the Model Context Protocol team. It provides:

- ✅ Interactive testing of MCP tools
- ✅ Real-time request/response inspection
- ✅ Session management debugging
- ✅ Schema validation
- ✅ Protocol compliance checking

**GitHub**: https://github.com/modelcontextprotocol/inspector
**Docs**: https://modelcontextprotocol.io/docs/tools/inspector

---

## Installation

### Option 1: NPX (Recommended - No Installation)

```bash
npx @modelcontextprotocol/inspector
```

This runs the latest version without installing anything.

### Option 2: Global Installation

```bash
npm install -g @modelcontextprotocol/inspector
```

Then run with:
```bash
mcp-inspector
```

### Option 3: Local Installation (Project-Specific)

```bash
cd /home/ljutzkanov/Documents/Projects/archon
npm install --save-dev @modelcontextprotocol/inspector
```

Add to `package.json` scripts:
```json
{
  "scripts": {
    "mcp:inspect": "mcp-inspector"
  }
}
```

Run with:
```bash
npm run mcp:inspect
```

---

## Quick Start

### Step 1: Start Archon MCP Server

```bash
cd /home/ljutzkanov/Documents/Projects/archon
./start-archon.sh

# Verify server is running
curl http://localhost:8051/health
```

### Step 2: Launch MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

The inspector will start and open in your browser at `http://localhost:5173` (or similar port).

### Step 3: Connect to Archon MCP Server

In the MCP Inspector UI:

1. **Server URL**: `http://localhost:8051/mcp`
2. **Protocol**: HTTP/SSE (Server-Sent Events)
3. Click **Connect**

### Step 4: Explore and Test

Once connected, you can:

- **View available tools**: See all MCP tools exposed by Archon
- **Test tool calls**: Execute tools with custom parameters
- **Inspect requests/responses**: View raw JSON-RPC messages
- **Monitor sessions**: Track session IDs and state

---

## Configuration

### Connecting to Archon

**Server Configuration:**
```json
{
  "url": "http://localhost:8051/mcp",
  "transport": "http",
  "name": "Archon MCP Server"
}
```

### Environment Variables

MCP Inspector respects these environment variables:

```bash
# Override default port
export MCP_INSPECTOR_PORT=5173

# Set log level
export MCP_INSPECTOR_LOG_LEVEL=debug

# Configure timeout
export MCP_INSPECTOR_TIMEOUT=30000
```

---

## Usage Examples

### Example 1: Test Health Check

1. Connect to `http://localhost:8051/mcp`
2. Navigate to **Tools** tab
3. Find `health_check` tool
4. Click **Execute**
5. View response in **Response** panel

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "archon-mcp",
  "timestamp": "2026-01-10T..."
}
```

---

### Example 2: Test Project Search

1. Navigate to **Tools** → `find_projects`
2. Set parameters:
   ```json
   {
     "query": "MCP"
   }
   ```
3. Click **Execute**
4. Inspect response with project list

---

### Example 3: Create and Track Task

**Step 1: Create Project**

Tool: `manage_project`
Parameters:
```json
{
  "action": "create",
  "title": "MCP Inspector Test Project",
  "description": "Created via MCP Inspector for testing"
}
```

Copy `project.id` from response.

**Step 2: Create Task**

Tool: `manage_task`
Parameters:
```json
{
  "action": "create",
  "project_id": "<project_id_from_step_1>",
  "title": "Test task from Inspector",
  "description": "Testing MCP Inspector workflow",
  "estimated_hours": 1.0,
  "assignee": "testing-expert"
}
```

**Step 3: List Tasks**

Tool: `find_tasks`
Parameters:
```json
{
  "project_id": "<project_id_from_step_1>"
}
```

Verify task appears in list.

---

### Example 4: Test Session Management

**Objective**: Verify session persistence across multiple tool calls

1. **First call**: `health_check` (note session ID in headers)
2. **Second call**: `find_projects` (should reuse same session)
3. **Third call**: `find_tasks` (should still use same session)

**How to verify**:
- Check **Request Headers** tab for `X-Archon-Session-Id`
- Session ID should be consistent across all three calls
- Check Archon logs: `docker logs archon-mcp`
- Verify database: Query `archon_mcp_sessions` table

---

### Example 5: Test Session Recovery

**Objective**: Verify session recovery after server restart

1. Make initial tool call (e.g., `health_check`)
2. Note session ID
3. Restart Archon: `docker restart archon-mcp`
4. Wait 10 seconds
5. Make another tool call
6. **Expected**: New session created, old session marked as disconnected

**Verification**:
```sql
-- Check sessions in database
SELECT session_id, status, disconnected_at, disconnect_reason
FROM archon_mcp_sessions
ORDER BY connected_at DESC
LIMIT 5;
```

---

## Debugging Workflows

### Debug Session Tracking

**Problem**: Sessions not being tracked in database

**Steps**:
1. Connect MCP Inspector to Archon
2. Make test tool call (e.g., `health_check`)
3. Check **Response Headers** for `X-Archon-Session-Id`
4. Query database:
   ```sql
   SELECT * FROM archon_mcp_sessions ORDER BY connected_at DESC LIMIT 1;
   SELECT * FROM archon_mcp_requests ORDER BY timestamp DESC LIMIT 5;
   ```
5. If no session: Check Archon logs for errors
6. If no requests: Verify `track_tool_execution` decorator is applied

---

### Debug Tool Call Failures

**Problem**: Tool calls failing with errors

**Steps**:
1. Execute failing tool in Inspector
2. Check **Response** panel for error message
3. View **Request** panel to verify parameters
4. Check **Network** tab for HTTP status code
5. Review Archon logs: `docker logs -f archon-mcp`
6. Verify tool exists: Use `list_tools` to see available tools

---

### Debug Session Expiration

**Problem**: Sessions expiring too quickly

**Steps**:
1. Create session with tool call
2. Wait configured timeout period (default: 1 hour)
3. Make another tool call
4. **Expected**: Warning about expired session, new session created
5. Check logs for session cleanup messages
6. Adjust timeout in `mcp_session_manager.py` if needed

---

## Integration with Archon Session Management

MCP Inspector works seamlessly with Archon's enhanced session management:

### Session Creation Flow

```
MCP Inspector → HTTP Request → Archon MCP Server
                                       ↓
                            track_tool_execution decorator
                                       ↓
                            get_or_create_session()
                                       ↓
                     Check client session ID (from headers)
                                       ↓
                     Validate or create new session
                                       ↓
                     Store in SimplifiedSessionManager
                                       ↓
                     Persist to archon_mcp_sessions table
                                       ↓
                     Return X-Archon-Session-Id header
                                       ↓
                     Track request in archon_mcp_requests
```

### Headers Used

**Request Headers:**
- `X-MCP-Session-Id`: FastMCP protocol session
- `X-Archon-Session-Id`: Client-provided Archon session (for session reuse)

**Response Headers:**
- `mcp-session-id`: FastMCP protocol session
- `X-Archon-Session-Id`: Archon analytics session

---

## Troubleshooting

### Inspector Can't Connect to Server

**Symptoms**: Connection timeout, "Server unreachable" error

**Solutions**:
1. Verify Archon is running: `docker ps | grep archon-mcp`
2. Check health endpoint: `curl http://localhost:8051/health`
3. Verify port 8051 is not blocked by firewall
4. Check Archon logs: `docker logs archon-mcp`
5. Try different URL format: `http://127.0.0.1:8051/mcp`

---

### "Invalid JSON-RPC request" Error

**Symptoms**: 400 Bad Request with JSON-RPC error

**Solutions**:
1. Verify request format matches MCP protocol spec
2. Check tool parameters match expected schema
3. Use `list_tools` to see expected parameter structure
4. Verify Content-Type header is `application/json`

---

### Session IDs Not Persisting

**Symptoms**: New session created on every request

**Solutions**:
1. Check if Inspector is sending `X-Archon-Session-Id` header
2. Verify session validation is working (check logs)
3. Ensure session timeout hasn't expired
4. Query database to verify sessions are being saved:
   ```sql
   SELECT session_id, status, last_activity
   FROM archon_mcp_sessions
   WHERE status = 'active'
   ORDER BY last_activity DESC;
   ```

---

### Tools Not Appearing in Inspector

**Symptoms**: Empty tools list or missing tools

**Solutions**:
1. Verify server is fully initialized
2. Check `list_tools` response manually:
   ```bash
   curl -X POST http://localhost:8051/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}'
   ```
3. Review Archon startup logs for tool registration
4. Restart Archon: `./stop-archon.sh && ./start-archon.sh`

---

## Best Practices

### ✅ DO

- Use Inspector for interactive testing during development
- Test session management flows thoroughly
- Verify all tools work before deploying
- Check both request and response headers
- Monitor database changes during testing
- Document any Inspector-discovered bugs

### ❌ DON'T

- Don't use Inspector in production (development tool only)
- Don't test with production data (use test projects/tasks)
- Don't ignore session validation warnings
- Don't skip cleanup of test data created via Inspector
- Don't rely solely on Inspector (also use automated tests)

---

## Automated Testing Script

For automated testing without manual Inspector interaction:

```bash
#!/bin/bash
# File: scripts/test-mcp-with-inspector.sh

echo "Testing Archon MCP with Inspector automation..."

# Start Inspector in background
npx @modelcontextprotocol/inspector &
INSPECTOR_PID=$!

# Wait for Inspector to start
sleep 5

# Run automated tests
python -m examples.mcp_client_usage

# Cleanup
kill $INSPECTOR_PID

echo "Tests complete!"
```

---

## Additional Resources

- **MCP Protocol Spec**: https://spec.modelcontextprotocol.io/
- **MCP Inspector GitHub**: https://github.com/modelcontextprotocol/inspector
- **Archon MCP Architecture**: `@.claude/docs/MCP_SESSION_ARCHITECTURE.md`
- **Session Management**: `@python/src/server/services/mcp_session_manager.py`
- **Client Wrapper**: `@python/src/mcp_server/utils/mcp_client_wrapper.py`

---

**Last Updated:** 2026-01-10
**Maintainer:** Archon Development Team
**Status:** Active Development
