# Archon Backup & Disaster Recovery

**Version:** 1.0
**Last Updated:** 2025-12-17
**Status:** Production Ready

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [What Gets Backed Up](#what-gets-backed-up)
- [What Does NOT Need Backing Up](#what-does-not-need-backing-up)
- [Backup Script](#backup-script)
- [Backup Monitoring](#backup-monitoring)
- [Disaster Recovery](#disaster-recovery)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)

---

## Overview

**Archon's backup strategy is deliberately simple**: All persistent state lives in the PostgreSQL database. Containers, code, and configuration are ephemeral and easily recreated.

**Key Principle**: Database backup = Complete Archon state backup

### Quick Facts

| Aspect | Detail |
|--------|--------|
| **Backup Scope** | PostgreSQL database only |
| **Backup Size** | 450-470 KB (currently) |
| **Retention** | Last 10 backups |
| **Frequency** | Manual (on-demand) |
| **Format** | PostgreSQL custom format (`pg_dump -Fc`) |
| **Location** | `./backups/archon_postgres-YYYYMMDD_HHMMSS.dump` |
| **Recovery Time** | < 10 minutes |

---

## Architecture

### Archon's Persistence Model

```
┌─────────────────────────────────────────────────────┐
│  ARCHON PLATFORM                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Docker Containers (EPHEMERAL)                     │
│  ├── archon-server     (no volumes)                │
│  ├── archon-mcp        (no volumes)                │
│  └── archon-ui         (no volumes)                │
│                                                     │
│  Application Code (GIT)                            │
│  ├── /python/src       (bind-mount)                │
│  ├── /archon-ui-main   (bind-mount)                │
│  └── docker-compose.yml                            │
│                                                     │
│  Configuration (GIT/REPRODUCIBLE)                  │
│  ├── .env              (secrets in password mgr)   │
│  ├── .claude/          (in git)                    │
│  └── migration/        (in git)                    │
│                                                     │
└─────────────────────────────────────────────────────┘
                        ↓
        Everything Above is RECREATABLE
                        ↓
┌─────────────────────────────────────────────────────┐
│  PERSISTENT STATE (REQUIRES BACKUP) ✅              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Supabase PostgreSQL (supabase-ai-db container)    │
│  Database: postgres                                │
│                                                     │
│  Archon Tables (11 total, ~11 MB):                 │
│  ├── archon_code_examples      (5.5 MB)           │
│  ├── archon_crawled_pages      (5.5 MB)           │
│  ├── archon_settings            (112 KB)           │
│  ├── archon_prompts             (80 KB)            │
│  ├── archon_tasks               (72 KB)            │
│  ├── archon_page_metadata       (72 KB)            │
│  ├── archon_migrations          (72 KB)            │
│  ├── archon_document_versions   (64 KB)            │
│  ├── archon_sources             (64 KB)            │
│  ├── archon_project_sources     (40 KB)            │
│  └── archon_projects            (16 KB)            │
│                                                     │
│  Storage:                                          │
│  ├── Document content: TEXT columns                │
│  ├── Vector embeddings: pgvector columns           │
│  ├── Metadata: JSONB columns                       │
│  └── Supabase Storage: 0 objects (unused)          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Why Database-Only Backup is Sufficient

**1. All State in Database**
- Document content stored as TEXT (not files)
- Vector embeddings in pgvector columns (embedding_384, embedding_768, etc.)
- Project/task metadata in JSONB
- Source URLs and crawl status

**2. No Persistent Volumes**
- All container mounts are code bind-mounts from host
- No Docker volumes exist for Archon
- No user-uploaded files stored persistently

**3. Supabase Storage Unused**
- Storage schema exists but contains 0 objects
- Upload API endpoints exist but don't persist files
- Not used by Archon architecture

**4. Everything Else is Reproducible**
- Docker containers: Recreated from `docker-compose.yml`
- Application code: In git repository
- Configuration: In git or easily recreated

---

## What Gets Backed Up

### ✅ PostgreSQL Database (`postgres`)

**Backup Command**:
```bash
docker exec supabase-ai-db pg_dump -U postgres -F c postgres > archon_postgres-TIMESTAMP.dump
```

**Includes**:
- **All Archon tables** (archon_*) - Archon's persistent state
- **Other service tables** - flowise, langfuse, n8n (bonus protection)
- **Schema definitions** - Table structures, indexes, constraints
- **pgvector extensions** - Vector embedding data

**What This Captures**:
- 📄 All crawled documentation and content
- 🧮 All vector embeddings for semantic search
- 📊 All projects, tasks, and prompts
- 🔗 All source URLs and metadata
- ⚙️ All system settings and configuration
- 📚 Complete version history

**Backup Format**: PostgreSQL custom format (`-Fc`)
- Compressed by default
- Fast restoration
- Selective restoration possible
- Cross-platform compatible

---

## What Does NOT Need Backing Up

### ❌ Docker Containers

**Why**: Ephemeral, recreated from docker-compose.yml

```bash
# Verification
docker inspect archon-server --format '{{json .Mounts}}' | python3 -m json.tool
# Shows: Only bind-mounts (Type: "bind"), no volumes (Type: "volume")
```

**Recovery**: `docker compose up -d` (instant)

---

### ❌ Application Code

**Why**: Version controlled in git

**Locations**:
- `/python/src` - Backend code
- `/archon-ui-main` - Frontend code
- `/migration` - SQL migration files
- `/scripts` - Utility scripts

**Recovery**: `git clone && git checkout <branch>` (< 1 minute)

---

### ❌ Configuration Files

**Why**: In git (without secrets) or easily recreated

**Files**:
- `docker-compose.yml` - In git
- `.env.example` - In git (template)
- `.env` - Recreated from example + password manager
- `.claude/` - In git

**Recovery**: Copy from git + add secrets from password manager

---

### ❌ Supabase Storage

**Why**: Empty and unused

```bash
# Verification
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) FROM storage.objects;"
# Returns: 0
```

**Status**: Supabase Storage exists but Archon doesn't use it

---

### ❌ Volume Mounts

**Why**: All mounts are code from host filesystem (read-only or development)

**archon-server mounts**:
```yaml
- ./migration:/app/migration          # SQL files (code)
- ./backups:/app/backups:ro           # Read-only monitoring
- ./Projects:/app/projects:ro         # Code analysis (read-only)
- ./python/src:/app/src               # Source code (development)
- ./python/tests:/app/tests           # Test code (development)
```

**archon-mcp**: No volumes

**archon-ui**:
```yaml
- ./archon-ui-main/src:/app/src       # Source code (development)
- ./archon-ui-main/public:/app/public # Static assets (development)
```

**Conclusion**: No persistent data in any volume mount

---

## Backup Script

### Manual Backup

**Location**: `scripts/backup-archon.sh`

**Basic Usage**:
```bash
cd /home/ljutzkanov/Documents/Projects/archon
./scripts/backup-archon.sh
```

**Options**:
```bash
# Custom backup directory
./scripts/backup-archon.sh --backup-dir /mnt/external/backups

# Custom retention (default: 10)
./scripts/backup-archon.sh --retention 20

# Verbose output
./scripts/backup-archon.sh --verbose

# Help
./scripts/backup-archon.sh --help
```

**What It Does**:
1. Checks Supabase container is running
2. Verifies PostgreSQL is ready
3. Creates backup: `archon_postgres-YYYYMMDD_HHMMSS.dump`
4. Applies retention policy (deletes old backups)
5. Shows summary

**Output Example**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Archon Database Backup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ Prerequisites Check
[✓] Supabase AI container is running
[✓] PostgreSQL is ready
[✓] Database postgres exists

▶ Backing Up Database: postgres (Archon tables)
[INFO] Starting backup...
[✓] Backup completed: ./backups/archon_postgres-20251217_100000.dump (457.4 KB)

▶ Retention Policy Management
[INFO] Current backups: 5
[INFO] Retention limit: 10
[INFO] No cleanup needed (within retention limit)

▶ Backup Summary
[INFO] Latest backup: archon_postgres-20251217_100000.dump (457.4 KB)
[INFO] Total backups: 5
[INFO] Backup directory: /home/ljutzkanov/Documents/Projects/archon/backups

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Backup Completed Successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Automated Backups (Optional)

**Cron Setup** (not configured by default):

```bash
# Add to crontab
0 2 * * * /home/ljutzkanov/Documents/Projects/archon/scripts/backup-archon.sh >> /var/log/archon-backup.log 2>&1
```

**Recommended Schedule**:
- **Daily**: 2 AM when system is idle
- **Before updates**: Manual backup before major changes
- **Before migrations**: Automatic via start-archon.sh

**BACKUP_ON_START** (optional):
```bash
# In .env
BACKUP_ON_START=true
```

When enabled, `start-archon.sh` creates backup before starting services.

---

## Backup Monitoring

### API Endpoints

**Base URL**: `http://localhost:8181/api/backup`

#### 1. Status Endpoint
```bash
curl http://localhost:8181/api/backup/status | python3 -m json.tool
```

**Response**:
```json
{
    "source": "archon",
    "latest_backup": "2025-12-17T02:24:48",
    "age_hours": 7.7,
    "size_bytes": 468381,
    "size_human": "457.4 KB",
    "count": 5,
    "max_retention": 10,
    "health": "aging",
    "health_message": "Backup is aging (7.7h old)",
    "location": "/app/backups",
    "disk_usage_percent": 31.5
}
```

**Health Status**:
- `healthy`: < 6 hours old (🟢)
- `aging`: 6-24 hours old (🟡)
- `outdated`: 24-48 hours old (🔴)
- `critical`: > 48 hours old (🔴)
- `missing`: No backups found (⚫)

#### 2. List Endpoint
```bash
curl http://localhost:8181/api/backup/list | python3 -m json.tool
```

**Response**:
```json
{
    "count": 5,
    "backups": [
        {
            "filename": "archon_postgres-20251217_022448.dump",
            "timestamp": "2025-12-17T02:24:48",
            "age_hours": 7.7,
            "size_bytes": 468381,
            "size_human": "457.4 KB",
            "path": "/app/backups/archon_postgres-20251217_022448.dump"
        }
    ],
    "total_size_bytes": 2345581,
    "total_size_human": "2.2 MB"
}
```

#### 3. Health Check Endpoint
```bash
curl http://localhost:8181/api/backup/health | python3 -m json.tool
```

**Response**:
```json
{
    "healthy": false,
    "status": "aging",
    "message": "Backup is aging (7.7h old)",
    "age_hours": 7.7
}
```

---

### Dashboard Integration

**Terminal Dashboard**: `monitor-tui.py`

```bash
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts
./monitor-tui.py --refresh 10
```

**Display**:
```
┌─────────────────────────────────────┐
│ 📦 Backup Status                    │
├─────────────────────────────────────┤
│ 🔷 Local AI Platform                │
│   Last    2.3h ago 🟢               │
│   Size    1.2 GB                    │
│   Backups 8/10                      │
│ ─────────────────────                │
│ 🔶 Archon Knowledge Base            │
│   Last    7.7h ago 🟡               │
│   Size    457.4 KB                  │
│   Backups 5/10                      │
│ ─────────────────────                │
│ Overall   🟡 Some Aging             │
└─────────────────────────────────────┘
```

**Features**:
- Multi-source display (Local AI + Archon)
- Color-coded health status
- Real-time monitoring (configurable refresh)
- Console warnings for aging/outdated backups
- Log file alerts: `/var/log/archon-monitoring.log`

---

### Alerting

**Console Warnings** (when dashboard detects issues):
```
[WARN] Archon Knowledge Base: Backup aging (7.7h old, status: aging)
```

**Log File** (automatic logging):
```
[2025-12-17 10:00:00] [WARNING] Archon Knowledge Base: WARNING - Backup aging (7.7h old, status: aging)
[2025-12-17 12:00:00] [ERROR] Archon Knowledge Base: CRITICAL - Backup outdated (25.3h old, status: outdated)
```

**Log Location**:
- Primary: `/var/log/archon-monitoring.log`
- Fallback: `~/archon-monitoring.log` (if no write permission)

---

## Disaster Recovery

### Scenario 1: Complete System Loss

**Situation**: Server crash, hardware failure, or complete data loss

**What You Have**:
- Latest backup: `archon_postgres-20251217_100000.dump`
- Git repository access
- Password manager with credentials

**Recovery Steps**:

```bash
# 1. Restore infrastructure (if needed)
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
docker compose up -d supabase-ai-db supabase-ai-kong
# Wait 30 seconds for PostgreSQL to initialize

# 2. Restore database
cd /home/ljutzkanov/Documents/Projects/archon
./scripts/restore-archon.sh backups/archon_postgres-20251217_100000.dump

# 3. Clone repository (if needed)
git clone <repository_url> archon
cd archon

# 4. Configure environment
cp .env.example .env
# Edit .env with credentials from password manager

# 5. Start Archon services
docker compose up -d

# 6. Verify restoration
curl http://localhost:8181/health
curl http://localhost:8181/api/backup/status
```

**Recovery Time**: 5-10 minutes
**Data Loss**: None (from last backup)

---

### Scenario 2: Database Corruption

**Situation**: Database corruption, bad migration, or data integrity issues

**Recovery Steps**:

```bash
# 1. Stop Archon services
cd /home/ljutzkanov/Documents/Projects/archon
docker compose down

# 2. Identify latest good backup
ls -lt backups/archon_postgres-*.dump | head -5

# 3. Restore from backup
./scripts/restore-archon.sh backups/archon_postgres-20251217_100000.dump

# 4. Restart services
docker compose up -d

# 5. Verify data integrity
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) FROM archon_crawled_pages;"
```

**Recovery Time**: 2-5 minutes
**Data Loss**: Changes since backup timestamp

---

### Scenario 3: Container Deletion

**Situation**: Accidentally deleted Docker containers or images

**Recovery Steps**:

```bash
# 1. Recreate containers
cd /home/ljutzkanov/Documents/Projects/archon
docker compose up -d

# 2. Verify services
docker ps | grep archon
curl http://localhost:8181/health
```

**Recovery Time**: < 1 minute
**Data Loss**: None (database unaffected)

---

### Scenario 4: Accidental Data Deletion

**Situation**: Accidentally deleted records, cleared table, or wrong update

**Recovery Steps**:

```bash
# 1. Stop services immediately
docker compose down

# 2. Find backup before deletion
ls -lt backups/archon_postgres-*.dump

# 3. Restore to temporary database
docker exec supabase-ai-db createdb -U postgres archon_restore
docker exec -i supabase-ai-db pg_restore -U postgres -d archon_restore \
  < backups/archon_postgres-20251217_100000.dump

# 4. Extract needed data
docker exec supabase-ai-db psql -U postgres -d archon_restore -c \
  "SELECT * FROM archon_tasks WHERE id='<deleted_id>';"

# 5. Manually restore to production or full restore if needed
# Option A: Manual INSERT into production
# Option B: Full restore with ./scripts/restore-archon.sh

# 6. Clean up temporary database
docker exec supabase-ai-db dropdb -U postgres archon_restore
```

**Recovery Time**: 5-15 minutes (depending on selective vs full restore)
**Data Loss**: Minimal (targeted recovery possible)

---

### Scenario 5: Migration Failure

**Situation**: Database migration failed, schema corrupted

**Recovery Steps**:

```bash
# 1. Stop services
docker compose down

# 2. Restore from pre-migration backup
./scripts/restore-archon.sh backups/archon_postgres-BEFORE_MIGRATION.dump

# 3. Fix migration script
vim migration/<failing_migration>.sql

# 4. Retry migration
docker compose up -d
# Migrations run automatically on startup

# 5. Verify
docker logs archon-server | grep migration
```

**Prevention**: `start-archon.sh` with `BACKUP_ON_START=true` creates automatic pre-start backups

---

## Restoration Script

### Location

`scripts/restore-archon.sh`

### Usage

```bash
# Basic restoration
./scripts/restore-archon.sh backups/archon_postgres-20251217_100000.dump

# Restoration with options
./scripts/restore-archon.sh \
  --backup-file backups/archon_postgres-20251217_100000.dump \
  --database postgres \
  --verbose

# Help
./scripts/restore-archon.sh --help
```

### What It Does

1. Validates backup file exists
2. Checks Supabase container is running
3. Verifies PostgreSQL is ready
4. Stops Archon services (if running)
5. Restores database from backup
6. Verifies restoration
7. Restarts Archon services
8. Shows restoration summary

### Safety Features

- **Pre-restoration checks**: Validates environment
- **Service coordination**: Stops services before restore
- **Verification**: Confirms data after restore
- **Error handling**: Clear error messages
- **Rollback**: Original database preserved until restore succeeds

---

## Maintenance

### Regular Tasks

#### Daily
- ✅ **Monitor backup health** via dashboard or API
- ✅ **Check disk space** in backup directory

#### Weekly
- ✅ **Verify latest backup** is restorable
- ✅ **Review retention policy** (adjust if needed)

#### Monthly
- ✅ **Test disaster recovery** procedure
- ✅ **Archive old backups** to external storage
- ✅ **Audit backup size** trends

---

### Backup Size Management

**Current Size**: 450-470 KB per backup (11 MB database)

**Growth Projections**:

| Database Size | Backup Size | Storage for 10 Backups |
|---------------|-------------|------------------------|
| 11 MB (current) | ~470 KB | ~5 MB |
| 100 MB | ~50 MB | ~500 MB |
| 1 GB | ~500 MB | ~5 GB |
| 10 GB | ~5 GB | ~50 GB |

**When to Adjust**:
- **Retention count**: If backups > 1 GB each, reduce retention to 5
- **Backup frequency**: If database rarely changes, reduce frequency
- **Compression**: Already enabled (pg_dump -Fc)
- **Incremental**: Consider WAL archiving if > 100 GB

---

### Retention Policy

**Default**: Keep last 10 backups

**Calculation**:
```
With daily backups:
- 10 backups = 10 days of history
- ~5 MB disk space (current size)

With hourly backups:
- 10 backups = 10 hours of history
- ~5 MB disk space
```

**Adjustment**:
```bash
# Increase retention to 20
./scripts/backup-archon.sh --retention 20

# Decrease retention to 5 (for large databases)
./scripts/backup-archon.sh --retention 5
```

**Recommendation**:
- **Development**: 5-10 backups sufficient
- **Production**: 20+ backups for longer history
- **Critical systems**: Consider external archiving

---

### External Backup Storage

**Offsite Backup** (optional but recommended for production):

```bash
# 1. Create automated sync to external storage
# Example: Sync to external drive
rsync -av --delete \
  /home/ljutzkanov/Documents/Projects/archon/backups/ \
  /mnt/external/archon-backups/

# 2. Add to crontab (daily at 3 AM)
0 3 * * * rsync -av --delete /path/to/archon/backups/ /mnt/external/archon-backups/

# 3. Or use cloud storage (S3, GCS, Azure Blob)
aws s3 sync backups/ s3://my-bucket/archon-backups/
```

**Encryption** (for sensitive data):
```bash
# Encrypt backup before external storage
gpg --symmetric --cipher-algo AES256 \
  backups/archon_postgres-20251217_100000.dump

# Creates: archon_postgres-20251217_100000.dump.gpg
```

---

## Troubleshooting

### Issue 1: Backup Script Fails with "Container Not Found"

**Symptom**:
```
[✗] Supabase AI PostgreSQL container (supabase-ai-db) not found or not running
[✗] Please ensure local-ai-packaged services are running
```

**Cause**: Supabase container not running

**Solution**:
```bash
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
docker compose up -d supabase-ai-db
# Wait 30 seconds for initialization
cd /home/ljutzkanov/Documents/Projects/archon
./scripts/backup-archon.sh
```

---

### Issue 2: Backup API Returns 404

**Symptom**:
```bash
curl http://localhost:8181/api/backup/status
# Returns: 404 Not Found
```

**Cause**: Volume mount not configured or archon-server not running

**Diagnosis**:
```bash
# Check if archon-server is running
docker ps | grep archon-server

# Check volume mount
docker inspect archon-server --format '{{json .Mounts}}' | python3 -m json.tool | grep backups

# Check logs
docker logs archon-server | grep backup
```

**Solution**:
```bash
# 1. Verify docker-compose.yml has backup volume
grep -A 2 "backups" docker-compose.yml
# Should show: - ./backups:/app/backups:ro

# 2. If missing, add to archon-server volumes:
#    - ./backups:/app/backups:ro

# 3. Recreate containers
docker compose down && docker compose up -d
```

---

### Issue 3: Restore Fails with "Database Does Not Exist"

**Symptom**:
```
pg_restore: error: connection to server failed
```

**Cause**: PostgreSQL not initialized or database not created

**Solution**:
```bash
# 1. Check PostgreSQL status
docker exec supabase-ai-db pg_isready -U postgres

# 2. Check if database exists
docker exec supabase-ai-db psql -U postgres -lqt | grep postgres

# 3. If missing, create database
docker exec supabase-ai-db createdb -U postgres postgres

# 4. Retry restoration
./scripts/restore-archon.sh backups/latest.dump
```

---

### Issue 4: Backup Size Growing Too Large

**Symptom**: Backups > 1 GB each

**Analysis**:
```bash
# Check table sizes
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT tablename, pg_size_pretty(pg_total_relation_size('public.'||tablename))
   FROM pg_tables WHERE tablename LIKE 'archon_%' ORDER BY
   pg_total_relation_size('public.'||tablename) DESC;"
```

**Solutions**:

**1. Reduce retention**:
```bash
./scripts/backup-archon.sh --retention 5
```

**2. Archive old backups**:
```bash
# Move backups older than 7 days to archive
find backups/ -name "*.dump" -mtime +7 -exec mv {} backups/archive/ \;
```

**3. Implement incremental backups**:
```bash
# Weekly full backup
0 0 * * 0 /path/to/backup-archon.sh --retention 4

# Daily incremental (WAL archiving - advanced)
# See PostgreSQL WAL archiving documentation
```

---

### Issue 5: Cannot Access Backup Directory

**Symptom**:
```
[✗] Cannot create backup directory: Permission denied
```

**Cause**: Insufficient permissions on backup directory

**Solution**:
```bash
# Check permissions
ls -la backups/

# Fix permissions
sudo chown -R $USER:$USER backups/
chmod 755 backups/

# Or create with proper permissions
mkdir -p backups && chmod 755 backups/
```

---

### Issue 6: Dashboard Shows "API Unavailable"

**Symptom**: Monitor-TUI shows Archon backup as unavailable

**Diagnosis**:
```bash
# Test API directly
curl -v http://localhost:8181/api/backup/status

# Check archon-server logs
docker logs archon-server | tail -50

# Check network connectivity
docker exec archon-server curl http://localhost:8181/health
```

**Solution**:
```bash
# If network routing issue (VPN conflict)
# Check routing table
ip route | grep 172.

# If app-network conflicts with VPN
# Edit docker-compose.yml and change subnet:
# networks:
#   app-network:
#     driver: bridge
#     ipam:
#       config:
#         - subnet: 172.21.0.0/16

# Recreate network
docker compose down && docker compose up -d
```

---

## Best Practices

### ✅ DO

1. **Test restores regularly** - Monthly disaster recovery drills
2. **Monitor backup health** - Use dashboard or API endpoints
3. **Keep backups offsite** - External storage for critical data
4. **Backup before migrations** - Use `BACKUP_ON_START=true`
5. **Document credentials** - Store in password manager
6. **Automate backups** - Cron for production systems
7. **Verify backup integrity** - Periodically test restoration
8. **Monitor disk space** - Ensure sufficient space for retention
9. **Version control config** - Keep docker-compose.yml in git
10. **Encrypt sensitive backups** - Use GPG for external storage

### ❌ DON'T

1. **Don't commit .env to git** - Contains secrets
2. **Don't backup code** - Use git instead
3. **Don't backup containers** - Recreate from docker-compose.yml
4. **Don't ignore failing backups** - Fix immediately
5. **Don't skip restore testing** - Untested backups are worthless
6. **Don't use unlimited retention** - Disk space will fill up
7. **Don't store backups only locally** - Single point of failure
8. **Don't delay restores** - Data loss increases over time
9. **Don't ignore health warnings** - Aging backups are a risk
10. **Don't backup during migrations** - Wait for completion

---

## Comparison: Archon vs Local AI Platform

### Backup Complexity

| Aspect | Archon | Local AI Platform |
|--------|--------|-------------------|
| **Backup Target** | PostgreSQL only | Database + Files |
| **Backup Command** | Single pg_dump | Multi-step (DB + rsync) |
| **Backup Size** | < 1 MB (current) | GBs (with uploads) |
| **Restore Time** | < 10 minutes | Hours (file copy) |
| **Complexity** | Simple | Moderate |
| **Storage Needs** | Minimal | Significant |

### Why Archon is Simpler

**Archon**:
- ✅ Database-only persistence
- ✅ No file storage
- ✅ Stateless containers
- ✅ Single backup command
- ✅ Fast restoration

**Local AI Platform**:
- ⚠️ Multiple databases
- ⚠️ File storage (uploads, n8n workflows, flowise flows)
- ⚠️ Persistent volumes
- ⚠️ Multi-step backup
- ⚠️ Slower restoration

---

## Backup Checklist

### Pre-Backup

- [ ] Verify Supabase container running
- [ ] Check PostgreSQL is ready
- [ ] Ensure sufficient disk space (> 10x backup size)
- [ ] Confirm backup directory writable
- [ ] Stop long-running operations (optional)

### During Backup

- [ ] Monitor backup progress
- [ ] Verify backup file created
- [ ] Check file size (should be reasonable)
- [ ] Confirm no errors in output

### Post-Backup

- [ ] Verify backup file exists
- [ ] Check file integrity (pg_restore --list)
- [ ] Test restoration in dev environment
- [ ] Update documentation if needed
- [ ] Archive to external storage (if automated)

### Periodic Review (Monthly)

- [ ] Test full disaster recovery
- [ ] Review retention policy
- [ ] Check backup storage capacity
- [ ] Verify monitoring alerts work
- [ ] Update credentials if rotated
- [ ] Review and update this documentation

---

## References

### Internal Documentation

- [Database Architecture](/docs/DATABASE_MIGRATION_2025-12.md)
- [Network Architecture](/docs/NETWORK_ARCHITECTURE_AND_DATABASE_CONNECTION.md)
- [API Documentation](/python/src/server/api_routes/backup_api.py)

### External Resources

- [PostgreSQL Backup Guide](https://www.postgresql.org/docs/current/backup.html)
- [pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [pg_restore Documentation](https://www.postgresql.org/docs/current/app-pgrestore.html)

---

## Support

### Getting Help

**Documentation**: Check this file first
**Logs**: `docker logs archon-server | grep backup`
**API Status**: `curl http://localhost:8181/api/backup/status`
**Health Check**: `curl http://localhost:8181/api/backup/health`

### Reporting Issues

When reporting backup issues, include:
1. Error message and full output
2. Docker container status: `docker ps`
3. Backup script version
4. Database size: `docker exec supabase-ai-db psql -U postgres -d postgres -c "\dt+ archon_*"`
5. Available disk space: `df -h`

---

**Last Updated**: 2025-12-17
**Maintainer**: SportERP Team
**Backup Strategy Status**: Production Ready ✅
