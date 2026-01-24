"""
Crawl Queue Worker - Background processor for batch crawling

This module implements a background worker that continuously processes
the crawl queue, handling retries, failures, and human-in-the-loop review.
"""

import asyncio
import json
from datetime import datetime, timedelta
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
        self._high_priority_poll_interval = 5  # Fast polling for high-priority items
        self._retry_delays = [60, 300, 900]  # Will be loaded from settings

    async def _load_settings(self):
        """Load worker configuration from database settings."""
        logger.info("🔍 Loading queue worker settings from database...")

        try:
            # Fetch queue settings
            logger.info("   Querying archon_settings table (category='crawl_queue')...")
            result = (
                self.supabase.table("archon_settings")
                .select("key, value")
                .eq("category", "crawl_queue")
                .execute()
            )

            logger.info(f"   Query returned {len(result.data) if result.data else 0} settings")

            settings = {item["key"]: item["value"] for item in result.data} if result.data else {}

            if settings:
                logger.info(f"   Settings keys found: {list(settings.keys())}")
            else:
                logger.info("   No settings found, using defaults")

            # Apply settings with defaults
            self._batch_size = int(settings.get("QUEUE_BATCH_SIZE", "5"))
            self._poll_interval = int(settings.get("QUEUE_WORKER_INTERVAL", "30"))
            self._high_priority_poll_interval = int(settings.get("QUEUE_HIGH_PRIORITY_INTERVAL", "5"))

            # Parse retry delays from JSON array
            retry_delays_str = settings.get("QUEUE_RETRY_DELAYS", "[60, 300, 900]")
            self._retry_delays = json.loads(retry_delays_str)

            logger.info(
                f"✅ Loaded queue worker settings | batch_size={self._batch_size} | "
                f"poll_interval={self._poll_interval}s | "
                f"high_priority_interval={self._high_priority_poll_interval}s | "
                f"retry_delays={self._retry_delays}"
            )

        except Exception as e:
            logger.error(f"❌ Failed to load queue settings, using defaults | error={str(e)}", exc_info=True)
            # Set defaults explicitly in case of failure
            self._batch_size = 5
            self._poll_interval = 30
            self._high_priority_poll_interval = 5
            self._retry_delays = [60, 300, 900]
            logger.info(f"   Using default values: batch_size=5, poll_interval=30s")

    async def _cleanup_stale_items(self):
        """
        Reset items stuck in 'running' status for more than 1 hour.

        This cleanup runs on worker startup to handle items that were orphaned
        by a worker crash or restart. Items are reset to 'failed' status with
        an error message explaining they were interrupted by a restart.
        """
        try:
            # Find items stuck in "running" status for >1 hour
            cutoff_time = datetime.utcnow() - timedelta(hours=1)
            stale_items = await self.queue_manager.get_stale_running_items(cutoff_time)

            if not stale_items:
                logger.info("   No stale running items found")
                return

            logger.info(f"   Found {len(stale_items)} stale running items")

            # Reset each stale item to "failed" status
            for item in stale_items:
                item_id = item["item_id"]
                source_id = item.get("source_id", "unknown")
                started_at = item.get("started_at")

                # Calculate how long it was running
                if started_at:
                    started_time = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                    duration = datetime.now(started_time.tzinfo) - started_time
                    duration_hours = duration.total_seconds() / 3600
                    duration_str = f"{duration_hours:.1f} hours"
                else:
                    duration_str = "unknown duration"

                # Calculate next retry time (use first retry delay: 60 seconds)
                first_retry_delay = self._retry_delays[0] if self._retry_delays else 60
                next_retry_time = datetime.utcnow() + timedelta(seconds=first_retry_delay)

                # Reset to failed status with retry timing
                await self.queue_manager.update_status(
                    item_id=item_id,
                    status="failed",
                    error_message=f"Worker restart detected. Item was running for {duration_str}. Reset for retry.",
                    error_type="other",
                    error_details={
                        "cleanup_reason": "worker_startup_cleanup",
                        "previous_status": "running",
                        "cleanup_timestamp": datetime.utcnow().isoformat(),
                        "running_duration": duration_str,
                        "original_error_type": "worker_restart"
                    },
                    next_retry_at=next_retry_time
                )

                logger.info(f"      Reset item {item_id} (source: {source_id}, duration: {duration_str})")

            logger.info(f"✅ Cleaned up {len(stale_items)} stale running items")

        except Exception as e:
            logger.error(f"❌ Failed to cleanup stale items: {e}", exc_info=True)
            # Don't raise - continue with worker startup even if cleanup fails

    async def start(self):
        """Start the background worker."""
        logger.info("🔵 CrawlQueueWorker.start() called")

        if self.is_running:
            logger.info("⚠️ Queue worker already running, skipping start")
            return

        logger.info("🚀 Starting crawl queue worker...")

        # Load settings from database
        logger.info("📝 Loading settings from database...")
        try:
            await self._load_settings()
            logger.info("✅ Settings loaded successfully")
        except Exception as e:
            logger.error(f"❌ Failed to load settings: {e}", exc_info=True)
            # Continue with defaults

        logger.info("🔧 Initializing worker state...")
        self.is_running = True
        self._shutdown_event.clear()
        logger.info(f"   is_running: {self.is_running}")
        logger.info(f"   shutdown_event cleared: {not self._shutdown_event.is_set()}")

        # Cleanup stale running items before starting worker loop
        logger.info("🧹 Cleaning up stale running items...")
        await self._cleanup_stale_items()

        # Start the worker loop as a background task
        logger.info("🔵 Creating worker task...")
        try:
            # Get current event loop for diagnostics
            loop = asyncio.get_event_loop()
            logger.info(f"   Event loop: {loop}")
            logger.info(f"   Event loop running: {loop.is_running()}")

            # Create the task
            self._worker_task = asyncio.create_task(self._worker_loop())

            # Verify task creation
            logger.info(f"✅ Worker task created successfully")
            logger.info(f"   Task object: {self._worker_task}")
            logger.info(f"   Task done: {self._worker_task.done()}")
            logger.info(f"   Task cancelled: {self._worker_task.cancelled()}")

        except Exception as e:
            logger.error(f"❌ Failed to create worker task: {e}", exc_info=True)
            self.is_running = False
            raise

        logger.info(
            f"✅ Crawl queue worker started | batch_size={self._batch_size} | "
            f"poll_interval={self._poll_interval}s"
        )

        # Add a small delay and check if task is still alive
        await asyncio.sleep(0.1)
        if self._worker_task.done():
            try:
                exception = self._worker_task.exception()
                logger.error(f"❌ Worker task completed immediately with exception: {exception}")
            except Exception:
                logger.error("❌ Worker task completed immediately (no exception)")
        else:
            logger.info("✅ Worker task is running")

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
            "poll_interval": self._poll_interval,
            "high_priority_poll_interval": self._high_priority_poll_interval
        }

    async def _worker_loop(self):
        """Main worker loop that polls and processes the queue."""
        logger.info("🟢 Worker loop ENTRY - Starting main loop")
        logger.info(f"   Initial state: is_running={self.is_running}, is_paused={self.is_paused}")
        logger.info(f"   Shutdown event set: {self._shutdown_event.is_set()}")
        logger.info(f"   Poll interval: {self._poll_interval}s, Batch size: {self._batch_size}")

        iteration = 0

        try:
            while not self._shutdown_event.is_set():
                iteration += 1
                logger.info(f"🔄 Worker loop iteration #{iteration}")

                try:
                    # Check pause state
                    if self.is_paused:
                        logger.info(f"⏸️  Worker paused (iteration #{iteration}), sleeping for {self._poll_interval}s...")
                        await asyncio.sleep(self._poll_interval)
                        continue

                    logger.info(f"📥 Fetching pending items (batch_size={self._batch_size})...")
                    # Fetch next batch of pending items
                    pending_items = await self.queue_manager.get_next_batch(limit=self._batch_size)
                    logger.info(f"   Found {len(pending_items)} pending items")

                    # Also check for items ready for retry
                    logger.info(f"🔁 Fetching retry candidates (batch_size={self._batch_size})...")
                    retry_items = await self.queue_manager.get_retry_candidates(limit=self._batch_size)
                    logger.info(f"   Found {len(retry_items)} retry candidates")

                    # Combine and limit to batch size
                    all_items = pending_items + retry_items
                    items_to_process = all_items[:self._batch_size]
                    logger.info(f"📋 Total items to process: {len(items_to_process)}")

                    if items_to_process:
                        logger.info(
                            f"🚀 Processing batch #{iteration} | pending={len(pending_items)} | "
                            f"retries={len(retry_items)} | total={len(items_to_process)}"
                        )

                        # Log item IDs for debugging
                        item_ids = [item.get('item_id', 'unknown') for item in items_to_process]
                        logger.info(f"   Item IDs: {item_ids}")

                        # Process items concurrently
                        await self._process_batch(items_to_process)

                        logger.info(f"✅ Batch #{iteration} processing completed")

                    else:
                        logger.info(f"💤 No items in queue (iteration #{iteration}), sleeping for {self._poll_interval}s...")

                    # Dynamic polling: use faster interval if high-priority items are pending
                    has_high_priority = any(
                        item.get("priority", 0) >= 200
                        for item in pending_items
                    )

                    sleep_interval = (
                        self._high_priority_poll_interval
                        if has_high_priority
                        else self._poll_interval
                    )

                    if has_high_priority:
                        logger.info(
                            f"🔥 High-priority items detected, using fast polling ({sleep_interval}s)"
                        )

                    logger.info(f"😴 Sleeping for {sleep_interval}s before next iteration...")
                    await asyncio.sleep(sleep_interval)

                except asyncio.CancelledError:
                    logger.info("🛑 Worker loop cancelled (CancelledError)")
                    break
                except Exception as e:
                    logger.error(f"❌ Worker loop error (iteration #{iteration}) | error={str(e)}", exc_info=True)
                    logger.info(f"   Continuing after error, sleeping for {self._poll_interval}s...")
                    # Continue processing after error
                    await asyncio.sleep(self._poll_interval)

        except Exception as outer_e:
            logger.error(f"❌ CRITICAL: Outer worker loop exception | error={str(outer_e)}", exc_info=True)

        logger.info(f"🔴 Worker loop EXITING after {iteration} iterations")
        logger.info(f"   Final state: is_running={self.is_running}, shutdown_event={self._shutdown_event.is_set()}")

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

            # Create progress callback that updates queue metadata
            async def queue_progress_callback(status: str, progress: int, message: str, **kwargs):
                """Update queue item metadata with progress information."""
                try:
                    # Build progress info object
                    progress_info = {
                        "progress": progress,
                        "status": status,
                        "currentUrl": kwargs.get("currentUrl", ""),
                        "batch_current": kwargs.get("batch_current", 1),
                        "batch_total": kwargs.get("batch_total", 1),
                        "urls_discovered": kwargs.get("urls_discovered", 0),
                        "total_pages": kwargs.get("total_pages", 0),
                        "processed_pages": kwargs.get("processed_pages", 0),
                    }

                    # Update queue item metadata
                    await self._update_queue_metadata(item_id, progress_info)
                except Exception as e:
                    logger.warning(f"Failed to update queue metadata: {e}")

            # Set progress callback on crawl service
            crawl_service.set_progress_callback(queue_progress_callback)

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

    async def _update_queue_metadata(self, item_id: str, progress_info: Dict[str, Any]):
        """
        Update queue item metadata with progress information.

        Args:
            item_id: Queue item ID
            progress_info: Progress information dict with keys like progress, status, currentUrl, etc.
        """
        try:
            # Get current metadata
            result = (
                self.supabase.table("archon_crawl_queue")
                .select("metadata")
                .eq("item_id", item_id)
                .single()
                .execute()
            )

            current_metadata = result.data.get("metadata", {}) if result.data else {}
            if not isinstance(current_metadata, dict):
                current_metadata = {}

            # Update metadata with progress info
            current_metadata["progress_info"] = progress_info

            # Store updated metadata
            self.supabase.table("archon_crawl_queue").update({
                "metadata": current_metadata
            }).eq("item_id", item_id).execute()

        except Exception as e:
            logger.warning(f"Failed to update queue metadata for {item_id}: {e}")

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
