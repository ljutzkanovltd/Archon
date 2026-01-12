# Unified Backup System Integration for Dangerous Operations

**Created:** 2026-01-12
**Purpose:** Integrate local-ai-packaged unified backup system with Archon's dangerous operations protocol

---

## Overview

This document describes how Archon integrates with the unified backup system from `local-ai-packaged` to provide comprehensive backups before dangerous database operations.

## Why This Was Implemented

After a critical incident on 2026-01-12 where the remote Supabase Cloud database schema was dropped without backup or approval, we established a comprehensive safety protocol that requires:

1. **Backup First** - Create verified backup before ANY dangerous operation
2. **Double Approval** - Request user approval twice before proceeding
3. **Automated Enforcement** - Use Claude Code hooks to block dangerous operations

## Unified Backup System

### Location
```
~/Documents/Projects/local-ai-packaged/scripts/backup-unified.sh
```

### What It Backs Up

**Databases (PostgreSQL):**
- `n8n_db` - n8n workflow automation database
- `langfuse_db` - Langfuse LLM observability database
- `flowise_db` - Flowise workflow database
- `odoo_db` - Odoo ERP database
- **`postgres`** - **Main Supabase database (includes ALL Archon tables)**
- `thefootballplatform` - Additional application database

**The `postgres` database contains all Archon tables:**
- `archon_settings` - Configuration and settings
- `archon_sources` - Knowledge sources
- `archon_crawled_pages` - Crawled documentation
- `archon_code_examples` - Code examples from documentation
- `archon_page_metadata` - Page metadata
- `archon_projects` - Project management
- `archon_tasks` - Task tracking
- `archon_task_history` - Task change history
- `archon_project_sources` - Project-source relationships
- `archon_document_versions` - Document version control
- `archon_migrations` - Migration history
- `archon_prompts` - Prompt templates
- `archon_llm_pricing` - LLM pricing data
- `archon_mcp_sessions` - MCP session tracking
- `archon_mcp_requests` - MCP request logs
- `archon_mcp_alerts` - MCP alert history
- `archon_mcp_error_logs` - MCP error logs
- `archon_agent_work_orders` - Agent work orders
- `archon_agent_work_order_steps` - Work order steps
- `archon_configured_repositories` - Repository configurations
- `archon_sync_history` - Database sync history

**Other Components:**
- Docker volumes (n8n_storage, qdrant, etc.)
- Bind mounts (Supabase, Neo4j, model metadata)
- Configuration files (.env, docker-compose.yml)
- Docker image tags for rollback
- SQLite databases (Open WebUI, Flowise)
- Neo4j graph database
- Qdrant vector database

### Backup Schedule

Automated backups run every 6 hours via cron/systemd:
- 00:00 UTC
- 06:00 UTC
- 12:00 UTC
- 18:00 UTC

### Backup Location

```
~/Documents/Projects/local-ai-packaged/backups/unified-backup-YYYYMMDD-HHMMSS/
├── databases/
│   ├── postgres.sql.gz          # 27MB - Archon database
│   ├── n8n_db.sql.gz
│   ├── langfuse_db.sql.gz
│   └── ...
├── volumes/
├── bind-mounts/
├── configs/
├── docker-images/
└── metadata/
```

### Backup Retention

- Default: Keep last 5 backups
- Configurable via `--retention N` flag
- Old backups automatically cleaned up

## Pre-Dangerous-Operation Script

### Location
```
~/Documents/Projects/archon/scripts/pre-dangerous-operation-backup.sh
```

### What It Does

1. **Checks for Recent Backup** (<1 hour old)
2. **Triggers New Backup** if needed (via unified backup system)
3. **Verifies Backup Integrity**:
   - postgres.sql.gz exists
   - Size > 1MB (minimum threshold)
   - gzip integrity check passes
4. **Returns Backup Information**:
   - BACKUP_PATH
   - POSTGRES_BACKUP path
   - BACKUP_SIZE
   - Recovery commands

### Usage

**Simple usage:**
```bash
cd ~/Documents/Projects/archon
bash scripts/pre-dangerous-operation-backup.sh
```

**Force new backup:**
```bash
bash scripts/pre-dangerous-operation-backup.sh --force
```

**Example output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Backup Ready for Dangerous Operation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Backup Location:
  Directory: /path/to/backups/unified-backup-20260112-114946
  Archon DB: /path/to/backups/unified-backup-20260112-114946/databases/postgres.sql.gz
  Size: 27M

Recovery Command:
  gunzip -c /path/to/backups/unified-backup-20260112-114946/databases/postgres.sql.gz | \
    docker exec -i supabase-ai-db psql -U postgres -d postgres

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BACKUP_PATH=/path/to/backups/unified-backup-20260112-114946
POSTGRES_BACKUP=/path/to/backups/unified-backup-20260112-114946/databases/postgres.sql.gz
BACKUP_SIZE=27262976
```

### Development Mode

The script uses `--dev` flag for faster backups:
- Only backs up critical databases (n8n_db, postgres)
- Skips observability volumes (~14GB of metrics)
- Takes 2-5 minutes instead of 10-15 minutes

## Integration with Dangerous Operations Protocol

### RULE 1: BACKUP FIRST

**Before ANY dangerous operation** (DROP, TRUNCATE, DELETE, rm -rf, etc.):

```bash
# MANDATORY step
cd ~/Documents/Projects/archon
bash scripts/pre-dangerous-operation-backup.sh

# Store output for recovery
BACKUP_INFO=$(bash scripts/pre-dangerous-operation-backup.sh)
BACKUP_PATH=$(echo "$BACKUP_INFO" | grep "BACKUP_PATH=" | cut -d'=' -f2)

# Now proceed with dangerous operation (after double approval)
```

### RULE 2: DOUBLE APPROVAL

After backup is verified:
1. **First approval:** Show backup info, explain operation impact
2. **Second approval:** Confirm operation with consequences

### Recovery Procedure

**If dangerous operation fails or causes issues:**

```bash
# Stop Archon services
cd ~/Documents/Projects/archon
./stop-archon.sh

# Restore from unified backup
BACKUP_PATH="/path/to/backups/unified-backup-TIMESTAMP"
gunzip -c "${BACKUP_PATH}/databases/postgres.sql.gz" | \
  docker exec -i supabase-ai-db psql -U postgres -d postgres

# Verify restoration
docker exec supabase-ai-db psql -U postgres -d postgres -c "\dt" | grep archon | wc -l
# Should show ~22 archon tables

docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_tasks"
# Should return task count

# Restart services
./start-archon.sh

# Verify functionality
curl http://localhost:8181/health
curl http://localhost:8051/health
```

## Alternative: Quick Archon-Only Backup

For rapid testing or if unified backup is unavailable:

```bash
# Create quick backup (< 30 seconds)
BACKUP_FILE="/tmp/archon-backup/pre-operation-$(date +%Y%m%d_%H%M%S).sql"
mkdir -p /tmp/archon-backup
docker exec supabase-ai-db pg_dump -U postgres -d postgres | gzip > "$BACKUP_FILE.gz"
ls -lh "$BACKUP_FILE.gz"

# Restore quick backup
./stop-archon.sh
gunzip -c "$BACKUP_FILE.gz" | \
  docker exec -i supabase-ai-db psql -U postgres -d postgres
./start-archon.sh
```

**Pros:**
- Fast (< 30 seconds)
- Simple single-command backup
- Works when unified backup unavailable

**Cons:**
- Only backs up Archon database (not full stack)
- No volume/config backups
- No automated retention
- Manual cleanup required

## Testing

### Test Backup Script
```bash
cd ~/Documents/Projects/archon
bash scripts/pre-dangerous-operation-backup.sh
```

**Expected:**
- ✓ Configuration checks passed
- ✓ Recent backup found (if <1 hour old) OR new backup triggered
- ✓ Backup verification passed
- ✓ Backup paths returned

### Test Recovery
```bash
# Create test backup
BACKUP_PATH=$(bash scripts/pre-dangerous-operation-backup.sh | grep "BACKUP_PATH=" | cut -d'=' -f2)

# Test restore (dry-run)
gunzip -c "${BACKUP_PATH}/databases/postgres.sql.gz" | head -100

# Verify SQL is valid
gunzip -c "${BACKUP_PATH}/databases/postgres.sql.gz" | grep -E "(CREATE TABLE|INSERT|COPY)" | head -10
```

## Troubleshooting

### Backup Script Fails

**Symptom:** `Unified backup failed` error

**Check:**
1. Is Supabase running? `docker ps | grep supabase-ai-db`
2. Is local-ai-packaged path correct? Check `LOCAL_AI_ROOT` variable
3. Disk space sufficient? `df -h ~`
4. Permissions? `ls -la ~/Documents/Projects/local-ai-packaged/backups/`

**Solution:**
```bash
# Check Supabase
docker ps | grep supabase

# Start local-ai-packaged if needed
cd ~/Documents/Projects/local-ai-packaged
python start_services.py --profile gpu-amd --amd-backend llamacpp-vulkan

# Wait 30 seconds for Supabase to initialize
sleep 30

# Retry backup
cd ~/Documents/Projects/archon
bash scripts/pre-dangerous-operation-backup.sh --force
```

### Backup Verification Fails

**Symptom:** `Postgres backup is too small (< 1MB)` or `corrupted`

**Check:**
```bash
# Check actual size
ls -lh ~/Documents/Projects/local-ai-packaged/backups/unified-backup-*/databases/postgres.sql.gz

# Test gzip integrity
gzip -t ~/Documents/Projects/local-ai-packaged/backups/unified-backup-*/databases/postgres.sql.gz

# Check if database has data
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_tasks"
```

### Recovery Fails

**Symptom:** Restore fails with errors

**Common Issues:**

1. **Database connection errors:**
```bash
# Ensure Supabase is running
docker ps | grep supabase-ai-db

# Check PostgreSQL is ready
docker exec supabase-ai-db psql -U postgres -c "SELECT 1"
```

2. **Permission errors:**
```bash
# Check file permissions
ls -la ~/Documents/Projects/local-ai-packaged/backups/unified-backup-*/databases/

# Run restore with explicit user
gunzip -c backup.sql.gz | docker exec -i supabase-ai-db psql -U postgres -d postgres
```

3. **Schema conflicts:**
```bash
# If tables already exist, drop schema first (DANGEROUS - backup first!)
docker exec supabase-ai-db psql -U postgres -d postgres -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
# Then restore
gunzip -c backup.sql.gz | docker exec -i supabase-ai-db psql -U postgres -d postgres
```

## Future Improvements

1. **Automated Hook Integration:**
   - Claude Code hooks automatically trigger backup before dangerous operations
   - Hooks block operations if backup fails

2. **Backup Health Monitoring:**
   - Dashboard showing last backup timestamp
   - Alert if backup > 6 hours old
   - Backup size trending

3. **Point-in-Time Recovery:**
   - WAL (Write-Ahead Logging) archival
   - Restore to specific timestamp
   - Requires pgBackRest or similar

4. **Remote Backup Storage:**
   - Sync backups to S3/Backblaze B2
   - Offsite disaster recovery
   - Encrypted at rest

5. **Backup Testing Automation:**
   - Automated restore tests
   - Schema validation
   - Data integrity checks

## References

- **Unified Backup Script:** `~/Documents/Projects/local-ai-packaged/scripts/backup-unified.sh`
- **Pre-Operation Script:** `~/Documents/Projects/archon/scripts/pre-dangerous-operation-backup.sh`
- **CLAUDE.md Protocol:** `.claude/CLAUDE.md` → DANGEROUS OPERATIONS PROTOCOL
- **Incident Report:** `docs/database-sync/TASK_2.4_COMPLETION_SUMMARY.md`

---

**Last Updated:** 2026-01-12
**Maintainer:** SportERP Team
**Status:** Production-ready
