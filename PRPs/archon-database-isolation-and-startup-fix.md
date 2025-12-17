# Implementation Plan: Archon Database Isolation & Startup Fix

> **STATUS: NOT IMPLEMENTED - SUPERSEDED BY ALTERNATIVE APPROACH**
>
> **Date**: December 2025
>
> **Reason**: This PRP proposed moving Archon to a dedicated `archon_db` database for isolation. However, an alternative approach was implemented instead:
> - **Actual Implementation** (Dec 9, 2025): Archon was migrated to the shared `postgres` database with table-level isolation using `archon_*` prefix
> - **Rationale**: PostgREST compatibility, industry-standard multi-tenant pattern, simpler architecture
> - **Current State**: 11 Archon tables in `postgres` database, fully operational
> - **Documentation**: See `/docs/DATABASE_MIGRATION_2025-12.md` and `.claude/CLAUDE.md` "Database Architecture" section
>
> **DNS Resolution Fix**: The DNS resolution issue (Phase 1) was resolved by adding `localai_default` network to containers (Dec 16, 2025), not by the `extra_hosts` approach proposed here.
>
> **Backup Strategy**: Backup infrastructure implemented with `/scripts/backup-archon.sh` and `/scripts/restore-archon.sh`, backing up the shared `postgres` database.
>
> This document is preserved for historical reference only.

---

## Overview

Fix critical DNS resolution failure preventing archon-server from starting, implement proper database isolation by moving Archon to dedicated `archon_db` database (fresh start), and establish comprehensive backup strategies to minimize blast radius across the platform.

## Requirements Summary

- **Critical**: archon-server container exits with "unhealthy" status due to DNS resolution failure
- **Critical**: Archon tables currently in `postgres` database (shared with Supabase core) - violates microservices isolation pattern
- **High**: Database confusion between `postgres` and `archon_db` - `.env` points to archon_db but tables are elsewhere
- **High**: Implement separation of concerns to minimize blast radius from database deletion scenarios
- **Medium**: Qdrant vector database warning (optional service, non-blocking)
- **Medium**: Establish automated backup strategies with clear recovery procedures
- **Low**: Update documentation to clarify database architecture and prevent future confusion

## Research Findings

### Critical Discovery: Catastrophic Blast Radius

**Current State:**
- Archon tables exist in `postgres` database (default Supabase database)
- `DROP DATABASE postgres` would destroy: Archon + Supabase core + ALL services
- Blast radius: **CATASTROPHIC** (entire platform failure)

**After Fix:**
- Archon tables in `archon_db` (dedicated isolated database)
- `DROP DATABASE archon_db` impact: Archon only (contained)
- Blast radius: **LOW** (single service failure)

### Database Architecture Discovery

**Current Platform Databases (supabase-ai-db container):**

| Database | Status | Contains | Blast Radius if Deleted |
|----------|--------|----------|-------------------------|
| **postgres** | 🔴 Critical | Archon tables + Supabase core | 💥 CATASTROPHIC (everything) |
| **archon_db** | ⚠️ Empty | Nothing (intended for Archon) | ✅ None (empty) |
| **n8n_db** | ✅ Isolated | n8n workflows | 🟡 n8n only |
| **langfuse_db** | ✅ Isolated | LLM traces | 🟢 Langfuse only |
| **flowise_db** | ✅ Isolated | Flowise flows | 🟢 Flowise only |
| **odoo_db** | ✅ Isolated | ERP data | 🔴 Odoo only (business data) |

**Resource Efficiency:**
- Single Supabase instance: ~2GB RAM
- Separate databases: Good isolation without multiple PostgreSQL containers
- Current approach aligns with industry best practices (database-per-service pattern)

### DNS Resolution Root Cause

**Error:** `httpx.ConnectError: [Errno -3] Temporary failure in name resolution`

**Cause:** Missing `extra_hosts` configuration in archon-server service

**Evidence:**
- archon-mcp service has `extra_hosts` (lines 107-108 docker-compose.yml) ✅ Working
- archon-agent-work-orders has `extra_hosts` (lines 198-199) ✅ Working
- archon-server service MISSING `extra_hosts` ❌ Broken

### Industry Best Practices

**Source: Martin Fowler - Microservices Resource Guide**

**Database-per-Service Pattern:**
- Each service owns its database
- No shared databases between services
- Full isolation for blast radius containment

**Current Compliance:**
- n8n, Langfuse, Flowise, Odoo: ✅ Compliant (isolated databases)
- **Archon + Supabase Core: ❌ VIOLATION** (shared postgres database)

**Recommendation:** Move Archon to `archon_db` for proper isolation

### User Decisions

1. **Archon Database Strategy:** Use `archon_db` (fresh start, no migration from postgres)
2. **Langfuse Consolidation:** Investigate PostgreSQL 15 compatibility before deciding
3. **Implementation Priority:** Investigate risks first, focus on separation of concerns

## Implementation Tasks

### Phase 1: Critical Fix - DNS Resolution (Immediate)

**Priority:** 🔴 CRITICAL - Blocks all Archon services

#### Task 1.1: Add extra_hosts to archon-server service

- **Description:** Enable DNS resolution for `host.docker.internal` by adding extra_hosts configuration
- **Files to modify:** `docker-compose.yml` (lines 10-73, archon-server service)
- **Dependencies:** None
- **Estimated effort:** 5 minutes

**Changes:**
```yaml
archon-server:
  # ... existing config ...
  extra_hosts:
    - "host.docker.internal:host-gateway"
  networks:
    - app-network
    - sporterp-ai-unified
```

**Location:** Insert after `environment` section, before `networks` section (around line 33)

#### Task 1.2: Restart archon-server container

- **Description:** Apply configuration changes
- **Command:** `docker compose restart archon-server` or `./start-archon.sh --force-restart`
- **Dependencies:** Task 1.1 complete
- **Estimated effort:** 2 minutes

#### Task 1.3: Verify archon-server health

- **Description:** Confirm container starts successfully and DNS resolution works
- **Verification commands:**
  ```bash
  # Check DNS resolution
  docker exec archon-server python3 -c "import socket; print(socket.gethostbyname('host.docker.internal'))"

  # Check container status
  docker ps --filter "name=archon-server" --format "{{.Status}}"

  # Check health endpoint
  curl http://localhost:8181/health

  # Check logs for successful initialization
  docker logs archon-server | grep "Database schema initialization complete"
  ```
- **Dependencies:** Task 1.2 complete
- **Estimated effort:** 3 minutes

**Success Criteria:**
- DNS resolution returns host gateway IP (e.g., 172.17.0.1)
- Container status shows "healthy"
- Health endpoint returns 200 OK
- No DNS errors in logs

---

### Phase 2: Database Isolation - Move Archon to archon_db (High Priority)

**Priority:** 🟡 HIGH - Reduces blast radius from catastrophic to low

#### Task 2.1: Backup current state (safety net)

- **Description:** Create backups before any database changes
- **Files to create:** Timestamped backup files in `/tmp/archon-migration-backup/`
- **Dependencies:** Phase 1 complete (Archon services running)
- **Estimated effort:** 10 minutes

**Commands:**
```bash
# Create backup directory
mkdir -p /tmp/archon-migration-backup

# Backup postgres database (contains current Archon tables)
docker exec supabase-ai-db pg_dump -U postgres -Fc postgres > \
  /tmp/archon-migration-backup/postgres_$(date +%Y%m%d_%H%M%S).dump

# Backup archon_db (should be empty, but verify)
docker exec supabase-ai-db pg_dump -U postgres -Fc archon_db > \
  /tmp/archon-migration-backup/archon_db_$(date +%Y%m%d_%H%M%S).dump

# Export Archon data only (for reference, not for import)
docker exec supabase-ai-db pg_dump -U postgres postgres \
  --table='public.archon_*' --data-only > \
  /tmp/archon-migration-backup/archon_data_reference_$(date +%Y%m%d_%H%M%S).sql
```

#### Task 2.2: Initialize fresh schema in archon_db

- **Description:** Run migration script on archon_db to create fresh Archon schema
- **Files to execute:** `migration/complete_setup.sql`
- **Dependencies:** Task 2.1 complete
- **Estimated effort:** 5 minutes

**Commands:**
```bash
# Run complete_setup.sql on archon_db
docker exec -i supabase-ai-db psql -U postgres archon_db < \
  /home/ljutzkanov/Documents/Projects/archon/migration/complete_setup.sql

# Verify schema created (should show 11 tables)
docker exec supabase-ai-db psql -U postgres -d archon_db -c "\dt public.archon*"

# Verify extensions (pgvector, pg_trgm, etc.)
docker exec supabase-ai-db psql -U postgres -d archon_db -c "\dx"
```

**Expected Output:**
```
archon_code_examples
archon_crawled_pages
archon_document_versions
archon_migrations
archon_page_metadata
archon_project_sources
archon_projects
archon_prompts
archon_settings
archon_sources
archon_tasks
```

#### Task 2.3: Configure PostgREST for archon_db

- **Description:** Update PostgREST to serve archon_db instead of postgres
- **Files to modify:** `~/Documents/Projects/local-ai-packaged/supabase/docker/docker-compose.yml`
- **Dependencies:** Task 2.2 complete
- **Estimated effort:** 10 minutes

**Investigation Required:**
- Locate PostgREST service in Supabase docker-compose.yml
- Find `PGRST_DB_URI` environment variable
- Change database name from `postgres` to `archon_db`

**Expected Change:**
```yaml
services:
  supabase-ai-rest:
    environment:
      # CHANGE FROM:
      - PGRST_DB_URI=postgresql://postgres:${POSTGRES_PASSWORD}@supabase-ai-db:5432/postgres

      # CHANGE TO:
      - PGRST_DB_URI=postgresql://postgres:${POSTGRES_PASSWORD}@supabase-ai-db:5432/archon_db
```

**Note:** May need to create separate PostgREST instance for Archon to avoid affecting other services

#### Task 2.4: Update start-archon.sh database target

- **Description:** Change database initialization script to target archon_db
- **Files to modify:** `start-archon.sh` (line 400)
- **Dependencies:** None (independent of other tasks)
- **Estimated effort:** 2 minutes

**Change:**
```bash
# Line 400: Change from postgres to archon_db
# OLD:
local target_db="postgres"

# NEW:
local target_db="archon_db"
```

#### Task 2.5: Restart Archon services with archon_db

- **Description:** Stop and restart Archon to use archon_db
- **Commands:**
  ```bash
  # Stop Archon
  cd /home/ljutzkanov/Documents/Projects/archon
  ./stop-archon.sh

  # Start Archon (will now use archon_db)
  ./start-archon.sh --skip-backup
  ```
- **Dependencies:** Tasks 2.2, 2.3, 2.4 complete
- **Estimated effort:** 5 minutes

#### Task 2.6: Verify Archon connects to archon_db

- **Description:** Confirm all Archon services use archon_db
- **Verification commands:**
  ```bash
  # Verify archon-server connects to archon_db
  docker exec archon-server sh -c 'echo "SUPABASE_URL=$SUPABASE_URL"'

  # Test database connectivity
  curl http://localhost:8181/api/settings

  # Verify PostgREST serves archon_db
  curl -H "apikey: $SUPABASE_SERVICE_KEY" http://localhost:18000/archon_settings

  # Check MCP server
  curl http://localhost:8051/health

  # Check frontend
  curl http://localhost:3737
  ```
- **Dependencies:** Task 2.5 complete
- **Estimated effort:** 5 minutes

**Success Criteria:**
- API endpoints respond successfully
- MCP server operational
- Frontend loads
- All services healthy

#### Task 2.7: Archive old tables in postgres (optional)

- **Description:** Move old Archon tables to archive schema for reference
- **Files to modify:** None (database schema changes only)
- **Dependencies:** Task 2.6 complete and verified
- **Estimated effort:** 5 minutes

**Commands:**
```bash
docker exec supabase-ai-db psql -U postgres postgres << 'EOF'
CREATE SCHEMA IF NOT EXISTS archon_legacy_archive;
COMMENT ON SCHEMA archon_legacy_archive IS 'Archive of Archon tables from before migration to archon_db (2025-12-03)';

-- Move old tables to archive schema (one at a time to avoid errors)
ALTER TABLE IF EXISTS public.archon_settings SET SCHEMA archon_legacy_archive;
ALTER TABLE IF EXISTS public.archon_sources SET SCHEMA archon_legacy_archive;
ALTER TABLE IF EXISTS public.archon_crawled_pages SET SCHEMA archon_legacy_archive;
ALTER TABLE IF EXISTS public.archon_code_examples SET SCHEMA archon_legacy_archive;
ALTER TABLE IF EXISTS public.archon_projects SET SCHEMA archon_legacy_archive;
ALTER TABLE IF EXISTS public.archon_tasks SET SCHEMA archon_legacy_archive;
ALTER TABLE IF EXISTS public.archon_project_sources SET SCHEMA archon_legacy_archive;
ALTER TABLE IF EXISTS public.archon_document_versions SET SCHEMA archon_legacy_archive;
ALTER TABLE IF EXISTS public.archon_migrations SET SCHEMA archon_legacy_archive;
ALTER TABLE IF EXISTS public.archon_prompts SET SCHEMA archon_legacy_archive;
ALTER TABLE IF EXISTS public.archon_page_metadata SET SCHEMA archon_legacy_archive;
EOF
```

**Note:** Can be deferred or skipped if fresh start is preferred

---

### Phase 3: Backup Strategy Implementation (Medium Priority)

**Priority:** 🟡 MEDIUM - Essential for disaster recovery

#### Task 3.1: Create unified backup script

- **Description:** Implement automated backup script for all databases with appropriate retention
- **Files to create:** `~/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh`
- **Dependencies:** Phase 2 complete
- **Estimated effort:** 20 minutes

**Implementation:**
```bash
#!/usr/bin/env bash
# Automated backup script for all databases
# Run via cron: 0 * * * * /path/to/backup-all-databases.sh

BACKUP_ROOT="/backups/supabase-ai"
CONTAINER="supabase-ai-db"
DATE=$(date +%Y%m%d_%H%M%S)

pg_dump_database() {
    local db=$1
    local retention=$2

    mkdir -p "$BACKUP_ROOT/$db"
    docker exec "$CONTAINER" pg_dump -U postgres -Fc "$db" > \
        "$BACKUP_ROOT/$db/backup_${db}_${DATE}.dump"

    # Cleanup old backups
    ls -t "$BACKUP_ROOT/$db"/backup_*.dump | tail -n +$((retention + 1)) | xargs -r rm
}

# Backup schedule based on criticality
HOUR=$(date +%H)

# postgres (Supabase core): every 6 hours (0, 6, 12, 18) - keep 30
if [[ $HOUR =~ ^(0|6|12|18)$ ]]; then
    pg_dump_database "postgres" 30
fi

# archon_db: daily at 2 AM - keep 14
if [[ $HOUR == "02" ]]; then
    pg_dump_database "archon_db" 14
fi

# n8n_db: daily at 3 AM - keep 14
if [[ $HOUR == "03" ]]; then
    pg_dump_database "n8n_db" 14
fi

# langfuse_db: weekly (Sunday 4 AM) - keep 4
if [[ $(date +%u) == "7" && $HOUR == "04" ]]; then
    pg_dump_database "langfuse_db" 4
fi

# odoo_db: every 4 hours during business hours (8, 12, 16, 20) - keep 60
if [[ $HOUR =~ ^(8|12|16|20)$ ]]; then
    pg_dump_database "odoo_db" 60
fi

echo "[$(date)] Backup completed" >> /var/log/database-backups.log
```

#### Task 3.2: Configure cron job for automated backups

- **Description:** Set up hourly cron job to run backup script
- **Files to modify:** User crontab
- **Dependencies:** Task 3.1 complete
- **Estimated effort:** 5 minutes

**Commands:**
```bash
# Add to crontab
(crontab -l 2>/dev/null; echo "0 * * * * /home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh >> /var/log/database-backups.log 2>&1") | crontab -

# Verify crontab
crontab -l | grep backup-all-databases

# Create log file
sudo touch /var/log/database-backups.log
sudo chown $USER:$USER /var/log/database-backups.log
```

#### Task 3.3: Test backup and restore procedures

- **Description:** Verify backup script works and restores are successful
- **Commands:**
  ```bash
  # Run backup script manually
  bash /home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh

  # Verify backup files created
  ls -lh /backups/supabase-ai/*/

  # Test restore on non-critical database (langfuse_db)
  docker exec -i supabase-ai-db pg_restore -U postgres -d langfuse_db -c < \
    /backups/supabase-ai/langfuse_db/backup_langfuse_db_*.dump
  ```
- **Dependencies:** Task 3.2 complete
- **Estimated effort:** 15 minutes

#### Task 3.4: Create disaster recovery runbook

- **Description:** Document step-by-step recovery procedures for each database
- **Files to create:** `docs/disaster-recovery-runbook.md`
- **Dependencies:** Task 3.3 complete
- **Estimated effort:** 30 minutes

**Content outline:**
- Recovery procedures per database
- RTO (Recovery Time Objective) and RPO (Recovery Point Objective)
- Emergency contact information
- Rollback procedures
- Verification checklists

---

### Phase 4: Documentation Updates (Medium Priority)

**Priority:** 🟡 MEDIUM - Prevents future confusion

#### Task 4.1: Update CLAUDE.md with database architecture

- **Description:** Add comprehensive database architecture section
- **Files to modify:** `.claude/CLAUDE.md`
- **Dependencies:** Phase 2 complete
- **Estimated effort:** 20 minutes

**Add section after "Environment Setup":**
```markdown
### Database Architecture

**Connection Method:**
- Archon connects to Supabase via REST API (PostgREST through Kong gateway)
- Does NOT use direct PostgreSQL connections from containers
- Uses `SUPABASE_URL` (Kong gateway) + `SUPABASE_SERVICE_KEY` for authentication

**Database Structure:**
- Archon tables exist in **`archon_db` database** (isolated from Supabase core)
- Supabase system tables in `postgres` database (default)
- Full isolation ensures blast radius containment

**Database Inventory (supabase-ai-db container):**
| Database | Purpose | Criticality | Backup Frequency |
|----------|---------|-------------|------------------|
| postgres | Supabase core only | 🔴 CRITICAL | Every 6 hours |
| archon_db | Archon knowledge base | 🟡 MEDIUM | Daily |
| n8n_db | n8n workflows | 🟡 MEDIUM | Daily |
| langfuse_db | LLM traces | 🟢 LOW | Weekly |
| flowise_db | Flowise flows | 🟢 LOW | Weekly |
| odoo_db | ERP data (local mode) | 🔴 CRITICAL | Every 4 hours |

**Environment Variables:**
- `SUPABASE_URL` - Required: Kong gateway endpoint (http://host.docker.internal:18000)
- `SUPABASE_SERVICE_KEY` - Required: Service role key for authentication
- `DATABASE_URI` - Not used by containers (legacy reference only)

**Blast Radius Protection:**
- Each service has dedicated database
- Deleting one database affects only that service
- `postgres` database deletion would affect Supabase core only (Archon isolated)
```

#### Task 4.2: Add DNS resolution troubleshooting

- **Description:** Document extra_hosts requirement and DNS resolution issues
- **Files to modify:** `.claude/CLAUDE.md`
- **Dependencies:** None
- **Estimated effort:** 10 minutes

**Add to "Common Issues & Solutions" section:**
```markdown
### DNS Resolution Error (host.docker.internal)

**Symptoms:** Container crashes with "Temporary failure in name resolution" or "httpx.ConnectError: [Errno -3]"

**Root Cause:** Missing `extra_hosts` configuration in docker-compose.yml

**Solutions:**
1. Verify `extra_hosts` is configured for the service:
   ```yaml
   services:
     archon-server:
       extra_hosts:
         - "host.docker.internal:host-gateway"
   ```

2. This is required for containers to resolve host services (Supabase Kong on port 18000)

3. Services requiring this configuration:
   - archon-server (critical)
   - archon-mcp (configured)
   - archon-agent-work-orders (configured)

4. Verify DNS resolution inside container:
   ```bash
   docker exec archon-server python3 -c "import socket; print(socket.gethostbyname('host.docker.internal'))"
   # Should output: 172.17.0.1 (or similar host gateway IP)
   ```

5. If missing, add to docker-compose.yml and restart:
   ```bash
   docker compose restart archon-server
   ```
```

#### Task 4.3: Document Qdrant optional status

- **Description:** Clarify that Qdrant warnings are expected and non-blocking
- **Files to modify:** `.claude/CLAUDE.md`
- **Dependencies:** None
- **Estimated effort:** 5 minutes

**Add to "Common Issues & Solutions" or create new section:**
```markdown
### Qdrant Vector Database Warnings

**Symptoms:** Warning message during startup: "Qdrant not available on port 6333 (optional)"

**Status:**
- ✅ Qdrant is truly optional for Archon startup
- ✅ Warning is informational only and will NOT prevent services from starting
- ⚠️ Vector search features may be limited without Qdrant
- ✅ Archon will function normally for knowledge base and task management

**Impact:**
- Knowledge base: ✅ Works (uses PostgreSQL full-text search)
- Task management: ✅ Works (no vector search needed)
- Code search: ⚠️ May be slower (no vector similarity)
- Document embeddings: ⚠️ Limited (no vector storage)

**To enable Qdrant (optional):**
1. Ensure local-ai-packaged is running with Qdrant service
2. Verify Qdrant is accessible: `curl http://localhost:6333/health`
3. Note: Qdrant in local-ai-packaged may be bound to localhost only
4. Check docker-compose.yml for port binding (should be `6333:6333` not `127.0.0.1:6333:6333`)
```

#### Task 4.4: Update backup documentation

- **Description:** Document backup strategies and recovery procedures
- **Files to modify:** `.claude/CLAUDE.md`
- **Dependencies:** Phase 3 complete
- **Estimated effort:** 15 minutes

**Add new section "Backup and Recovery":**
```markdown
### Backup and Recovery

**Automated Backups:**
- Script: `~/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh`
- Schedule: Hourly cron job (varies by database criticality)
- Location: `/backups/supabase-ai/{database}/`

**Backup Frequencies:**
| Database | Frequency | Retention | RTO | RPO |
|----------|-----------|-----------|-----|-----|
| postgres | Every 6 hours | 30 backups (7.5 days) | 30 min | 6 hours |
| archon_db | Daily 2 AM | 14 backups (2 weeks) | 15 min | 24 hours |
| n8n_db | Daily 3 AM | 14 backups (2 weeks) | 10 min | 24 hours |
| langfuse_db | Weekly Sun 4 AM | 4 backups (1 month) | 10 min | 7 days |
| odoo_db | Every 4 hours (8-20) | 60 backups (10 days) | 30 min | 4 hours |

**Manual Backup:**
```bash
# Backup specific database
docker exec supabase-ai-db pg_dump -U postgres -Fc archon_db > \
  archon_backup_$(date +%Y%m%d).dump
```

**Restore Procedure:**
```bash
# 1. Stop affected service
docker stop archon-server

# 2. Restore database
docker exec -i supabase-ai-db pg_restore -U postgres -d archon_db -c < \
  /backups/supabase-ai/archon_db/backup_archon_db_YYYYMMDD_HHMMSS.dump

# 3. Restart service
docker start archon-server

# 4. Verify
curl http://localhost:8181/health
```

**Disaster Recovery Runbook:** See `docs/disaster-recovery-runbook.md`
```

---

### Phase 5: Langfuse Consolidation Investigation (Low Priority)

**Priority:** 🟢 LOW - Optional optimization (saves ~500MB RAM)

#### Task 5.1: Check Langfuse PostgreSQL requirements

- **Description:** Investigate if Langfuse requires PostgreSQL 17 features
- **Files to read:** Langfuse documentation, docker-compose.yml
- **Dependencies:** None (independent investigation)
- **Estimated effort:** 30 minutes

**Investigation steps:**
1. Check Langfuse official documentation for PostgreSQL requirements
2. Review Langfuse changelog for PostgreSQL 17-specific features
3. Test Langfuse with PostgreSQL 15 (if possible in dev environment)
4. Document findings in decision matrix

#### Task 5.2: Decision: Consolidate or keep separate

- **Description:** Based on Task 5.1 findings, decide whether to consolidate
- **Dependencies:** Task 5.1 complete
- **Estimated effort:** 10 minutes

**Decision Matrix:**

**If PostgreSQL 15 compatible:**
- ✅ Consolidate to `langfuse_db` in Supabase
- ✅ Remove `localai-postgres-1` container
- ✅ Save ~500MB RAM
- ✅ Simplify backup strategy

**If PostgreSQL 17 required:**
- ✅ Keep separate container
- ✅ Remove unused `langfuse_db` from Supabase init script
- ✅ Document reason for separation

#### Task 5.3: Implement consolidation (if applicable)

- **Description:** If Task 5.2 decides to consolidate, migrate Langfuse to Supabase
- **Files to modify:** `~/Documents/Projects/local-ai-packaged/docker-compose.yml`
- **Dependencies:** Task 5.2 decision = consolidate
- **Estimated effort:** 45 minutes

**Steps:**
1. Backup current Langfuse database
2. Create langfuse_db in Supabase (already exists)
3. Migrate data from PostgreSQL 17 to PostgreSQL 15
4. Update Langfuse connection strings
5. Test Langfuse services
6. Remove localai-postgres-1 container from docker-compose.yml

---

## Codebase Integration Points

### Files to Modify

**Critical (Phase 1):**
1. `docker-compose.yml` (lines 10-73)
   - Add `extra_hosts` section to archon-server service
   - Insert after line 33 (environment section)

**High Priority (Phase 2):**
2. `start-archon.sh` (line 400)
   - Change `local target_db="postgres"` to `local target_db="archon_db"`

3. `~/Documents/Projects/local-ai-packaged/supabase/docker/docker-compose.yml` (location TBD)
   - Update PostgREST `PGRST_DB_URI` to point to archon_db
   - May require creating separate PostgREST instance for Archon

**Medium Priority (Phase 3):**
4. Create `~/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh`
   - New file with backup automation

5. User crontab
   - Add hourly backup schedule

**Medium Priority (Phase 4):**
6. `.claude/CLAUDE.md` (multiple sections)
   - Add "Database Architecture" after "Environment Setup"
   - Add DNS troubleshooting to "Common Issues & Solutions"
   - Add Qdrant optional status documentation
   - Add "Backup and Recovery" section

7. Create `docs/disaster-recovery-runbook.md`
   - New comprehensive recovery guide

### New Files to Create

1. `/tmp/archon-migration-backup/` directory
   - Temporary backup storage during migration

2. `/backups/supabase-ai/` directory structure
   - Permanent backup storage location

3. `~/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh`
   - Automated backup script

4. `docs/disaster-recovery-runbook.md`
   - Recovery procedures documentation

5. `/var/log/database-backups.log`
   - Backup execution log

### Existing Patterns to Follow

**Docker Compose extra_hosts pattern:**
- archon-mcp already has correct configuration (lines 107-108)
- archon-agent-work-orders has correct configuration (lines 198-199)
- Follow same indentation and format for archon-server

**Database initialization pattern:**
- Use `CREATE TABLE IF NOT EXISTS` (idempotent)
- Use `CREATE EXTENSION IF NOT EXISTS` (safe)
- No `DROP` statements in migration scripts

**Backup script pattern:**
- See existing `backup-n8n.sh` for reference
- Use `pg_dump -Fc` (custom format for compression)
- Implement retention policy with `ls -t | tail`

## Technical Design

### DNS Resolution Flow (After Fix)

```
Container Startup
    ↓
Resolve: host.docker.internal
    ↓ (extra_hosts maps to host gateway)
Host Network Interface (172.17.0.1)
    ↓
Kong Gateway (localhost:18000)
    ↓
PostgREST (serves archon_db)
    ↓
PostgreSQL (archon_db database)
```

### Database Isolation Architecture (After Migration)

```
supabase-ai-db Container (PostgreSQL 15)
│
├── postgres Database (Supabase Core ONLY)
│   ├── auth.* (Supabase authentication)
│   ├── storage.* (Supabase storage)
│   ├── realtime.* (Supabase realtime)
│   └── extensions (pgvector, pg_trgm, etc.)
│
├── archon_db Database (Archon ISOLATED) ← NEW HOME
│   ├── archon_settings
│   ├── archon_sources
│   ├── archon_crawled_pages
│   ├── archon_code_examples
│   ├── archon_projects
│   ├── archon_tasks
│   ├── archon_project_sources
│   ├── archon_document_versions
│   ├── archon_migrations
│   ├── archon_prompts
│   └── archon_page_metadata
│
├── n8n_db Database (n8n ISOLATED)
│   └── n8n workflow tables
│
├── langfuse_db Database (Langfuse ISOLATED)
│   └── Langfuse trace tables
│
├── flowise_db Database (Flowise ISOLATED)
│   └── Flowise flow tables
│
└── odoo_db Database (Odoo ISOLATED)
    └── Odoo ERP tables
```

**Blast Radius Protection:**
- ❌ Before: `DROP DATABASE postgres` → CATASTROPHIC (Archon + Supabase + ALL services)
- ✅ After: `DROP DATABASE archon_db` → LOW (Archon only, everything else continues)

### Backup Strategy Architecture

```
Hourly Cron Job
    ↓
backup-all-databases.sh
    ↓
Schedule-based execution:
    ├── Every 6 hours → pg_dump postgres (keep 30)
    ├── Daily 2 AM → pg_dump archon_db (keep 14)
    ├── Daily 3 AM → pg_dump n8n_db (keep 14)
    ├── Weekly Sun 4 AM → pg_dump langfuse_db (keep 4)
    └── Every 4 hours (8-20) → pg_dump odoo_db (keep 60)
    ↓
/backups/supabase-ai/{database}/
    └── backup_{database}_YYYYMMDD_HHMMSS.dump
    ↓
Automatic retention cleanup
    └── Delete backups older than retention policy
```

## Dependencies and Libraries

No new dependencies required - this is a configuration and database isolation project.

**Existing tools used:**
- PostgreSQL client tools (pg_dump, pg_restore, psql)
- Docker Compose
- Bash scripting
- Cron for automation

## Testing Strategy

### Phase 1 Testing (DNS Resolution)

**Test 1.1: DNS Resolution**
```bash
docker exec archon-server python3 -c "import socket; print(socket.gethostbyname('host.docker.internal'))"
# Expected: 172.17.0.1 (or similar host gateway IP)
```

**Test 1.2: Container Health**
```bash
docker ps --filter "name=archon-server" --format "{{.Status}}"
# Expected: Status includes "healthy"
```

**Test 1.3: HTTP Connectivity**
```bash
curl -v http://localhost:8181/health
# Expected: HTTP 200 OK with JSON response
```

### Phase 2 Testing (Database Isolation)

**Test 2.1: Schema Verification**
```bash
docker exec supabase-ai-db psql -U postgres -d archon_db -c "\dt public.archon*" | wc -l
# Expected: 11 tables
```

**Test 2.2: API Functionality**
```bash
curl http://localhost:8181/api/settings
# Expected: Settings response (empty or configured settings)
```

**Test 2.3: MCP Server**
```bash
curl http://localhost:8051/health
# Expected: Healthy status
```

**Test 2.4: Database Connection**
```bash
docker exec archon-server sh -c 'curl -s $SUPABASE_URL/archon_settings -H "apikey: $SUPABASE_SERVICE_KEY"'
# Expected: PostgREST response from archon_db
```

**Test 2.5: Isolation Verification**
```bash
# Verify old postgres tables are archived or removed
docker exec supabase-ai-db psql -U postgres -d postgres -c "\dt public.archon*"
# Expected: No tables (or moved to archon_legacy_archive schema)

# Verify new archon_db tables exist
docker exec supabase-ai-db psql -U postgres -d archon_db -c "\dt public.archon*"
# Expected: 11 archon tables
```

### Phase 3 Testing (Backup Strategy)

**Test 3.1: Backup Script Execution**
```bash
bash /home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh
# Expected: Exit code 0, backup files created
```

**Test 3.2: Backup Files Created**
```bash
ls -lh /backups/supabase-ai/archon_db/
# Expected: backup_archon_db_*.dump files
```

**Test 3.3: Restore Test (Non-Production Database)**
```bash
# Test restore on langfuse_db (low criticality)
docker exec -i supabase-ai-db pg_restore -U postgres -d langfuse_db -c < \
  /backups/supabase-ai/langfuse_db/backup_langfuse_db_*.dump
# Expected: Exit code 0, Langfuse service continues working
```

**Test 3.4: Cron Job Verification**
```bash
crontab -l | grep backup-all-databases
# Expected: Cron entry present

# Check log file after first automated run
tail -f /var/log/database-backups.log
# Expected: Backup completion messages
```

### Edge Cases to Cover

**Edge Case 1: PostgREST Schema Cache**
- After changing PostgREST database target, schema cache may be stale
- Solution: Restart PostgREST or wait for cache refresh (30s default)
- Test: Query archon_db tables via PostgREST immediately after restart

**Edge Case 2: In-Flight Transactions During Backup**
- `pg_dump` may include uncommitted data
- Solution: `pg_dump -Fc` creates consistent snapshot automatically
- Test: Run backup during active write operations

**Edge Case 3: Disk Space for Backups**
- Backup retention may fill disk
- Solution: Retention policies and monitoring
- Test: Verify old backups are deleted after retention limit

**Edge Case 4: Container Restart During Backup**
- Container restart may interrupt backup
- Solution: Backups run on database container (supabase-ai-db) not Archon containers
- Test: Restart archon-server during backup, verify backup completes

## Success Criteria

### Phase 1: Critical Fix (DNS Resolution)
- [x] Research completed and root cause identified
- [ ] archon-server container starts without DNS errors
- [ ] archon-server health check passes (status: healthy)
- [ ] HTTP health endpoint responds: `curl http://localhost:8181/health`
- [ ] DNS resolution works: `host.docker.internal` resolves to host gateway
- [ ] All Archon services running: archon-server, archon-mcp, archon-ui

### Phase 2: Database Isolation
- [ ] archon_db database contains all 11 Archon tables
- [ ] Archon services connect to archon_db (not postgres)
- [ ] PostgREST serves from archon_db
- [ ] postgres database clean (Supabase core only, no Archon tables)
- [ ] API endpoints respond successfully
- [ ] MCP server operational
- [ ] Frontend loads correctly
- [ ] Old tables archived or removed from postgres (optional)

### Phase 3: Backup Strategy
- [ ] Automated backup script created and tested
- [ ] Cron job configured and running
- [ ] Backup files created for all databases
- [ ] Restore procedure tested and documented
- [ ] Backup logs show successful executions
- [ ] Retention policy working (old backups deleted)

### Phase 4: Documentation
- [ ] CLAUDE.md updated with database architecture
- [ ] DNS resolution troubleshooting documented
- [ ] Qdrant optional status documented
- [ ] Backup and recovery procedures documented
- [ ] Disaster recovery runbook created

### Phase 5: Langfuse Investigation
- [ ] PostgreSQL requirements researched
- [ ] Consolidation decision made with rationale
- [ ] Implementation completed (if applicable)

## Notes and Considerations

### Why This Issue Occurred

**DNS Resolution Failure:**
- archon-mcp and archon-agent-work-orders were correctly configured with extra_hosts
- archon-server configuration was incomplete (missing extra_hosts)
- No error during compose file validation (valid YAML syntax)
- Error only surfaces during runtime when DNS lookup attempted

**Database Confusion:**
- Archon originally designed to use dedicated database (archon_db)
- Implementation put tables in postgres database (default)
- `.env` configuration points to archon_db but code uses Supabase client (which defaults to postgres)
- No DATABASE_URI environment variable passed to containers (unused)
- Start script hardcoded to postgres database (line 400)

### Why Database Isolation is Critical

**Blast Radius Containment:**
- Microservices architecture principle: Each service owns its data
- Shared database creates catastrophic failure point
- Isolation limits impact of human errors (accidental deletion)
- Independent backup/restore per service

**Current Risk:**
- `DROP DATABASE postgres` destroys Archon + Supabase + ALL authenticated services
- No recovery without full volume reset (ALL data lost)

**After Fix:**
- `DROP DATABASE archon_db` affects only Archon
- Restore from backup in 15 minutes
- Other services continue running

### Potential Challenges

**Challenge 1: PostgREST Configuration Complexity**
- PostgREST may be shared between services
- Changing database target affects all services using PostgREST
- Solution: May need separate PostgREST instance for Archon

**Challenge 2: Schema Cache Refresh**
- PostgREST caches database schema for performance
- After migration, cache may be stale
- Solution: Restart PostgREST or wait for cache refresh (configurable, default 30s)

**Challenge 3: Backup Storage Growth**
- Daily backups accumulate disk space
- Retention policies prevent unlimited growth
- Solution: Monitor `/backups/` directory size, adjust retention as needed

**Challenge 4: Migration Downtime**
- Archon services must be stopped during migration
- Estimated downtime: 15 minutes
- Solution: Schedule during low-usage period, notify stakeholders

### Future Enhancements

**Short-term (This Quarter):**
1. Implement off-site backups (S3, Azure Blob, or remote rsync)
2. Add database monitoring (disk space, connection counts, locks)
3. Create automated restore testing (monthly verification)
4. Implement pre-deletion confirmation prompts for destructive operations

**Long-term (Next Quarter):**
5. Consider separate Supabase instances for different service categories
6. Evaluate database replication for high-availability
7. Implement database audit logging (schema changes, permission changes)
8. Quarterly disaster recovery drills

### Alternative Approaches Considered

**Alternative 1: Migrate old data to archon_db**
- **Rejected:** User prefers fresh start, no migration
- **Complexity:** Higher (data migration + testing)
- **Risk:** Higher (data corruption risk)
- **Benefit:** Preserves existing data

**Alternative 2: Keep Archon in postgres, separate schemas**
- **Rejected:** Doesn't solve blast radius problem
- **Complexity:** Medium (schema management)
- **Risk:** Medium (still shared database)
- **Benefit:** No migration needed

**Alternative 3: Separate PostgreSQL container for Archon**
- **Rejected:** Unnecessary resource overhead
- **Complexity:** Higher (additional container management)
- **Risk:** Lower (maximum isolation)
- **Benefit:** Full isolation at cost of ~400MB RAM

**Selected Approach: Fresh archon_db (Recommended)**
- ✅ Clean separation of concerns
- ✅ Follows microservices best practices
- ✅ Minimal complexity (no data migration)
- ✅ Fast implementation (2-3 hours)
- ✅ Low risk (fresh start)
- ✅ Good resource efficiency (shared PostgreSQL instance)

### Recovery Strategy for Each Database

| Database | Criticality | RTO | RPO | Recovery Complexity |
|----------|-------------|-----|-----|-------------------|
| **postgres** | 🔴 CRITICAL | 30 min | 6 hours | HIGH (affects all) |
| **archon_db** | 🟡 MEDIUM | 15 min | 24 hours | LOW (isolated) |
| **n8n_db** | 🟡 MEDIUM | 10 min | 24 hours | LOW (isolated) |
| **langfuse_db** | 🟢 LOW | 10 min | 7 days | LOW (ephemeral) |
| **odoo_db** | 🔴 CRITICAL | 30 min | 4 hours | MEDIUM (business data) |

**RTO (Recovery Time Objective):** How long to restore service
**RPO (Recovery Point Objective):** Maximum acceptable data loss

---

## Execution Timeline

### Immediate (Today - 2 hours)
- Phase 1: Critical Fix (DNS Resolution) - 10 minutes
- Phase 2: Database Isolation (Tasks 2.1-2.6) - 45 minutes
- Initial testing and verification - 30 minutes
- Documentation of changes - 15 minutes

### This Week (3 hours)
- Phase 2: Complete archiving of old tables - 30 minutes
- Phase 3: Backup Strategy Implementation - 60 minutes
- Phase 4: Documentation Updates - 60 minutes
- Comprehensive testing - 30 minutes

### This Month (2 hours)
- Phase 5: Langfuse Investigation - 60 minutes
- Disaster recovery runbook creation - 30 minutes
- Backup verification and testing - 30 minutes

**Total Estimated Effort:** 7 hours spread over 1 month

**Priority Execution Order:**
1. **Critical (Do Now):** Phase 1 → Unblocks all Archon services
2. **High (This Week):** Phase 2 → Eliminates catastrophic blast radius
3. **Medium (This Week):** Phase 3 & 4 → Protects against data loss
4. **Low (This Month):** Phase 5 → Optional optimization

---

*This plan is ready for execution. Each phase can be implemented independently with clear rollback procedures.*
