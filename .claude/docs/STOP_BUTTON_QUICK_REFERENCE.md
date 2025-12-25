# Stop Button - Quick Reference Card

## Exact API Details

```
METHOD: POST
URL:    /api/knowledge-items/stop/{progress_id}
PORT:   8181 (backend API)
```

## Request Format

```bash
curl -X POST http://localhost:8181/api/knowledge-items/stop/{progress_id}
```

## Success Response (200 OK)

```json
{
  "success": true,
  "message": "Crawl task stopped successfully",
  "progressId": "{progress_id}"
}
```

## Error Responses

**404 Not Found** - Operation already completed/cancelled:
```json
{
  "error": "No active task for given progress_id"
}
```

**500 Internal Server Error** - Cancellation failed:
```json
{
  "error": "{error_description}"
}
```

---

## Frontend Implementation (archon-ui-main)

### Hook
```typescript
// File: src/features/knowledge/hooks/useKnowledgeQueries.ts
export function useStopCrawl() {
  const { showToast } = useToast();
  return useMutation({
    mutationFn: (progressId: string) => 
      knowledgeService.stopCrawl(progressId),
    onSuccess: (_data, progressId) => {
      showToast(`Stop requested (${progressId}). Operation will end shortly.`, "info");
    },
    onError: (error, progressId) => {
      // Silent on 404 (operation already gone)
      const is404Error = /* check for 404 */;
      if (is404Error) return;
      showToast(`Failed to stop: ${error.message}`, "error");
    },
  });
}
```

### Component Usage
```typescript
// File: src/features/progress/components/CrawlingProgress.tsx
const { stopMutation } = useStopCrawl();

const handleStop = async (progressId: string) => {
  try {
    setStoppingId(progressId);
    await stopMutation.mutateAsync(progressId);
  } catch (error) {
    console.error("Stop failed:", error);
  } finally {
    setStoppingId(null);
  }
};
```

### Service Layer
```typescript
// File: src/features/knowledge/services/knowledgeService.ts
async stopCrawl(progressId: string) {
  return callAPIWithETag(`/api/knowledge-items/stop/${progressId}`, {
    method: "POST",
  });
}
```

---

## Backend Implementation (Python)

### Endpoint Handler
```python
# File: python/src/server/api_routes/knowledge_api.py (line 1301)
@router.post("/knowledge-items/stop/{progress_id}")
async def stop_crawl_task(progress_id: str):
    # 4-step cancellation process
```

### Cancellation Steps

1. **Get Orchestration Service**
   ```python
   orchestration = await get_active_orchestration(progress_id)
   if orchestration:
       orchestration.cancel()
   ```

2. **Cancel AsyncIO Task**
   ```python
   if progress_id in active_crawl_tasks:
       task = active_crawl_tasks[progress_id]
       if not task.done():
           task.cancel()
           await asyncio.wait_for(task, timeout=2.0)
   ```

3. **Clean Up Registry**
   ```python
   await unregister_orchestration(progress_id)
   del active_crawl_tasks[progress_id]
   ```

4. **Update Progress Tracker**
   ```python
   tracker = ProgressTracker(progress_id)
   await tracker.update(
       status="cancelled",
       progress=current_progress,
       log="Crawl cancelled by user"
   )
   ```

---

## Alternative: archon-ui-nextjs Version

### API Client
```typescript
// File: src/lib/apiClient.ts (line 585)
stop: async (progressId: string): Promise<StopOperationResponse> => {
  const response = await apiClient.post(
    `/api/knowledge-items/stop/${progressId}`
  );
  return response.data;
}
```

### Component Handler
```typescript
const handleStop = async (progressId: string) => {
  if (!confirm("Stop this operation?")) return;
  
  setIsStopping(true);
  try {
    await progressApi.stop(progressId);
    refetch(); // Manual refetch
  } catch (error) {
    alert("Failed to stop operation");
  } finally {
    setIsStopping(false);
  }
};
```

---

## UI Behavior Timeline

```
User clicks "Stop" button
    ↓
[archon-ui-main] Show spinner / [archon-ui-nextjs] Show confirmation
    ↓
POST /api/knowledge-items/stop/{progress_id}
    ↓
Backend cancels in 4 steps (< 2 seconds typically)
    ↓
Response 200 OK
    ↓
[archon-ui-main] Show toast "Stop requested..."
[archon-ui-nextjs] Refetch operations list
    ↓
Operation status changes to "cancelled"
    ↓
UI removes operation from active list (polling)
```

---

## Testing the Endpoint

### Using curl
```bash
# Start a crawl first, get progress_id
curl -X POST http://localhost:8181/api/knowledge-items/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Then stop it
curl -X POST http://localhost:8181/api/knowledge-items/stop/{progress_id}
```

### Expected Behavior
1. Crawl starts and appears in active operations
2. Stop endpoint called
3. Operation status becomes "cancelled"
4. Operation removed from polling (UI updates)
5. Error logs show: "Crawl cancelled by user"

---

## Key Constants

| Item | Value |
|------|-------|
| Task Cancellation Timeout | 2 seconds |
| API Port | 8181 |
| Dashboard Port (React) | 3737 |
| Dashboard Port (Next.js) | 3000 |
| Active Task Registry | `active_crawl_tasks` dict in knowledge_api.py |

---

## File References

| Component | File Path |
|-----------|-----------|
| CrawlingProgress (React) | `archon-ui-main/src/features/progress/components/CrawlingProgress.tsx` |
| useStopCrawl Hook | `archon-ui-main/src/features/knowledge/hooks/useKnowledgeQueries.ts` (L481) |
| Knowledge Service | `archon-ui-main/src/features/knowledge/services/knowledgeService.ts` |
| Backend Endpoint | `python/src/server/api_routes/knowledge_api.py` (L1301) |
| CrawlingProgress (Next.js) | `archon-ui-nextjs/src/components/KnowledgeBase/CrawlingProgress.tsx` |
| API Client (Next.js) | `archon-ui-nextjs/src/lib/apiClient.ts` (L585) |

---

## Common Issues & Solutions

**Problem**: Stop button doesn't appear
- **Cause**: Operation not in active status list
- **Solution**: Check if status is one of: crawling, processing, in_progress, starting, initializing, discovery, analyzing, storing, source_creation, document_storage, code_extraction

**Problem**: Stop fails with 404
- **Cause**: Operation already completed or was removed
- **Solution**: Normal - UI should silently handle this (archon-ui-main does automatically)

**Problem**: Stop button shows spinner indefinitely
- **Cause**: Network timeout or backend unreachable
- **Solution**: Check backend at `http://localhost:8181/api/health`

**Problem**: Operation didn't actually stop
- **Cause**: Task didn't cancel within 2-second timeout
- **Solution**: Task still marked as cancelled in DB, will clean up on next polling

---

## Summary

The stop mechanism is **straightforward and reliable**:
- **Simple API**: Single POST endpoint with progress_id
- **Multi-layered**: Orchestration + AsyncIO + Registry cleanup
- **Forgiving**: Continues cleanup on timeout, silent on 404
- **User-friendly**: Toast feedback and spinner indication

Just POST to `/api/knowledge-items/stop/{progress_id}` and the operation will be cancelled within 2 seconds.
