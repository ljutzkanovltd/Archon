# SportERP Component Alignment Strategy

## Executive Summary

This document outlines the complete strategy for aligning the Archon Next.js dashboard (port 3738) with the SportERP frontend (app.sporterp.co.uk) component patterns, ensuring consistency, reusability, and maintainability.

**Goal**: Every component in Archon Next.js should follow SportERP's Flowbite patterns exactly.

**Status**: Phase 1 - Foundation & Common Components

---

## 1. Core Principles

### 1.1 Component Hierarchy
```
SportERP (Source of Truth)
    ↓ Port & Adapt
Archon Next.js (Implementation)
```

### 1.2 Styling Standards
- **Framework**: Tailwind CSS 3.4+ (same as SportERP)
- **Component Library**: Flowbite React patterns
- **Dark Mode**: Full support with `dark:` variants
- **Responsive**: Mobile-first (xs, sm, md, lg, xl, 2xl)
- **Utility Function**: `cn()` from `lib/utils.ts` for className merging

### 1.3 TypeScript Standards
- Strict mode enabled
- Explicit prop interfaces
- Type safety for all components
- Shared types in `lib/types.ts`

---

## 2. Component Mapping

### 2.1 Common Components (Priority 1 - Port Immediately)

| SportERP Component | Archon Status | Port Priority | Notes |
|-------------------|---------------|---------------|-------|
| **ButtonComponent** | ❌ Missing | P0 | Core UI element - 3 variants (primary/secondary/ghost) |
| **ReactIcons** | ❌ Missing | P0 | Icon wrapper for react-icons library |
| **CustomModal** | ❌ Missing | P0 | Portal-based modal with 4 sizes |
| **EmptyState** | ❌ Missing | P0 | Standardized empty states |
| **DataTable** (full) | ⚠️ Partial | P1 | Complete table system with context |
| **TableSearchbar** | ⚠️ Partial | P1 | Search with debounce & dropdown |
| **TableHeader** | ⚠️ Partial | P1 | Sortable headers |
| **TableRows** | ⚠️ Partial | P1 | Row rendering with actions |
| **DataTablePagination** | ⚠️ Partial | P1 | Pagination controls |
| **DataTableEmptyState** | ❌ Missing | P1 | Table-specific empty state |
| **DataTableFilters** | ❌ Missing | P1 | Advanced filter panel |
| **Tabs** | ❌ Missing | P2 | Tab navigation component |
| **BreadCrumb** | ❌ Missing | P2 | Breadcrumb navigation |
| **LinearProgress** | ❌ Missing | P2 | Progress bars |

### 2.2 Utility Files (Priority 0 - Critical)

| File | Description | Status |
|------|-------------|--------|
| `lib/utils.ts` | cn() utility & helpers | ⚠️ Partial |
| `lib/types.ts` | Shared TypeScript types | ⚠️ Partial |
| `components/ReactIcons.tsx` | Icon mapping | ❌ Missing |
| `components/ButtonComponent.tsx` | Button component | ❌ Missing |

---

## 3. Implementation Phases

### Phase 0: Foundation (CURRENT) ⏳
**Time**: 2 hours
**Priority**: P0 - Blocking

**Tasks**:
1. ✅ Port `lib/utils.ts` with cn() function
2. ✅ Extend `lib/types.ts` with SportERP types:
   - ButtonVariant, ButtonType, ButtonProps
   - IconName enum
   - EmptyStateConfig
   - Modal sizes
3. ✅ Create `components/ReactIcons.tsx`
4. ✅ Create `components/ButtonComponent.tsx`
5. ✅ Create `components/common/CustomModal.tsx`
6. ✅ Create `components/common/EmptyState.tsx`

**Output**: Core reusable components available project-wide

---

### Phase 1: DataTable Enhancement (NEXT)
**Time**: 4 hours
**Priority**: P1

**Tasks**:
1. Port complete `DataTable` context system from SportERP
2. Enhance `DataTableSearch` with dropdown suggestions
3. Port `DataTableFilters` with selection & range filters
4. Update `DataTablePagination` with SportERP styling
5. Add `DataTableEmptyState` component
6. Implement filter tags display

**Output**: Production-ready DataTable matching SportERP exactly

---

### Phase 2: Knowledge Base List View
**Time**: 20 hours (8 sub-phases)
**Priority**: P1

**Already planned in Archon tasks** (see KNOWLEDGE_BASE_LIST_VIEW_PLAN.md)

---

### Phase 3: Projects & Tasks Components
**Time**: 6 hours
**Priority**: P2

**Tasks**:
1. Refactor `ProjectCard` using ButtonComponent
2. Refactor `TaskCard` using CustomModal
3. Update `BoardView` (Kanban) with DnD
4. Enhance `TaskTableView` with full DataTable
5. Add EmptyState to all list views

**Output**: Consistent project/task UI

---

### Phase 4: Navigation & Layout
**Time**: 3 hours
**Priority**: P2

**Tasks**:
1. Enhance `Sidebar` with Flowbite patterns
2. Add `BreadCrumb` component
3. Add `Tabs` component for multi-view pages
4. Update `Header` with consistent styling

**Output**: Polished navigation matching SportERP

---

### Phase 5: Forms & Inputs
**Time**: 4 hours
**Priority**: P3

**Tasks**:
1. Create standardized Input component
2. Create Select/Dropdown component
3. Create Checkbox/Radio components
4. Create TextArea component
5. Add form validation patterns

**Output**: Consistent form components

---

## 4. Component Specifications

### 4.1 ButtonComponent

**Variants**:
- `primary`: Red/brand background, white text
- `secondary`: White background, brand border & text
- `ghost`: White background, light border, brand text

**Props**:
```typescript
interface ButtonProps {
  name?: string;
  icon?: IconName;
  color?: string;
  variant?: ButtonVariant; // primary | secondary | ghost
  type?: ButtonType; // button | submit | reset
  className?: string;
  isLoading?: boolean;
  disabled?: boolean;
  checkbox?: boolean;
  iconLeft?: boolean;
  onCheckboxChange?: () => void;
  checked?: boolean;
  iconClassName?: string;
  fullWidth?: boolean;
  onClick?: () => void;
}
```

**Usage**:
```tsx
<ButtonComponent
  name="Add Source"
  icon="PLUS"
  variant={ButtonVariant.PRIMARY}
  onClick={handleAdd}
/>
```

---

### 4.2 CustomModal

**Sizes**:
- `NORMAL`: max-w-xl
- `MEDIUM`: max-w-3xl
- `LARGE`: max-w-5xl
- `FULL`: max-w-full

**Props**:
```typescript
interface CustomModalProps {
  open: boolean;
  close: () => void;
  title: string;
  description?: string;
  size?: "NORMAL" | "LARGE" | "FULL" | "MEDIUM";
  headerClassName?: string;
  containerClassName?: string;
  children: React.ReactNode;
}
```

**Usage**:
```tsx
<CustomModal
  open={isOpen}
  close={() => setIsOpen(false)}
  title="Add Knowledge Source"
  size="LARGE"
>
  <AddSourceForm />
</CustomModal>
```

---

### 4.3 EmptyState

**Types**:
- `no_data`: No items exist (primary CTA)
- `no_search_results`: Search returned no results (secondary CTA)

**Props**:
```typescript
interface EmptyStateConfig {
  type: 'no_data' | 'no_search_results';
  title: string;
  description: string;
  icon?: React.ReactNode;
  button?: {
    text: string;
    onClick?: () => void;
    href?: string;
    variant?: ButtonVariant;
    icon?: string;
    className?: string;
  };
  customContent?: React.ReactNode;
}
```

**Usage**:
```tsx
<EmptyState
  config={{
    type: 'no_data',
    title: 'No Knowledge Sources',
    description: 'Start by adding your first knowledge source',
    button: {
      text: 'Add Source',
      href: '/knowledge-base/add',
      variant: ButtonVariant.PRIMARY,
      icon: 'PLUS'
    }
  }}
/>
```

---

### 4.4 ReactIcons

**Supported Icons** (150+ from react-icons):
- Material Design (Md prefix)
- Heroicons (Hi prefix)
- Font Awesome (Fa prefix)
- Ionicons (Io prefix)
- Bootstrap (Bs prefix)

**Usage**:
```tsx
<ReactIcons
  icon="PLUS"
  size={20}
  className="text-gray-500"
/>
```

---

## 5. Styling Conventions

### 5.1 Color Palette (Match SportERP)

**Brand Colors**:
- Primary: `brand-700` (red)
- Primary Hover: `brand-800`
- Primary Light: `brand-100`

**Neutral Colors**:
- Background: `gray-50` (light), `gray-800` (dark)
- Border: `gray-200` (light), `gray-700` (dark)
- Text: `gray-900` (light), `white` (dark)
- Text Muted: `gray-500` (light), `gray-400` (dark)

**Status Colors**:
- Success: `green-500`, `green-100` background
- Error: `red-500`, `red-100` background
- Warning: `orange-500`, `orange-100` background
- Info: `cyan-500`, `cyan-100` background

### 5.2 Spacing Scale
- xs: `p-1` (4px)
- sm: `p-2` (8px)
- md: `p-4` (16px)
- lg: `p-6` (24px)
- xl: `p-8` (32px)

### 5.3 Border Radius
- Default: `rounded-lg` (8px)
- Small: `rounded-sm` (2px)
- Full: `rounded-full`

### 5.4 Shadows
- Default: `shadow-sm`
- Hover: `shadow-md`
- Lifted: `shadow-lg`
- Dark: `dark:shadow-gray-800`

---

## 6. Component Usage Patterns

### 6.1 Modal Pattern
```tsx
const [isOpen, setIsOpen] = useState(false);

return (
  <>
    <ButtonComponent
      name="Open Modal"
      onClick={() => setIsOpen(true)}
      variant={ButtonVariant.PRIMARY}
    />

    <CustomModal
      open={isOpen}
      close={() => setIsOpen(false)}
      title="Modal Title"
      size="MEDIUM"
    >
      {/* Modal content */}
    </CustomModal>
  </>
);
```

### 6.2 Empty State Pattern
```tsx
{items.length === 0 ? (
  <EmptyState
    config={{
      type: searchQuery ? 'no_search_results' : 'no_data',
      title: searchQuery ? 'No results found' : 'No items yet',
      description: searchQuery
        ? 'Try adjusting your search'
        : 'Create your first item',
      button: !searchQuery ? {
        text: 'Create Item',
        onClick: handleCreate,
        variant: ButtonVariant.PRIMARY
      } : undefined
    }}
    searchTerm={searchQuery}
  />
) : (
  <ItemList items={items} />
)}
```

### 6.3 DataTable Pattern
```tsx
<DataTable
  tableData={{
    table_title: "Projects",
    search_placeholder: "Search projects...",
    selector: true,
    rows_per_page: 10,
    header_list: headers,
    table_rows: rows,
    view_type: "list"
  }}
  rowButtons={rowActions}
  tableButtonComponents={headerActions}
  emptyStateConfig={{
    type: 'no_data',
    title: 'No Projects',
    description: 'Create your first project',
    button: {
      text: 'Create Project',
      href: '/projects/new',
      variant: ButtonVariant.PRIMARY
    }
  }}
/>
```

---

## 7. Migration Checklist

### 7.1 Component Migration Steps
For each component to migrate:

1. ✅ **Analyze** - Study SportERP implementation
2. ✅ **Port** - Copy to Archon with adjustments
3. ✅ **Test** - Verify functionality matches
4. ✅ **Document** - Add usage examples
5. ✅ **Refactor** - Update existing code to use new component

### 7.2 Page Migration Steps
For each page:

1. ✅ Replace custom buttons with `ButtonComponent`
2. ✅ Replace custom modals with `CustomModal`
3. ✅ Add `EmptyState` for zero-data scenarios
4. ✅ Use `ReactIcons` instead of direct icon imports
5. ✅ Apply consistent Tailwind classes
6. ✅ Test dark mode
7. ✅ Test responsive breakpoints

---

## 8. Quality Assurance

### 8.1 Visual Consistency Checks
- [ ] Button styles match SportERP exactly
- [ ] Modal animations smooth
- [ ] Empty states have correct icons
- [ ] Dark mode works everywhere
- [ ] Responsive design at all breakpoints

### 8.2 Functional Checks
- [ ] All buttons trigger correct actions
- [ ] Modals open/close smoothly
- [ ] Icons render correctly
- [ ] Loading states work
- [ ] Disabled states prevent interaction

### 8.3 Performance Checks
- [ ] No unnecessary re-renders
- [ ] Icons lazy-loaded where possible
- [ ] Modals use portal (no DOM nesting issues)
- [ ] Debounce on search inputs

---

## 9. Documentation Requirements

### 9.1 Component Documentation
Each component must have:
- TypeScript interface
- Usage example
- Props table
- Variants showcase
- Dark mode example

### 9.2 Pattern Documentation
- Common patterns (modal, empty state, table)
- Anti-patterns to avoid
- Performance tips
- Accessibility notes

---

## 10. Success Criteria

### 10.1 Phase Completion
✅ **Phase 0 Complete** when:
- [ ] All P0 components ported
- [ ] All pages can use new components
- [ ] Documentation complete
- [ ] No TypeScript errors

✅ **Project Complete** when:
- [ ] All Archon pages match SportERP styling
- [ ] Dark mode works consistently
- [ ] All components documented
- [ ] Performance benchmarks met
- [ ] User testing passed

---

## 11. Timeline

| Phase | Duration | Start | End | Status |
|-------|----------|-------|-----|--------|
| Phase 0: Foundation | 2h | Day 1 | Day 1 | 🔄 In Progress |
| Phase 1: DataTable | 4h | Day 1 | Day 2 | ⏳ Pending |
| Phase 2: KB List View | 20h | Day 2 | Day 5 | ⏳ Pending |
| Phase 3: Projects/Tasks | 6h | Day 5 | Day 6 | ⏳ Pending |
| Phase 4: Navigation | 3h | Day 6 | Day 6 | ⏳ Pending |
| Phase 5: Forms | 4h | Day 7 | Day 7 | ⏳ Pending |

**Total Estimated Time**: 39 hours

---

## 12. References

### 12.1 Source Files
- SportERP: `/home/ljutzkanov/Documents/Projects/sporterp-apps/app.sporterp.co.uk/`
- Archon: `/home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs/`

### 12.2 Key Documents
- Knowledge Base List View Plan: `KNOWLEDGE_BASE_LIST_VIEW_PLAN.md`
- Active Operations Implementation: `ACTIVE_OPERATIONS_IMPLEMENTATION.md`
- Archon Tasks: Archon MCP project tracker

---

**Version**: 1.0
**Last Updated**: 2025-12-23
**Author**: Claude Code with SportERP alignment directives
**Status**: 🔄 Phase 0 in progress
