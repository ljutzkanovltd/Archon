# Archon Disaster Recovery Runbook

**Version:** 1.0.0
**Last Updated:** 2025-12-16
**Maintained By:** SportERP Platform Team
**Review Frequency:** Quarterly

---

## Table of Contents

- [Overview](#overview)
- [Recovery Objectives](#recovery-objectives)
- [Prerequisites](#prerequisites)
- [Emergency Contacts](#emergency-contacts)
- [Disaster Scenarios](#disaster-scenarios)
  - [Scenario 1: Accidental Data Deletion](#scenario-1-accidental-data-deletion)
  - [Scenario 2: Database Corruption](#scenario-2-database-corruption)
  - [Scenario 3: Complete Database Loss](#scenario-3-complete-database-loss)
  - [Scenario 4: Backup File Corruption](#scenario-4-backup-file-corruption)
  - [Scenario 5: Service Outage](#scenario-5-service-outage)
  - [Scenario 6: Container Failure](#scenario-6-container-failure)
- [Testing & Validation](#testing--validation)
- [Post-Recovery Checklist](#post-recovery-checklist)
- [Lessons Learned Template](#lessons-learned-template)

---

## Overview

This runbook provides step-by-step procedures for recovering the Archon knowledge base and task management system from various disaster scenarios. Archon uses PostgreSQL with pgvector for knowledge storage, and all data resides in the shared `postgres` database with `archon_*` table prefixes.

### System Architecture

```
Archon Platform:
├── MCP Server (Port 8051)        # Model Context Protocol endpoint
├── Backend API (Port 8181)       # REST API
├── Dashboard UI (Port 3737)      # Web interface
├── AI Agents (Port 8052)         # Optional AI services
└── Database (supabase-ai-db)     # PostgreSQL + pgvector
    └── postgres database
        └── archon_* tables (11 total)
```

### Database Details

- **Container:** `supabase-ai-db` (from local-ai-packaged project)
- **Database:** `postgres` (shared with other services)
- **Tables:** 11 Archon tables with `archon_*` prefix
- **Isolation:** Table-level isolation
- **Connection:** `supabase-ai-db:5432` via `localai_default` network
- **Current Size:** ~22 MB (as of December 2025)

---

## Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** (Recovery Time Objective) | 30 min - 4 hours | Maximum acceptable downtime |
| **RPO** (Recovery Point Objective) | 24 hours | Maximum acceptable data loss |
| **Backup Frequency** | Daily at 2 AM | Automated via systemd timer |
| **Backup Retention** | 10 days | Last 10 backups kept |
| **Test Frequency** | Monthly | First Sunday at 4 AM |

### RTO by Scenario

| Scenario | RTO | Complexity |
|----------|-----|------------|
| Accidental Data Deletion | 30 minutes | Low |
| Database Corruption | 1 hour | Medium |
| Complete Database Loss | 2-4 hours | High |
| Backup Corruption | Immediate | Low |
| Service Outage | 15 minutes | Low |
| Container Failure | 30 minutes | Medium |

---

## Prerequisites

Before attempting recovery, ensure you have:

- [ ] **Access:** sudo privileges on the host system
- [ ] **Credentials:** PostgreSQL password for user `postgres`
- [ ] **Network:** `localai_default` Docker network available
- [ ] **Dependencies:** `local-ai-packaged` services running (for database container)
- [ ] **Backups:** Access to `/home/ljutzkanov/Documents/Projects/archon/backups/`
- [ ] **Tools:** Docker, psql, pg_restore
- [ ] **Documentation:** This runbook and system architecture docs

### Quick Access Commands

```bash
# Navigate to Archon directory
cd /home/ljutzkanov/Documents/Projects/archon

# Check database container status
docker ps | grep supabase-ai-db

# Verify PostgreSQL is running
docker exec supabase-ai-db pg_isready -U postgres

# List available backups
ls -lh backups/archon_postgres-*.dump

# Check Archon services
docker ps | grep archon
```

---

## Emergency Contacts

### Primary Team

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| **Platform Lead** | [Name] | [Email/Phone] | 24/7 |
| **Database Admin** | [Name] | [Email/Phone] | Business hours |
| **Backup Admin** | [Name] | [Email/Phone] | 24/7 |
| **On-Call Engineer** | [Rotation] | [PagerDuty/Phone] | 24/7 |

### Escalation Path

1. **Level 1:** On-Call Engineer (0-15 min)
2. **Level 2:** Database Admin (15-30 min)
3. **Level 3:** Platform Lead (30-60 min)
4. **Level 4:** CTO/Engineering Manager (1+ hour)

### External Contacts

- **Docker Support:** [Contact info if applicable]
- **Supabase Support:** [Contact info if applicable]
- **Cloud Provider:** [AWS/Azure contact if applicable]

---

## Disaster Scenarios

### Scenario 1: Accidental Data Deletion

**Symptoms:**
- User reports missing data (projects, tasks, documents)
- Data visible in backups but not in production
- No error messages in logs

**Detection Methods:**
- User reports
- Missing records in API responses
- Dashboard shows empty data

**RTO:** 30 minutes
**RPO:** Last backup (up to 24 hours)
**Complexity:** Low

#### Recovery Steps

1. **Assess Impact**
   ```bash
   # Connect to database
   docker exec -it supabase-ai-db psql -U postgres -d postgres

   # Check affected tables
   SELECT COUNT(*) FROM archon_projects;
   SELECT COUNT(*) FROM archon_tasks;
   SELECT COUNT(*) FROM archon_documents;

   # Review recent activity (if audit log exists)
   SELECT * FROM archon_migrations ORDER BY created_at DESC LIMIT 10;
   ```

2. **Identify Recovery Point**
   ```bash
   # List available backups
   ./scripts/restore-archon.sh --list

   # Example output:
   # archon_postgres-20251216_020000.dump (today 2 AM)
   # archon_postgres-20251215_020000.dump (yesterday)
   # archon_postgres-20251214_020000.dump (2 days ago)

   # Confirm with user when data was last seen
   ```

3. **Create Safety Backup** (automatic via restore script)
   ```bash
   # This is done automatically by restore-archon.sh
   # Creates: backups/archon_postgres-safety-YYYYMMDD_HHMMSS.dump
   ```

4. **Dry Run Restore**
   ```bash
   # Test restore without making changes
   ./scripts/restore-archon.sh \
     --backup backups/archon_postgres-20251215_020000.dump \
     --dry-run

   # Review output for errors
   ```

5. **Execute Restore**
   ```bash
   # Restore from selected backup
   ./scripts/restore-archon.sh \
     --backup backups/archon_postgres-20251215_020000.dump \
     --verbose

   # Script will:
   # - Create safety backup
   # - Restore data
   # - Validate all 11 Archon tables
   # - Show row counts
   ```

6. **Verify Recovery**
   ```bash
   # Connect to database
   docker exec -it supabase-ai-db psql -U postgres -d postgres

   # Check data is restored
   SELECT * FROM archon_projects WHERE id = '<deleted_project_id>';
   SELECT * FROM archon_tasks WHERE project_id = '<deleted_project_id>';

   # Verify row counts match expectations
   SELECT
     'archon_projects' AS table_name,
     COUNT(*) AS row_count
   FROM archon_projects
   UNION ALL
   SELECT 'archon_tasks', COUNT(*) FROM archon_tasks
   UNION ALL
   SELECT 'archon_documents', COUNT(*) FROM archon_document_versions;
   ```

7. **Restart Archon Services** (if needed)
   ```bash
   cd /home/ljutzkanov/Documents/Projects/archon
   ./stop-archon.sh
   ./start-archon.sh
   ```

8. **User Verification**
   - Ask user to verify their data is restored
   - Check specific records they reported missing
   - Test functionality in dashboard

#### Rollback Procedure

If restore causes issues:

```bash
# Rollback to safety backup created before restore
./scripts/restore-archon.sh \
  --backup backups/archon_postgres-safety-YYYYMMDD_HHMMSS.dump
```

---

### Scenario 2: Database Corruption

**Symptoms:**
- PostgreSQL errors in logs
- Container marked as unhealthy
- Queries failing with corruption errors
- Inconsistent data or crashes

**Detection Methods:**
- Health check failures
- Error logs: "ERROR:  could not read block"
- Failed queries
- Monitoring alerts

**RTO:** 1 hour
**RPO:** Last backup (up to 24 hours)
**Complexity:** Medium

#### Recovery Steps

1. **Verify Corruption**
   ```bash
   # Check container logs
   docker logs supabase-ai-db --tail 100

   # Look for errors like:
   # - "ERROR:  could not read block"
   # - "WARNING:  page verification failed"
   # - "PANIC:  could not write to file"

   # Try to connect
   docker exec -it supabase-ai-db psql -U postgres -d postgres

   # Run integrity check
   SELECT * FROM archon_settings LIMIT 1;
   ```

2. **Attempt Recovery (if minor)**
   ```bash
   # Try PostgreSQL REINDEX
   docker exec supabase-ai-db psql -U postgres -d postgres -c "REINDEX DATABASE postgres;"

   # Try VACUUM
   docker exec supabase-ai-db psql -U postgres -d postgres -c "VACUUM FULL ANALYZE;"
   ```

3. **If Recovery Fails - Stop Services**
   ```bash
   cd /home/ljutzkanov/Documents/Projects/archon
   ./stop-archon.sh
   ```

4. **Create Emergency Backup** (if database is accessible)
   ```bash
   ./scripts/backup-archon.sh --backup-dir backups/emergency
   ```

5. **Restore from Last Good Backup**
   ```bash
   # Find latest backup before corruption
   ls -lth backups/archon_postgres-*.dump | head -5

   # Restore
   ./scripts/restore-archon.sh \
     --backup backups/archon_postgres-YYYYMMDD_HHMMSS.dump \
     --no-safety-backup  # Skip safety backup if DB is corrupt
   ```

6. **Verify Database Integrity**
   ```bash
   # Run test restore script
   ./scripts/test-restore-archon.sh

   # Check logs
   tail -100 logs/restore-test-*.log
   ```

7. **Restart All Services**
   ```bash
   # Restart database container first
   docker restart supabase-ai-db

   # Wait for PostgreSQL to be ready
   until docker exec supabase-ai-db pg_isready -U postgres; do
     echo "Waiting for PostgreSQL..."
     sleep 2
   done

   # Start Archon services
   ./start-archon.sh
   ```

8. **Post-Recovery Validation**
   ```bash
   # Health checks
   curl http://localhost:8181/health
   curl http://localhost:3737

   # Database size
   ./scripts/monitor-db-size.sh

   # Run full test suite
   cd python && uv run pytest tests/
   ```

#### Root Cause Analysis

After recovery, investigate:
- Disk space issues (full disk)
- Hardware problems (bad sectors)
- Improper shutdowns
- Software bugs
- Resource exhaustion (OOM killer)

---

### Scenario 3: Complete Database Loss

**Symptoms:**
- Database container missing
- Database files deleted
- Unrecoverable disk failure
- Catastrophic corruption

**Detection Methods:**
- Container not found: `docker ps | grep supabase-ai-db` returns nothing
- Volume missing: `docker volume ls | grep postgres_data` returns nothing
- Complete service failure

**RTO:** 2-4 hours
**RPO:** Last backup (up to 24 hours)
**Complexity:** High

#### Recovery Steps

1. **Assess Damage**
   ```bash
   # Check if container exists (stopped)
   docker ps -a | grep supabase-ai-db

   # Check volumes
   docker volume ls | grep supabase

   # Check local-ai-packaged status
   cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
   docker compose ps
   ```

2. **Recreate Database Infrastructure**

   **Option A: Restart local-ai-packaged (Recommended)**
   ```bash
   cd /home/ljutzkanov/Documents/Projects/local-ai-packaged

   # Stop all services
   docker compose down

   # Remove volumes if corrupted (WARNING: Data loss)
   docker compose down -v

   # Start Supabase stack
   docker compose up -d supabase-ai-db supabase-ai-kong
   ```

   **Option B: Manually recreate container**
   ```bash
   # Create volume
   docker volume create supabase_db_data

   # Run PostgreSQL container
   docker run -d \
     --name supabase-ai-db \
     --network localai_default \
     -e POSTGRES_PASSWORD=your_password \
     -v supabase_db_data:/var/lib/postgresql/data \
     supabase/postgres:15
   ```

3. **Wait for PostgreSQL Initialization**
   ```bash
   # Wait for database to be ready
   until docker exec supabase-ai-db pg_isready -U postgres; do
     echo "Waiting for PostgreSQL initialization..."
     sleep 5
   done

   # Give it extra time for full initialization
   sleep 10
   ```

4. **Create Archon Database** (if using dedicated DB - currently not used)
   ```bash
   # Note: Archon uses shared 'postgres' database
   # Verify it exists
   docker exec supabase-ai-db psql -U postgres -lqt | cut -d \| -f 1 | grep -qw postgres
   ```

5. **Restore from Backup**
   ```bash
   cd /home/ljutzkanov/Documents/Projects/archon

   # List backups
   ls -lth backups/archon_postgres-*.dump | head -3

   # Restore latest backup
   ./scripts/restore-archon.sh --latest --verbose

   # Or specific backup
   ./scripts/restore-archon.sh \
     --backup backups/archon_postgres-YYYYMMDD_HHMMSS.dump
   ```

6. **Run Migrations** (if needed)
   ```bash
   cd /home/ljutzkanov/Documents/Projects/archon

   # Check migration status
   docker exec supabase-ai-db psql -U postgres -d postgres -c \
     "SELECT * FROM archon_migrations ORDER BY created_at DESC LIMIT 5;"

   # If migrations missing, run migration script
   docker exec supabase-ai-db psql -U postgres -d postgres < migration/complete_setup.sql
   ```

7. **Verify Schema**
   ```bash
   # Check all 11 Archon tables exist
   docker exec supabase-ai-db psql -U postgres -d postgres -c "\dt archon_*"

   # Expected output: 11 tables
   # archon_code_examples
   # archon_crawled_pages
   # archon_document_versions
   # archon_migrations
   # archon_page_metadata
   # archon_project_sources
   # archon_projects
   # archon_prompts
   # archon_settings
   # archon_sources
   # archon_tasks
   ```

8. **Start Archon Services**
   ```bash
   ./start-archon.sh --verbose
   ```

9. **Full System Validation**
   ```bash
   # Health checks
   curl http://localhost:8051/health  # MCP server
   curl http://localhost:8181/health  # Backend API
   curl http://localhost:3737         # Dashboard

   # Database connectivity
   docker exec archon-server python -c "
   from src.server.services.credential_service import CredentialService
   cred = CredentialService()
   print('Supabase connection:', 'OK' if cred.supabase_url else 'FAILED')
   "

   # Run test restore
   ./scripts/test-restore-archon.sh
   ```

#### Data Loss Assessment

After complete recovery:

```bash
# Compare backup timestamp to current time
BACKUP_DATE=$(basename backups/archon_postgres-YYYYMMDD_HHMMSS.dump | cut -d'-' -f2-3)
echo "Recovered data from: $BACKUP_DATE"
echo "Current time: $(date)"
echo "Potential data loss: Time between backup and incident"

# Document what was lost
# - Any data added after last backup
# - In-progress work
# - Recent crawls
```

---

### Scenario 4: Backup File Corruption

**Symptoms:**
- Restore fails with corruption errors
- Backup file unreadable
- pg_restore errors

**Detection Methods:**
- Monthly restore test failure
- Manual restore attempt fails
- File integrity check failure

**RTO:** Immediate (use previous backup)
**RPO:** Previous backup (24-48 hours)
**Complexity:** Low

#### Recovery Steps

1. **Verify Corruption**
   ```bash
   # Check file integrity
   pg_restore --list backups/archon_postgres-SUSPECT.dump 2>&1 | grep -i error

   # Check file size (should be >400KB)
   ls -lh backups/archon_postgres-SUSPECT.dump

   # Verify backup contents
   ./scripts/restore-archon.sh \
     --backup backups/archon_postgres-SUSPECT.dump \
     --dry-run
   ```

2. **Find Last Good Backup**
   ```bash
   # List all backups
   ls -lth backups/archon_postgres-*.dump

   # Test each backup (newest to oldest)
   for backup in $(ls -t backups/archon_postgres-*.dump); do
     echo "Testing $backup..."
     if pg_restore --list "$backup" >/dev/null 2>&1; then
       echo "✓ Valid: $backup"
       break
     else
       echo "✗ Corrupt: $backup"
     fi
   done
   ```

3. **Use Previous Backup**
   ```bash
   # Restore from last good backup
   ./scripts/restore-archon.sh \
     --backup backups/archon_postgres-PREVIOUS_GOOD.dump
   ```

4. **Investigate Root Cause**
   - Disk errors: `dmesg | grep -i error`
   - File system issues: `df -h`
   - Check backup logs: `journalctl -u archon-backup.service`
   - Verify backup script ran successfully

5. **Create New Backup**
   ```bash
   # Immediately create fresh backup
   ./scripts/backup-archon.sh --verbose
   ```

6. **Document Incident**
   - Which backup(s) were corrupt
   - Date/time discovered
   - Root cause (if found)
   - Data loss window

---

### Scenario 5: Service Outage

**Symptoms:**
- Archon services not responding
- Containers stopped
- Port conflicts
- Network issues

**Detection Methods:**
- Health check failures
- HTTP 502/503 errors
- Container status: exited/unhealthy

**RTO:** 15 minutes
**RPO:** None (no data loss)
**Complexity:** Low

#### Recovery Steps

1. **Check Service Status**
   ```bash
   # Check all Archon containers
   docker ps -a | grep archon

   # Check logs
   docker logs archon-server --tail 50
   docker logs archon-mcp --tail 50
   docker logs archon-ui --tail 50
   ```

2. **Identify Issue**
   ```bash
   # Port conflicts
   netstat -tlnp | grep -E "8051|8181|3737"

   # Network issues
   docker network inspect localai_default
   docker network inspect sporterp-ai-unified

   # Resource issues
   docker stats --no-stream
   df -h
   ```

3. **Restart Services**
   ```bash
   cd /home/ljutzkanov/Documents/Projects/archon

   # Stop cleanly
   ./stop-archon.sh

   # Wait for containers to stop
   sleep 5

   # Start services
   ./start-archon.sh --verbose
   ```

4. **Verify Recovery**
   ```bash
   # Wait for healthy status
   until docker ps | grep archon-server | grep -q healthy; do
     echo "Waiting for services..."
     sleep 5
   done

   # Test endpoints
   curl http://localhost:8181/health
   curl http://localhost:8051/health
   curl http://localhost:3737
   ```

---

### Scenario 6: Container Failure

**Symptoms:**
- Container repeatedly restarting
- OOM killed
- Crashed with exit code

**Detection Methods:**
- Docker events
- Container status: restarting
- High memory usage

**RTO:** 30 minutes
**RPO:** None (no data loss)
**Complexity:** Medium

#### Recovery Steps

1. **Identify Failed Container**
   ```bash
   # Check container status
   docker ps -a | grep archon

   # Get exit code
   docker inspect archon-server --format='{{.State.ExitCode}}'

   # Check events
   docker events --filter container=archon-server --since 1h
   ```

2. **Analyze Logs**
   ```bash
   # Get full logs
   docker logs archon-server > /tmp/archon-server-crash.log

   # Look for errors
   docker logs archon-server 2>&1 | grep -i "error\|fatal\|panic"

   # Check resource limits
   docker stats --no-stream archon-server
   ```

3. **Increase Resources** (if needed)
   ```bash
   # Edit docker-compose.yml
   nano docker-compose.yml

   # Increase memory limits
   services:
     archon-server:
       deploy:
         resources:
           limits:
             memory: 4G  # Increase from default
           reservations:
             memory: 2G
   ```

4. **Restart Container**
   ```bash
   # Remove and recreate
   docker compose up -d --force-recreate archon-server

   # Or restart all
   ./stop-archon.sh && ./start-archon.sh
   ```

5. **Monitor Stability**
   ```bash
   # Watch logs
   docker logs -f archon-server

   # Monitor resources
   watch -n 5 'docker stats --no-stream archon-server'
   ```

---

## Testing & Validation

### Monthly Restore Test

**Schedule:** First Sunday of each month at 4 AM

```bash
# Automated via cron (to be set up)
0 4 1 * * /home/ljutzkanov/Documents/Projects/archon/scripts/test-restore-archon.sh

# Manual execution
./scripts/test-restore-archon.sh

# Review test results
tail -100 logs/restore-test-$(date +%Y%m%d)*.log
```

### Quarterly DR Drill

Full disaster recovery simulation:

1. **Preparation** (1 week before)
   - [ ] Notify team of drill date/time
   - [ ] Verify all backups exist
   - [ ] Document current system state
   - [ ] Prepare test environment (optional)

2. **Execution** (During drill)
   - [ ] Simulate Scenario 3 (Complete Database Loss)
   - [ ] Time each recovery step
   - [ ] Document issues encountered
   - [ ] Verify full functionality

3. **Validation** (After recovery)
   - [ ] All services healthy
   - [ ] All data accessible
   - [ ] MCP endpoints working
   - [ ] Dashboard functional
   - [ ] API responding correctly

4. **Debrief** (Within 48 hours)
   - [ ] Review timing vs. RTO targets
   - [ ] Identify improvements
   - [ ] Update runbook
   - [ ] Share lessons learned

---

## Post-Recovery Checklist

After any recovery, complete this checklist:

- [ ] **Database Accessible**
  ```bash
  docker exec -it supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_settings;"
  ```

- [ ] **All Tables Present**
  ```bash
  docker exec supabase-ai-db psql -U postgres -d postgres -c "\dt archon_*" | grep "11 rows"
  ```

- [ ] **Services Running**
  ```bash
  docker ps | grep archon | grep -c healthy
  # Should show 3 (server, mcp, ui)
  ```

- [ ] **Health Endpoints Responding**
  ```bash
  curl -f http://localhost:8181/health && echo "✓ API healthy"
  curl -f http://localhost:8051/health && echo "✓ MCP healthy"
  curl -f http://localhost:3737 && echo "✓ UI healthy"
  ```

- [ ] **Database Size Normal**
  ```bash
  ./scripts/monitor-db-size.sh
  # Verify size is reasonable (20-50MB expected)
  ```

- [ ] **Recent Data Accessible**
  ```bash
  # Test via MCP or API
  curl http://localhost:8181/api/projects | jq '.[] | .title'
  ```

- [ ] **Backup Created**
  ```bash
  ./scripts/backup-archon.sh
  ```

- [ ] **Monitoring Restored**
  ```bash
  systemctl status archon-backup.timer
  ```

- [ ] **Incident Documented**
  - Date/time of incident
  - Scenario type
  - RTO actual vs. target
  - RPO actual vs. target
  - Issues encountered
  - Improvements identified

- [ ] **Stakeholders Notified**
  - Team members
  - Users (if applicable)
  - Management (if major incident)

---

## Lessons Learned Template

After each incident, complete this template:

```markdown
# Incident Report: [Brief Description]

**Date:** YYYY-MM-DD
**Reported By:** [Name]
**Severity:** Critical / Major / Minor
**Scenario:** [1-6]

## Timeline

- **[HH:MM]** - Incident detected
- **[HH:MM]** - Recovery initiated
- **[HH:MM]** - Services restored
- **[HH:MM]** - Full validation complete

## Impact

- **RTO Actual:** [X] minutes/hours (Target: [Y])
- **RPO Actual:** [X] hours (Target: 24 hours)
- **Data Loss:** [None / Describe]
- **Users Affected:** [Number/All/None]
- **Services Down:** [List]

## Root Cause

[Detailed description of what caused the incident]

## Recovery Actions

[List of steps taken from runbook]

## What Went Well

- [Action/Process that worked]
- [Tool/Script that helped]

## What Didn't Go Well

- [Issue encountered]
- [Delay or problem]

## Action Items

| Item | Owner | Due Date | Status |
|------|-------|----------|--------|
| [Improvement 1] | [Name] | YYYY-MM-DD | Open |
| [Update runbook] | [Name] | YYYY-MM-DD | Open |

## Runbook Updates Needed

- [ ] Update RTO/RPO estimates
- [ ] Add new recovery steps
- [ ] Clarify existing procedures
- [ ] Add new scenario

## Preventive Measures

[Actions to prevent recurrence]

---

**Reviewed By:** [Name, Date]
**Approved By:** [Name, Date]
```

---

## Appendix

### Backup Location

```
/home/ljutzkanov/Documents/Projects/archon/backups/
├── archon_postgres-20251216_020000.dump  (Daily backups)
├── archon_postgres-20251215_020000.dump
├── archon_postgres-safety-*.dump         (Safety backups before restore)
└── emergency/                            (Emergency backups if needed)
```

### Key Configuration Files

- Backup script: `/scripts/backup-archon.sh`
- Restore script: `/scripts/restore-archon.sh`
- Monitoring: `/scripts/monitor-db-size.sh`
- Test restore: `/scripts/test-restore-archon.sh`
- Docker Compose: `/docker-compose.yml`
- Environment: `/.env`
- Systemd units: `/config/systemd/`

### Useful Commands Reference

```bash
# Quick health check
docker ps | grep -E "supabase-ai-db|archon"

# Database connection test
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT version();"

# List Archon tables with row counts
docker exec supabase-ai-db psql -U postgres -d postgres -c "
SELECT
  schemaname,
  tablename,
  n_tup_ins - n_tup_del AS row_count
FROM pg_stat_user_tables
WHERE tablename LIKE 'archon_%'
ORDER BY tablename;"

# View backup schedule
systemctl list-timers archon-backup.timer

# Check disk space
df -h /home/ljutzkanov/Documents/Projects/archon/backups

# Network connectivity test
docker exec archon-server ping -c 3 supabase-ai-db

# Service logs (last hour)
journalctl -u archon-backup.service --since "1 hour ago"
```

---

**END OF RUNBOOK**

*This runbook should be reviewed and updated quarterly, or after any major incident or system change.*
