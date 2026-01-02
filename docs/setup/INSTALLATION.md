# Archon Backup & Monitoring - Installation Guide

**Version:** 1.0.0
**Date:** 2025-12-16
**Status:** Ready for installation

This guide provides step-by-step instructions for installing and configuring Archon's automated backup and monitoring systems.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Installation](#detailed-installation)
- [Verification](#verification)
- [Next Steps](#next-steps)
- [Troubleshooting](#troubleshooting)

---

## Overview

This installation sets up:

1. **Automated Backups** - Daily backups at 2:00 AM via systemd timer
2. **Database Monitoring** - Daily size monitoring with alerts
3. **Restore Testing** - Monthly automated restore validation
4. **Log Rotation** - Automatic log management
5. **Disaster Recovery** - Comprehensive recovery procedures

### What Gets Installed

| Component | Location | Purpose |
|-----------|----------|---------|
| systemd service | `/etc/systemd/system/archon-backup.service` | Backup execution |
| systemd timer | `/etc/systemd/system/archon-backup.timer` | Backup scheduling |
| logrotate config | `/etc/logrotate.d/archon-monitoring` | Log rotation |
| cron jobs | User crontab (optional) | Monitoring schedules |

---

## Prerequisites

Before installation, ensure:

- [ ] **Archon is installed** and working
- [ ] **Database container** (`supabase-ai-db`) is running
- [ ] **Sudo access** available for system-level installation
- [ ] **Disk space** - At least 1GB free for backups
- [ ] **Scripts are executable** - Run: `chmod +x scripts/*.sh`

**Verify prerequisites:**
```bash
# Navigate to Archon directory
cd /home/ljutzkanov/Documents/Projects/archon

# Check database
docker ps | grep supabase-ai-db

# Check disk space
df -h backups/

# Make scripts executable
chmod +x scripts/*.sh
```

---

## Quick Start

For a complete installation in one go:

```bash
cd /home/ljutzkanov/Documents/Projects/archon

# 1. Install systemd units (requires sudo)
sudo ./scripts/install-systemd-units.sh

# 2. Install logrotate (requires sudo)
sudo ./scripts/install-logrotate.sh

# 3. Set up monitoring cron jobs (optional)
crontab -e
# Add:
# 0 6 * * * /home/ljutzkanov/Documents/Projects/archon/scripts/monitor-db-size.sh
# 0 4 1 * * /home/ljutzkanov/Documents/Projects/archon/scripts/test-restore-archon.sh

# 4. Verify installation
systemctl status archon-backup.timer
systemctl list-timers archon-backup.timer

# 5. Test backup manually
sudo systemctl start archon-backup.service

# 6. Check logs
journalctl -u archon-backup.service --since "5 minutes ago"
```

**Done!** Your automated backup system is now active.

---

## Detailed Installation

### Step 1: Install Automated Backups

**1.1. Install systemd units:**
```bash
cd /home/ljutzkanov/Documents/Projects/archon
sudo ./scripts/install-systemd-units.sh
```

**Expected output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Archon Systemd Backup Unit Installer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Running with sudo privileges
✓ Found archon-backup.service
✓ Found archon-backup.timer
✓ Installed archon-backup.service
✓ Installed archon-backup.timer
✓ Reloaded systemd daemon
✓ Enabled archon-backup.timer
✓ Started archon-backup.timer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Archon Backup Timer Installed Successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**1.2. Verify timer is running:**
```bash
# Check status
systemctl status archon-backup.timer

# Should show:
# ● archon-backup.timer - Daily Archon Database Backup Timer
#    Loaded: loaded (/etc/systemd/system/archon-backup.timer; enabled)
#    Active: active (waiting)
```

**1.3. Check next scheduled run:**
```bash
systemctl list-timers archon-backup.timer

# Should show next run time (tomorrow at 2 AM)
```

**1.4. Test backup manually:**
```bash
# Trigger backup immediately
sudo systemctl start archon-backup.service

# Wait for completion (30 seconds)
sleep 30

# Check status
systemctl status archon-backup.service

# Verify backup was created
ls -lh backups/archon_postgres-*.dump | tail -1
```

**1.5. View backup logs:**
```bash
# Recent logs
journalctl -u archon-backup.service --since "10 minutes ago"

# Follow logs in real-time
journalctl -u archon-backup.service -f
```

### Step 2: Install Log Rotation

**2.1. Install logrotate configuration:**
```bash
sudo ./scripts/install-logrotate.sh
```

**Expected output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Archon Logrotate Configuration Installer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Running with sudo privileges
✓ Found logrotate configuration
✓ Installed to /etc/logrotate.d/archon-monitoring
✓ Created log file: /var/log/archon-monitoring.log
✓ Configuration syntax is valid
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Logrotate Configuration Installed Successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**2.2. Test logrotate configuration:**
```bash
# Dry-run test
sudo logrotate -d /etc/logrotate.d/archon-monitoring

# Force rotation (creates rotated file)
sudo logrotate -f /etc/logrotate.d/archon-monitoring

# Check rotated logs
ls -lh /var/log/archon-monitoring.log*
```

### Step 3: Set Up Monitoring Scripts

**3.1. Add cron jobs for monitoring:**
```bash
# Edit crontab
crontab -e

# Add these lines at the end:

# Archon Monitoring
# Database size monitoring - daily at 6 AM
0 6 * * * /home/ljutzkanov/Documents/Projects/archon/scripts/monitor-db-size.sh

# Restore testing - first Sunday at 4 AM
0 4 1 * * /home/ljutzkanov/Documents/Projects/archon/scripts/test-restore-archon.sh

# Save and exit (Ctrl+X, then Y, then Enter in nano)
```

**3.2. Verify cron jobs:**
```bash
# List cron jobs
crontab -l | grep archon

# Should show:
# 0 6 * * * /home/ljutzkanov/Documents/Projects/archon/scripts/monitor-db-size.sh
# 0 4 1 * * /home/ljutzkanov/Documents/Projects/archon/scripts/test-restore-archon.sh
```

**3.3. Test monitoring script:**
```bash
# Run database size monitoring
./scripts/monitor-db-size.sh

# View output
tail -30 /var/log/archon-monitoring.log

# Check metrics file
cat logs/metrics/db-size-$(date +%Y%m).csv
```

**3.4. Test restore script (optional - takes 2-3 minutes):**
```bash
# Run restore test
./scripts/test-restore-archon.sh

# View results
tail -100 logs/restore-test-*.log | less
```

### Step 4: Review Disaster Recovery Runbook

**4.1. Read the disaster recovery runbook:**
```bash
# View runbook
less docs/DISASTER_RECOVERY.md

# Or open in editor
nano docs/DISASTER_RECOVERY.md
```

**4.2. Key sections to review:**
- Recovery objectives (RTO/RPO)
- Disaster scenarios (6 scenarios covered)
- Testing schedules
- Emergency contacts (update with your team info)

**4.3. Update emergency contacts:**
```bash
# Edit runbook
nano docs/DISASTER_RECOVERY.md

# Update these sections:
# - Primary Team (names, emails, phones)
# - Escalation Path
# - External Contacts
```

---

## Verification

### Check Installed Components

**1. Systemd timer:**
```bash
# Timer status
systemctl status archon-backup.timer

# Expected: Active: active (waiting)

# Next run
systemctl list-timers archon-backup.timer

# Expected: Shows next scheduled backup (tomorrow 2 AM)
```

**2. Logrotate:**
```bash
# Config exists
ls -l /etc/logrotate.d/archon-monitoring

# Expected: -rw-r--r-- 1 root root ... archon-monitoring

# Test config
sudo logrotate -d /etc/logrotate.d/archon-monitoring

# Expected: No errors
```

**3. Cron jobs:**
```bash
# List jobs
crontab -l | grep archon

# Expected: Shows 2 cron jobs (monitoring and restore test)
```

**4. Scripts executable:**
```bash
# Check permissions
ls -l scripts/*.sh | grep -E "backup|restore|monitor|test|install"

# Expected: All show -rwxr-xr-x (executable)
```

**5. Directories exist:**
```bash
# Check directories
ls -ld backups/ logs/ logs/metrics/ config/

# Expected: All exist and are accessible
```

### Run End-to-End Test

```bash
# 1. Create manual backup
./scripts/backup-archon.sh --verbose

# Expected: Backup successful, file created in backups/

# 2. List backups
./scripts/restore-archon.sh --list

# Expected: Shows all available backups

# 3. Run monitoring
./scripts/monitor-db-size.sh

# Expected: Shows database size, no errors

# 4. Check logs
tail -50 /var/log/archon-monitoring.log

# Expected: Recent monitoring entries

# 5. Verify metrics
cat logs/metrics/db-size-$(date +%Y%m).csv

# Expected: CSV with timestamp, size data
```

---

## Next Steps

### Immediate (Within 24 Hours)

1. **Monitor first automated backup:**
   ```bash
   # Tomorrow morning, check logs
   journalctl -u archon-backup.service --since "2:00" --until "3:00"

   # Verify backup was created
   ls -lh backups/archon_postgres-$(date +%Y%m%d)*.dump
   ```

2. **Set up alerts (optional):**
   - Configure email notifications in systemd service
   - Set up Slack/Discord webhooks in monitoring scripts
   - Configure PagerDuty for critical alerts

3. **Review and customize thresholds:**
   ```bash
   # Edit monitoring script or set environment variables
   export ALERT_THRESHOLD_MB=150
   export WARNING_THRESHOLD_MB=120
   ```

### Within First Week

1. **Verify automated backups are working:**
   - Check 7 consecutive daily backups
   - Verify retention policy (old backups deleted)

2. **Test restore procedure:**
   ```bash
   # Dry-run restore
   ./scripts/restore-archon.sh --latest --dry-run

   # Actual restore test (if comfortable)
   ./scripts/restore-archon.sh --latest
   ```

3. **Review monitoring trends:**
   ```bash
   # Check database growth
   cat logs/metrics/db-size-$(date +%Y%m).csv
   ```

### Within First Month

1. **Monthly restore test:**
   - Wait for automated restore test (first Sunday)
   - Review test results
   - Verify all tables validated correctly

2. **Adjust configurations:**
   - Fine-tune alert thresholds
   - Adjust backup retention
   - Update disaster recovery contacts

3. **Document customizations:**
   - Note any changes made
   - Update runbook with team-specific procedures

### Ongoing

1. **Daily:**
   - Check systemd logs for backup status
   - Monitor database size trends

2. **Weekly:**
   - Verify backups are not corrupt
   - Check disk space

3. **Monthly:**
   - Review restore test results
   - Verify RTO/RPO targets met

4. **Quarterly:**
   - Perform full DR drill
   - Update disaster recovery runbook
   - Train team on recovery procedures

---

## Troubleshooting

### Installation Issues

**Problem:** `sudo: command not found`

**Solution:**
```bash
# Use root account or install sudo
su -
apt-get install sudo  # Debian/Ubuntu
yum install sudo       # RHEL/CentOS
```

---

**Problem:** Permission denied errors

**Solution:**
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run with sudo where required
sudo ./scripts/install-systemd-units.sh
```

---

**Problem:** systemd timer not starting

**Solution:**
```bash
# Check systemd is running
systemctl status

# Enable and start timer
sudo systemctl enable archon-backup.timer
sudo systemctl start archon-backup.timer

# Check for errors
journalctl -u archon-backup.timer -n 50
```

---

**Problem:** Database container not found

**Solution:**
```bash
# Check if local-ai-packaged is running
cd ~/Documents/Projects/local-ai-packaged
docker compose ps | grep supabase

# Start if needed
docker compose up -d supabase-ai-db
```

---

**Problem:** Cron jobs not executing

**Solution:**
```bash
# Check cron service
systemctl status cron

# Check cron logs
grep CRON /var/log/syslog | tail -20

# Verify paths are absolute
crontab -e
# Ensure full paths: /home/ljutzkanov/Documents/Projects/archon/...
```

### Common Errors

**Error:** "no space left on device"

**Cause:** Disk full or inotify limit

**Solution:**
```bash
# Check disk space
df -h

# Check inotify limit
sysctl fs.inotify.max_user_watches

# Increase if needed
sudo sysctl -w fs.inotify.max_user_watches=524288
```

---

**Error:** "Permission denied" on /var/log/archon-monitoring.log

**Cause:** Log file permissions incorrect

**Solution:**
```bash
# Fix permissions
sudo chown ljutzkanov:ljutzkanov /var/log/archon-monitoring.log
sudo chmod 640 /var/log/archon-monitoring.log
```

---

**Error:** Backup script fails with "container not found"

**Cause:** Database container not running

**Solution:**
```bash
# Check container
docker ps -a | grep supabase-ai-db

# Start if stopped
cd ~/Documents/Projects/local-ai-packaged
docker compose up -d supabase-ai-db

# Wait for ready
until docker exec supabase-ai-db pg_isready -U postgres; do
  sleep 2
done
```

---

## Getting Help

### Documentation

- **Main docs:** `/.claude/CLAUDE.md` (Backup & Monitoring section)
- **Disaster recovery:** `/docs/DISASTER_RECOVERY.md`
- **Configuration:** `/config/README.md`
- **Scripts help:** `./scripts/backup-archon.sh --help`

### Support Commands

```bash
# Check system status
docker ps | grep -E "supabase|archon"
systemctl status archon-backup.timer
crontab -l | grep archon

# View logs
journalctl -u archon-backup.service --since "1 day ago"
tail -100 /var/log/archon-monitoring.log

# Test scripts
./scripts/backup-archon.sh --verbose
./scripts/monitor-db-size.sh
```

### Contact

For issues or questions:
1. Check troubleshooting sections above
2. Review logs for error messages
3. Consult disaster recovery runbook
4. Contact platform team (see `/docs/DISASTER_RECOVERY.md` for contacts)

---

## Summary

You have successfully installed:

- ✅ **Automated backups** - Daily at 2 AM via systemd
- ✅ **Log rotation** - Automatic log management
- ✅ **Monitoring scripts** - Database size tracking
- ✅ **Restore testing** - Monthly validation
- ✅ **Disaster recovery** - Comprehensive runbook

**Next scheduled events:**
- Tomorrow 2:00 AM: First automated backup
- Tomorrow 6:00 AM: First database size check
- First Sunday 4:00 AM: First restore test

**Verify everything is working:**
```bash
# Quick health check
systemctl list-timers archon-backup.timer
crontab -l | grep archon
ls -lh backups/archon_postgres-*.dump | tail -3
```

**Congratulations! Your Archon backup and monitoring system is now fully operational.** 🎉

---

**Installation Date:** $(date)
**Installed By:** [Your Name]
**Next Review:** [Date + 30 days]
