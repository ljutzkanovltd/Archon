# Archon Session Management Guide

Comprehensive guide to Archon's robust MCP session management system with automatic recovery, validation, and cleanup.

**Last Updated:** 2026-01-10
**Version:** 2.0 (Enhanced Session Management)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Session Lifecycle](#session-lifecycle)
4. [Key Features](#key-features)
5. [Implementation Details](#implementation-details)
6. [Client Integration](#client-integration)
7. [Debugging](#debugging)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Archon implements a **dual session management system** designed for reliability, observability, and crash recovery:

1. **FastMCP Protocol Sessions** - Managed by FastMCP framework for MCP protocol communication
2. **Archon Analytics Sessions** - Managed by SimplifiedSessionManager for tracking and observability

### Key Improvements (v2.0)

✅ **Session Validation** - Every request validates session is active before reuse
✅ **Session Recovery** - Active sessions loaded from database after server restart
✅ **Background Cleanup** - Periodic task expires and cleans old sessions (every 5 minutes)
✅ **Client Session ID Support** - Clients can provide session IDs for validation
✅ **MCP Client Wrapper** - Standardized client library with automatic reconnection
✅ **MCP Inspector Integration** - Full support for official MCP debugging tool

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   MCP Client (Claude Code, etc.)            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                   HTTP/JSON-RPC
                         │
┌────────────────────────┴────────────────────────────────────┐
│              FastMCP StreamableHTTPSessionManager           │
│              (Protocol-level session management)            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              @track_tool_execution decorator
                         │
                         ▼
┌────────────────────────┴────────────────────────────────────┐
│                 get_or_create_session()                     │
│  Priority 1: Client-provided session (validated)           │
│  Priority 2: Context session (validated)                   │
│  Priority 3: Create new session                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────┴────────────────────────────────────┐
│              SimplifiedSessionManager                       │
│  - In-memory cache (fast validation)                       │
│  - Database persistence (crash recovery)                   │
│  - Background cleanup (resource management)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────┴────────────────────────────────────┐
│              Supabase PostgreSQL Database                   │
│  - archon_mcp_sessions (session metadata)                  │
│  - archon_mcp_requests (request tracking)                  │
└─────────────────────────────────────────────────────────────┘
```

### Session ID Flow

```
Client Request
     │
     ├─ X-MCP-Session-Id: <fastmcp_session>       (FastMCP protocol)
     └─ X-Archon-Session-Id: <archon_session>     (Archon analytics)
                 │
                 ▼
        Session Validation
                 │
     ┌───────────┴───────────┐
     │                       │
     ▼                       ▼
  Valid?                  Invalid?
     │                       │
     │                       ▼
     │              Create New Session
     │                       │
     └───────────┬───────────┘
                 │
                 ▼
        Execute Tool Call
                 │
                 ▼
        Track Request in DB
                 │
                 ▼
  Response with X-Archon-Session-Id
```

---

## Session Lifecycle

### Creation

**Lazy Creation** - Sessions created on first tool call, not at server startup.

```python
# First tool call triggers session creation
result = await client.call_tool("health_check")

# Session created:
# 1. Generate UUID for session_id
# 2. Extract client info (name, version, capabilities)
# 3. Persist to archon_mcp_sessions table
# 4. Store in in-memory cache
# 5. Return X-Archon-Session-Id header
```

**Database Record:**
```sql
INSERT INTO archon_mcp_sessions (
    session_id,
    client_type,
    client_version,
    connected_at,
    last_activity,
    status
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'Claude Code',
    '1.0.0',
    '2026-01-10 12:00:00',
    '2026-01-10 12:00:00',
    'active'
);
```

### Validation

**Every Request** - Session validated before reuse to prevent stale session usage.

```python
def validate_session(session_id: str) -> bool:
    """
    Validates session is active and not expired.

    Returns:
        True if session is valid, False otherwise
    """
    # Check in-memory cache
    if session_id not in self.sessions:
        # Try to load from database
        session = db.query(session_id)
        if session and session.status == 'active':
            self.sessions[session_id] = now
            return True
        return False

    # Check timeout
    if now - last_seen > timeout:
        self._disconnect_session(session_id)
        return False

    # Update last_activity
    self.sessions[session_id] = now
    db.update(session_id, last_activity=now)

    return True
```

### Recovery

**Server Restart** - Active sessions loaded from database on startup.

```python
def recover_active_sessions() -> list[str]:
    """
    Load active sessions from database after restart.

    Called in lifespan() on server startup.
    """
    cutoff = now - timeout
    sessions = db.query(
        status='active',
        last_activity >= cutoff
    )

    for session in sessions:
        self.sessions[session.id] = session.last_activity

    logger.info(f"✅ Recovered {len(sessions)} sessions")
    return [s.id for s in sessions]
```

### Cleanup

**Background Task** - Periodic cleanup every 5 minutes.

```python
async def periodic_session_cleanup(interval_seconds: int = 300):
    """
    Background task to clean up expired sessions.

    Runs every 5 minutes to:
    - Remove from in-memory cache
    - Mark as expired in database
    - Update disconnect_reason
    """
    while True:
        await asyncio.sleep(interval_seconds)

        expired = session_manager.cleanup_expired_sessions()

        if expired > 0:
            logger.info(f"🧹 Cleaned up {expired} expired sessions")
```

**Database Update:**
```sql
UPDATE archon_mcp_sessions
SET
    status = 'expired',
    disconnected_at = NOW(),
    disconnect_reason = 'timeout'
WHERE session_id = ?;
```

### Closure

**Explicit Close** - Session closed gracefully with duration tracking.

```python
def close_session(session_id: str, reason: str = "client_disconnect"):
    """
    Close session and calculate total duration.

    Args:
        session_id: Session UUID to close
        reason: Closure reason ('client_disconnect', 'timeout', 'error')
    """
    # Remove from cache
    del self.sessions[session_id]

    # Update database with duration
    session = db.get(session_id)
    disconnected_at = datetime.now()
    total_duration = (disconnected_at - session.connected_at).total_seconds()

    db.update(
        session_id,
        disconnected_at=disconnected_at,
        total_duration=total_duration,
        status='disconnected',
        disconnect_reason=reason
    )
```

---

## Key Features

### 1. Session Validation

**Every request validates session before reuse:**

- ✅ Checks if session exists in memory or database
- ✅ Verifies session hasn't exceeded timeout
- ✅ Updates last_activity timestamp
- ✅ Prevents stale session reuse

**Benefits:**
- No requests with expired sessions
- Automatic session recovery from database
- Real-time session state tracking

---

### 2. Session Recovery

**After server restart, active sessions are recovered:**

- ✅ Queries database for sessions within timeout window
- ✅ Loads session metadata into in-memory cache
- ✅ Continues tracking without creating new sessions
- ✅ Maintains continuity across restarts

**Recovery Query:**
```sql
SELECT session_id, last_activity
FROM archon_mcp_sessions
WHERE status = 'active'
  AND last_activity >= (NOW() - INTERVAL '1 hour')
ORDER BY last_activity DESC;
```

---

### 3. Background Cleanup

**Periodic cleanup task (every 5 minutes):**

- ✅ Removes expired sessions from memory
- ✅ Marks sessions as expired in database
- ✅ Records disconnect reason and timestamp
- ✅ Prevents memory leaks

**Cleanup Log Example:**
```
🧹 Starting background session cleanup (interval: 300s)
🧹 Cleaned up 3 expired sessions
Session abc123 marked as expired in database
Session def456 marked as expired in database
Session ghi789 marked as expired in database
```

---

### 4. Client Session ID Validation

**Clients can provide their own session IDs:**

- ✅ Extract from `X-Archon-Session-Id` header
- ✅ Validate client-provided session ID
- ✅ Reuse if valid, create new if invalid
- ✅ Log warnings for invalid sessions

**Priority Order:**
1. Client-provided session (if valid)
2. Context session (if valid)
3. Create new session

**Example Request:**
```bash
curl -X POST http://localhost:8051/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-MCP-Session-Id: <fastmcp_session_id>" \
  -H "X-Archon-Session-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{"jsonrpc":"2.0","id":"req-1","method":"tools/call","params":{"name":"health_check","arguments":{}}}'
```

**CRITICAL**: Always include `Accept: application/json, text/event-stream` header for FastMCP compatibility.

---

### 5. MCP Client Wrapper

**Standardized client library for MCP interactions:**

- ✅ Automatic session initialization
- ✅ Retry logic with exponential backoff
- ✅ Session error detection and recovery
- ✅ Resource cleanup with context manager
- ✅ Comprehensive logging

**Usage:**
```python
from src.mcp_server.utils.mcp_client_wrapper import MCPClient

async with MCPClient() as client:
    # Automatic session management
    result = await client.call_tool("find_projects", {"query": "auth"})
```

See `@python/src/mcp_server/utils/README_MCP_CLIENT.md` for complete documentation.

---

### 6. MCP Inspector Integration

**Official MCP debugging tool fully supported:**

- ✅ Connect to Archon MCP endpoint
- ✅ Test tools interactively
- ✅ Inspect request/response messages
- ✅ Monitor session management

**Launch:**
```bash
./scripts/launch-mcp-inspector.sh
```

See `@docs/MCP_INSPECTOR_SETUP.md` for complete guide.

---

## Implementation Details

### Session Manager Configuration

**File:** `/python/src/server/services/mcp_session_manager.py`

**Constructor:**
```python
SimplifiedSessionManager(
    timeout=3600,          # 1 hour timeout
    use_database=True      # Enable database persistence
)
```

**Global Instance:**
```python
def get_session_manager() -> SimplifiedSessionManager:
    """Get global session manager instance."""
    global _session_manager
    if _session_manager is None:
        _session_manager = SimplifiedSessionManager()
    return _session_manager
```

---

### Session Tracking Decorator

**File:** `/python/src/mcp_server/utils/session_tracking.py`

**Decorator:**
```python
@track_tool_execution
async def my_tool(ctx: Context, ...) -> str:
    """Tool function with automatic session tracking."""
    ...
```

**What it does:**
1. Extracts session IDs from request headers
2. Gets or creates Archon session
3. Executes tool function
4. Tracks request in database
5. Handles errors and cleanup

---

### Database Schema

**Sessions Table:**
```sql
CREATE TABLE archon_mcp_sessions (
    session_id UUID PRIMARY KEY,
    client_type TEXT,
    client_version TEXT,
    client_capabilities JSONB,
    connected_at TIMESTAMP,
    last_activity TIMESTAMP,
    disconnected_at TIMESTAMP,
    total_duration INTEGER,
    status TEXT CHECK (status IN ('active', 'disconnected', 'expired')),
    disconnect_reason TEXT,
    user_id UUID,
    user_email TEXT,
    user_name TEXT,
    metadata JSONB
);
```

**Requests Table:**
```sql
CREATE TABLE archon_mcp_requests (
    id SERIAL PRIMARY KEY,
    session_id UUID REFERENCES archon_mcp_sessions(session_id),
    method TEXT,
    tool_name TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    estimated_cost DECIMAL(10, 6),
    timestamp TIMESTAMP,
    duration_ms INTEGER,
    status TEXT CHECK (status IN ('success', 'error', 'timeout')),
    error_message TEXT
);
```

---

## Client Integration

### Using MCP Client Wrapper

**Recommended approach for robust MCP interactions:**

```python
from src.mcp_server.utils.mcp_client_wrapper import MCPClient

# Context manager (recommended)
async with MCPClient() as client:
    # Session automatically initialized
    result = await client.call_tool("health_check")

# Manual lifecycle
client = MCPClient()
try:
    await client.initialize()
    result = await client.call_tool("find_projects")
finally:
    await client.close()

# One-off calls
result = await call_mcp_tool("health_check")
```

---

### Direct HTTP Integration

**For custom clients not using Python wrapper:**

```bash
# 1. Initialize session (MUST include BOTH Accept headers)
curl -X POST http://localhost:8051/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "init-1",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "MyClient", "version": "1.0.0"}
    }
  }'

# Extract session ID from response headers:
# - mcp-session-id: <fastmcp_session>
# - X-Archon-Session-Id: <archon_session>

# 2. Make tool calls with session IDs (MUST include BOTH Accept headers)
curl -X POST http://localhost:8051/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-MCP-Session-Id: <fastmcp_session>" \
  -H "X-Archon-Session-Id: <archon_session>" \
  -d '{
    "jsonrpc": "2.0",
    "id": "tool-1",
    "method": "tools/call",
    "params": {
      "name": "find_projects",
      "arguments": {"query": "authentication"}
    }
  }'
```

---

## Debugging

### Session Tracking Dashboard

**View active sessions:**
```sql
SELECT
    session_id,
    client_type,
    client_version,
    connected_at,
    last_activity,
    status
FROM archon_mcp_sessions
WHERE status = 'active'
ORDER BY last_activity DESC;
```

**View session requests:**
```sql
SELECT
    s.session_id,
    s.client_type,
    r.tool_name,
    r.status,
    r.duration_ms,
    r.timestamp
FROM archon_mcp_sessions s
JOIN archon_mcp_requests r ON s.session_id = r.session_id
WHERE s.session_id = '<session_id>'
ORDER BY r.timestamp DESC;
```

---

### Logs

**MCP Server Logs:**
```bash
docker logs -f archon-mcp

# Filter for session events
docker logs archon-mcp 2>&1 | grep -E "session|Session"
```

**Session creation:**
```
✓ Archon tracking session created on first tool call - session: abc123, client: Claude Code
```

**Session validation:**
```
✓ Reusing valid session: abc123
⚠️ Session abc123 invalid/expired, creating new session
```

**Session recovery:**
```
✅ Recovered 3 active sessions from database after restart
```

**Background cleanup:**
```
🧹 Starting background session cleanup (interval: 300s)
🧹 Cleaned up 2 expired sessions
```

---

### Testing

**Run comprehensive test suite:**
```bash
./scripts/test-session-management.sh
```

**Tests include:**
- Session creation and persistence
- Session validation and reuse
- Client session ID validation
- Background cleanup monitoring
- Session recovery after restart
- Database integrity checks

---

## Best Practices

### ✅ DO

1. **Use context manager for clients**
   ```python
   async with MCPClient() as client:
       result = await client.call_tool(...)
   ```

2. **Provide client info for tracking**
   ```python
   client = MCPClient(
       client_name="MyApp",
       client_version="2.0.0"
   )
   ```

3. **Handle session errors gracefully**
   ```python
   try:
       result = await client.call_tool(...)
   except MCPSessionError:
       # Reinitialize or fallback
   ```

4. **Monitor session metrics**
   ```sql
   SELECT client_type, COUNT(*), AVG(total_duration)
   FROM archon_mcp_sessions
   GROUP BY client_type;
   ```

5. **Close sessions explicitly**
   ```python
   await client.close()
   ```

---

### ❌ DON'T

1. **Don't bypass session validation**
   - Always use validated sessions
   - Don't manually manipulate session cache

2. **Don't ignore invalid session warnings**
   - Investigate cause of session invalidation
   - Check server logs for errors

3. **Don't create excessive sessions**
   - Reuse sessions for multiple calls
   - Use persistent client instance

4. **Don't hardcode session IDs**
   - Let system manage session lifecycle
   - Only provide session ID for recovery scenarios

5. **Don't skip cleanup**
   - Always close clients when done
   - Use context managers for automatic cleanup

---

## Troubleshooting

### Sessions Not Persisting

**Symptom:** Sessions created but not found in database

**Checks:**
1. Verify database connection: `docker exec -it supabase-ai-db psql -U postgres`
2. Check `use_database=True` in SimplifiedSessionManager
3. Review logs for database errors
4. Verify table exists: `SELECT * FROM archon_mcp_sessions LIMIT 1;`

---

### Sessions Expiring Too Quickly

**Symptom:** Frequent session invalidation warnings

**Solutions:**
1. Increase timeout in SimplifiedSessionManager constructor
2. Check network latency causing delayed requests
3. Verify background cleanup interval is appropriate
4. Review session activity patterns in database

---

### Requests Not Tracked

**Symptom:** Sessions exist but no requests in archon_mcp_requests

**Checks:**
1. Verify `@track_tool_execution` decorator applied to tools
2. Check logs for "Failed to track request" errors
3. Verify database schema matches expected structure
4. Test with simple tool call: `health_check`

---

### Session Recovery Failures

**Symptom:** Sessions not recovered after restart

**Checks:**
1. Verify `recover_active_sessions()` called in lifespan
2. Check logs for recovery message
3. Query database for active sessions before restart
4. Verify timeout window is reasonable (default: 1 hour)

---

## Additional Resources

- **MCP Protocol Specification:** https://spec.modelcontextprotocol.io/
- **Session Manager Implementation:** `@python/src/server/services/mcp_session_manager.py`
- **Session Tracking Utilities:** `@python/src/mcp_server/utils/session_tracking.py`
- **MCP Client Wrapper:** `@python/src/mcp_server/utils/README_MCP_CLIENT.md`
- **MCP Inspector Guide:** `@docs/MCP_INSPECTOR_SETUP.md`
- **Session Architecture:** `@.claude/docs/MCP_SESSION_ARCHITECTURE.md`

---

**Version History:**
- **v2.0 (2026-01-10):** Enhanced session management with validation, recovery, cleanup, and client wrapper
- **v1.0 (2025-12-15):** Initial lazy session creation implementation

---

**Maintainer:** Archon Development Team
**Last Updated:** 2026-01-10
