# Backup Procedures - Archon Knowledge Base

Complete backup, monitoring, and disaster recovery procedures for Archon.

---

## Automated Backup System

**Strategy**: Archon uses automated daily backups with retention policies, monitoring, and disaster recovery procedures.

### Backup Configuration

**Location**: `/home/ljutzkanov/Documents/Projects/archon/backups/`
**Format**: PostgreSQL custom format (`pg_dump -Fc`)
**Naming**: `archon_postgres-YYYYMMDD_HHMMSS.dump`
**Retention**: Last 10 backups (configurable)
**Schedule**: Daily at 2:00 AM (via systemd timer)

### Backup Scripts

**Create Backup**:
```bash
# Manual backup
./scripts/backup-archon.sh

# With options
./scripts/backup-archon.sh --retention 20 --verbose

# Check backup status
ls -lh backups/archon_postgres-*.dump
```

**Restore from Backup**:
```bash
# List available backups
./scripts/restore-archon.sh --list

# Restore latest backup
./scripts/restore-archon.sh --latest

# Restore specific backup
./scripts/restore-archon.sh --backup backups/archon_postgres-20251216_020000.dump

# Dry-run (test without executing)
./scripts/restore-archon.sh --backup <file> --dry-run
```

**Features**:
- ✅ Automatic safety backup before restore
- ✅ Validation of backup integrity
- ✅ Rollback capability if restore fails
- ✅ Verification of all 11 Archon tables
- ✅ Retention policy management

### Installing Automated Backups

**1. Install systemd timer** (one-time setup):
```bash
# Install backup timer and service units
sudo ./scripts/install-systemd-units.sh

# Verify installation
systemctl status archon-backup.timer
systemctl list-timers archon-backup.timer
```

**2. Monitor backup execution**:
```bash
# View logs
journalctl -u archon-backup.service -f

# Check last run
systemctl status archon-backup.service

# Manually trigger backup
sudo systemctl start archon-backup.service
```

**3. Customize schedule** (optional):
Edit `/etc/systemd/system/archon-backup.timer` and reload:
```bash
sudo systemctl daemon-reload
sudo systemctl restart archon-backup.timer
```

---

## Monitoring & Alerting

### Database Size Monitoring

**Script**: `/scripts/monitor-db-size.sh`
**Log File**: `/var/log/archon-monitoring.log`
**Metrics**: `/logs/metrics/db-size-YYYYMM.csv`

**Features**:
- Daily database size tracking
- Individual table size monitoring
- Growth rate analysis (7-day trends)
- Threshold alerts (80MB warning, 100MB critical)
- Historical metrics in CSV format

**Run Monitoring**:
```bash
# Manual execution
./scripts/monitor-db-size.sh

# View metrics
tail -f /var/log/archon-monitoring.log

# Analyze trends
cat logs/metrics/db-size-$(date +%Y%m).csv
```

**Configure via Environment**:
```bash
# Set thresholds
export ALERT_THRESHOLD_MB=150
export WARNING_THRESHOLD_MB=120
export GROWTH_ALERT_MB_PER_DAY=10

# Run with custom settings
./scripts/monitor-db-size.sh
```

### Automated Restore Testing

**Script**: `/scripts/test-restore-archon.sh`
**Schedule**: First Sunday of each month at 4:00 AM (recommended)
**Log Location**: `/logs/restore-test-YYYYMMDD_HHMMSS.log`

**What it does**:
1. Finds latest backup
2. Creates temporary test database
3. Restores backup to test database
4. Validates all 11 Archon tables exist
5. Checks data integrity (row counts)
6. Compares with production database
7. Cleans up test database
8. Generates test report

**Run Test**:
```bash
# Manual execution
./scripts/test-restore-archon.sh

# View test results
tail -100 logs/restore-test-*.log | less
```

**Schedule Automated Testing**:
```bash
# Add to crontab (first Sunday at 4 AM)
sudo crontab -e

# Add line:
0 4 1 * * /home/ljutzkanov/Documents/Projects/archon/scripts/test-restore-archon.sh
```

### Log Rotation

**Configuration**: `/etc/logrotate.d/archon-monitoring`

**Install logrotate**:
```bash
# One-time setup
sudo ./scripts/install-logrotate.sh

# Test configuration
sudo logrotate -d /etc/logrotate.d/archon-monitoring

# Force rotation (for testing)
sudo logrotate -f /etc/logrotate.d/archon-monitoring
```

**Retention Policies**:
- Main logs: 30 days (daily rotation)
- Restore test logs: 12 weeks (weekly rotation)
- Metrics: 24 months (monthly rotation)

---

## Disaster Recovery

**Runbook**: Complete disaster recovery procedures for Archon Knowledge Base

### Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** | 30 min - 4 hours | Recovery Time Objective |
| **RPO** | 24 hours | Recovery Point Objective |

### Key Scenarios

**1. Accidental Data Deletion** (RTO: 30 min)
```bash
# Restore from yesterday's backup
./scripts/restore-archon.sh --backup backups/archon_postgres-YESTERDAY.dump
```

**2. Database Corruption** (RTO: 1 hour)
```bash
# Stop services, restore, restart
./stop-archon.sh
./scripts/restore-archon.sh --latest
./start-archon.sh
```

**3. Complete Database Loss** (RTO: 2-4 hours)
```bash
# Recreate infrastructure and restore
cd ~/Documents/Projects/local-ai-packaged
docker compose up -d supabase-ai-db

cd ~/Documents/Projects/archon
./scripts/restore-archon.sh --latest
./start-archon.sh
```

### Testing Schedule

- **Daily**: Automated backups at 2 AM
- **Monthly**: Restore testing (first Sunday at 4 AM)
- **Quarterly**: Full disaster recovery drill

### Quick Recovery Commands

```bash
# Emergency backup (before risky operation)
./scripts/backup-archon.sh --backup-dir backups/emergency

# List recent backups
ls -lth backups/ | head -5

# Quick restore check
./scripts/restore-archon.sh --latest --dry-run

# Full system health check
docker ps | grep -E "supabase-ai-db|archon"
curl http://localhost:8181/health
curl http://localhost:8051/health
./scripts/monitor-db-size.sh
```

### Monitoring Best Practices

**Daily**:
- ✅ Check backup execution in systemd logs
- ✅ Monitor database size trends
- ✅ Review application logs for errors

**Weekly**:
- ✅ Verify backup files are not corrupt
- ✅ Check disk space in backup directory
- ✅ Review monitoring alerts

**Monthly**:
- ✅ Run automated restore test
- ✅ Review test results and logs
- ✅ Verify RTO/RPO targets are met
- ✅ Update disaster recovery runbook if needed

**Quarterly**:
- ✅ Perform full disaster recovery drill
- ✅ Test complete database loss scenario
- ✅ Review and update procedures
- ✅ Train team on recovery processes

---

## AI Monitoring Dashboard Integration

**Overview**: Archon backups are now integrated with the Local AI Monitoring Dashboard for unified backup status monitoring.

### Dashboard Access

**Location**: `/home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/monitor-tui.py`
**Launch**: `cd local-ai-packaged && ./scripts/monitor-tui.py`
**Backup Panel**: Top-right corner (Panel 3)

### Features

**Multi-Source Monitoring**:
- ✅ Local AI Platform backups (directory-based)
- ✅ Archon Knowledge Base backups (via API)
- ✅ Aggregate health status across both sources

**Display Format** (Stacked Vertical):
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

**Alerting System**:
- 🔴 **Console Warnings**: Prominent alerts in dashboard for critical issues
- 📝 **Log File Alerts**: Written to `/var/log/archon-monitoring.log`
- 🔔 **Visual Indicators**: Red border + ⚠ icon for outdated backups

### API Endpoints

Archon exposes backup status via REST API for dashboard integration:

**Main Status Endpoint**:
```bash
GET http://localhost:8181/api/backup/status

# Response
{
  "source": "archon",
  "latest_backup": "2025-12-16T15:45:42",
  "age_hours": 1.2,
  "size_bytes": 471859200,
  "size_human": "450.0 MB",
  "count": 8,
  "max_retention": 10,
  "health": "healthy",
  "health_message": "Backup is fresh (1.2h old)",
  "location": "/home/ljutzkanov/Documents/Projects/archon/backups",
  "disk_usage_percent": 45.3
}
```

**Additional Endpoints**:
- `GET /api/backup/list` - List all available backups with details
- `GET /api/backup/health` - Quick boolean health check

### Installation

**1. Install Dashboard Dependencies**:
```bash
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
./scripts/install-monitor-deps.sh

# Or check if already installed
./scripts/install-monitor-deps.sh --check
```

**2. Verify Integration**:
```bash
# Test Archon API
curl http://localhost:8181/api/backup/status | jq

# Launch dashboard
./scripts/monitor-tui.py
```

**3. View Backup Logs**:
```bash
# Monitor alerts in real-time
tail -f /var/log/archon-monitoring.log

# Example log entries:
# [2025-12-16 15:45:42] [INFO] Archon Knowledge Base: Backup is fresh (1.2h old)
# [2025-12-16 16:30:15] [WARNING] Archon Knowledge Base: Backup aging (7.5h old)
# [2025-12-16 18:00:00] [ERROR] Archon Knowledge Base: CRITICAL - Backup outdated (25h old)
```

### Health Status Thresholds

| Status | Age | Color | Icon | Action |
|--------|-----|-------|------|--------|
| **Healthy** | < 6 hours | Green | 🟢 | None |
| **Aging** | 6-24 hours | Yellow | 🟡 | Monitor |
| **Outdated** | 24-48 hours | Red | 🔴 | Alert + Log |
| **Critical** | > 48 hours | Red | 🔴 | Alert + Log |
| **Missing** | No backup | Gray | ⚫ | Alert + Log |

### Troubleshooting Integration

**Problem**: Dashboard shows Archon status as "Missing"

**Solution**:
```bash
# 1. Verify Archon API is running
curl http://localhost:8181/api/backup/status

# 2. Check if backups exist
ls -lh ~/Documents/Projects/archon/backups/archon_postgres-*.dump

# 3. Restart Archon server to load new API endpoint
cd ~/Documents/Projects/archon
docker compose restart archon-server

# 4. Wait 60 seconds for API cache to refresh
```

**Problem**: Dashboard not showing backup panel

**Solution**:
```bash
# Install missing dependencies
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
./scripts/install-monitor-deps.sh

# Required packages:
# - textual (dashboard framework)
# - requests (API calls)
# - docker, psutil, pyyaml, rich
```

**Problem**: "Permission denied" on log file

**Solution**:
```bash
# Create log file with correct permissions
sudo touch /var/log/archon-monitoring.log
sudo chown ljutzkanov:ljutzkanov /var/log/archon-monitoring.log
sudo chmod 640 /var/log/archon-monitoring.log

# Or dashboard will fallback to ~/archon-monitoring.log
```

### Integration Architecture

```
┌──────────────────────────────────────┐
│  AI Monitoring Dashboard (TUI)       │
│  Port: Terminal UI                   │
├──────────────────────────────────────┤
│  - GPUMemoryPanel (top-left)         │
│  - LLMPerformancePanel (top-mid)     │
│  - BackupStatusPanel (top-right) ⭐  │
│  - ServiceStatusGrid (bottom-left)   │
│  - ServiceLinksPanel (bottom-right)  │
└──────────────────────────────────────┘
                ↓
    ┌───────────────────────────┐
    │  Multi-Source Metrics     │
    │  (backup_metrics.py)      │
    ├───────────────────────────┤
    │  - Local AI: File-based   │
    │  - Archon: API-based      │
    │  - Caching: 60s TTL       │
    │  - Alerting: Console+Log  │
    └───────────────────────────┘
                ↓
    ┌───────────────────────────┐
    │  Archon Backup API        │
    │  Port: 8181               │
    ├───────────────────────────┤
    │  GET /api/backup/status   │
    │  GET /api/backup/list     │
    │  GET /api/backup/health   │
    └───────────────────────────┘
                ↓
    ┌───────────────────────────┐
    │  Archon Backups           │
    │  /archon/backups/         │
    ├───────────────────────────┤
    │  archon_postgres-*.dump   │
    │  (PostgreSQL custom fmt)  │
    └───────────────────────────┘
```

### Monitoring Commands

```bash
# Quick status check
curl -s http://localhost:8181/api/backup/status | jq '.health, .age_hours, .count'

# List all backups
curl -s http://localhost:8181/api/backup/list | jq '.count, .total_size_human'

# Test multi-source metrics
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
python3 scripts/backup_metrics.py

# Launch full dashboard
./scripts/monitor-tui.py

# Monitor backup alerts
tail -f /var/log/archon-monitoring.log | grep -E "WARNING|ERROR|CRITICAL"
```

---

**Related Documentation**:
- Main CLAUDE.md: `@.claude/CLAUDE.md`
- Disaster Recovery: This document, Disaster Recovery section
- System Setup: `@.claude/docs/SYSTEM_SETUP.md`
- Database Config: `@.claude/docs/DATABASE_CONFIG.md`
