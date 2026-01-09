"""
Database migration utilities for Archon.

Handles automatic schema initialization and migration to ensure
the database is always in the correct state on application startup.
"""

import logging
import os
from pathlib import Path
from typing import Optional

import asyncpg
from postgrest.exceptions import APIError

from ..services.client_manager import get_supabase_client

logger = logging.getLogger(__name__)


class MigrationError(Exception):
    """Raised when a migration operation fails."""

    pass


async def check_table_exists(table_name: str) -> bool:
    """
    Check if a table exists in the database via direct PostgreSQL connection.

    Uses asyncpg to bypass PostgREST, allowing access to any database
    regardless of PostgREST configuration.

    Args:
        table_name: Name of the table to check

    Returns:
        True if table exists, False otherwise
    """
    database_uri = os.getenv("DATABASE_URI")
    if not database_uri:
        raise ValueError("DATABASE_URI environment variable not set")

    try:
        # Connect directly to PostgreSQL
        # PgBouncer compatibility: Disable statement cache for transaction pooling mode (port 6543)
        conn = await asyncpg.connect(database_uri, statement_cache_size=0)
        try:
            # Query information_schema to check if table exists
            query = """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = $1
                )
            """
            exists = await conn.fetchval(query, table_name)
            logger.debug(f"Table {table_name} exists: {exists}")
            return bool(exists)
        finally:
            await conn.close()
    except Exception as e:
        logger.error(f"Error checking if table {table_name} exists: {e}", exc_info=True)
        raise


async def ensure_schema_exists() -> bool:
    """
    Verify that the required database schema exists.

    Checks for the archon_settings table as a proxy for schema existence.
    This table is created first in the migration script and is required
    for credential loading.

    Returns:
        True if schema exists, False if missing

    Raises:
        Exception: If unable to verify schema status
    """
    logger.info("Verifying database schema...")

    try:
        table_exists = await check_table_exists("archon_settings")

        if table_exists:
            logger.info("✅ Database schema verified - archon_settings table exists")
            return True
        else:
            logger.warning(
                "⚠️  Database schema missing - archon_settings table not found"
            )
            return False

    except Exception as e:
        logger.error(f"Failed to verify schema: {e}", exc_info=True)
        raise


async def run_migrations() -> None:
    """
    Run database migrations to initialize the schema.

    This function is designed to be called during application startup
    if the schema is found to be missing. It provides detailed error
    messages to help with troubleshooting.

    Note:
        In beta, this raises an error with instructions rather than
        auto-executing migrations. This follows the "fail fast" principle
        to ensure developers are aware of schema initialization requirements.

    Raises:
        MigrationError: Always raised with instructions for manual migration
    """
    logger.error("❌ Database schema is missing!")

    # Get the migration script path
    project_root = Path(__file__).parent.parent.parent.parent.parent
    migration_script = project_root / "migration" / "complete_setup.sql"

    error_message = f"""
Database schema is not initialized. The archon_settings table is missing.

To initialize the database, run the following command:

    docker exec -i supabase-ai-db psql -U postgres archon_db < {migration_script}

Then restart the Archon services:

    docker compose restart archon-server

Alternative: Run the start-archon.sh script which handles this automatically:

    ./start-archon.sh

For more details, see the migration script at:
    {migration_script}
"""

    raise MigrationError(error_message)


async def initialize_database_schema() -> None:
    """
    Initialize the database schema if needed.

    This is the main entry point for schema initialization during
    application startup. It checks if the schema exists and runs
    migrations if necessary.

    Following the beta "fail fast" principle:
    - Checks if schema exists
    - If missing, provides clear error with instructions
    - Does not auto-migrate to ensure explicit initialization

    Raises:
        MigrationError: If schema is missing (with detailed instructions)
        Exception: If unable to verify or initialize schema
    """
    logger.info("Initializing database schema...")

    try:
        schema_exists = await ensure_schema_exists()

        if not schema_exists:
            # In beta, fail with clear instructions
            await run_migrations()

        logger.info("✅ Database schema initialization complete")

    except MigrationError:
        # Re-raise migration errors with full context
        raise
    except Exception as e:
        logger.error(f"Failed to initialize database schema: {e}", exc_info=True)
        raise


__all__ = [
    "check_table_exists",
    "ensure_schema_exists",
    "run_migrations",
    "initialize_database_schema",
    "MigrationError",
]
