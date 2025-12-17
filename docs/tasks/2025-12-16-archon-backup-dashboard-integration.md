# Archon Backup Monitoring Dashboard Integration

**Date:** 2025-12-16
**Status:** Implementation Complete - Testing Blocked
**Project:** Archon Knowledge Base
**Feature:** Multi-source backup monitoring integration with AI Monitoring Dashboard

---

## Executive Summary

Successfully completed all 6 implementation phases for integrating Archon's backup system with the AI Monitoring Dashboard. The integration adds multi-source backup monitoring capabilities, displaying both Local AI Platform and Archon Knowledge Base backup status in a unified, stacked vertical layout with automatic alerting.

**Current Blocker:** Archon server startup issue (Supabase connection timeout) preventing final integration testing.

---

## Completed Tasks ✅

### Phase 1: Archon Backup API Endpoint ✅
**Status:** Complete
**Files Modified:**
- Created: `python/src/server/api_routes/backup_api.py` (369 lines)
- Modified: `python/src/server/main.py` (added backup router registration)

**Implementation:**
- REST API endpoint: `GET /api/backup/status`
- Additional endpoints: `/api/backup/list`, `/api/backup/health`
- Backup directory scanning with metadata extraction
- Health status calculation (healthy/aging/outdated/missing)
- Disk usage monitoring
- Response caching for performance

**API Response Format:**
```json
{
  "source": "archon",
  "latest_backup": "2025-12-16T14:43:00",
  "age_hours": 2.5,
  "size_bytes": 471859200,
  "size_human": "450.0 MB",
  "count": 8,
  "max_retention": 10,
  "health": "healthy",
  "health_message": "Backup is fresh (2.5h old)",
  "location": "/home/ljutzkanov/Documents/Projects/archon/backups",
  "disk_usage_percent": 45.3
}
```

**Health Thresholds:**
- Healthy: < 6 hours
- Aging: 6-24 hours
- Outdated: 24-48 hours
- Critical: > 48 hours

---

### Phase 2: Multi-Source Backup Metrics ✅
**Status:** Complete
**Files Modified:**
- Enhanced: `/home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/backup_metrics.py`

**Implementation:**
- Added `MultiSourceBackupMetrics` class
- API-based Archon status querying with 60-second caching
- Fallback to existing file-based metrics for Local AI
- Graceful degradation when Archon API unavailable
- Unified status aggregation for dashboard display

**Key Features:**
- Query Archon API: `http://localhost:8181/api/backup/status`
- Cache TTL: 60 seconds (reduces API load)
- Overall health calculation across all sources
- Summary generation for dashboard widgets

**Methods:**
- `query_archon_api()` - Fetch backup status with caching
- `get_all_sources_status()` - Aggregate multi-source data
- `get_overall_health()` - Calculate unified health status
- `get_summary()` - Generate dashboard-ready data

---

### Phase 3: Dashboard Widget Update ✅
**Status:** Complete
**Files Modified:**
- Enhanced: `/home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/lib/tui_widgets.py`

**Implementation:**
- Updated `BackupStatusPanel` for multi-source display
- Stacked vertical layout with visual separators
- Color-coded health indicators (green/yellow/red/gray)
- Compact 3-line format per source
- Overall health status summary

**Display Format:**
```
╭──────────────────────────────────╮
│ 📦 Backup Status                │
├──────────────────────────────────┤
│ 🔷 Local AI Platform            │
│   Last   4m ago  🟢              │
│   Size   3.3G                    │
│   Backups 5/5 backups            │
│ ───────────────────────────────  │
│ 🔶 Archon Knowledge Base        │
│   Last   1h ago  🟢              │
│   Size   450 MB                  │
│   Backups 8/10 backups           │
│ ───────────────────────────────  │
│ Overall  🟢 All Healthy          │
╰──────────────────────────────────╯
```

**Visual Indicators:**
- 🟢 Green: Healthy (< 6h)
- 🟡 Yellow: Aging (6-24h)
- 🔴 Red: Outdated (> 24h)
- ⚫ Gray: Missing

---

### Phase 4: Console Warnings & Log File Alerting ✅
**Status:** Complete
**Files Modified:**
- Enhanced: `/home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/lib/tui_widgets.py`

**Implementation:**
- Console warnings for critical backup issues
- Log file alerting to `/var/log/archon-monitoring.log`
- Fallback to `~/archon-monitoring.log` if `/var/log` not writable
- Alert triggered on yellow/red/gray health status

**Alert Features:**
- Red border for critical issues in dashboard
- Prominent "⚠ ALERT" message in widget
- Automatic logging with timestamps
- Error/Warning level based on severity

**Log Format:**
```
2025-12-16 16:00:00 - backup_alert_archon - ERROR - Archon Knowledge Base: CRITICAL - Backup outdated (36.5h old)
2025-12-16 16:00:00 - backup_alert_local-ai - WARNING - Local AI Platform: WARNING - Backup aging (18.2h old)
```

**Alert Conditions:**
- Red (ERROR): Outdated (> 24h) or Missing backups
- Yellow (WARNING): Aging backups (6-24h)
- Gray (ERROR): No backups found

---

### Phase 5: Dependency Auto-Installer ✅
**Status:** Complete
**Files Created:**
- Created: `/home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/install-monitor-deps.sh` (300 lines)

**Implementation:**
- Bash script for automated Python package installation
- User install attempt first (no sudo required)
- Fallback to system install with sudo
- Package verification and health checks
- Optional package installation (GPU monitoring)

**Required Packages:**
- textual (TUI framework)
- docker (Docker API)
- psutil (System monitoring)
- requests (HTTP client)
- pyyaml (YAML parsing)
- rich (Terminal formatting)

**Optional Packages:**
- GPUtil (GPU monitoring)

**Usage:**
```bash
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
./scripts/install-monitor-deps.sh           # Install all
./scripts/install-monitor-deps.sh --check   # Check status
./scripts/install-monitor-deps.sh --help    # Show help
```

**Features:**
- Checks existing installations
- Skips already-installed packages
- Interactive optional package prompt
- Installation verification
- Detailed usage instructions

---

### Phase 6: Documentation Updates ✅
**Status:** Complete
**Files Modified:**
- Updated: `/home/ljutzkanov/Documents/Projects/archon/.claude/CLAUDE.md` (added 217 lines)

**New Documentation Section:**
- AI Monitoring Dashboard Integration (lines 700-916)
- Dashboard access instructions
- Multi-source monitoring features
- Display format visualization
- API endpoint documentation
- Installation procedures
- Health status threshold table
- Troubleshooting guide
- Integration architecture diagram
- Monitoring commands reference

**Documentation Includes:**
- Complete API endpoint specs with example responses
- Installation guide for dashboard dependencies
- Health status color coding explanations
- Troubleshooting common integration issues
- Example curl commands for API testing
- Dashboard launch instructions

---

## Pending Tasks ⚠️

### Phase 7: Integration Testing ⚠️
**Status:** Blocked by Archon startup issue
**Blocker:** Archon server container fails to start with `httpx.ConnectTimeout`

**Root Cause:**
- Container cannot connect to `http://host.docker.internal:18000` (Supabase Kong gateway)
- Connection timeout during credential service initialization
- Error in `credential_service.py` line 754

**Testing Plan (Once Resolved):**
1. ✅ Restart Archon server after configuration fix
2. ⏳ Test backup API endpoint: `curl http://localhost:8181/api/backup/status`
3. ⏳ Test multi-source metrics: `python3 scripts/backup_metrics.py`
4. ⏳ Launch dashboard: `./scripts/monitor-tui.py`
5. ⏳ Verify stacked vertical display shows both sources
6. ⏳ Test console warnings with aged backups
7. ⏳ Verify log file alerts in `/var/log/archon-monitoring.log`
8. ⏳ Perform end-to-end integration validation

### Phase 8: Fix Archon Server Startup Issue ⚠️
**Status:** Troubleshooting in progress
**Priority:** HIGH (blocks all testing)

**Identified Issue:**
- `SUPABASE_URL=http://host.docker.internal:18000` causing timeout
- Network connectivity problem between archon-server and Supabase Kong

**Proposed Solution (Pending Approval):**
```bash
# Change .env file line 3
# OLD: SUPABASE_URL=http://host.docker.internal:18000
# NEW: SUPABASE_URL=http://supabase-ai-kong:8000
```

**Rationale:**
- Both containers on `localai_default` network
- Direct container-to-container communication faster
- Eliminates host routing overhead
- Same pattern as `DATABASE_URI` (uses `supabase-ai-db:5432`)
- Port 8000 on host is protected for SportERP (container port is separate namespace)

**Test Evidence:**
- ❌ `host.docker.internal:18000` → Connection timeout
- ✅ `supabase-ai-kong:8000` → HTTP 401 (reachable, needs auth header)

**Next Steps:**
1. Update `.env` file with correct SUPABASE_URL
2. Restart Archon services: `docker compose down && docker compose up -d`
3. Monitor startup logs: `docker compose logs -f archon-server`
4. Verify health: `docker ps --filter "name=archon"`
5. Test API: `curl http://localhost:8181/api/backup/status`

---

## Files Modified Summary

### New Files Created (2)
1. `/home/ljutzkanov/Documents/Projects/archon/python/src/server/api_routes/backup_api.py` (369 lines)
2. `/home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/install-monitor-deps.sh` (300 lines)

### Existing Files Modified (3)
1. `/home/ljutzkanov/Documents/Projects/archon/python/src/server/main.py`
   - Added backup router import and registration

2. `/home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/backup_metrics.py`
   - Added `MultiSourceBackupMetrics` class
   - Enhanced with API querying capability

3. `/home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/lib/tui_widgets.py`
   - Updated `BackupStatusPanel` for multi-source display
   - Added alerting functionality
   - Enhanced rendering logic

4. `/home/ljutzkanov/Documents/Projects/archon/.claude/CLAUDE.md`
   - Added 217 lines of integration documentation

---

## Technical Architecture

### Data Flow
```
┌─────────────────────────────────────────────┐
│ Archon Backup System                        │
├─────────────────────────────────────────────┤
│ 1. Daily cron backup (2:00 AM)              │
│    └─ Creates: archon_postgres-*.dump       │
│                                              │
│ 2. Backup API (FastAPI)                     │
│    └─ Scans: /archon/backups/               │
│    └─ Returns: Backup metadata + health     │
└─────────────────────────────────────────────┘
         ↓ HTTP GET /api/backup/status
┌─────────────────────────────────────────────┐
│ Multi-Source Backup Metrics                 │
├─────────────────────────────────────────────┤
│ 1. Query Archon API (60s cache)             │
│ 2. Query Local AI (file-based)              │
│ 3. Aggregate status                          │
│ 4. Calculate overall health                  │
└─────────────────────────────────────────────┘
         ↓ get_summary()
┌─────────────────────────────────────────────┐
│ AI Monitoring Dashboard (Textual TUI)       │
├─────────────────────────────────────────────┤
│ BackupStatusPanel (Top-Right)               │
│ ├─ 🔷 Local AI Platform                     │
│ ├─ 🔶 Archon Knowledge Base                 │
│ └─ Overall Health                            │
│                                              │
│ Alerting:                                    │
│ ├─ Console warnings (red border)            │
│ └─ Log file: /var/log/archon-monitoring.log │
└─────────────────────────────────────────────┘
```

### Network Architecture
```
┌─────────────────────────────────────────┐
│ localai_default Network (172.18.x)      │
├─────────────────────────────────────────┤
│ supabase-ai-kong:8000 (172.18.0.32)     │
│   ↓ Port mapping to host                │
│ Host: 0.0.0.0:18000→container:8000      │
│                                          │
│ archon-server (needs to connect)        │
│   ↓ Should use: supabase-ai-kong:8000   │
│   ✗ Currently: host.docker.internal:18000│
└─────────────────────────────────────────┘
```

---

## API Reference

### Backup Status Endpoint
```bash
GET http://localhost:8181/api/backup/status
```

**Response Fields:**
- `source` (string): "archon"
- `latest_backup` (string|null): ISO timestamp of latest backup
- `age_hours` (float|null): Hours since last backup
- `size_bytes` (int|null): Latest backup size in bytes
- `size_human` (string|null): Human-readable size (e.g., "450.0 MB")
- `count` (int): Number of backups
- `max_retention` (int): Maximum retention count (10)
- `health` (string): "healthy"|"aging"|"outdated"|"missing"
- `health_message` (string): Human-readable health description
- `location` (string): Backup directory path
- `disk_usage_percent` (float|null): Disk usage percentage

### Additional Endpoints
```bash
GET /api/backup/list     # List all backups with details
GET /api/backup/health   # Quick boolean health check
```

---

## Installation Instructions

### Prerequisites
1. Archon services running
2. Local AI monitoring dashboard installed
3. Python 3.8+

### Install Dashboard Dependencies
```bash
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
./scripts/install-monitor-deps.sh
```

### Launch Dashboard
```bash
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
./scripts/monitor-tui.py
```

**Expected Display:**
- Top-right panel shows "📦 Backup Status"
- Two sources stacked vertically:
  - 🔷 Local AI Platform
  - 🔶 Archon Knowledge Base
- Color-coded health indicators
- Overall health status at bottom

---

## Troubleshooting

### Issue: Dashboard shows "Archon: Missing"
**Cause:** Archon server not running or API unreachable

**Solution:**
```bash
# Check Archon status
docker ps --filter "name=archon"

# Check API
curl http://localhost:8181/api/backup/status

# Restart if needed
cd /home/ljutzkanov/Documents/Projects/archon
./start-archon.sh
```

### Issue: No alerts appearing
**Cause:** Log file not writable or backup status healthy

**Solution:**
```bash
# Check log file
tail -f /var/log/archon-monitoring.log
# Or fallback location
tail -f ~/archon-monitoring.log

# Force alert by aging a backup (test only)
touch -d "30 hours ago" backups/archon_postgres-test.dump
```

### Issue: Archon server won't start
**Cause:** Supabase connection timeout

**Solution:** See "Phase 8: Fix Archon Server Startup Issue" section above

---

## Future Enhancements (Optional)

### Monitoring Improvements
- [ ] Email/Slack notifications for critical backup failures
- [ ] Backup size trend analysis and growth predictions
- [ ] Automatic backup verification/restore testing
- [ ] Integration with Prometheus/Grafana for metrics

### API Enhancements
- [ ] Backup creation endpoint (POST /api/backup/create)
- [ ] Backup restoration endpoint (POST /api/backup/restore)
- [ ] Backup deletion endpoint (DELETE /api/backup/{filename})
- [ ] Webhook support for backup events

### Dashboard Features
- [ ] Historical backup trend graphs
- [ ] Per-table backup size breakdown
- [ ] Backup success/failure statistics
- [ ] Interactive backup management

---

## References

### Documentation
- Archon CLAUDE.md: `/home/ljutzkanov/Documents/Projects/archon/.claude/CLAUDE.md`
- Network Architecture: `/home/ljutzkanov/Documents/Projects/archon/docs/NETWORK_ARCHITECTURE_AND_DATABASE_CONNECTION.md`
- Backup Script: `/home/ljutzkanov/Documents/Projects/archon/scripts/backup-archon.sh`
- Restore Script: `/home/ljutzkanov/Documents/Projects/archon/scripts/restore-archon.sh`

### Key Files
- Backup API: `python/src/server/api_routes/backup_api.py`
- Metrics: `local-ai-packaged/scripts/backup_metrics.py`
- Widget: `local-ai-packaged/scripts/lib/tui_widgets.py`
- Dashboard: `local-ai-packaged/scripts/monitor-tui.py`

---

## Contact & Support

**Issues:** Report in `/home/ljutzkanov/Documents/Projects/archon/docs/tasks/`
**Testing Status:** Pending resolution of Archon startup issue
**Last Updated:** 2025-12-16

---

**Status Legend:**
- ✅ Complete
- ⏳ Pending Testing
- ⚠️ Blocked/In Progress
- ❌ Failed/Not Started
