# Knowledge Base List View Implementation Plan

## Executive Summary

Implement a **dual-view knowledge base** (Grid + Table) matching the original Archon dashboard (port 3737), with intelligent filtering, real-time progress tracking, and inline editing capabilities.

---

## 🎯 Core Requirements (From Original Archon Analysis)

### Filter System
✅ **3 Filter Types**:
1. **Search** - Full-text search across title, URL, description (debounced)
2. **Type Filter** - Segmented control with 3 options:
   - All (Asterisk icon)
   - Technical (Terminal icon)
   - Business (Briefcase icon)
3. **Tags** - Inline editing per item (not top-level filter)

### View Modes
✅ **Dual View Toggle**:
1. **Grid View** - Responsive cards (1-4 columns)
2. **Table View** - 7 columns with full details

### Key Features
- ✅ Server-side filtering (no client-side filtering)
- ✅ Real-time active operations tracking
- ✅ Per-item progress bars
- ✅ Inline editing (title, tags, type)
- ✅ Optimistic updates
- ✅ Framer Motion animations
- ❌ NO multi-select checkboxes (all actions are individual)

---

## 📊 Table View Structure

### Column Breakdown

| # | Column | Width | Sortable | Data Source | Component |
|---|--------|-------|----------|-------------|-----------|
| 1 | **Title** | Max 320px | Future | `item.title` | Text + truncate |
| 2 | **Type** | Auto | No | `item.knowledge_type` | Badge with icon |
| 3 | **Source** | Max 320px | No | `item.url` | Link + ExternalLink icon |
| 4 | **Docs** | Auto | Future | `item.document_count` | Number |
| 5 | **Examples** | Auto | Future | `item.code_examples_found` | Number |
| 6 | **Created** | Auto | No | `item.created_at` | Relative time |
| 7 | **Actions** | Right | No | - | Dropdown menu |

### Table Features
- **Header**: Gradient background (gray-50 to gray-100)
- **Rows**: Alternating colors (even: white/50, odd: gray-50/80)
- **Hover**: Subtle highlight effect
- **Border**: Bottom border on each row
- **Actions Dropdown**:
  - 👁️ View Documents
  - 💻 View Code Examples (if available)
  - 🔄 Recrawl (if URL source)
  - 📥 Export (future)
  - 🗑️ Delete (destructive, red text)

---

## 🎴 Grid View Structure

### Card Layout
```
┌─────────────────────────────────────┐
│ ┌─ Header ──────────────────────────┐│
│ │ [Icon] [Type Badge]    [...Menu] ││
│ │                                   ││
│ │ Title (editable)                  ││
│ │ Description                       ││
│ │                                   ││
│ │ 🔗 source-url.com                 ││
│ │ [tag1] [tag2] [tag3]             ││
│ └───────────────────────────────────┘│
│                                       │
│ ┌─ Content ─────────────────────────┐│
│ │ [Progress bar if active]          ││
│ └───────────────────────────────────┘│
│                                       │
│ ┌─ Footer ──────────────────────────┐│
│ │ 🕐 Updated: Jan 15, 2025          ││
│ │                 [📄 25] [💻 12]   ││
│ └───────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Visual Features
- **Top Edge Color** (4px border):
  - Cyan: technical + URL
  - Purple: technical + file
  - Blue: business + URL
  - Pink: business + file
  - Orange: processing
  - Red: error
  - Cyan animated: active operation
- **Hover Effect**: Scale 1.02 + cyan glow shadow
- **Optimistic State**: 80% opacity + cyan ring
- **Glassmorphism**: Subtle blur effect

### Responsive Grid
```typescript
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
```

---

## 🔄 Data Flow Architecture

### 1. API Integration

**Endpoint**: `GET /api/knowledge-items/summary`

**Query Parameters**:
```typescript
interface KnowledgeItemsFilter {
  knowledge_type?: "technical" | "business";
  search?: string;
  page?: number;      // Default: 1
  per_page?: number;  // Default: 100
  tags?: string[];    // Future
}
```

**Response**:
```typescript
interface KnowledgeItemsResponse {
  items: KnowledgeItem[];
  total: number;
  page: number;
  per_page: number;
}
```

### 2. React Query Setup

**Query Keys Factory**:
```typescript
export const knowledgeKeys = {
  all: ["knowledge"] as const,
  summaries: (filter?: KnowledgeItemsFilter) =>
    [...knowledgeKeys.all, "summaries", filter] as const,
  detail: (id: string) => [...knowledgeKeys.all, "detail", id] as const,
  chunks: (id: string) => [...knowledgeKeys.all, id, "chunks"] as const,
  codeExamples: (id: string) => [...knowledgeKeys.all, id, "code-examples"] as const,
};
```

**Main Hook**:
```typescript
export function useKnowledgeSummaries(filter?: KnowledgeItemsFilter) {
  const hasActiveOperations = useHasActiveOperations();

  return useQuery({
    queryKey: knowledgeKeys.summaries(filter),
    queryFn: () => knowledgeBaseApi.getSummaries(filter),
    refetchInterval: hasActiveOperations ? 1000 : false,
    staleTime: 30000,
  });
}
```

### 3. State Management

**Filter State** (in page component):
```typescript
const [searchQuery, setSearchQuery] = useState("");
const [typeFilter, setTypeFilter] = useState<"all" | "technical" | "business">("all");
const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

const filter = useMemo<KnowledgeItemsFilter>(() => {
  const f: KnowledgeItemsFilter = { page: 1, per_page: 100 };
  if (searchQuery) f.search = searchQuery;
  if (typeFilter !== "all") f.knowledge_type = typeFilter;
  return f;
}, [searchQuery, typeFilter]);

const { data, isLoading, isError } = useKnowledgeSummaries(filter);
```

---

## 🎨 Component Hierarchy

```
app/knowledge-base/page.tsx (Server Component - initial data)
├── components/KnowledgeBase/
│   ├── KnowledgeBaseView.tsx (Client - main orchestrator)
│   │   ├── KnowledgeBaseHeader.tsx
│   │   │   ├── SearchInput.tsx
│   │   │   ├── TypeFilterTabs.tsx (all/technical/business)
│   │   │   ├── ViewModeToggle.tsx (grid/table)
│   │   │   └── AddSourceButton.tsx (existing)
│   │   │
│   │   ├── CrawlingProgress.tsx (existing - shows above list)
│   │   │
│   │   └── KnowledgeBaseList.tsx (view router)
│   │       ├── KnowledgeTable.tsx (NEW)
│   │       │   ├── KnowledgeTableHeader.tsx
│   │       │   ├── KnowledgeTableRow.tsx
│   │       │   └── KnowledgeTableActions.tsx
│   │       │
│   │       └── KnowledgeGrid.tsx (ENHANCED)
│   │           └── KnowledgeSourceCard.tsx (existing - enhance)
│   │               ├── CardHeader
│   │               ├── CardContent (progress bar)
│   │               └── CardFooter (stats)
│   │
│   └── hooks/
│       ├── useKnowledgeQueries.ts (NEW)
│       ├── useKnowledgeActions.ts (NEW)
│       └── useDebounce.ts (NEW)
```

---

## 📝 Implementation Phases

### Phase 1: Foundation & Types (Est: 2 hours)
**Goal**: Set up data layer and TypeScript interfaces

**Tasks**:
1. ✅ Create `KnowledgeItem` interface matching backend
2. ✅ Create `KnowledgeItemsFilter` interface
3. ✅ Update `apiClient.ts` with `knowledgeBaseApi.getSummaries()`
4. ✅ Create `useKnowledgeQueries.ts` with query keys factory
5. ✅ Create `useDebounce.ts` hook for search input

**Files**:
- `src/lib/types.ts` (add interfaces)
- `src/lib/apiClient.ts` (add getSummaries endpoint)
- `src/hooks/useKnowledgeQueries.ts` (NEW)
- `src/hooks/useDebounce.ts` (NEW)

**Testing**:
```bash
# Verify API endpoint
curl "http://localhost:8181/api/knowledge-items/summary?knowledge_type=technical"
```

---

### Phase 2: Header & Filters (Est: 3 hours)
**Goal**: Build filter UI matching original Archon

**Tasks**:
1. ✅ Create `KnowledgeBaseHeader.tsx` layout component
2. ✅ Create `SearchInput.tsx` with debounce
3. ✅ Create `TypeFilterTabs.tsx` (segmented control with icons)
4. ✅ Create `ViewModeToggle.tsx` (grid/table toggle)
5. ✅ Wire up filter state to query hook

**Files**:
- `src/components/KnowledgeBase/KnowledgeBaseHeader.tsx` (NEW)
- `src/components/KnowledgeBase/SearchInput.tsx` (NEW)
- `src/components/KnowledgeBase/TypeFilterTabs.tsx` (NEW)
- `src/components/KnowledgeBase/ViewModeToggle.tsx` (NEW)

**UI Spec**:
```tsx
<div className="flex items-center justify-between gap-4 mb-6">
  {/* Left side */}
  <div className="flex items-center gap-3">
    <SearchInput value={search} onChange={setSearch} />
    <TypeFilterTabs value={typeFilter} onChange={setTypeFilter} />
  </div>

  {/* Right side */}
  <div className="flex items-center gap-3">
    <ViewModeToggle value={viewMode} onChange={setViewMode} />
    <AddSourceButton onClick={openDialog} />
  </div>
</div>
```

**Icons**:
- All: `HiViewGrid` or custom asterisk
- Technical: `HiTerminal`
- Business: `HiBriefcase`
- Grid view: `HiViewGrid`
- Table view: `HiViewList`

---

### Phase 3: Table View (Est: 4 hours)
**Goal**: Create fully functional table view

**Tasks**:
1. ✅ Create `KnowledgeTable.tsx` with 7 columns
2. ✅ Create `KnowledgeTableHeader.tsx` with gradient styling
3. ✅ Create `KnowledgeTableRow.tsx` with alternating colors
4. ✅ Create `KnowledgeTableActions.tsx` (dropdown menu)
5. ✅ Add relative time formatting (e.g., "2 days ago")
6. ✅ Add external link icon for Source column
7. ✅ Add hover effects and transitions

**Files**:
- `src/components/KnowledgeBase/KnowledgeTable.tsx` (NEW)
- `src/components/KnowledgeBase/KnowledgeTableHeader.tsx` (NEW)
- `src/components/KnowledgeBase/KnowledgeTableRow.tsx` (NEW)
- `src/components/KnowledgeBase/KnowledgeTableActions.tsx` (NEW)

**Table Styling**:
```tsx
<table className="w-full border-collapse">
  <thead>
    <tr className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-b-2 border-gray-200 dark:border-gray-700">
      <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
      {/* ... */}
    </tr>
  </thead>
  <tbody>
    {items.map((item, index) => (
      <tr
        key={item.source_id}
        className={cn(
          "group transition-all duration-200",
          index % 2 === 0
            ? "bg-white/50 dark:bg-black/50"
            : "bg-gray-50/80 dark:bg-gray-900/30",
          "border-b border-gray-200 dark:border-gray-800",
          "hover:bg-gray-100 dark:hover:bg-gray-800"
        )}
      >
        {/* ... */}
      </tr>
    ))}
  </tbody>
</table>
```

**Actions Dropdown Items**:
```tsx
<DropdownMenu>
  <DropdownMenuItem onClick={() => viewDocuments(item.source_id)}>
    <HiEye /> View Documents
  </DropdownMenuItem>
  {item.code_examples_count > 0 && (
    <DropdownMenuItem onClick={() => viewCodeExamples(item.source_id)}>
      <HiCode /> View Code Examples
    </DropdownMenuItem>
  )}
  {item.url && (
    <DropdownMenuItem onClick={() => recrawl(item.source_id)}>
      <HiRefresh /> Recrawl
    </DropdownMenuItem>
  )}
  <DropdownMenuSeparator />
  <DropdownMenuItem
    onClick={() => deleteSource(item.source_id)}
    className="text-red-600 dark:text-red-400"
  >
    <HiTrash /> Delete
  </DropdownMenuItem>
</DropdownMenu>
```

---

### Phase 4: Grid View Enhancement (Est: 3 hours)
**Goal**: Enhance existing cards to match original styling

**Tasks**:
1. ✅ Update `KnowledgeSourceCard.tsx` with top edge color logic
2. ✅ Add hover scale effect (1.02) with glow shadow
3. ✅ Add glassmorphism effect (blur backdrop)
4. ✅ Enhance footer with stat pills
5. ✅ Add inline editing for title (click to edit)
6. ✅ Add inline editing for tags
7. ✅ Add type badge dropdown

**Files**:
- `src/components/KnowledgeBase/KnowledgeSourceCard.tsx` (ENHANCE)
- `src/components/KnowledgeBase/CardEditable.tsx` (NEW)

**Top Edge Color Logic**:
```typescript
function getTopEdgeColor(item: KnowledgeItem, hasActiveOp: boolean): string {
  if (hasActiveOp) return "border-t-cyan-500 animate-pulse";
  if (item.status === "error") return "border-t-red-500";
  if (item.status === "processing") return "border-t-orange-500";

  const isTechnical = item.knowledge_type === "technical";
  const isUrl = item.source_type === "url";

  if (isTechnical && isUrl) return "border-t-cyan-500";
  if (isTechnical && !isUrl) return "border-t-purple-500";
  if (!isTechnical && isUrl) return "border-t-blue-500";
  return "border-t-pink-500"; // business + file
}
```

**Card Styling**:
```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  transition={{ duration: 0.2 }}
  className={cn(
    "rounded-lg border-t-4 backdrop-blur-md",
    getTopEdgeColor(item, hasActiveOp),
    "hover:shadow-lg hover:shadow-cyan-500/20",
    isOptimistic && "opacity-80 ring-2 ring-cyan-500"
  )}
>
  {/* ... */}
</motion.div>
```

---

### Phase 5: Real-Time Features (Est: 2 hours)
**Goal**: Integrate active operations and progress tracking

**Tasks**:
1. ✅ Connect `CrawlingProgress` component above list
2. ✅ Add per-card progress bars (when operation matches item)
3. ✅ Implement operation-to-item matching logic
4. ✅ Add smart polling (only when operations active)
5. ✅ Display "Saving changes..." badge during optimistic updates

**Files**:
- `src/components/KnowledgeBase/KnowledgeBaseView.tsx` (ENHANCE)
- `src/components/KnowledgeBase/CardProgressBar.tsx` (NEW)

**Operation Matching Logic**:
```typescript
function getActiveOperationForItem(
  item: KnowledgeItem,
  operations: Progress[]
): Progress | undefined {
  // First try source_id
  const matchById = operations.find(op => op.source_id === item.source_id);
  if (matchById) return matchById;

  // Fallback: Check URL
  const itemUrl = item.metadata?.original_url || item.url;
  return operations.find(op => {
    return (
      op.url === itemUrl ||
      op.current_url === itemUrl ||
      op.message?.includes(itemUrl) ||
      (op.operation_type === "crawl" && op.message?.includes(item.title))
    );
  });
}
```

**Progress Bar in Card**:
```tsx
{activeOperation && (
  <div className="px-4 pb-3">
    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
      <span>{activeOperation.message}</span>
      <span>{activeOperation.progress_percentage}%</span>
    </div>
    <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-cyan-500 transition-all duration-300"
        style={{ width: `${activeOperation.progress_percentage}%` }}
      />
    </div>
  </div>
)}
```

---

### Phase 6: Optimistic Updates (Est: 3 hours)
**Goal**: Implement inline editing with optimistic UI

**Tasks**:
1. ✅ Create `useUpdateKnowledgeItem` mutation hook
2. ✅ Implement optimistic update logic (snapshot → update → rollback on error)
3. ✅ Add visual feedback (opacity, ring border)
4. ✅ Add debouncing for rapid edits
5. ✅ Handle concurrent edits gracefully

**Files**:
- `src/hooks/useKnowledgeActions.ts` (NEW)

**Mutation Hook**:
```typescript
export function useUpdateKnowledgeItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sourceId, updates }: UpdateParams) =>
      knowledgeBaseApi.update(sourceId, updates),

    onMutate: async ({ sourceId, updates }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: knowledgeKeys.all });

      // Snapshot current data
      const previousData = queryClient.getQueryData(knowledgeKeys.summaries());

      // Optimistic update
      queryClient.setQueriesData(
        { queryKey: knowledgeKeys.summariesPrefix() },
        (old: KnowledgeItemsResponse) => ({
          ...old,
          items: old.items.map(item =>
            item.source_id === sourceId
              ? { ...item, ...updates, _optimistic: true }
              : item
          ),
        })
      );

      return { previousData };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          knowledgeKeys.summaries(),
          context.previousData
        );
      }
      toast.error("Failed to update item");
    },

    onSuccess: () => {
      // Sync with server
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
      toast.success("Updated successfully");
    },
  });
}
```

---

### Phase 7: Animations & Polish (Est: 2 hours)
**Goal**: Add smooth transitions and loading states

**Tasks**:
1. ✅ Add Framer Motion to list (stagger children)
2. ✅ Add card entry/exit animations
3. ✅ Add skeleton loaders for initial load
4. ✅ Add empty state component
5. ✅ Add error state component
6. ✅ Test responsive behavior (mobile, tablet, desktop)

**Files**:
- `src/components/KnowledgeBase/KnowledgeBaseList.tsx` (ENHANCE)
- `src/components/KnowledgeBase/EmptyState.tsx` (NEW)
- `src/components/KnowledgeBase/ErrorState.tsx` (NEW)

**Animation Variants**:
```typescript
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } },
};
```

**Loading State**:
```tsx
{isLoading && items.length === 0 && (
  <div className="flex flex-col items-center justify-center py-12">
    <HiRefresh className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
    <p className="text-gray-600 dark:text-gray-400">Loading knowledge base...</p>
  </div>
)}
```

**Empty State**:
```tsx
{!isLoading && items.length === 0 && (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="w-16 h-16 bg-cyan-100 dark:bg-cyan-900/20 rounded-full flex items-center justify-center mb-4">
      <HiDocumentText className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
    </div>
    <h3 className="text-lg font-semibold mb-2">No Knowledge Items</h3>
    <p className="text-gray-600 dark:text-gray-400 mb-4">
      Start by adding documents or crawling websites
    </p>
    <button onClick={openAddDialog} className="btn-primary">
      Add Source
    </button>
  </div>
)}
```

---

### Phase 8: Testing & Documentation (Est: 1 hour)
**Goal**: Verify all features work correctly

**Tasks**:
1. ✅ Test search filter with various queries
2. ✅ Test type filter switching
3. ✅ Test view mode toggle
4. ✅ Test table row actions
5. ✅ Test inline editing
6. ✅ Test with active crawl operations
7. ✅ Test responsive layouts
8. ✅ Update documentation

**Test Scenarios**:
```
Scenario 1: Search Filter
1. Enter "react" in search → Should filter items
2. Clear search → Should show all items
3. Enter partial URL → Should match by URL

Scenario 2: Type Filter
1. Click "Technical" → Should show only technical items
2. Click "Business" → Should show only business items
3. Click "All" → Should show all items

Scenario 3: View Toggle
1. Click table icon → Should switch to table view
2. Click grid icon → Should switch back to grid
3. Filters should persist across view changes

Scenario 4: Inline Editing
1. Click item title → Should become editable
2. Edit and press Enter → Should save changes
3. Edit and press Escape → Should cancel
4. Should show optimistic update (opacity + ring)

Scenario 5: Active Operations
1. Start a crawl → Should appear above list
2. Card should show progress bar
3. Progress should update every second
4. On completion → Progress bar disappears
```

---

## 🎯 Success Criteria

### Functional Requirements
- ✅ Dual view (grid/table) toggle works
- ✅ Search filter searches title, URL, description
- ✅ Type filter correctly filters technical/business/all
- ✅ Table displays all 7 columns correctly
- ✅ Grid displays responsive cards (1-4 columns)
- ✅ Actions dropdown has all menu items
- ✅ Inline editing works for title and tags
- ✅ Type badge dropdown switches type
- ✅ Active operations display above list
- ✅ Per-card progress bars show during crawling
- ✅ Optimistic updates show visual feedback
- ✅ Filters persist across view mode changes

### Visual Requirements
- ✅ Matches original Archon styling
- ✅ Smooth transitions (300ms)
- ✅ Hover effects (scale, shadow)
- ✅ Top edge colors match spec
- ✅ Alternating table row colors
- ✅ Loading/empty/error states look good
- ✅ Responsive on mobile, tablet, desktop
- ✅ Dark mode support

### Performance Requirements
- ✅ Search debounced (300-500ms)
- ✅ Polls only when operations active
- ✅ No unnecessary re-renders
- ✅ Optimistic updates feel instant
- ✅ Table renders 100+ items smoothly

---

## 📦 Dependencies

**Already Installed**:
- ✅ `@tanstack/react-query` - State management
- ✅ `framer-motion` - Animations
- ✅ `react-icons` - Icons (Hi* family)

**May Need**:
- 🔍 `@radix-ui/react-dropdown-menu` - Dropdown menus (check if exists)
- 🔍 `@radix-ui/react-toggle-group` - Segmented control (check if exists)
- 🔍 `date-fns` - Relative time formatting (or use native Intl)

**Check Current UI Library**:
```bash
# See what's already available
grep -E "radix|flowbite|shadcn" package.json
```

---

## 🚧 Future Enhancements (Out of Scope)

### Phase 9: Advanced Features (Future)
- [ ] Column sorting (click header to sort)
- [ ] Pagination (if > 100 items)
- [ ] Bulk select with checkboxes
- [ ] Bulk delete operation
- [ ] Export to JSON/CSV
- [ ] Drag & drop file upload
- [ ] Advanced filters (tags dropdown, date range)
- [ ] Saved filter presets
- [ ] Column visibility toggle
- [ ] Column resizing
- [ ] Row reordering

---

## 📝 Notes for Implementation

### API Compatibility
- Current backend endpoint: `GET /api/knowledge-items/summary`
- Verify response structure matches `KnowledgeItem` interface
- Check if filtering works server-side or needs client-side fallback

### State Persistence
- Consider saving view mode to localStorage
- Consider saving filter state to URL params
- Example: `/knowledge-base?view=table&type=technical&search=react`

### Accessibility
- Add keyboard navigation (Tab, Arrow keys)
- Add ARIA labels to interactive elements
- Ensure screen reader compatibility
- Add focus indicators

### Error Handling
- Network errors → Show retry button
- 404 → Item not found message
- 403 → Permission denied message
- Validation errors → Inline error messages

---

## 🔗 Reference Files (Original Archon)

**Essential Files to Reference**:
1. `/archon-ui-main/src/features/knowledge/views/KnowledgeView.tsx`
2. `/archon-ui-main/src/features/knowledge/components/KnowledgeHeader.tsx`
3. `/archon-ui-main/src/features/knowledge/components/KnowledgeList.tsx`
4. `/archon-ui-main/src/features/knowledge/components/KnowledgeTable.tsx`
5. `/archon-ui-main/src/features/knowledge/components/KnowledgeCard.tsx`
6. `/archon-ui-main/src/features/knowledge/hooks/useKnowledgeQueries.ts`
7. `/archon-ui-main/src/features/knowledge/services/knowledgeService.ts`

---

## 📅 Estimated Timeline

| Phase | Tasks | Estimated Time | Dependencies |
|-------|-------|----------------|--------------|
| 1. Foundation | 5 tasks | 2 hours | None |
| 2. Header & Filters | 5 tasks | 3 hours | Phase 1 |
| 3. Table View | 7 tasks | 4 hours | Phase 1, 2 |
| 4. Grid Enhancement | 7 tasks | 3 hours | Phase 1, 2 |
| 5. Real-Time | 5 tasks | 2 hours | All above |
| 6. Optimistic Updates | 5 tasks | 3 hours | Phase 1 |
| 7. Animations | 7 tasks | 2 hours | All above |
| 8. Testing | 8 scenarios | 1 hour | All above |

**Total Estimated Time**: 20 hours (2.5 development days)

---

## ✅ Definition of Done

- [ ] All 8 phases completed
- [ ] Table view matches original Archon exactly
- [ ] Grid view enhanced with original styling
- [ ] All filters work correctly
- [ ] Real-time progress tracking integrated
- [ ] Optimistic updates implemented
- [ ] Animations smooth and performant
- [ ] Responsive on all screen sizes
- [ ] Dark mode fully supported
- [ ] All test scenarios pass
- [ ] Documentation updated
- [ ] No console errors or warnings
- [ ] Build succeeds without errors
- [ ] Code reviewed and approved

---

**Status**: 📋 Planning Complete - Ready for Implementation
**Created**: 2025-12-23
**Next Step**: Create tasks in Archon project tracker
