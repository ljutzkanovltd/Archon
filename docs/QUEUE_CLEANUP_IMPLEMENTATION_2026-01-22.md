# Queue Cleanup Implementation Report

**Date:** 2026-01-22
**Task:** 2.2 - Implement startup cleanup for stuck queue items
**Status:** COMPLETE

## Executive Summary

Successfully implemented startup cleanup mechanism for queue items stuck in "running" status. The worker now automatically resets orphaned items to "failed" status with proper retry timestamps on startup, enabling them to be processed again through the retry logic.

## Problem Statement

**Initial Issue:**
- 26 queue items stuck in "running" status for >20 hours
- No cleanup mechanism on worker restart
- Items never transitioned to completion or failure
- Worker appeared functional but found 0 items to process

**Root Causes:**
1. No cleanup logic for items orphaned by worker crashes/restarts
2. `update_status()` didn't set `next_retry_at` for failed items
3. `get_retry_candidates()` had broken column comparison logic

## Implementation

### 1. Cleanup Method (`queue_worker.py`)

**Added `_cleanup_stale_items()` method:**

```python
async def _cleanup_stale_items(self):
    """
    Reset items stuck in 'running' status for more than 1 hour.
    Runs on worker startup to handle orphaned items.
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
            # Calculate duration
            if started_at:
                duration = datetime.now(started_time.tzinfo) - started_time
                duration_hours = duration.total_seconds() / 3600
                duration_str = f"{duration_hours:.1f} hours"
            else:
                duration_str = "unknown duration"

            # Calculate next retry time (first retry delay: 60 seconds)
            first_retry_delay = self._retry_delays[0] if self._retry_delays else 60
            next_retry_time = datetime.utcnow() + timedelta(seconds=first_retry_delay)

            # Reset to failed status with retry timing
            await self.queue_manager.update_status(
                item_id=item_id,
                status="failed",
                error_message=f"Worker restart detected. Item was running for {duration_str}. Reset for retry.",
                error_type="other",  # Changed from "worker_restart" to comply with DB constraint
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
```

**Integrated into `start()` method:**

```python
async def start(self):
    # ... existing startup code ...

    # Cleanup stale running items before starting worker loop
    logger.info("🧹 Cleaning up stale running items...")
    await self._cleanup_stale_items()

    # Start worker loop
    self._worker_task = asyncio.create_task(self._worker_loop())
```

### 2. Database Query Support (`queue_manager.py`)

**Added `get_stale_running_items()` method:**

```python
async def get_stale_running_items(self, cutoff_time: datetime) -> List[Dict[str, Any]]:
    """
    Fetch items stuck in 'running' status for longer than cutoff time.
    Used for cleanup on worker restart.
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
```

### 3. Retry Timestamp Support

**Enhanced `update_status()` to set retry timestamps:**

```python
async def update_status(
    self,
    item_id: str,
    status: str,
    error_message: Optional[str] = None,
    error_type: Optional[str] = None,
    error_details: Optional[Dict[str, Any]] = None,
    next_retry_at: Optional[datetime] = None  # NEW PARAMETER
) -> Dict[str, Any]:
    try:
        update_data: Dict[str, Any] = {"status": status}

        # ... existing timestamp logic ...

        elif status == "failed":
            if error_message:
                update_data["error_message"] = error_message
            if error_type:
                update_data["error_type"] = error_type
            if error_details:
                update_data["error_details"] = error_details
            if next_retry_at:  # NEW: Set retry timing
                update_data["next_retry_at"] = next_retry_at.isoformat()
                update_data["last_retry_at"] = datetime.utcnow().isoformat()

        # ... rest of method ...
```

### 4. Fixed Retry Candidate Query

**Fixed `get_retry_candidates()` column comparison:**

```python
async def get_retry_candidates(self, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Fetch items ready for retry (failed items where next_retry_at <= now).
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
```

**Key Fix:** Changed from `.lt("retry_count", "max_retries")` (which compared to string literal) to Python filtering of `retry_count < max_retries` (column-to-column comparison).

## Issues Encountered & Resolutions

### Issue 1: Missing timedelta Import

**Error:**
```
NameError: name 'timedelta' is not defined
```

**Fix:**
Added `timedelta` to imports:
```python
from datetime import datetime, timedelta
```

### Issue 2: Database Constraint Violation

**Error:**
```
new row for relation "archon_crawl_queue" violates check constraint "archon_crawl_queue_error_type_check"
```

**Root Cause:**
Used `error_type="worker_restart"` which wasn't in allowed values: `['network', 'rate_limit', 'parse_error', 'timeout', 'other']`

**Fix:**
Changed to `error_type="other"` and preserved original intent in `error_details`:
```python
error_type="other",
error_details={
    "cleanup_reason": "worker_startup_cleanup",
    "original_error_type": "worker_restart",
    ...
}
```

### Issue 3: Supabase Client Column Comparison

**Error:**
Query `.lt("retry_count", "max_retries")` compared `retry_count` to string literal `"max_retries"`, not to the column value.

**Fix:**
Fetch all failed items and filter in Python:
```python
all_items = result.data if result.data else []
items = [
    item for item in all_items
    if item.get("retry_count", 0) < item.get("max_retries", 3)
][:limit]
```

## Testing & Verification

### Test 1: Cleanup Execution

**Setup:**
- 26 items stuck in "running" status for >20 hours

**Results:**
```
2026-01-22 13:07:44 | 🧹 Cleaning up stale running items...
2026-01-22 13:07:44 |    Found 26 stale running items
2026-01-22 13:07:44 |       Reset item ... (source: ..., duration: 20.4 hours)
... [26 items reset] ...
2026-01-22 13:07:44 | ✅ Cleaned up 26 stale running items
```

**Database Verification:**
```sql
SELECT status, COUNT(*) FROM archon_crawl_queue GROUP BY status;

-- Before cleanup:
-- running: 26, failed: 0

-- After cleanup:
-- running: 0, failed: 26
```

### Test 2: Retry Timestamp Setting

**Query:**
```sql
SELECT item_id, status, retry_count, next_retry_at
FROM archon_crawl_queue
WHERE status = 'failed'
LIMIT 5;
```

**Results:**
All 26 items had `next_retry_at` set to ~60 seconds in the future:
```
next_retry_at: 2026-01-22 13:11:27.780352+00
current_time:  2026-01-22 13:10:27 (approx)
```

### Test 3: Retry Candidate Discovery

**Worker Logs:**
```
2026-01-22 13:13:15 | 🔁 Fetching retry candidates (batch_size=5)...
2026-01-22 13:13:15 |    Found 5 retry candidates
2026-01-22 13:13:15 | 📋 Total items to process: 5
2026-01-22 13:13:15 | 🚀 Processing batch #1 | pending=0 | retries=5 | total=5
2026-01-22 13:13:15 |    Item IDs: ['0ffd65be...', '823c791e...', 'fa05871b...', '8b23a782...', '9e292db4...']
```

**Success:** Worker found and processed retry candidates!

### Test 4: Active Processing

**Evidence from logs:**
- Pydantic docs: 79 links extracted from llms.txt
- Roboflow docs: 900 links extracted from llms.txt
- FastAPI: 145 URLs from sitemap
- Axios docs: Recursive crawl with 34 internal links
- Tailwindcss docs: Discovery attempts

**Status:** Items are actively being crawled and processed ✅

## Success Metrics

### Before Implementation

- ❌ 26 items stuck in "running" for >20 hours
- ❌ No cleanup mechanism on restart
- ❌ Worker found 0 items to process
- ❌ No retry timestamps set on failed items
- ❌ Broken retry candidate query

### After Implementation

- ✅ All 26 stale items cleaned up successfully
- ✅ Automatic cleanup on every worker startup
- ✅ Worker finding and processing retry candidates
- ✅ Retry timestamps properly set (60s delay)
- ✅ Fixed retry candidate discovery logic
- ✅ Comprehensive diagnostic logging

## Configuration

**Cleanup Settings:**
- Stale threshold: 1 hour
- Retry delay (first attempt): 60 seconds
- Error type: "other" (with original intent preserved)

**Worker Settings:**
- Poll interval: 30 seconds
- Batch size: 5 items
- Retry delays: [60, 300, 900] seconds

## Known Issues (Non-Critical)

**Metadata Column Warning:**
```
Failed to update queue metadata: column archon_crawl_queue.metadata does not exist
```

**Impact:** None - metadata tracking is optional and doesn't affect retry functionality.
**Recommendation:** Add metadata column to schema if needed, or remove metadata update calls.

## Lessons Learned

1. **Always verify database constraints** before hardcoding enum-like values
2. **Supabase Python client limitations** - Column-to-column comparisons require Python filtering
3. **Retry logic requires explicit timestamp management** - Must set `next_retry_at` when failing items
4. **Comprehensive logging is essential** for async worker debugging
5. **Test with actual database state** - Mock data may not reveal client query issues

## Next Steps

**Task 2.3:** Add worker health monitoring and timeout detection
**Estimated Time:** 1.5 hours

**Future Enhancements:**
- Add metadata column to schema (or remove metadata update calls)
- Add metrics for cleanup operations (items cleaned, cleanup duration)
- Add configurable cleanup threshold (currently hardcoded to 1 hour)
- Add tests for cleanup logic

---

**Task 2.2 Status:** ✅ COMPLETE
**Files Modified:**
- `python/src/server/services/crawling/queue_worker.py`
- `python/src/server/services/crawling/queue_manager.py`

**Total Implementation Time:** ~1.5 hours
**Completed By:** backend-api-expert (Claude Code)
**Project:** Knowledge Base Optimization & Restoration
