# MCP Session Tracking - Implementation Tasks
**Project**: Archon MCP Dashboard Enhancement
**Project ID**: `52ccc5f6-c416-4965-ac91-fbd7339aa9ff`
**Created**: 2026-01-09
**Status**: Planning Complete ✅

---

## Overview

This document contains the complete task breakdown for implementing MCP session tracking in Archon. These tasks will enable the MCP dashboard to show connected clients, track tool usage, and prepare the system for multi-user team usage.

**Total Estimated Time**: 22.5 hours (spread across 9 tasks)
**Priority Tasks**: 6 high, 2 medium, 1 low
**Agents Assigned**: 5 specialized agents

---

## Task Dependencies

```
Planning Task (done) ✅
    ↓
[1] MCP Notification Handler → [2] Session Context Storage
    ↓                               ↓
[3] Tool Execution Tracking ← ←  ← ←
    ↓
[4] Session Cleanup
    ↓
[5] Client Configuration Guide → [6] Testing with Claude Desktop
                                      ↓
                                 [7] Dashboard Updates
                                      ↓
                                 [8] Multi-User Prep
                                      ↓
                                 [9] Architecture Docs
```

---

## Task 1: Add MCP Notification Handler for Client Initialization
**Priority**: ⚠️ HIGH
**Assignee**: backend-api-expert
**Estimated**: 2.5 hours
**Feature**: MCP Session Tracking
**Status**: todo

### Description
Implement `@mcp.notification('notifications/initialized')` handler in `mcp_server.py` to capture MCP client connections.

### Implementation Details

**File**: `python/src/mcp_server/mcp_server.py`

**Add after line 590 (after http_health_endpoint)**:
```python
@mcp.notification("notifications/initialized")
async def handle_client_initialized(ctx: Context, params: dict) -> None:
    """
    Handle MCP client initialization notification.
    Creates session in database and stores session_id in context.
    """
    try:
        session_manager = get_session_manager()
        client_info = params.get("clientInfo", {})

        # Create session in database
        session_id = session_manager.create_session(client_info)

        # Store session ID in context for tool calls
        if hasattr(ctx, "request_context") and hasattr(ctx.request_context, "lifespan_context"):
            context = ctx.request_context.lifespan_context
            context.session_id = session_id
            logger.info(f"✓ MCP client connected - session: {session_id}, client: {client_info.get('name', 'unknown')}")
        else:
            logger.warning(f"Could not store session_id in context for session {session_id}")

    except Exception as e:
        logger.error(f"Failed to handle client initialization: {e}")
        logger.error(traceback.format_exc())


@mcp.notification("notifications/cancelled")
async def handle_client_cancelled(ctx: Context) -> None:
    """
    Handle MCP client cancellation/disconnect notification.
    Marks session as disconnected in database.
    """
    try:
        if hasattr(ctx, "request_context") and hasattr(ctx.request_context, "lifespan_context"):
            context = ctx.request_context.lifespan_context
            if hasattr(context, "session_id") and context.session_id:
                session_manager = get_session_manager()
                # This will be implemented in Task 4
                # session_manager.close_session(context.session_id)
                logger.info(f"✓ MCP client disconnected - session: {context.session_id}")
    except Exception as e:
        logger.error(f"Failed to handle client cancellation: {e}")
```

### Acceptance Criteria
- [ ] Handler registered for `notifications/initialized`
- [ ] Session created in `archon_mcp_sessions` table on client connect
- [ ] Session ID stored in context
- [ ] Client detection works (Claude Code, Cursor, Windsurf, etc.)
- [ ] Logs show client connection with session ID
- [ ] No errors on startup or connection

### Testing
```bash
# 1. Restart MCP server
docker restart archon-mcp

# 2. Check logs for handler registration
docker logs archon-mcp 2>&1 | grep "notification"

# 3. Test connection with proper headers
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
      "clientInfo":{"name":"test-client","version":"1.0.0"}
    }
  }'

# 4. Check database for session
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT session_id, client_type, status, connected_at FROM archon_mcp_sessions ORDER BY connected_at DESC LIMIT 1;"
```

---

## Task 2: Extend ArchonContext to Store Session ID
**Priority**: ⚠️ HIGH
**Assignee**: backend-api-expert
**Estimated**: 1.5 hours
**Feature**: MCP Session Tracking
**Status**: todo
**Depends On**: Task 1

### Description
Modify `ArchonContext` dataclass to include `session_id` field, ensuring session persistence across tool calls.

### Implementation Details

**File**: `python/src/mcp_server/mcp_server.py` (lines 84-104)

**Current Code**:
```python
@dataclass
class ArchonContext:
    """
    Context for MCP server.
    No heavy dependencies - just service client for HTTP calls.
    """

    service_client: Any
    health_status: dict = None
    startup_time: float = None

    def __post_init__(self):
        if self.health_status is None:
            self.health_status = {
                "status": "healthy",
                "api_service": False,
                "agents_service": False,
                "last_health_check": None,
            }
        if self.startup_time is None:
            self.startup_time = time.time()
```

**Updated Code**:
```python
@dataclass
class ArchonContext:
    """
    Context for MCP server with session tracking.
    No heavy dependencies - just service client for HTTP calls.
    """

    service_client: Any
    session_id: Optional[str] = None  # ← ADD THIS
    health_status: dict = None
    startup_time: float = None

    def __post_init__(self):
        if self.health_status is None:
            self.health_status = {
                "status": "healthy",
                "api_service": False,
                "agents_service": False,
                "last_health_check": None,
            }
        if self.startup_time is None:
            self.startup_time = time.time()
```

**Also add import at top**:
```python
from typing import Any, Optional  # Add Optional
```

### Acceptance Criteria
- [ ] ArchonContext has `session_id: Optional[str]` field
- [ ] Field defaults to None
- [ ] Session ID persists across multiple tool calls
- [ ] No breaking changes to existing code
- [ ] Type hints are correct

### Testing
```bash
# 1. Restart server
docker restart archon-mcp

# 2. Check for startup errors
docker logs archon-mcp 2>&1 | tail -20

# 3. Verify context structure in tools
# (Will be validated in Task 3 when tools use session_id)
```

---

## Task 3: Implement Tool Execution Tracking Wrapper
**Priority**: ⚠️ HIGH
**Assignee**: backend-api-expert
**Estimated**: 3.5 hours
**Feature**: MCP Session Tracking
**Status**: todo
**Depends On**: Task 1, Task 2

### Description
Create async decorator/wrapper to intercept all `@mcp.tool()` calls and track execution in database.

### Implementation Details

**File**: `python/src/mcp_server/mcp_server.py`

**Add before tool definitions (around line 335)**:
```python
def track_tool_execution(func):
    """
    Decorator to track MCP tool execution in database.
    Captures timing, status, errors, and session context.
    """
    @functools.wraps(func)
    async def wrapper(ctx: Context, *args, **kwargs):
        start_time = time.time()
        tool_name = func.__name__
        session_id = None
        status = "success"
        error_message = None

        try:
            # Get session ID from context
            if hasattr(ctx, "request_context") and hasattr(ctx.request_context, "lifespan_context"):
                context = ctx.request_context.lifespan_context
                session_id = getattr(context, "session_id", None)

            # Execute the actual tool
            result = await func(ctx, *args, **kwargs)

            return result

        except Exception as e:
            status = "error"
            error_message = str(e)
            logger.error(f"Tool {tool_name} failed: {e}")
            raise

        finally:
            # Track request in database
            duration_ms = (time.time() - start_time) * 1000

            try:
                session_manager = get_session_manager()
                session_manager.track_request(
                    session_id=session_id or "unknown",
                    method="tools/call",
                    tool_name=tool_name,
                    status=status,
                    duration_ms=duration_ms,
                    error_message=error_message
                )
            except Exception as track_error:
                logger.error(f"Failed to track tool execution: {track_error}")

    return wrapper


# Import functools at top
import functools
```

**Apply to all tools** (example for `health_check`):
```python
@mcp.tool()
@track_tool_execution  # ← ADD THIS
async def health_check(ctx: Context) -> str:
    """
    Check health status of MCP server and dependencies.
    ...
    """
    # existing code
```

**Apply to ALL 14 tools**:
1. `health_check`
2. `rag_get_available_sources`
3. `rag_search_knowledge_base`
4. `rag_search_code_examples`
5. `rag_list_pages_for_source`
6. `rag_read_full_page`
7. `find_projects`
8. `manage_project`
9. `find_tasks`
10. `manage_task`
11. `get_task_history`
12. `get_completion_stats`
13. `find_documents`
14. `manage_document`

### Acceptance Criteria
- [ ] Decorator created and working
- [ ] All 14 tools wrapped with `@track_tool_execution`
- [ ] Requests logged to `archon_mcp_requests` table
- [ ] Duration calculated correctly (milliseconds)
- [ ] Errors captured with error_message
- [ ] Session ID linked to requests
- [ ] No impact on tool functionality

### Testing
```bash
# 1. Test tool call
curl -X POST http://localhost:8051/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"health_check",
      "arguments":{}
    }
  }'

# 2. Check database for request
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT session_id, tool_name, status, duration_ms, timestamp FROM archon_mcp_requests ORDER BY timestamp DESC LIMIT 5;"

# 3. Test error handling
# (Call a tool with invalid params, check error_message field)
```

---

## Task 4: Add Session Cleanup on Client Disconnect
**Priority**: MEDIUM
**Assignee**: backend-api-expert
**Estimated**: 2.0 hours
**Feature**: MCP Session Tracking
**Status**: todo
**Depends On**: Task 1

### Description
Implement disconnect notification handler and session cleanup logic.

### Implementation Details

**File**: `python/src/server/services/mcp_session_manager.py`

**Add method to SimplifiedSessionManager class (around line 250)**:
```python
def close_session(self, session_id: str, reason: str = "disconnect") -> None:
    """
    Mark session as disconnected and calculate total duration.

    Args:
        session_id: Session UUID to close
        reason: disconnect | timeout | error
    """
    if not self.use_database or not self._db_client:
        return

    try:
        # Remove from in-memory cache
        if session_id in self.sessions:
            del self.sessions[session_id]

        # Calculate total duration
        from datetime import datetime
        now = datetime.now()

        # Update database
        self._db_client.table("archon_mcp_sessions").update({
            "status": "disconnected",
            "disconnected_at": now.isoformat(),
            "disconnect_reason": reason,
            "last_activity": now.isoformat()
        }).eq("session_id", session_id).execute()

        logger.info(f"Session {session_id} closed: {reason}")

    except Exception as e:
        logger.error(f"Failed to close session {session_id}: {e}")
```

**File**: `python/src/mcp_server/mcp_server.py`

**Update the `handle_client_cancelled` notification (from Task 1)**:
```python
@mcp.notification("notifications/cancelled")
async def handle_client_cancelled(ctx: Context) -> None:
    """
    Handle MCP client cancellation/disconnect notification.
    Marks session as disconnected in database.
    """
    try:
        if hasattr(ctx, "request_context") and hasattr(ctx.request_context, "lifespan_context"):
            context = ctx.request_context.lifespan_context
            if hasattr(context, "session_id") and context.session_id:
                session_manager = get_session_manager()
                session_manager.close_session(context.session_id, reason="disconnect")
                logger.info(f"✓ MCP client disconnected - session: {context.session_id}")
    except Exception as e:
        logger.error(f"Failed to handle client cancellation: {e}")
```

### Acceptance Criteria
- [ ] `close_session()` method implemented
- [ ] Sessions marked as "disconnected" on client exit
- [ ] Total duration calculated
- [ ] In-memory cache cleaned up
- [ ] Works for both graceful and abrupt disconnects

### Testing
```bash
# 1. Connect client and get session ID
# 2. Close connection gracefully
# 3. Check database
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT session_id, status, disconnect_reason, disconnected_at FROM archon_mcp_sessions WHERE status='disconnected' ORDER BY disconnected_at DESC LIMIT 1;"
```

---

## Task 5: Create MCP Client Configuration Guide for IDEs
**Priority**: ⚠️ HIGH
**Assignee**: documentation-expert
**Estimated**: 2.0 hours
**Feature**: IDE Integration
**Status**: todo
**Depends On**: None (can start immediately)

### Description
Create comprehensive guide for configuring Claude Desktop, Cursor, Windsurf, and Cline to connect to Archon MCP server.

### Deliverables

**File**: `docs/MCP_CLIENT_SETUP.md`

**Required Sections**:
1. **Prerequisites** - MCP server running, ports accessible
2. **Claude Desktop** - `claude_desktop_config.json` setup
3. **Cursor** - MCP configuration
4. **Windsurf** - Connection settings
5. **Cline** - Server configuration
6. **Testing Connection** - How to verify it works
7. **Troubleshooting** - Common issues (400 errors, connection refused, etc.)

**File**: `scripts/test-mcp-connection.sh`

```bash
#!/bin/bash
# Test MCP Server Connection
# Usage: ./scripts/test-mcp-connection.sh

echo "======================================"
echo "  Archon MCP Connection Test"
echo "======================================"
echo ""

# 1. Test MCP server health
echo "1. Testing MCP server health..."
curl -s http://localhost:8051/health | jq .

echo ""
echo "2. Testing MCP initialize with SSE headers..."
curl -s -X POST http://localhost:8051/mcp \
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
  }' | grep -A 10 "event: message"

echo ""
echo "3. Checking database for session..."
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT session_id, client_type, status, connected_at FROM archon_mcp_sessions ORDER BY connected_at DESC LIMIT 1;"

echo ""
echo "======================================"
echo "  Test Complete"
echo "======================================"
```

### Acceptance Criteria
- [ ] Documentation covers all 4 IDEs
- [ ] Test script works and validates connection
- [ ] Troubleshooting section addresses 400 errors
- [ ] Examples include proper SSE headers
- [ ] Screenshots/examples for IDE configurations

---

## Task 6: Test MCP Session Tracking with Claude Desktop
**Priority**: ⚠️ HIGH
**Assignee**: testing-expert
**Estimated**: 3.0 hours
**Feature**: Testing & Validation
**Status**: todo
**Depends On**: Task 1, Task 2, Task 3, Task 5

### Description
End-to-end testing of MCP session tracking with Claude Desktop as the client.

### Test Plan

**File**: `docs/MCP_TESTING_RESULTS.md`

**Test Cases**:

1. **Connection Test**
   - [ ] Claude Desktop connects successfully
   - [ ] Session created in database
   - [ ] Client type detected correctly
   - [ ] Dashboard shows active client

2. **Tool Execution Test**
   - [ ] Call `health_check` - request logged
   - [ ] Call `rag_search_knowledge_base` - request logged
   - [ ] Call `find_tasks` - request logged
   - [ ] All 3 requests linked to session

3. **Token Counting**
   - [ ] Prompt tokens counted
   - [ ] Completion tokens counted
   - [ ] Total tokens accurate

4. **Cost Estimation**
   - [ ] Cost calculated per request
   - [ ] Model pricing applied correctly
   - [ ] Total cost displayed in dashboard

5. **Error Handling**
   - [ ] Invalid tool params - error logged
   - [ ] Missing required param - error captured
   - [ ] Error message stored correctly

6. **Session Lifecycle**
   - [ ] Disconnect detected
   - [ ] Session marked disconnected
   - [ ] Total duration calculated
   - [ ] Dashboard updates status

### Acceptance Criteria
- [ ] All 6 test categories pass
- [ ] Results documented with screenshots
- [ ] Issues logged for any failures
- [ ] Performance metrics captured

---

## Task 7: Update MCP Dashboard to Show Both API and MCP Activity
**Priority**: MEDIUM
**Assignee**: ui-implementation-expert
**Estimated**: 4.0 hours
**Feature**: Frontend Dashboard
**Status**: todo
**Depends On**: Task 6 (preferably, for testing)

### Description
Modify MCP dashboard to display unified view of both MCP protocol activity and REST API usage.

### Implementation Details

**File**: `archon-ui-nextjs/src/app/mcp-dashboard/page.tsx`

**New Layout**:
```
┌─────────────────────────────────────────┐
│         ARCHON ACTIVITY OVERVIEW        │
├─────────────────────────────────────────┤
│                                          │
│  [MCP Clients Tab] [API Usage Tab]      │
│                                          │
│  === MCP CLIENTS ===                     │
│  🟢 Claude Code (Active - 2h 15m)        │
│  🟡 Cursor (Idle - Last: 30m ago)        │
│  🔴 Windsurf (Disconnected - 2h ago)     │
│                                          │
│  === RECENT ACTIVITY ===                 │
│  14:00 - Task updated (REST API)         │
│  13:55 - RAG search (MCP - Claude Code)  │
│  13:50 - Project created (REST API)      │
│                                          │
│  [View MCP Details] [View API Stats]     │
└─────────────────────────────────────────┘
```

**New Component**: `src/components/MCP/ActivityTimeline.tsx`
- Combined timeline of MCP and API events
- Filterable by source (MCP/API)
- Color-coded by activity type

**Modified Component**: `src/app/mcp-dashboard/page.tsx`
- Add tab switcher
- Integrate ActivityTimeline
- Fetch both MCP and API usage data

### Acceptance Criteria
- [ ] Dashboard shows both MCP and API activity
- [ ] Tabs work for switching views
- [ ] ActivityTimeline displays recent events
- [ ] Real-time updates via polling
- [ ] Responsive design maintained

---

## Task 8: Add User Context to MCP Sessions (Multi-User Prep)
**Priority**: LOW
**Assignee**: database-expert
**Estimated**: 2.5 hours
**Feature**: Multi-User Support
**Status**: todo
**Depends On**: None (can start anytime)

### Description
Extend database schema to support per-user session tracking in preparation for multi-user team usage.

### Implementation Details

**File**: `migration/0.3.0/004_add_user_context_to_sessions.sql`

```sql
-- Add user tracking columns to MCP sessions
ALTER TABLE archon_mcp_sessions
  ADD COLUMN user_id UUID REFERENCES auth.users(id),
  ADD COLUMN user_email TEXT,
  ADD COLUMN team_id UUID,
  ADD COLUMN user_role TEXT; -- admin, member, viewer

-- Create indexes for user queries
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_user_id
  ON archon_mcp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_team_id
  ON archon_mcp_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_user_email
  ON archon_mcp_sessions(user_email);

-- Create view for team activity
CREATE OR REPLACE VIEW archon_team_mcp_activity AS
SELECT
  s.team_id,
  s.user_email,
  COUNT(DISTINCT s.session_id) as total_sessions,
  COUNT(r.request_id) as total_requests,
  SUM(r.total_tokens) as total_tokens,
  SUM(r.estimated_cost) as total_cost,
  MIN(s.connected_at) as first_connection,
  MAX(s.last_activity) as last_activity
FROM archon_mcp_sessions s
LEFT JOIN archon_mcp_requests r ON s.session_id = r.session_id
WHERE s.team_id IS NOT NULL
GROUP BY s.team_id, s.user_email;

-- Register migration
INSERT INTO archon_migrations (version, name, applied_at)
VALUES ('0.3.0', '004_add_user_context_to_sessions', NOW());
```

**File**: `python/src/server/services/mcp_session_manager.py`

**Update `create_session` signature**:
```python
def create_session(
    self,
    client_info: Optional[dict[str, Any]] = None,
    user_info: Optional[dict[str, Any]] = None  # ← ADD THIS
) -> str:
    """
    Create a new session and return its ID.

    Args:
        client_info: Client metadata (name, version, capabilities)
        user_info: User metadata (user_id, email, team_id, role)
    """
    session_id = str(uuid.uuid4())
    now = datetime.now()
    self.sessions[session_id] = now

    # Extract client type
    client_type = "Unknown"
    if client_info:
        client_type = self._detect_client_type(client_info.get("name", "Unknown"))

    # Build session data
    session_data = {
        "session_id": session_id,
        "client_type": client_type,
        "client_version": client_info.get("version") if client_info else None,
        "client_capabilities": client_info.get("capabilities") if client_info else None,
        "connected_at": now.isoformat(),
        "last_activity": now.isoformat(),
        "status": "active",
        "metadata": client_info or {}
    }

    # Add user context if provided
    if user_info:
        session_data.update({
            "user_id": user_info.get("user_id"),
            "user_email": user_info.get("email"),
            "team_id": user_info.get("team_id"),
            "user_role": user_info.get("role", "member")
        })

    # Persist to database
    if self.use_database and self._db_client:
        try:
            self._db_client.table("archon_mcp_sessions").insert(session_data).execute()
            logger.info(f"Created session {session_id} with client {client_type}")
        except Exception as e:
            logger.error(f"Failed to persist session: {e}")

    return session_id
```

### Acceptance Criteria
- [ ] Migration runs successfully
- [ ] Columns added to `archon_mcp_sessions`
- [ ] Indexes created
- [ ] Team activity view works
- [ ] `create_session()` accepts user_info
- [ ] Backward compatible (user_info optional)

---

## Task 9: Create Comprehensive System Architecture Documentation
**Priority**: MEDIUM
**Assignee**: documentation-expert
**Estimated**: 3.0 hours
**Feature**: Documentation
**Status**: todo
**Depends On**: All previous tasks (for complete picture)

### Description
Document complete Archon system architecture including REST API flow, MCP flow, network topology, and deployment scenarios.

### Deliverables

**File**: `docs/ARCHON_ARCHITECTURE.md`

**Required Sections**:

1. **System Overview**
   - High-level component diagram
   - Service inventory (ports, purposes)
   - Data flow overview

2. **REST API Architecture**
   - Next.js UI (3738) → Backend (8181) → Database
   - React UI (3737) → Backend (8181) → Database
   - Proxy configuration
   - Endpoint categories

3. **MCP Architecture**
   - IDE → MCP Server (8051) → Session Manager → Database
   - SSE transport requirements
   - Session lifecycle
   - Tool execution flow

4. **Network Topology**
   - Docker networks (`localai_default`, `sporterp-ai-unified`, `app-network`)
   - Container communication
   - Port mappings
   - Hybrid vs Docker mode

5. **Database Schema**
   - Core tables (projects, tasks, documents)
   - MCP tables (sessions, requests)
   - Relationships and indexes
   - Migration history

6. **Deployment Scenarios**
   - Full Docker mode
   - Hybrid mode (Docker backend + local Next.js)
   - All local mode
   - Production considerations

7. **Current vs Intended Usage**
   - What's working now (REST API)
   - What's being enabled (MCP protocol)
   - Integration points
   - Future enhancements

**File**: `.claude/CLAUDE.md` (Update)

**Add new section: "How to Use Archon"**
```markdown
## How to Use Archon

### Via Web Dashboard
- Next.js UI: http://localhost:3738
- React UI: http://localhost:3737
- Direct API: http://localhost:8181/api

### Via MCP (IDEs)
- Claude Desktop: See docs/MCP_CLIENT_SETUP.md
- Cursor: See docs/MCP_CLIENT_SETUP.md
- Windsurf: See docs/MCP_CLIENT_SETUP.md

### Architecture
See docs/ARCHON_ARCHITECTURE.md for complete system architecture.
```

### Acceptance Criteria
- [ ] All sections complete with diagrams
- [ ] Mermaid diagrams for flows
- [ ] Screenshots of dashboards
- [ ] Examples for each usage pattern
- [ ] Deployment guides
- [ ] Updated CLAUDE.md

---

## Summary

### Task Breakdown by Agent

| Agent | Tasks | Hours |
|-------|-------|-------|
| **backend-api-expert** | 4 tasks | 9.5 hours |
| **documentation-expert** | 2 tasks | 5.0 hours |
| **testing-expert** | 1 task | 3.0 hours |
| **ui-implementation-expert** | 1 task | 4.0 hours |
| **database-expert** | 1 task | 2.5 hours |
| **Total** | **9 tasks** | **24.0 hours** |

### Task Breakdown by Priority

| Priority | Tasks | Hours |
|----------|-------|-------|
| HIGH | 6 tasks | 15.5 hours |
| MEDIUM | 2 tasks | 7.0 hours |
| LOW | 1 task | 2.5 hours |

### Task Breakdown by Feature

| Feature | Tasks | Hours |
|---------|-------|-------|
| MCP Session Tracking | 4 tasks | 9.5 hours |
| IDE Integration | 1 task | 2.0 hours |
| Testing & Validation | 1 task | 3.0 hours |
| Frontend Dashboard | 1 task | 4.0 hours |
| Multi-User Support | 1 task | 2.5 hours |
| Documentation | 1 task | 3.0 hours |

### Execution Order (Recommended)

**Phase 1: Core Session Tracking** (Days 1-2)
1. Task 1: MCP Notification Handler (2.5h)
2. Task 2: Session Context Storage (1.5h)
3. Task 3: Tool Execution Tracking (3.5h)
4. Task 4: Session Cleanup (2.0h)

**Phase 2: IDE Integration & Testing** (Days 3-4)
5. Task 5: Client Configuration Guide (2.0h)
6. Task 6: Testing with Claude Desktop (3.0h)

**Phase 3: UI & Future-Proofing** (Days 5-6)
7. Task 7: Dashboard Updates (4.0h)
8. Task 8: Multi-User Prep (2.5h)
9. Task 9: Architecture Docs (3.0h)

---

## How to Create These Tasks

### Option A: REST API (Recommended)

Use the following script to create all tasks:

```bash
#!/bin/bash
# create-mcp-tasks.sh

PROJECT_ID="52ccc5f6-c416-4965-ac91-fbd7339aa9ff"

# Task 1
curl -X POST http://localhost:8181/api/tasks -H "Content-Type: application/json" -d '{
  "project_id": "'$PROJECT_ID'",
  "title": "Add MCP Notification Handler for Client Initialization",
  "description": "Implement @mcp.notification handler in mcp_server.py",
  "assignee": "backend-api-expert",
  "estimated_hours": 2.5,
  "priority": "high",
  "task_order": 110,
  "feature": "MCP Session Tracking",
  "status": "todo"
}'

# Task 2
curl -X POST http://localhost:8181/api/tasks -H "Content-Type: application/json" -d '{
  "project_id": "'$PROJECT_ID'",
  "title": "Extend ArchonContext to Store Session ID",
  "description": "Modify ArchonContext dataclass to include session_id field",
  "assignee": "backend-api-expert",
  "estimated_hours": 1.5,
  "priority": "high",
  "task_order": 111,
  "feature": "MCP Session Tracking",
  "status": "todo"
}'

# ... (continue for all 9 tasks)
```

### Option B: Manual Entry via Dashboard

1. Open: http://localhost:3738/projects/52ccc5f6-c416-4965-ac91-fbd7339aa9ff
2. Click "Add Task"
3. Copy description from each task above
4. Fill in assignee, priority, estimated hours
5. Save

---

**End of Task Plan**
**Total Planning Time**: 2.0 hours ✅ (complete)
**Next Action**: Create tasks using REST API or dashboard, then start Phase 1
