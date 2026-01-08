"""
Crawl State Manager Service

Handles persisting and loading crawl state for pause/resume functionality.
"""

import json
from datetime import datetime
from typing import Any
from uuid import UUID

from supabase import Client

from ...config.logfire_config import get_logger, safe_logfire_error, safe_logfire_info

logger = get_logger(__name__)


class CrawlStateManager:
    """
    Manages crawl state persistence for pause/resume operations.

    Stores crawl progress, pending URLs, visited URLs, and request metadata
    to enable seamless resume from exact position.
    """

    def __init__(self, supabase_client: Client):
        """
        Initialize the state manager.

        Args:
            supabase_client: Supabase client for database operations
        """
        self.supabase = supabase_client

    async def save_state(
        self,
        progress_id: str,
        crawl_type: str,
        crawl_results: list[dict[str, Any]],
        pending_urls: list[str],
        visited_urls: set[str],
        current_depth: int,
        max_depth: int,
        pages_crawled: int,
        total_pages: int,
        progress_percent: int,
        original_request: dict[str, Any],
        source_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Save crawl state to database for later resume.

        Args:
            progress_id: Unique progress identifier
            crawl_type: Type of crawl (sitemap, recursive, etc.)
            crawl_results: List of pages crawled so far
            pending_urls: URLs still to be crawled
            visited_urls: Set of URLs already visited (for deduplication)
            current_depth: Current crawl depth
            max_depth: Maximum crawl depth
            pages_crawled: Number of pages crawled
            total_pages: Estimated total pages
            progress_percent: Progress percentage (0-100)
            original_request: Original crawl request dict
            source_id: Optional source ID

        Returns:
            Saved state record

        Raises:
            Exception: If database operation fails
        """
        try:
            state_data = {
                "progress_id": progress_id,
                "source_id": source_id,
                "crawl_type": crawl_type,
                "status": "paused",
                "crawl_results": json.dumps(crawl_results),
                "pending_urls": json.dumps(pending_urls),
                "visited_urls": json.dumps(list(visited_urls)),  # Convert set to list
                "current_depth": current_depth,
                "max_depth": max_depth,
                "pages_crawled": pages_crawled,
                "total_pages": total_pages,
                "progress_percent": progress_percent,
                "original_request": json.dumps(original_request),
                "paused_at": datetime.utcnow().isoformat(),
            }

            # Upsert state (update if exists, insert if not)
            result = (
                self.supabase.table("archon_crawl_state")
                .upsert(state_data, on_conflict="progress_id")
                .execute()
            )

            safe_logfire_info(
                f"Crawl state saved | progress_id={progress_id} | pages={pages_crawled}/{total_pages} | pending_urls={len(pending_urls)}"
            )

            return result.data[0] if result.data else state_data

        except Exception as e:
            safe_logfire_error(f"Failed to save crawl state | progress_id={progress_id} | error={e}")
            raise

    async def load_state(self, progress_id: str) -> dict[str, Any] | None:
        """
        Load saved crawl state from database.

        Args:
            progress_id: Unique progress identifier

        Returns:
            State dict with deserialized fields, or None if not found
        """
        try:
            result = (
                self.supabase.table("archon_crawl_state")
                .select("*")
                .eq("progress_id", progress_id)
                .execute()
            )

            if not result.data:
                logger.warning(f"No saved state found | progress_id={progress_id}")
                return None

            state = result.data[0]

            # Deserialize JSON fields
            state["crawl_results"] = json.loads(state["crawl_results"])
            state["pending_urls"] = json.loads(state["pending_urls"])
            state["visited_urls"] = set(json.loads(state["visited_urls"]))  # Convert back to set
            state["original_request"] = json.loads(state["original_request"])

            safe_logfire_info(
                f"Crawl state loaded | progress_id={progress_id} | pages={state['pages_crawled']} | pending_urls={len(state['pending_urls'])}"
            )

            return state

        except json.JSONDecodeError as e:
            safe_logfire_error(
                f"Failed to deserialize crawl state | progress_id={progress_id} | error={e}"
            )
            return None
        except Exception as e:
            safe_logfire_error(f"Failed to load crawl state | progress_id={progress_id} | error={e}")
            return None

    async def update_status(
        self,
        progress_id: str,
        status: str,
        resumed_at: datetime | None = None
    ) -> bool:
        """
        Update crawl status (for resume operation).

        Args:
            progress_id: Unique progress identifier
            status: New status ('resumed', 'running', 'paused')
            resumed_at: Optional timestamp for resume

        Returns:
            True if successful, False otherwise
        """
        try:
            update_data = {"status": status}
            if resumed_at:
                update_data["resumed_at"] = resumed_at.isoformat()

            result = (
                self.supabase.table("archon_crawl_state")
                .update(update_data)
                .eq("progress_id", progress_id)
                .execute()
            )

            safe_logfire_info(f"Crawl status updated | progress_id={progress_id} | status={status}")
            return len(result.data) > 0

        except Exception as e:
            safe_logfire_error(
                f"Failed to update crawl status | progress_id={progress_id} | error={e}"
            )
            return False

    async def delete_state(self, progress_id: str) -> bool:
        """
        Delete saved crawl state (cleanup after completion or cancellation).

        Args:
            progress_id: Unique progress identifier

        Returns:
            True if successful, False otherwise
        """
        try:
            result = (
                self.supabase.table("archon_crawl_state")
                .delete()
                .eq("progress_id", progress_id)
                .execute()
            )

            safe_logfire_info(f"Crawl state deleted | progress_id={progress_id}")
            return len(result.data) > 0

        except Exception as e:
            safe_logfire_error(
                f"Failed to delete crawl state | progress_id={progress_id} | error={e}"
            )
            return False

    async def get_all_paused(self) -> list[dict[str, Any]]:
        """
        Get all paused crawls.

        Returns:
            List of paused crawl states
        """
        try:
            result = (
                self.supabase.table("archon_crawl_state")
                .select("progress_id, source_id, crawl_type, pages_crawled, total_pages, paused_at")
                .eq("status", "paused")
                .order("paused_at", desc=True)
                .execute()
            )

            return result.data

        except Exception as e:
            safe_logfire_error(f"Failed to get paused crawls | error={e}")
            return []
