# Archon Active Operations Tracking System - Research Report

**Research Date:** December 23, 2025
**Project:** Archon UI (archon-ui-main)
**Target:** React + TanStack Query Implementation

---

## Executive Summary

The Archon active operations tracking system is a sophisticated real-time polling architecture built with TanStack Query, featuring:

- **Smart Polling**: Intelligent interval adjustment based on page visibility and focus state
- **ETag Optimization**: HTTP caching with conditional requests to minimize bandwidth
- **Optimistic Updates**: Immediate UI feedback while operations are running
- **Terminal State Detection**: Automatic polling termination for completed/failed operations
- **Error Resilience**: Graceful handling of 404s and transient failures

---

## 1. Active Operations Component

### File Location
- **Component**: `/home/ljutzkanov/Documents/Projects/archon/archon-ui-main/src/features/progress/components/CrawlingProgress.tsx`
- **Imports from**: `useProgressQueries.ts` hook and knowledge service

### Key Features

```typescript
interface CrawlingProgressProps {
  onSwitchToBrowse: () => void;
}
```

### What It Displays

The component renders a list of `ActiveOperation` objects, each showing:

1. **Operation Card** with:
   - Operation ID & Type (Web Crawl, Document Upload)
   - Status badge (starting, crawling, completed, error, etc.)
   - Progress bar (0-100%)
   - Stop button (only for active operations)

2. **Statistics Grid**:
   - Pages Crawled (count)
   - Documents Created (count)
   - Code Blocks Found or Errors (count)

3. **Discovery Information** (if available):
   - Discovered file with clickable link
   - File type badge
   - Linked files list

4. **Current URL** (being processed)

5. **Error Messages** (for failed operations)

### Key Implementation Details

```typescript
// Progress percentage calculation (directly from backend)
const getProgressPercentage = (operation: ActiveOperation): number => {
  if (typeof operation.progress === "number") {
    return Math.round(operation.progress);
  }
  return 0;
};

// Status color mapping
const getStatusColor = (status: string) => {
  switch (status) {
    case "completed": return "text-green-400 bg-green-500/10 border-green-500/20";
    case "error": return "text-red-400 bg-red-500/10 border-red-500/20";
    case "stopped": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    default: return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
  }
};

// Active status determination
const isActive = [
  "crawling", "processing", "in_progress", "starting",
  "initializing", "discovery", "analyzing", "storing",
  "source_creation", "document_storage", "code_extraction"
].includes(operation.status);
```

### Animation & UX

- Uses Framer Motion for smooth enter/exit animations
- Item variants for staggered appearance
- Layout animations when operations complete
- Disabled stop button with spinner during cancellation

---

## 2. Progress Polling Logic

### Hook: `useCrawlProgressPolling()`

**File**: `/home/ljutzkanov/Documents/Projects/archon/archon-ui-main/src/features/progress/hooks/useProgressQueries.ts`

```typescript
/**
 * Hook for polling all crawl operations
 * Used in the CrawlingProgress component
 * Delegates to useActiveOperations for consistency
 */
export function useCrawlProgressPolling() {
  const { data, isLoading } = useActiveOperations(true); // Always enabled for crawling progress

  return {
    activeOperations: data?.operations || [],
    isLoading,
    totalCount: data?.count || 0,
  };
}
```

### Core Polling Hook: `useActiveOperations(enabled)`

```typescript
export function useActiveOperations(enabled = false) {
  const { refetchInterval } = useSmartPolling(5000); // 5 second base interval

  return useQuery<ActiveOperationsResponse>({
    queryKey: progressKeys.active(),
    queryFn: () => progressService.listActiveOperations(),
    enabled,
    refetchInterval: enabled ? refetchInterval : false, // Only poll when explicitly enabled
    staleTime: STALE_TIMES.realtime, // 3 seconds (near real-time)
  });
}
```

### Single Operation Polling: `useOperationProgress(progressId, options)`

```typescript
export function useOperationProgress(
  progressId: string | null,
  options?: {
    onComplete?: (data: ProgressResponse) => void;
    onError?: (error: string) => void;
    pollingInterval?: number; // Default: 1000ms
  },
) {
  const { refetchInterval: smartInterval } = useSmartPolling(options?.pollingInterval ?? 1000);

  const query = useQuery<ProgressResponse | null>({
    queryKey: progressId ? progressKeys.detail(progressId) : DISABLED_QUERY_KEY,
    queryFn: async () => {
      const data = await progressService.getProgress(progressId);
      return data;
    },
    enabled: !!progressId,
    refetchInterval: (query) => {
      const data = query.state.data as ProgressResponse | null | undefined;

      // STOP POLLING: Terminal states don't need further updates
      if (data && TERMINAL_STATES.includes(data.status)) {
        return false; // Disable polling
      }

      // CONTINUE POLLING: Use smart interval
      return smartInterval;
    },
    retry: false, // Don't retry on error
    staleTime: STALE_TIMES.instant, // Always fresh (0ms)
  });

  // Handle completion and error callbacks...
  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    isComplete: query.data?.status === "completed",
    isFailed: query.data?.status === "error" || query.data?.status === "failed",
    isActive: query.data ? !TERMINAL_STATES.includes(query.data.status) : false,
  };
}
```

### Terminal States (Polling Stops)

```typescript
const TERMINAL_STATES: ProgressStatus[] = ["completed", "error", "failed", "cancelled"];
```

### Polling Interval Configuration

| Context | Base Interval | Smart Adjusted |
|---------|---------------|-----------------|
| Active crawls list | 5,000ms (5s) | Normal |
| Single operation | 1,000ms (1s) | Normal |
| Background tab | 1.5x base | 7,500ms or 1,500ms |
| Hidden tab | disabled | No polling |

### Smart Polling Hook: `useSmartPolling(baseInterval)`

**File**: `/home/ljutzkanov/Documents/Projects/archon/archon-ui-main/src/features/shared/hooks/useSmartPolling.ts`

```typescript
export function useSmartPolling(baseInterval: number = 10000) {
  const [isVisible, setIsVisible] = useState(true);
  const [hasFocus, setHasFocus] = useState(true);

  // Listen to visibility and focus changes
  useEffect(() => {
    const handleVisibilityChange = () => setIsVisible(!document.hidden);
    const handleFocus = () => setHasFocus(true);
    const handleBlur = () => setHasFocus(false);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Calculate smart interval
  const getSmartInterval = (): number | false => {
    if (!isVisible) {
      return false; // DISABLED: Page hidden
    }

    if (!hasFocus) {
      return Math.max(baseInterval * 1.5, 5000); // SLOWER: Background polling
    }

    return baseInterval; // NORMAL: Active polling
  };

  return {
    refetchInterval: getSmartInterval(),
    isActive: isVisible && hasFocus,
    isVisible,
    hasFocus,
  };
}
```

**Behavior**:
- **Hidden Tab**: Polling disabled completely (`false`)
- **Visible But Unfocused**: 1.5x base interval, minimum 5s
- **Active Tab**: Use base interval (1s for operations, 5s for list)

---

## 3. Backend Progress API Endpoints

### File Location
`/home/ljutzkanov/Documents/Projects/archon/python/src/server/api_routes/progress_api.py`

### Endpoint 1: Get Single Operation Progress

**Route**: `GET /api/progress/{operation_id}`

**Response**:
```json
{
  "progressId": "string",
  "status": "crawling|processing|completed|error|failed|cancelled|...",
  "progress": 0-100,
  "message": "string (current operation description)",
  "currentUrl": "string (URL being crawled)",
  "pages_crawled": number,
  "total_pages": number,
  "documents_created": number,
  "code_blocks_found": number,
  "stats": {
    "pages_crawled": number,
    "documents_created": number,
    "errors": number
  },
  "discovered_file": "string (discovered file path)",
  "discovered_file_type": "string (pdf, docx, etc.)",
  "linked_files": ["string", "string"],
  "timestamp": "ISO 8601 datetime"
}
```

**Features**:
- ETag support (304 Not Modified for unchanged data)
- `X-Poll-Interval` header: `"1000"` for active operations, `"0"` for terminal states
- Handles 404 for non-existent operations

**Key Headers**:
```
ETag: <hash of stable data>
X-Poll-Interval: 1000  # Suggested polling interval in ms
Cache-Control: no-cache, must-revalidate
Last-Modified: <date>
```

### Endpoint 2: List All Active Operations

**Route**: `GET /api/progress/` (note: trailing slash required)

**Response**:
```json
{
  "operations": [
    {
      "operation_id": "string",
      "operation_type": "crawl|upload",
      "status": "string",
      "progress": 0-100,
      "message": "string",
      "started_at": "ISO 8601 datetime",
      "source_id": "string (optional)",
      "url": "string (optional)",
      "current_url": "string (optional)",
      "crawl_type": "normal|sitemap|llms-txt|refresh|...",
      "pages_crawled": number,
      "total_pages": number,
      "documents_created": number,
      "code_blocks_found": number
    }
  ],
  "count": number,
  "timestamp": "ISO 8601 datetime"
}
```

**Behavior**:
- Only returns non-terminal operations
- Filters out completed, failed, error, and cancelled operations
- Used for discovering pre-existing operations on page load

---

## 4. Stop Operation Endpoint

**Route**: `POST /api/knowledge-items/stop/{progress_id}`

**Implementation** (lines 1301-1365 in knowledge_api.py):

```python
@router.post("/knowledge-items/stop/{progress_id}")
async def stop_crawl_task(progress_id: str):
    """Stop a running crawl task."""
    try:
        # Step 1: Cancel orchestration service
        orchestration = await get_active_orchestration(progress_id)
        if orchestration:
            orchestration.cancel()
            found = True

        # Step 2: Cancel asyncio task
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
            tracker = ProgressTracker(progress_id, operation_type="crawl")
            await tracker.update(
                status="cancelled",
                progress=current_progress,
                log="Crawl cancelled by user"
            )

        if not found:
            raise HTTPException(status_code=404, detail={"error": "No active task for given progress_id"})

        return {
            "success": True,
            "message": "Crawl task stopped successfully",
            "progressId": progress_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})
```

**Response**:
```json
{
  "success": true,
  "message": "Crawl task stopped successfully",
  "progressId": "operation-id"
}
```

**Frontend Hook** (useKnowledgeQueries.ts):

```typescript
export function useStopCrawl() {
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (progressId: string) => knowledgeService.stopCrawl(progressId),
    onSuccess: (_data, progressId) => {
      showToast(`Stop requested (${progressId}). Operation will end shortly.`, "info");
    },
    onError: (error, progressId) => {
      // Don't show error for 404s - operation might have already completed
      const is404Error =
        (error as any)?.statusCode === 404 ||
        (error instanceof Error && error.message.includes("404"));

      if (is404Error) {
        return; // Silent failure for 404s
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to stop crawl (${progressId}): ${errorMessage}`, "error");
    },
  });
}
```

---

## 5. Live Updates Toggle Mechanism

The system uses **TanStack Query's `refetchInterval`** with smart polling logic:

### How It Works

1. **Polling Starts**: When `useActiveOperations(true)` or `useCrawlProgressPolling()` is called
2. **Smart Calculation**: `useSmartPolling()` returns interval based on visibility/focus
3. **Automatic Adjustment**: Polling pauses when tab is hidden, resumes when visible
4. **Terminal Detection**: Polling automatically stops for completed/failed operations
5. **Polling Continues**: Background polling at 1.5x interval while tab is unfocused

### Configuration

**Stale Time Configuration** (queryPatterns.ts):

```typescript
export const STALE_TIMES = {
  instant: 0,           // Always fresh (used for progress)
  realtime: 3_000,      // 3s (for active operations list)
  frequent: 5_000,      // 5s
  normal: 30_000,       // 30s (standard)
  rare: 300_000,        // 5 minutes
  static: Infinity,     // Never stale
} as const;
```

### Progressive Polling Strategy

For CrawlingProgress component:

```
1. Page Loads
   ↓
2. useCrawlProgressPolling() enables active polling
   - Base interval: 5 seconds for the operations list
   ↓
3. useSmartPolling(5000) adjusts based on visibility
   - Active tab: Poll every 5 seconds
   - Background tab: Poll every 7.5 seconds (1.5x)
   - Hidden tab: Disable polling
   ↓
4. Backend returns list of active operations
   - Only non-terminal operations included
   ↓
5. Individual operations can be tracked with 1s polling
   - Terminal state detected → polling stops automatically
```

---

## 6. API Client & ETag Optimization

### File Location
`/home/ljutzkanov/Documents/Projects/archon/archon-ui-main/src/features/shared/api/apiClient.ts`

### Key Features

```typescript
export async function callAPIWithETag<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Build full URL
  const fullUrl = buildFullUrl(endpoint);

  // Set content-type only for requests with body
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Make request with 20s timeout
  const response = await fetch(fullUrl, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(20000),
  });

  // Handle errors and parse JSON
  if (!response.ok) {
    // Parse error message from backend
    const errorBody = await response.text();
    const errorJson = JSON.parse(errorBody);
    
    // Extract error from nested structure: {"detail": {"error": "message"}}
    if (typeof errorJson.detail === "object" && "error" in errorJson.detail) {
      throw new APIServiceError(errorJson.detail.error, "HTTP_ERROR", response.status);
    }
  }

  return response.json() as T;
}
```

### ETag Behavior

**IMPORTANT**: Browser handles ETags automatically:

1. **Client sends**: `If-None-Match: <previous-etag>` (automatic)
2. **Server responds**: 304 Not Modified (data unchanged)
3. **Browser caches**: Returns cached response automatically
4. **App receives**: Same data as before (no parsing overhead)

**Result**: Network bandwidth optimization without app-level complexity

---

## 7. Active Operations Type Definition

**File**: `/home/ljutzkanov/Documents/Projects/archon/archon-ui-main/src/features/progress/types/progress.ts`

```typescript
export interface ActiveOperation {
  // Response fields from backend
  operation_id: string;
  operation_type: string;       // "crawl" or "upload"
  status: string;               // crawling, processing, completed, error, etc.
  progress: number;             // 0-100
  message: string;              // Current operation description
  started_at: string;           // ISO datetime

  // Component-friendly aliases (same as above)
  progressId: string;           // Same as operation_id
  type?: string;                // Same as operation_type
  url?: string;                 // Original URL being crawled
  source_id?: string;           // Source ID for matching

  // Additional fields
  current_url?: string;         // URL currently being processed
  pages_crawled?: number;
  total_pages?: number;
  code_blocks_found?: number;
  documents_created?: number;
  crawl_type?: string;          // normal, sitemap, refresh, etc.

  // Statistics
  stats?: {
    pages_crawled?: number;
    documents_created?: number;
    errors?: number;
  };

  // Discovery
  discovered_file?: string;
  discovered_file_type?: string;
  linked_files?: string[];
}

export interface ActiveOperationsResponse {
  operations: ActiveOperation[];
  count: number;
  timestamp: string;
}
```

---

## 8. Service Layer Integration

**File**: `/home/ljutzkanov/Documents/Projects/archon/archon-ui-main/src/features/progress/services/progressService.ts`

```typescript
export const progressService = {
  /**
   * Get progress for an operation
   */
  async getProgress(progressId: string): Promise<ProgressResponse> {
    return callAPIWithETag<ProgressResponse>(`/api/progress/${progressId}`);
  },

  /**
   * List all active operations
   * NOTE: Trailing slash required to avoid FastAPI redirect
   */
  async listActiveOperations(): Promise<ActiveOperationsResponse> {
    return callAPIWithETag<ActiveOperationsResponse>("/api/progress/");
  },
};
```

**Knowledge Service** (for stop operation):

```typescript
async stopCrawl(progressId: string): Promise<{ success: boolean; message: string }> {
  return callAPIWithETag<{ success: boolean; message: string }>(
    `/api/knowledge-items/stop/${progressId}`,
    { method: "POST" }
  );
}
```

---

## 9. Implementation Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CrawlingProgress Component                    │
│  - Displays operation cards with progress, stats, discovery info │
│  - Stop button triggers useStopCrawl mutation                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              useCrawlProgressPolling Hook                        │
│  - Calls useActiveOperations(true)                             │
│  - Returns { activeOperations, isLoading, totalCount }         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│           useActiveOperations(enabled = true)                    │
│  - useQuery on /api/progress/                                  │
│  - Polling interval: 5s (base) adjusted by useSmartPolling     │
│  - staleTime: 3s (realtime)                                    │
│  - Refetch only when enabled & not terminal                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│            useSmartPolling(5000)                                 │
│  - Returns refetchInterval based on page visibility             │
│  - Active tab: 5000ms                                          │
│  - Background: 7500ms (1.5x)                                   │
│  - Hidden: false (disabled)                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│             callAPIWithETag (API Client)                        │
│  - Automatic ETag/304 handling via browser cache               │
│  - 20s timeout                                                 │
│  - Error parsing from nested {"detail": {"error": "..."}}      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│        Backend: GET /api/progress/  (FastAPI)                   │
│  - Lists all active operations (non-terminal states)            │
│  - Response includes: operation_id, status, progress, stats    │
│  - ETag headers for conditional requests                       │
│  - X-Poll-Interval header for polling hints                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Key Design Patterns

### Pattern 1: Terminal State Detection

```typescript
// Frontend: Stop polling when operation reaches terminal state
const TERMINAL_STATES = ["completed", "error", "failed", "cancelled"];

refetchInterval: (query) => {
  const data = query.state.data;
  if (data && TERMINAL_STATES.includes(data.status)) {
    return false;  // Stop polling immediately
  }
  return smartInterval;
}
```

### Pattern 2: Smart Polling with Visibility API

```typescript
// Automatically adjust polling based on user engagement
- Hidden tab: Disable completely (false)
- Background tab: 1.5x slower
- Active tab: Normal speed
```

### Pattern 3: Optimistic Updates

```typescript
// When user starts crawl, immediately show in progress list
onMutate: async (request) => {
  // Create optimistic operation
  const optimisticOperation = {
    operation_id: tempProgressId,
    status: "starting",
    progress: 0,
    message: `Initializing crawl for ${request.url}`,
  };
  
  // Add to cache immediately
  queryClient.setQueryData(progressKeys.active(), (old) => ({
    ...old,
    operations: [optimisticOperation, ...old.operations],
  }));
};
```

### Pattern 4: 404 Resilience

```typescript
// Handle transient 404s gracefully (operation might be cleaning up)
catch (error) {
  if (isNotFound) {
    consecutiveNotFound++;
    if (consecutiveNotFound >= 5) {
      throw new Error("Operation no longer exists");
    }
    return null; // Keep polling a bit longer
  }
}
```

---

## 11. Replication Checklist for Next.js

### Required Components
- [ ] Progress component displaying operations list
- [ ] Individual operation cards with status/progress
- [ ] Stop button with cancellation mutation
- [ ] Discovery information display

### Required Hooks
- [ ] Poll active operations list (every 5s smart-adjusted)
- [ ] Poll single operation progress (every 1s smart-adjusted)
- [ ] Smart polling based on visibility/focus
- [ ] Stop crawl mutation

### Required API Layer
- [ ] `getProgress(progressId)` - GET /api/progress/{id}
- [ ] `listActiveOperations()` - GET /api/progress/
- [ ] `stopCrawl(progressId)` - POST /api/knowledge-items/stop/{id}
- [ ] ETag/304 handling (auto via browser)

### Configuration
- [ ] STALE_TIMES constants
- [ ] Terminal states definition
- [ ] Polling intervals (5s for list, 1s for individual)
- [ ] Smart polling multiplier (1.5x for background)

### Error Handling
- [ ] 404 resilience (5 consecutive 404s threshold)
- [ ] Graceful error toast messages
- [ ] Silent 404 failures for stop operation (already done)

---

## 12. File Structure Reference

```
archon-ui-main/src/features/
├── progress/
│   ├── components/
│   │   ├── CrawlingProgress.tsx         # Main UI component
│   │   ├── KnowledgeCardProgress.tsx    # Card variant
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useProgressQueries.ts        # All polling hooks
│   │   │   ├── useOperationProgress()   # Single operation (1s)
│   │   │   ├── useActiveOperations()    # List (5s)
│   │   │   ├── useCrawlProgressPolling()# Convenience wrapper
│   │   │   └── useMultipleOperations()  # Batch polling
│   │   └── index.ts
│   ├── services/
│   │   ├── progressService.ts           # API calls
│   │   └── index.ts
│   ├── types/
│   │   ├── progress.ts                  # Type definitions
│   │   └── index.ts
│   ├── utils/
│   │   └── urlValidation.ts             # URL validation
│   └── index.ts
├── knowledge/
│   ├── hooks/
│   │   └── useKnowledgeQueries.ts       # useStopCrawl()
│   ├── services/
│   │   └── knowledgeService.ts          # stopCrawl() API
│   └── ...
├── shared/
│   ├── api/
│   │   └── apiClient.ts                 # callAPIWithETag()
│   ├── hooks/
│   │   └── useSmartPolling.ts           # Smart polling logic
│   ├── config/
│   │   └── queryPatterns.ts             # STALE_TIMES, intervals
│   └── ...
```

---

## 13. Integration Points for Next.js

### 1. API Routes (Next.js App Router)
```
/app/api/progress/[operationId]/route.ts          # Proxy to backend
/app/api/progress/route.ts                        # Proxy to backend
/app/api/knowledge-items/stop/[progressId]/route.ts
```

### 2. Server Components
Can fetch initial operations on page load

### 3. Client Components
Use `use client` for all polling hooks (need useState, useEffect, useContext)

### 4. Real-time Updates
Consider adding Server-Sent Events (SSE) for true real-time instead of polling

---

## Summary

The Archon active operations tracking system is a **production-grade polling implementation** with:

1. **Intelligent Polling**: Smart intervals that respect browser focus/visibility
2. **Bandwidth Optimization**: ETag support with browser-native 304 handling
3. **Responsive UI**: Optimistic updates and smooth animations
4. **Error Resilience**: Graceful 404 handling and transient failure recovery
5. **Terminal Detection**: Automatic polling cessation for completed operations

For Next.js replication, the key is implementing the **smart polling hook** and **terminal state detection** - everything else follows from those two core concepts.

