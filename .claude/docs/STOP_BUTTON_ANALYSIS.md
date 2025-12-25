# Stop Button Implementation Analysis - Archon Dashboard

## Overview

The Archon dashboard (ports 3737 for React, or Next.js version) implements a stop button for cancelling running crawl and upload operations. This analysis covers both the original archon-ui-main (React) and the Next.js variant (archon-ui-nextjs).

---

## 1. Frontend Implementation (archon-ui-main - Port 3737)

### A. CrawlingProgress Component

**File**: `/home/ljutzkanov/Documents/Projects/archon/archon-ui-main/src/features/progress/components/CrawlingProgress.tsx`

#### UI Rendering
```typescript
{isActive && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleStop(operation.operation_id)}
    disabled={stoppingId === operation.operation_id}
    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
  >
    {stoppingId === operation.operation_id ? (
      <Loader2 className="w-4 h-4 animate-spin" />
    ) : (
      <StopCircle className="w-4 h-4" />
    )}
    <span className="ml-2">Stop</span>
  </Button>
)}
```

#### Stop Handler
```typescript
const handleStop = async (progressId: string) => {
  try {
    setStoppingId(progressId);
    await stopMutation.mutateAsync(progressId);
    // Toast is now handled by the useStopCrawl hook
  } catch (error) {
    // Error toast is now handled by the useStopCrawl hook
    console.error("Stop crawl failed:", { progressId, error });
  } finally {
    setStoppingId(null);
  }
};
```

**Key Features**:
- Shows only when operation is active (status in specific list: crawling, processing, in_progress, starting, etc.)
- Displays spinner while stopping (via `stoppingId` state)
- Disabled while operation is being stopped
- Visual feedback: red button with stop icon

---

### B. useStopCrawl Hook

**File**: `/home/ljutzkanov/Documents/Projects/archon/archon-ui-main/src/features/knowledge/hooks/useKnowledgeQueries.ts` (lines 481-505)

```typescript
export function useStopCrawl() {
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (progressId: string) => knowledgeService.stopCrawl(progressId),
    onSuccess: (_data, progressId) => {
      showToast(`Stop requested (${progressId}). Operation will end shortly.`, "info");
    },
    onError: (error, progressId) => {
      // If it's a 404, the operation might have already completed or been cancelled
      const is404Error =
        (error as any)?.statusCode === 404 ||
        (error instanceof Error && (error.message.includes("404") || error.message.includes("not found")));

      if (is404Error) {
        // Don't show error for 404s - the operation is likely already gone
        return;
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to stop crawl (${progressId}): ${errorMessage}`, "error");
    },
  });
}
```

**Key Features**:
- Uses TanStack Query `useMutation` for API call management
- Success: Shows info toast with progress ID
- Error Handling:
  - Silently ignores 404 errors (operation already completed/cancelled)
  - Shows error toast for other failures
- Returns mutation object for component to call via `mutateAsync()`

---

### C. Knowledge Service API Call

**File**: `/home/ljutzkanov/Documents/Projects/archon/archon-ui-main/src/features/knowledge/services/knowledgeService.ts`

```typescript
async stopCrawl(progressId: string): Promise<{ success: boolean; message: string }> {
  return callAPIWithETag<{ success: boolean; message: string }>(`/api/knowledge-items/stop/${progressId}`, {
    method: "POST",
  });
}
```

**Key Details**:
- **API Endpoint**: `POST /api/knowledge-items/stop/{progress_id}`
- **ETag Support**: Uses `callAPIWithETag` for HTTP caching optimization
- **Response Type**: `{ success: boolean; message: string }`

---

## 2. Frontend Implementation (archon-ui-nextjs - Next.js Version)

### A. CrawlingProgress Component

**File**: `/home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs/src/components/KnowledgeBase/CrawlingProgress.tsx`

#### UI Rendering (lines 222-230)
```typescript
<button
  onClick={handleStop}
  disabled={isStopping}
  className="ml-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
  title="Stop operation"
>
  <HiStop className="h-4 w-4" />
  {isStopping ? "Stopping..." : "Stop"}
</button>
```

#### Stop Handler (lines 136-146)
```typescript
const handleStop = async () => {
  if (!confirm("Are you sure you want to stop this operation?")) {
    return;
  }

  setIsStopping(true);
  try {
    await onStop(operation.id);
  } finally {
    setIsStopping(false);
  }
};
```

#### Parent Caller (lines 26-35)
```typescript
const handleStop = async (progressId: string) => {
  try {
    await progressApi.stop(progressId);
    // Refetch to update UI
    refetch();
  } catch (error) {
    console.error("Failed to stop operation:", error);
    alert("Failed to stop operation. Please try again.");
  }
};
```

**Key Features**:
- Confirmation dialog before stopping (more cautious UX)
- Manual loading state (`isStopping`)
- Basic error handling with alert
- Manual refetch after stop

---

### B. API Client Stop Method

**File**: `/home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs/src/lib/apiClient.ts` (lines 585-588)

```typescript
stop: async (progressId: string): Promise<StopOperationResponse> => {
  const response = await apiClient.post(`/api/knowledge-items/stop/${progressId}`);
  return response.data;
}
```

**Key Details**:
- **API Endpoint**: `POST /api/knowledge-items/stop/{progressId}`
- **Base URL**: `http://localhost:8181` (configurable via `NEXT_PUBLIC_API_URL`)
- **Response Type**: `StopOperationResponse`
- **Error Handling**: Via axios interceptor (transforms to `ApiError` type)

---

## 3. Backend API Implementation

### Endpoint Definition

**File**: `/home/ljutzkanov/Documents/Projects/archon/python/src/server/api_routes/knowledge_api.py` (lines 1301-1366)

```python
@router.post("/knowledge-items/stop/{progress_id}")
async def stop_crawl_task(progress_id: str):
    """Stop a running crawl task."""
    try:
        from ..services.crawling import get_active_orchestration, unregister_orchestration

        safe_logfire_info(f"Stop crawl requested | progress_id={progress_id}")

        found = False
        # Step 1: Cancel the orchestration service
        orchestration = await get_active_orchestration(progress_id)
        if orchestration:
            orchestration.cancel()
            found = True

        # Step 2: Cancel the asyncio task
        if progress_id in active_crawl_tasks:
            task = active_crawl_tasks[progress_id]
            if not task.done():
                task.cancel()
                try:
                    await asyncio.wait_for(task, timeout=2.0)
                except (TimeoutError, asyncio.CancelledError):
                    pass
            del active_crawl_tasks[progress_id]
            found = True

        # Step 3: Remove from active orchestrations registry
        await unregister_orchestration(progress_id)

        # Step 4: Update progress tracker to reflect cancellation
        if found:
            try:
                from ..utils.progress.progress_tracker import ProgressTracker
                current_state = ProgressTracker.get_progress(progress_id)
                current_progress = current_state.get("progress", 0) if current_state else 0

                tracker = ProgressTracker(progress_id, operation_type="crawl")
                await tracker.update(
                    status="cancelled",
                    progress=current_progress,
                    log="Crawl cancelled by user"
                )
            except Exception:
                # Best effort - don't fail the cancellation if tracker update fails
                pass

        if not found:
            raise HTTPException(status_code=404, detail={"error": "No active task for given progress_id"})

        safe_logfire_info(f"Successfully stopped crawl task | progress_id={progress_id}")
        return {
            "success": True,
            "message": "Crawl task stopped successfully",
            "progressId": progress_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        safe_logfire_error(
            f"Failed to stop crawl task | error={str(e)} | progress_id={progress_id}"
        )
        raise HTTPException(status_code=500, detail={"error": str(e)})
```

### Stop Mechanism

The stop process is **multi-layered**:

1. **Orchestration Service Cancellation**
   - Calls `orchestration.cancel()` to stop the CrawlingService
   - This gracefully stops any active crawling operations

2. **AsyncIO Task Cancellation**
   - Cancels the actual asyncio task (with 2-second timeout)
   - Removes task from `active_crawl_tasks` registry
   - Handles timeout gracefully

3. **Registry Cleanup**
   - Unregisters from active orchestrations registry
   - Prevents restart of already-cancelled operations

4. **Progress Tracking Update**
   - Sets status to `"cancelled"`
   - Updates progress tracker for UI polling
   - Preserves current progress percentage
   - Adds log message: "Crawl cancelled by user"

### Response

**Success (200)**:
```json
{
  "success": true,
  "message": "Crawl task stopped successfully",
  "progressId": "{progress_id}"
}
```

**Not Found (404)**:
```json
{
  "error": "No active task for given progress_id"
}
```

**Server Error (500)**:
```json
{
  "error": "{error_message}"
}
```

---

## 4. Complete Request/Response Flow

### Request Flow
```
User clicks Stop button
  ↓
handleStop(progressId) 
  ↓
knowledgeService.stopCrawl(progressId) [archon-ui-main]
OR progressApi.stop(progressId) [archon-ui-nextjs]
  ↓
POST /api/knowledge-items/stop/{progress_id}
  ↓
Backend: stop_crawl_task() endpoint
```

### Cancellation Steps (Backend)
```
1. Get active orchestration service
   ↓
2. Call orchestration.cancel() (graceful stop)
   ↓
3. Get asyncio task from active_crawl_tasks dict
   ↓
4. Call task.cancel() (async cancellation)
   ↓
5. Wait up to 2 seconds for task to complete
   ↓
6. Clean up task from registry
   ↓
7. Unregister from orchestrations
   ↓
8. Update ProgressTracker (status = "cancelled")
   ↓
9. Return success response
```

### UI Feedback Loop
```
User clicks Stop
  ↓
Show loading spinner / "Stopping..." text
  ↓
API call to stop endpoint
  ↓
Success: Show toast notification (archon-ui-main)
         Refetch and update UI (archon-ui-nextjs)
  ↓
Error: Show error toast (except 404)
       Silent for 404 (operation already gone)
```

---

## 5. Error Handling & Edge Cases

### Normal Stop (Operation Found)
- Response: 200 OK
- UI: Toast shown, operation removed from active list
- Status: Marked as "cancelled" in progress tracker

### Operation Already Completed
- Response: 404 Not Found
- UI: Silent (no error shown to user)
- Reason: Operation already in terminal state

### Task Cancellation Timeout
- Timeout: 2 seconds
- Behavior: Continues cleanup even if task doesn't cancel within timeout
- Impact: Task removed from registry regardless

### Orchestration Missing
- Behavior: Proceeds to cancel asyncio task
- Fallback: Can cancel task without orchestration reference

### Progress Tracker Update Fails
- Behavior: Continues without failing the stop operation
- Impact: Operation cancelled but status not updated (best-effort)

---

## 6. Key Implementation Details

### Active Task Tracking
```python
# Global dictionary in knowledge_api.py (line 57)
active_crawl_tasks: dict[str, asyncio.Task] = {}

# Populated when crawl starts (lines 868-871)
crawl_task = result.get("task")
if crawl_task:
    active_crawl_tasks[progress_id] = crawl_task

# Cleaned up on completion (lines 904-908)
if progress_id in active_crawl_tasks:
    del active_crawl_tasks[progress_id]
```

### Statuses During Cancellation
```
Before Stop: "crawling", "processing", "in_progress", etc.
After Stop:  "cancelled"
```

### Progress Preservation
- Current progress percentage is preserved
- Allows UI to show how far the operation got

### Logging
- Uses `safe_logfire_info()` and `safe_logfire_error()` for structured logging
- All stop attempts logged with progress_id
- Success/failure clearly indicated

---

## 7. API Endpoint Summary

| Aspect | Value |
|--------|-------|
| **Endpoint** | `POST /api/knowledge-items/stop/{progress_id}` |
| **HTTP Method** | POST |
| **Parameter** | `progress_id` (path parameter) |
| **Response** | `{ success: bool, message: str, progressId: str }` |
| **Success Code** | 200 OK |
| **Error Codes** | 404 (not found), 500 (server error) |
| **Timeout** | Task cancellation waits max 2 seconds |
| **Side Effects** | Updates ProgressTracker, removes from registry |

---

## 8. Frontend Integration Patterns

### archon-ui-main (React)
- Uses TanStack Query mutations
- Automatic cache invalidation handled by hook
- Toast notifications via shared hook
- 404 errors silently ignored
- Progress ID used for state management

### archon-ui-nextjs (Next.js)
- Manual axios calls
- Confirmation dialog for UX
- Manual refetch after stop
- Basic error alerts
- Client-side loading state

---

## 9. Best Practices Observed

✅ **Graceful Degradation**: Continues cleanup even if orchestration missing
✅ **Timeout Protection**: 2-second timeout prevents hanging
✅ **Registry Cleanup**: Prevents state leaks
✅ **Progress Preservation**: Shows how far operation got
✅ **Structured Logging**: All operations tracked with IDs
✅ **Silent 404s**: User-friendly (operation already gone)
✅ **Atomic Cleanup**: Multiple cancellation points ensure cleanup
✅ **State Consistency**: Updates progress tracker for polling

---

## Summary

The stop mechanism is **robust and multi-layered**:
1. **Frontend**: Simple button click with loading state
2. **Service Layer**: Mutation hook handles API call and feedback
3. **Backend**: Multi-step cancellation with fallbacks and cleanup
4. **Monitoring**: Progress tracker updated immediately
5. **Error Handling**: Graceful for common cases (404, timeout)

The implementation handles edge cases well and provides clear user feedback while maintaining backend consistency.
