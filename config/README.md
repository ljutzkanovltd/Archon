# Archon Configuration Files

This directory contains configuration files for Archon's backup, monitoring, and maintenance systems.

## Directory Structure

```
config/
├── systemd/              # Systemd units for automated backups
│   ├── archon-backup.service
│   └── archon-backup.timer
├── logrotate/            # Log rotation configuration
│   └── archon-monitoring
└── README.md             # This file
```

## Installation

### 1. Automated Backups (systemd)

Install the systemd timer and service units to enable daily automated backups at 2:00 AM:

```bash
# From archon project root
cd /home/ljutzkanov/Documents/Projects/archon

# Run installation script
sudo ./scripts/install-systemd-units.sh
```

**What this does:**
- Copies service and timer units to `/etc/systemd/system/`
- Enables the timer to start on boot
- Starts the timer immediately
- Schedules daily backups at 2:00 AM (with random 0-30 minute delay)

**Verify installation:**
```bash
# Check timer status
systemctl status archon-backup.timer

# List next scheduled runs
systemctl list-timers archon-backup.timer

# View backup logs
journalctl -u archon-backup.service -f
```

**Manual backup trigger:**
```bash
# Trigger backup immediately (for testing)
sudo systemctl start archon-backup.service

# Check execution logs
journalctl -u archon-backup.service --since "5 minutes ago"
```

### 2. Log Rotation (logrotate)

Install log rotation configuration to automatically manage log files:

```bash
# From archon project root
cd /home/ljutzkanov/Documents/Projects/archon

# Run installation script
sudo ./scripts/install-logrotate.sh
```

**What this does:**
- Copies logrotate config to `/etc/logrotate.d/`
- Creates log file if it doesn't exist
- Configures rotation policies:
  - Main logs: daily, keep 30 days
  - Restore test logs: weekly, keep 12 weeks
  - Metrics: monthly, keep 24 months

**Verify installation:**
```bash
# Test configuration
sudo logrotate -d /etc/logrotate.d/archon-monitoring

# Force rotation (for testing)
sudo logrotate -f /etc/logrotate.d/archon-monitoring

# View rotated logs
ls -lh /var/log/archon-monitoring.log*
```

### 3. Monitoring Scripts

The monitoring scripts don't require installation but can be scheduled via cron:

```bash
# Edit crontab
crontab -e

# Add these lines:

# Database size monitoring - daily at 6 AM
0 6 * * * /home/ljutzkanov/Documents/Projects/archon/scripts/monitor-db-size.sh

# Restore testing - first Sunday at 4 AM
0 4 1 * * /home/ljutzkanov/Documents/Projects/archon/scripts/test-restore-archon.sh
```

**Manual execution:**
```bash
# Run database size monitoring
./scripts/monitor-db-size.sh

# Run restore test
./scripts/test-restore-archon.sh

# View logs
tail -f /var/log/archon-monitoring.log
tail -f logs/restore-test-*.log
```

## Configuration Details

### Systemd Units

**Service (`archon-backup.service`)**:
- Type: oneshot (runs once per trigger)
- User: ljutzkanov
- Pre-checks: Docker running, PostgreSQL ready
- Executes: `/scripts/backup-archon.sh --verbose`
- Logs: journald (`journalctl -u archon-backup.service`)
- Security: Hardened (read-only home, protected system)

**Timer (`archon-backup.timer`)**:
- Schedule: Daily at 2:00 AM
- Persistent: Yes (runs on next boot if system was off)
- Random delay: 0-30 minutes (avoid system load spikes)
- Boot delay: 5 minutes (if boot time overlaps with schedule)

### Logrotate Configuration

**Main monitoring log** (`/var/log/archon-monitoring.log`):
- Rotation: daily
- Retention: 30 days
- Compression: yes (gzip)
- Permissions: 0640 ljutzkanov:ljutzkanov

**Restore test logs** (`~/Projects/archon/logs/restore-test-*.log`):
- Rotation: weekly
- Retention: 12 weeks
- Compression: yes
- No create (script creates on demand)

**Metrics** (`~/Projects/archon/logs/metrics/db-size-*.csv`):
- Rotation: monthly
- Retention: 24 months (2 years)
- Compression: yes
- No create (script creates on demand)

## Troubleshooting

### Systemd Timer Not Running

**Problem:** Backups not executing automatically

**Check status:**
```bash
systemctl status archon-backup.timer
systemctl status archon-backup.service
```

**Common causes:**
1. Timer not enabled: `sudo systemctl enable archon-backup.timer`
2. Timer not started: `sudo systemctl start archon-backup.timer`
3. Service failed last run: Check logs with `journalctl -u archon-backup.service`

**Fix:**
```bash
# Restart timer
sudo systemctl restart archon-backup.timer

# Check next run time
systemctl list-timers archon-backup.timer

# Test service manually
sudo systemctl start archon-backup.service
```

### Backup Script Fails

**Problem:** Service execution fails with errors

**Check logs:**
```bash
# View recent logs
journalctl -u archon-backup.service --since "1 day ago"

# Follow logs in real-time
journalctl -u archon-backup.service -f
```

**Common causes:**
1. Database container not running
2. Insufficient permissions
3. Disk space issues
4. Network issues

**Fix:**
```bash
# Verify Docker is running
docker ps | grep supabase-ai-db

# Check disk space
df -h ~/Documents/Projects/archon/backups

# Test backup script manually
./scripts/backup-archon.sh --verbose

# Check backup directory permissions
ls -ld ~/Documents/Projects/archon/backups
```

### Logrotate Not Working

**Problem:** Logs not rotating

**Check logrotate status:**
```bash
# Check last rotation
sudo cat /var/lib/logrotate/status | grep archon

# Test configuration
sudo logrotate -d /etc/logrotate.d/archon-monitoring
```

**Common causes:**
1. Configuration syntax errors
2. File permissions issues
3. Logrotate cron job not running

**Fix:**
```bash
# Verify configuration exists
ls -l /etc/logrotate.d/archon-monitoring

# Check permissions
sudo chmod 644 /etc/logrotate.d/archon-monitoring

# Force rotation manually
sudo logrotate -f /etc/logrotate.d/archon-monitoring

# Check cron job
ls -l /etc/cron.daily/logrotate
```

### Monitoring Script Errors

**Problem:** Monitoring scripts fail to execute

**Check execution:**
```bash
# Run manually to see errors
./scripts/monitor-db-size.sh

# Check crontab
crontab -l | grep archon
```

**Common causes:**
1. Script not executable: `chmod +x scripts/monitor-db-size.sh`
2. Missing dependencies: Docker not running
3. Database connection issues

**Fix:**
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Verify database is accessible
docker exec supabase-ai-db pg_isready -U postgres

# Test database connection
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT 1;"
```

## Maintenance

### Regular Tasks

**Weekly:**
- [ ] Review systemd logs: `journalctl -u archon-backup.service --since "1 week ago"`
- [ ] Check backup directory size: `du -sh ~/Documents/Projects/archon/backups`
- [ ] Verify recent backups exist: `ls -lh backups/archon_postgres-*.dump | head -7`

**Monthly:**
- [ ] Review restore test results: `tail -100 logs/restore-test-*.log`
- [ ] Verify backup integrity: Test restore on one backup
- [ ] Check monitoring trends: Review metrics CSV files
- [ ] Update disaster recovery runbook if needed

**Quarterly:**
- [ ] Perform full DR drill (see `/docs/DISASTER_RECOVERY.md`)
- [ ] Review and adjust thresholds
- [ ] Update configuration if needed
- [ ] Audit backup retention policy

### Updating Configuration

**To update systemd units:**
```bash
# Edit source files
nano config/systemd/archon-backup.service
nano config/systemd/archon-backup.timer

# Reinstall
sudo ./scripts/install-systemd-units.sh

# Reload systemd
sudo systemctl daemon-reload
sudo systemctl restart archon-backup.timer
```

**To update logrotate config:**
```bash
# Edit source file
nano config/logrotate/archon-monitoring

# Reinstall
sudo ./scripts/install-logrotate.sh

# Test new configuration
sudo logrotate -d /etc/logrotate.d/archon-monitoring
```

## Security Considerations

**Systemd Service Hardening:**
- ✅ Runs as non-root user (ljutzkanov)
- ✅ NoNewPrivileges prevents privilege escalation
- ✅ ProtectSystem=strict (read-only system directories)
- ✅ ProtectHome=read-only (home directory protection)
- ✅ ReadWritePaths limited to backup directory only
- ✅ PrivateTmp enabled (isolated /tmp)

**File Permissions:**
- Backup directory: 755 (owner: ljutzkanov)
- Backup files: 644 (readable by owner and group)
- Log files: 640 (owner: ljutzkanov, group: ljutzkanov)
- Config files: 644 (system directories, root owned)

**Network Security:**
- Backups connect via Docker internal network
- No external network access required
- Uses local Docker socket only

## References

- **Backup Scripts:** `/scripts/backup-archon.sh`, `/scripts/restore-archon.sh`
- **Monitoring Scripts:** `/scripts/monitor-db-size.sh`, `/scripts/test-restore-archon.sh`
- **Installation Scripts:** `/scripts/install-systemd-units.sh`, `/scripts/install-logrotate.sh`
- **Disaster Recovery:** `/docs/DISASTER_RECOVERY.md`
- **Main Documentation:** `/.claude/CLAUDE.md` (Backup & Monitoring section)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review logs: `journalctl -u archon-backup.service`
3. Consult disaster recovery runbook: `/docs/DISASTER_RECOVERY.md`
4. Contact platform team (see disaster recovery runbook for contacts)
