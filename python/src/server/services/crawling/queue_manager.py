"""
Queue Manager Service for Archon Crawl Queue System

This module provides queue management functionality for batch crawling operations.
It handles queue item creation, status updates, retry logic, and batch management.
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from ...config.logfire_config import get_logger, safe_logfire_error, safe_logfire_info
from ...utils import get_supabase_client

logger = get_logger(__name__)


class QueueManager:
    """
    Manages the crawl queue system for batch crawling operations.

    Provides methods for:
    - Adding sources to the queue
    - Fetching next batch of pending items
    - Updating queue item status
    - Managing retries with exponential backoff
    - Marking items for human review
    - Getting queue statistics
    """

    def __init__(self):
        """Initialize the Queue Manager."""
        self.supabase = get_supabase_client()
        self._lock = asyncio.Lock()

    async def add_to_queue(
        self,
        source_ids: List[str],
        batch_id: Optional[UUID] = None,
        priority: int = 50,
        created_by: str = "system"
    ) -> Dict[str, Any]:
        """
        Add sources to the crawl queue.

        Args:
            source_ids: List of source IDs to add to queue
            batch_id: Optional batch ID to group sources (creates new batch if None)
            priority: Priority level (higher = more urgent, default: 50)
            created_by: User or system that created the queue items

        Returns:
            Dict with batch_id, total_added, and item_ids

        Raises:
            Exception: If database operation fails
        """
        async with self._lock:
            try:
                # Create batch if not provided
                if batch_id is None:
                    batch_result = self.supabase.table("archon_crawl_batches").insert({
                        "total_sources": len(source_ids),
                        "created_by": created_by,
                        "status": "pending"
                    }).execute()
                    batch_id = batch_result.data[0]["batch_id"]
                    safe_logfire_info(f"Created new batch {batch_id} with {len(source_ids)} sources")

                # Prepare queue items
                queue_items = [
                    {
                        "batch_id": str(batch_id),
                        "source_id": source_id,
                        "priority": priority,
                        "status": "pending",
                        "retry_count": 0,
                        "max_retries": 3,
                        "requires_human_review": False
                    }
                    for source_id in source_ids
                ]

                # Insert queue items
                result = self.supabase.table("archon_crawl_queue").insert(queue_items).execute()
                item_ids = [item["item_id"] for item in result.data]

                safe_logfire_info(
                    f"Added {len(item_ids)} sources to queue (batch: {batch_id}, priority: {priority})"
                )

                return {
                    "success": True,
                    "batch_id": str(batch_id),
                    "total_added": len(item_ids),
                    "item_ids": item_ids
                }

            except Exception as e:
                safe_logfire_error(f"Failed to add sources to queue: {str(e)}")
                return {
                    "success": False,
                    "error": str(e)
                }

    async def get_next_batch(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Fetch next batch of pending queue items, ordered by priority and creation time.

        Args:
            limit: Maximum number of items to fetch (default: 5)

        Returns:
            List of queue items ready for processing
        """
        try:
            # Fetch pending items ordered by priority (desc) and created_at (asc)
            result = (
                self.supabase.table("archon_crawl_queue")
                .select("*")
                .eq("status", "pending")
                .order("priority", desc=True)
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )

            items = result.data if result.data else []
            safe_logfire_info(f"Fetched {len(items)} pending queue items (limit: {limit})")
            return items

        except Exception as e:
            safe_logfire_error(f"Failed to fetch next batch: {str(e)}")
            return []

    async def get_retry_candidates(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Fetch items ready for retry (failed items where next_retry_at <= now).

        Args:
            limit: Maximum number of items to fetch

        Returns:
            List of queue items ready for retry
        """
        try:
            now = datetime.utcnow().isoformat()
            # Fetch failed items with next_retry_at <= now
            # Note: Supabase client doesn't support column-to-column comparison,
            # so we fetch all failed items and filter retry_count in Python
            result = (
                self.supabase.table("archon_crawl_queue")
                .select("*")
                .eq("status", "failed")
                .lte("next_retry_at", now)
                .order("priority", desc=True)
                .limit(limit * 2)  # Fetch extra to account for filtering
                .execute()
            )

            # Filter items where retry_count < max_retries (column comparison)
            all_items = result.data if result.data else []
            items = [
                item for item in all_items
                if item.get("retry_count", 0) < item.get("max_retries", 3)
            ][:limit]  # Apply limit after filtering

            logger.info(f"Found {len(items)} retry candidates")
            return items

        except Exception as e:
            logger.error(f"Failed to fetch retry candidates: {str(e)}", exc_info=True)
            return []

    async def get_stale_running_items(self, cutoff_time: datetime) -> List[Dict[str, Any]]:
        """
        Fetch items stuck in 'running' status for longer than cutoff time.

        This is used for cleanup on worker restart to reset items that were
        orphaned by a crash or restart.

        Args:
            cutoff_time: Items with started_at before this time are considered stale

        Returns:
            List of stale queue items stuck in 'running' status
        """
        try:
            cutoff_iso = cutoff_time.isoformat()
            result = (
                self.supabase.table("archon_crawl_queue")
                .select("*")
                .eq("status", "running")
                .lte("started_at", cutoff_iso)
                .execute()
            )

            items = result.data if result.data else []
            logger.info(f"Found {len(items)} stale running items (older than {cutoff_iso})")
            return items

        except Exception as e:
            logger.error(f"Failed to fetch stale running items: {str(e)}")
            return []

    async def update_status(
        self,
        item_id: str,
        status: str,
        error_message: Optional[str] = None,
        error_type: Optional[str] = None,
        error_details: Optional[Dict[str, Any]] = None,
        next_retry_at: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Update queue item status.

        Args:
            item_id: UUID of the queue item
            status: New status ('pending', 'running', 'completed', 'failed', 'cancelled')
            error_message: Optional error message if status is 'failed'
            error_type: Optional error type ('network', 'rate_limit', 'parse_error', 'timeout', 'other')
            error_details: Optional additional error details
            next_retry_at: Optional timestamp for next retry attempt (for 'failed' status)

        Returns:
            Dict with success status and updated item
        """
        try:
            update_data: Dict[str, Any] = {"status": status}

            # Set timestamps based on status
            if status == "running":
                update_data["started_at"] = datetime.utcnow().isoformat()
            elif status == "completed":
                update_data["completed_at"] = datetime.utcnow().isoformat()
            elif status == "failed":
                if error_message:
                    update_data["error_message"] = error_message
                if error_type:
                    update_data["error_type"] = error_type
                if error_details:
                    update_data["error_details"] = error_details
                if next_retry_at:
                    update_data["next_retry_at"] = next_retry_at.isoformat()
                    update_data["last_retry_at"] = datetime.utcnow().isoformat()

            result = (
                self.supabase.table("archon_crawl_queue")
                .update(update_data)
                .eq("item_id", item_id)
                .execute()
            )

            logger.info(f"Updated queue item {item_id} to status '{status}'")

            return {
                "success": True,
                "item": result.data[0] if result.data else None
            }

        except Exception as e:
            logger.error(f"Failed to update queue item {item_id}: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }

    async def increment_retry(
        self,
        item_id: str,
        retry_delays: List[int] = [60, 300, 900]  # 1min, 5min, 15min
    ) -> Dict[str, Any]:
        """
        Increment retry count and calculate next retry time using exponential backoff.

        Args:
            item_id: UUID of the queue item
            retry_delays: List of retry delays in seconds for each attempt

        Returns:
            Dict with success status and next retry time
        """
        try:
            # Fetch current item
            result = (
                self.supabase.table("archon_crawl_queue")
                .select("retry_count, max_retries")
                .eq("item_id", item_id)
                .single()
                .execute()
            )

            if not result.data:
                return {"success": False, "error": "Item not found"}

            current_retry = result.data["retry_count"]
            max_retries = result.data["max_retries"]
            new_retry_count = current_retry + 1

            # Check if max retries reached
            if new_retry_count >= max_retries:
                # Mark for human review
                await self.mark_for_review(
                    item_id,
                    f"Maximum retries ({max_retries}) exceeded"
                )
                safe_logfire_info(
                    f"Queue item {item_id} reached max retries, marked for review"
                )
                return {
                    "success": True,
                    "requires_review": True,
                    "retry_count": new_retry_count
                }

            # Calculate next retry time
            delay_index = min(current_retry, len(retry_delays) - 1)
            delay_seconds = retry_delays[delay_index]
            next_retry_at = datetime.utcnow() + timedelta(seconds=delay_seconds)

            # Update item
            update_result = (
                self.supabase.table("archon_crawl_queue")
                .update({
                    "retry_count": new_retry_count,
                    "last_retry_at": datetime.utcnow().isoformat(),
                    "next_retry_at": next_retry_at.isoformat(),
                    "status": "failed"  # Keep as failed until retry succeeds
                })
                .eq("item_id", item_id)
                .execute()
            )

            safe_logfire_info(
                f"Incremented retry for {item_id}: attempt {new_retry_count}/{max_retries}, "
                f"next retry at {next_retry_at.isoformat()}"
            )

            return {
                "success": True,
                "retry_count": new_retry_count,
                "next_retry_at": next_retry_at.isoformat(),
                "requires_review": False
            }

        except Exception as e:
            safe_logfire_error(f"Failed to increment retry for {item_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def mark_for_review(
        self,
        item_id: str,
        reason: str
    ) -> Dict[str, Any]:
        """
        Mark a queue item for human review.

        Args:
            item_id: UUID of the queue item
            reason: Reason for requiring human review

        Returns:
            Dict with success status
        """
        try:
            result = (
                self.supabase.table("archon_crawl_queue")
                .update({
                    "requires_human_review": True,
                    "error_message": f"Human review required: {reason}",
                    "status": "failed"
                })
                .eq("item_id", item_id)
                .execute()
            )

            safe_logfire_info(f"Marked queue item {item_id} for human review: {reason}")

            return {
                "success": True,
                "item": result.data[0] if result.data else None
            }

        except Exception as e:
            safe_logfire_error(f"Failed to mark {item_id} for review: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def get_queue_stats(self) -> Dict[str, Any]:
        """
        Get queue statistics (counts by status) with detailed information for actively crawling sources.

        Returns:
            Dict with counts for each status and detailed statistics for running sources
        """
        try:
            # Get counts by status
            result = (
                self.supabase.table("archon_crawl_queue")
                .select("status", count="exact")
                .execute()
            )

            total = result.count if result.count else 0

            # Count by status
            stats = {
                "total": total,
                "pending": 0,
                "running": 0,
                "completed": 0,
                "failed": 0,
                "cancelled": 0,
                "requires_review": 0
            }

            # Count pending
            pending_result = (
                self.supabase.table("archon_crawl_queue")
                .select("*", count="exact")
                .eq("status", "pending")
                .execute()
            )
            stats["pending"] = pending_result.count if pending_result.count else 0

            # Get running items with detailed information
            running_result = (
                self.supabase.table("archon_crawl_queue")
                .select("*")
                .eq("status", "running")
                .execute()
            )
            running_items = running_result.data if running_result.data else []
            stats["running"] = len(running_items)

            # Get detailed statistics for actively crawling sources
            actively_crawling = []
            for item in running_items:
                source_id = item.get("source_id")
                if source_id:
                    try:
                        # Get source details
                        source_result = (
                            self.supabase.table("archon_sources")
                            .select("title, source_url, metadata")
                            .eq("source_id", source_id)
                            .single()
                            .execute()
                        )
                        source = source_result.data if source_result.data else {}

                        # Count pages crawled for this source
                        pages_result = (
                            self.supabase.table("archon_crawled_pages")
                            .select("*", count="exact")
                            .eq("source_id", source_id)
                            .execute()
                        )
                        pages_crawled = pages_result.count if pages_result.count else 0

                        # Count code examples for this source
                        code_result = (
                            self.supabase.table("archon_code_examples")
                            .select("*", count="exact")
                            .eq("source_id", source_id)
                            .execute()
                        )
                        code_examples_count = code_result.count if code_result.count else 0

                        # Get progress information from queue item metadata
                        progress_metadata = item.get("metadata", {})
                        progress_info = progress_metadata.get("progress_info", {}) if isinstance(progress_metadata, dict) else {}

                        # Build detailed statistics
                        detailed_stats = {
                            "source_id": source_id,
                            "source_title": source.get("title", "Unknown"),
                            "source_url": source.get("source_url", ""),
                            "pages_crawled": pages_crawled,
                            "code_examples_count": code_examples_count,
                            "priority": item.get("priority", 50),
                            "started_at": item.get("started_at"),
                            "created_at": item.get("created_at"),
                            "progress": progress_info.get("progress", 0),
                            "status": progress_info.get("status", "crawling"),
                            "current_url": progress_info.get("currentUrl", ""),
                            # Additional statistics
                            "batch_info": {
                                "batch_current": progress_info.get("batch_current", 1),
                                "batch_total": progress_info.get("batch_total", 1),
                                "urls_discovered": progress_info.get("urls_discovered", 0),
                            }
                        }

                        actively_crawling.append(detailed_stats)

                    except Exception as e:
                        logger.warning(f"Failed to get detailed stats for source {source_id}: {e}")
                        continue

            # Count completed
            completed_result = (
                self.supabase.table("archon_crawl_queue")
                .select("*", count="exact")
                .eq("status", "completed")
                .execute()
            )
            stats["completed"] = completed_result.count if completed_result.count else 0

            # Count failed
            failed_result = (
                self.supabase.table("archon_crawl_queue")
                .select("*", count="exact")
                .eq("status", "failed")
                .execute()
            )
            stats["failed"] = failed_result.count if failed_result.count else 0

            # Count cancelled
            cancelled_result = (
                self.supabase.table("archon_crawl_queue")
                .select("*", count="exact")
                .eq("status", "cancelled")
                .execute()
            )
            stats["cancelled"] = cancelled_result.count if cancelled_result.count else 0

            # Count items requiring review
            review_result = (
                self.supabase.table("archon_crawl_queue")
                .select("*", count="exact")
                .eq("requires_human_review", True)
                .execute()
            )
            stats["requires_review"] = review_result.count if review_result.count else 0

            safe_logfire_info(
                f"Queue stats: total={stats['total']}, running={stats['running']} "
                f"(with {len(actively_crawling)} detailed), pending={stats['pending']}"
            )

            return {
                "success": True,
                "stats": stats,
                "actively_crawling": actively_crawling
            }

        except Exception as e:
            safe_logfire_error(f"Failed to get queue stats: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "stats": {},
                "actively_crawling": []
            }

    async def get_batch_progress(self, batch_id: str) -> Dict[str, Any]:
        """
        Get progress for a specific batch.

        Args:
            batch_id: UUID of the batch

        Returns:
            Dict with batch progress details
        """
        try:
            # Get batch details
            batch_result = (
                self.supabase.table("archon_crawl_batches")
                .select("*")
                .eq("batch_id", batch_id)
                .single()
                .execute()
            )

            if not batch_result.data:
                return {"success": False, "error": "Batch not found"}

            # Get queue items for this batch
            items_result = (
                self.supabase.table("archon_crawl_queue")
                .select("status")
                .eq("batch_id", batch_id)
                .execute()
            )

            items = items_result.data if items_result.data else []

            # Calculate progress
            total = len(items)
            completed = sum(1 for item in items if item["status"] == "completed")
            failed = sum(1 for item in items if item["status"] == "failed")
            running = sum(1 for item in items if item["status"] == "running")
            pending = sum(1 for item in items if item["status"] == "pending")

            progress = {
                "batch_id": batch_id,
                "total": total,
                "completed": completed,
                "failed": failed,
                "running": running,
                "pending": pending,
                "progress_percent": round((completed / total * 100), 2) if total > 0 else 0,
                "status": batch_result.data["status"],
                "created_at": batch_result.data["created_at"],
                "started_at": batch_result.data.get("started_at"),
                "completed_at": batch_result.data.get("completed_at")
            }

            return {
                "success": True,
                "progress": progress
            }

        except Exception as e:
            safe_logfire_error(f"Failed to get batch progress for {batch_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def update_batch_status(
        self,
        batch_id: str,
        status: str
    ) -> Dict[str, Any]:
        """
        Update batch status.

        Args:
            batch_id: UUID of the batch
            status: New status ('pending', 'running', 'completed', 'failed', 'cancelled')

        Returns:
            Dict with success status
        """
        try:
            update_data: Dict[str, Any] = {"status": status}

            if status == "running":
                update_data["started_at"] = datetime.utcnow().isoformat()
            elif status in ["completed", "failed", "cancelled"]:
                update_data["completed_at"] = datetime.utcnow().isoformat()

            result = (
                self.supabase.table("archon_crawl_batches")
                .update(update_data)
                .eq("batch_id", batch_id)
                .execute()
            )

            safe_logfire_info(f"Updated batch {batch_id} to status '{status}'")

            return {
                "success": True,
                "batch": result.data[0] if result.data else None
            }

        except Exception as e:
            safe_logfire_error(f"Failed to update batch {batch_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
_queue_manager_instance: Optional[QueueManager] = None


def get_queue_manager() -> QueueManager:
    """Get or create the singleton QueueManager instance."""
    global _queue_manager_instance
    if _queue_manager_instance is None:
        _queue_manager_instance = QueueManager()
    return _queue_manager_instance
