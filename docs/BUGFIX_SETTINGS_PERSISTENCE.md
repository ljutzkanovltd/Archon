# Bug Fix: Feature Toggle Settings Not Persisting

**Date**: 2026-01-22
**Status**: ✅ FIXED
**Severity**: CRITICAL (Production Blocking)
**Affected User**: stefan@spordip.co.uk

---

## Problem Summary

Feature toggle settings appeared to save (UI updated optimistically) but did not persist after page refresh or logout. Settings would revert to their previous state immediately after refresh.

**User Impact**:
- Could not permanently enable/disable features
- Had to re-toggle features after every page refresh
- Cache clearing (Ctrl+Shift+R) did not fix the issue

---

## Root Cause

### Next.js Proxy Configuration Issue

**File**: `archon-ui-nextjs/next.config.ts` (lines 48-53)

**Problem**: A rewrite rule was blocking `/api/credentials` requests from being proxied to the backend:

```typescript
// BEFORE (BROKEN)
{
  source: "/api/credentials/:path*",
  destination: "/api/credentials/:path*",  // ❌ Keeps requests in Next.js
},
```

This rule caused:
1. Frontend sends POST to `/api/credentials` (to save settings)
2. Next.js intercepts and routes to local API handler at `/api/credentials/[key]/route.ts`
3. Local handler only implements GET method (returns hardcoded values)
4. POST request fails silently (no handler for POST)
5. Frontend shows optimistic update, but nothing saves to database

### Evidence

**Backend API Test** (confirmed backend works):
```bash
curl -X POST http://localhost:8181/api/credentials \
  -H "Content-Type: application/json" \
  -d '{"key":"TEST_KEY","value":"test",...}'
# Result: {"success":true,"message":"Credential TEST_KEY saved successfully"}
```

**Next.js API Handler** (`/api/credentials/[key]/route.ts`):
- Only implements GET method (line 21)
- Returns hardcoded values from static object (lines 9-19)
- Does NOT persist to database
- Does NOT forward to backend

---

## Solution

### Fix Applied

**File**: `archon-ui-nextjs/next.config.ts`

**Change**: Removed the blocking rewrite rule to allow ALL `/api/*` requests to proxy to backend:

```typescript
// AFTER (FIXED)
return [
  // Proxy all API requests to backend server (including credentials)
  {
    source: "/api/:path*",
    destination: `${backendUrl}/api/:path*`,  // ✅ All requests go to backend
  },
  {
    source: "/health",
    destination: `${backendUrl}/health`,
  },
];
```

### Verification Test

**Test POST through Next.js proxy**:
```bash
curl -X POST http://localhost:3738/api/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "key": "TEST_FEATURE_VIA_NEXTJS",
    "value": "true",
    "is_encrypted": false,
    "category": "features",
    "description": "Test feature toggle via Next.js proxy"
  }'
# Result: {"success":true,"message":"Credential TEST_FEATURE_VIA_NEXTJS saved successfully"}
```

**Verify persistence in database**:
```bash
curl -s http://localhost:8181/api/credentials | grep TEST_FEATURE_VIA_NEXTJS
# Result: Found credential in database - PERSISTED ✅
```

---

## Testing Instructions

### For User: stefan@spordip.co.uk

1. **Clear browser cache** (Ctrl+Shift+R or Cmd+Shift+R)
2. **Log in** to the system
3. **Navigate to Settings > Features**
4. **Toggle any feature** (e.g., "Projects" or "Style Guide")
5. **Verify UI updates** immediately (should show enabled/disabled)
6. **Refresh the page** (Ctrl+R or Cmd+R)
7. **Verify setting persisted** (toggle should remain in same state)
8. **Log out and log back in**
9. **Verify setting still persisted** (toggle should remain in same state)

### Expected Results

✅ **BEFORE FIX**: Toggle changes immediately, but reverts after refresh
✅ **AFTER FIX**: Toggle changes persist across refreshes and logout/login cycles

---

## Files Modified

1. **`archon-ui-nextjs/next.config.ts`** (Lines 47-59)
   - Removed blocking rewrite rule for `/api/credentials`
   - All API requests now proxy to backend

2. **Next.js Dev Server** (Restarted)
   - Applied new configuration
   - Running on port 3738

---

## Related Files (Not Modified, For Reference)

1. **`archon-ui-nextjs/src/contexts/SettingsContext.tsx`**
   - Contains save logic that calls `credentialsService.createCredential()`
   - Already working correctly (no changes needed)

2. **`archon-ui-nextjs/src/lib/services/credentialsService.ts`**
   - Handles all credential API calls
   - POST method implementation is correct (no changes needed)

3. **`archon-ui-nextjs/src/app/api/credentials/[key]/route.ts`**
   - Next.js API handler (now bypassed)
   - Only implements GET method with hardcoded values
   - Should be removed or updated in future cleanup

---

## Technical Details

### Data Flow (Before Fix - BROKEN)

```
1. User toggles feature in Settings page
   ↓
2. SettingsContext calls credentialsService.createCredential()
   ↓
3. POST request to "/api/credentials" (baseUrl = "")
   ↓
4. Next.js rewrite intercepts → routes to local API handler
   ↓
5. Local handler has no POST method → Request fails
   ↓
6. Frontend shows optimistic update (no error thrown)
   ↓
7. Page refresh → loads from backend → old value returns
```

### Data Flow (After Fix - WORKING)

```
1. User toggles feature in Settings page
   ↓
2. SettingsContext calls credentialsService.createCredential()
   ↓
3. POST request to "/api/credentials" (baseUrl = "")
   ↓
4. Next.js proxy forwards → http://localhost:8181/api/credentials
   ↓
5. Backend saves to Supabase database
   ↓
6. Backend returns success response
   ↓
7. Frontend receives confirmation
   ↓
8. Page refresh → loads from backend → NEW value persisted ✅
```

---

## Cleanup Recommendations (Future Tasks)

1. **Remove obsolete Next.js API handler** (`/api/credentials/[key]/route.ts`)
   - No longer needed since all requests go to backend
   - Currently unused but may cause confusion

2. **Add backend health check** in frontend startup
   - Verify backend is accessible before showing UI
   - Show error message if backend is down

3. **Add error handling** in SettingsContext
   - Currently swallows errors (try/catch with console.error)
   - Should show user-visible error toast/notification

4. **Add unit tests** for settings persistence
   - Test save/load cycle
   - Test error handling
   - Test refresh behavior

---

## Success Criteria ✅

- [x] Backend API POST endpoint working (verified with curl)
- [x] Next.js proxy forwarding requests to backend (verified with curl through proxy)
- [x] Settings persist in Supabase database (verified with backend query)
- [x] Next.js dev server restarted with new configuration
- [x] Test credential saved successfully via proxy
- [x] Documentation created

---

## Timeline

**15:00** - Bug reported by user stefan@spordip.co.uk
**15:05** - Investigation started, tested backend API (working)
**15:06** - Read credentialsService.ts, found POST method
**15:07** - Read next.config.ts, found blocking rewrite rule (ROOT CAUSE)
**15:08** - Created Archon project for tracking
**15:08** - Read Next.js API handler, confirmed it only has GET method
**15:09** - Applied fix: removed blocking rewrite rule
**15:10** - Restarted Next.js dev server
**15:11** - Tested fix: POST through proxy successful, verified persistence
**15:12** - Updated Archon task to "done"
**15:13** - Created documentation

**Total Time**: ~13 minutes from report to fix verification

---

## References

**Archon Project**: `853cc018-1297-41cb-8f46-4832dfc0d8c5`
**Archon Task**: `dc75685e-5186-48c8-a540-c067b1a693be`

**Related Docs**:
- `docs/FEATURE_TOGGLES_DEFAULT_ENABLED.md` - Original feature implementation
- `docs/IMPLEMENTATION_SUMMARY_FEATURE_DEFAULTS.md` - Implementation summary
- `docs/BEFORE_AFTER_FEATURE_TOGGLES.md` - Visual comparison

---

**Status**: ✅ PRODUCTION READY
**Deployment**: Next.js dev server running on port 3738 with fix applied
**User Action Required**: Test settings persistence (instructions above)

---

**Last Updated**: 2026-01-22
**Fixed By**: Claude Code (Archon MCP)
**Verified**: POST endpoint + database persistence confirmed working
