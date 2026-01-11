"""
Session tracking utilities for MCP tools.

Provides decorator and helper functions for automatic session creation,
request tracking, and session cleanup for MCP tool calls.
"""

import functools
import logging
import time
import traceback
from typing import Any, Optional

from mcp.server.fastmcp import Context

logger = logging.getLogger(__name__)


def close_session_on_error(session_id: str, error: Exception) -> None:
    """
    Close a session when a critical error occurs.

    Args:
        session_id: Session ID to close
        error: Exception that triggered the closure
    """
    try:
        from src.server.services.mcp_session_manager import get_session_manager

        session_manager = get_session_manager()
        session_manager.close_session(session_id, reason=f"error: {type(error).__name__}")
        logger.info(f"Session {session_id} closed due to error: {error}")
    except Exception as e:
        logger.error(f"Failed to close session on error: {e}")
        logger.error(traceback.format_exc())


def get_or_create_session(
    context: Any,
    fastmcp_session_id: Optional[str] = None,
    client_session_id: Optional[str] = None,
    client_info: dict = None
) -> str:
    """
    Get or create Archon session for tracking with client session ID validation.

    FastMCP handles MCP protocol sessions.
    Archon creates tracking sessions on first tool call.

    Session Priority (highest to lowest):
    1. Client-provided session ID (validated)
    2. Context session ID (validated)
    3. Create new session

    Args:
        context: ArchonContext or FastMCP context
        fastmcp_session_id: Optional FastMCP session ID for mapping
        client_session_id: Optional client-provided Archon session ID (from X-Archon-Session-Id header)
        client_info: Optional client metadata

    Returns:
        str: Archon session ID for tracking
    """
    from src.server.services.mcp_session_manager import get_session_manager

    session_manager = get_session_manager()

    # Priority 1: Client-provided session ID (if valid)
    if client_session_id:
        if session_manager.validate_session(client_session_id):
            logger.debug(f"✓ Client-provided session valid: {client_session_id}")
            # Store in context for subsequent calls
            if hasattr(context, 'session_id'):
                context.session_id = client_session_id
            return client_session_id
        else:
            logger.warning(f"⚠️ Client-provided session {client_session_id} invalid/expired, will create new session")

    # Priority 2: Context session ID (if valid)
    if hasattr(context, 'session_id') and context.session_id:
        # VALIDATE session is still active before reusing
        if session_manager.validate_session(context.session_id):
            logger.debug(f"✓ Reusing valid context session: {context.session_id}")
            return context.session_id
        else:
            # Session expired or invalid - clear it
            logger.warning(f"⚠️ Context session {context.session_id} invalid/expired, creating new session")
            context.session_id = None

    # Priority 3: Create new Archon tracking session
    try:
        if not client_info:
            client_info = {"name": "unknown-client", "version": "unknown"}

        session_id = session_manager.create_session(
            client_info=client_info,
            user_context=None  # Single-user mode
        )

        # Store in context for subsequent tool calls
        if hasattr(context, 'session_id'):
            context.session_id = session_id

        log_msg = f"✓ Archon tracking session created on first tool call - session: {session_id}, client: {client_info.get('name', 'unknown')}"
        if fastmcp_session_id:
            log_msg += f", FastMCP session: {fastmcp_session_id}"
        if client_session_id:
            log_msg += f" (replaced invalid client session: {client_session_id})"
        logger.info(log_msg)

        return session_id

    except Exception as e:
        logger.error(f"Failed to create Archon session: {e}")
        logger.error(traceback.format_exc())
        # Don't use "unknown-session" - propagate the error
        raise RuntimeError(f"Failed to create Archon session: {e}") from e


def track_tool_execution(func):
    """
    Decorator to track MCP tool execution in database.

    Captures:
    - Session creation on first tool call
    - Tool execution time and status
    - Errors and debugging information
    - Request metadata for dashboard analytics

    Applied to all @mcp.tool() functions to ensure complete tracking.

    Usage:
        @mcp.tool()
        @track_tool_execution
        async def my_tool(ctx: Context, ...) -> str:
            ...
    """
    @functools.wraps(func)
    async def wrapper(ctx: Context, *args, **kwargs):
        start_time = time.time()
        tool_name = func.__name__
        status = "success"
        error_message = None
        session_id = None

        try:
            # Extract session IDs from request context
            fastmcp_session_id = None
            client_session_id = None

            if hasattr(ctx, "request_context") and ctx.request_context:
                # Try to extract FastMCP session from request headers or metadata
                if hasattr(ctx.request_context, "session_id"):
                    fastmcp_session_id = ctx.request_context.session_id
                elif hasattr(ctx.request_context, "headers"):
                    # Check for session ID headers
                    headers = ctx.request_context.headers
                    if isinstance(headers, dict):
                        fastmcp_session_id = headers.get("X-MCP-Session-Id") or headers.get("x-mcp-session-id")
                        # Extract client-provided Archon session ID
                        client_session_id = headers.get("X-Archon-Session-Id") or headers.get("x-archon-session-id")

                        if client_session_id:
                            logger.debug(f"Client provided Archon session ID: {client_session_id}")

            # Get or create Archon session from lifespan context
            if hasattr(ctx, "request_context") and hasattr(ctx.request_context, "lifespan_context"):
                context = ctx.request_context.lifespan_context

                # Extract client info from FastMCP context if available
                client_info = {"name": "unknown-client", "version": "unknown"}
                if hasattr(ctx, "meta") and ctx.meta:
                    if hasattr(ctx.meta, "client_info") and ctx.meta.client_info:
                        client_info = ctx.meta.client_info
                    elif hasattr(ctx.meta, "progressToken"):
                        # Try to infer client from metadata
                        client_info = {"name": "MCP Client", "version": "unknown"}

                # Get or create Archon tracking session (with client session ID validation)
                session_id = get_or_create_session(context, fastmcp_session_id, client_session_id, client_info)
            else:
                # No context available - this should not happen with FastMCP
                logger.error(f"Tool {tool_name}: No lifespan_context available - cannot create session")
                raise RuntimeError("No lifespan_context available for session creation")

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
            # Track request in database (only if session was created)
            if session_id:
                duration_ms = int((time.time() - start_time) * 1000)
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
                    logger.info(f"✓ Tracked tool call - tool: {tool_name}, session: {session_id}, duration: {duration_ms:.2f}ms, status: {status}")
                except Exception as track_error:
                    logger.error(f"Failed to track tool execution: {track_error}")
                    logger.error(traceback.format_exc())
            else:
                logger.warning(f"Tool {tool_name}: No session ID - request not tracked")

    return wrapper
