# Archon UI Design System

**Version:** 1.0.0
**Last Updated:** 2026-01-26
**Maintainer:** SportERP Team

## Overview

This document defines the UI/UX design standards for the Archon project. All frontend components must follow these guidelines to ensure consistency, accessibility, and maintainability.

---

## Design Philosophy

1. **Consistency First** - Use established Flowbite React patterns
2. **Accessibility** - WCAG 2.1 AA compliance minimum
3. **Dark Mode Support** - All components work in light and dark themes
4. **Responsive Design** - Mobile-first approach
5. **Performance** - Minimal re-renders, optimized bundle size

---

## Component Library

### Primary: Flowbite React v0.12.13

**Official Documentation:** https://flowbite-react.com/

**Installation:**
```bash
npm install flowbite-react@^0.12.13
```

**Why Flowbite?**
- Built on Tailwind CSS
- TypeScript support
- Accessible components
- Dark mode built-in
- Active maintenance

---

## Color System

### Flowbite Supported Colors

Flowbite React components (Button, Badge, Alert, etc.) support these standard colors:

| Color Name | Use Case | Example |
|------------|----------|---------|
| `blue` | Default primary actions | Save, Submit |
| `purple` | Special/featured actions | Link, Premium features |
| `pink` | Creative/design actions | - |
| `gray` | Secondary/neutral actions | Cancel, Dismiss |
| `success` / `green` | Positive confirmations | Approve, Complete |
| `failure` / `red` | Destructive actions | Delete, Remove |
| `info` / `cyan` | Informational actions | Learn More, Details |
| `warning` / `yellow` | Cautionary actions | Warning, Review |
| `dark` | High contrast actions | - |
| `light` | Low contrast actions | - |
| `indigo` | Alternative primary | - |
| `lime` | Alternative success | - |
| `teal` | Alternative info | - |

**Note:** All colors include automatic dark mode support and hover states.

**✅ CONFIRMED:** Flowbite React v0.12.13+ **FULLY SUPPORTS** `color="purple"`!

### Purple Button Implementation

**CORRECT Pattern:**
```tsx
import { Button } from "flowbite-react";

// ✅ Standard purple button
<Button color="purple" onClick={handleClick}>
  Purple Button
</Button>

// ✅ With additional styling
<Button color="purple" size="sm" onClick={handleClick}>
  Small Purple Button
</Button>

// ✅ Outlined variant
<Button color="purple" outline onClick={handleClick}>
  Outlined Purple
</Button>
```

**❌ INCORRECT Pattern (Causes "Element type is invalid" error):**
```tsx
// ❌ NEVER use custom className without color prop
<Button className="bg-purple-600 hover:bg-purple-700" onClick={handleClick}>
  Broken Button
</Button>

// ❌ NEVER mix color="info" with purple className
<Button color="info" className="bg-purple-600" onClick={handleClick}>
  Broken Button
</Button>
```

**Why the Wrong Pattern Fails:**
1. Flowbite Button **requires** `color` prop to initialize its internal theme
2. Without `color`, Flowbite tries `theme.button.color[undefined]` → returns `undefined`
3. React receives `undefined` component → throws "Element type is invalid"

### Archon Brand Colors

| Color | Tailwind Class | Hex | Usage |
|-------|----------------|-----|-------|
| **Primary Purple** | `purple-600` | `#9333EA` | Primary actions, brand elements |
| Purple Hover | `purple-700` | `#7E22CE` | Hover states |
| Purple Focus | `purple-300` | `#D8B4FE` | Focus rings (light mode) |
| Purple Focus Dark | `purple-800` | `#6B21A8` | Focus rings (dark mode) |
| **Secondary Blue** | `blue-600` | `#2563EB` | Secondary actions |
| **Success Green** | `green-600` | `#16A34A` | Success states |
| **Warning Yellow** | `yellow-500` | `#EAB308` | Warnings, caution |
| **Error Red** | `red-600` | `#DC2626` | Errors, destructive actions |
| **Neutral Gray** | `gray-600` | `#4B5563` | Text, borders |

---

## Component Patterns

### Buttons

#### Primary Action Button (Purple)
```tsx
import { Button } from "flowbite-react";
import { HiCheck } from "react-icons/hi";

<Button
  color="info"
  className="bg-purple-600 hover:bg-purple-700 focus:ring-purple-300 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-800"
  onClick={handlePrimaryAction}
  size="sm"
>
  <HiCheck className="mr-2 h-4 w-4" />
  Primary Action
</Button>
```

#### Secondary Action Button (Blue)
```tsx
<Button
  color="blue"
  onClick={handleSecondaryAction}
  size="sm"
>
  <HiPlus className="mr-2 h-4 w-4" />
  Secondary Action
</Button>
```

#### Destructive Action Button (Red)
```tsx
<Button
  color="failure"
  onClick={handleDelete}
  size="xs"
>
  <HiTrash className="h-4 w-4" />
</Button>
```

#### Cancel/Dismiss Button (Gray)
```tsx
<Button
  color="gray"
  onClick={handleCancel}
>
  Cancel
</Button>
```

### Badges

```tsx
import { Badge } from "flowbite-react";

// Status badges
<Badge color="success">Active</Badge>
<Badge color="warning">Pending</Badge>
<Badge color="failure">Error</Badge>
<Badge color="gray">Inactive</Badge>

// Custom purple badge
<Badge
  color="info"
  className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
>
  Custom
</Badge>
```

### Modals

```tsx
import { Modal, Button } from "flowbite-react";

<Modal show={isOpen} onClose={onClose} size="3xl">
  <Modal.Header>Modal Title</Modal.Header>
  <Modal.Body>
    {/* Modal content */}
  </Modal.Body>
  <Modal.Footer>
    <Button
      color="info"
      className="bg-purple-600 hover:bg-purple-700 focus:ring-purple-300 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-800"
      onClick={handleConfirm}
    >
      Confirm
    </Button>
    <Button color="gray" onClick={onClose}>
      Cancel
    </Button>
  </Modal.Footer>
</Modal>
```

### Loading States

```tsx
import { Spinner } from "flowbite-react";

// Inline loading
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Spinner size="sm" className="mr-2" />
      Loading...
    </>
  ) : (
    "Submit"
  )}
</Button>

// Full page loading
<div className="flex items-center justify-center py-12">
  <Spinner size="xl" />
  <span className="ml-3 text-gray-600 dark:text-gray-400">
    Loading...
  </span>
</div>
```

### Toast Notifications

```tsx
import toast from "react-hot-toast";

// Success
toast.success("Operation completed successfully!");

// Error
toast.error("Something went wrong");

// Warning (use error with custom icon)
toast.error("Please review this action", {
  icon: '⚠️',
  duration: 5000
});

// Custom
toast.custom((t) => (
  <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} ...`}>
    Custom toast content
  </div>
));
```

---

## Icon System

### Primary: React Icons (HeroIcons)

**Installation:**
```bash
npm install react-icons
```

**Usage:**
```tsx
import {
  HiPlus,
  HiTrash,
  HiPencil,
  HiCheck,
  HiX,
  HiLink,
  HiGlobeAlt,
  HiExternalLink,
} from "react-icons/hi";

<HiPlus className="h-5 w-5" />
```

**Icon Sizing:**
- `h-3 w-3` - Extra small (12px) - inline text icons
- `h-4 w-4` - Small (16px) - button icons
- `h-5 w-5` - Medium (20px) - default icons
- `h-6 w-6` - Large (24px) - section headers
- `h-8 w-8` - Extra large (32px) - hero sections

---

## Typography

### Text Sizing
```tsx
// Headings
<h1 className="text-3xl font-bold text-gray-900 dark:text-white">
<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
<h4 className="text-base font-medium text-gray-900 dark:text-white">

// Body text
<p className="text-sm text-gray-600 dark:text-gray-400">
<span className="text-xs text-gray-500 dark:text-gray-400">
```

### Text Colors
```tsx
// Primary text
text-gray-900 dark:text-white

// Secondary text
text-gray-600 dark:text-gray-400

// Muted text
text-gray-500 dark:text-gray-400

// Link text
text-brand-600 hover:underline dark:text-brand-400
```

---

## Layout Patterns

### Card Containers
```tsx
import { Card } from "flowbite-react";

<Card>
  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
    Card Title
  </h3>
  <p className="text-sm text-gray-600 dark:text-gray-400">
    Card content goes here
  </p>
</Card>
```

### Grid Layouts
```tsx
// Responsive grid
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {items.map(item => <Card key={item.id}>{item.content}</Card>)}
</div>

// Auto-fit grid
<div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
  {items.map(item => <Card key={item.id}>{item.content}</Card>)}
</div>
```

### Spacing
```tsx
// Section spacing
<div className="space-y-6">  // Vertical spacing

// Flex gaps
<div className="flex gap-2">  // Horizontal spacing
<div className="flex gap-4">
```

---

## Accessibility

### Focus States
Always include visible focus indicators:
```tsx
focus:ring-2 focus:ring-purple-300 focus:outline-none
dark:focus:ring-purple-800
```

### ARIA Labels
```tsx
<button
  aria-label="Delete item"
  onClick={handleDelete}
>
  <HiTrash className="h-4 w-4" />
</button>

<input
  type="text"
  aria-describedby="helper-text"
/>
<span id="helper-text" className="text-xs text-gray-500">
  Helper text
</span>
```

### Keyboard Navigation
Ensure all interactive elements are keyboard accessible:
```tsx
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
  onClick={handleClick}
>
  Clickable div
</div>
```

---

## Performance Best Practices

### Avoid Inline Functions
```tsx
// ❌ BAD
<Button onClick={() => handleClick(item.id)}>

// ✅ GOOD
const handleItemClick = useCallback(() => {
  handleClick(item.id);
}, [item.id]);

<Button onClick={handleItemClick}>
```

### Memoize Expensive Computations
```tsx
import { useMemo } from "react";

const sortedItems = useMemo(() => {
  return items.sort((a, b) => a.priority - b.priority);
}, [items]);
```

### Lazy Load Components
```tsx
import { lazy, Suspense } from "react";

const HeavyComponent = lazy(() => import("./HeavyComponent"));

<Suspense fallback={<Spinner />}>
  <HeavyComponent />
</Suspense>
```

---

## Common Mistakes to Avoid

### ❌ Using Unsupported Flowbite Colors
```tsx
// WRONG - 'purple' is not supported
<Button color="purple">Click Me</Button>
```

### ✅ Correct Purple Styling
```tsx
// CORRECT - Use base color + custom className
<Button
  color="info"
  className="bg-purple-600 hover:bg-purple-700 focus:ring-purple-300 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-800"
>
  Click Me
</Button>
```

### ❌ Using toast.warning (doesn't exist)
```tsx
// WRONG
toast.warning("Warning message");
```

### ✅ Correct Warning Toast
```tsx
// CORRECT
toast.error("Warning message", {
  icon: '⚠️',
  duration: 5000
});
```

### ❌ Missing Dark Mode Variants
```tsx
// WRONG
<div className="bg-white text-gray-900">
```

### ✅ Correct Dark Mode Support
```tsx
// CORRECT
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
```

---

## Testing UI Components

### Visual Regression Testing
- Use Storybook for component development
- Test both light and dark themes
- Test all interactive states (hover, focus, disabled)
- Test responsive breakpoints

### Accessibility Testing
- Use `axe-core` for automated accessibility testing
- Test keyboard navigation
- Test screen reader compatibility
- Verify ARIA labels and roles

---

## Resources

### Official Documentation
- **Flowbite React:** https://flowbite-react.com/
- **Tailwind CSS:** https://tailwindcss.com/
- **React Icons:** https://react-icons.github.io/react-icons/
- **react-hot-toast:** https://react-hot-toast.com/

### Internal Resources
- **Archon CLAUDE.md:** `@.claude/CLAUDE.md`
- **Archon MEMORY.md:** `@.claude/MEMORY.md`
- **Best Practices:** `@.claude/docs/BEST_PRACTICES.md`
- **Component Examples:** `@archon-ui-nextjs/src/features/projects/components/`

### Design References
- **Flowbite Design System:** https://flowbite.com/docs/getting-started/introduction/
- **Tailwind UI:** https://tailwindui.com/
- **shadcn/ui:** https://ui.shadcn.com/ (alternative pattern library)

---

## Changelog

### v1.0.0 (2026-01-26)
- Initial documentation
- Flowbite React v0.12.13 guidelines
- Custom purple color workaround
- Component patterns and examples
- Accessibility guidelines
- Performance best practices

---

## Maintainers

**Primary:** SportERP Team
**Questions:** Refer to `@.claude/CLAUDE.md` for project-specific guidance

**Last Reviewed:** 2026-01-26
