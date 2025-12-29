# Action Menu Refactor - Implementation Plan

**Date:** 2025-12-29
**Project:** Archon UI - DataTable List Views Implementation
**Project ID:** `c3a7451b-e88e-40b3-83b3-de29e903e326`
**Objective:** Replace inline action buttons with three-dot dropdown menus across all DataTable implementations

---

## Executive Summary

Replace current inline button implementations with a consistent three-dot dropdown menu pattern (inspired by SportERP) across all table views in Archon. This improves UX consistency, reduces visual clutter, and follows established enterprise table patterns.

**Status:** ✅ Planning Complete - 7 Tasks Created in Archon MCP

---

## Current State Analysis

### SportERP Pattern (Reference Implementation)

**Location:** `/sporterp-apps/app.sporterp.co.uk/components/common/RowMenu.tsx`

**Key Features:**
- Three-dot icon button (rotated 90 degrees) - Uses `ReactIcons` with `DOTS` icon
- Click-away-listener for dropdown closing
- Dynamic positioning based on viewport and row index
- Type-safe with generic `MenuAction<T>` interface
- Supports:
  - Dynamic labels: `string | ((item?: T) => string)`
  - Dynamic icons: `IconName | ((item?: T) => IconName)`
  - Conditional visibility: `shouldShow?: (item?: T) => boolean`
  - Permission-based access control
  - Custom className per action

**Integration in SportERP DataTable:**
```tsx
// TableRows.tsx:526-540
{(rowButtons.length > 0 || tableRowActionComponents.length > 0) && (
  <td
    onClick={(e) => e.stopPropagation()}
    className="sticky right-0 w-10 max-w-10 bg-white dark:bg-gray-800 shadow-[-4px_0_8px_rgba(0,0,0,0.1)]"
  >
    <TableRowActions
      actionModelClass={index < 3 ? "top-6" : "bottom-6"}
      rowButtons={rowButtons}
      row={row}
      allowedRowActions={allowedRowActions}
    />
  </td>
)}
```

**Positioning Logic:**
- First 3 rows: `top-6` (dropdown opens downward)
- Remaining rows: `bottom-6` (dropdown opens upward)
- Prevents viewport overflow with boundary detection

---

### Archon Current Implementation

**Location:** `/src/components/common/DataTable/DataTableList.tsx`

**Current Pattern (lines 132-158):**
```tsx
{hasActions && (
  <td className="px-6 py-4 text-right">
    <div className="flex justify-end gap-2">
      {actions.map((action, index) => (
        <Button
          key={index}
          size="xs"
          color={...}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.icon && <action.icon className="mr-1 h-3 w-3" />}
          {action.label}
        </Button>
      ))}
    </div>
  </td>
)}
```

**Issues:**
- Multiple inline buttons create visual clutter
- Inconsistent with enterprise table patterns
- Scales poorly with many actions (4+ actions per row)
- No dropdown menu support

---

## Implementation Locations

### 1. Projects List View
**File:** `/src/features/projects/views/ProjectsListView.tsx` (lines 143-164)
**Current Actions:** View, Edit, Archive/Restore (3 buttons)
**URL:** `http://localhost:3738/projects`

**Current Code:**
```tsx
const rowButtons = (project: Project): DataTableButton[] => [
  { label: "View", icon: HiEye, onClick: () => handleView(project) },
  { label: "Edit", icon: HiPencil, onClick: () => handleEdit(project), disabled: project.archived },
  { label: project.archived ? "Restore" : "Archive", icon: HiArchive, onClick: () => handleArchive(project) },
];
```

---

### 2. Knowledge Base Page
**File:** `/src/app/knowledge-base/page.tsx` (lines 296-318)
**Current Actions:** View, Edit, Recrawl, Delete (4 buttons)
**URL:** `http://localhost:3738/knowledge-base`

**Current Code:**
```tsx
const rowButtons = (source: KnowledgeSource): DataTableButton[] => [
  { label: "View", icon: HiEye, onClick: () => handleView(source) },
  { label: "Edit", icon: HiPencil, onClick: () => handleEdit(source) },
  { label: "Recrawl", icon: HiRefresh, onClick: () => handleRecrawl(source) },
  { label: "Delete", icon: HiTrash, onClick: () => handleDelete(source), variant: "ghost" },
];
```

---

### 3. Tasks List View
**File:** `/src/features/tasks/views/TasksListView.tsx` (lines 247-269)
**Current Actions:** View, Edit, Archive/Restore, Delete (4 buttons)
**URL:** `http://localhost:3738/tasks`

**Current Code:**
```tsx
const rowButtons = (task: Task): DataTableButton[] => [
  { label: "View", icon: HiEye, onClick: () => handleView(task) },
  { label: "Edit", icon: HiPencil, onClick: () => handleEdit(task) },
  { label: task.archived ? "Restore" : "Archive", icon: HiArchive, onClick: () => handleArchive(task) },
  { label: "Delete", icon: HiTrash, onClick: () => handleDelete(task), variant: "ghost" },
];
```

---

### 4. Project Detail - TaskTableView
**File:** `/src/components/Projects/tasks/views/TaskTableView.tsx` (lines 125-147)
**Current Actions:** Edit, Archive, Delete (3 icon-only buttons)
**URL:** `http://localhost:3738/projects/[id]` → Table view tab

**Current Code:**
```tsx
<td className="px-6 py-4 text-right text-sm font-medium">
  <button onClick={() => onEditTask(task)} title="Edit task">
    <HiPencil className="h-5 w-5" />
  </button>
  <button onClick={() => onArchiveTask(task)} title={task.archived ? "Unarchive" : "Archive"}>
    <HiArchive className="h-5 w-5" />
  </button>
  <button onClick={() => onDeleteTask(task)} title="Delete task">
    <HiTrash className="h-5 w-5" />
  </button>
</td>
```

**Note:** This is a **custom table** (not using DataTable component), so RowMenu integration will be slightly different.

---

## Implementation Tasks

### Task 1: Create RowMenu Component ⚙️
**Assignee:** Frontend Agent
**Priority:** 100 (Highest)
**Task ID:** `319cf068-ddf5-48d7-b43a-ac2704efe736`

**Deliverables:**
- Create `/src/components/common/RowMenu.tsx`
- Create `/src/components/common/RowMenu.types.ts`
- Implement `MenuAction<T>` interface
- Implement `RowMenu<T>` component with:
  - Three-dot icon trigger
  - Click-away-listener
  - Viewport-aware positioning
  - Action filtering (shouldShow logic)
  - Dynamic labels/icons support

**Dependencies:**
- Install `react-click-away-listener` if not already installed
- Use existing icon library (react-icons)

**Acceptance Criteria:**
- Component is generic and type-safe
- Dropdown positioning prevents overflow
- Click-away closes dropdown
- Supports all MenuAction properties
- Works in light/dark mode

---

### Task 2: Update DataTableList ⚙️
**Assignee:** Frontend Agent
**Priority:** 90
**Task ID:** `6147ea42-5410-4a36-af5f-4c149fe1353f`

**File:** `/src/components/common/DataTable/DataTableList.tsx`

**Changes:**
1. Import RowMenu component
2. Replace lines 132-158 (inline buttons) with:
   ```tsx
   {hasActions && (
     <td
       onClick={(e) => e.stopPropagation()}
       className="sticky right-0 w-10 max-w-10 bg-white dark:bg-gray-800 shadow-[-4px_0_8px_rgba(0,0,0,0.1)]"
     >
       <RowMenu<typeof item>
         actions={actions.map(button => ({
           label: button.label,
           icon: button.icon,
           onClick: () => button.onClick(),
           shouldShow: () => !button.disabled,
         }))}
         rowItem={item}
         direction={itemIndex < 3 ? "bottom" : "top"}
       />
     </td>
   )}
   ```
3. Update type definitions for MenuAction compatibility

**Dependencies:**
- Task 1 (RowMenu component)

**Acceptance Criteria:**
- All existing rowButtons work via RowMenu
- Dropdown positioning correct
- No visual regressions
- Type-safe integration

---

### Task 3: Update TaskTableView ⚙️
**Assignee:** Frontend Agent
**Priority:** 80
**Task ID:** (Failed to create - needs retry)

**File:** `/src/components/Projects/tasks/views/TaskTableView.tsx`

**Changes:**
1. Import RowMenu component
2. Replace lines 125-147 (inline icon buttons) with:
   ```tsx
   <td className="px-6 py-4 text-right text-sm font-medium">
     <RowMenu<Task>
       actions={[
         { label: "Edit", icon: HiPencil, onClick: () => onEditTask(task) },
         { label: task.archived ? "Restore" : "Archive", icon: HiArchive, onClick: () => onArchiveTask(task) },
         { label: "Delete", icon: HiTrash, onClick: () => onDeleteTask(task) },
       ]}
       rowItem={task}
       direction="bottom"
     />
   </td>
   ```

**Dependencies:**
- Task 1 (RowMenu component)

**Acceptance Criteria:**
- Three actions work correctly
- Dynamic archive/restore label
- Integration with project detail context
- No conflicts with modal interactions

---

### Task 4: Test ProjectsListView 🧪
**Assignee:** QA Agent
**Priority:** 70
**Task ID:** `82f2bf1a-7e79-45ad-8a84-50126bc4543f`

**Test Matrix:**

| Test Case | Expected Behavior | Status |
|-----------|------------------|--------|
| Dropdown trigger | Three-dot icon opens dropdown | ⬜ |
| Click-away | Clicking outside closes dropdown | ⬜ |
| View action | Navigates to `/projects/[id]` | ⬜ |
| Edit action | Navigates to `/projects/[id]/edit` | ⬜ |
| Archive action | Archives project, updates UI | ⬜ |
| Restore action | Restores archived project | ⬜ |
| Positioning (top rows) | Dropdown opens downward | ⬜ |
| Positioning (bottom rows) | Dropdown opens upward | ⬜ |
| Dark mode | Dropdown visible and styled | ⬜ |
| Mobile | Responsive behavior maintained | ⬜ |

**Dependencies:**
- Task 1, Task 2

---

### Task 5: Test Knowledge Base Page 🧪
**Assignee:** QA Agent
**Priority:** 60
**Task ID:** `04addf80-4169-44e0-85c9-a19248244140`

**Test Matrix:**

| Test Case | Expected Behavior | Status |
|-----------|------------------|--------|
| Dropdown trigger | Three-dot icon opens dropdown | ⬜ |
| View action | Opens SourceInspector | ⬜ |
| Edit action | Opens EditSourceDialog | ⬜ |
| Recrawl action | Shows confirmation, starts recrawl | ⬜ |
| Delete action | Shows confirmation, deletes source | ⬜ |
| Four actions visible | All icons + labels render | ⬜ |
| Empty state | No dropdowns shown | ⬜ |
| Dark mode | Dropdown styled correctly | ⬜ |

**Dependencies:**
- Task 1, Task 2

---

### Task 6: Test TasksListView 🧪
**Assignee:** QA Agent
**Priority:** 50
**Task ID:** `ec3d290e-869f-4891-b989-56de1b644d63`

**Test Matrix:**

| Test Case | Expected Behavior | Status |
|-----------|------------------|--------|
| Dropdown trigger | Three-dot icon opens dropdown | ⬜ |
| View action | Navigates to `/tasks/[id]` | ⬜ |
| Edit action | Shows edit alert (placeholder) | ⬜ |
| Archive action | Archives task, updates UI | ⬜ |
| Restore action | Restores archived task | ⬜ |
| Delete action | Shows confirmation, deletes task | ⬜ |
| Filtering | Dropdown works with filtered tasks | ⬜ |
| Sorting | Dropdown works after column sort | ⬜ |
| Search | Dropdown works with search results | ⬜ |

**Dependencies:**
- Task 1, Task 2

---

### Task 7: Test Project Detail TaskTable 🧪
**Assignee:** QA Agent
**Priority:** 40
**Task ID:** `07003b35-7b36-43c7-94f8-ea60a0d79d2a`

**Test Matrix:**

| Test Case | Expected Behavior | Status |
|-----------|------------------|--------|
| Dropdown trigger | Three-dot icon replaces inline buttons | ⬜ |
| Edit action | Opens TaskModal for editing | ⬜ |
| Archive action | Archives task, refreshes table | ⬜ |
| Delete action | Shows confirmation, deletes task | ⬜ |
| Modal interaction | Dropdown doesn't break modal | ⬜ |
| View switching | Board ↔ Table maintains state | ⬜ |
| Empty state | No dropdowns on empty table | ⬜ |
| Scrolling | Dropdown positioning on scroll | ⬜ |

**Dependencies:**
- Task 1, Task 3

---

### Task 8: Create Documentation 📚
**Assignee:** Documentation Agent
**Priority:** 30
**Task ID:** `d370bdd3-1376-4a58-9801-cec9a83bf5cf`

**Deliverables:**
- `/docs/components/RowMenu.md` with:
  - Component overview
  - API reference (MenuAction<T> interface)
  - Integration examples (DataTable, custom tables)
  - Design guidelines
  - Troubleshooting guide

**Dependencies:**
- Task 1 (component implementation)

---

## Migration Guide

### For DataTable Users (Projects, Knowledge Base, Tasks)

**Before:**
```tsx
const rowButtons = (item: MyType): DataTableButton[] => [
  { label: "Edit", icon: HiPencil, onClick: () => handleEdit(item) },
  { label: "Delete", icon: HiTrash, onClick: () => handleDelete(item), variant: "ghost" },
];
```

**After:**
No changes needed! The DataTableList component handles the conversion internally.

---

### For Custom Table Users (TaskTableView)

**Before:**
```tsx
<td className="px-6 py-4 text-right">
  <button onClick={() => onEdit(item)}>
    <HiPencil className="h-5 w-5" />
  </button>
  <button onClick={() => onDelete(item)}>
    <HiTrash className="h-5 w-5" />
  </button>
</td>
```

**After:**
```tsx
<td className="px-6 py-4 text-right">
  <RowMenu<MyType>
    actions={[
      { label: "Edit", icon: HiPencil, onClick: () => onEdit(item) },
      { label: "Delete", icon: HiTrash, onClick: () => onDelete(item) },
    ]}
    rowItem={item}
    direction="bottom"
  />
</td>
```

---

## Risk Assessment

### Low Risk ✅
- Component isolation (no breaking changes to existing APIs)
- Type-safe implementation
- Reference implementation available (SportERP)
- Well-defined scope (4 locations)

### Medium Risk ⚠️
- Custom table integration (TaskTableView) - slightly different pattern
- Positioning edge cases on mobile devices
- Dark mode compatibility testing needed

### Mitigation Strategies
1. **Comprehensive testing** - All 4 locations tested independently
2. **Incremental rollout** - Can deploy to one page at a time
3. **Fallback support** - Keep inline buttons as fallback if needed
4. **User testing** - Verify UX improvements with stakeholders

---

## Success Criteria

✅ All 7 tasks completed
✅ All 4 table views use RowMenu dropdown
✅ No visual regressions
✅ All existing actions work correctly
✅ Dropdown positioning prevents overflow
✅ Dark mode compatible
✅ Mobile responsive
✅ Documentation complete
✅ Zero console errors
✅ User approval on UX improvements

---

## Timeline Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Development** | 2-3 days | Tasks 1-3 |
| **Testing** | 2-3 days | Tasks 4-7 |
| **Documentation** | 1 day | Task 8 |
| **Total** | **5-7 days** | All tasks |

---

## Related Files

### SportERP Reference
- `/sporterp-apps/app.sporterp.co.uk/components/common/RowMenu.tsx` - RowMenu component
- `/sporterp-apps/app.sporterp.co.uk/components/common/DataTable/components/TableRows.tsx` - Integration example

### Archon Files to Modify
- `/src/components/common/RowMenu.tsx` - **NEW** component to create
- `/src/components/common/DataTable/DataTableList.tsx` - Update action rendering
- `/src/components/Projects/tasks/views/TaskTableView.tsx` - Update to use RowMenu
- `/docs/components/RowMenu.md` - **NEW** documentation

### Archon Pages Affected
- `/src/features/projects/views/ProjectsListView.tsx` - No changes (uses DataTable)
- `/src/app/knowledge-base/page.tsx` - No changes (uses DataTable)
- `/src/features/tasks/views/TasksListView.tsx` - No changes (uses DataTable)
- `/src/features/projects/views/ProjectDetailView.tsx` - Indirect (uses TaskTableView)

---

## Notes

- **Backwards Compatible:** Existing DataTableButton API remains unchanged
- **Zero Breaking Changes:** Only internal rendering logic changes
- **Progressive Enhancement:** Can be rolled out incrementally
- **User Benefit:** Cleaner UI, more actions per row without clutter
- **Developer Benefit:** Consistent pattern, easier to maintain

---

**Document Version:** 1.0
**Last Updated:** 2025-12-29
**Status:** ✅ Ready for Implementation
**Next Step:** Start Task 1 (Create RowMenu Component)
