# MCP Session Architecture - Visual Diagrams

**Purpose**: Visual reference for understanding MCP session management architecture
**Audience**: Developers, architects, implementation team
**Date**: 2026-01-10

---

## Current Architecture (Broken) 🚫

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MCP CLIENT                                     │
│                        (Claude Code)                                    │
│                                                                         │
│  Sends HTTP request with:                                              │
│  X-MCP-Session-Id: 5e011a0b-dce2-4a53-96d1-81d1e7c540d2               │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ HTTP POST http://localhost:8051/mcp
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                     FASTMCP HTTP SERVER                                 │
│                   (Port 8051, /mcp endpoint)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  StreamableHTTPSessionManager                                           │
│  │                                                                      │
│  ├─ _server_instances: {}  ← ❌ EMPTY! Session NOT registered          │
│  │                                                                      │
│  └─ handle_request(request):                                           │
│      session_id = request.headers.get("X-MCP-Session-Id")             │
│      if session_id not in self._server_instances:                      │
│          return Response(400, "No valid session ID provided")          │
│                                                                         │
│  ❌ HTTP 400 ERROR RETURNED TO CLIENT                                  │
└─────────────────────────────────────────────────────────────────────────┘

                             ❌ NO CONNECTION ❌

┌─────────────────────────────────────────────────────────────────────────┐
│                   ARCHON SESSION MANAGER                                │
│               (SimplifiedSessionManager)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  In-Memory Cache:                                                       │
│  self.sessions = {                                                      │
│    "5e011a0b-dce2-4a53-96d1-81d1e7c540d2": datetime(2026-01-10 16:57)│
│  }  ← ✅ Session EXISTS here!                                          │
│                                                                         │
│  Supabase Database (archon_mcp_sessions):                              │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │ session_id: 5e011a0b-dce2-4a53-96d1-81d1e7c540d2            │    │
│  │ client_type: "Claude Code"                                   │    │
│  │ status: "active"                                             │    │
│  │ connected_at: "2026-01-09T16:57:11"                          │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ⚠️  FastMCP never checks this system!                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Problem Summary

1. **Archon creates session** during server startup (lifespan function)
2. **Session stored in two places**: SimplifiedSessionManager + Supabase
3. **FastMCP has its own session registry**: `_server_instances` dictionary
4. **No bridge between systems**: Archon's session never reaches FastMCP
5. **Result**: FastMCP rejects requests with Archon's session ID

---

## Proposed Architecture (Option A) ✅

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MCP CLIENT                                       │
│                      (Claude Code)                                      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ ① FIRST REQUEST (no session ID)
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                     FASTMCP HTTP SERVER                                 │
│                   (Port 8051, /mcp endpoint)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  StreamableHTTPSessionManager                                           │
│  │                                                                      │
│  ├─ _server_instances: {}  ← Empty at startup                          │
│  │                                                                      │
│  └─ handle_request(request):                                           │
│      # No session ID in request                                        │
│      ② Create new session automatically                                │
│      session_id = str(uuid.uuid4())                                    │
│      self._server_instances[session_id] = ServerSession(...)           │
│      return Response(headers={"X-MCP-Session-Id": session_id})         │
│                                                                         │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ ③ Call MCP tool (e.g., health_check)
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    @track_tool_execution DECORATOR                      │
│                  (session_tracking.py)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  async def wrapper(ctx: Context, *args, **kwargs):                     │
│      # ④ First tool call - create Archon session for tracking          │
│      context = ctx.request_context.lifespan_context                    │
│                                                                         │
│      if not hasattr(context, 'archon_session_id'):                     │
│          session_manager = get_session_manager()                       │
│          archon_session_id = session_manager.create_session(...)       │
│          context.archon_session_id = archon_session_id  ← Store!       │
│                                                                         │
│      # ⑤ Track request in database                                     │
│      session_manager.track_request(                                    │
│          session_id=context.archon_session_id,                         │
│          method="tools/call",                                          │
│          tool_name="health_check"                                      │
│      )                                                                  │
│                                                                         │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             │ ⑥ Store tracking data
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                   ARCHON SESSION MANAGER                                │
│               (SimplifiedSessionManager)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  In-Memory Cache:                                                       │
│  self.sessions = {                                                      │
│    "new-archon-session-id": datetime(2026-01-10 17:00)  ← ⑦ Created!  │
│  }                                                                      │
│                                                                         │
│  Supabase Database (archon_mcp_sessions):                              │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │ session_id: new-archon-session-id                            │    │
│  │ client_type: "Claude Code"                                   │    │
│  │ status: "active"                                             │    │
│  │ connected_at: "2026-01-10T17:00:00"  ← ⑧ First tool call    │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  Supabase Database (archon_mcp_requests):                              │
│  ┌───────────────────────────────────────────────────────────────┐    │
│  │ session_id: new-archon-session-id                            │    │
│  │ tool_name: "health_check"                                    │    │
│  │ status: "success"                                            │    │
│  │ duration_ms: 45.2                                            │    │
│  │ timestamp: "2026-01-10T17:00:00"  ← ⑨ Request tracked       │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                             ⑩ SUBSEQUENT REQUESTS

┌─────────────────────────────────────────────────────────────────────────┐
│  Client includes: X-MCP-Session-Id: <fastmcp-session-id>               │
│  FastMCP validates ✅ (session exists in _server_instances)            │
│  @track_tool_execution uses existing archon_session_id                 │
│  Request tracked in database with same Archon session ID               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Solution Summary

1. **FastMCP creates its own sessions** (during HTTP request processing)
2. **Archon creates tracking sessions** (on first tool call via decorator)
3. **Clean separation of concerns**:
   - FastMCP: MCP protocol session management
   - Archon: Analytics, tracking, dashboard metrics
4. **No architectural hacks**: Works with FastMCP's design
5. **Result**: Both systems coexist peacefully

---

## Data Flow Comparison

### Current (Broken) ❌

```
Server Startup
    │
    ├─ FastMCP.run()
    │   └─ StreamableHTTPSessionManager._server_instances = {}
    │
    ├─ lifespan() function
    │   └─ SimplifiedSessionManager.create_session()
    │       └─ session_id = "5e011a0b-..."
    │           ├─ Store in self.sessions ✅
    │           ├─ Store in Supabase ✅
    │           └─ Store in _server_instances ❌ NO!
    │
    └─ Server ready

Client Request (X-MCP-Session-Id: 5e011a0b-...)
    │
    └─ StreamableHTTPSessionManager.handle_request()
        └─ Check _server_instances
            └─ ❌ Session NOT found → HTTP 400 error
```

### Proposed (Working) ✅

```
Server Startup
    │
    ├─ FastMCP.run()
    │   └─ StreamableHTTPSessionManager._server_instances = {}
    │
    ├─ lifespan() function
    │   └─ ⚠️  NO session creation! (removed)
    │
    └─ Server ready

Client Request #1 (no session ID)
    │
    ├─ StreamableHTTPSessionManager.handle_request()
    │   └─ Create session in _server_instances ✅
    │       └─ Return session ID to client
    │
    ├─ @track_tool_execution decorator
    │   └─ SimplifiedSessionManager.create_session()
    │       └─ session_id = "new-archon-session-id"
    │           ├─ Store in self.sessions ✅
    │           ├─ Store in Supabase ✅
    │           └─ Store in context.archon_session_id ✅
    │
    └─ Request tracked in database ✅

Client Request #2+ (X-MCP-Session-Id: <fastmcp-session-id>)
    │
    ├─ StreamableHTTPSessionManager.handle_request()
    │   └─ Check _server_instances
    │       └─ ✅ Session FOUND → Process request
    │
    ├─ @track_tool_execution decorator
    │   └─ Use existing context.archon_session_id ✅
    │
    └─ Request tracked with same Archon session ID ✅
```

---

## Session Lifecycle Timeline

### Current Implementation (Broken) ❌

```
Time: T0 (Server Startup)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Action: lifespan() creates global session
Result: Archon session ID = 5e011a0b-...
State:  FastMCP._server_instances = {}  (empty)
        Archon.sessions = {"5e011a0b-...": datetime}
        Supabase = [session record created]

Time: T1 (Client Connects)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Action: Client sends request with X-MCP-Session-Id: 5e011a0b-...
Result: ❌ HTTP 400 - Session not in _server_instances
State:  FastMCP._server_instances = {}  (still empty)
        Archon.sessions = {"5e011a0b-...": datetime}  (has it!)

Time: T2+
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Action: All requests fail with HTTP 400
Result: ❌ MCP tools unusable
```

### Proposed Implementation (Working) ✅

```
Time: T0 (Server Startup)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Action: lifespan() does NOT create session
Result: No sessions created yet
State:  FastMCP._server_instances = {}
        Archon.sessions = {}
        Supabase = []

Time: T1 (Client First Request)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Action: Client sends request (no session ID)
Result: ✅ FastMCP creates session = abc123
State:  FastMCP._server_instances = {"abc123": ServerSession(...)}
        Archon.sessions = {}  (not yet)

Time: T2 (First Tool Call)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Action: @track_tool_execution creates Archon session
Result: ✅ Archon session ID = def456
State:  FastMCP._server_instances = {"abc123": ServerSession(...)}
        Archon.sessions = {"def456": datetime}
        Supabase = [session record created]
        context.archon_session_id = "def456"

Time: T3+ (Subsequent Requests)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Action: Client sends requests with X-MCP-Session-Id: abc123
Result: ✅ FastMCP validates successfully
        ✅ Decorator uses existing Archon session ID = def456
        ✅ All requests tracked in database
State:  FastMCP._server_instances = {"abc123": ServerSession(...)}
        Archon.sessions = {"def456": datetime}
        Supabase = [multiple request records with session_id=def456]
```

---

## Key Architectural Insights

### 1. Separation of Concerns

```
┌─────────────────────────────────────────────────────┐
│              FASTMCP RESPONSIBILITY                 │
├─────────────────────────────────────────────────────┤
│  • MCP protocol session management                  │
│  • HTTP request/response handling                   │
│  • Session validation                               │
│  • Client authentication                            │
│  • Protocol-level operations                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              ARCHON RESPONSIBILITY                  │
├─────────────────────────────────────────────────────┤
│  • Analytics and metrics                            │
│  • Request tracking                                 │
│  • Token usage monitoring                           │
│  • Cost estimation                                  │
│  • Dashboard data collection                        │
│  • Historical analysis                              │
└─────────────────────────────────────────────────────┘
```

### 2. Session ID Mapping

```
MCP Client                FastMCP                 Archon
─────────────────────────────────────────────────────────
   │                         │                       │
   │─ Connect (no session)  →│                       │
   │                         │─ Create session       │
   │                         │   ID: abc123          │
   │← Return session ID ─────│                       │
   │   (X-MCP-Session-Id)    │                       │
   │                         │                       │
   │─ Tool call (abc123) ───→│                       │
   │                         │─ Validate ✅          │
   │                         │                       │
   │                         │─ Execute tool ───────→│
   │                         │                       │─ Create Archon session
   │                         │                       │   ID: def456
   │                         │                       │─ Track request
   │                         │                       │   (session_id: def456)
   │                         │                       │
   │← Tool result ───────────│← Return result ───────│
   │                         │                       │
   │─ More tools (abc123) ──→│                       │
   │                         │─ Validate ✅          │
   │                         │─ Execute tool ───────→│
   │                         │                       │─ Use existing session
   │                         │                       │   (def456)
   │                         │                       │─ Track request
   │← Results ───────────────│← Return ──────────────│
```

### 3. Database Schema

```
archon_mcp_sessions
┌─────────────────────────────────────────────────────┐
│ session_id          VARCHAR (PK)  "def456"          │
│ client_type         VARCHAR        "Claude Code"    │
│ client_version      VARCHAR        "1.0"            │
│ status              VARCHAR        "active"         │
│ connected_at        TIMESTAMP      T2               │
│ last_activity       TIMESTAMP      T3+              │
│ disconnected_at     TIMESTAMP      NULL             │
│ total_duration      INTEGER        NULL             │
└─────────────────────────────────────────────────────┘
                          │
                          │ Foreign Key
                          ↓
archon_mcp_requests
┌─────────────────────────────────────────────────────┐
│ id                  UUID (PK)                       │
│ session_id          VARCHAR (FK)   "def456"         │
│ method              VARCHAR        "tools/call"     │
│ tool_name           VARCHAR        "health_check"   │
│ prompt_tokens       INTEGER        0                │
│ completion_tokens   INTEGER        0                │
│ estimated_cost      DECIMAL        0.00             │
│ timestamp           TIMESTAMP      T2, T3, ...      │
│ duration_ms         FLOAT          45.2             │
│ status              VARCHAR        "success"        │
│ error_message       VARCHAR        NULL             │
└─────────────────────────────────────────────────────┘
```

---

## Migration Path to Multi-User

### Current (Single-User) - After Fix

```
Server Startup → No sessions created
  ↓
Client connects → FastMCP creates session
  ↓
First tool call → Archon creates session (no user_context)
  ↓
Database stores:
  - session_id: "abc123"
  - user_id: NULL
  - user_email: NULL
  - user_name: NULL
```

### Future (Multi-User)

```
Server Startup → No sessions created
  ↓
Client connects with auth token → FastMCP creates session
  ↓
Auth middleware extracts user info
  ↓
First tool call → Archon creates session (WITH user_context)
  ↓
Database stores:
  - session_id: "abc123"
  - user_id: "user-uuid-123"
  - user_email: "user@example.com"
  - user_name: "John Doe"
```

**Migration Effort**: Minimal - just add user context extraction to decorator

---

## References

- **Full Analysis**: `/docs/MCP_SESSION_LIFECYCLE_ANALYSIS.md`
- **Executive Summary**: `/docs/MCP_SESSION_ANALYSIS_EXECUTIVE_SUMMARY.md`
- **Implementation Guide**: See full analysis document, Phase 1-5

---

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Created by**: codebase-analyst agent

