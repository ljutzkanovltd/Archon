"""
Direct database utilities for bypassing PostgREST when needed.

Used for tables that haven't been added to PostgREST schema cache yet
or when direct PostgreSQL access is preferred for performance.
"""

import os
from typing import Optional
import asyncpg


async def get_direct_db_connection() -> asyncpg.Connection:
    """
    Get a direct PostgreSQL connection bypassing PostgREST.

    Uses asyncpg for direct database access. Connection must be closed
    after use in a try/finally block.

    Returns:
        asyncpg.Connection: Direct PostgreSQL connection

    Raises:
        ValueError: If DATABASE_URI not set
        Exception: If connection fails
    """
    database_uri = os.getenv("DATABASE_URI")
    if not database_uri:
        raise ValueError("DATABASE_URI environment variable not set")

    # PgBouncer compatibility: Disable statement cache for transaction pooling mode (port 6543)
    return await asyncpg.connect(database_uri, statement_cache_size=0)
