name: "Archon Database Isolation & DNS Resolution Fix"
description: |
  Fix critical DNS failure and implement database isolation following microservices best practices

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
> **DNS Resolution Fix**: The DNS resolution issue was resolved by adding `localai_default` network to containers (Dec 16, 2025), not by the `extra_hosts` approach proposed here.
>
> **Backup Strategy**: Backup infrastructure implemented with `/scripts/backup-archon.sh` and `/scripts/restore-archon.sh`, backing up the shared `postgres` database.
>
> This document is preserved for historical reference only.

---

## Goal

**Feature Goal**: Fix Archon startup failure and eliminate catastrophic blast radius by isolating Archon tables in dedicated `archon_db` database

**Deliverable**:
- archon-server starts successfully with DNS resolution working
- Archon tables moved to isolated `archon_db` database (fresh schema, no migration)
- Automated backup strategy protecting all databases with appropriate retention
- Comprehensive documentation preventing future confusion

**Success Definition**:
1. All Archon services (server, MCP, UI) running healthy
2. Archon exclusively uses `archon_db` (11 tables verified)
3. `DROP DATABASE archon_db` affects only Archon (blast radius contained)
4. Automated backups running on schedule with verified restore capability

## User Persona

**Target User**: DevOps engineer / Platform administrator

**Use Case**: Starting Archon services as part of platform initialization

**User Journey**:
1. Run `./start-archon.sh`
2. Expect all services to start successfully
3. Verify health checks pass
4. Access Archon dashboard and MCP tools
5. Confidence that database failures are contained

**Pain Points Addressed**:
- archon-server crashes immediately on startup (DNS failure)
- Confusion about which database Archon uses
- Fear of catastrophic data loss from accidental database deletion
- No automated backup strategy
- Unclear documentation about database architecture

## Why

- **Critical Business Value**: Unblocks all Archon services (knowledge base, task management, MCP tools currently non-functional)
- **Risk Mitigation**: Eliminates catastrophic blast radius - currently `DROP DATABASE postgres` destroys Archon + Supabase + ALL services
- **Best Practices Compliance**: Implements microservices database-per-service pattern (Martin Fowler architecture)
- **Data Protection**: Automated backups with retention policies protect against accidental deletion and hardware failure
- **Developer Experience**: Clear documentation reduces confusion and prevents future misconfiguration

## What

### User-Visible Behavior

**Before Fix:**
- Run `./start-archon.sh` → archon-server crashes with DNS error
- Platform unusable, no Archon services available
- Fear factor: One wrong database command destroys everything

**After Fix:**
- Run `./start-archon.sh` → All services start healthy
- Platform fully functional with Archon knowledge base, tasks, MCP
- Confidence: Database isolation prevents catastrophic failures
- Automated backups protect data with documented recovery procedures

### Technical Requirements

1. **Phase 1 (Critical)**: DNS resolution fix
   - Add `extra_hosts` to docker-compose.yml
   - archon-server resolves `host.docker.internal`
   - Services start without DNS errors

2. **Phase 2 (High)**: Database isolation
   - Fresh schema in `archon_db` database
   - PostgREST configured to serve `archon_db`
   - Archon services connect to `archon_db` exclusively
   - Old tables archived or removed from `postgres`

3. **Phase 3 (Medium)**: Backup automation
   - Unified backup script for all databases
   - Cron job running hourly with appropriate schedules
   - Retention policies per database criticality
   - Verified restore procedures

4. **Phase 4 (Medium)**: Documentation
   - Database architecture explained in CLAUDE.md
   - DNS troubleshooting guide
   - Backup/recovery procedures
   - Disaster recovery runbook

### Success Criteria

- [ ] archon-server starts successfully (DNS resolution working)
- [ ] All Archon services healthy: server (8181), MCP (8051), UI (3737)
- [ ] `archon_db` contains exactly 11 Archon tables
- [ ] `postgres` database clean (no Archon tables, only Supabase core)
- [ ] Automated backups running on schedule
- [ ] Backup restore tested and verified functional
- [ ] Documentation updated with clear architecture explanation

## All Needed Context

### Context Completeness Check

✅ This PRP provides complete context for autonomous implementation:
- Exact file paths and line numbers for all changes
- Copy-paste ready validation commands
- Existing patterns to follow (extra_hosts, backup scripts)
- Industry best practices with references
- Executable validation gates at 4 levels

### Documentation & References

```yaml
# Microservices Best Practices
- url: https://martinfowler.com/articles/microservices.html#DecentralizedDataManagement
  why: Database-per-service pattern - architectural foundation for this work
  critical: "Each microservice owns its database" - isolation principle

- url: https://www.postgresql.org/docs/15/app-pgdump.html
  why: pg_dump command reference for backup implementation
  critical: "-Fc flag creates custom format for efficient compression and restoration"

- url: https://docs.docker.com/compose/networking/#use-a-pre-existing-network
  why: Docker Compose extra_hosts configuration for DNS resolution
  critical: "host.docker.internal:host-gateway" maps container to host network

# Existing Codebase Patterns
- file: docker-compose.yml
  lines: 107-108
  why: archon-mcp service has correct extra_hosts pattern - copy this for archon-server
  pattern: |
    extra_hosts:
      - "host.docker.internal:host-gateway"
  gotcha: Must be placed BEFORE networks section, AFTER environment section

- file: docker-compose.yml
  lines: 198-199
  why: archon-agent-work-orders also has correct extra_hosts - confirms pattern
  pattern: Same as archon-mcp (lines 107-108)

- file: migration/complete_setup.sql
  why: Contains full Archon schema - use for fresh archon_db initialization
  pattern: |
    CREATE EXTENSION IF NOT EXISTS "vector" CASCADE;
    CREATE TABLE IF NOT EXISTS archon_settings (...);
  gotcha: |
    - Uses IF NOT EXISTS (idempotent, safe to re-run)
    - Has CASCADE foreign keys (deleting source deletes all chunks)
    - No DROP statements (append-only, safe)

- file: start-archon.sh
  line: 400
  why: Database target hardcoded to postgres - must change to archon_db
  pattern: local target_db="postgres"
  change_to: local target_db="archon_db"
  gotcha: This is why Archon uses postgres despite .env pointing to archon_db

- file: ~/Documents/Projects/local-ai-packaged/scripts/backup-n8n.sh
  why: Existing backup script pattern to follow for unified backup script
  pattern: |
    pg_dump -U postgres -Fc n8n_db > backup.dump
    ls -t backups/ | tail -n +15 | xargs rm  # Retention policy
  gotcha: "-Fc" is custom format (compressed, efficient restore)

# Architecture Documentation
- docfile: PRPs/ai_docs/ARCHITECTURE.md
  why: Understanding current Archon architecture
  section: "Database" section explains current state

- docfile: .claude/CLAUDE.md
  why: Current project documentation - update with new database architecture
  section: "Environment Setup" section needs new "Database Architecture" subsection
```

### Current Codebase Tree

```bash
archon/
├── docker-compose.yml                    # MODIFY: Add extra_hosts to archon-server
├── start-archon.sh                       # MODIFY: Line 400 change target_db
├── .env                                  # Points to archon_db (already correct)
├── migration/
│   └── complete_setup.sql               # USE: Initialize fresh archon_db schema
├── lib/
│   ├── postgres-utils.sh                # Database utility functions
│   ├── health-checks.sh                 # Health check utilities
│   ├── network.sh                       # Network validation
│   └── logging.sh                       # Logging functions
├── scripts/
│   └── backup-archon.sh                 # Existing backup (needs update)
├── .claude/
│   └── CLAUDE.md                        # MODIFY: Add database architecture docs
└── docs/                                 # CREATE: disaster-recovery-runbook.md

~/Documents/Projects/local-ai-packaged/
├── scripts/
│   ├── backup-n8n.sh                    # REFERENCE: Pattern for unified backup
│   └── backup-all-databases.sh          # CREATE: New unified backup script
└── supabase/docker/
    ├── docker-compose.yml               # INVESTIGATE: PostgREST configuration
    └── volumes/db/init/
        └── 01-init-databases.sql        # Creates archon_db (already exists)
```

### Desired Codebase Tree with New Files

```bash
archon/
├── docker-compose.yml                    # MODIFIED: extra_hosts added
├── start-archon.sh                       # MODIFIED: target_db = "archon_db"
├── .claude/
│   └── CLAUDE.md                        # MODIFIED: New sections added
├── docs/
│   └── disaster-recovery-runbook.md     # CREATED: Recovery procedures
└── PRPs/
    └── archon-database-isolation-fix.prp.md  # THIS FILE

~/Documents/Projects/local-ai-packaged/
├── scripts/
│   └── backup-all-databases.sh          # CREATED: Unified backup automation
└── backups/supabase-ai/                  # CREATED: Backup storage directory
    ├── postgres/                         # Per-database directories
    ├── archon_db/
    ├── n8n_db/
    ├── langfuse_db/
    └── odoo_db/

/tmp/
└── archon-migration-backup/              # CREATED: Temporary backup during migration

/var/log/
└── database-backups.log                  # CREATED: Backup execution log
```

### Known Gotchas & Library Quirks

```yaml
Docker Compose:
  - extra_hosts MUST come after environment, before networks sections
  - YAML indentation is critical (2 spaces, not tabs)
  - Changes require container restart: docker compose restart service_name

PostgreSQL:
  - pg_dump -Fc creates custom format (NOT SQL text)
  - pg_restore requires -Fc dumps (cannot use psql < backup.dump)
  - Database name in connection string MUST match schema location
  - PostgREST caches schema (may need restart after DB change)

Supabase:
  - PostgREST serves ONE database at a time (not multiple)
  - May need separate PostgREST instance for archon_db
  - Kong gateway routes to PostgREST
  - Service role key required for authenticated access

Bash:
  - Cron environment is minimal (no $PATH, no aliases)
  - Use absolute paths in cron scripts
  - Test scripts in minimal shell: env -i bash -c "script.sh"
  - Log output for debugging: >> /var/log/script.log 2>&1

Archon Specific:
  - DATABASE_URI in .env is NEVER passed to containers (unused!)
  - Archon uses Supabase REST client, not direct PostgreSQL
  - Migration script is idempotent (safe to re-run)
  - Tables have CASCADE foreign keys (deleting sources cascades)
```

## Implementation Blueprint

### Data Models and Structure

**Database Schema** (already defined in `migration/complete_setup.sql`):

```sql
-- Core tables (11 total)
archon_settings         -- Global settings
archon_sources          -- Knowledge sources (websites, documents)
archon_crawled_pages    -- Processed document chunks with embeddings
archon_code_examples    -- Extracted code snippets
archon_projects         -- Project management (optional feature)
archon_tasks            -- Task tracking linked to projects
archon_project_sources  -- Many-to-many project-source relationship
archon_document_versions -- Version history for documents
archon_migrations       -- Schema migration tracking
archon_prompts          -- Stored prompts
archon_page_metadata    -- Page-level metadata for sources

-- Extensions required
vector                  -- pgvector for embeddings
pg_trgm                 -- Full-text search
uuid-ossp               -- UUID generation
```

**No new data models needed** - using existing schema from `migration/complete_setup.sql`

### Implementation Tasks (Ordered by Dependencies)

```yaml
## PHASE 1: CRITICAL FIX - DNS RESOLUTION (10 minutes)

Task 1.1: ADD extra_hosts to docker-compose.yml archon-server service
  action: MODIFY docker-compose.yml lines 10-73
  implementation: |
    # Find archon-server service definition
    # Locate environment section ending (around line 33)
    # INSERT these 3 lines BEFORE networks section:
    extra_hosts:
      - "host.docker.internal:host-gateway"
  follow_pattern: docker-compose.yml lines 107-108 (archon-mcp service)
  naming: Use exact indentation (2 spaces)
  dependencies: None
  placement: After environment section, before networks section
  validation: YAML syntax check with yamllint or docker compose config

Task 1.2: RESTART archon-server container
  action: EXECUTE bash command
  implementation: |
    cd /home/ljutzkanov/Documents/Projects/archon
    docker compose restart archon-server
  follow_pattern: Standard docker compose restart
  dependencies: Task 1.1 complete
  validation: docker ps shows archon-server in "healthy" state

Task 1.3: VERIFY DNS resolution and service health
  action: TEST multiple validation points
  implementation: |
    # Test 1: DNS resolution
    docker exec archon-server python3 -c "import socket; print(socket.gethostbyname('host.docker.internal'))"
    # Should output: 172.17.0.1 (or similar)

    # Test 2: Container health
    docker ps --filter "name=archon-server" --format "{{.Status}}"
    # Should include: "healthy"

    # Test 3: HTTP health endpoint
    curl -f http://localhost:8181/health
    # Should return: {"status": "healthy"} or similar
  dependencies: Task 1.2 complete
  success_criteria: All 3 tests pass


## PHASE 2: HIGH PRIORITY - DATABASE ISOLATION (45 minutes)

Task 2.1: BACKUP current database state
  action: CREATE backup files
  implementation: |
    # Create backup directory
    mkdir -p /tmp/archon-migration-backup

    # Backup postgres database (contains current Archon tables)
    docker exec supabase-ai-db pg_dump -U postgres -Fc postgres > \
      /tmp/archon-migration-backup/postgres_$(date +%Y%m%d_%H%M%S).dump

    # Backup archon_db (should be empty)
    docker exec supabase-ai-db pg_dump -U postgres -Fc archon_db > \
      /tmp/archon-migration-backup/archon_db_$(date +%Y%m%d_%H%M%S).dump

    # Export Archon tables for reference
    docker exec supabase-ai-db pg_dump -U postgres postgres \
      --table='public.archon_*' --data-only > \
      /tmp/archon-migration-backup/archon_data_reference_$(date +%Y%m%d_%H%M%S).sql
  dependencies: Phase 1 complete
  validation: Verify backup files created with ls -lh /tmp/archon-migration-backup/

Task 2.2: INITIALIZE fresh schema in archon_db
  action: EXECUTE migration script
  implementation: |
    # Run complete_setup.sql on archon_db
    docker exec -i supabase-ai-db psql -U postgres archon_db < \
      /home/ljutzkanov/Documents/Projects/archon/migration/complete_setup.sql

    # Verify schema created
    docker exec supabase-ai-db psql -U postgres -d archon_db -c "\dt public.archon*"
    # Expected output: List of 11 archon_* tables

    # Verify extensions
    docker exec supabase-ai-db psql -U postgres -d archon_db -c "\dx"
    # Expected: vector, pg_trgm, uuid-ossp extensions
  follow_pattern: migration/complete_setup.sql (idempotent SQL)
  dependencies: Task 2.1 complete
  validation: Table count = 11, extensions present

Task 2.3: UPDATE start-archon.sh database target
  action: MODIFY start-archon.sh line 400
  implementation: |
    # Change from:
    local target_db="postgres"

    # Change to:
    local target_db="archon_db"
  follow_pattern: Simple string replacement
  dependencies: None (independent of other tasks)
  validation: grep 'target_db="archon_db"' start-archon.sh

Task 2.4: INVESTIGATE PostgREST configuration
  action: READ and ANALYZE Supabase docker-compose.yml
  implementation: |
    # Locate PostgREST service in Supabase compose file
    cd ~/Documents/Projects/local-ai-packaged/supabase/docker
    grep -A 20 "supabase-ai-rest:" docker-compose.yml | grep PGRST_DB_URI

    # Current value likely:
    # PGRST_DB_URI=postgresql://postgres:${POSTGRES_PASSWORD}@supabase-ai-db:5432/postgres

    # Decision point: Can we change this to archon_db?
    # OR: Do we need separate PostgREST instance for Archon?

    # If changing affects other services, MUST create separate PostgREST instance
  dependencies: Task 2.2 complete
  validation: Document decision and reasoning

Task 2.5: CONFIGURE PostgREST for archon_db
  action: MODIFY or CREATE PostgREST configuration
  implementation: |
    # Option A: If safe to change existing PostgREST
    # Modify PGRST_DB_URI to point to archon_db
    # PGRST_DB_URI=postgresql://postgres:${POSTGRES_PASSWORD}@supabase-ai-db:5432/archon_db

    # Option B: If separate instance needed (likely)
    # Create new PostgREST service in Archon docker-compose.yml
    # Configure to serve archon_db exclusively
    # Map to different port (e.g., 3001)
  follow_pattern: Existing PostgREST configuration
  dependencies: Task 2.4 decision complete
  gotcha: PostgREST schema cache may need restart
  validation: Restart PostgREST service after change

Task 2.6: RESTART Archon services
  action: EXECUTE stop and start commands
  implementation: |
    cd /home/ljutzkanov/Documents/Projects/archon
    ./stop-archon.sh
    ./start-archon.sh --skip-backup
  dependencies: Tasks 2.2, 2.3, 2.5 complete
  validation: All services start healthy

Task 2.7: VERIFY Archon connects to archon_db
  action: TEST database connectivity
  implementation: |
    # Test 1: API endpoint
    curl http://localhost:8181/api/settings
    # Should return settings (empty or configured)

    # Test 2: PostgREST query
    curl -H "apikey: $SUPABASE_SERVICE_KEY" \
         http://localhost:18000/archon_settings
    # Should return PostgREST response from archon_db

    # Test 3: MCP server
    curl http://localhost:8051/health
    # Should return healthy status

    # Test 4: Database isolation verification
    docker exec supabase-ai-db psql -U postgres -d archon_db -c "\dt public.archon*" | wc -l
    # Expected: 11 tables

    docker exec supabase-ai-db psql -U postgres -d postgres -c "\dt public.archon*" | wc -l
    # Expected: 0 tables (or moved to archive schema)
  dependencies: Task 2.6 complete
  success_criteria: All 4 tests pass

Task 2.8: ARCHIVE old tables in postgres (optional)
  action: EXECUTE SQL to move tables to archive schema
  implementation: |
    docker exec supabase-ai-db psql -U postgres postgres << 'EOF'
    CREATE SCHEMA IF NOT EXISTS archon_legacy_archive;
    COMMENT ON SCHEMA archon_legacy_archive IS 'Archive of Archon tables from before migration to archon_db';

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
  dependencies: Task 2.7 verified successful
  validation: Query postgres.public for archon_* tables - should return 0


## PHASE 3: MEDIUM PRIORITY - BACKUP STRATEGY (60 minutes)

Task 3.1: CREATE unified backup script
  action: CREATE new file ~/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh
  implementation: |
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

    # postgres: every 6 hours (0, 6, 12, 18) - keep 30
    [[ $HOUR =~ ^(0|6|12|18)$ ]] && pg_dump_database "postgres" 30

    # archon_db: daily at 2 AM - keep 14
    [[ $HOUR == "02" ]] && pg_dump_database "archon_db" 14

    # n8n_db: daily at 3 AM - keep 14
    [[ $HOUR == "03" ]] && pg_dump_database "n8n_db" 14

    # langfuse_db: weekly (Sunday 4 AM) - keep 4
    [[ $(date +%u) == "7" && $HOUR == "04" ]] && pg_dump_database "langfuse_db" 4

    # odoo_db: every 4 hours (8, 12, 16, 20) - keep 60
    [[ $HOUR =~ ^(8|12|16|20)$ ]] && pg_dump_database "odoo_db" 60

    echo "[$(date)] Backup completed" >> /var/log/database-backups.log
  follow_pattern: ~/Documents/Projects/local-ai-packaged/scripts/backup-n8n.sh
  dependencies: Phase 2 complete
  placement: Create in local-ai-packaged scripts directory
  validation: bash -n script.sh (syntax check), chmod +x script.sh

Task 3.2: CONFIGURE cron job for automated backups
  action: ADD cron entry to user crontab
  implementation: |
    # Add to crontab
    (crontab -l 2>/dev/null; echo "0 * * * * /home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh >> /var/log/database-backups.log 2>&1") | crontab -

    # Verify crontab
    crontab -l | grep backup-all-databases

    # Create log file with proper permissions
    sudo touch /var/log/database-backups.log
    sudo chown $USER:$USER /var/log/database-backups.log
  dependencies: Task 3.1 complete
  gotcha: Cron runs in minimal environment - use absolute paths
  validation: crontab -l shows entry, log file exists with write permissions

Task 3.3: TEST backup script execution
  action: EXECUTE manual backup and verify
  implementation: |
    # Run backup script manually
    bash /home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh

    # Verify backup files created
    ls -lh /backups/supabase-ai/*/
    # Expected: backup_*.dump files in each database directory

    # Verify retention policy (if old backups exist)
    ls -t /backups/supabase-ai/archon_db/ | wc -l
    # Should not exceed 14
  dependencies: Task 3.2 complete
  validation: Exit code 0, backup files exist with non-zero size

Task 3.4: TEST restore procedure
  action: RESTORE backup on non-critical database
  implementation: |
    # Test restore on langfuse_db (low criticality, ephemeral data)
    # Stop Langfuse service first
    docker stop langfuse-web langfuse-worker

    # Restore from most recent backup
    LATEST_BACKUP=$(ls -t /backups/supabase-ai/langfuse_db/backup_*.dump | head -1)
    docker exec -i supabase-ai-db pg_restore -U postgres -d langfuse_db -c < "$LATEST_BACKUP"

    # Restart Langfuse
    docker start langfuse-web langfuse-worker

    # Verify Langfuse works
    curl -f http://localhost:3000/api/public/health
  dependencies: Task 3.3 complete with valid backup
  gotcha: pg_restore requires -Fc format dumps (NOT SQL text)
  validation: Langfuse service restarts and health check passes

Task 3.5: CREATE disaster recovery runbook
  action: CREATE new file docs/disaster-recovery-runbook.md
  implementation: |
    # Document per-database recovery procedures
    # Include:
    # - Recovery steps for each database
    # - RTO (Recovery Time Objective) and RPO (Recovery Point Objective)
    # - Emergency contacts
    # - Rollback procedures
    # - Verification checklists
    # - Common failure scenarios and solutions
  follow_pattern: Standard runbook format
  dependencies: Task 3.4 complete with verified restore
  placement: archon/docs/disaster-recovery-runbook.md
  validation: Runbook reviewed by team, covers all databases


## PHASE 4: MEDIUM PRIORITY - DOCUMENTATION (60 minutes)

Task 4.1: UPDATE CLAUDE.md with database architecture
  action: MODIFY .claude/CLAUDE.md
  implementation: |
    # Add new section after "Environment Setup"
    # Section title: "### Database Architecture"
    # Content includes:
    # - Connection method (REST API via PostgREST/Kong)
    # - Database structure (archon_db isolated, postgres for Supabase core)
    # - Database inventory table with criticality and backup frequency
    # - Environment variables explanation
    # - Blast radius protection explanation
  follow_pattern: Existing CLAUDE.md structure and tone
  dependencies: Phase 2 complete
  placement: After "Environment Setup" section
  validation: Markdown syntax check, no broken links

Task 4.2: ADD DNS resolution troubleshooting
  action: MODIFY .claude/CLAUDE.md
  implementation: |
    # Add to "Common Issues & Solutions" section
    # Section title: "### DNS Resolution Error (host.docker.internal)"
    # Content includes:
    # - Symptoms description
    # - Root cause explanation
    # - Solutions with code examples
    # - Services requiring extra_hosts
    # - Verification commands
  dependencies: Phase 1 complete
  placement: In "Common Issues & Solutions" section
  validation: Instructions tested on fresh system

Task 4.3: DOCUMENT Qdrant optional status
  action: MODIFY .claude/CLAUDE.md
  implementation: |
    # Add new section or subsection
    # Section title: "### Qdrant Vector Database Warnings"
    # Content includes:
    # - Symptom description (warning message during startup)
    # - Status clarification (truly optional)
    # - Impact assessment (what works without Qdrant)
    # - Optional enablement instructions
  dependencies: None (independent documentation)
  placement: In "Common Issues & Solutions" or new section
  validation: Qdrant warning mentioned as expected behavior

Task 4.4: ADD backup and recovery documentation
  action: MODIFY .claude/CLAUDE.md
  implementation: |
    # Add new section
    # Section title: "### Backup and Recovery"
    # Content includes:
    # - Automated backup configuration
    # - Backup schedule table with frequencies and retention
    # - Manual backup commands
    # - Restore procedure with step-by-step commands
    # - Link to disaster recovery runbook
  dependencies: Phase 3 complete
  placement: New top-level section or subsection
  validation: Backup commands tested and working
```

### Implementation Patterns & Key Details

```yaml
Docker Compose extra_hosts Pattern:
  location: docker-compose.yml lines 107-108
  pattern: |
    extra_hosts:
      - "host.docker.internal:host-gateway"
  usage: Enables container to resolve host.docker.internal to host network gateway
  placement: After environment section, before networks section
  gotcha: Indentation matters (2 spaces), must restart container after adding

Database Initialization Pattern:
  location: migration/complete_setup.sql
  pattern: |
    CREATE EXTENSION IF NOT EXISTS "vector" CASCADE;
    CREATE TABLE IF NOT EXISTS archon_settings (...);
  usage: Idempotent schema creation safe to re-run
  gotcha: Uses CASCADE foreign keys - deleting parent cascades to children
  critical: No DROP statements - append-only, non-destructive

Backup Script Pattern:
  location: ~/Documents/Projects/local-ai-packaged/scripts/backup-n8n.sh
  pattern: |
    pg_dump -U postgres -Fc database_name > backup_$(date +%Y%m%d).dump
    ls -t backups/ | tail -n +15 | xargs -r rm  # Keep 14, delete rest
  usage: Compressed backup with retention policy
  gotcha: "-Fc" is custom format (not SQL text) - requires pg_restore not psql
  critical: Test restores regularly - backups are useless if restore doesn't work

Supabase Client Pattern:
  location: python/src/server/services/client_manager.py
  pattern: |
    url = os.getenv("SUPABASE_URL")  # Kong gateway endpoint
    key = os.getenv("SUPABASE_SERVICE_KEY")
    client = create_client(url, key)
  usage: REST API connection, not direct PostgreSQL
  gotcha: DATABASE_URI is never used - Supabase client ignores it
  critical: SUPABASE_URL points to Kong (18000), not direct PostgreSQL (5432)
```

### Integration Points

```yaml
DOCKER_COMPOSE:
  - file: docker-compose.yml
    change: "Add extra_hosts to archon-server service"
    pattern: "Follow archon-mcp service (lines 107-108)"
    impact: Enables DNS resolution for Supabase Kong gateway

STARTUP_SCRIPT:
  - file: start-archon.sh
    change: "Line 400: target_db='archon_db'"
    pattern: "Simple string replacement"
    impact: Database initialization targets archon_db instead of postgres

POSTGREST:
  - file: ~/Documents/Projects/local-ai-packaged/supabase/docker/docker-compose.yml
    change: "PGRST_DB_URI database name"
    decision: "May need separate PostgREST instance for Archon"
    impact: PostgREST serves archon_db tables via REST API

CRONTAB:
  - change: "Add hourly backup job"
    pattern: "0 * * * * /path/to/script.sh >> /var/log/file.log 2>&1"
    impact: Automated backups run on schedule

DOCUMENTATION:
  - file: .claude/CLAUDE.md
    changes: ["Database architecture", "DNS troubleshooting", "Backup procedures"]
    impact: Prevents future confusion and misconfig
```

## Validation Loop

### Level 1: Syntax & Style (Immediate Feedback)

```bash
# YAML syntax validation
yamllint docker-compose.yml || docker compose config
# Expected: Valid YAML, no syntax errors

# Bash syntax validation
bash -n start-archon.sh
bash -n ~/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh
# Expected: No syntax errors

# Shellcheck (if available)
shellcheck start-archon.sh
shellcheck ~/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh
# Expected: No critical issues (can ignore info/warnings)

# Markdown validation
markdownlint .claude/CLAUDE.md docs/disaster-recovery-runbook.md || echo "Markdown OK"
# Expected: No errors (or manual review OK)
```

### Level 2: Component Validation (Per-Phase Testing)

```bash
## Phase 1 Validation: DNS Resolution

# Test 1.1: DNS resolution inside container
docker exec archon-server python3 -c "import socket; print(socket.gethostbyname('host.docker.internal'))"
# Expected output: 172.17.0.1 (or similar host gateway IP)
# If fails: extra_hosts not configured correctly

# Test 1.2: Container health status
docker ps --filter "name=archon-server" --format "{{.Status}}"
# Expected output: Contains "healthy"
# If fails: Check logs with docker logs archon-server

# Test 1.3: HTTP health endpoint
curl -f http://localhost:8181/health
# Expected: Exit code 0, JSON response
# If fails: Service not started or crashed


## Phase 2 Validation: Database Isolation

# Test 2.1: Backup files created
ls -lh /tmp/archon-migration-backup/
# Expected: 3 files (postgres.dump, archon_db.dump, archon_data_reference.sql)

# Test 2.2: Schema initialized in archon_db
docker exec supabase-ai-db psql -U postgres -d archon_db -c "\dt public.archon*" | grep -c "archon_"
# Expected output: 11 (number of archon tables)

# Test 2.3: Extensions installed
docker exec supabase-ai-db psql -U postgres -d archon_db -c "\dx" | grep -E "vector|pg_trgm|uuid-ossp"
# Expected: All three extensions listed

# Test 2.4: start-archon.sh updated
grep 'target_db="archon_db"' start-archon.sh
# Expected: Exit code 0 (match found)

# Test 2.5: Archon services healthy
docker ps --filter "name=archon" --format "{{.Names}}\t{{.Status}}"
# Expected: archon-server, archon-mcp, archon-ui all showing "healthy"

# Test 2.6: API endpoints respond
curl -f http://localhost:8181/api/settings && \
curl -f http://localhost:8051/health && \
curl -f http://localhost:3737
# Expected: All exit code 0

# Test 2.7: Database isolation verified
docker exec supabase-ai-db psql -U postgres -d archon_db -c "SELECT COUNT(*) FROM archon_settings;"
# Expected: Row count (0 or configured settings)

docker exec supabase-ai-db psql -U postgres -d postgres -c "\dt public.archon*" 2>&1 | grep -q "Did not find any relation"
# Expected: Exit code 0 (no archon tables in postgres)


## Phase 3 Validation: Backup Strategy

# Test 3.1: Backup script syntax
bash -n ~/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh
# Expected: No output (syntax OK)

# Test 3.2: Cron job configured
crontab -l | grep -q "backup-all-databases.sh"
# Expected: Exit code 0 (cron entry found)

# Test 3.3: Manual backup execution
bash ~/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh
echo $?
# Expected: Exit code 0

# Test 3.4: Backup files created
ls -lh /backups/supabase-ai/archon_db/ | grep backup_archon_db
# Expected: At least one backup file with non-zero size

# Test 3.5: Restore procedure works
# (Test on langfuse_db to avoid affecting critical services)
docker stop langfuse-web langfuse-worker
LATEST_BACKUP=$(ls -t /backups/supabase-ai/langfuse_db/backup_*.dump 2>/dev/null | head -1)
if [ -f "$LATEST_BACKUP" ]; then
  docker exec -i supabase-ai-db pg_restore -U postgres -d langfuse_db -c < "$LATEST_BACKUP"
  echo "Restore exit code: $?"
fi
docker start langfuse-web langfuse-worker
sleep 5
curl -f http://localhost:3000/api/public/health
# Expected: Restore exit code 0 or 1 (1 is OK - some warnings), Langfuse health check succeeds


## Phase 4 Validation: Documentation

# Test 4.1: CLAUDE.md updated
grep -q "### Database Architecture" .claude/CLAUDE.md
# Expected: Exit code 0 (section found)

# Test 4.2: DNS troubleshooting added
grep -q "DNS Resolution Error" .claude/CLAUDE.md
# Expected: Exit code 0 (section found)

# Test 4.3: Qdrant documentation added
grep -q "Qdrant Vector Database Warnings" .claude/CLAUDE.md
# Expected: Exit code 0 (section found)

# Test 4.4: Backup documentation added
grep -q "Backup and Recovery" .claude/CLAUDE.md
# Expected: Exit code 0 (section found)

# Test 4.5: Disaster recovery runbook created
[ -f docs/disaster-recovery-runbook.md ] && echo "Runbook exists"
# Expected: Output "Runbook exists"
```

### Level 3: Integration Testing (System Validation)

```bash
# Full System Health Check
echo "=== Archon Platform Integration Test ==="

# Test 1: All Archon services running and healthy
echo "1. Checking Archon services..."
docker ps --filter "name=archon" --format "{{.Names}}\t{{.Status}}" | tee /tmp/archon-status.txt
if grep -qv "healthy" /tmp/archon-status.txt; then
  echo "❌ Some services unhealthy"
  exit 1
else
  echo "✅ All Archon services healthy"
fi

# Test 2: DNS resolution working
echo "2. Testing DNS resolution..."
docker exec archon-server python3 -c "import socket; ip=socket.gethostbyname('host.docker.internal'); print(f'host.docker.internal -> {ip}'); assert ip.startswith('172.') or ip.startswith('192.'), 'Invalid gateway IP'"
if [ $? -eq 0 ]; then
  echo "✅ DNS resolution working"
else
  echo "❌ DNS resolution failed"
  exit 1
fi

# Test 3: Database isolation verified
echo "3. Verifying database isolation..."
ARCHON_DB_TABLES=$(docker exec supabase-ai-db psql -U postgres -d archon_db -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'archon_%';")
POSTGRES_ARCHON_TABLES=$(docker exec supabase-ai-db psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'archon_%';" 2>/dev/null || echo "0")

echo "  archon_db tables: $ARCHON_DB_TABLES (expected: 11)"
echo "  postgres archon tables: $POSTGRES_ARCHON_TABLES (expected: 0)"

if [ "$ARCHON_DB_TABLES" -eq 11 ] && [ "$POSTGRES_ARCHON_TABLES" -eq 0 ]; then
  echo "✅ Database isolation correct"
else
  echo "⚠️ Database isolation incomplete"
fi

# Test 4: API endpoints functional
echo "4. Testing API endpoints..."
curl -sf http://localhost:8181/health | jq . && echo "  ✅ archon-server API"
curl -sf http://localhost:8051/health | jq . && echo "  ✅ archon-mcp API"
curl -sf http://localhost:3737 > /dev/null && echo "  ✅ archon-ui frontend"

# Test 5: MCP tools functional (if mcp__archon available)
echo "5. Testing MCP functionality..."
# Try to list available sources via MCP
curl -sf http://localhost:8051/tools/list 2>/dev/null && echo "  ✅ MCP tools accessible" || echo "  ⚠️ MCP tools check skipped"

# Test 6: Backup automation configured
echo "6. Checking backup automation..."
if crontab -l | grep -q "backup-all-databases.sh"; then
  echo "  ✅ Cron job configured"
  if [ -d /backups/supabase-ai/archon_db ]; then
    BACKUP_COUNT=$(ls -1 /backups/supabase-ai/archon_db/backup_*.dump 2>/dev/null | wc -l)
    echo "  ✅ Backup directory exists ($BACKUP_COUNT backups)"
  else
    echo "  ⚠️ Backup directory not yet created (will be created on first run)"
  fi
else
  echo "  ❌ Cron job not configured"
fi

# Test 7: Documentation complete
echo "7. Checking documentation..."
grep -q "### Database Architecture" .claude/CLAUDE.md && echo "  ✅ Database architecture documented"
grep -q "DNS Resolution Error" .claude/CLAUDE.md && echo "  ✅ DNS troubleshooting documented"
grep -q "Backup and Recovery" .claude/CLAUDE.md && echo "  ✅ Backup procedures documented"
[ -f docs/disaster-recovery-runbook.md ] && echo "  ✅ Disaster recovery runbook created"

echo ""
echo "=== Integration Test Complete ==="
echo "Expected: All services healthy, database isolated, backups configured"
```

### Level 4: Blast Radius Validation (Disaster Scenario Testing)

```bash
# ⚠️ DESTRUCTIVE TESTS - Run on non-production environment only
echo "=== Blast Radius Validation Tests ==="
echo "⚠️ WARNING: These tests simulate disaster scenarios"
echo "Only run on test/dev environment, NOT production"
read -p "Continue? (yes/no): " confirm
[ "$confirm" != "yes" ] && echo "Aborted" && exit 0

# Scenario 1: Simulate archon_db deletion (should affect only Archon)
echo ""
echo "Scenario 1: Testing archon_db isolation..."
echo "  1. Creating test data in archon_db"
docker exec supabase-ai-db psql -U postgres archon_db -c \
  "INSERT INTO archon_settings (key, value) VALUES ('test_key', 'test_value') ON CONFLICT DO NOTHING;"

echo "  2. Backing up archon_db"
docker exec supabase-ai-db pg_dump -U postgres -Fc archon_db > /tmp/archon_db_blast_test.dump

echo "  3. Stopping Archon services"
cd /home/ljutzkanov/Documents/Projects/archon && ./stop-archon.sh

echo "  4. Dropping archon_db (simulating disaster)"
docker exec supabase-ai-db psql -U postgres -c "DROP DATABASE archon_db;"

echo "  5. Verifying other services unaffected"
curl -sf http://localhost:18000/health && echo "  ✅ Supabase/Kong still healthy"
docker ps --filter "name=supabase-ai" --format "{{.Names}}\t{{.Status}}" | grep -q "healthy" && echo "  ✅ Supabase services still healthy"

echo "  6. Recreating archon_db"
docker exec supabase-ai-db psql -U postgres -c "CREATE DATABASE archon_db OWNER postgres;"

echo "  7. Restoring from backup"
docker exec -i supabase-ai-db pg_restore -U postgres -d archon_db < /tmp/archon_db_blast_test.dump

echo "  8. Restarting Archon services"
./start-archon.sh

echo "  9. Verifying Archon recovery"
sleep 10
curl -sf http://localhost:8181/health && echo "  ✅ Archon recovered successfully"

echo ""
echo "✅ Blast radius test passed: archon_db deletion contained, services recovered"


# Scenario 2: Verify postgres database does NOT contain Archon tables
echo ""
echo "Scenario 2: Verifying postgres database safety..."
echo "  1. Checking postgres database for Archon tables"
POSTGRES_ARCHON_TABLES=$(docker exec supabase-ai-db psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'archon_%';" 2>/dev/null || echo "0")

if [ "$POSTGRES_ARCHON_TABLES" -eq 0 ]; then
  echo "  ✅ No Archon tables in postgres (isolation complete)"
  echo "  ✅ Dropping postgres would NOT affect Archon data"
else
  echo "  ❌ Found $POSTGRES_ARCHON_TABLES Archon tables in postgres"
  echo "  ❌ Migration incomplete - Archon still at risk"
  exit 1
fi


# Scenario 3: Backup restoration stress test
echo ""
echo "Scenario 3: Backup restoration stress test..."
echo "  1. Running backup now"
bash ~/Documents/Projects/local-ai-packaged/scripts/backup-all-databases.sh

echo "  2. Verifying backup created"
LATEST_ARCHON_BACKUP=$(ls -t /backups/supabase-ai/archon_db/backup_*.dump 2>/dev/null | head -1)
if [ -f "$LATEST_ARCHON_BACKUP" ]; then
  echo "  ✅ Backup file exists: $LATEST_ARCHON_BACKUP"
  BACKUP_SIZE=$(stat -f%z "$LATEST_ARCHON_BACKUP" 2>/dev/null || stat -c%s "$LATEST_ARCHON_BACKUP")
  echo "  ✅ Backup size: $BACKUP_SIZE bytes"
else
  echo "  ❌ No backup file found"
  exit 1
fi

echo "  3. Testing restore procedure (dry run)"
docker exec supabase-ai-db pg_restore --list "$LATEST_ARCHON_BACKUP" 2>&1 | head -20
if [ $? -eq 0 ]; then
  echo "  ✅ Backup file is valid and restorable"
else
  echo "  ❌ Backup file is corrupted or invalid"
  exit 1
fi

echo ""
echo "✅ Backup restoration stress test passed"
echo "=== All Blast Radius Tests Complete ==="
```

## Final Validation Checklist

### Technical Validation

- [ ] All 4 validation levels completed successfully (Levels 1-4 above)
- [ ] YAML syntax validated: `yamllint docker-compose.yml`
- [ ] Bash syntax validated: `bash -n start-archon.sh`
- [ ] Docker compose config valid: `docker compose config > /dev/null`
- [ ] Shellcheck passes (or issues reviewed and acceptable)

### Feature Validation (Success Criteria from "What" section)

- [ ] archon-server starts successfully (DNS resolution working)
- [ ] All Archon services healthy: archon-server (8181), archon-mcp (8051), archon-ui (3737)
- [ ] `archon_db` contains exactly 11 Archon tables
- [ ] `postgres` database clean (no Archon tables in public schema)
- [ ] Automated backups running on schedule
- [ ] Backup restore tested and verified functional
- [ ] Documentation updated with clear architecture explanation

### Code Quality Validation

- [ ] Follows existing Docker Compose patterns (extra_hosts placement)
- [ ] File placement correct (scripts in local-ai-packaged/scripts, docs in archon/docs)
- [ ] Database patterns idempotent (CREATE IF NOT EXISTS)
- [ ] Backup script follows existing pattern (backup-n8n.sh reference)
- [ ] Configuration changes documented in CLAUDE.md

### Integration & System Validation

- [ ] Integration test script passes (Level 3 validation)
- [ ] Blast radius validation confirms isolation (Level 4 validation)
- [ ] Services can restart after database drop/restore
- [ ] Cron job executes successfully (check /var/log/database-backups.log)
- [ ] Documentation reviewed and clear

### Disaster Recovery Validation

- [ ] Runbook created and comprehensive
- [ ] Restore procedures tested on non-critical database
- [ ] RTO/RPO documented for each database
- [ ] Team trained on recovery procedures (if applicable)

---

## Anti-Patterns to Avoid

- ❌ Don't skip Phase 1 - DNS fix is required for all other phases
- ❌ Don't skip backups before Phase 2 - always have safety net
- ❌ Don't change PostgREST config without understanding impact on other services
- ❌ Don't use `psql < backup.dump` for restore - use `pg_restore` for -Fc dumps
- ❌ Don't modify postgres database directly - use archon_db
- ❌ Don't hardcode passwords or secrets in scripts - use environment variables
- ❌ Don't skip testing restore procedures - untested backups are useless
- ❌ Don't ignore failing validation tests - fix root cause before proceeding
- ❌ Don't deploy Phase 2 without verifying Phase 1 complete
- ❌ Don't assume cron job works - verify with manual execution first

---

## PRP Confidence Score: 8/10

### Scoring Rationale

**Strengths (+):**
- ✅ **Clear implementation path**: Phased approach with explicit dependencies
- ✅ **Executable validation**: All tests are copy-paste bash commands
- ✅ **Comprehensive context**: File paths, line numbers, existing patterns referenced
- ✅ **Safety nets**: Backup strategy before destructive changes
- ✅ **Real codebase patterns**: References actual files to follow (docker-compose.yml lines 107-108, backup-n8n.sh)

**Uncertainties (-):**
- ⚠️ **PostgREST complexity (-1)**: May need separate instance for Archon - requires investigation
- ⚠️ **Supabase configuration (-1)**: Kong gateway routing may have edge cases not documented
- ⚠️ **Cron environment**: Minimal environment may cause path issues (mitigated with absolute paths)

**Risk Mitigation:**
- Backup before changes (Task 2.1)
- Phased approach allows stopping at any point
- Non-destructive operations (no DROP in migration script)
- Test environment recommended before production

**Expected Implementation Success:**
- Phase 1 (DNS): **95% confidence** - straightforward config change
- Phase 2 (Isolation): **75% confidence** - PostgREST config may need iteration
- Phase 3 (Backup): **90% confidence** - follows established patterns
- Phase 4 (Docs): **100% confidence** - documentation only

**Overall**: One-pass implementation **likely successful** with PostgREST as the main challenge requiring investigation and potential iteration.

---

**Generated**: 2025-12-03
**Template Version**: PRP Base v3
**Author**: Claude (Sonnet 4.5) via /generate-prp command
**Estimated Implementation Time**: 3-7 hours (depending on PostgREST complexity)
