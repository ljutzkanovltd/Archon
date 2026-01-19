# Playwright Testing Guide for Sprint Workflow

## Overview

This directory contains Playwright-based tests for debugging and verifying the sprint management workflow, including authentication, sprint creation, and task assignment.

## Prerequisites

- Node.js 18+ installed
- Playwright installed (`npm install --save-dev @playwright/test playwright`)
- Chromium browser installed (`npx playwright install chromium`)
- Backend API running on `http://localhost:8181`
- Frontend running on `http://localhost:3738`

## Test Scripts

### 1. Sprint Workflow Test (`test-sprint-workflow.js`)

**Comprehensive end-to-end test covering:**
- User authentication (login)
- Navigation to project
- Sprint creation via modal
- Task assignment to sprint
- Verification across views

**Run:**
```bash
# With default credentials (admin@archon.dev / admin123)
node test-sprint-workflow.js

# With custom credentials
TEST_EMAIL=your@email.com TEST_PASSWORD=your_password node test-sprint-workflow.js
```

### 2. Sprint View Debug (`debug-sprint-view.js`)

**Quick debug script for sprint/timeline view issues:**
- Navigate to project
- Click timeline view
- Capture screenshots of errors

**Run:**
```bash
node debug-sprint-view.js
```

## Configuration

### Environment Variables

```bash
# Optional: Override test credentials
export TEST_EMAIL="admin@archon.dev"
export TEST_PASSWORD="your_admin_password"

# Run test
node test-sprint-workflow.js
```

### Test Users in Database

Available test users (check with):
```bash
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT email, full_name FROM archon_users;"
```

Current users:
- `admin@archon.dev` - Admin user (recommended for testing)
- `knowledge-test@example.com` - Knowledge base tester
- `test.user@example.com` - General test user
- `ljutzkanov@sporterp.co.uk` - Owner account

## Output

### Screenshots

All screenshots saved to `./test-screenshots/`:

**Sprint Workflow Test:**
- `01-login-page.png` - Login page loaded
- `02-login-form-filled.png` - Credentials entered
- `03-after-login.png` - Post-login state
- `04-project-page.png` - Project page loaded
- `05-no-sprint-button.png` - If sprint button not found
- `06-sprint-modal-open.png` - Sprint creation modal
- `07-sprint-form-filled.png` - Sprint form completed
- `08-sprint-created-success.png` - Sprint created successfully
- `09-after-sprint-creation.png` - Updated project view
- `10-timeline-view.png` - Timeline view with sprint
- `11-task-edit-modal.png` - Task edit modal
- `12-task-assigned.png` - Task assigned to sprint
- `13-final-state.png` - Final verification screenshot
- `error-final-state.png` - If test failed

### Videos

Recording saved to `./test-videos/` (full session replay)

### Network Logs

API calls logged to `./test-screenshots/network-log.json`:
```json
[
  {
    "method": "POST",
    "url": "http://localhost:8181/api/auth/login",
    "time": "2026-01-19T..."
  },
  {
    "method": "POST",
    "url": "http://localhost:8181/api/projects/.../sprints",
    "time": "2026-01-19T..."
  }
]
```

## Common Issues

### Issue 1: Login Redirects to Dashboard

**Symptom:** After login, redirected to dashboard instead of project page

**Cause:** Default redirect behavior

**Fix:** Test automatically navigates to project after login

### Issue 2: 401 Unauthorized on Sprint Creation

**Symptom:** Sprint creation fails with "Session expired" message

**Possible Causes:**
1. Token expired during test
2. Invalid credentials
3. Missing permissions
4. Backend Casbin RBAC not allowing action

**Debug:**
```bash
# Check if Casbin is available
docker logs archon-server 2>&1 | grep -i casbin

# Verify user has admin permissions
docker exec supabase-ai-db psql -U postgres -d postgres -c "
  SELECT email, is_active FROM archon_users WHERE email = 'admin@archon.dev';
"
```

**Fix:**
- Verify credentials in environment variables
- Check token is stored in localStorage (test captures this)
- Review backend logs during test run

### Issue 3: Sprint Modal Not Found

**Symptom:** "New Sprint button not found"

**Cause:** Button selector might have changed

**Fix:** Check project page UI for sprint creation button, update selector in test

### Issue 4: Timeline View Crash

**Symptom:** ErrorBoundary shown in timeline view

**Status:** ✅ FIXED (see `docs/TIMELINE_VIEW_CRASH_FIX_COMPLETE.md`)

**Validation:** Timeline view now shows proper empty state

## Debugging Tips

### 1. Run in Headed Mode

Test already runs in headed mode (browser visible) with `slowMo: 1000` for easy observation.

### 2. Extend Browser Open Time

Modify test to keep browser open longer:
```javascript
// Change in test script:
await page.waitForTimeout(30000); // 30 seconds instead of 10
```

### 3. Add Breakpoints

Add pauses during test:
```javascript
console.log('⏸️  Paused for inspection...');
await page.pause(); // Interactive debugger
```

### 4. Capture Additional Screenshots

Add more screenshot calls:
```javascript
await page.screenshot({ path: './test-screenshots/custom-debug.png', fullPage: true });
```

### 5. Check Backend Logs

During test run:
```bash
docker logs -f archon-server
```

Look for:
- `POST /api/projects/.../sprints`
- 401/403 errors
- Casbin permission checks

### 6. Inspect Network Traffic

Review `network-log.json` for failed API calls.

## Test Execution Flow

```
START
  ↓
1. Navigate to login page
  ↓
2. Check for existing token
  ↓ (if invalid/missing)
3. Fill login form
  ↓
4. Submit credentials
  ↓
5. Verify token stored
  ↓
6. Navigate to project
  ↓
7. Click "New Sprint" button
  ↓
8. Fill sprint form (name, dates, goal)
  ↓
9. Submit sprint creation
  ↓
10. Verify modal closes (success)
  ↓
11. Check timeline view
  ↓
12. Attempt task assignment
  ↓
13. Capture final screenshots
  ↓
END (✅ or ❌)
```

## Permissions Required

Sprint creation requires:
- **Authentication:** Valid JWT token
- **Permission:** `sprint:manage` in project (via Casbin RBAC)
- **Fallback:** If Casbin unavailable, allows all authenticated users (dev mode)

Check permission code: `python/src/server/auth/dependencies.py:306-335`

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Sprint Workflow E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install --with-deps chromium
      - run: |
          TEST_EMAIL=${{ secrets.TEST_EMAIL }} \
          TEST_PASSWORD=${{ secrets.TEST_PASSWORD }} \
          node test-sprint-workflow.js
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: |
            test-screenshots/
            test-videos/
```

## Maintenance

### Updating Selectors

If UI changes, update selectors in test scripts:

```javascript
// Old selector
const button = page.locator('button:has-text("New Sprint")');

// New selector (if button text changed)
const button = page.locator('button:has-text("Create New Sprint")');

// Or use data attributes (recommended)
const button = page.locator('[data-testid="create-sprint-button"]');
```

### Adding New Test Cases

1. Create new test file: `test-new-feature.js`
2. Use same structure as existing tests
3. Document in this README
4. Add to CI/CD pipeline

## Related Documentation

- **Sprint Creation Auth Fix:** `docs/SPRINT_CREATION_AUTH_FIX.md`
- **Sprint Organization:** `docs/SPRINT_ORGANIZATION_STRATEGY.md`
- **Timeline View Fix:** `docs/TIMELINE_VIEW_CRASH_FIX_COMPLETE.md`
- **Sprint Kanban Visibility:** `docs/SPRINT_KANBAN_VISIBILITY_FIX.md`

## Support

If tests fail:
1. Check screenshots in `./test-screenshots/`
2. Review video in `./test-videos/`
3. Check `network-log.json` for API errors
4. Review backend logs: `docker logs archon-server`
5. Consult related documentation listed above

---

**Last Updated:** 2026-01-19
**Playwright Version:** Latest
**Browser:** Chromium
