"""
MCP Request Tracking Utility

Provides utilities for tracking MCP requests with automatic token counting and cost estimation.
This module acts as a middleware/wrapper for MCP tool calls.
"""

import json
import time
from typing import Any, Callable, Optional

from src.server.services.mcp_session_manager import get_session_manager


def extract_text_from_args(**kwargs) -> tuple[Optional[str], Optional[str]]:
    """
    Extract prompt and completion text from MCP tool arguments.

    Args:
        **kwargs: Tool arguments (query, response, etc.)

    Returns:
        Tuple of (prompt_text, completion_text)
    """
    prompt_text = None
    completion_text = None

    # Common prompt-like fields
    prompt_fields = ["query", "prompt", "question", "input", "content"]
    for field in prompt_fields:
        if field in kwargs and kwargs[field]:
            prompt_text = str(kwargs[field])
            break

    # Common completion-like fields
    completion_fields = ["response", "output", "result", "answer"]
    for field in completion_fields:
        if field in kwargs and kwargs[field]:
            completion_text = str(kwargs[field])
            break

    return prompt_text, completion_text


def extract_text_from_result(result: Any) -> Optional[str]:
    """
    Extract text from MCP tool result for token counting.

    Args:
        result: Tool result (JSON string, dict, or other)

    Returns:
        Extracted text or None
    """
    try:
        # If result is a string, try to parse as JSON
        if isinstance(result, str):
            try:
                parsed = json.loads(result)
                # Look for common result fields
                if isinstance(parsed, dict):
                    # Try to extract meaningful content
                    for key in ["content", "result", "data", "answer", "response"]:
                        if key in parsed:
                            return json.dumps(parsed[key]) if isinstance(parsed[key], (dict, list)) else str(parsed[key])
                    # Fallback: return entire JSON
                    return result
            except (json.JSONDecodeError, TypeError):
                # Not JSON, return as-is
                return result

        # If dict, extract content
        elif isinstance(result, dict):
            for key in ["content", "result", "data", "answer", "response"]:
                if key in result:
                    return json.dumps(result[key]) if isinstance(result[key], (dict, list)) else str(result[key])
            # Fallback: stringify entire dict
            return json.dumps(result)

        # Other types: convert to string
        else:
            return str(result)

    except Exception:
        return None


async def track_mcp_request(
    session_id: str,
    method: str,
    tool_name: Optional[str] = None,
    model: str = "claude-3-5-sonnet-20241022",
    **kwargs
) -> Callable:
    """
    Decorator/context manager for tracking MCP requests with automatic token counting.

    Usage:
        @track_mcp_request(session_id, "tools/call", "rag_search")
        async def my_tool(query: str):
            return result

    Args:
        session_id: Session ID making the request
        method: MCP method (e.g., "tools/call", "resources/read")
        tool_name: Name of the tool
        model: Model name for token counting
        **kwargs: Additional context (prompt text, etc.)

    Returns:
        Decorator function
    """
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **func_kwargs):
            start_time = time.time()
            session_manager = get_session_manager()

            # Extract text from arguments for prompt counting
            prompt_text, _ = extract_text_from_args(**func_kwargs)

            try:
                # Execute the actual function
                result = await func(*args, **func_kwargs)

                # Extract text from result for completion counting
                completion_text = extract_text_from_result(result)

                # Calculate duration
                duration_ms = int((time.time() - start_time) * 1000)

                # Track request with automatic token counting
                session_manager.track_request(
                    session_id=session_id,
                    method=method,
                    tool_name=tool_name,
                    prompt_text=prompt_text,
                    completion_text=completion_text,
                    model=model,
                    duration_ms=duration_ms,
                    status="success"
                )

                return result

            except Exception as e:
                # Track failed request
                duration_ms = int((time.time() - start_time) * 1000)
                session_manager.track_request(
                    session_id=session_id,
                    method=method,
                    tool_name=tool_name,
                    prompt_text=prompt_text,
                    model=model,
                    duration_ms=duration_ms,
                    status="error",
                    error_message=str(e)
                )
                raise

        return wrapper
    return decorator


async def track_simple_request(
    session_id: str,
    method: str,
    tool_name: str,
    prompt_text: Optional[str] = None,
    completion_text: Optional[str] = None,
    duration_ms: Optional[int] = None,
    model: str = "claude-3-5-sonnet-20241022",
    status: str = "success",
    error_message: Optional[str] = None
) -> None:
    """
    Track a simple MCP request without decorator.

    This is useful for tracking requests inline without wrapping the entire function.

    Args:
        session_id: Session ID
        method: MCP method
        tool_name: Tool name
        prompt_text: Prompt text for token counting
        completion_text: Completion text for token counting
        duration_ms: Request duration in milliseconds
        model: Model name
        status: Request status ("success", "error")
        error_message: Error message if status is "error"
    """
    session_manager = get_session_manager()

    session_manager.track_request(
        session_id=session_id,
        method=method,
        tool_name=tool_name,
        prompt_text=prompt_text,
        completion_text=completion_text,
        model=model,
        duration_ms=duration_ms,
        status=status,
        error_message=error_message
    )


__all__ = [
    "track_mcp_request",
    "track_simple_request",
    "extract_text_from_args",
    "extract_text_from_result",
]
