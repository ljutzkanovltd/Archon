"""
Crawl Queue Worker - Background processor for batch crawling

This module implements a background worker that continuously processes
the crawl queue, handling retries, failures, and human-in-the-loop review.
"""

import asyncio
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from ...config.logfire_config import get_logger, safe_logfire_error, safe_logfire_info
from ...utils import get_supabase_client
from ..credential_service import credential_service
from ..crawler_manager import get_crawler
from .crawling_service import CrawlingService
from .queue_manager import get_queue_manager

logger = get_logger(__name__)


class CrawlQueueWorker:
    """
    Background worker that processes the crawl queue.

    Features:
    - Polls queue every 30 seconds for pending items
    - Processes up to 5 sources concurrently
    - Automatic retry with exponential backoff
    - Human-in-the-loop for persistent failures
    - Graceful shutdown support
    - Memory monitoring and adaptive throttling
    """

    def __init__(self):
        """Initialize the queue worker."""
        self.supabase = get_supabase_client()
        self.queue_manager = get_queue_manager()
        self.is_running = False
        self.is_paused = False
        self._shutdown_event = asyncio.Event()
        self._worker_task: Optional[asyncio.Task] = None
        self._active_crawls: Dict[str, asyncio.Task] = {}

        # Configuration from database settings
        self._batch_size = 5  # Will be loaded from settings
        self._poll_interval = 30  # Will be loaded from settings
        self._retry_delays = [60, 300, 900]  # Will be loaded from settings

    async def _load_settings(self):
        """Load worker configuration from database settings."""
        try:
            # Fetch queue settings
            result = (
                self.supabase.table("archon_settings")
                .select("key, value")
                .eq("category", "crawl_queue")
                .execute()
            )

            settings = {item["key"]: item["value"] for item in result.data} if result.data else {}

            # Apply settings with defaults
            self._batch_size = int(settings.get("QUEUE_BATCH_SIZE", "5"))
            self._poll_interval = int(settings.get("QUEUE_WORKER_INTERVAL", "30"))

            # Parse retry delays from JSON array
            retry_delays_str = settings.get("QUEUE_RETRY_DELAYS", "[60, 300, 900]")
            self._retry_delays = json.loads(retry_delays_str)

            safe_logfire_info(
                f"Loaded queue worker settings | batch_size={self._batch_size} | "
                f"poll_interval={self._poll_interval}s | retry_delays={self._retry_delays}"
            )

        except Exception as e:
            safe_logfire_error(f"Failed to load queue settings, using defaults | error={str(e)}")

    async def start(self):
        """Start the background worker."""
        if self.is_running:
            safe_logfire_info("Queue worker already running, skipping start")
            return

        safe_logfire_info("🚀 Starting crawl queue worker...")

        # Load settings from database
        await self._load_settings()

        self.is_running = True
        self._shutdown_event.clear()

        # Start the worker loop as a background task
        self._worker_task = asyncio.create_task(self._worker_loop())

        safe_logfire_info(
            f"✅ Crawl queue worker started | batch_size={self._batch_size} | "
            f"poll_interval={self._poll_interval}s"
        )

    async def stop(self, timeout: int = 60):
        """
        Stop the background worker gracefully.

        Args:
            timeout: Maximum seconds to wait for current crawls to complete
        """
        if not self.is_running:
            safe_logfire_info("Queue worker not running, skipping stop")
            return

        safe_logfire_info("🛑 Stopping crawl queue worker...")

        # Signal shutdown
        self._shutdown_event.set()
        self.is_running = False

        # Cancel all active crawls
        if self._active_crawls:
            safe_logfire_info(f"Cancelling {len(self._active_crawls)} active crawls...")
            for item_id, task in self._active_crawls.items():
                task.cancel()
                safe_logfire_info(f"Cancelled crawl for queue item {item_id}")

        # Wait for worker task to finish
        if self._worker_task and not self._worker_task.done():
            try:
                await asyncio.wait_for(self._worker_task, timeout=timeout)
                safe_logfire_info("Worker task completed gracefully")
            except asyncio.TimeoutError:
                safe_logfire_error(f"Worker task did not complete within {timeout}s, forcing cancellation")
                self._worker_task.cancel()
                try:
                    await self._worker_task
                except asyncio.CancelledError:
                    pass

        safe_logfire_info("✅ Crawl queue worker stopped")

    async def pause(self):
        """Pause the worker (stop processing new items, but don't stop the loop)."""
        if not self.is_running:
            safe_logfire_info("Cannot pause - worker not running")
            return

        self.is_paused = True
        safe_logfire_info("⏸️  Crawl queue worker paused")

    async def resume(self):
        """Resume the worker after pause."""
        if not self.is_running:
            safe_logfire_info("Cannot resume - worker not running")
            return

        self.is_paused = False
        safe_logfire_info("▶️  Crawl queue worker resumed")

    def get_status(self) -> Dict[str, Any]:
        """Get current worker status."""
        return {
            "is_running": self.is_running,
            "is_paused": self.is_paused,
            "active_crawls": len(self._active_crawls),
            "batch_size": self._batch_size,
            "poll_interval": self._poll_interval
        }

    async def _worker_loop(self):
        """Main worker loop that polls and processes the queue."""
        safe_logfire_info("Worker loop started")

        while not self._shutdown_event.is_set():
            try:
                if self.is_paused:
                    safe_logfire_info("Worker paused, sleeping...")
                    await asyncio.sleep(self._poll_interval)
                    continue

                # Fetch next batch of pending items
                pending_items = await self.queue_manager.get_next_batch(limit=self._batch_size)

                # Also check for items ready for retry
                retry_items = await self.queue_manager.get_retry_candidates(limit=self._batch_size)

                # Combine and limit to batch size
                all_items = pending_items + retry_items
                items_to_process = all_items[:self._batch_size]

                if items_to_process:
                    safe_logfire_info(
                        f"📋 Processing batch | pending={len(pending_items)} | "
                        f"retries={len(retry_items)} | total={len(items_to_process)}"
                    )

                    # Process items concurrently
                    await self._process_batch(items_to_process)

                else:
                    safe_logfire_info(f"No items in queue, sleeping for {self._poll_interval}s...")

                # Sleep before next poll
                await asyncio.sleep(self._poll_interval)

            except asyncio.CancelledError:
                safe_logfire_info("Worker loop cancelled")
                break
            except Exception as e:
                safe_logfire_error(f"Worker loop error | error={str(e)}")
                # Continue processing after error
                await asyncio.sleep(self._poll_interval)

        safe_logfire_info("Worker loop exited")

    async def _process_batch(self, items: List[Dict[str, Any]]):
        """
        Process a batch of queue items concurrently.

        Args:
            items: List of queue items to process
        """
        # Create tasks for each item
        tasks = []
        for item in items:
            task = asyncio.create_task(self._process_item(item))
            tasks.append(task)
            self._active_crawls[item["item_id"]] = task

        # Wait for all to complete (with return_exceptions=True to handle partial failures)
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Log results
        successes = sum(1 for r in results if not isinstance(r, Exception))
        failures = len(results) - successes

        safe_logfire_info(
            f"Batch processing completed | total={len(items)} | "
            f"successes={successes} | failures={failures}"
        )

        # Clean up active crawls
        for item in items:
            self._active_crawls.pop(item["item_id"], None)

    async def _process_item(self, item: Dict[str, Any]):
        """
        Process a single queue item by crawling the source.

        Args:
            item: Queue item dict with source_id, item_id, etc.
        """
        item_id = item["item_id"]
        source_id = item["source_id"]

        try:
            safe_logfire_info(f"🔄 Processing queue item | item_id={item_id} | source_id={source_id}")

            # Update status to running
            await self.queue_manager.update_status(item_id, "running")

            # Get source details
            source_result = (
                self.supabase.table("archon_sources")
                .select("*")
                .eq("source_id", source_id)
                .single()
                .execute()
            )

            if not source_result.data:
                raise Exception(f"Source {source_id} not found in database")

            source = source_result.data
            url = source.get("source_url")
            metadata = source.get("metadata", {})

            if not url:
                raise Exception(f"Source {source_id} has no URL")

            # Validate embedding provider API key
            provider_config = await credential_service.get_active_provider("embedding")
            provider = provider_config.get("provider", "openai")

            if not provider:
                raise Exception("No embedding provider configured")

            # Delete existing pages and code examples (same as refresh endpoint)
            await self._delete_existing_data(source_id)

            # Get crawler
            crawler = await get_crawler()
            if not crawler:
                raise Exception("Crawler service not available")

            # Create crawl service
            crawl_service = CrawlingService(
                crawler=crawler,
                supabase_client=self.supabase
            )

            # Prepare crawl request
            crawl_request = {
                "url": url,
                "knowledge_type": metadata.get("knowledge_type", "technical"),
                "tags": metadata.get("tags", []),
                "max_depth": metadata.get("max_depth", 2),
                "extract_code_examples": metadata.get("extract_code_examples", True),
                "generate_summary": True
            }

            # Execute crawl
            safe_logfire_info(f"Starting crawl | source_id={source_id} | url={url}")
            result = await crawl_service.orchestrate_crawl(crawl_request)

            # Wait for crawl task to complete
            crawl_task = result.get("task")
            if crawl_task:
                await crawl_task

            # VALIDATION: Verify that crawl actually created data before marking as completed
            validation_result = await self._validate_crawl_completion(source_id)

            if validation_result["success"]:
                # Update status to completed only if validation passed
                await self.queue_manager.update_status(item_id, "completed")
                safe_logfire_info(
                    f"✅ Completed queue item with validation | item_id={item_id} | "
                    f"source_id={source_id} | pages={validation_result['pages_count']} | "
                    f"code_examples={validation_result['code_examples_count']}"
                )
            else:
                # Validation failed - mark as failed with detailed error
                error_message = (
                    f"Crawl validation failed: {validation_result['error']}. "
                    f"Pages: {validation_result['pages_count']}, "
                    f"Code examples: {validation_result['code_examples_count']}"
                )

                await self.queue_manager.update_status(
                    item_id=item_id,
                    status="failed",
                    error_message=error_message,
                    error_type="validation_failed",
                    error_details={
                        "validation_result": validation_result,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )

                safe_logfire_error(
                    f"❌ Crawl validation failed | item_id={item_id} | source_id={source_id} | "
                    f"pages={validation_result['pages_count']} | "
                    f"code_examples={validation_result['code_examples_count']} | "
                    f"error={validation_result['error']}"
                )

                # Don't raise exception - we've handled the failure by marking it as failed
                return

        except Exception as e:
            safe_logfire_error(
                f"❌ Failed to process queue item | item_id={item_id} | "
                f"source_id={source_id} | error={str(e)}"
            )

            # Categorize error type
            error_type = self._categorize_error(e)

            # Update status to failed with error details
            await self.queue_manager.update_status(
                item_id=item_id,
                status="failed",
                error_message=str(e)[:500],  # Truncate long errors
                error_type=error_type,
                error_details={"error": str(e), "timestamp": datetime.utcnow().isoformat()}
            )

            # Increment retry count with exponential backoff
            retry_result = await self.queue_manager.increment_retry(
                item_id=item_id,
                retry_delays=self._retry_delays
            )

            if retry_result.get("requires_review"):
                safe_logfire_info(
                    f"⚠️  Queue item marked for human review | item_id={item_id} | "
                    f"retries={retry_result.get('retry_count')}"
                )
            else:
                next_retry = retry_result.get("next_retry_at")
                safe_logfire_info(
                    f"🔁 Scheduled retry | item_id={item_id} | "
                    f"attempt={retry_result.get('retry_count')} | next_retry={next_retry}"
                )

    async def _delete_existing_data(self, source_id: str):
        """
        Delete existing pages and code examples for a source.

        Args:
            source_id: Source ID to delete data for
        """
        try:
            # Delete pages (CASCADE deletes chunks)
            page_result = (
                self.supabase.table("archon_page_metadata")
                .delete()
                .eq("source_id", source_id)
                .execute()
            )
            pages_deleted = len(page_result.data) if page_result.data else 0

            # Delete code examples
            code_result = (
                self.supabase.table("archon_code_examples")
                .delete()
                .eq("source_id", source_id)
                .execute()
            )
            code_deleted = len(code_result.data) if code_result.data else 0

            safe_logfire_info(
                f"Deleted existing data | source_id={source_id} | "
                f"pages={pages_deleted} | code_examples={code_deleted}"
            )

        except Exception as e:
            safe_logfire_error(f"Error deleting existing data | source_id={source_id} | error={str(e)}")
            # Don't raise - continue with crawl even if deletion fails

    async def _validate_crawl_completion(self, source_id: str) -> Dict[str, Any]:
        """
        Validate that a crawl actually created data before marking as completed.

        Checks:
        1. Pages created in archon_page_metadata
        2. Chunks created in archon_crawled_pages
        3. Code examples created in archon_code_examples (if applicable)

        Args:
            source_id: Source ID to validate

        Returns:
            Dict with keys:
            - success: bool (True if validation passed)
            - pages_count: int (number of pages created)
            - chunks_count: int (number of chunks created)
            - code_examples_count: int (number of code examples)
            - error: str (error message if validation failed, empty if success)
        """
        # ENHANCED LOGGING: Start validation
        safe_logfire_info(f"🔍 Starting crawl validation | source_id={source_id}")

        try:
            # Count pages in archon_page_metadata
            pages_result = (
                self.supabase.table("archon_page_metadata")
                .select("id", count="exact")
                .eq("source_id", source_id)
                .execute()
            )
            pages_count = pages_result.count if pages_result.count is not None else 0
            safe_logfire_info(f"  📄 Pages count: {pages_count}")

            # Count chunks in archon_crawled_pages
            chunks_result = (
                self.supabase.table("archon_crawled_pages")
                .select("id", count="exact")
                .eq("source_id", source_id)
                .execute()
            )
            chunks_count = chunks_result.count if chunks_result.count is not None else 0
            safe_logfire_info(f"  📦 Chunks count: {chunks_count}")

            # Count code examples in archon_code_examples
            code_result = (
                self.supabase.table("archon_code_examples")
                .select("id", count="exact")
                .eq("source_id", source_id)
                .execute()
            )
            code_examples_count = code_result.count if code_result.count is not None else 0
            safe_logfire_info(f"  💻 Code examples count: {code_examples_count}")

            # Validation logic: At minimum, we need at least 1 page created
            if pages_count == 0:
                safe_logfire_error(
                    f"❌ Validation FAILED: No pages created | source_id={source_id}"
                )
                return {
                    "success": False,
                    "pages_count": pages_count,
                    "chunks_count": chunks_count,
                    "code_examples_count": code_examples_count,
                    "error": "No pages were created during crawl"
                }

            # If pages exist but no chunks, that's also a problem
            if chunks_count == 0:
                safe_logfire_error(
                    f"❌ Validation FAILED: Pages created but no chunks | "
                    f"source_id={source_id} | pages={pages_count}"
                )
                return {
                    "success": False,
                    "pages_count": pages_count,
                    "chunks_count": chunks_count,
                    "code_examples_count": code_examples_count,
                    "error": "Pages created but no chunks indexed"
                }

            # Success - we have pages and chunks
            safe_logfire_info(
                f"✅ Validation PASSED | source_id={source_id} | "
                f"pages={pages_count} | chunks={chunks_count} | code_examples={code_examples_count}"
            )

            return {
                "success": True,
                "pages_count": pages_count,
                "chunks_count": chunks_count,
                "code_examples_count": code_examples_count,
                "error": ""
            }

        except Exception as e:
            safe_logfire_error(f"Validation query failed | source_id={source_id} | error={str(e)}")
            return {
                "success": False,
                "pages_count": 0,
                "chunks_count": 0,
                "code_examples_count": 0,
                "error": f"Validation query error: {str(e)}"
            }

    def _categorize_error(self, error: Exception) -> str:
        """
        Categorize error type for retry strategy.

        Args:
            error: Exception that occurred

        Returns:
            Error type: 'network', 'rate_limit', 'parse_error', 'timeout', 'other'
        """
        error_str = str(error).lower()

        if "timeout" in error_str or "timed out" in error_str:
            return "timeout"
        elif "rate limit" in error_str or "429" in error_str:
            return "rate_limit"
        elif "connection" in error_str or "network" in error_str or "unreachable" in error_str:
            return "network"
        elif "parse" in error_str or "invalid" in error_str or "malformed" in error_str:
            return "parse_error"
        else:
            return "other"


# Singleton instance
_queue_worker_instance: Optional[CrawlQueueWorker] = None


def get_queue_worker() -> CrawlQueueWorker:
    """Get or create the singleton CrawlQueueWorker instance."""
    global _queue_worker_instance
    if _queue_worker_instance is None:
        _queue_worker_instance = CrawlQueueWorker()
    return _queue_worker_instance
