# Active Operations Tracking - Implementation Guide for Next.js

**Status**: Research Complete  
**Date**: December 23, 2025  
**Research Document**: `/docs/ACTIVE_OPERATIONS_RESEARCH.md` (28KB, 13 sections)

---

## What Was Researched

Complete analysis of Archon UI's active operations tracking system including:
- Live progress components displaying crawling/upload operations
- Smart polling with visibility/focus detection
- Terminal state detection (auto-stop polling)
- ETag optimization for bandwidth efficiency
- Stop/cancel operation endpoints
- Error handling and 404 resilience

---

## Reference Implementation

All source code references from `archon/archon-ui-main/`:

### Components
- **CrawlingProgress.tsx** - Main UI component (332 lines)
  - Status badges, progress bars, statistics cards
  - Discovery information display
  - Stop button with loading state

### Hooks
- **useProgressQueries.ts** - All polling logic (384 lines)
  - `useCrawlProgressPolling()` - List polling wrapper
  - `useActiveOperations()` - List operations (5s polling)
  - `useOperationProgress()` - Single operation (1s polling)
  - `useMultipleOperations()` - Batch polling

- **useSmartPolling.ts** - Smart polling hook (72 lines)
  - Page visibility detection
  - Focus state tracking
  - Dynamic interval adjustment

### Services
- **progressService.ts** - API layer (25 lines)
  - `getProgress(progressId)` - GET /api/progress/{id}
  - `listActiveOperations()` - GET /api/progress/

- **knowledgeService.ts** - Knowledge operations (150+ lines)
  - `stopCrawl(progressId)` - POST /api/knowledge-items/stop/{id}
  - `crawlUrl(request)` - POST /api/knowledge-items/crawl
  - `uploadDocument(file, metadata)` - POST /api/documents/upload

### Configuration
- **queryPatterns.ts** - Query configuration (76 lines)
  - STALE_TIMES constants
  - Terminal state definitions
  - Query key factory patterns

### API Client
- **apiClient.ts** - HTTP client with ETag (135 lines)
  - Automatic 304 handling via browser cache
  - Error parsing from nested structures
  - 20s timeout for large operations

---

## Architecture Overview

```
User Interface (React Component)
         ↓
     CrawlingProgress Component
         ↓
    Hook Layer (React Hooks)
         ├─ useCrawlProgressPolling()
         ├─ useActiveOperations()
         ├─ useSmartPolling()
         └─ useStopCrawl()
         ↓
   Query Client (TanStack Query)
         ├─ Query Key Factory
         ├─ Stale Times Config
         └─ Refetch Intervals
         ↓
   Service Layer
         ├─ progressService
         ├─ knowledgeService
         └─ apiClient (with ETag)
         ↓
   HTTP Client (Fetch)
         ↓
   Backend API (FastAPI)
         ├─ GET /api/progress/
         ├─ GET /api/progress/{id}
         └─ POST /api/knowledge-items/stop/{id}
```

---

## Key Implementation Patterns

### Pattern 1: Terminal State Detection
```typescript
// Polling automatically stops when operation completes
const TERMINAL_STATES = ["completed", "error", "failed", "cancelled"];

refetchInterval: (query) => {
  if (data && TERMINAL_STATES.includes(data.status)) {
    return false;  // Stop polling
  }
  return smartInterval;
}
```

### Pattern 2: Smart Polling with Visibility
```typescript
// Adjust polling based on page engagement
useSmartPolling(baseInterval) → 
  - Active tab: baseInterval
  - Background tab: 1.5x baseInterval (min 5s)
  - Hidden tab: false (disabled)
```

### Pattern 3: Optimistic Updates
```typescript
// Show operation immediately before server confirms
onMutate: async () => {
  setQueryData(progressKeys.active(), (old) => ({
    ...old,
    operations: [optimisticOp, ...old.operations]
  }));
}
```

### Pattern 4: 404 Resilience
```typescript
// Handle transient 404s gracefully
consecutiveNotFound++;
if (consecutiveNotFound >= 5) {
  throw new Error("Operation no longer exists");
} else {
  return null; // Keep polling
}
```

---

## Polling Configuration

| Metric | Value | Notes |
|--------|-------|-------|
| List Polling Interval | 5,000ms | Base for operations list |
| Single Polling Interval | 1,000ms | Base for single operation |
| Background Adjustment | 1.5x | Slower when tab unfocused |
| Hidden Tab Polling | false | Disabled when tab hidden |
| Stale Time (Progress) | 0ms | Always fresh |
| Stale Time (List) | 3,000ms | Near real-time |
| HTTP Timeout | 20,000ms | For large delete operations |
| 404 Threshold | 5 attempts | Before treating as gone |

---

## API Response Format

### List Operations Response
```json
{
  "operations": [
    {
      "operation_id": "uuid",
      "operation_type": "crawl|upload",
      "status": "crawling|completed|error|...",
      "progress": 45,
      "message": "Crawling pages 10-20...",
      "started_at": "2025-12-23T10:15:00Z",
      "pages_crawled": 15,
      "documents_created": 8,
      "code_blocks_found": 3
    }
  ],
  "count": 1,
  "timestamp": "2025-12-23T10:15:30Z"
}
```

### Single Operation Response
```json
{
  "progressId": "uuid",
  "status": "crawling",
  "progress": 45,
  "message": "Crawling page 15 of 40",
  "currentUrl": "https://example.com/page15",
  "pages_crawled": 15,
  "total_pages": 40,
  "documents_created": 8,
  "code_blocks_found": 3,
  "timestamp": "2025-12-23T10:15:25Z"
}
```

### Stop Operation Response
```json
{
  "success": true,
  "message": "Crawl task stopped successfully",
  "progressId": "uuid"
}
```

---

## Implementation Checklist

### Phase 1: Foundation (Hooks & Config)
- [ ] Create `hooks/useSmartPolling.ts` (smart polling logic)
- [ ] Create `config/queryConfig.ts` (STALE_TIMES, terminal states)
- [ ] Create `hooks/useProgressQueries.ts` (polling hooks)
- [ ] Create `types/progress.ts` (type definitions)

### Phase 2: Service Layer
- [ ] Create `services/progressService.ts` (API calls)
- [ ] Create `services/apiClient.ts` (HTTP client with ETag)
- [ ] Create `services/knowledgeService.ts` (crawl/stop operations)

### Phase 3: Components
- [ ] Create `components/OperationCard.tsx` (individual operation card)
- [ ] Create `components/OperationStats.tsx` (statistics grid)
- [ ] Create `components/CrawlingProgress.tsx` (main container)
- [ ] Create `components/DiscoveryInfo.tsx` (discovered files display)

### Phase 4: Integration
- [ ] Add error handling (toast notifications)
- [ ] Add optimistic updates (onMutate handlers)
- [ ] Add tests (unit + integration)
- [ ] Document API integration points

### Phase 5: Enhancement
- [ ] Add Server-Sent Events (SSE) for true real-time
- [ ] Add analytics/metrics tracking
- [ ] Add performance monitoring
- [ ] Optimize re-renders with useMemo/useCallback

---

## Critical Implementation Notes

### 1. Trailing Slash in API Calls
```typescript
// CORRECT - includes trailing slash
GET /api/progress/

// INCORRECT - no trailing slash
GET /api/progress
```
FastAPI requires trailing slash or it redirects (breaks in Docker).

### 2. ETag Handling
```typescript
// Browser handles automatically
// No need to manually set If-None-Match header
// No need to check for 304 responses
// Just let the browser cache normally

const response = await fetch(url);
return response.json();  // Works for 200 and cached responses
```

### 3. Error Structure from Backend
```typescript
// Backend error response structure
{
  "detail": {
    "error": "Human readable error message"
  }
}

// Extract like this:
if (typeof errorJson.detail === "object" && "error" in errorJson.detail) {
  throw new APIServiceError(errorJson.detail.error, "HTTP_ERROR", response.status);
}
```

### 4. 404 Handling for Stop Operation
```typescript
// When stopping an operation that's already done, you might get 404
// This is OK - don't show error to user
const is404Error =
  error?.statusCode === 404 ||
  error?.message?.includes("404");

if (is404Error) {
  return; // Silent success - operation is gone
}
```

### 5. Polling Must Stop at Terminal States
```typescript
// Critical: Without this, polling continues forever
const TERMINAL_STATES = ["completed", "error", "failed", "cancelled"];

refetchInterval: (query) => {
  if (data && TERMINAL_STATES.includes(data.status)) {
    return false;  // MUST return false to stop polling
  }
  return smartInterval;
}
```

---

## Testing Considerations

### Unit Tests
- `useSmartPolling` hook with visibility/focus simulation
- Terminal state detection logic
- ETag/304 handling in API client
- 404 resilience counter logic

### Integration Tests
- Polling starts when component mounts
- Polling stops when terminal state reached
- Stop button triggers mutation correctly
- Optimistic updates appear immediately
- Error toasts show for non-404 errors

### E2E Tests
- User can see live progress updates
- User can stop an operation
- Operation completes and polling stops automatically
- Page visibility change adjusts polling interval

---

## Common Pitfalls to Avoid

1. **Not stopping polling at terminal states**
   - Will continuously poll completed operations forever
   
2. **Showing error toast for 404 on stop operation**
   - User cancelled operation might complete before stop request arrives
   - Silent 404 is expected behavior

3. **Forgetting trailing slash in `/api/progress/`**
   - FastAPI redirects without it (breaks in Docker)

4. **Not using smart polling**
   - Will waste battery/bandwidth polling background tabs
   - Users will notice excessive API calls

5. **Managing ETags manually**
   - Browser handles automatically, no need to check/set headers
   - Adds unnecessary complexity

6. **Not handling nested error structure**
   - Backend returns `{"detail": {"error": "message"}}`
   - Must extract correctly or show raw JSON to users

---

## Performance Optimization

### Current Architecture Benefits
- Smart polling reduces API calls by 33% for background tabs
- ETag caching eliminates parsing overhead for unchanged data
- Terminal state detection prevents wasted requests
- 404 resilience reduces noise from race conditions

### Further Optimization Opportunities
- Server-Sent Events (SSE) for true real-time updates
- WebSocket for bidirectional communication
- Background sync for offline operations
- Compression for large response payloads
- Query deduplication to prevent duplicate requests

---

## Documentation References

**Complete Research Document**: `/docs/ACTIVE_OPERATIONS_RESEARCH.md`

Sections:
1. Active Operations Component
2. Progress Polling Logic
3. Backend Progress API Endpoints
4. Stop Operation Endpoint
5. Live Updates Toggle Mechanism
6. API Client & ETag Optimization
7. Active Operations Type Definition
8. Service Layer Integration
9. Implementation Architecture Diagram
10. Key Design Patterns
11. Replication Checklist for Next.js
12. File Structure Reference
13. Integration Points for Next.js

---

## Contact & Support

For detailed code examples, type definitions, and implementation patterns, see:
`/docs/ACTIVE_OPERATIONS_RESEARCH.md`

All file paths are absolute and tested in the archon codebase.

