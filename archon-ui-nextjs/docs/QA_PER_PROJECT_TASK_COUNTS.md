# QA Testing - Per-Project Task Counts in Sidebar

## Implementation Overview
We replaced the global Tasks menu item with per-project task count badges. Each project in the sidebar now shows its own task count inline.

## Test Cases

### 1. Visual Display - Desktop Sidebar (Expanded)
**Steps:**
1. Open dashboard at http://localhost:3738
2. Expand sidebar if collapsed
3. Expand "Projects" menu item

**Expected:**
- [ ] Each project shows a numeric badge on the right
- [ ] Badge is gray color (`color="gray"`)
- [ ] Badge shows total task count (e.g., "12", "97", "5")
- [ ] Projects with 0 tasks show NO badge (hidden)
- [ ] Badge uses Flowbite Badge component with `size="sm"`
- [ ] Archived projects show "Archived" text instead of count

**Screenshot locations:** Desktop expanded

---

### 2. Visual Display - Desktop Sidebar (Collapsed)
**Steps:**
1. Click sidebar collapse button
2. Observe project badges

**Expected:**
- [ ] Badges still visible in collapsed state
- [ ] Numeric counts remain readable
- [ ] No layout overflow

**Screenshot locations:** Desktop collapsed

---

### 3. Visual Display - Mobile Sidebar
**Steps:**
1. Resize browser to mobile width (<768px)
2. Click hamburger menu to open sidebar
3. Expand Projects menu

**Expected:**
- [ ] Same badge display as desktop expanded
- [ ] Badges align correctly on right side
- [ ] No text truncation or overlap

**Screenshot locations:** Mobile view

---

### 4. Loading States
**Steps:**
1. Clear browser cache
2. Reload page
3. Immediately expand Projects menu

**Expected:**
- [ ] Skeleton loader appears briefly (gray animated rectangle, h-5 w-8)
- [ ] Skeleton disappears when data loads
- [ ] No layout shift when skeleton → badge transition

**Screenshot locations:** Loading state

---

### 5. Data Accuracy
**Steps:**
1. Open Project A detail page (/projects/[id])
2. Note task count in sidebar badge for Project A
3. Navigate to Tasks tab within Project A
4. Count total tasks displayed

**Expected:**
- [ ] Sidebar badge count matches Tasks tab total
- [ ] Count excludes archived tasks
- [ ] Count includes all statuses (todo, doing, review, done)

**Data verification:** Compare sidebar vs tasks page

---

### 6. Large Count Display (99+)
**Steps:**
1. Find or create a project with >99 tasks
2. Observe sidebar badge

**Expected:**
- [ ] Badge shows "99+" instead of actual count
- [ ] No badge width overflow

**Edge case:** Large numbers

---

### 7. Zero Tasks (Hidden Badge)
**Steps:**
1. Find or create a project with 0 tasks
2. Observe sidebar

**Expected:**
- [ ] No badge visible for that project
- [ ] Clean appearance (not showing "0")
- [ ] No error in console

**Edge case:** Empty projects

---

### 8. Auto-Refresh (30 seconds)
**Steps:**
1. Note current badge count for Project A
2. Open another tab, navigate to Project A tasks
3. Create a new task in Project A
4. Wait 30 seconds
5. Check sidebar badge in original tab

**Expected:**
- [ ] Badge count updates automatically after ~30 seconds
- [ ] No manual refresh needed
- [ ] TanStack Query handles auto-refetch

**Timing:** Auto-refresh interval

---

### 9. Error Handling
**Steps:**
1. Stop backend server (port 8181)
2. Reload page
3. Observe sidebar badges

**Expected:**
- [ ] Badges fail silently (hide badge, no count)
- [ ] No red error messages in UI
- [ ] Error logged to console (for debugging)
- [ ] Page remains functional

**Edge case:** API failure

---

### 10. Dark Mode
**Steps:**
1. Toggle dark mode
2. Observe badge colors and readability

**Expected:**
- [ ] Badge background adapts to dark mode
- [ ] Text remains readable (contrast check)
- [ ] No visual artifacts

**Accessibility:** Dark mode

---

### 11. Multiple Projects Performance
**Steps:**
1. Expand Projects menu (currently 4 projects)
2. Open Network tab in DevTools
3. Count API requests to `/api/tasks?project_id=...`

**Expected:**
- [ ] 4 API calls on initial load (one per project)
- [ ] Calls happen in parallel (not sequential blocking)
- [ ] No duplicate requests within 30 seconds
- [ ] Cached responses used on re-render

**Performance:** API calls

---

### 12. Navigation Integration
**Steps:**
1. Click on a project with badge count
2. Navigate to project detail page
3. Verify badge remains accurate

**Expected:**
- [ ] Badge clickable as part of project link
- [ ] Navigation works smoothly
- [ ] Badge doesn't interfere with click target

**UX:** Clickability

---

## Regression Checks

### Old Global Tasks Menu Removed
- [ ] No "Tasks" menu item in Desktop sidebar
- [ ] No "Tasks" menu item in Mobile sidebar
- [ ] `/tasks` route redirects to `/projects`
- [ ] Redirect message: "Tasks are now managed per-project"

### No Breaking Changes
- [ ] All other sidebar menu items work (Dashboard, KB, MCP, Settings)
- [ ] Projects menu expands/collapses correctly
- [ ] Sidebar resize drag handle still works
- [ ] Sidebar collapse/expand button works

---

## Browser Compatibility

Test in:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (macOS/iOS)

---

## Acceptance Criteria

✅ **All 12 test cases pass**
✅ **All regression checks pass**
✅ **3 browsers tested**
✅ **No console errors**
✅ **Dark mode works**
✅ **Mobile responsive**

---

## Notes & Issues Found

(Document any bugs, unexpected behavior, or improvement suggestions here)
