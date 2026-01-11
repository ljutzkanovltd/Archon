# Monday Quick Start Guide

**Date**: 2026-01-09
**Status**: ⚠️ Critical Decision Required
**Time to Read**: 3 minutes

---

## What Happened Friday

✅ **Completed Tasks 1-3**
- Task 1: Fixed source filtering
- Task 2: Added short query validation (migration applied)
- Task 3: Cleaned up duplicates

⚠️ **Critical Discovery**: ALL searches are broken (not just short queries)

---

## The Problem (In 30 Seconds)

```
What we have:
- 218,318 rows with embeddings ✅
- Short query logic working ✅
- Backend services running ✅

What's broken:
- NO vector index on embedding_1536 ❌
- All searches timeout after 8+ seconds ❌
- Return 0 results ❌

Why broken:
- Supabase Cloud: 32 MB memory limit
- Index needs: 729 MB
- Result: Can't create index on Supabase Cloud
```

---

## Your Decision (Pick One)

### Option A: Migrate to Local Supabase (Recommended)
**Time**: 4-8 hours | **Result**: Everything works
```
✅ All 218k rows indexed
✅ All searches work (<200ms)
✅ All 10 tasks unblocked
```
**Steps**: See `PROJECT_STATUS_AND_REMAINING_TASKS.md` → "Database Migration Context"

### Option B: Partial Indexes Workaround
**Time**: 2-3 hours | **Result**: Partial functionality
```
✅ 14 of 15 sources searchable
⚠️ Main source (124k rows) stays broken
⚠️ Queries must include source_id filter
```
**Steps**: Run `migration/0.3.0/018_partial_indexes_hybrid_approach.sql`

### Option C: Work on Non-Blocked Tasks
**Time**: Varies | **Result**: Search stays broken
```
✅ Can do 3 tasks:
  - Fix N+1 Query Problem
  - Add Connection Pooling
  - Add Performance Logging

❌ Cannot do 7 tasks (all search-related)
```
**Steps**: Start with "Fix N+1 Query Problem" task

---

## Quick Migration (If Choosing Option A)

**Morning**: Migrate database
```bash
# 1. Backup (30 min)
cd ~/Documents/Projects/archon/scripts
./backup-supabase-cloud.sh

# 2. Configure Local Supabase (15 min)
cd ~/Documents/Projects/local-ai-packaged
# Edit supabase/postgresql.conf:
# maintenance_work_mem = 2GB
docker-compose restart supabase-ai-db

# 3. Import data (1-2 hours)
./restore-to-local-supabase.sh /tmp/archon-backup-*.sql

# 4. Create indexes (30 min)
docker exec supabase-ai-db psql -U postgres -d postgres -f /tmp/create-indexes.sql
```

**Afternoon**: Update configs & test
```bash
# 5. Update Archon config (15 min)
cd ~/Documents/Projects/archon
nano .env
# Change DATABASE_URI to local Supabase

# 6. Restart & test (15 min)
./stop-archon.sh && ./start-archon.sh
curl -X POST http://localhost:8181/api/knowledge/search -d '{"query":"API"}'

# 7. Run tests (30 min)
./scripts/test-search-performance.sh
```

---

## Files You Need

**Essential Reading**:
1. `docs/performance/PROJECT_STATUS_AND_REMAINING_TASKS.md` (comprehensive)
2. `docs/performance/TASK_2_SHORT_QUERY_VALIDATION_FINDINGS.md` (technical details)
3. This file (quick overview)

**Migration Files**:
- `migration/0.3.0/018_partial_indexes_hybrid_approach.sql` (Option B)
- Scripts in `scripts/` directory (Option A)

---

## Questions to Answer

1. **Priority**: Can search stay broken while working on other tasks?
2. **Timeline**: How urgent is working search functionality?
3. **Risk**: OK to do infrastructure change on Monday?

**Recommendation**: Option A (migration) - solves everything, best long-term

---

## Quick Health Check

Before starting, verify current state:
```bash
# 1. Services running?
docker ps | grep archon

# 2. Database accessible?
curl http://localhost:8181/api/health

# 3. Search broken? (should return 0)
curl -X POST http://localhost:8181/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}' | jq '.total'
```

---

## Next Actions

**If migrating (Option A)**:
→ Start with "Quick Migration" section above
→ Allow 4-8 hours for complete process
→ End result: All tasks unblocked

**If doing workaround (Option B)**:
→ Review `018_partial_indexes_hybrid_approach.sql`
→ Apply migration to Supabase Cloud
→ Test source-filtered queries
→ Update API to require source_id

**If deferring (Option C)**:
→ Start with "Fix N+1 Query Problem" task
→ Then "Add Connection Pooling"
→ Then "Add Performance Logging"
→ Mark search tasks as blocked

---

**Created**: 2026-01-09 16:55 UTC
**For**: Monday morning startup
**See**: `PROJECT_STATUS_AND_REMAINING_TASKS.md` for full details
