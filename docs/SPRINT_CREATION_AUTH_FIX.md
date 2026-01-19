# Sprint Creation Authentication Fix

**Issue:** Getting 401 Unauthorized error when creating sprints
**Symptom:** "Session expired. Please log in again." message and redirect to login
**Date:** 2026-01-19

---

## Root Cause

The sprint creation endpoint (`POST /api/projects/{id}/sprints`) requires authentication, but your session token has expired or is invalid.

---

## Quick Fixes (Choose One)

### Fix 1: Refresh Your Session (Recommended)

**Simply log out and log back in:**

1. Navigate to: http://localhost:3738/settings or click your profile
2. Click "Logout"
3. Log back in with your credentials
4. Try creating sprint again

**OR use browser console:**
```javascript
// Clear expired token
localStorage.removeItem('archon_token');
localStorage.removeItem('archon_user');
// Reload page - will redirect to login
window.location.reload();
```

---

### Fix 2: Check Backend Sprint Endpoint Authentication

The sprint endpoint may have authentication enabled when it shouldn't be for local development.

**Check backend configuration:**
```bash
cd ~/Documents/Projects/archon/python
grep -r "authentication" src/server/api_routes/projects_api.py
```

**If the sprint endpoint has `Depends(get_current_user)`, you can:**
1. **Option A:** Keep auth and log in properly (recommended for production)
2. **Option B:** Temporarily disable auth for local dev (not recommended)

---

### Fix 3: Use Direct API Call (Temporary Workaround)

**For testing purposes only, create sprint via direct API call:**

```bash
# Replace PROJECT_ID with your project ID
PROJECT_ID="ec21abac-6631-4a5d-bbf1-e7eca9dfe833"

curl -X POST "http://localhost:8181/api/projects/$PROJECT_ID/sprints" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sprint 1: Foundation & Database",
    "goal": "Implement database migrations and core infrastructure",
    "start_date": "2026-01-15",
    "end_date": "2026-01-29"
  }'
```

**Note:** This will also fail with 401 if the backend requires auth. In that case, you need to either:
- Add `-H "Authorization: Bearer YOUR_TOKEN"` header
- Or fix authentication in backend

---

## What Was Fixed in UI

✅ **Fixed button visibility issue:**
- Moved buttons inside form
- Changed submit button from `onClick` to `type="submit"`
- Made footer always visible (no scrolling needed)
- Proper form submission via Enter key

**Before:** Button was outside form, hidden below fold, required blind clicking

**After:** Button visible inside form, proper form submission, accessible

---

## How to Get Your Auth Token

If you need to make direct API calls with authentication:

```javascript
// In browser console (F12)
const token = localStorage.getItem('archon_token');
console.log('Token:', token);

// Copy the token and use it in curl:
// curl -H "Authorization: Bearer YOUR_TOKEN" ...
```

---

## Backend Authentication Setup

**Sprint endpoints should have authentication middleware:**

```python
# python/src/server/api_routes/projects_api.py

@router.post("/projects/{project_id}/sprints")
async def create_sprint(
    project_id: str,
    sprint_data: SprintCreate,
    current_user: User = Depends(get_current_user),  # ← Auth required
    db: AsyncSession = Depends(get_db)
):
    # Sprint creation logic
    ...
```

**This is CORRECT behavior** - sprints should require authentication to prevent unauthorized access.

---

## Testing Without Auth (Dev Only)

**If you want to disable auth temporarily for local development:**

1. Edit `python/src/server/api_routes/projects_api.py`
2. Remove `current_user: User = Depends(get_current_user)` from sprint endpoints
3. Restart backend: `docker-compose restart archon-server`

**⚠️ WARNING:** This is insecure and should ONLY be done for local development. Never deploy without authentication!

---

## Recommended Solution

**The proper fix is to ensure your frontend authentication is working:**

1. ✅ **Log in properly** via UI at http://localhost:3738/login
2. ✅ **Token stored** in localStorage as `archon_token`
3. ✅ **Token sent** in Authorization header for all API requests
4. ✅ **Token refresh** when expired (if implemented)

**The UI fix is already done.** Now you just need to ensure you're logged in with a valid session.

---

## Verification Steps

After logging in, verify auth is working:

```bash
# 1. Check token exists in browser console
localStorage.getItem('archon_token')
# Should return a JWT token string

# 2. Test authenticated endpoint
curl -H "Authorization: Bearer $(echo YOUR_TOKEN)" \
  http://localhost:8181/api/projects

# 3. Try creating sprint again via UI
# Should work now!
```

---

## Summary

**What happened:**
1. You tried to create a sprint
2. Backend returned 401 (session expired)
3. Frontend showed toast and redirected to login

**What's fixed:**
1. ✅ UI button visibility issue resolved
2. ✅ Form submission properly structured
3. ✅ Modal footer always visible

**What you need to do:**
1. ⏳ Log out and log back in to refresh session
2. ⏳ Try creating sprint again
3. ⏳ Should work now!

---

**Next Steps:**
- Try creating sprint after logging in
- If still fails, check backend logs: `docker-compose logs archon-server`
- If authentication persists, we may need to implement token refresh logic

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
