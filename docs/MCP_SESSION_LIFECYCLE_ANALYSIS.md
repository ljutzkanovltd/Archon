# FastMCP StreamableHTTPSessionManager Deep Investigation
## Root Cause Analysis & Solution Architecture

**Date**: 2026-01-10
**Task ID**: 2462c8ff-f360-4088-bf38-16bb596b2419
**Agent**: codebase-analyst
**Status**: Analysis Complete

---

## Executive Summary

The "Bad Request: No valid session ID provided" (HTTP 400) error occurs because **Archon's SimplifiedSessionManager and FastMCP's StreamableHTTPSessionManager operate as two completely independent session systems**. When Archon creates a global session in its lifespan function, this session is stored in Archon's in-memory cache and Supabase database, but **NOT registered in FastMCP's internal `_server_instances` dictionary**, which is the only session registry FastMCP checks when validating incoming requests.

**Root Cause**: Architectural mismatch between two independent session management systems with no integration bridge.

---

## Table of Contents

1. [Architecture Analysis](#architecture-analysis)
2. [Session Lifecycle Mapping](#session-lifecycle-mapping)
3. [Root Cause Deep Dive](#root-cause-deep-dive)
4. [Solution Options Analysis](#solution-options-analysis)
5. [Recommended Solution](#recommended-solution)
6. [Implementation Plan](#implementation-plan)

---

## Architecture Analysis

### System 1: Archon SimplifiedSessionManager

**Location**: `/python/src/server/services/mcp_session_manager.py`

**Purpose**: Custom session tracking for analytics, user identification, and dashboard metrics

**Storage**:
```python
class SimplifiedSessionManager:
    def __init__(self, timeout: int = 3600, use_database: bool = True):
        self.sessions: dict[str, datetime] = {}  # In-memory cache
        self._db_client = get_supabase_client()  # Supabase persistence
```

**Session Creation** (lines 57-135):
```python
def create_session(self, client_info, user_context) -> str:
    session_id = str(uuid.uuid4())
    self.sessions[session_id] = datetime.now()

    # Store in Supabase
    self._db_client.table("archon_mcp_sessions").insert({
        "session_id": session_id,
        "client_type": client_type,
        "connected_at": now.isoformat(),
        "status": "active"
    }).execute()
```

**Key Features**:
- ✅ Database persistence (Supabase)
- ✅ Token usage tracking
- ✅ Request history
- ✅ Dashboard analytics
- ❌ **NO integration with FastMCP's session registry**

---

### System 2: FastMCP StreamableHTTPSessionManager

**Location**: `mcp.server.streamable_http_manager.StreamableHTTPSessionManager` (from MCP SDK)

**Purpose**: MCP protocol session management for HTTP transport

**Storage**:
```python
class StreamableHTTPSessionManager:
    def __init__(self, app, event_store, retry_interval, json_response, stateless):
        self._server_instances = {}  # Internal session registry
        self.stateless = stateless
```

**Session Lifecycle** (based on FastMCP source analysis):

1. **Creation**: Implicitly during first HTTP request via `handle_request()`
2. **Storage**: In `_server_instances` dictionary (in-memory only)
3. **Validation**: Checks session ID exists in `_server_instances`
4. **Cleanup**: Managed by lifespan context manager

**Key Features**:
- ✅ MCP protocol compliance
- ✅ HTTP request handling
- ✅ Stateful/stateless modes
- ✅ SSE event store integration
- ❌ **NO knowledge of Archon's session system**

---

### Architecture Diagram (Text-Based)

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Client                              │
│                      (Claude Code)                              │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP Request with Session ID
                     │ (X-MCP-Session-Id: 5e011a0b-...)
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FastMCP HTTP Server                          │
│                  (Port 8051, /mcp endpoint)                     │
├─────────────────────────────────────────────────────────────────┤
│  StreamableHTTPSessionManager                                   │
│  ├─ _server_instances: {}  ← CHECKS HERE                       │
│  │                          ❌ Session NOT found!               │
│  └─ handle_request()                                            │
│       └─ Returns HTTP 400: "No valid session ID provided"       │
└─────────────────────────────────────────────────────────────────┘

                     ❌ NO CONNECTION ❌

┌─────────────────────────────────────────────────────────────────┐
│              Archon SimplifiedSessionManager                    │
│              (Completely Independent System)                    │
├─────────────────────────────────────────────────────────────────┤
│  self.sessions: {                                               │
│    "5e011a0b-...": datetime(2026-01-10 16:57:11)               │
│  }  ← Session EXISTS here!                                      │
│                                                                 │
│  Supabase Database (archon_mcp_sessions):                      │
│    session_id: 5e011a0b-dce2-4a53-96d1-81d1e7c540d2           │
│    client_type: "Claude Code"                                  │
│    status: "active"                                            │
│    connected_at: "2026-01-09T16:57:11"                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Session Lifecycle Mapping

### Current Flow (Broken)

```
┌─ Server Startup ──────────────────────────────────────────────┐
│                                                                │
│  1. FastMCP.run() initializes                                 │
│     └─ Creates StreamableHTTPSessionManager                   │
│        └─ _server_instances = {} (empty)                      │
│                                                                │
│  2. lifespan() context manager executes:                      │
│     a. User lifespan (Archon's lifespan function)            │
│        └─ Lines 175-180: session_manager.create_session()    │
│           └─ Stores in SimplifiedSessionManager.sessions     │
│           └─ Stores in Supabase database                     │
│           └─ Returns session_id: 5e011a0b-...                │
│                                                                │
│     b. FastMCP lifespan                                       │
│        └─ Initializes server, providers, middleware          │
│        └─ Does NOT register Archon's global session!         │
│                                                                │
│  3. StreamableHTTPSessionManager.run() starts                 │
│     └─ Ready to accept requests                               │
│     └─ _server_instances still EMPTY                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ MCP Client Request ──────────────────────────────────────────┐
│                                                                │
│  1. Claude Code sends HTTP request:                           │
│     POST http://localhost:8051/mcp                            │
│     Headers:                                                  │
│       X-MCP-Session-Id: 5e011a0b-dce2-4a53-96d1-81d1e7c540d2 │
│                                                                │
│  2. StreamableHTTPASGIApp.__call__() receives request         │
│     └─ Calls session_manager.handle_request()                │
│                                                                │
│  3. StreamableHTTPSessionManager.handle_request():            │
│     session_id = request.headers.get("X-MCP-Session-Id")     │
│     if session_id not in self._server_instances:             │
│         ❌ FAIL! Session not found                            │
│         return Response(400, "No valid session ID provided")  │
│                                                                │
│  4. SimplifiedSessionManager.sessions:                        │
│     {"5e011a0b-...": datetime(...)}  ← HAS the session!      │
│     But FastMCP never checks this!                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Expected Flow (What Should Happen)

**Option 1: FastMCP-Managed Sessions**
```
1. Client sends request WITHOUT session ID
2. FastMCP creates session in _server_instances
3. FastMCP returns session ID to client
4. Client includes session ID in subsequent requests
5. FastMCP validates against _server_instances
6. Archon tracks the request using FastMCP's session ID
```

**Option 2: Stateless Mode**
```
1. FastMCP configured with stateless=True
2. No session validation performed
3. Each request handled independently
4. Archon creates ephemeral session per request
```

**Option 3: Bridged Sessions**
```
1. Archon creates session in SimplifiedSessionManager
2. Bridge function registers session in FastMCP._server_instances
3. Client uses Archon's session ID
4. FastMCP validates against _server_instances (now contains it)
5. Both systems track the same session
```

---

## Root Cause Deep Dive

### The Problem: Two Independent Systems

**File**: `/python/src/mcp_server/mcp_server.py` (lines 175-180)

```python
# Create global session for single-user tracking
logger.info("🔐 Creating global MCP session for single-user mode...")
global_session_id = session_manager.create_session(
    client_info={"name": "Claude Code", "version": "1.0"},
    user_context=None  # Single-user mode, no user tracking
)
context.session_id = global_session_id
logger.info(f"✓ Global MCP session created: {global_session_id}")
```

**What happens here**:
1. ✅ `SimplifiedSessionManager.create_session()` is called
2. ✅ Session stored in `self.sessions` dictionary
3. ✅ Session persisted to Supabase `archon_mcp_sessions` table
4. ✅ Session ID logged successfully
5. ❌ **FastMCP's `StreamableHTTPSessionManager._server_instances` NOT updated**

**Why this is broken**:
- Archon's lifespan function runs **before** FastMCP's request handling starts
- FastMCP expects sessions to be created **during HTTP request processing**
- There's **no API** to pre-register sessions in FastMCP
- `SimplifiedSessionManager` and `StreamableHTTPSessionManager` have **zero integration**

### FastMCP's Expected Session Flow

**Source**: `fastmcp.server.http.create_streamable_http_app()`

```python
session_manager = StreamableHTTPSessionManager(
    app=server._mcp_server,
    event_store=event_store,
    retry_interval=retry_interval,
    json_response=json_response,
    stateless=stateless_http,
)

# Session manager lifecycle
async with server._lifespan_manager(), session_manager.run():
    yield
```

**Key Insight**: FastMCP's session manager is designed to:
1. Start empty (`_server_instances = {}`)
2. Create sessions **implicitly** when clients connect
3. Store sessions **only** in `_server_instances` (in-memory)
4. Validate sessions **only** against `_server_instances`

### Why Pre-Creating Sessions Doesn't Work

**Problem**: FastMCP's `StreamableHTTPSessionManager` has no public API to register external sessions

**Evidence**:
- No `register_session()` method
- No `add_session()` method
- No way to inject sessions into `_server_instances`
- Sessions are created internally via `handle_request()` only

**GitHub Issue Reference**: [FastMCP #480](https://github.com/jlowin/fastmcp/issues/480)
> "session_manager is created as a local variable inside create_streamable_http_app(), making it inaccessible outside that scope"

---

## Solution Options Analysis

### Option A: Remove Global Session Creation (Let FastMCP Handle It)

**Description**: Delete Archon's global session creation and rely entirely on FastMCP's session management.

**Changes Required**:
1. Remove lines 175-180 from `mcp_server.py` (global session creation)
2. Remove lines 692-701 from `mcp_server.py` (cleanup logic)
3. Update `@track_tool_execution` decorator to handle FastMCP sessions
4. Create session mapping from FastMCP → SimplifiedSessionManager on first tool call

**Implementation**:
```python
# mcp_server.py - lifespan function (REMOVE global session creation)
@asynccontextmanager
async def lifespan(server: FastMCP) -> AsyncIterator[ArchonContext]:
    logger.info("🚀 Starting MCP server...")

    # Initialize service client
    service_client = get_mcp_service_client()
    context = ArchonContext(service_client=service_client)

    # NO global session creation!

    await perform_health_checks(context)
    logger.info("✓ MCP server ready")
    yield context
```

```python
# session_tracking.py - Update decorator
def get_or_create_session(context: Any, client_info: dict = None) -> str:
    """
    Get FastMCP's session ID and create corresponding Archon session.
    """
    # Check if FastMCP has created a session
    if hasattr(context, 'session_id') and context.session_id:
        # Session already mapped
        return context.session_id

    # First tool call - create Archon session
    from src.server.services.mcp_session_manager import get_session_manager
    session_manager = get_session_manager()

    # FastMCP will have created its session already
    # We create a corresponding Archon session for tracking
    archon_session_id = session_manager.create_session(client_info)

    if hasattr(context, 'session_id'):
        context.session_id = archon_session_id

    return archon_session_id
```

**Pros**:
- ✅ Aligns with FastMCP's design philosophy
- ✅ No fighting against FastMCP's internals
- ✅ Simplest implementation (delete code!)
- ✅ Works with both stateful and stateless modes
- ✅ No architectural hacks required
- ✅ Future-proof (FastMCP updates won't break it)

**Cons**:
- ⚠️ Session not created until first tool call
- ⚠️ Different session lifecycle than originally planned
- ⚠️ Dashboard shows sessions only after activity starts

**Risk Level**: **LOW**
**Complexity**: **LOW**
**Maintenance**: **LOW**

---

### Option B: Use FastMCP Stateless Mode

**Description**: Configure FastMCP with `stateless=True` to disable session validation entirely.

**Changes Required**:
1. Update FastMCP initialization:
```python
# mcp_server.py
mcp = FastMCP(
    "archon-mcp-server",
    description="MCP server for Archon",
    instructions=MCP_INSTRUCTIONS,
    lifespan=lifespan,
    host=server_host,
    port=server_port,
    stateless_http=True,  # NEW: Enable stateless mode
)
```

2. Modify session tracking to create ephemeral sessions per request:
```python
# session_tracking.py
def get_or_create_session(context: Any, client_info: dict = None) -> str:
    """
    In stateless mode, create new session for each request.
    """
    from src.server.services.mcp_session_manager import get_session_manager
    session_manager = get_session_manager()

    # Create ephemeral session
    session_id = session_manager.create_session(
        client_info=client_info or {"name": "unknown-client", "version": "unknown"}
    )

    # Mark as ephemeral (close after request)
    return session_id
```

**Pros**:
- ✅ No session validation errors
- ✅ Works immediately with any MCP client
- ✅ Scales horizontally (no session affinity needed)
- ✅ Archon can still track requests per session
- ✅ Simple configuration change

**Cons**:
- ❌ No long-lived sessions (new session per request)
- ❌ Higher database load (more session records)
- ❌ Lost session context between requests
- ❌ Dashboard metrics less meaningful
- ❌ Can't track user behavior across multiple tool calls

**Risk Level**: **MEDIUM**
**Complexity**: **LOW**
**Maintenance**: **MEDIUM**

**GitHub Issue Reference**: [MCP SDK #1180](https://github.com/modelcontextprotocol/python-sdk/issues/1180)
> "When stateless_http=True is configured, session is being set to None"

---

### Option C: Bridge the Two Systems (Register Global Session with FastMCP)

**Description**: Create a bridge function that registers Archon's global session into FastMCP's `_server_instances`.

**Changes Required**:
1. Access FastMCP's internal session manager (requires hack)
2. Register Archon's session ID in `_server_instances`
3. Maintain synchronization between both systems

**Implementation** (HIGHLY FRAGILE):
```python
# mcp_server.py - lifespan function
@asynccontextmanager
async def lifespan(server: FastMCP) -> AsyncIterator[ArchonContext]:
    logger.info("🚀 Starting MCP server...")

    # Create Archon session
    session_manager = get_session_manager()
    global_session_id = session_manager.create_session(
        client_info={"name": "Claude Code", "version": "1.0"}
    )

    # HACK: Access FastMCP's internal session manager
    # This is EXTREMELY fragile and NOT recommended!
    try:
        # Get reference to FastMCP's StreamableHTTPSessionManager
        http_app = server.streamable_http_app()
        streamable_session_manager = http_app._session_manager  # Private attribute!

        # Create mock MCP session instance
        from mcp.server import ServerSession
        mock_session = ServerSession(
            receive_channel=...,  # Need to mock these!
            send_channel=...,
            init_options=...
        )

        # INJECT into FastMCP's internal registry
        streamable_session_manager._server_instances[global_session_id] = mock_session

        logger.info(f"✓ Bridged session {global_session_id} into FastMCP")
    except Exception as e:
        logger.error(f"Failed to bridge session: {e}")
        # Fallback: remove Archon session, let FastMCP handle it
        session_manager.close_session(global_session_id, reason="bridge_failure")

    context = ArchonContext(session_id=global_session_id)
    yield context
```

**Pros**:
- ✅ Keeps original architecture (global session on startup)
- ✅ Both systems use same session ID
- ✅ Dashboard shows session immediately

**Cons**:
- ❌ **EXTREMELY FRAGILE** - relies on private attributes
- ❌ **WILL BREAK** with FastMCP updates
- ❌ Requires deep knowledge of FastMCP internals
- ❌ Mocking MCP protocol objects is complex
- ❌ Violates encapsulation principles
- ❌ High maintenance burden
- ❌ May cause unexpected side effects
- ❌ Not recommended by FastMCP maintainers

**Risk Level**: **VERY HIGH**
**Complexity**: **VERY HIGH**
**Maintenance**: **VERY HIGH**

**GitHub Issue Reference**: [FastMCP #480](https://github.com/jlowin/fastmcp/issues/480)
> Maintainer response: "I'd prefer not to expose internal components... use the lifespan property instead"

---

## Recommended Solution

### **Option A: Remove Global Session Creation** ⭐

**Rationale**:

1. **Architectural Alignment**: Works with FastMCP's design, not against it
2. **Simplicity**: Delete code instead of adding complexity
3. **Maintainability**: No reliance on private APIs or hacks
4. **Future-Proof**: Won't break with FastMCP updates
5. **Clean Separation**: Archon tracks sessions; FastMCP manages protocol

### Why Not Option B (Stateless)?

**Session context is valuable**:
- Tracking user behavior across multiple tool calls
- Dashboard metrics (session duration, tool usage patterns)
- Cost analysis per session
- Multi-user support requires sessions

**Stateless mode limitations**:
- New session per request = database bloat
- No session context = poor analytics
- Migration to multi-user becomes harder

### Why Not Option C (Bridge)?

**Technical debt nightmare**:
- Accessing `._server_instances` is a **private attribute**
- Mocking MCP protocol objects is error-prone
- Will break when FastMCP changes internals
- Violates software engineering best practices
- Maintainer explicitly discourages this approach

---

## Implementation Plan

### Phase 1: Remove Global Session Creation (1 hour)

**File**: `/python/src/mcp_server/mcp_server.py`

**Changes**:
1. **Remove lines 175-180** (global session creation in lifespan)
2. **Remove lines 657-672** (global session creation in main)
3. **Remove lines 692-701** (cleanup logic in finally block)
4. **Keep** SimplifiedSessionManager initialization (still needed for tracking)

**Before**:
```python
# Create global session for single-user tracking
logger.info("🔐 Creating global MCP session for single-user mode...")
global_session_id = session_manager.create_session(
    client_info={"name": "Claude Code", "version": "1.0"},
    user_context=None
)
context.session_id = global_session_id
logger.info(f"✓ Global MCP session created: {global_session_id}")
```

**After**:
```python
# FastMCP will handle session creation on first client request
# Archon sessions will be created on first tool call via @track_tool_execution
logger.info("✓ MCP server ready (sessions will be created on first tool call)")
```

---

### Phase 2: Update Session Tracking Decorator (1 hour)

**File**: `/python/src/mcp_server/utils/session_tracking.py`

**Changes**:
Update `get_or_create_session()` function (lines 38-72):

```python
def get_or_create_session(context: Any, client_info: dict = None) -> str:
    """
    Get or create Archon session for tracking.

    FastMCP handles MCP protocol sessions.
    Archon creates tracking sessions on first tool call.

    Args:
        context: ArchonContext or FastMCP context
        client_info: Optional client metadata

    Returns:
        str: Archon session ID for tracking
    """
    # Check if Archon session already exists
    if hasattr(context, 'archon_session_id') and context.archon_session_id:
        return context.archon_session_id

    try:
        from src.server.services.mcp_session_manager import get_session_manager
        session_manager = get_session_manager()

        # Create Archon tracking session on first tool call
        if not client_info:
            client_info = {"name": "unknown-client", "version": "unknown"}

        archon_session_id = session_manager.create_session(
            client_info=client_info,
            user_context=None  # Single-user mode
        )

        # Store in context for subsequent tool calls
        if hasattr(context, 'archon_session_id'):
            context.archon_session_id = archon_session_id

        logger.info(
            f"✓ Archon tracking session created on first tool call - "
            f"session: {archon_session_id}, client: {client_info.get('name')}"
        )

        return archon_session_id

    except Exception as e:
        logger.error(f"Failed to create Archon session: {e}")
        logger.error(traceback.format_exc())
        return "unknown-session"
```

**Update** `@track_tool_execution` decorator (lines 75-147):

```python
@functools.wraps(func)
async def wrapper(ctx: Context, *args, **kwargs):
    start_time = time.time()
    tool_name = func.__name__
    status = "success"
    error_message = None
    session_id = "unknown-session"

    try:
        # Get or create Archon session from context
        if hasattr(ctx, "request_context") and hasattr(ctx.request_context, "lifespan_context"):
            context = ctx.request_context.lifespan_context

            # Extract client info from MCP request if available
            client_info = {"name": "unknown-client", "version": "unknown"}
            if hasattr(ctx, "meta") and hasattr(ctx.meta, "client_info"):
                client_info = ctx.meta.client_info

            # Get or create Archon tracking session
            session_id = get_or_create_session(context, client_info)
        else:
            logger.warning(f"Tool {tool_name}: No context available - using unknown-session")

        # Execute the actual tool
        result = await func(ctx, *args, **kwargs)
        return result

    except Exception as e:
        status = "error"
        error_message = str(e)
        logger.error(f"Tool {tool_name} failed: {e}")
        logger.error(traceback.format_exc())
        raise

    finally:
        # Track request in database
        duration_ms = (time.time() - start_time) * 1000
        try:
            from src.server.services.mcp_session_manager import get_session_manager
            session_manager = get_session_manager()
            session_manager.track_request(
                session_id=session_id,
                method="tools/call",
                tool_name=tool_name,
                status=status,
                duration_ms=duration_ms,
                error_message=error_message
            )
            logger.info(
                f"✓ Tracked tool call - tool: {tool_name}, "
                f"session: {session_id}, duration: {duration_ms:.2f}ms, "
                f"status: {status}"
            )
        except Exception as track_error:
            logger.error(f"Failed to track tool execution: {track_error}")
            logger.error(traceback.format_exc())

return wrapper
```

---

### Phase 3: Update ArchonContext (30 minutes)

**File**: `/python/src/mcp_server/mcp_server.py`

**Changes**:
Update `ArchonContext` dataclass (lines 86-108):

```python
@dataclass
class ArchonContext:
    """
    Context for MCP server with session tracking.

    Note: archon_session_id is created on first tool call, not at startup.
    This allows FastMCP to handle MCP protocol sessions while Archon
    tracks requests for analytics.
    """
    service_client: Any
    archon_session_id: Optional[str] = None  # Created on first tool call
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

---

### Phase 4: Testing & Verification (2 hours)

**Test Plan**:

1. **Start Archon services**:
```bash
cd /home/ljutzkanov/Documents/Projects/archon
./start-archon.sh
```

2. **Verify no session created at startup**:
```bash
# Check logs
docker logs archon-mcp-server 2>&1 | grep -i "session"

# Expected: NO "Global MCP session created" message
# Expected: "MCP server ready (sessions will be created on first tool call)"
```

3. **Make first MCP tool call**:
```bash
# Via Claude Code or curl
curl -X POST http://localhost:8051/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "health_check",
      "arguments": {}
    }
  }'
```

4. **Verify Archon session created**:
```bash
# Check database
docker exec supabase-ai-db psql -U postgres -d postgres \
  -c "SELECT session_id, client_type, status, connected_at FROM archon_mcp_sessions ORDER BY connected_at DESC LIMIT 5;"

# Expected: New session with timestamp matching first tool call
```

5. **Verify request tracking**:
```bash
# Check request records
docker exec supabase-ai-db psql -U postgres -d postgres \
  -c "SELECT session_id, tool_name, status, duration_ms FROM archon_mcp_requests ORDER BY timestamp DESC LIMIT 5;"

# Expected: health_check tool call tracked with session ID
```

6. **Test multiple tool calls**:
```bash
# Make 3-5 more tool calls
# Verify same session ID used for all requests
# Verify all requests tracked in database
```

7. **Verify dashboard**:
```bash
# Open dashboard
open http://localhost:3737

# Check:
# - Session appears after first tool call
# - Request history shows all tool calls
# - Session duration updates correctly
```

---

### Phase 5: Documentation Updates (1 hour)

**Files to Update**:

1. **`/docs/MCP_SINGLE_USER_SESSION_TRACKING_SUMMARY.md`**:
   - Add "Solution Implemented" section
   - Document new session lifecycle
   - Update testing checklist

2. **`/.claude/CLAUDE.md`**:
   - Update session management documentation
   - Add note about session creation on first tool call

3. **`/README.md`**:
   - Update architecture diagram
   - Document session lifecycle

4. **Create new file**: `/docs/MCP_SESSION_ARCHITECTURE.md`
   - Comprehensive guide to session management
   - FastMCP vs Archon session systems
   - Developer guide for extending functionality

---

## Testing Checklist

### Pre-Implementation Verification
- [ ] Current state documented (global session creation)
- [ ] Backup created (`git commit` before changes)
- [ ] Test environment available

### Implementation Verification
- [ ] Phase 1: Global session creation removed
- [ ] Phase 2: Session tracking decorator updated
- [ ] Phase 3: ArchonContext updated
- [ ] Code compiles without errors
- [ ] No import errors on startup

### Functional Testing
- [ ] MCP server starts successfully
- [ ] No session created at startup (verified in logs)
- [ ] First tool call creates Archon session
- [ ] Session ID stored in database
- [ ] Request tracked in database
- [ ] Subsequent tool calls use same session
- [ ] Dashboard displays session after first tool call
- [ ] Session cleanup works on shutdown
- [ ] Multiple clients create separate sessions

### Regression Testing
- [ ] All MCP tools still functional
- [ ] RAG tools work correctly
- [ ] Task management tools work correctly
- [ ] Project management tools work correctly
- [ ] Document tools work correctly
- [ ] Health check endpoint works
- [ ] Session info endpoint works

---

## Rollback Plan

If implementation fails:

1. **Revert Git Commit**:
```bash
git log --oneline -5  # Find commit hash
git revert <commit_hash>
```

2. **Restore Backup**:
```bash
# If git revert fails
git reset --hard <previous_commit_hash>
```

3. **Verify Services**:
```bash
./stop-archon.sh
./start-archon.sh
curl http://localhost:8051/health
```

---

## Success Criteria

Implementation is successful when:

1. ✅ **No HTTP 400 errors** from MCP clients
2. ✅ **Sessions created on first tool call** (verified in logs)
3. ✅ **Requests tracked in database** (archon_mcp_requests table)
4. ✅ **Dashboard displays session info** after first tool call
5. ✅ **Multiple tool calls use same session** (verified in database)
6. ✅ **All MCP tools functional** (RAG, tasks, projects, documents)
7. ✅ **Clean shutdown** (session cleanup works)

---

## Appendix: Alternative Approaches Considered

### A1: Custom MCP Transport

**Idea**: Build custom MCP transport that integrates Archon sessions

**Rejected**: Too complex, violates FastMCP abstractions

---

### A2: Proxy Layer

**Idea**: HTTP proxy that intercepts requests and injects sessions

**Rejected**: Adds latency, increases complexity

---

### A3: Fork FastMCP

**Idea**: Fork FastMCP and modify session management

**Rejected**: Maintenance burden, diverges from upstream

---

## References

1. **FastMCP Issue #480**: [make `session_manager` as a property](https://github.com/jlowin/fastmcp/issues/480)
2. **MCP SDK Issue #1180**: [FastMCP + Streamable Http : Session Management](https://github.com/modelcontextprotocol/python-sdk/issues/1180)
3. **MCP SDK Issue #880**: [horizontal scaling session persistence](https://github.com/modelcontextprotocol/python-sdk/issues/880)
4. **FastMCP Documentation**: [Running Your Server](https://gofastmcp.com/deployment/running-server)
5. **Cloudflare Blog**: [Bringing streamable HTTP transport and Python language support to MCP servers](https://blog.cloudflare.com/streamable-http-mcp-servers-python/)

---

**Analysis Complete**
**Task Status**: Ready for review
**Next Steps**: Update task to 'review' status and present findings to planner agent

---

