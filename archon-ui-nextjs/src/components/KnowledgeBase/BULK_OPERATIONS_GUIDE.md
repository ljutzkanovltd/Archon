# Bulk Operations UI - Integration Guide

## Overview

The bulk operations UI allows users to select multiple knowledge sources and perform batch actions (re-crawl, delete) from the knowledge base page.

---

## Components

### 1. `KnowledgeTableViewWithBulk`

Enhanced table view with multi-select checkboxes and bulk action support.

**Features:**
- Checkbox column for selecting individual sources
- "Select All" checkbox in header
- Bulk actions bar appears when sources selected
- Maintains all original table functionality (view, edit, delete single sources)
- Sortable columns
- Dark mode support

### 2. `BulkActionsBar`

Sticky action bar that appears at the top when sources are selected.

**Features:**
- Shows selection count
- "Re-crawl Selected (N)" button
- "Delete Selected (N)" button with confirmation
- "Clear Selection" button
- Processing indicators
- Sticky positioning (stays visible while scrolling)

---

## API Endpoints

### Re-crawl (Queue System)

**Endpoint:** `POST /api/crawl-queue/add-batch`

**Request:**
```json
{
  "source_ids": ["src-1", "src-2", "src-3"],
  "priorities": {
    "src-1": 100,
    "src-2": 100,
    "src-3": 100
  }
}
```

**Response:**
```json
{
  "success": true,
  "batch_id": "batch-uuid",
  "added_count": 3,
  "items": [...]
}
```

### Bulk Delete

**Endpoint:** `POST /api/sources/bulk-delete`

**Request:**
```json
{
  "source_ids": ["src-1", "src-2", "src-3"]
}
```

**Response:**
```json
{
  "success": true,
  "deleted_count": 3,
  "failed_count": 0,
  "total_requested": 3,
  "details": [
    {
      "source_id": "src-1",
      "success": true,
      "message": "Deleted successfully"
    },
    ...
  ]
}
```

---

## Integration Example

### Basic Integration

```tsx
"use client";

import { useState } from "react";
import { KnowledgeTableViewWithBulk } from "@/components/KnowledgeBase";
import { toast } from "sonner"; // or your toast library

export function KnowledgeBasePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);

  // Bulk re-crawl handler
  const handleBulkRecrawl = async (selectedSources: KnowledgeSource[]) => {
    try {
      // Create payload for queue API
      const sourceIds = selectedSources.map((s) => s.source_id);
      const priorities = Object.fromEntries(
        sourceIds.map((id) => [id, 100]) // High priority for all
      );

      const response = await fetch("http://localhost:8181/api/crawl-queue/add-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_ids: sourceIds, priorities }),
      });

      if (!response.ok) throw new Error("Failed to add sources to queue");

      const result = await response.json();

      toast.success(
        `Added ${result.added_count} sources to crawl queue. Batch ID: ${result.batch_id}`
      );

      // Optionally refresh sources list
      // refetchSources();
    } catch (error) {
      console.error("Bulk re-crawl error:", error);
      toast.error("Failed to add sources to queue");
    }
  };

  // Bulk delete handler
  const handleBulkDelete = async (selectedSources: KnowledgeSource[]) => {
    try {
      const sourceIds = selectedSources.map((s) => s.source_id);

      const response = await fetch("http://localhost:8181/api/sources/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_ids: sourceIds }),
      });

      if (!response.ok) throw new Error("Failed to delete sources");

      const result = await response.json();

      toast.success(
        `Deleted ${result.deleted_count} of ${result.total_requested} sources`
      );

      if (result.failed_count > 0) {
        toast.warning(`Failed to delete ${result.failed_count} sources`);
      }

      // Remove deleted sources from state
      setSources((prev) =>
        prev.filter((s) => !sourceIds.includes(s.source_id))
      );
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Failed to delete sources");
    }
  };

  return (
    <div>
      <h1>Knowledge Base</h1>

      <KnowledgeTableViewWithBulk
        sources={sources}
        onView={(source) => {/* View handler */}}
        onEdit={(source) => {/* Edit handler */}}
        onDelete={(source) => {/* Single delete handler */}}
        onRecrawl={(source) => {/* Single recrawl handler */}}
        onBulkRecrawl={handleBulkRecrawl}
        onBulkDelete={handleBulkDelete}
        searchTerm={searchTerm}
      />
    </div>
  );
}
```

### With TanStack Query Integration

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function KnowledgeBasePage() {
  const queryClient = useQueryClient();

  // Fetch sources
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["knowledge-sources"],
    queryFn: async () => {
      const res = await fetch("http://localhost:8181/api/knowledge-items");
      if (!res.ok) throw new Error("Failed to fetch sources");
      return res.json();
    },
  });

  // Bulk re-crawl mutation
  const bulkRecrawlMutation = useMutation({
    mutationFn: async (selectedSources: KnowledgeSource[]) => {
      const sourceIds = selectedSources.map((s) => s.source_id);
      const priorities = Object.fromEntries(sourceIds.map((id) => [id, 100]));

      const res = await fetch("http://localhost:8181/api/crawl-queue/add-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_ids: sourceIds, priorities }),
      });

      if (!res.ok) throw new Error("Failed to add sources to queue");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Added ${data.added_count} sources to queue`);
      queryClient.invalidateQueries({ queryKey: ["knowledge-sources"] });
    },
    onError: (error) => {
      toast.error("Failed to add sources to queue");
      console.error(error);
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (selectedSources: KnowledgeSource[]) => {
      const sourceIds = selectedSources.map((s) => s.source_id);

      const res = await fetch("http://localhost:8181/api/sources/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_ids: sourceIds }),
      });

      if (!res.ok) throw new Error("Failed to delete sources");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted_count} sources`);
      queryClient.invalidateQueries({ queryKey: ["knowledge-sources"] });
    },
    onError: (error) => {
      toast.error("Failed to delete sources");
      console.error(error);
    },
  });

  return (
    <KnowledgeTableViewWithBulk
      sources={sources}
      onBulkRecrawl={(sources) => bulkRecrawlMutation.mutate(sources)}
      onBulkDelete={(sources) => bulkDeleteMutation.mutate(sources)}
      // ... other props
    />
  );
}
```

---

## User Experience Flow

### Re-crawl Flow

1. User selects sources via checkboxes
2. Bulk actions bar appears at top
3. User clicks "Re-crawl Selected (N)"
4. Loading indicator shows "Adding to queue..."
5. API call adds sources to queue with high priority
6. Success toast: "Added N sources to crawl queue"
7. Selection automatically clears
8. Worker processes queue in background

### Delete Flow

1. User selects sources via checkboxes
2. Bulk actions bar appears at top
3. User clicks "Delete Selected (N)"
4. Confirmation prompt appears: "Delete N sources? This cannot be undone."
5. User clicks "Confirm Delete"
6. Loading indicator shows "Deleting..."
7. API call deletes sources sequentially
8. Success toast: "Deleted N of M sources"
9. If failures: Warning toast: "Failed to delete X sources"
10. Deleted sources removed from table
11. Selection automatically clears

---

## Testing

### Manual Testing Checklist

**Selection:**
- [ ] Select individual sources via checkbox
- [ ] Select all sources via header checkbox
- [ ] Deselect individual sources
- [ ] Deselect all sources via header checkbox
- [ ] Clear selection via "Clear" button

**Re-crawl:**
- [ ] Re-crawl 1 source
- [ ] Re-crawl multiple sources (2-5)
- [ ] Re-crawl all sources (select all → re-crawl)
- [ ] Verify queue API receives correct source IDs
- [ ] Verify sources appear in queue dashboard
- [ ] Verify worker processes queued sources

**Delete:**
- [ ] Delete 1 source
- [ ] Delete multiple sources (2-5)
- [ ] Verify confirmation dialog appears
- [ ] Cancel deletion from confirmation
- [ ] Confirm deletion
- [ ] Verify sources removed from database
- [ ] Verify sources removed from UI
- [ ] Verify partial failure handling (if API returns mixed results)

**UI/UX:**
- [ ] Bulk actions bar appears when sources selected
- [ ] Bulk actions bar is sticky (stays visible during scroll)
- [ ] Loading indicators show during operations
- [ ] Toast notifications display for success/error
- [ ] Selection clears after successful operation
- [ ] Disabled state during processing
- [ ] Dark mode works correctly

---

## Configuration

### Priorities

Customize priorities for different source types in bulk re-crawl:

```tsx
const handleBulkRecrawl = async (selectedSources: KnowledgeSource[]) => {
  const priorities = Object.fromEntries(
    selectedSources.map((source) => {
      // llms.txt sources get high priority
      if (source.url?.includes("llms.txt")) {
        return [source.source_id, 100];
      }
      // Regular sources get normal priority
      return [source.source_id, 50];
    })
  );

  // ... rest of implementation
};
```

### Toast Messages

Customize toast notifications:

```tsx
// Success messages
toast.success(`✅ Added ${count} sources to queue`, {
  description: `Batch ID: ${batchId}`,
  duration: 5000,
});

// Error messages
toast.error("❌ Failed to add sources to queue", {
  description: error.message,
  duration: 7000,
});

// Warning messages (partial failures)
toast.warning(`⚠️ ${failed} of ${total} sources failed to delete`, {
  description: "Check logs for details",
  action: {
    label: "View Logs",
    onClick: () => router.push("/logs"),
  },
});
```

---

## Troubleshooting

### Issue: Selection not clearing after operation

**Solution:** Ensure handlers call state setter to clear selection:

```tsx
const handleBulkRecrawl = async (sources) => {
  try {
    await addToQueue(sources);
    setSelectedSourceIds(new Set()); // ← Clear selection
  } catch (error) {
    // Handle error
  }
};
```

### Issue: Bulk actions bar not appearing

**Solution:** Check that `onBulkRecrawl` and `onBulkDelete` props are provided:

```tsx
<KnowledgeTableViewWithBulk
  sources={sources}
  onBulkRecrawl={handleBulkRecrawl}  // ← Required
  onBulkDelete={handleBulkDelete}    // ← Required
/>
```

### Issue: API returns 400 Bad Request

**Solution:** Verify request payload format matches API expectations:

```tsx
// ✅ Correct
{
  "source_ids": ["src-1", "src-2"],
  "priorities": { "src-1": 100, "src-2": 100 }
}

// ❌ Incorrect
{
  "sources": ["src-1", "src-2"]  // Wrong key
}
```

---

## Migration from Old Table View

If you're currently using `KnowledgeTableView`, migration is simple:

### Before

```tsx
import { KnowledgeTableView } from "@/components/KnowledgeBase";

<KnowledgeTableView
  sources={sources}
  onView={handleView}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onRecrawl={handleRecrawl}
/>
```

### After

```tsx
import { KnowledgeTableViewWithBulk } from "@/components/KnowledgeBase";

<KnowledgeTableViewWithBulk
  sources={sources}
  onView={handleView}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onRecrawl={handleRecrawl}
  // Add bulk operation handlers
  onBulkRecrawl={handleBulkRecrawl}
  onBulkDelete={handleBulkDelete}
/>
```

All existing functionality remains intact. The component is fully backward compatible.

---

## Related Documentation

- **Queue System:** See `docs/database/PERFORMANCE_BASELINE.md`
- **Queue Worker:** See `python/src/server/services/crawling/queue_worker.py`
- **API Endpoints:** See `python/src/server/api_routes/knowledge_api.py`
- **Initialization Script:** See `python/scripts/initialize_crawl_queue.py`
- **Monitoring Dashboard:** See Phase 6 tasks in project

---

**Created:** 2026-01-12
**Version:** 1.0
**Part of:** Phase 5/6 - Bulk Operations UI Enhancement
