# Queue Worker Diagnostic Report

**Date:** 2026-01-22
**Task:** 2.1 - Add comprehensive logging to diagnose worker startup failure
**Status:** COMPLETE

## Executive Summary

Successfully diagnosed queue worker "silent failure" issue. Worker WAS functioning correctly but appeared silent due to:
1. Logging using `safe_logfire_info()` which doesn't output when Logfire is disabled
2. No items in queue to process (26 items stuck in "running" status, not fetched)

**Root Cause:** Stuck queue items not being cleaned up on worker restart.

## Problem Description

### Initial Symptoms
- Worker showed "✅ Crawl queue worker started" but NO subsequent logs
- 26 queue items stuck in "running" status for >20 hours
- No error messages, no exceptions
- Appeared completely silent after startup

### Actual Root Cause
Worker was functioning correctly but:
1. `safe_logfire_info()` logging didn't output (Logfire disabled)
2. Queue had 0 "pending" items and 0 "failed" retry candidates
3. 26 items stuck in "running" status were not being fetched

## Diagnostic Implementation

### Changes Made

**File:** `python/src/server/services/crawling/queue_worker.py`

**1. Enhanced `start()` method** (lines 102-162):
```python
async def start(self):
    """Start the background worker."""
    logger.info("🔵 CrawlQueueWorker.start() called")

    # ... existing code ...

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
        logger.info(f"   Task done: {self._worker_task.done()}")
        logger.info(f"   Task cancelled: {self._worker_task.cancelled()}")

    except Exception as e:
        logger.error(f"❌ Failed to create worker task: {e}", exc_info=True)
        self.is_running = False
        raise

    # Verify task is still alive after creation
    await asyncio.sleep(0.1)
    if self._worker_task.done():
        try:
            exception = self._worker_task.exception()
            logger.error(f"❌ Worker task completed immediately with exception: {exception}")
        except Exception:
            logger.error("❌ Worker task completed immediately (no exception)")
```

**2. Enhanced `_worker_loop()` method** (lines 204-284):
```python
async def _worker_loop(self):
    """Main worker loop that polls and processes the queue."""
    logger.info("🟢 Worker loop ENTRY - Starting main loop")
    logger.info(f"   Initial state: is_running={self.is_running}, is_paused={self.is_paused}")
    logger.info(f"   Poll interval: {self._poll_interval}s, Batch size: {self._batch_size}")

    iteration = 0

    while not self._shutdown_event.is_set():
        iteration += 1
        logger.info(f"🔄 Worker loop iteration #{iteration}")

        logger.info(f"📥 Fetching pending items (batch_size={self._batch_size})...")
        pending_items = await self.queue_manager.get_next_batch(limit=self._batch_size)
        logger.info(f"   Found {len(pending_items)} pending items")

        logger.info(f"🔁 Fetching retry candidates (batch_size={self._batch_size})...")
        retry_items = await self.queue_manager.get_retry_candidates(limit=self._batch_size)
        logger.info(f"   Found {len(retry_items)} retry candidates")

        # ... process items ...

        logger.info(f"😴 Sleeping for {sleep_interval}s before next iteration...")
        await asyncio.sleep(sleep_interval)
```

**3. Enhanced `_load_settings()` method** (lines 52-93):
```python
async def _load_settings(self):
    """Load worker configuration from database settings."""
    logger.info("🔍 Loading queue worker settings from database...")

    try:
        logger.info("   Querying archon_settings table (category='crawl_queue')...")
        result = (...)
        logger.info(f"   Query returned {len(result.data) if result.data else 0} settings")

        # ... load settings ...

        logger.info(
            f"✅ Loaded queue worker settings | batch_size={self._batch_size} | "
            f"poll_interval={self._poll_interval}s"
        )
    except Exception as e:
        logger.error(f"❌ Failed to load queue settings, using defaults | error={str(e)}", exc_info=True)
```

### Key Fix: Using `logger.info()` instead of `safe_logfire_info()`

**Problem:** `safe_logfire_info()` doesn't output when Logfire is disabled
**Solution:** Use standard `logger.info()` and `logger.error()` throughout

## Diagnostic Output

### Successful Startup Logs (2026-01-22 12:59:57)

```
🔵 CrawlQueueWorker.start() called
🚀 Starting crawl queue worker...
🔍 Loading queue worker settings from database...
   Querying archon_settings table (category='crawl_queue')...
   Query returned 7 settings
   Settings keys found: ['QUEUE_BATCH_SIZE', 'QUEUE_WORKER_ENABLED', ...]
✅ Loaded queue worker settings | batch_size=5 | poll_interval=30s | high_priority_interval=5s | retry_delays=[60, 300, 900]
🔧 Initializing worker state...
   is_running: True
   shutdown_event cleared: True
🔵 Creating worker task...
   Event loop: <_UnixSelectorEventLoop running=True closed=False ...>
   Event loop running: True
✅ Worker task created successfully
   Task object: <Task pending name='Task-21' coro=<CrawlQueueWorker._worker_loop()>>
   Task done: False
   Task cancelled: False
✅ Crawl queue worker started | batch_size=5 | poll_interval=30s
✅ Worker task is running
```

### Worker Loop Iteration #1

```
🟢 Worker loop ENTRY - Starting main loop
   Initial state: is_running=True, is_paused=False
   Shutdown event set: False
   Poll interval: 30s, Batch size: 5
🔄 Worker loop iteration #1
📥 Fetching pending items (batch_size=5)...
   Found 0 pending items
🔁 Fetching retry candidates (batch_size=5)...
   Found 0 retry candidates
📋 Total items to process: 0
💤 No items in queue (iteration #1), sleeping for 30s...
😴 Sleeping for 30s before next iteration...
```

## Database State Analysis

### Queue Status Distribution

```sql
SELECT status, COUNT(*) as count, MIN(created_at) as oldest
FROM archon_crawl_queue
GROUP BY status;
```

**Results:**
- `cancelled`: 15 items (oldest: 2026-01-13 12:13:47)
- `completed`: 32 items (all from 2026-01-21 16:13:01)
- `running`: 26 items (stuck since 2026-01-21 16:13:01) ❌

**Problem:** 26 items stuck in "running" status for >20 hours

### Why Stuck Items Aren't Processed

**Queue Manager Logic:**
- `get_next_batch()` - Fetches items with status = "pending"
- `get_retry_candidates()` - Fetches items with status = "failed" AND retry_at <= NOW()

**Stuck Items:**
- Status = "running" (not "pending", not "failed")
- Never transition to another status
- Never picked up by worker

## Findings & Recommendations

### ✅ Worker Components Functioning Correctly

1. **Worker Startup:** ✅
   - Task creation successful
   - Event loop running
   - Settings loaded correctly

2. **Worker Loop:** ✅
   - Polling every 30 seconds
   - Fetching pending items
   - Fetching retry candidates
   - Sleeping correctly

3. **Configuration:** ✅
   - Batch size: 5
   - Poll interval: 30s
   - High priority interval: 5s
   - Retry delays: [60, 300, 900]

### ❌ Issues Identified

1. **Stuck Queue Items (CRITICAL):**
   - 26 items in "running" status for >20 hours
   - No cleanup mechanism on worker restart
   - Items never transition to completion or failure

2. **Logging Infrastructure:**
   - `safe_logfire_info()` doesn't work when Logfire disabled
   - Fixed by using standard `logger.info()`

### 📋 Next Steps

**Task 2.2 - Implement Startup Cleanup** (READY TO IMPLEMENT)

Create cleanup logic in `start()` method:

```python
async def start(self):
    # ... existing startup code ...

    # Cleanup stale running items before starting worker loop
    await self._cleanup_stale_items()

    # Start worker loop
    self._worker_task = asyncio.create_task(self._worker_loop())

async def _cleanup_stale_items(self):
    """Reset items stuck in running status for >1 hour."""
    cutoff_time = datetime.now() - timedelta(hours=1)

    # Find items stuck in "running" status
    stale_items = await self.queue_manager.get_stale_running_items(cutoff_time)

    for item in stale_items:
        # Reset to "failed" to trigger retry logic
        await self.queue_manager.update_status(
            item.id,
            "failed",
            error_message=f"Worker restart detected. Item was running for >1 hour. Reset for retry.",
            error_type="worker_restart"
        )

    logger.info(f"🧹 Cleaned up {len(stale_items)} stale running items")
```

## Success Metrics

### Before Diagnostic Logging
- ❌ NO worker logs after startup
- ❌ Unknown why worker wasn't processing
- ❌ No visibility into worker state
- ❌ 26 items stuck for >20 hours

### After Diagnostic Logging
- ✅ Complete visibility into worker lifecycle
- ✅ Clear identification of stuck items issue
- ✅ Event loop diagnostics
- ✅ Iteration-by-iteration logging
- ✅ Queue fetch results visible
- ✅ Ready to implement cleanup solution

## Lessons Learned

1. **Always use standard logger** when Logfire might be disabled
2. **Comprehensive logging at every step** critical for async debugging
3. **Event loop diagnostics** help identify task scheduling issues
4. **Iteration counters** help track worker activity over time
5. **Stuck items need cleanup logic** on worker restart

---

**Task 2.1 Status:** ✅ COMPLETE
**Next Task:** 2.2 - Implement startup cleanup for stuck queue items
**Estimated Time for 2.2:** 1.0 hour
