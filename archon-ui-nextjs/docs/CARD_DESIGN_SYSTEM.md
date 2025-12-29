# Archon Card Design System
## Unified Design Language - SportERP Alignment

**Date**: 2025-12-29
**Version**: 1.0.0
**Status**: Design Proposal

---

## Executive Summary

This document defines the **unified card design system** for all Archon cards (Project, Task, Knowledge Base) to ensure consistency with the SportERP design language.

### Design Goals
1. ✅ Visual consistency across all card types
2. ✅ Match SportERP design patterns
3. ✅ Professional, clean, accessible
4. ✅ Smooth transitions and interactions
5. ✅ Dark mode support

---

## 1. Base Card Design System

### 1.1 Container Styling

```typescript
const CARD_CONTAINER = {
  // Base structure
  base: "relative rounded-lg overflow-hidden bg-white dark:bg-gray-800",

  // Border (SportERP standard)
  border: "border-2 border-gray-200 dark:border-gray-700",

  // Shadow (none at rest, appear on hover)
  shadow: "hover:shadow-lg",

  // Transitions
  transition: "transition-all duration-300",

  // Hover states
  hover: "hover:border-gray-300 dark:hover:border-gray-600",

  // Padding (SportERP standard)
  padding: "p-4",

  // Min height for consistency
  minHeight: "min-h-[200px]", // Adjust per card type
};
```

**Full class string**:
```tsx
className="relative rounded-lg overflow-hidden bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 p-4"
```

### 1.2 Typography Hierarchy

```typescript
const TYPOGRAPHY = {
  // Card title
  title: "text-base font-semibold text-gray-900 dark:text-white leading-tight",

  // Description/body text
  description: "text-sm text-gray-600 dark:text-gray-400 leading-relaxed",

  // Metadata/secondary info
  metadata: "text-xs text-gray-500 dark:text-gray-500",

  // Caption/labels
  caption: "text-xs font-medium text-gray-700 dark:text-gray-300",
};
```

**Key Changes**:
- Title: `text-xl` → `text-base` (more compact, professional)
- Description: `text-xs` → `text-sm` (better readability)
- Metadata: Consistent `text-xs`

### 1.3 Status Indicators (Task Cards Only)

```typescript
const STATUS_BORDER = {
  // Left border accent (4px)
  todo: "border-l-4 border-l-gray-400 dark:border-l-gray-500",
  doing: "border-l-4 border-l-blue-500 dark:border-l-blue-400",
  review: "border-l-4 border-l-yellow-500 dark:border-l-yellow-400",
  done: "border-l-4 border-l-green-500 dark:border-l-green-400",
};
```

**Keep existing**: Task cards already have this ✅

### 1.4 Badges & Tags

```typescript
const BADGE_STYLES = {
  // Base badge (SportERP-inspired)
  base: "inline-flex items-center px-2 py-1 text-xs font-medium rounded-full",

  // Status badges
  status: {
    todo: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    doing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },

  // Type badges
  type: {
    technical: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    business: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
  },

  // Level badges
  level: {
    basic: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
    advanced: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  },

  // Priority badges
  priority: {
    low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};
```

**Key Changes**:
- Size: `text-[10px]` → `text-xs` (better readability)
- Padding: `px-2 py-0.5` → `px-2 py-1` (more breathing room)
- Shape: Keep `rounded-full` ✅

### 1.5 Action Buttons

```typescript
const ACTION_BUTTONS = {
  // Small icon buttons (current Task/KB pattern - KEEP THIS)
  iconButton: {
    size: "w-5 h-5",
    iconSize: "w-3 h-3",
    base: "rounded-full flex items-center justify-center transition-all duration-200",
    focus: "focus:ring-2 focus:ring-brand-500 focus:outline-none",
  },

  // Color variants
  variants: {
    view: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-800/40",
    edit: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/40",
    delete: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40",
    archive: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600",
    action: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/40",
  },

  // Button group spacing
  group: "flex items-center gap-1.5 ml-auto",
};
```

**Keep current pattern**: Small icon buttons are perfect ✅

### 1.6 Layout & Spacing

```typescript
const LAYOUT = {
  // Card internal structure
  container: "flex flex-col",

  // Header section
  header: {
    wrapper: "flex items-center gap-1.5 mb-2",
    badges: "flex flex-wrap gap-1",
    actions: "flex items-center gap-1.5 ml-auto",
  },

  // Title section
  title: {
    wrapper: "mb-2",
    truncate: "line-clamp-2 overflow-hidden",
  },

  // Description section
  description: {
    wrapper: "mb-2 flex-1",
    truncate: "line-clamp-3",
  },

  // Footer section
  footer: {
    wrapper: "mt-auto pt-2.5 border-t border-gray-200 dark:border-gray-700",
    content: "flex items-center justify-between",
  },

  // Spacing
  spacing: {
    cardGap: "gap-4", // Between cards in grid
    internalGap: "space-y-2", // Between elements in card
  },
};
```

---

## 2. Card-Specific Specifications

### 2.1 Project Card Design

**Current Issues**:
- ❌ Uses Flowbite `Card` component (different paradigm)
- ❌ Title too large (`text-xl`)
- ❌ Flowbite `Button` components too bulky
- ❌ No consistent border-2

**Target Design**:

```tsx
<div className="relative rounded-lg overflow-hidden bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 p-4">
  {/* Header with badges and actions */}
  <div className="flex items-center gap-1.5 mb-2">
    {/* Badges (archived, pinned) */}
    <div className="flex flex-wrap gap-1">
      {project.archived && (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
          Archived
        </span>
      )}
      {project.pinned && (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          Pinned
        </span>
      )}
    </div>

    {/* Action buttons */}
    <div className="flex items-center gap-1.5 ml-auto">
      <button className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-800/40 focus:ring-2 focus:ring-brand-500">
        <HiEye className="w-3 h-3" />
      </button>
      {/* More buttons... */}
    </div>
  </div>

  {/* Title */}
  <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight mb-2 line-clamp-2">
    {project.title}
  </h3>

  {/* Description */}
  {project.description && (
    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2 line-clamp-3">
      {project.description}
    </p>
  )}

  {/* Footer with metadata */}
  <div className="mt-auto pt-2.5 border-t border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500 dark:text-gray-500">
        Created {formatDate(project.created_at)}
      </span>
      <div className="flex items-center gap-1">
        {/* Task count badges */}
      </div>
    </div>
  </div>
</div>
```

### 2.2 Task Card Design

**Current State**: ✅ Mostly good!

**Minor Improvements**:
- ✅ Container already correct
- ✅ Status border-left already correct
- ⚠️ Description text too small (`text-xs` → `text-sm`)
- ⚠️ Badge text too small (`text-[10px]` → `text-xs`)

```tsx
// Only update these:
<p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
  {task.description}
</p>

<span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
  {task.feature}
</span>
```

### 2.3 Knowledge Base Card Design

**Current State**: ✅ Good foundation

**Improvements Needed**:
- ⚠️ Description text too small
- ⚠️ Badge text too small
- ✅ Everything else looks good

```tsx
// Update description
<p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
  {source.description}
</p>

// Update badges
<span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
  {source.knowledge_type}
</span>
```

---

## 3. Comparison Matrix (Before → After)

| Element | Before (Inconsistent) | After (Unified) |
|---------|----------------------|-----------------|
| **Container Border** | Flowbite / border-2 / border-2 | `border-2 border-gray-200` (all) |
| **Title Size** | text-xl / text-sm / text-sm | `text-base font-semibold` (all) |
| **Description Size** | text-sm / text-xs / text-xs | `text-sm` (all) |
| **Badge Size** | Flowbite / text-[10px] / text-[10px] | `text-xs px-2 py-1` (all) |
| **Action Buttons** | Flowbite Button / icon / icon | Small icon buttons (all) |
| **Padding** | Flowbite / p-4 / p-4 | `p-4` (all) ✅ |
| **Hover Shadow** | Yes / Yes / Yes | `hover:shadow-lg` (all) ✅ |
| **Transition** | Yes / Yes / Yes | `duration-300` (all) ✅ |

---

## 4. Priority Matrix

### Critical (Must Fix)
1. **Project Card**: Remove Flowbite components, use custom design
2. **Typography**: Standardize title to `text-base`, description to `text-sm`
3. **Badges**: Increase size from `text-[10px]` to `text-xs`

### High (Noticeable Improvements)
4. **Project Card**: Replace Flowbite buttons with icon buttons
5. **Consistency**: Ensure all cards use `border-2 border-gray-200`
6. **Badge Padding**: `py-0.5` → `py-1` for better touch targets

### Medium (Polish)
7. **Hover States**: Verify consistent hover border color change
8. **Focus Rings**: Ensure all interactive elements have focus rings
9. **Spacing**: Verify `gap-1.5` for action buttons

### Low (Nice-to-Have)
10. **Animation**: Add subtle entrance animations
11. **Loading States**: Skeleton loaders matching design
12. **Empty States**: Consistent empty card messaging

---

## 5. Implementation Priority

### Phase 1: ProjectWithTasksCard.tsx
- **Effort**: High (complete rewrite)
- **Impact**: High (most visible on dashboard)
- **Priority**: #1

### Phase 2: TaskCard.tsx
- **Effort**: Low (minor adjustments)
- **Impact**: Medium
- **Priority**: #2

### Phase 3: KnowledgeSourceCard.tsx
- **Effort**: Low (minor adjustments)
- **Impact**: Medium
- **Priority**: #3

---

## 6. Testing Checklist

### Visual Consistency
- [ ] All cards have `border-2` at rest
- [ ] All titles use `text-base font-semibold`
- [ ] All descriptions use `text-sm`
- [ ] All badges use `text-xs px-2 py-1`
- [ ] All action buttons are `w-5 h-5` with `w-3 h-3` icons

### Interaction Testing
- [ ] Hover shows shadow-lg on all cards
- [ ] Hover changes border color
- [ ] Focus rings visible on keyboard navigation
- [ ] Click targets are at least 44x44px

### Responsive Testing
- [ ] Cards stack properly on mobile
- [ ] Text truncation works (line-clamp)
- [ ] Badges wrap gracefully
- [ ] Action buttons remain accessible

### Dark Mode Testing
- [ ] All cards readable in dark mode
- [ ] Borders visible but not harsh
- [ ] Badges have proper contrast
- [ ] Hover states work in dark mode

---

## 7. Success Metrics

**Definition of Done**:
1. ✅ All three card types use identical base styling
2. ✅ Typography hierarchy matches across all cards
3. ✅ No Flowbite components in ProjectWithTasksCard
4. ✅ Badge sizes consistent (text-xs)
5. ✅ Action button patterns identical
6. ✅ Passes all testing checklist items
7. ✅ Dark mode fully functional
8. ✅ Accessible (keyboard, screen reader)

---

**Next Steps**: Move to Phase 3 - Implementation
