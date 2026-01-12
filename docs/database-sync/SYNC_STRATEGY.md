# Archon Bidirectional Database Sync Strategy

**Version:** 1.0
**Date:** 2026-01-12
**Status:** Design Complete, Ready for Implementation

---

## Executive Summary

This document defines the strategy for bidirectional synchronization between Local Supabase (development) and Remote Supabase Cloud (production backup) for the Archon knowledge base system.

**Current State:**
- **Local DB**: 44 sources, 2,028 code examples, 3,927 page metadata, **0 crawled pages**
- **Remote DB**: 44 sources, 2,028 code examples, 1,517 page metadata, **218,714 crawled pages**
- **Gap**: Local missing 218k crawled pages (search index)

**Goal:** Enable seamless mode switching (local ↔ remote) with data consistency

---

## 1. Sync Strategy: Full Dump/Restore

**Decision:** Use PostgreSQL pg_dump/pg_restore for full database sync

**Rationale:**
- ✅ **Simplicity**: No complex timestamp tracking across 19 tables
- ✅ **Atomicity**: Single transaction guarantees consistency
- ✅ **Reliability**: PostgreSQL native tools, battle-tested
- ✅ **Speed**: ~15-30 min for 218k rows (acceptable)
- ❌ **Bandwidth**: Full dumps are large (~1.5GB), but acceptable for LAN/good internet

**Alternative Rejected:** Incremental sync
- Would require `updated_at` timestamps on all 19 tables
- Complex foreign key dependency resolution
- Risk of partial sync leaving inconsistent state
- Not worth complexity for our use case (sync 1-2x per day max)

---

## 2. Table Selection: All 19 Archon Tables

**Tables to Sync (in dependency order):**

### Core Data (Independent)
1. `archon_migrations` (72 KB, ~28 rows) - Schema version tracking
2. `archon_settings` (112 KB, 78 rows) - Configuration & API keys
3. `archon_llm_pricing` (64 KB, ~11 rows) - LLM cost data
4. `archon_prompts` (80 KB, ~3 rows) - System prompts

### Knowledge Base (Dependent)
5. `archon_sources` (176 KB, 44 rows) - Source definitions
6. `archon_page_metadata` (27 MB, 3,927 rows) - Complete documentation pages
7. `archon_crawled_pages` (5.5 MB local / ~1.3 GB remote, 0/218,714 rows) - Search index with vectors
8. `archon_code_examples` (53 MB, 2,028 rows) - Code snippets
9. `archon_crawl_state` (56 KB) - Pause/resume state

### Project Management
10. `archon_projects` (80 KB, 13 rows) - Projects
11. `archon_tasks` (336 KB, 259 rows) - Tasks
12. `archon_task_history` (352 KB, 707 rows) - Task audit trail
13. `archon_document_versions` (64 KB) - Version control
14. `archon_project_sources` (80 KB) - Project-source links

### Agent & Automation
15. `archon_configured_repositories` (8 KB) - GitHub repos for agents
16. `archon_agent_work_orders` (8 KB) - Agent work orders
17. `archon_agent_work_order_steps` (8 KB) - Work order steps

### MCP Tracking (Session-specific, optional)
18. `archon_mcp_sessions` (56 KB, 0 rows) - **SKIP SYNC** - Session data
19. `archon_mcp_requests` (64 KB, 0 rows) - **SKIP SYNC** - Request logs

**Total Size:** ~81 MB (local) / ~1.4 GB (remote with 218k pages)

**Sync Decision:**
- ✅ **Sync 17 tables** (all except MCP tracking)
- ❌ **Skip**: `archon_mcp_sessions`, `archon_mcp_requests` (session-specific, ephemeral)

---

## 3. Conflict Resolution: Last-Write-Wins

**Strategy:** Unidirectional sync per operation (no merge conflicts)

**Sync Modes:**
1. **Local → Remote**: Local overwrites Remote completely
2. **Remote → Local**: Remote overwrites Local completely
3. **Bidirectional**: User chooses direction, no automatic merge

**No Conflict Detection Needed:**
- Each sync is a full replace operation
- User explicitly chooses source of truth
- Simple, predictable behavior

**Safety Measures:**
- Pre-sync row count comparison (warn if data loss)
- Optional backup before sync
- Verification after sync (row counts match)

---

## 4. Progress Tracking

### Tracking Levels

**Level 1: Table-by-Table (Coarse)**
- Track 17 tables sequentially
- Update: "Syncing archon_sources (table 5/17)"
- Percentage: (tables_completed / 17) * 100
- **Simple, reliable, user-friendly**

**Level 2: Row-by-Row for Large Tables (Fine)**
- For tables >1000 rows: `archon_crawled_pages`, `archon_page_metadata`, `archon_code_examples`
- Track row insertion progress
- Update: "Syncing archon_crawled_pages: 50,000 / 218,714 rows (23%)"
- **More granular for long operations**

### Implementation
```python
progress = {
    "sync_id": "uuid",
    "status": "running",  # running | completed | failed
    "direction": "remote-to-local",
    "phase": "exporting | importing | indexing | verifying",
    "current_table": "archon_crawled_pages",
    "tables_completed": 8,
    "total_tables": 17,
    "rows_synced": 50000,  # optional, for large tables
    "total_rows": 218714,  # optional
    "percent_complete": 47,
    "started_at": "2026-01-12T10:00:00Z",
    "elapsed_seconds": 900,
    "eta_seconds": 1020,
    "message": "Syncing archon_crawled_pages: 50,000 / 218,714 rows"
}
```

**Storage:** `archon_sync_history` table + in-memory cache for active syncs

---

## 5. Sync Phases

### Phase 1: Pre-Sync Validation (1-2 min)
```bash
1. Check source DB connectivity
2. Check target DB connectivity
3. Compare row counts (warn if major difference)
4. Verify disk space (need 2x remote DB size)
5. Check PostgreSQL version compatibility
```

### Phase 2: Export (5-15 min for 218k rows)
```bash
pg_dump \
  -h SOURCE_HOST \
  -p SOURCE_PORT \
  -U SOURCE_USER \
  -d SOURCE_DB \
  --schema=public \
  --table='archon_*' \
  --no-owner --no-privileges --no-acl \
  --file=/tmp/archon-sync-TIMESTAMP.sql
```

**Track:** Export size, elapsed time

### Phase 3: Target DB Preparation (1-2 min)
```bash
# Option A: TRUNCATE (preserve schema)
TRUNCATE archon_crawled_pages, archon_code_examples, ... CASCADE;

# Option B: DROP + RECREATE (clean slate)
DROP TABLE IF EXISTS archon_crawled_pages, ... CASCADE;
# Schema recreated by import
```

**Decision:** Use TRUNCATE CASCADE for speed

### Phase 4: Import (10-20 min for 218k rows)
```bash
psql \
  -h TARGET_HOST \
  -p TARGET_PORT \
  -U TARGET_USER \
  -d TARGET_DB \
  -f /tmp/archon-sync-TIMESTAMP.sql
```

**Track:** Import progress (grep INSERT/CREATE from logs)

### Phase 5: Post-Sync Indexing (15-25 min for vector indexes)
```sql
-- Only for cloud→local syncs (local has more powerful hardware)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archon_crawled_pages_embedding_1536
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 1000);
```

**Track:** Index build progress (`pg_stat_progress_create_index`)

### Phase 6: Verification (1 min)
```sql
-- Compare row counts source vs target
SELECT 'archon_sources' as table, COUNT(*) FROM archon_sources
UNION ALL ...

-- Verify foreign key constraints
SELECT * FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY';

-- Check index validity
SELECT indexname, indisvalid FROM pg_indexes
WHERE tablename LIKE 'archon_%';
```

**Success Criteria:**
- ✅ All row counts match
- ✅ All foreign keys valid
- ✅ All indexes valid
- ✅ No import errors

---

## 6. Error Recovery & Rollback

### Error Scenarios

**1. Network Failure During Export**
- **Recovery**: Retry export (no state change yet)
- **Rollback**: Not needed

**2. Network Failure During Import**
- **Recovery**: Partial data in target DB
- **Rollback**: TRUNCATE target tables, restore from backup
- **Prevention**: Use transactions where possible

**3. Disk Space Exhaustion**
- **Recovery**: Free disk space, retry
- **Rollback**: Clean up partial import, restore backup

**4. Schema Mismatch (Migration Drift)**
- **Recovery**: Run pending migrations on target first
- **Rollback**: Not applicable (fix migrations)

### Rollback Strategy

**Backup Before Sync:**
```bash
# Create target backup before import
pg_dump TARGET_DB > /tmp/archon-backup-pre-sync-TIMESTAMP.sql

# On failure:
psql TARGET_DB -f /tmp/archon-backup-pre-sync-TIMESTAMP.sql
```

**Atomic Operations:**
- Use PostgreSQL transactions where possible
- `BEGIN; ... COMMIT;` for table truncation + import

---

## 7. Performance Optimization

### Parallelization
```bash
# pg_dump with multiple jobs (faster export)
pg_dump --jobs=4 ...

# pg_restore with multiple jobs (faster import)
pg_restore --jobs=4 ...
```

### Compression
```bash
# Compress dump file (saves bandwidth)
pg_dump ... | gzip > archon-sync.sql.gz

# Decompress during import
gunzip -c archon-sync.sql.gz | psql ...
```

**Trade-off:** CPU time vs bandwidth/storage

### Index Management
```bash
# Drop indexes before import (faster bulk insert)
DROP INDEX idx_archon_crawled_pages_embedding_1536;

# Import data

# Rebuild indexes afterward
CREATE INDEX CONCURRENTLY idx_archon_crawled_pages_embedding_1536 ...
```

**Benchmark:**
- With indexes: 20-30 min import
- Without indexes: 10-15 min import + 15-25 min rebuild = **25-40 min total**
- **Decision:** Keep indexes during import (simpler, not much slower)

---

## 8. Security Considerations

### Credentials Storage
- ✅ Read from .env file (never hardcode)
- ✅ Use environment variables in scripts
- ✅ Postgres password via PGPASSWORD env var
- ❌ Never log credentials

### Data in Transit
- ✅ Use SSL connections for remote DB
- ✅ Compress dumps (less exposure time)
- ❌ Don't sync over public WiFi (use VPN)

### Access Control
- ✅ Sync operations require authentication (API key)
- ✅ Audit log all syncs (archon_sync_history)
- ✅ Only authorized users can trigger sync

---

## 9. Sync Workflows

### Workflow 1: Work on Local, Backup to Remote

**Use Case:** Daily development on local, periodic backup to cloud

```bash
# End of day: Sync local → remote
./scripts/sync-databases.sh --direction=local-to-remote

# Or via UI:
# Dashboard → Database Sync → Direction: Local → Remote → Sync Now
```

**Frequency:** Daily or on-demand

### Workflow 2: Restore from Remote to Local

**Use Case:** Fresh machine setup, disaster recovery

```bash
# Restore remote → local
./scripts/sync-databases.sh --direction=remote-to-local

# Or via UI:
# Dashboard → Database Sync → Direction: Remote → Local → Sync Now
```

**Frequency:** On-demand (new machine, data loss)

### Workflow 3: Switch Modes (Local ↔ Remote)

**Use Case:** Work on local for speed, switch to remote for production testing

```bash
# Currently on MODE=local, want to test on remote
# 1. Sync local → remote (upload latest changes)
./scripts/sync-databases.sh --direction=local-to-remote

# 2. Switch MODE in .env or start-archon.sh
MODE=remote ./start-archon.sh

# 3. Work on remote

# 4. Switch back to local
MODE=local ./start-archon.sh

# 5. Optional: Sync remote → local (download changes)
./scripts/sync-databases.sh --direction=remote-to-local
```

---

## 10. Implementation Checklist

### Phase 2: Shell Script (database-expert)
- [ ] Create `scripts/sync-databases.sh`
- [ ] Support `--direction` parameter
- [ ] Implement progress logging
- [ ] Add row count verification
- [ ] Add rollback capability
- [ ] Test both directions

### Phase 3: API Endpoint (backend-api-expert)
- [ ] Create `/api/database/sync` endpoints
- [ ] Implement async job execution
- [ ] Add progress tracking
- [ ] Store sync history in DB
- [ ] Test cancellation

### Phase 4: Frontend UI (ui-implementation-expert)
- [ ] Create Database Sync page
- [ ] Add direction selector
- [ ] Implement progress display
- [ ] Show sync history
- [ ] Add sync status badge

### Phase 5: Database Schema (database-expert)
- [ ] Create `archon_sync_history` table
- [ ] Run migration

### Phase 6: Testing (testing-expert)
- [ ] Test local → remote
- [ ] Test remote → local
- [ ] Test cancellation
- [ ] Test error recovery
- [ ] Benchmark performance

### Phase 7: Documentation (documentation-expert)
- [ ] Create user guide
- [ ] Document API
- [ ] Update CLAUDE.md
- [ ] Create troubleshooting guide

---

## 11. Success Metrics

**Reliability:**
- ✅ 99% sync success rate
- ✅ < 1% data loss on failure (with rollback)
- ✅ Zero manual intervention needed for common errors

**Performance:**
- ✅ Export: < 15 min for 218k rows
- ✅ Import: < 20 min for 218k rows
- ✅ Total sync time: < 45 min end-to-end
- ✅ Index rebuild: < 25 min

**Usability:**
- ✅ One-click sync from dashboard
- ✅ Real-time progress updates (5 sec refresh)
- ✅ Clear error messages
- ✅ Sync history visible

---

## 12. Future Enhancements

**Phase 8: Incremental Sync (Optional)**
- Track `updated_at` timestamps on all tables
- Sync only changed rows
- Faster for small changes (< 5 min vs 45 min)
- More complex implementation

**Phase 9: Scheduled Auto-Sync**
- Cron job: nightly local → remote backup
- Optional: bidirectional sync with conflict detection

**Phase 10: Multi-Environment Sync**
- Support dev, staging, production environments
- Environment-specific sync rules

---

## Appendix A: Table Dependencies (Foreign Keys)

```
archon_sources (root)
  ↓ FK: source_id
  ├── archon_crawled_pages
  ├── archon_code_examples
  ├── archon_page_metadata
  ├── archon_crawl_state
  └── archon_project_sources

archon_projects (root)
  ↓ FK: project_id
  ├── archon_tasks
  ├── archon_document_versions
  └── archon_project_sources

archon_tasks
  ↓ FK: task_id
  └── archon_task_history

archon_agent_work_orders
  ↓ FK: work_order_id
  └── archon_agent_work_order_steps
```

**Sync Order:** Root tables first, then dependent tables (CASCADE handles deletions)

---

**Document Status:** ✅ APPROVED - Ready for Implementation
**Next Step:** Phase 2 - Create `scripts/sync-databases.sh`
