"""
MCP Client Wrapper Utilities

Provides standardized, session-aware wrapper functions for MCP client operations.
Enforces robust session management, retry logic, and consistent error handling.

Usage:
    from src.mcp_server.utils.mcp_client_wrapper import MCPClient

    # Initialize client
    client = MCPClient(base_url="http://localhost:8051")

    # Make tool calls with automatic session management
    result = await client.call_tool("rag_search_knowledge_base", query="authentication")

    # Close session when done
    await client.close()
"""

import asyncio
import logging
import uuid
from typing import Any, Dict, Optional
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)


class MCPSessionError(Exception):
    """Raised when MCP session operations fail."""
    pass


class MCPConnectionError(Exception):
    """Raised when MCP server connection fails."""
    pass


class MCPClient:
    """
    Session-aware MCP client with automatic reconnection and error handling.

    Features:
    - Automatic session initialization on first tool call
    - Session ID validation and recovery
    - Retry logic for transient failures
    - Comprehensive logging for debugging
    - Resource cleanup on context exit

    Example:
        async with MCPClient() as client:
            result = await client.call_tool("health_check")
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8051",
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        client_name: str = "ArchonMCPClient",
        client_version: str = "1.0.0"
    ):
        """
        Initialize MCP client.

        Args:
            base_url: MCP server base URL
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            retry_delay: Delay between retries in seconds
            client_name: Client identification name
            client_version: Client version string
        """
        self.base_url = base_url.rstrip("/")
        self.mcp_endpoint = f"{self.base_url}/mcp"
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.client_name = client_name
        self.client_version = client_version

        # Session state
        self.session_id: Optional[str] = None
        self.archon_session_id: Optional[str] = None
        self.initialized = False

        # HTTP client
        self.http_client = httpx.AsyncClient(timeout=self.timeout)

        logger.info(f"MCPClient initialized - endpoint: {self.mcp_endpoint}")

    async def __aenter__(self):
        """Context manager entry - initialize session."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - close session and cleanup."""
        await self.close()
        return False

    async def initialize(self) -> Dict[str, Any]:
        """
        Initialize MCP session with server.

        Sends MCP initialize request and stores session ID.

        Returns:
            Server capabilities and session info

        Raises:
            MCPConnectionError: If initialization fails
        """
        if self.initialized:
            logger.debug(f"Session already initialized: {self.session_id}")
            return {"status": "already_initialized", "session_id": self.session_id}

        try:
            logger.info("Initializing MCP session...")

            # Prepare initialize request
            payload = {
                "jsonrpc": "2.0",
                "id": str(uuid.uuid4()),
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "roots": {"listChanged": True},
                        "sampling": {}
                    },
                    "clientInfo": {
                        "name": self.client_name,
                        "version": self.client_version
                    }
                }
            }

            # Send request
            response = await self.http_client.post(
                self.mcp_endpoint,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )

            response.raise_for_status()

            # Extract session ID from headers
            self.session_id = response.headers.get("mcp-session-id") or response.headers.get("MCP-Session-Id")

            if not self.session_id:
                logger.warning("No session ID returned from server - session management may not work")

            # Parse response
            result = response.json()

            self.initialized = True
            logger.info(f"✓ MCP session initialized successfully - session: {self.session_id}")

            return {
                "status": "initialized",
                "session_id": self.session_id,
                "capabilities": result.get("result", {}).get("capabilities", {})
            }

        except httpx.HTTPError as e:
            logger.error(f"Failed to initialize MCP session: {e}")
            raise MCPConnectionError(f"MCP initialization failed: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error during initialization: {e}")
            raise MCPConnectionError(f"Initialization error: {e}") from e

    async def call_tool(
        self,
        tool_name: str,
        arguments: Optional[Dict[str, Any]] = None,
        retry_on_session_error: bool = True
    ) -> Dict[str, Any]:
        """
        Call an MCP tool with automatic session management and retry logic.

        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments (optional)
            retry_on_session_error: Retry with new session if session error occurs

        Returns:
            Tool execution result

        Raises:
            MCPSessionError: If session management fails
            MCPConnectionError: If connection to server fails
        """
        # Ensure session is initialized
        if not self.initialized:
            await self.initialize()

        if arguments is None:
            arguments = {}

        # Prepare tool call request
        payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }

        # Build headers with session IDs
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        if self.session_id:
            headers["X-MCP-Session-Id"] = self.session_id

        if self.archon_session_id:
            headers["X-Archon-Session-Id"] = self.archon_session_id

        # Retry loop
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.debug(f"Calling tool '{tool_name}' (attempt {attempt}/{self.max_retries})")

                response = await self.http_client.post(
                    self.mcp_endpoint,
                    json=payload,
                    headers=headers
                )

                # Check for session errors (HTTP 400)
                if response.status_code == 400 and retry_on_session_error and attempt < self.max_retries:
                    error_text = response.text
                    if "session" in error_text.lower():
                        logger.warning(f"Session error detected, reinitializing... (attempt {attempt})")
                        # Reinitialize session and retry
                        self.initialized = False
                        self.session_id = None
                        await self.initialize()
                        # Update headers with new session ID
                        headers["X-MCP-Session-Id"] = self.session_id
                        await asyncio.sleep(self.retry_delay)
                        continue

                response.raise_for_status()

                # Parse result
                result = response.json()

                # Update Archon session ID if provided in response headers
                archon_session = response.headers.get("X-Archon-Session-Id")
                if archon_session and archon_session != self.archon_session_id:
                    self.archon_session_id = archon_session
                    logger.debug(f"Updated Archon session ID: {self.archon_session_id}")

                logger.info(f"✓ Tool '{tool_name}' executed successfully")

                return result.get("result", {})

            except httpx.HTTPStatusError as e:
                if attempt == self.max_retries:
                    logger.error(f"Tool call failed after {self.max_retries} attempts: {e}")
                    raise MCPConnectionError(f"Tool call failed: {e}") from e
                else:
                    logger.warning(f"Tool call failed (attempt {attempt}), retrying in {self.retry_delay}s...")
                    await asyncio.sleep(self.retry_delay)

            except httpx.HTTPError as e:
                if attempt == self.max_retries:
                    logger.error(f"HTTP error after {self.max_retries} attempts: {e}")
                    raise MCPConnectionError(f"HTTP error: {e}") from e
                else:
                    logger.warning(f"HTTP error (attempt {attempt}), retrying in {self.retry_delay}s...")
                    await asyncio.sleep(self.retry_delay)

            except Exception as e:
                logger.error(f"Unexpected error calling tool '{tool_name}': {e}")
                raise MCPConnectionError(f"Unexpected error: {e}") from e

        # Should not reach here, but for safety
        raise MCPConnectionError(f"Tool call failed after {self.max_retries} attempts")

    async def list_tools(self) -> Dict[str, Any]:
        """
        List available MCP tools.

        Returns:
            List of available tools with metadata

        Raises:
            MCPConnectionError: If request fails
        """
        if not self.initialized:
            await self.initialize()

        try:
            payload = {
                "jsonrpc": "2.0",
                "id": str(uuid.uuid4()),
                "method": "tools/list",
                "params": {}
            }

            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }

            if self.session_id:
                headers["X-MCP-Session-Id"] = self.session_id

            response = await self.http_client.post(
                self.mcp_endpoint,
                json=payload,
                headers=headers
            )

            response.raise_for_status()
            result = response.json()

            logger.info(f"✓ Retrieved {len(result.get('result', {}).get('tools', []))} available tools")

            return result.get("result", {})

        except Exception as e:
            logger.error(f"Failed to list tools: {e}")
            raise MCPConnectionError(f"List tools failed: {e}") from e

    async def health_check(self) -> Dict[str, Any]:
        """
        Check MCP server health.

        Returns:
            Health status information

        Raises:
            MCPConnectionError: If health check fails
        """
        try:
            response = await self.http_client.get(f"{self.base_url}/health")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            raise MCPConnectionError(f"Health check failed: {e}") from e

    async def close(self) -> None:
        """
        Close MCP session and cleanup resources.

        Logs session closure but does not send explicit close request
        (MCP protocol does not require explicit close).
        """
        if self.session_id:
            logger.info(f"Closing MCP session: {self.session_id}")

        await self.http_client.aclose()

        self.initialized = False
        self.session_id = None
        self.archon_session_id = None

        logger.info("✓ MCP client closed and resources cleaned up")


# Convenience functions for one-off tool calls

async def call_mcp_tool(
    tool_name: str,
    arguments: Optional[Dict[str, Any]] = None,
    base_url: str = "http://localhost:8051"
) -> Dict[str, Any]:
    """
    Convenience function for one-off MCP tool calls.

    Automatically handles session initialization and cleanup.

    Args:
        tool_name: Name of the tool to call
        arguments: Tool arguments (optional)
        base_url: MCP server base URL

    Returns:
        Tool execution result

    Example:
        result = await call_mcp_tool("health_check")
        tasks = await call_mcp_tool("find_tasks", {"filter_by": "status", "filter_value": "todo"})
    """
    async with MCPClient(base_url=base_url) as client:
        return await client.call_tool(tool_name, arguments)


async def check_mcp_health(base_url: str = "http://localhost:8051") -> bool:
    """
    Quick health check for MCP server.

    Args:
        base_url: MCP server base URL

    Returns:
        True if server is healthy, False otherwise
    """
    try:
        async with MCPClient(base_url=base_url) as client:
            health = await client.health_check()
            return health.get("status") == "healthy"
    except Exception as e:
        logger.error(f"MCP health check failed: {e}")
        return False
