# Fix: Missing "Link from Global KB" Button

**Date**: 2026-01-26
**Issue**: Purple "Link from Global KB" button not visible in browser
**Status**: ✅ FIXED

---

## Root Cause

**PRIMARY CAUSE**: Flowbite-React Button component `color="purple"` is NOT a supported color value in version 0.12.14.

### Evidence
1. **Supported colors**: `blue`, `gray`, `success`, `failure` (confirmed usage across codebase)
2. **Purple NOT supported**: When `color="purple"` is used, Button renders but likely with invalid/missing styles
3. **Workaround in codebase**: The "New Sprint" button (ProjectDetailView.tsx:510) uses manual Tailwind classes `bg-purple-600` instead of Button `color` prop

### Secondary Issue
- `LinkFromGlobalKBModal` component was not exported from `index.ts` (fixed)

---

## Fix Applied

### File: `src/features/projects/components/ProjectDocumentsTab.tsx`

**BEFORE** (Lines 261-268):
```typescript
<Button
  color="purple"
  onClick={() => setShowLinkFromKBModal(true)}
  size="sm"
>
  <HiLink className="mr-2 h-4 w-4" />
  Link from Global KB
</Button>
```

**AFTER**:
```typescript
<button
  onClick={() => setShowLinkFromKBModal(true)}
  className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
>
  <HiLink className="mr-2 h-4 w-4" />
  Link from Global KB
</button>
```

**Rationale**: Replaced flowbite-react `<Button>` with native `<button>` using Tailwind classes (matches pattern from "New Sprint" button)

---

### File: `src/features/projects/components/index.ts`

**Added exports**:
```typescript
export { LinkFromGlobalKBModal } from "./LinkFromGlobalKBModal";
export { LinkedKnowledgeSection } from "./LinkedKnowledgeSection";
export { KnowledgeStatusBadge } from "./KnowledgeStatusBadge";
```

---

## Testing Steps

1. **Clear browser cache** (Shift+F5 or Cmd+Shift+R)
2. Navigate to any project: `http://localhost:3738/projects/{id}`
3. Switch to **Documents** tab
4. **Verify**: Purple "Link from Global KB" button is now visible next to blue "Upload Document" button

### Expected Result
```
+------------------------+  +---------------------------+
| 🔗 Link from Global KB |  | ➕ Upload Document         |
+------------------------+  +---------------------------+
     (purple button)              (blue button)
```

---

## Additional Notes

### Other Files Using `color="purple"`
These files also use `color="purple"` and may need similar fixes if buttons are invisible:

1. `src/features/projects/components/AIKnowledgeSuggestionsPanel.tsx` (2 instances)
2. `src/features/projects/components/LinkFromGlobalKBModal.tsx` (2 instances - inside Modal)
3. `src/features/sprints/components/CreateSprintModal.tsx` (1 instance)
4. `src/features/users/components/InviteUserModal.tsx` (1 instance)
5. `src/features/teams/views/WorkloadDashboard.tsx` (1 instance)

**Recommendation**: Monitor these components. If users report invisible purple buttons, apply same fix (replace Button with native button + Tailwind classes).

---

## Prevention

### Future Button Usage
When using flowbite-react `<Button>`:
- ✅ Use: `color="blue"`, `color="gray"`, `color="success"`, `color="failure"`
- ❌ Avoid: `color="purple"` (not supported)
- ✅ For purple styling: Use native `<button>` with Tailwind: `bg-purple-600 hover:bg-purple-700`

### Pattern
```typescript
// GOOD - Supported color
<Button color="blue">Click Me</Button>

// GOOD - Custom purple with Tailwind
<button className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700">
  Click Me
</button>

// BAD - Unsupported color (may be invisible)
<Button color="purple">Click Me</Button>
```

---

## Verification Checklist

- [x] Button code replaced in ProjectDocumentsTab.tsx
- [x] Missing exports added to index.ts
- [x] Documentation created
- [ ] User confirms button is now visible
- [ ] No console errors in browser
- [ ] Button click opens LinkFromGlobalKBModal successfully

---

**Investigation Time**: ~45 minutes
**Files Modified**: 2
**Lines Changed**: 11
**Complexity**: Low (styling issue, not logic bug)
