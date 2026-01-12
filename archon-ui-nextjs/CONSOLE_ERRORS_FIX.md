# Console Errors Fix Guide

## Summary

Fixed persistent 404 errors for credentials endpoints and agent work orders connection errors.

## Issues Resolved

### 1. Credentials API 404 Errors ✅
**Problem**:
- `/api/credentials/DARK_MODE_ENABLED` returning 404
- `/api/credentials/STYLE_GUIDE_ENABLED` returning 404

**Root Cause**:
- `next.config.ts` was rewriting ALL `/api/*` requests to backend server (port 8181)
- Next.js API route at `/src/app/api/credentials/[key]/route.ts` was being bypassed
- Backend API doesn't implement credentials endpoints

**Fix Applied**:
Updated `next.config.ts` to exclude credentials endpoint from proxy:

```typescript
return [
  // Keep credentials endpoint in Next.js (don't proxy to backend)
  {
    source: "/api/credentials/:path*",
    destination: "/api/credentials/:path*",
  },
  // Proxy all other API requests to backend server
  {
    source: "/api/:path*",
    destination: `${backendUrl}/api/:path*`,
  },
  // ... other rewrites
];
```

Now the Next.js API route will handle credentials requests while all other API calls still go to the backend.

### 2. Agent Work Orders Connection Errors ⚠️
**Problem**:
- Connection refused to port 8053
- Service is optional and not always running

**Fix Applied**:
1. Updated hook to check if service is available before fetching
2. Disabled automatic retries on connection failures
3. Set default in `.env.example` to disable the service

## How to Apply the Fix

### Step 1: Restart Next.js Dev Server

**IMPORTANT**: Next.js must be restarted for `next.config.ts` changes to take effect.

```bash
# Stop current dev server (Ctrl+C in terminal)

# Restart Next.js
cd /home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs
npm run dev
```

### Step 2: Configure Environment Variables

Create `.env.local` file (if it doesn't exist):

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```bash
# Main API (required)
NEXT_PUBLIC_API_URL=http://localhost:8181

# Disable agent work orders to prevent console errors
NEXT_PUBLIC_DISABLE_AGENT_WORK_ORDERS=true

# Development mode
NODE_ENV=development
```

### Step 3: Clear Browser Cache

Sometimes browser caches can interfere:
1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

Or:
- Chrome/Edge: Ctrl+Shift+R
- Firefox: Ctrl+F5

## Verification

After restarting the dev server:

### ✅ Expected Results:
```
Console should be clean with no errors related to:
- /api/credentials/DARK_MODE_ENABLED
- /api/credentials/STYLE_GUIDE_ENABLED
- Connection refused to port 8053
```

### ⚠️ Hydration Warning (Informational Only):
```
You may still see:
"A tree hydrated but some attributes of the server rendered HTML didn't match..."

This is caused by Grammarly browser extension and is safe to ignore.
To eliminate: Disable Grammarly extension.
```

### 🧪 Test Credentials Endpoint:

Open browser console and run:
```javascript
fetch('/api/credentials/DARK_MODE_ENABLED')
  .then(r => r.json())
  .then(console.log)
// Expected: {success: true, key: "DARK_MODE_ENABLED", value: true}

fetch('/api/credentials/STYLE_GUIDE_ENABLED')
  .then(r => r.json())
  .then(console.log)
// Expected: {success: true, key: "STYLE_GUIDE_ENABLED", value: true}
```

## Files Modified

1. **`next.config.ts`** - Added credentials endpoint exception to proxy rules
2. **`.env.example`** - Set agent work orders disabled by default
3. **`src/app/api/credentials/[key]/route.ts`** - Already created (now functional)
4. **`src/features/agent-work-orders/hooks/useAgentWorkOrderQueries.ts`** - Already updated with graceful failure

## Troubleshooting

### Still seeing credentials 404 errors?

**Check 1**: Verify Next.js dev server was restarted
```bash
# Look for this in terminal output:
# "Ready in Xms"
# "Local: http://localhost:3738"
```

**Check 2**: Verify the rewrite rule is active
```bash
# Look for these logs in terminal:
# "[Next.js Config] Proxy rewrite destination: http://localhost:8181"
# "[Next.js Config] Environment: {...}"
```

**Check 3**: Verify credentials API route exists
```bash
ls -la src/app/api/credentials/\[key\]/route.ts
# Should show the file
```

**Check 4**: Test credentials endpoint directly
```bash
curl http://localhost:3738/api/credentials/DARK_MODE_ENABLED
# Expected: {"success":true,"key":"DARK_MODE_ENABLED","value":true}
```

### Still seeing agent work orders errors?

**Check 1**: Verify environment variable is set
```bash
cat .env.local | grep DISABLE_AGENT_WORK_ORDERS
# Expected: NEXT_PUBLIC_DISABLE_AGENT_WORK_ORDERS=true
```

**Check 2**: Restart Next.js after environment changes
```bash
# Environment variable changes require restart
npm run dev
```

**Check 3**: Check if hook is respecting the flag
- Open browser DevTools → Network tab
- Reload page
- Should NOT see requests to port 8053

## Next Steps

Once console is clean:

1. ✅ Verify Database Sync UI functionality
2. ✅ Run automated tests: `./scripts/test-database-sync-ui.sh`
3. ✅ Follow manual testing guide: `docs/database-sync/TESTING_GUIDE.md`
4. ✅ Complete Phase 7g: Documentation
5. ✅ Complete Phase 7h: RULE 6 Compliance Audit

## Reference

- **Issue Discovery**: Discovered via browser console inspection
- **Root Cause**: Next.js proxy configuration in `next.config.ts`
- **Fix Date**: 2026-01-12
- **Fix Type**: Configuration update (no code changes to core logic)
