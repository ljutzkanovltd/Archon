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


def get_or_create_session(context: Any, client_info: dict = None) -> str:
    """
    Get existing session ID or create a new one.

    This function checks if a session already exists in the context.
    If not, it creates a new session using the SimplifiedSessionManager.

    Args:
        context: ArchonContext with session_id field
        client_info: Optional client information dictionary

    Returns:
        str: Session ID (existing or newly created)
    """
    if hasattr(context, 'session_id') and context.session_id:
        return context.session_id

    try:
        from src.server.services.mcp_session_manager import get_session_manager

        session_manager = get_session_manager()
        # Create session with default client info if not provided
        if not client_info:
            client_info = {"name": "unknown-client", "version": "unknown"}

        session_id = session_manager.create_session(client_info)
        if hasattr(context, 'session_id'):
            context.session_id = session_id
        logger.info(f"✓ MCP session created - session: {session_id}, client: {client_info.get('name', 'unknown')}")
        return session_id

    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        logger.error(traceback.format_exc())
        return "unknown-session"


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
        session_id = "unknown-session"

        try:
            # Get or create session from context
            if hasattr(ctx, "request_context") and hasattr(ctx.request_context, "lifespan_context"):
                context = ctx.request_context.lifespan_context
                session_id = get_or_create_session(context)
            else:
                # FALLBACK: Use global session for single-user mode
                from src.mcp_server.mcp_server import _shared_context
                if _shared_context and hasattr(_shared_context, 'session_id'):
                    session_id = _shared_context.session_id
                    logger.debug(f"Tool {tool_name} using global session: {session_id}")
                else:
                    session_id = "unknown-session"
                    logger.warning(f"Tool {tool_name}: No session available - tracking will use unknown-session")

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
                logger.info(f"✓ Tracked tool call - tool: {tool_name}, session: {session_id}, duration: {duration_ms:.2f}ms, status: {status}")
            except Exception as track_error:
                logger.error(f"Failed to track tool execution: {track_error}")
                logger.error(traceback.format_exc())

    return wrapper
