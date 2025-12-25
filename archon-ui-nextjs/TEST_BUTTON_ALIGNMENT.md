# Button Alignment Testing Guide

## What Was Fixed
Replaced `flex-1` with `min-w-*` classes for consistent button sizing in TaskCard.tsx

### Changes Applied:
- Edit button: `min-w-[80px]` (was `flex-1`)
- Archive button: `min-w-[100px]` (was `flex-1`) 
- Status button: `min-w-[120px]` (was `flex-1`)
- Delete button: `min-w-[80px]` (was `flex-1`)

## Testing Checklist

### Visual Tests (Start dev server: `npm run dev`)

1. **Single Button Scenario**
   - [ ] Only Edit button visible - should not stretch full width
   - [ ] Only Delete button visible - should not stretch full width

2. **Two Buttons**
   - [ ] Edit + Delete - equal 2px gap, no stretching
   - [ ] Edit + Status - equal 2px gap, consistent sizing

3. **Three Buttons**
   - [ ] Edit + Archive + Delete - equal gaps, consistent sizing
   - [ ] Edit + Status + Delete - equal gaps, consistent sizing

4. **Four Buttons (Max)**
   - [ ] Edit + Archive + Status + Delete - all with equal 2px gaps
   - [ ] No uneven stretching across all buttons

### Responsive Tests

5. **Mobile View** (DevTools: iPhone SE 375px)
   - [ ] Buttons wrap gracefully using `flex-wrap`
   - [ ] 2px gaps maintained between wrapped buttons
   - [ ] No horizontal overflow

6. **Tablet View** (DevTools: iPad 768px)
   - [ ] Buttons display inline with proper gaps
   - [ ] Consistent sizing across screen sizes

### Dark Mode Tests

7. **Dark Mode Toggle** (use theme switcher)
   - [ ] All button variants render correctly
   - [ ] Primary, secondary, danger colors work
   - [ ] Hover states maintain dark mode styles

### Interaction Tests

8. **Functionality**
   - [ ] Edit button triggers modal/edit action
   - [ ] Delete button triggers confirmation
   - [ ] Status change button works correctly
   - [ ] Archive/Unarchive toggles state

## Expected Behavior

**Before (flex-1)**:
- Buttons stretched unevenly based on count
- 3 buttons = each takes 33.33% width
- 2 buttons = each takes 50% width
- Inconsistent visual weight

**After (min-w-*)**:
- Buttons have minimum widths based on content
- Extra space distributed evenly by flex container
- Consistent gaps (2px/0.5rem from gap-2)
- Natural button sizing regardless of count

## Quick Start Server

```bash
npm run dev
# Navigate to: http://localhost:3738/tasks
# Or: http://localhost:3738/projects (view Kanban boards)
```

## File Modified
- `/home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs/src/components/Tasks/TaskCard.tsx` (lines 217-262)
