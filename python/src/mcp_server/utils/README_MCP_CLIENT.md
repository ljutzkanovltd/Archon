# MCP Client Wrapper Utilities

Robust, session-aware MCP client wrapper for standardized MCP interactions with automatic reconnection and error handling.

## Features

✅ **Automatic Session Management** - Sessions initialized on first tool call, validated before reuse
✅ **Retry Logic** - Automatic retry with exponential backoff for transient failures
✅ **Session Recovery** - Automatically reinitializes session on session errors
✅ **Resource Cleanup** - Proper cleanup with context manager support
✅ **Comprehensive Logging** - Detailed logging for debugging and monitoring
✅ **Type Safety** - Full type hints for better IDE support
✅ **Error Handling** - Custom exceptions for different failure modes

## Quick Start

### Basic Usage (Recommended)

```python
from src.mcp_server.utils.mcp_client_wrapper import MCPClient

async with MCPClient() as client:
    # List available tools
    tools = await client.list_tools()

    # Call a tool
    result = await client.call_tool("find_projects", {"query": "authentication"})

    # Check health
    health = await client.health_check()
```

### One-Off Tool Calls

```python
from src.mcp_server.utils.mcp_client_wrapper import call_mcp_tool, check_mcp_health

# Quick health check
is_healthy = await check_mcp_health()

# Single tool call
result = await call_mcp_tool("find_tasks", {"filter_by": "status", "filter_value": "todo"})
```

### Manual Lifecycle Management

```python
from src.mcp_server.utils.mcp_client_wrapper import MCPClient

client = MCPClient()
try:
    await client.initialize()

    # Make multiple calls
    result1 = await client.call_tool("health_check")
    result2 = await client.call_tool("find_projects")
finally:
    await client.close()
```

## API Reference

### MCPClient Class

#### Constructor

```python
MCPClient(
    base_url: str = "http://localhost:8051",
    timeout: float = 30.0,
    max_retries: int = 3,
    retry_delay: float = 1.0,
    client_name: str = "ArchonMCPClient",
    client_version: str = "1.0.0"
)
```

**Parameters:**
- `base_url`: MCP server base URL
- `timeout`: Request timeout in seconds (default: 30.0)
- `max_retries`: Maximum retry attempts for failed requests (default: 3)
- `retry_delay`: Delay between retries in seconds (default: 1.0)
- `client_name`: Client identification name (default: "ArchonMCPClient")
- `client_version`: Client version string (default: "1.0.0")

#### Methods

##### `initialize() -> Dict[str, Any]`

Initialize MCP session with server.

**Returns:** Server capabilities and session info

**Raises:** `MCPConnectionError` if initialization fails

---

##### `call_tool(tool_name: str, arguments: Optional[Dict[str, Any]] = None, retry_on_session_error: bool = True) -> Dict[str, Any]`

Call an MCP tool with automatic session management and retry logic.

**Parameters:**
- `tool_name`: Name of the tool to call
- `arguments`: Tool arguments (optional)
- `retry_on_session_error`: Retry with new session if session error occurs (default: True)

**Returns:** Tool execution result

**Raises:**
- `MCPSessionError` if session management fails
- `MCPConnectionError` if connection to server fails

---

##### `list_tools() -> Dict[str, Any]`

List available MCP tools.

**Returns:** List of available tools with metadata

**Raises:** `MCPConnectionError` if request fails

---

##### `health_check() -> Dict[str, Any]`

Check MCP server health.

**Returns:** Health status information

**Raises:** `MCPConnectionError` if health check fails

---

##### `close() -> None`

Close MCP session and cleanup resources.

---

### Convenience Functions

#### `call_mcp_tool(tool_name: str, arguments: Optional[Dict[str, Any]] = None, base_url: str = "http://localhost:8051") -> Dict[str, Any]`

Convenience function for one-off MCP tool calls. Automatically handles session initialization and cleanup.

**Example:**
```python
result = await call_mcp_tool("health_check")
tasks = await call_mcp_tool("find_tasks", {"filter_by": "status", "filter_value": "todo"})
```

---

#### `check_mcp_health(base_url: str = "http://localhost:8051") -> bool`

Quick health check for MCP server.

**Returns:** True if server is healthy, False otherwise

---

### Custom Exceptions

#### `MCPSessionError`

Raised when MCP session operations fail (e.g., invalid session ID, session expired).

#### `MCPConnectionError`

Raised when MCP server connection fails (e.g., network error, server unavailable).

---

## Session Management

The client implements a **3-tier session management strategy**:

1. **MCP Protocol Session**: FastMCP framework manages protocol-level sessions
2. **Archon Analytics Session**: Created lazily on first tool call for tracking
3. **Client Session State**: Maintained in `MCPClient` instance

### Session ID Headers

The client automatically manages two session ID headers:

- `X-MCP-Session-Id`: FastMCP protocol session (from server)
- `X-Archon-Session-Id`: Archon analytics session (from server response)

### Session Recovery

If a session becomes invalid (e.g., after server restart), the client will:

1. Detect session error (HTTP 400 with "session" in error message)
2. Automatically reinitialize session
3. Retry the failed request with new session
4. Continue operation transparently

---

## Error Handling

### Retry Logic

The client implements automatic retry with configurable parameters:

```python
client = MCPClient(
    max_retries=5,      # Retry up to 5 times
    retry_delay=2.0     # Wait 2 seconds between retries
)
```

### Error Handling Pattern

```python
from src.mcp_server.utils.mcp_client_wrapper import MCPClient, MCPConnectionError, MCPSessionError

try:
    async with MCPClient() as client:
        result = await client.call_tool("find_projects")
except MCPSessionError as e:
    # Handle session-specific errors
    logger.error(f"Session error: {e}")
except MCPConnectionError as e:
    # Handle connection errors
    logger.error(f"Connection error: {e}")
except Exception as e:
    # Handle unexpected errors
    logger.error(f"Unexpected error: {e}")
```

---

## Examples

See `/python/examples/mcp_client_usage.py` for comprehensive usage examples including:

1. Context manager pattern
2. Manual lifecycle management
3. Convenience functions
4. Error handling
5. Session persistence
6. Custom configuration

Run examples:
```bash
cd /home/ljutzkanov/Documents/Projects/archon
python -m examples.mcp_client_usage
```

---

## Configuration

### Environment Variables

The client respects standard environment variables:

- `MCP_SERVER_URL`: Override default MCP server URL
- `MCP_TIMEOUT`: Override default timeout
- `MCP_MAX_RETRIES`: Override default max retries

### Custom Configuration

```python
client = MCPClient(
    base_url="http://custom-server:8051",
    timeout=60.0,           # 60 second timeout
    max_retries=5,          # 5 retry attempts
    retry_delay=3.0,        # 3 seconds between retries
    client_name="MyClient",
    client_version="2.0.0"
)
```

---

## Best Practices

### ✅ DO

- Use context manager (`async with MCPClient()`) for automatic cleanup
- Use convenience functions for one-off calls
- Configure appropriate timeout for your use case
- Handle `MCPSessionError` and `MCPConnectionError` separately
- Use meaningful `client_name` and `client_version` for debugging

### ❌ DON'T

- Don't forget to close client if not using context manager
- Don't set `max_retries` too high (causes long delays on failures)
- Don't catch generic `Exception` - use specific exceptions
- Don't create new client for every tool call (use persistent session)
- Don't ignore session errors - they indicate server issues

---

## Troubleshooting

### "No session ID returned from server"

**Cause:** Server didn't include session ID in response headers

**Solution:** This is a warning, not an error. Session management may still work via cookies or other mechanisms.

---

### "Session error detected, reinitializing..."

**Cause:** Server rejected request due to invalid/expired session

**Solution:** Client automatically reinitializes. If this happens frequently, check:
1. Server uptime/restart frequency
2. Session timeout configuration
3. Network stability

---

### "Tool call failed after X attempts"

**Cause:** Server unavailable or persistent error

**Solution:**
1. Check server health: `curl http://localhost:8051/health`
2. Check server logs: `docker logs archon-mcp`
3. Verify network connectivity
4. Increase `max_retries` if transient failures are common

---

## Integration with Archon

The MCP client wrapper integrates seamlessly with Archon's session tracking:

1. **First tool call**: Archon creates analytics session
2. **Response headers**: Server returns `X-Archon-Session-Id`
3. **Subsequent calls**: Client includes `X-Archon-Session-Id` in requests
4. **Session validation**: Archon validates session before processing
5. **Database tracking**: All requests tracked in `archon_mcp_requests` table

See `@.claude/docs/MCP_SESSION_ARCHITECTURE.md` for complete architecture details.

---

**Last Updated:** 2026-01-10
**Maintainer:** Archon Development Team
**License:** Internal Use Only
