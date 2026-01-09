"""
Client Manager Service

Manages database and API client connections with connection pooling.
"""

import os
import re
from typing import Optional

from supabase import Client, create_client

from ..config.logfire_config import search_logger

# Global Supabase client instance (singleton pattern)
_supabase_client: Optional[Client] = None
_connection_count = 0


def get_supabase_client() -> Client:
    """
    Get a persistent Supabase client instance with connection pooling.

    Uses a singleton pattern to ensure connection reuse across requests.
    The Supabase Python SDK uses httpx internally, which provides automatic
    connection pooling and keepalive for HTTP/1.1 connections.

    Returns:
        Supabase client instance (reused across all requests)

    Raises:
        ValueError: If SUPABASE_URL or SUPABASE_SERVICE_KEY are not set
    """
    global _supabase_client, _connection_count

    # Return existing client if already initialized
    if _supabase_client is not None:
        _connection_count += 1
        if _connection_count % 100 == 0:  # Log every 100 uses
            search_logger.info(
                f"Supabase client reused | total_uses={_connection_count}"
            )
        return _supabase_client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables"
        )

    try:
        # Create persistent Supabase client (singleton)
        # The httpx client used internally maintains a connection pool
        _supabase_client = create_client(url, key)
        _connection_count = 1

        # Extract project ID from URL for logging
        match = re.match(r"https://([^.]+)\.supabase\.co", url)
        project_id = "unknown"
        if match:
            project_id = match.group(1)

        search_logger.info(
            f"Supabase client initialized with connection pooling | "
            f"project_id={project_id} | "
            f"url={url.split('@')[0] if '@' in url else url[:50]}... | "
            f"connection_reuse=enabled"
        )

        return _supabase_client

    except Exception as e:
        search_logger.error(f"Failed to create Supabase client | error={str(e)}")
        raise


def close_supabase_client():
    """
    Close the Supabase client and release connection pool resources.

    Call this during application shutdown to cleanly close connections.
    This is registered as a shutdown hook in the FastAPI app.
    """
    global _supabase_client, _connection_count

    if _supabase_client is not None:
        try:
            # Note: Supabase Python SDK doesn't expose explicit close method
            # httpx clients used internally will be garbage collected
            search_logger.info(
                f"Supabase client shutdown | total_uses={_connection_count}"
            )
            _supabase_client = None
            _connection_count = 0
        except Exception as e:
            search_logger.error(f"Error closing Supabase client | error={str(e)}")


def get_connection_stats() -> dict:
    """
    Get connection pool statistics.

    Returns:
        Dictionary with connection usage statistics
    """
    return {
        "is_initialized": _supabase_client is not None,
        "total_uses": _connection_count,
        "connection_pooling": "enabled" if _supabase_client is not None else "disabled"
    }
