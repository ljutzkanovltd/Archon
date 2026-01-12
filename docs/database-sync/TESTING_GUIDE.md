# Database Sync UI - Integration Testing Guide

**Version:** 1.0.0
**Last Updated:** 2026-01-12
**Status:** Phase 7f - Integration Testing

---

## Overview

This guide provides comprehensive testing procedures for the Database Sync UI system, covering end-to-end sync operations, error handling, WebSocket resilience, and load testing.

---

## Test Environment Setup

### Prerequisites

1. **Both databases must be running:**
   ```bash
   # Local Supabase (via local-ai-packaged)
   docker ps | grep supabase-ai-db

   # Remote Supabase Cloud
   curl -I https://jnjarcdwwwycjgiyddua.supabase.co
   ```

2. **Backend API must be running:**
   ```bash
   curl http://localhost:8181/health
   # Expected: {"status":"healthy","service":"archon-api"}
   ```

3. **Frontend must be running:**
   ```bash
   curl http://localhost:3738
   # Or check browser: http://localhost:3738
   ```

4. **Create test data backup:**
   ```bash
   cd ~/Documents/Projects/archon
   bash scripts/pre-dangerous-operation-backup.sh
   ```

---

## Test Suite 1: End-to-End Sync Tests

### Test 1.1: Local-to-Remote Sync (Backup)

**Objective:** Verify complete sync from local to remote database

**Steps:**

1. **Navigate to Database Sync UI:**
   - Open: http://localhost:3738/database-sync

2. **Select Direction:**
   - Click "Local → Remote (Backup)" card
   - Verify direction is highlighted
   - Click "Continue to Pre-flight Checks"

3. **Verify Pre-flight Checks:**
   - ✅ Database Connectivity (Local + Remote)
   - ✅ Disk Space (Available vs Required)
   - ✅ Schema Version (Local vs Remote)
   - ✅ Backup Status (Latest backup timestamp)
   - Wait for auto-advance (1.5 seconds) or click "Continue"

4. **Safety Approval:**
   - Click "Review Safety Confirmations"
   - Read all 5 safety warnings
   - Check all 5 confirmation boxes
   - Type confirmation phrase exactly
   - Click "I Understand - Proceed with Sync"

5. **Monitor Progress:**
   - Verify connection status shows "WebSocket Connected" (green)
   - Watch phase indicators progress through 6 phases:
     1. Validation
     2. Export
     3. Preparation
     4. Import
     5. Finalization
     6. Verification
   - Monitor progress bar (0% → 100%)
   - Check "Current Activity" shows table names and row counts
   - Expand logs and verify log messages are streaming

6. **Verify Completion:**
   - Status icon: Green checkmark
   - Title: "Sync Completed Successfully!"
   - Metrics displayed:
     - Direction: Local → Remote
     - Rows Synced: (number)
     - Duration: (time)
   - Verification Results: All 4 checks passed
   - Next steps recommendations displayed

7. **Check Sync History:**
   - Click "View Sync History" button
   - Verify new record at top of table
   - Status: Completed (green badge)
   - Click "View" to see details
   - Verify all fields populated correctly

**Expected Result:** ✅ Sync completes successfully with all verification checks passed

**Rollback Procedure (if failed):**
```bash
cd ~/Documents/Projects/archon
gunzip -c /path/to/backup.sql.gz | docker exec -i supabase-ai-db psql -U postgres -d postgres
```

---

### Test 1.2: Remote-to-Local Sync (Restore)

**Objective:** Verify complete sync from remote to local database

**Steps:**

1. **Navigate to Database Sync UI**
2. **Select Direction:** "Remote → Local (Restore)"
3. **Complete Pre-flight Checks**
4. **Complete Safety Approval**
5. **Monitor Progress** (6 phases)
6. **Verify Completion**
7. **Check Sync History**

**Expected Result:** ✅ Sync completes successfully

**Critical Verification:**
```bash
# Verify local database has correct row counts
docker exec supabase-ai-db psql -U postgres -d postgres -c "
SELECT
  'archon_settings' as table, COUNT(*) as rows FROM archon_settings
UNION ALL
SELECT 'archon_projects', COUNT(*) FROM archon_projects
UNION ALL
SELECT 'archon_tasks', COUNT(*) FROM archon_tasks;
"
```

---

## Test Suite 2: Error Handling Scenarios

### Test 2.1: Database Connection Failure

**Objective:** Verify graceful handling of database connection errors

**Setup:**
```bash
# Stop local Supabase temporarily
docker stop supabase-ai-db
```

**Steps:**

1. Navigate to Database Sync UI
2. Select direction: Local → Remote
3. Click "Continue to Pre-flight Checks"

**Expected Result:**
- ❌ Pre-flight check fails with clear error message
- ⚠️ Warning displayed: "Failed to connect to backend API"
- ❌ Cannot proceed to next step (button disabled)

**Cleanup:**
```bash
# Restart Supabase
docker start supabase-ai-db
sleep 10  # Wait for initialization
```

---

### Test 2.2: Insufficient Disk Space

**Objective:** Verify handling of insufficient disk space warning

**Expected Result:**
- ⚠️ Warning displayed in pre-flight checks
- User can proceed (warning, not error)
- Recommended action displayed

---

### Test 2.3: Schema Version Mismatch

**Objective:** Verify handling of incompatible schema versions

**Expected Result:**
- ⚠️ Warning displayed if minor version difference
- ❌ Error if major version incompatibility
- Clear guidance on resolution

---

### Test 2.4: Mid-Sync Cancellation

**Objective:** Verify sync can be cancelled and rolled back

**Steps:**

1. Start a sync operation (Local → Remote)
2. Wait until "Import" phase (phase 4/6)
3. Click "Cancel Sync" button
4. Confirm cancellation in modal
5. Wait for cancellation to complete

**Expected Result:**
- ⚠️ Sync status: "Cancelled" (yellow)
- Automatic rollback triggered
- Target database restored to pre-sync state
- Cancellation summary displayed with:
  - "Sync Cancelled" heading
  - Explanation of rollback
  - What happened summary

**Verification:**
```bash
# Check sync history shows cancelled status
curl -s http://localhost:8181/api/database/sync/history | jq '.records[0].status'
# Expected: "cancelled"
```

---

## Test Suite 3: WebSocket Resilience

### Test 3.1: WebSocket Connection Loss

**Objective:** Verify automatic fallback to REST API polling

**Setup:**
```bash
# Block WebSocket port temporarily (requires sudo)
sudo iptables -A OUTPUT -p tcp --dport 3738 -j DROP
```

**Steps:**

1. Start a sync operation
2. Observe connection status changes from "WebSocket Connected" to "Polling Mode"
3. Verify progress updates continue (every 2 seconds)
4. Complete sync

**Expected Result:**
- ✅ Automatic fallback to polling
- ⚠️ Connection status shows "Polling Mode" (yellow)
- ✅ Sync continues and completes successfully

**Cleanup:**
```bash
# Remove iptables rule
sudo iptables -D OUTPUT -p tcp --dport 3738 -j DROP
```

---

### Test 3.2: WebSocket Reconnection

**Objective:** Verify WebSocket automatically reconnects after brief disconnection

**Steps:**

1. Start a sync operation (ensure WebSocket connected)
2. Briefly restart backend API:
   ```bash
   cd ~/Documents/Projects/archon
   docker-compose restart archon-api
   ```
3. Observe connection status
4. Verify reconnection within 30 seconds

**Expected Result:**
- ⚠️ Connection status briefly shows "Connecting..." (gray)
- ✅ Automatically reconnects: "WebSocket Connected" (green)
- ✅ Progress updates resume without data loss
- ✅ No duplicate progress updates

---

### Test 3.3: Multiple Reconnection Attempts

**Objective:** Verify exponential backoff and max retry logic

**Steps:**

1. Start a sync operation
2. Stop backend API completely:
   ```bash
   docker-compose stop archon-api
   ```
3. Observe reconnection attempts
4. Wait for 5 failed reconnection attempts
5. Verify fallback to polling mode

**Expected Result:**
- 🔄 Reconnection attempts with delays: 1s, 2s, 4s, 8s, 16s
- ⚠️ After 5 attempts: switches to "Polling Mode"
- ✅ Sync continues via REST API polling

**Cleanup:**
```bash
docker-compose start archon-api
```

---

## Test Suite 4: Data Integrity

### Test 4.1: Row Count Verification

**Objective:** Verify row counts match between source and target

**Steps:**

1. Complete a full sync (any direction)
2. Check completion summary verification results
3. Manually verify row counts:

```bash
# Local database
docker exec supabase-ai-db psql -U postgres -d postgres -c "
SELECT
  schemaname, tablename,
  (SELECT COUNT(*) FROM public.archon_settings) as archon_settings,
  (SELECT COUNT(*) FROM public.archon_projects) as archon_projects,
  (SELECT COUNT(*) FROM public.archon_tasks) as archon_tasks
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'archon_settings';
"

# Remote database (via pooler)
PGPASSWORD="iX5q1udmEe21xq6h" psql \
  -h aws-1-eu-west-2.pooler.supabase.com \
  -p 6543 \
  -U postgres.jnjarcdwwwycjgiyddua \
  -d postgres \
  -c "SELECT COUNT(*) FROM archon_settings;"
```

**Expected Result:**
- ✅ All verification checks passed
- ✅ Row counts match exactly

---

### Test 4.2: Data Content Verification

**Objective:** Verify actual data content matches

**Steps:**

1. Pick a sample record from source database:
   ```bash
   docker exec supabase-ai-db psql -U postgres -d postgres -c "
   SELECT id, title, status FROM archon_tasks LIMIT 1;
   "
   ```

2. After sync, verify same record in target database:
   ```bash
   PGPASSWORD="..." psql -h ... -c "
   SELECT id, title, status FROM archon_tasks WHERE id = 'YOUR_ID_HERE';
   "
   ```

**Expected Result:**
- ✅ Records match exactly (id, fields, values)

---

### Test 4.3: Foreign Key Integrity

**Objective:** Verify foreign key relationships preserved

**Steps:**

1. After sync, check foreign key constraints:
   ```bash
   docker exec supabase-ai-db psql -U postgres -d postgres -c "
   SELECT
     tc.table_name,
     tc.constraint_name,
     tc.constraint_type
   FROM information_schema.table_constraints tc
   WHERE tc.table_schema = 'public'
     AND tc.constraint_type = 'FOREIGN KEY'
     AND tc.table_name LIKE 'archon_%'
   ORDER BY tc.table_name;
   "
   ```

**Expected Result:**
- ✅ Constraint Validation check passed
- ✅ All foreign keys present and valid

---

## Test Suite 5: Performance & Load Testing

### Test 5.1: Large Dataset Sync

**Objective:** Verify sync handles large datasets efficiently

**Setup:**
```bash
# Add test data to local database
docker exec supabase-ai-db psql -U postgres -d postgres -c "
INSERT INTO archon_settings (key, value, category, description)
SELECT
  'TEST_KEY_' || generate_series(1, 10000),
  'test_value',
  'test_category',
  'Test setting for load testing'
ON CONFLICT (key) DO NOTHING;
"
```

**Steps:**

1. Start sync: Local → Remote
2. Monitor performance metrics:
   - Export duration
   - Import duration
   - Total duration
   - Rows synced per second

**Expected Result:**
- ✅ Sync completes successfully
- ✅ No memory errors
- ✅ No timeout errors
- ⏱️ Performance benchmarks:
  - Export: <5 seconds for 10K rows
  - Import: <30 seconds for 10K rows
  - Verification: <5 seconds

**Cleanup:**
```bash
docker exec supabase-ai-db psql -U postgres -d postgres -c "
DELETE FROM archon_settings WHERE key LIKE 'TEST_KEY_%';
"
```

---

### Test 5.2: Concurrent Sync Prevention

**Objective:** Verify only one sync can run at a time

**Steps:**

1. Start first sync operation (Local → Remote)
2. In new browser tab, try to start second sync
3. Verify prevention mechanism

**Expected Result:**
- ❌ Second sync cannot be started
- ⚠️ Error message: "Another sync is currently in progress"
- ✅ First sync completes uninterrupted

---

### Test 5.3: Progress Update Frequency

**Objective:** Verify progress updates are timely and accurate

**Steps:**

1. Start sync operation
2. Monitor time between progress updates
3. Check log message timestamps

**Expected Result:**
- ✅ WebSocket mode: Updates every 0.5-2 seconds
- ✅ Polling mode: Updates every 2 seconds
- ✅ Progress bar updates smoothly
- ✅ Current table/row counts update in real-time

---

## Test Suite 6: UI/UX Testing

### Test 6.1: Mobile Responsiveness

**Objective:** Verify UI works on mobile devices

**Steps:**

1. Open browser DevTools
2. Switch to mobile device view (iPhone, Android)
3. Navigate through sync wizard
4. Test all interactions

**Expected Result:**
- ✅ All steps visible and functional
- ✅ Buttons clickable and appropriately sized
- ✅ Tables scrollable horizontally
- ✅ Modal dialogs fit screen

---

### Test 6.2: Dark Mode

**Objective:** Verify dark mode styling

**Steps:**

1. Enable dark mode in system preferences
2. Reload application
3. Navigate through all sync steps

**Expected Result:**
- ✅ All text readable
- ✅ Proper contrast ratios
- ✅ No white flashes during transitions
- ✅ Icons and badges properly themed

---

### Test 6.3: Accessibility (WCAG)

**Objective:** Verify accessibility compliance

**Steps:**

1. Use screen reader (NVDA, JAWS, VoiceOver)
2. Navigate sync wizard with keyboard only (Tab, Enter, Space)
3. Check color contrast with browser extensions

**Expected Result:**
- ✅ All interactive elements keyboard accessible
- ✅ Screen reader announces all labels and statuses
- ✅ Color contrast meets WCAG AA standards
- ✅ Focus indicators visible

---

## Test Suite 7: Sync History

### Test 7.1: History Table Display

**Objective:** Verify sync history displays correctly

**Steps:**

1. Complete 3-5 sync operations (mix of completed/failed/cancelled)
2. Navigate to: http://localhost:3738/database-sync/history
3. Verify table displays all syncs

**Expected Result:**
- ✅ All syncs listed in reverse chronological order (newest first)
- ✅ Status badges color-coded correctly
- ✅ Pagination works (if >10 records)
- ✅ Sorting works on all columns
- ✅ Filters work (direction, status, search)

---

### Test 7.2: Sync Details Modal

**Objective:** Verify detailed sync information

**Steps:**

1. In sync history, click "View" on any record
2. Review all sections of modal
3. Test modal interactions

**Expected Result:**
- ✅ All metadata displayed correctly:
  - Sync ID, direction, duration
  - Started/completed timestamps
  - Rows synced, total rows
  - Triggered by user
  - Backup location
- ✅ Verification results (if completed)
- ✅ Error details (if failed)
- ✅ Close button works

---

### Test 7.3: CSV Export

**Objective:** Verify CSV export functionality

**Steps:**

1. Navigate to sync history
2. Apply filters (optional)
3. Click "Export CSV" button
4. Open downloaded file

**Expected Result:**
- ✅ CSV file downloads with timestamp in filename
- ✅ Contains all visible records (respects filters)
- ✅ All columns included
- ✅ Properly formatted (no extra quotes/escapes)
- ✅ Opens in Excel/Google Sheets without errors

---

## Test Suite 8: Error Recovery

### Test 8.1: Backend Crash During Sync

**Objective:** Verify recovery from backend crash

**Setup:**
```bash
# Kill backend during sync (brutal test)
docker kill archon-api
```

**Steps:**

1. Start sync operation
2. Wait until mid-sync (import phase)
3. Kill backend container
4. Wait 30-60 seconds
5. Restart backend:
   ```bash
   docker-compose start archon-api
   ```

**Expected Result:**
- ⚠️ Connection status shows "Connecting..." or "Polling Mode"
- ✅ Sync marked as "failed" in database
- ✅ Target database automatically rolled back
- ❌ Error message displayed with recovery instructions
- ✅ User can start new sync after backend recovers

---

### Test 8.2: Browser Refresh During Sync

**Objective:** Verify sync continues after browser refresh

**Steps:**

1. Start sync operation
2. Wait until mid-sync (any phase)
3. Refresh browser (F5)
4. Navigate back to /database-sync

**Expected Result:**
- ⚠️ Sync continues in background
- ℹ️ UI may not show live progress (sync ID lost)
- ✅ Sync completes successfully in database
- ✅ Visible in sync history after completion

---

## Test Result Tracking

### Test Execution Checklist

| Test ID | Test Name | Status | Notes | Date |
|---------|-----------|--------|-------|------|
| 1.1 | Local-to-Remote Sync | ⬜ | | |
| 1.2 | Remote-to-Local Sync | ⬜ | | |
| 2.1 | Database Connection Failure | ⬜ | | |
| 2.2 | Insufficient Disk Space | ⬜ | | |
| 2.3 | Schema Version Mismatch | ⬜ | | |
| 2.4 | Mid-Sync Cancellation | ⬜ | | |
| 3.1 | WebSocket Connection Loss | ⬜ | | |
| 3.2 | WebSocket Reconnection | ⬜ | | |
| 3.3 | Multiple Reconnection Attempts | ⬜ | | |
| 4.1 | Row Count Verification | ⬜ | | |
| 4.2 | Data Content Verification | ⬜ | | |
| 4.3 | Foreign Key Integrity | ⬜ | | |
| 5.1 | Large Dataset Sync | ⬜ | | |
| 5.2 | Concurrent Sync Prevention | ⬜ | | |
| 5.3 | Progress Update Frequency | ⬜ | | |
| 6.1 | Mobile Responsiveness | ⬜ | | |
| 6.2 | Dark Mode | ⬜ | | |
| 6.3 | Accessibility (WCAG) | ⬜ | | |
| 7.1 | History Table Display | ⬜ | | |
| 7.2 | Sync Details Modal | ⬜ | | |
| 7.3 | CSV Export | ⬜ | | |
| 8.1 | Backend Crash During Sync | ⬜ | | |
| 8.2 | Browser Refresh During Sync | ⬜ | | |

**Legend:**
- ⬜ Not Started
- 🔄 In Progress
- ✅ Passed
- ❌ Failed
- ⚠️ Blocked

---

## Performance Benchmarks

### Expected Performance Targets

| Operation | Dataset Size | Target Duration | Max Duration |
|-----------|--------------|-----------------|--------------|
| Export | 1K rows | <1s | 2s |
| Export | 10K rows | <5s | 10s |
| Export | 100K rows | <30s | 60s |
| Import | 1K rows | <5s | 10s |
| Import | 10K rows | <30s | 60s |
| Import | 100K rows | <180s | 300s |
| Verification | Any size | <5s | 10s |
| Pre-flight | N/A | <3s | 5s |

---

## Known Issues & Workarounds

### Issue 1: Dry-run verification shows 0 rows

**Symptom:** Row count verification fails in dry-run mode

**Cause:** Dry-run mode rolls back import transaction

**Workaround:** This is expected behavior; verification passes in actual sync

**Status:** Not a bug - expected behavior

---

### Issue 2: WebSocket connection fails behind corporate proxy

**Symptom:** Connection status stuck on "Connecting..."

**Cause:** Corporate proxy blocks WebSocket protocol

**Workaround:** System automatically falls back to REST API polling after 5 failed reconnection attempts

**Status:** Working as designed

---

## Test Automation (Future Phase)

### Playwright E2E Tests

```typescript
// test/e2e/database-sync.spec.ts
test('should complete local-to-remote sync', async ({ page }) => {
  await page.goto('http://localhost:3738/database-sync');

  // Select direction
  await page.click('text=Local → Remote');
  await page.click('text=Continue');

  // Wait for pre-flight
  await page.waitForSelector('text=Pre-Flight Checks');
  await page.click('text=Continue to Safety Approval');

  // Safety approval
  await page.check('input[type="checkbox"]');
  await page.fill('input[placeholder*="confirmation"]', 'I understand');
  await page.click('text=Proceed');

  // Wait for completion (max 5 minutes)
  await page.waitForSelector('text=Completed Successfully', { timeout: 300000 });

  // Verify
  expect(await page.textContent('.status-badge')).toBe('Completed');
});
```

---

## Appendix: Test Data

### Sample Test Datasets

**Small Dataset (Fast Tests):**
- 100 settings
- 5 projects
- 20 tasks
- Expected duration: <30 seconds

**Medium Dataset (Standard Tests):**
- 1,000 settings
- 50 projects
- 500 tasks
- Expected duration: 1-2 minutes

**Large Dataset (Load Tests):**
- 10,000 settings
- 500 projects
- 5,000 tasks
- Expected duration: 5-10 minutes

---

## Support & Troubleshooting

**For test failures:**

1. Check logs:
   ```bash
   docker-compose logs archon-api
   docker-compose logs archon-mcp
   ```

2. Check sync history in database:
   ```bash
   docker exec supabase-ai-db psql -U postgres -d postgres -c "
   SELECT * FROM archon_sync_history ORDER BY started_at DESC LIMIT 5;
   "
   ```

3. Verify services are healthy:
   ```bash
   curl http://localhost:8181/health
   curl http://localhost:8051/health
   ```

4. Check backup exists:
   ```bash
   ls -lh /path/to/backups/
   ```

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-12
**Maintained By:** Archon Team
