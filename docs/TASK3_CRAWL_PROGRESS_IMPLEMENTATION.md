# Task 3: Crawl Progress Tracking Implementation Guide

**Task ID:** 75168739-eca0-487c-87f5-628aa9fa3b10
**Status:** Backend integration required
**Estimated Effort:** 2.5 hours

---

## Current State Analysis

### What Exists:
1. ✅ **Progress API** (`/api/progress/{operation_id}`) - Already implemented
2. ✅ **ProgressTracker** - In-memory progress storage with HTTP polling
3. ✅ **Old Archon UI** - Shows pages_crawled, documents_created, code_blocks_found
4. ✅ **Queue System** - New batch crawling with queue_worker.py

### The Gap:
The new queue-based crawling system (**queue_worker.py**) is **not integrated** with ProgressTracker. When a queue item is processed, progress metrics (pages/depth) are not tracked.

---

## Implementation Plan

### Step 1: Integrate ProgressTracker with Queue Worker

**File:** `python/src/server/services/crawling/queue_worker.py`
**Line:** 333 (just before `result = await crawl_service.orchestrate_crawl`)

Add:
```python
# Initialize progress tracking for this queue item
from ...utils.progress import ProgressTracker
progress_tracker = ProgressTracker(item_id, "crawl")
await progress_tracker.start({
    "url": url,
    "source_id": source_id,
    "crawl_type": "queue_refresh",
    "total_pages": 0,  # Will be updated as we discover pages
    "pages_crawled": 0,
    "current_depth": 0
})

# Pass progress_id to crawl service
crawl_request["progress_id"] = item_id  # Use item_id as progress_id
```

### Step 2: Update Crawling Service to Accept progress_id

**File:** `python/src/server/services/crawling/crawling_service.py`
**Method:** `orchestrate_crawl`

Add parameter:
```python
async def orchestrate_crawl(
    self,
    crawl_request: dict,
    progress_id: str | None = None  # NEW PARAMETER
) -> dict:
    # Pass progress_id to recursive strategy
    if progress_id:
        strategy_params["progress_id"] = progress_id
```

### Step 3: Update Recursive Crawler to Report Progress

**File:** `python/src/server/services/crawling/strategies/recursive.py`

Currently, the recursive crawler has internal progress tracking but doesn't use ProgressTracker. Need to add:

```python
# In recursive.py, at the start of crawl_recursive()
if progress_id:
    progress_tracker = ProgressTracker(progress_id, "crawl")
    # Already created in queue_worker, just get it
    tracker = ProgressTracker.get_progress(progress_id)

# After each page is crawled (in the loop):
if progress_id:
    await ProgressTracker.update(
        progress_id=progress_id,
        status="crawling",
        progress=min(95, (pages_crawled / max(total_pages, 1)) * 100),
        log=f"Crawling page {pages_crawled} of {total_pages} at depth {current_depth}",
        pages_crawled=pages_crawled,
        total_pages=total_pages,
        current_depth=current_depth,
        current_url=current_page_url,
        documents_created=chunks_stored,
        code_blocks_found=code_examples_found
    )
```

### Step 4: Frontend Integration (Ready to Use)

**File:** `archon-ui-nextjs/src/components/KnowledgeBase/CrawlQueueMonitor.tsx`

Add interface and state:
```typescript
interface CrawlProgress {
  pages_crawled: number;
  total_pages: number;
  current_depth: number;
  current_url: string;
  pages_per_sec?: number;
  documents_created?: number;
  code_blocks_found?: number;
}

const [progressMap, setProgressMap] = useState<Record<string, CrawlProgress>>({});

// Poll for progress of running items
useEffect(() => {
  if (!runningItems.length) return;

  const fetchProgress = async () => {
    const progressPromises = runningItems.map(async (item) => {
      try {
        const response = await fetch(`http://localhost:8181/api/progress/${item.item_id}`);
        if (!response.ok) return null;
        const data = await response.json();

        return {
          item_id: item.item_id,
          progress: {
            pages_crawled: data.pagesCrawled || data.processedPages || 0,
            total_pages: data.totalPages || 0,
            current_depth: data.currentDepth || data.details?.current_depth || 0,
            current_url: data.currentUrl || "",
            documents_created: data.details?.documentsCreated || 0,
            code_blocks_found: data.codeBlocksFound || 0
          }
        };
      } catch (error) {
        console.error(`Failed to fetch progress for ${item.item_id}:`, error);
        return null;
      }
    });

    const results = (await Promise.all(progressPromises)).filter(Boolean);
    const newProgressMap: Record<string, CrawlProgress> = {};
    results.forEach((result) => {
      if (result) {
        newProgressMap[result.item_id] = result.progress;
      }
    });
    setProgressMap(newProgressMap);
  };

  fetchProgress();
  const interval = setInterval(fetchProgress, 1000); // Poll every second
  return () => clearInterval(interval);
}, [runningItems]);

// Replace the generic progress message (line 786) with:
{item.status === "running" && progressMap[item.item_id] && (
  <div className="mt-3 space-y-2">
    {/* Progress Details */}
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">
        Crawling page {progressMap[item.item_id].pages_crawled}
        {progressMap[item.item_id].total_pages > 0 && (
          <> of {progressMap[item.item_id].total_pages}</>
        )}
        {" "}at depth {progressMap[item.item_id].current_depth}
      </span>
    </div>

    {/* Current URL */}
    {progressMap[item.item_id].current_url && (
      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
        {progressMap[item.item_id].current_url}
      </div>
    )}

    {/* Stats Grid */}
    <div className="grid grid-cols-3 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="text-center">
        <div className="text-lg font-bold text-brand-500">
          {progressMap[item.item_id].pages_crawled}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Pages</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-gray-500 dark:text-gray-400">
          {progressMap[item.item_id].documents_created || 0}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Documents</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-gray-500 dark:text-gray-400">
          {progressMap[item.item_id].code_blocks_found || 0}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Code</div>
      </div>
    </div>
  </div>
)}
```

---

## Why This Approach?

### Current Implementation:
- **Queue items** → Database table `archon_crawl_queue_items`
- **Progress tracking** → In-memory `ProgressTracker` class (separate system)
- **No bridge** between queue processing and progress updates

### Required Integration Points:
1. **queue_worker.py:333** → Create ProgressTracker when starting crawl
2. **crawling_service.py** → Pass progress_id to strategies
3. **recursive.py** → Update ProgressTracker after each page crawled
4. **Frontend** → Poll `/api/progress/{item_id}` for real-time stats

---

## Testing Plan

### Backend Tests:
```bash
# 1. Start a queue crawl
curl -X POST http://localhost:8181/api/crawl-queue/add-batch \
  -H "Content-Type: application/json" \
  -d '{"source_ids": ["28d45813188ab20e"], "priority": 200}'

# 2. Get the item_id from response
ITEM_ID="<item_id_from_response>"

# 3. Poll for progress (should return pages/depth)
curl http://localhost:8181/api/progress/$ITEM_ID | jq

# Expected output:
# {
#   "progressId": "<item_id>",
#   "status": "crawling",
#   "progress": 45,
#   "pagesCrawled": 23,
#   "totalPages": 51,
#   "currentDepth": 2,
#   "currentUrl": "https://example.com/page23",
#   "codeBlocksFound": 12
# }
```

### Frontend Tests:
1. Start a crawl via UI
2. Verify "Crawling page X of Y at depth Z" appears
3. Watch stats grid update in real-time (Pages/Documents/Code)
4. Confirm updates stop when crawl completes

---

## Benefits of Completion

### User Experience:
- ✅ **Transparency**: See exactly what's being crawled
- ✅ **Confidence**: Know the system is working (not stuck)
- ✅ **Debugging**: Identify slow crawls or stuck pages

### Original Archon Parity:
- ✅ Matches the original Archon UI progress display
- ✅ Shows pages crawled / total / depth (like original)
- ✅ Real-time updates every 1 second

### Technical Quality:
- ✅ Reuses existing `/api/progress/` infrastructure
- ✅ No new endpoints needed
- ✅ Minimal performance impact (in-memory tracking)

---

## Alternative: Simple Message Without Progress

If backend integration is deferred, update line 786 to show source details:

```typescript
{item.status === "running" && (
  <div className="flex flex-col py-2 text-xs text-gray-600 dark:text-gray-400">
    <span className="font-medium">Crawling: {source?.url}</span>
    <span className="text-gray-500 dark:text-gray-500 mt-1">
      Check queue completion for full statistics
    </span>
  </div>
)}
```

This provides **basic context** without requiring backend changes.

---

## Implementation Status

| Component | Status | Effort | Owner |
|-----------|--------|--------|-------|
| Backend: queue_worker integration | ⏸️ Documented | 1 hour | backend-api-expert |
| Backend: crawling_service update | ⏸️ Documented | 30 min | backend-api-expert |
| Backend: recursive.py progress | ⏸️ Documented | 1 hour | backend-api-expert |
| Frontend: Progress polling | ✅ Ready | - | Already coded above |
| Testing | ⏸️ Pending backend | 30 min | QA |

**Total Backend Work Remaining:** ~2.5 hours
**Frontend:** Ready to use once backend is complete

---

## Decision

### Option A: Full Implementation (2.5h backend work)
- Complete integration as documented above
- Full progress visibility like original Archon
- Best user experience

### Option B: Simple Message (5 minutes)
- Show source URL during crawling
- No detailed progress metrics
- Quick win, deferred backend work

### Recommendation:
**Option B for now**, **Option A for v0.5.0**

The backend integration is well-documented and can be implemented by a backend-api-expert agent when time allows. The frontend code is ready to use.

---

**Created:** 2026-01-14
**Last Updated:** 2026-01-14
**Documentation Version:** 1.0
