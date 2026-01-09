# MCP Dashboard Investigation Report
**Date**: 2026-01-09
**Investigator**: Claude Code
**Issue**: MCP status dashboard shows no connected clients despite active usage

---

## Executive Summary

**Root Cause Identified**: The MCP status dashboard expects MCP protocol connections via Server-Sent Events (SSE), but the actual system usage happens through REST API endpoints. This architectural disconnect causes the dashboard to show 0 clients despite active task management.

**Impact**:
- ✅ **Task Management**: Working perfectly via REST API (port 8181)
- ❌ **MCP Dashboard**: Shows 0 clients (expects SSE connections to port 8051)
- ❌ **Session Tracking**: Not capturing client activity (no session creation hooks)
- ⚠️ **MCP Tools**: Claude Code/IDEs cannot connect (session validation failing)

---

## Investigation Findings

### 1. System Architecture Discovery

**Two Separate Communication Channels**:

```
┌─────────────────────────────────────────────────────────┐
│                    ARCHON SYSTEM                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  REST API (Port 8181)          MCP Server (Port 8051)   │
│  ├─ Task Management            ├─ SSE/Stdio Protocol    │
│  ├─ Project CRUD               ├─ Tool Calls            │
│  ├─ Document Management        ├─ RAG Search            │
│  ├─ RAG Queries                └─ Client Validation     │
│  └─ Health Checks                  ⚠️ No Sessions       │
│      ✅ WORKING                                          │
│                                                          │
│  Frontend Dashboard (Port 3737)                          │
│  └─ Polls REST API for data                             │
│      Shows: Tasks, Projects, Documents ✅                │
│      Missing: MCP clients ❌                             │
└─────────────────────────────────────────────────────────┘
```

### 2. Current Usage Pattern

**How the system is ACTUALLY being used**:
- ✅ Frontend Dashboard → REST API (8181) → PostgreSQL
- ✅ Direct API calls → Task/Project management → Database
- ✅ Manual task creation/updates → Working perfectly

**How the system is NOT being used**:
- ❌ IDE (Claude Code/Cursor) → MCP Server (8051) → Session tracking
- ❌ MCP protocol connections → Client metadata capture
- ❌ SSE streaming → Request/response tracking

### 3. Technical Deep Dive

#### 3.1 MCP Server Configuration

**File**: `python/src/mcp_server/mcp_server.py`

**Transport**: `streamable-http` (SSE-based)
```python
mcp.run(transport="streamable-http")
# Endpoint: http://0.0.0.0:8051/mcp
```

**Requirements for Valid Connection**:
```bash
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream  # ← REQUIRED FOR SSE
```

**Test Results**:
```bash
# ❌ Without SSE headers → 400 Bad Request
curl -X POST http://localhost:8051/mcp -H "Content-Type: application/json"
# Response: 400 Bad Request

# ✅ With SSE headers → 200 OK
curl -X POST http://localhost:8051/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",...}'
# Response: event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{...}}
```

#### 3.2 Session Manager Implementation

**File**: `python/src/server/services/mcp_session_manager.py`

**Status**: ✅ Fully implemented, ❌ Never called

**Key Methods**:
- `create_session(client_info)` → Creates session in `archon_mcp_sessions` table
- `track_request(...)` → Logs requests to `archon_mcp_requests` table
- Client detection for: Claude Code, Cursor, Windsurf, Cline, etc.

**Problem**: No integration with MCP server lifecycle!

```python
# Session manager is initialized...
session_manager = get_session_manager()  # Line 159 in mcp_server.py

# But NEVER called when clients connect!
# Missing: MCP notification handler or connection hook
```

**Database Evidence**:
```sql
SELECT COUNT(*) FROM archon_mcp_sessions;  -- Result: 0
SELECT COUNT(*) FROM archon_mcp_requests;  -- Result: 0
```

#### 3.3 MCP Dashboard Frontend

**File**: `archon-ui-nextjs/src/app/mcp-dashboard/page.tsx`

**Data Source**: Backend API (8181)
```typescript
const clientsQuery = useMcpClients();
// Fetches: GET http://localhost:8181/api/mcp/clients
// Returns: { clients: [], total: 0 }
```

**Dashboard Tabs**:
1. **Status** → Shows active sessions (Empty: 0 sessions)
2. **Analytics** → Shows request metrics (Empty: 0 requests)
3. **Logs** → Shows execution logs (Empty: 0 logs)

**Why Empty**: Dashboard expects data from MCP protocol sessions, not REST API usage.

### 4. Server Logs Analysis

**MCP Server Logs**:
```
2026-01-09 12:31:18 | mcp | INFO | 🔥 Logfire initialized for MCP server
2026-01-09 12:31:18 | mcp.server.streamable_http_manager | INFO | StreamableHTTP session manager started
...
INFO: 172.21.0.1:58622 - "POST /mcp HTTP/1.1" 400 Bad Request  ← Invalid requests
INFO: 172.21.0.1:13040 - "POST /mcp HTTP/1.1" 400 Bad Request
INFO: 172.21.0.1:60822 - "POST /mcp HTTP/1.1" 400 Bad Request
```

**Analysis**:
- ✅ MCP server is running and healthy
- ✅ Health checks working (GET /health → 200 OK)
- ❌ POST /mcp requests failing (missing SSE headers)
- ❌ No session creation logged

### 5. REST API Usage Evidence

**Active Tasks in Database**:
```bash
curl http://localhost:8181/api/tasks | jq '.tasks | length'
# Result: 100+ tasks

# Sample task:
{
  "id": "bb357fb5-d2fe-4f06-be86-d6c7799f790a",
  "project_id": "b6b89cf2-09e8-4a83-8f79-0b9a23ba525e",
  "title": "Fix Sidebar TypeError when iterating projects",
  "status": "done",
  "assignee": "User"
}
```

**Conclusion**: Task management is working perfectly through REST API, not MCP.

---

## Root Cause Analysis

### Primary Issue: Architectural Misunderstanding

**Expected Architecture** (What dashboard shows):
```
IDE → MCP (8051) → Session Manager → Database → Dashboard
```

**Actual Architecture** (How it's being used):
```
User/Frontend → REST API (8181) → Database → Dashboard
```

### Secondary Issue: Missing Session Creation Hook

**What Exists**:
- ✅ SimplifiedSessionManager class (345 lines)
- ✅ Database tables (archon_mcp_sessions, archon_mcp_requests)
- ✅ Client detection logic
- ✅ Token counting and cost estimation

**What's Missing**:
- ❌ MCP notification handler for client initialization
- ❌ Hook to call `session_manager.create_session()` on MCP connect
- ❌ Hook to call `session_manager.track_request()` on MCP tool calls

**Code Gap**:
```python
# CURRENT: Session manager initialized but never used
@asynccontextmanager
async def lifespan(server: FastMCP):
    session_manager = get_session_manager()  # ← Initialized
    # ... but no handlers registered

# NEEDED: Notification handler
@mcp.notification()  # ← Missing decorator
async def handle_client_initialized(params):
    session_manager.create_session(params["clientInfo"])
```

### Tertiary Issue: IDE MCP Client Configuration

**Claude Code MCP Error**:
```
Error POSTing to endpoint (HTTP 400): Bad Request: No valid session ID provided
```

**Cause**: Even when Claude Code tries to use MCP tools:
1. Client sends POST /mcp (likely without proper SSE headers)
2. Server returns 400 Bad Request
3. No session created
4. Subsequent tool calls fail validation

---

## Required Changes

### Phase 1: MCP Session Tracking (High Priority)

**Objective**: Capture MCP client connections and track requests properly

**Changes**:

1. **Add MCP Notification Handler** (`mcp_server.py`)
   ```python
   # Register notification handler for client initialization
   @mcp.notification("notifications/initialized")
   async def handle_initialized(ctx: Context, params: dict):
       """Track MCP client connection."""
       session_manager = get_session_manager()
       client_info = params.get("clientInfo", {})
       session_id = session_manager.create_session(client_info)
       logger.info(f"MCP client connected: {session_id}")
   ```

2. **Track Tool Execution** (`mcp_server.py`)
   ```python
   # Wrap all tool calls with request tracking
   async def track_tool_call(tool_name: str, ctx: Context, *args, **kwargs):
       start_time = time.time()
       session_manager = get_session_manager()

       try:
           result = await original_tool(*args, **kwargs)
           duration_ms = (time.time() - start_time) * 1000

           session_manager.track_request(
               session_id=ctx.session_id,  # Need to get from context
               method="tools/call",
               tool_name=tool_name,
               status="success",
               duration_ms=duration_ms
           )
           return result
       except Exception as e:
           session_manager.track_request(
               session_id=ctx.session_id,
               method="tools/call",
               tool_name=tool_name,
               status="error",
               error_message=str(e)
           )
           raise
   ```

3. **Store Session ID in Context**
   - Modify `ArchonContext` to include `session_id`
   - Pass session ID from initialization to tool calls

**Estimated Effort**: 4-6 hours

### Phase 2: Frontend Dashboard Updates (Medium Priority)

**Objective**: Show both MCP and REST API usage

**Changes**:

1. **Unified Activity Dashboard**
   ```
   ┌─────────────────────────────────────────┐
   │         ARCHON ACTIVITY OVERVIEW        │
   ├─────────────────────────────────────────┤
   │                                          │
   │  MCP Clients (IDE Connections)           │
   │  └─ Claude Code (Active)                 │
   │  └─ Cursor (Disconnected 2h ago)         │
   │                                          │
   │  API Usage (REST Endpoints)              │
   │  └─ Tasks: 1,234 operations today        │
   │  └─ Projects: 45 operations today        │
   │  └─ RAG Queries: 567 searches today      │
   │                                          │
   │  Recent Activity (Combined View)         │
   │  └─ 14:00 - Task updated via API         │
   │  └─ 13:55 - RAG search via MCP           │
   │  └─ 13:50 - Project created via API      │
   └─────────────────────────────────────────┘
   ```

2. **Separate MCP and API Tabs**
   - MCP Tab: Session timeline, tool calls, client metadata
   - API Tab: Endpoint usage, request logs, performance metrics

**Estimated Effort**: 6-8 hours

### Phase 3: IDE MCP Configuration (High Priority)

**Objective**: Enable Claude Code, Cursor, Windsurf to connect via MCP

**Changes**:

1. **Create MCP Configuration Guide** (`docs/MCP_CLIENT_SETUP.md`)
   ```markdown
   # MCP Client Configuration

   ## Claude Desktop

   File: `~/Library/Application Support/Claude/claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "archon": {
         "url": "http://localhost:8051/mcp",
         "transport": "sse"
       }
     }
   }
   ```

   ## Cursor

   File: `~/.cursor/mcp_servers.json`

   ```json
   {
     "archon": {
       "command": "curl",
       "args": [
         "-X", "POST",
         "-H", "Content-Type: application/json",
         "-H", "Accept: application/json, text/event-stream",
         "http://localhost:8051/mcp"
       ]
     }
   }
   ```
   ```

2. **Test MCP Connection**
   ```bash
   # Test script: scripts/test-mcp-connection.sh
   #!/bin/bash

   echo "Testing MCP connection..."

   curl -X POST http://localhost:8051/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{
       "jsonrpc":"2.0",
       "id":1,
       "method":"initialize",
       "params":{
         "protocolVersion":"2024-11-05",
         "capabilities":{},
         "clientInfo":{
           "name":"test-client",
           "version":"1.0.0"
         }
       }
     }'

   echo "\n\nChecking sessions..."
   docker exec supabase-ai-db psql -U postgres -d postgres \
     -c "SELECT session_id, client_type, status FROM archon_mcp_sessions;"
   ```

**Estimated Effort**: 2-4 hours

### Phase 4: Team Multi-User Support (Medium Priority)

**Objective**: Prepare for team usage with user-specific sessions

**Database Changes**:

1. **Add User Tracking to Sessions**
   ```sql
   ALTER TABLE archon_mcp_sessions
   ADD COLUMN user_id UUID REFERENCES auth.users(id),
   ADD COLUMN user_email TEXT,
   ADD COLUMN team_id UUID;

   CREATE INDEX idx_sessions_user ON archon_mcp_sessions(user_id);
   CREATE INDEX idx_sessions_team ON archon_mcp_sessions(team_id);
   ```

2. **User Authentication for MCP**
   - Implement JWT validation for MCP connections
   - Add user context to session creation
   - Track per-user activity and quotas

**Frontend Changes**:
   - User selector in dashboard
   - Per-user activity views
   - Team-level aggregated metrics

**Estimated Effort**: 12-16 hours

---

## Complete System Architecture (As-Is)

```
┌───────────────────────────────────────────────────────────────────┐
│                         ARCHON PLATFORM                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────┐          ┌──────────────────────┐            │
│  │  Frontend        │          │  Backend Services    │            │
│  │  (Port 3737)     │          │                      │            │
│  ├─────────────────┤          ├──────────────────────┤            │
│  │  - Dashboard     │─────────▶│  REST API (8181)     │            │
│  │  - Task View     │  Polls   │  ├─ Tasks CRUD       │            │
│  │  - MCP View      │          │  ├─ Projects CRUD    │            │
│  │  - RAG Search    │          │  ├─ Documents CRUD   │            │
│  └─────────────────┘          │  ├─ RAG Queries      │            │
│                                │  └─ Health Checks    │            │
│                                │                      │            │
│                                │  MCP Server (8051)   │            │
│                                │  ├─ SSE Transport    │            │
│                                │  ├─ Tool Handlers    │            │
│                                │  ├─ Session Manager  │ ← Not Used │
│                                │  └─ Request Tracker  │ ← Not Used │
│                                └──────────────────────┘            │
│                                         │                          │
│                                         ▼                          │
│                                ┌──────────────────┐                │
│                                │  Supabase DB     │                │
│                                │  (PostgreSQL)    │                │
│                                ├──────────────────┤                │
│                                │  - archon_tasks  │ ✅ 100+ rows   │
│                                │  - archon_projects│ ✅ Active     │
│                                │  - archon_mcp_   │ ❌ 0 rows      │
│                                │    sessions      │                │
│                                │  - archon_mcp_   │ ❌ 0 rows      │
│                                │    requests      │                │
│                                └──────────────────┘                │
│                                                                    │
│  ┌─────────────────────────────────────────────────┐              │
│  │  External Clients (Not Currently Connected)     │              │
│  ├─────────────────────────────────────────────────┤              │
│  │  ❌ Claude Code → MCP (8051)                     │              │
│  │  ❌ Cursor → MCP (8051)                          │              │
│  │  ❌ Windsurf → MCP (8051)                        │              │
│  └─────────────────────────────────────────────────┘              │
│                                                                    │
└───────────────────────────────────────────────────────────────────┘
```

---

## Immediate Action Items

### Priority 1: Enable MCP Dashboard (Today)

1. **Implement session creation hook** (2-3 hours)
   - Add MCP notification handler
   - Store session ID in context
   - Test with curl

2. **Verify dashboard populates** (1 hour)
   - Make test MCP connection
   - Check database for session
   - Refresh dashboard

### Priority 2: Document Current Usage (Today)

1. **Create architecture diagram** (1 hour)
   - Document REST API flow
   - Document MCP flow (intended)
   - Show current vs. intended usage

2. **Update CLAUDE.md** (30 minutes)
   - Add "How to Use Archon" section
   - Clarify MCP vs. REST API
   - Provide configuration examples

### Priority 3: IDE Configuration (Tomorrow)

1. **Test Claude Code MCP connection** (2 hours)
   - Configure claude_desktop_config.json
   - Test tool calls
   - Verify session tracking

2. **Document setup for team** (1 hour)
   - Create setup guide
   - Provide test scripts
   - Troubleshooting section

### Priority 4: Team Readiness (Next Week)

1. **User authentication design** (4 hours)
   - JWT integration
   - User context in sessions
   - Access control planning

2. **Multi-user dashboard** (8 hours)
   - User selector
   - Per-user views
   - Team metrics

---

## Testing Checklist

### Phase 1: Session Tracking

- [ ] MCP server starts without errors
- [ ] Session created on client connect
- [ ] Session ID stored in context
- [ ] Requests tracked in database
- [ ] Dashboard shows active session
- [ ] Session timeout works
- [ ] Multiple concurrent sessions

### Phase 2: IDE Integration

- [ ] Claude Code connects successfully
- [ ] Tools execute and track requests
- [ ] Token counting works
- [ ] Cost estimation accurate
- [ ] Error tracking functional
- [ ] Cursor connects successfully
- [ ] Windsurf connects successfully

### Phase 3: Team Features

- [ ] User authentication works
- [ ] Per-user session tracking
- [ ] User dashboard filtering
- [ ] Team metrics aggregation
- [ ] Access control enforced

---

## Recommendations

### Short-term (This Week)

1. **Fix Session Tracking**: Implement MCP notification handler
2. **Update Documentation**: Clarify current vs. intended usage
3. **Test IDE Connection**: Verify Claude Code can connect via MCP

### Medium-term (Next 2 Weeks)

1. **Unified Dashboard**: Show both MCP and REST API activity
2. **Configuration Guide**: Document IDE setup for team
3. **User Context**: Add basic user tracking to sessions

### Long-term (Next Month)

1. **Multi-User Support**: Full user authentication and authorization
2. **Team Dashboard**: Aggregate metrics across team members
3. **Usage Analytics**: Track team productivity and tool usage

---

## Appendix A: Key Files

### Backend
- `python/src/mcp_server/mcp_server.py` (630 lines) - Main MCP server
- `python/src/server/services/mcp_session_manager.py` (345 lines) - Session tracking
- `python/src/server/api_routes/mcp_api.py` - MCP API endpoints

### Frontend
- `archon-ui-nextjs/src/app/mcp-dashboard/page.tsx` - Dashboard
- `archon-ui-nextjs/src/components/MCP/McpClientsStatus.tsx` - Client list
- `archon-ui-nextjs/src/hooks/useMcpQueries.ts` - Data fetching

### Database
- `migration/0.2.0/001_create_mcp_sessions_requests.sql` - Tables
- Tables: `archon_mcp_sessions`, `archon_mcp_requests`

---

## Appendix B: Test Commands

### Check MCP Server
```bash
curl http://localhost:8051/health
```

### Test MCP Connection (Valid)
```bash
curl -X POST http://localhost:8051/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}'
```

### Check Database Sessions
```bash
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT session_id, client_type, status, connected_at FROM archon_mcp_sessions ORDER BY connected_at DESC LIMIT 10;"
```

### Check Backend API
```bash
curl http://localhost:8181/api/health
curl http://localhost:8181/api/mcp/clients
curl http://localhost:8181/api/tasks | jq '.tasks | length'
```

---

**Report Generated**: 2026-01-09 14:00 UTC
**Next Review**: After Phase 1 implementation
**Contact**: See CLAUDE.md for escalation
