# MCP Session Architecture

**Date**: 2026-01-10
**Version**: 1.0
**Status**: Active

---

## Table of Contents

1. [Overview](#overview)
2. [Dual Session Management System](#dual-session-management-system)
3. [Session Lifecycle](#session-lifecycle)
4. [Implementation Details](#implementation-details)
5. [Session Mapping](#session-mapping)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## Overview

Archon implements a **dual session management system** that separates protocol-level session management (handled by FastMCP) from analytics tracking (handled by Archon's SimplifiedSessionManager). This architecture ensures:

- ✅ **No conflicts** with FastMCP's internal session management
- ✅ **Lazy session creation** - sessions created only when needed
- ✅ **Clear separation of concerns** - protocol vs analytics
- ✅ **Future-proof** - works with FastMCP updates

### Key Concepts

| Concept | Description |
|---------|-------------|
| **FastMCP Protocol Session** | Manages MCP protocol communication, handles client connections, validates requests |
| **Archon Analytics Session** | Tracks tool usage, request history, session metrics for dashboard |
| **Lazy Creation** | Sessions created on first tool call, not at server startup |
| **Context-Based Mapping** | Session mapping stored in FastMCP context, not HTTP headers |

---

## Dual Session Management System

### System 1: FastMCP StreamableHTTPSessionManager

**Purpose**: MCP protocol session management for HTTP transport

**Responsibilities**:
- Create and validate MCP protocol sessions
- Handle HTTP request/response lifecycle
- Manage Server-Sent Events (SSE) for streaming
- Enforce session security and authentication

**Storage**: Internal `_server_instances` dictionary (in-memory)

**Lifecycle**: Automatic - created during client connection, cleaned up on disconnect

### System 2: Archon SimplifiedSessionManager

**Purpose**: Analytics tracking and dashboard metrics

**Responsibilities**:
- Track tool usage and request history
- Store session metadata (client type, user context)
- Calculate session duration and metrics
- Provide data for MCP dashboard

**Storage**: Supabase database (`archon_mcp_sessions`, `archon_mcp_requests` tables)

**Lifecycle**: Lazy - created on first tool call, persisted to database

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         MCP Client                              │
│                      (Claude Code)                              │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP Request
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FastMCP HTTP Server                          │
│                  (Port 8051, /mcp endpoint)                     │
├─────────────────────────────────────────────────────────────────┤
│  StreamableHTTPSessionManager                                   │
│  ├─ _server_instances: {}                                       │
│  │   └─ FastMCP protocol sessions                              │
│  └─ Handles MCP protocol communication                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│              @track_tool_execution Decorator                    │
│              (First Tool Call Trigger)                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Extracts client info from request                           │
│  2. Calls get_or_create_session()                               │
│  3. Creates Archon session if not exists                        │
│  4. Stores archon_session_id in context                         │
│  5. Tracks request to database                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│              Archon SimplifiedSessionManager                    │
│              (Analytics Tracking)                               │
├─────────────────────────────────────────────────────────────────┤
│  self.sessions: {                                               │
│    "archon-session-uuid": datetime(...)                         │
│  }                                                              │
│                                                                 │
│  Supabase Database (archon_mcp_sessions):                      │
│    session_id: archon-session-uuid                             │
│    client_type: "Claude Code"                                  │
│    status: "active"                                            │
│    connected_at: "2026-01-10T18:00:00"                         │
│                                                                 │
│  Supabase Database (archon_mcp_requests):                      │
│    session_id: archon-session-uuid                             │
│    tool_name: "rag_search_knowledge_base"                      │
│    status: "success"                                           │
│    duration_ms: 245.8                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Session Lifecycle

### Phase 1: Server Startup

```
┌─ Server Startup ──────────────────────────────────────────────┐
│                                                                │
│  1. FastMCP.run() initializes                                 │
│     └─ Creates StreamableHTTPSessionManager                   │
│        └─ _server_instances = {} (empty)                      │
│                                                                │
│  2. lifespan() context manager executes:                      │
│     └─ Initializes ArchonContext                              │
│        └─ archon_session_id = None (no session yet)           │
│                                                                │
│  3. StreamableHTTPSessionManager.run() starts                 │
│     └─ Ready to accept requests                               │
│     └─ NO Archon session created yet                          │
│                                                                │
│  ✅ Result: Server ready, no sessions created                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Phase 2: First MCP Tool Call

```
┌─ First Tool Call ─────────────────────────────────────────────┐
│                                                                │
│  1. Client sends HTTP request to /mcp                         │
│     POST http://localhost:8051/mcp                            │
│     Body: {"method": "tools/call", "params": {...}}           │
│                                                                │
│  2. FastMCP creates protocol session                          │
│     └─ StreamableHTTPSessionManager handles request           │
│        └─ Creates MCP protocol session (automatic)            │
│                                                                │
│  3. @track_tool_execution decorator executes:                 │
│     a. Checks context.archon_session_id → None                │
│     b. Calls get_or_create_session(context, client_info)      │
│     c. SimplifiedSessionManager.create_session()              │
│        └─ Creates UUID: e.g., "5e011a0b-..."                  │
│        └─ Stores in self.sessions                             │
│        └─ Inserts to archon_mcp_sessions table                │
│     d. context.archon_session_id = "5e011a0b-..."             │
│                                                                │
│  4. Tool executes normally                                    │
│                                                                │
│  5. Decorator finally block:                                  │
│     └─ track_request(session_id, tool_name, duration, ...)    │
│        └─ Inserts to archon_mcp_requests table                │
│                                                                │
│  ✅ Result: Archon session created and first request tracked  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Phase 3: Subsequent Tool Calls

```
┌─ Subsequent Tool Calls ───────────────────────────────────────┐
│                                                                │
│  1. Client sends HTTP request to /mcp                         │
│                                                                │
│  2. FastMCP uses existing protocol session                    │
│                                                                │
│  3. @track_tool_execution decorator executes:                 │
│     a. Checks context.archon_session_id → "5e011a0b-..."      │
│     b. Session exists! Skip creation                          │
│     c. session_id = context.archon_session_id                 │
│                                                                │
│  4. Tool executes normally                                    │
│                                                                │
│  5. Decorator finally block:                                  │
│     └─ track_request(session_id, tool_name, duration, ...)    │
│        └─ Inserts to archon_mcp_requests table                │
│        └─ SAME session_id as first call                       │
│                                                                │
│  ✅ Result: Request tracked to existing session               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Phase 4: Server Shutdown

```
┌─ Server Shutdown ─────────────────────────────────────────────┐
│                                                                │
│  1. FastMCP lifespan context exits                            │
│     └─ StreamableHTTPSessionManager cleans up protocol        │
│        └─ _server_instances cleared                           │
│                                                                │
│  2. Archon sessions marked as closed                          │
│     └─ SimplifiedSessionManager.close_session()               │
│        └─ Updates archon_mcp_sessions.status = "closed"       │
│        └─ Sets disconnected_at timestamp                      │
│                                                                │
│  ✅ Result: Clean shutdown, sessions persisted to database    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### get_or_create_session() Function

**Location**: `/python/src/mcp_server/utils/session_tracking.py`

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
        return "unknown-session"
```

### @track_tool_execution Decorator

**Location**: `/python/src/mcp_server/utils/session_tracking.py`

```python
def track_tool_execution(func):
    """
    Decorator to track MCP tool execution with lazy session creation.
    """
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

                # Get or create Archon tracking session (LAZY CREATION)
                session_id = get_or_create_session(context, client_info)
            else:
                logger.warning(f"Tool {tool_name}: No context available")

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
                    session_id=session_id,
                    method="tools/call",
                    tool_name=tool_name,
                    status=status,
                    duration_ms=duration_ms,
                    error_message=error_message
                )
            except Exception as track_error:
                logger.error(f"Failed to track tool execution: {track_error}")

    return wrapper
```

### ArchonContext Dataclass

**Location**: `/python/src/mcp_server/mcp_server.py`

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

## Session Mapping

### How Sessions Are Linked

**Problem**: FastMCP manages protocol sessions, Archon tracks analytics sessions. How do we link them?

**Solution**: Context-based mapping stored in FastMCP's lifespan context.

```
┌─ Session Mapping Flow ────────────────────────────────────────┐
│                                                                │
│  1. FastMCP creates protocol session (automatic)              │
│     └─ MCP session ID: <internal to FastMCP>                  │
│                                                                │
│  2. First tool call triggers @track_tool_execution            │
│     └─ Creates Archon session: "5e011a0b-..."                 │
│     └─ Stores in context.archon_session_id                    │
│                                                                │
│  3. Subsequent tool calls read from context                   │
│     └─ context.archon_session_id = "5e011a0b-..." (cached)    │
│                                                                │
│  4. All requests for this connection tracked to same session  │
│     └─ archon_mcp_requests.session_id = "5e011a0b-..."        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Why Context Instead of Headers?

**Alternative Approach (Not Used)**: Pass session ID via HTTP headers
- ❌ Requires client cooperation
- ❌ Client would need to store and send session ID
- ❌ More complex MCP client configuration

**Context-Based Approach (Current)**:
- ✅ Transparent to client
- ✅ Managed entirely server-side
- ✅ Works with any MCP client
- ✅ No additional client configuration

---

## Troubleshooting

### Issue: Sessions Not Being Created

**Symptoms**:
- No sessions in `archon_mcp_sessions` table
- Dashboard shows no session data
- Logs don't show "Archon tracking session created"

**Diagnosis**:
```bash
# Check MCP server logs
docker logs archon-mcp-server 2>&1 | grep -i "session"

# Check database for sessions
docker exec supabase-ai-db psql -U postgres -d postgres \
  -c "SELECT * FROM archon_mcp_sessions ORDER BY connected_at DESC LIMIT 5;"
```

**Possible Causes**:
1. **No tool calls made**: Sessions are lazy - created on first tool call
2. **Context not passed**: Decorator can't access lifespan context
3. **Database connection issue**: SimplifiedSessionManager can't persist session

**Solutions**:
1. Make a test tool call via MCP client
2. Verify `ctx.request_context.lifespan_context` is accessible
3. Check Supabase connection with `curl http://localhost:8181/health`

---

### Issue: Multiple Sessions for Same Client

**Symptoms**:
- Multiple sessions with same client_type
- Each tool call creates new session
- Dashboard shows fragmented session data

**Diagnosis**:
```bash
# Check session creation frequency
docker exec supabase-ai-db psql -U postgres -d postgres \
  -c "SELECT client_type, COUNT(*), MIN(connected_at), MAX(connected_at)
      FROM archon_mcp_sessions
      GROUP BY client_type;"
```

**Possible Causes**:
1. **Context not persisting**: `context.archon_session_id` being cleared
2. **Client reconnecting**: Each connection creates new FastMCP session
3. **Server restarting**: Sessions not surviving restarts

**Solutions**:
1. Verify context is same instance across tool calls
2. Check client connection stability
3. Implement session recovery from database on startup (future enhancement)

---

### Issue: Requests Not Tracked

**Symptoms**:
- Sessions exist but `archon_mcp_requests` table empty
- Dashboard shows session but no tool usage
- Logs show session creation but not request tracking

**Diagnosis**:
```bash
# Check requests table
docker exec supabase-ai-db psql -U postgres -d postgres \
  -c "SELECT session_id, tool_name, status, timestamp
      FROM archon_mcp_requests
      ORDER BY timestamp DESC LIMIT 10;"

# Check decorator logs
docker logs archon-mcp-server 2>&1 | grep -i "tracked tool call"
```

**Possible Causes**:
1. **Decorator not applied**: Tool missing `@track_tool_execution`
2. **Database error**: `track_request()` failing silently
3. **Session ID mismatch**: Wrong session ID passed to `track_request()`

**Solutions**:
1. Verify all MCP tools have `@track_tool_execution` decorator
2. Check logs for "Failed to track tool execution" errors
3. Add debug logging to show session IDs

---

### Issue: Session Cleanup Not Working

**Symptoms**:
- All sessions show status "active" even after disconnect
- No `disconnected_at` timestamps
- Session count keeps growing

**Diagnosis**:
```bash
# Check active sessions
docker exec supabase-ai-db psql -U postgres -d postgres \
  -c "SELECT status, COUNT(*) FROM archon_mcp_sessions GROUP BY status;"

# Check for old active sessions
docker exec supabase-ai-db psql -U postgres -d postgres \
  -c "SELECT session_id, client_type, connected_at
      FROM archon_mcp_sessions
      WHERE status = 'active' AND connected_at < NOW() - INTERVAL '1 hour';"
```

**Possible Causes**:
1. **Cleanup not implemented**: No session cleanup in lifespan context exit
2. **Server crashes**: Sessions not closed gracefully
3. **Database timeout**: Session updates failing

**Solutions**:
1. Implement session cleanup in FastMCP lifespan context
2. Add periodic cleanup job for stale sessions
3. Check database connection health

---

## Best Practices

### For Developers

1. **Don't Create Global Sessions**: Let sessions be created lazily on first tool call
2. **Use Context, Not Global Variables**: Store session mapping in FastMCP context
3. **Don't Fight FastMCP**: Let FastMCP manage protocol sessions, Archon tracks analytics
4. **Log Session Events**: Log creation, reuse, and cleanup for debugging
5. **Handle Missing Context**: Decorator should gracefully handle missing context

### For Operations

1. **Monitor Session Health**: Check for stale "active" sessions
2. **Database Backups**: Regular backups of `archon_mcp_sessions` and `archon_mcp_requests`
3. **Log Retention**: Keep MCP server logs for troubleshooting
4. **Dashboard Monitoring**: Use dashboard to verify session tracking works

### For Multi-User Migration

1. **Plan User Identification**: How will you identify users in requests?
2. **Authentication Layer**: Add authentication before session creation
3. **Session-Per-Connection**: Create new Archon session per user connection
4. **User Context Storage**: Store user metadata in `user_context` field
5. **Authorization**: Validate user can access requested resources

---

## Performance Considerations

### Session Creation Overhead

**First Tool Call**:
- ~10ms overhead for session creation
- Database insert to `archon_mcp_sessions`
- Acceptable for cold start

**Subsequent Tool Calls**:
- ~1ms overhead for context lookup
- No database operation
- Negligible performance impact

### Database Load

**Per Session**:
- 1 row in `archon_mcp_sessions` (created once)
- N rows in `archon_mcp_requests` (one per tool call)
- Indexes on `session_id` for fast queries

**Optimization**:
- Batch request inserts for high throughput
- Periodic cleanup of old sessions
- Database connection pooling

### Memory Footprint

**SimplifiedSessionManager**:
- In-memory cache: `{session_id: datetime}`
- ~100 bytes per session
- 10,000 sessions = ~1MB memory
- Acceptable for single-server deployment

---

## Future Enhancements

### Session Recovery

**Feature**: Recover Archon sessions from database on server restart

**Implementation**:
1. On startup, query `archon_mcp_sessions` for active sessions
2. Load into SimplifiedSessionManager cache
3. Update `connected_at` timestamps
4. Mark as "recovered" in logs

### Session Timeout

**Feature**: Automatically close sessions after inactivity

**Implementation**:
1. Add `last_activity_at` field to sessions table
2. Background job checks for inactive sessions
3. Close sessions inactive >1 hour
4. Update status to "timeout"

### Multi-User Support

**Feature**: Session-per-user instead of session-per-server

**Implementation**:
1. Add authentication middleware
2. Extract user ID from auth token
3. Create session with user context
4. Filter dashboard by user

---

## Glossary

| Term | Definition |
|------|------------|
| **FastMCP** | Fast Model Context Protocol - framework for building MCP servers |
| **Protocol Session** | MCP session managed by FastMCP for protocol communication |
| **Analytics Session** | Archon session for tracking tool usage and metrics |
| **Lazy Creation** | Creating resources only when first needed, not at startup |
| **Context** | FastMCP context object passed to tool functions |
| **Lifespan Context** | FastMCP context available during server lifespan |
| **SimplifiedSessionManager** | Archon's session tracking service |
| **StreamableHTTPSessionManager** | FastMCP's protocol session manager |

---

**Document Version**: 1.0
**Last Updated**: 2026-01-10
**Author**: documentation-expert
**Status**: Active
