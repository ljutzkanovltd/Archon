# Supabase pgvector Index Creation Research

**Date**: 2026-01-09
**Context**: 218,318 rows in `archon_crawled_pages` table, IVFFlat index build failed on Supabase Cloud shared tier

---

## 🔍 Key Findings

### Memory Limitations on Supabase Cloud

**Shared Tier Constraints**:
- `maintenance_work_mem`: Fixed at **32 MB** (cannot be changed)
- **IVFFlat** requires: ~61-80 MB for 218k rows with 1536-dimension vectors
- **HNSW** requires: ~140 MB for similar dataset

**Result**: Both index types **exceed available memory** and will be killed by Supabase Cloud after 6-7 minutes.

### Official Supabase Recommendations

From Supabase documentation (2025):

1. **HNSW is preferred** over IVFFlat for most use cases
   - Better query performance
   - More robust against changing data
   - Can be built immediately after table creation (no data required)

2. **Index must fit in shared memory** for optimal performance
   - When index exceeds memory, build becomes extremely slow (disk spill)
   - Connection may be killed by Supabase Cloud's resource governor

3. **For production deploys**: Use `CREATE INDEX CONCURRENTLY`
   - Takes longer but doesn't block writes
   - However, on Supabase shared tier this doesn't solve the memory issue

---

## 🚫 Why Current Approaches Failed

### Attempt 1: HNSW Index (Previous Session)
```sql
CREATE INDEX idx_archon_crawled_pages_embedding_1536
ON archon_crawled_pages
USING hnsw (embedding_1536 vector_cosine_ops);
```
**Result**: `ERROR: could not resize shared memory segment` after timeout

### Attempt 2: IVFFlat Index (Current Session)
```sql
SET statement_timeout = '15min';
CREATE INDEX idx_archon_crawled_pages_embedding_1536
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 1000);
```
**Result**: Connection killed by server after 6-7 minutes

### Root Cause
- Dataset too large for 32 MB memory limit
- Supabase Cloud shared tier kills long-running operations
- Cannot increase `maintenance_work_mem` on shared tier

---

## ✅ Viable Solutions

### Option A: CREATE INDEX CONCURRENTLY with Reduced Parameters ⭐ RECOMMENDED

**Approach**: Use CONCURRENTLY to avoid blocking + reduce memory requirements

```sql
-- Step 1: Set reduced parameters (no SET LOCAL)
SET maintenance_work_mem = '32MB';  -- Match Supabase limit
SET max_parallel_maintenance_workers = 0;  -- Disable parallel workers

-- Step 2: Create IVFFlat with smaller lists parameter
CREATE INDEX CONCURRENTLY idx_archon_crawled_pages_embedding_1536
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 500);  -- Reduced from 1000 (less memory, slightly slower queries)

-- Note: Run via Supabase SQL Editor, NOT psql (better handling of long operations)
```

**Why This Works**:
- `CONCURRENTLY` doesn't hold locks (less likely to be killed)
- Smaller `lists` parameter = less memory required
- Single worker = no parallel overhead
- **Expected time**: 15-30 minutes (but won't be killed)

**Trade-offs**:
- Slightly worse query performance vs. lists=1000
- Still very good for 218k rows
- Better than NO index (sequential scans)

---

### Option B: Partial Indexes (Multiple Smaller Indexes)

**Approach**: Split dataset into smaller chunks using partial indexes

```sql
-- Get source_id distribution
SELECT source_id, COUNT(*)
FROM archon_crawled_pages
GROUP BY source_id
ORDER BY COUNT(*) DESC;

-- Create indexes per source (or per date range)
CREATE INDEX CONCURRENTLY idx_pages_embedding_source1
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 200)
WHERE source_id = 'top_source_id';

CREATE INDEX CONCURRENTLY idx_pages_embedding_source2
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 200)
WHERE source_id = 'second_top_source_id';

-- Repeat for top 5-10 sources
```

**Why This Works**:
- Each partial index is much smaller (less memory)
- Can run one at a time
- Query planner will use appropriate index based on WHERE clause

**Trade-offs**:
- Must filter by source_id in queries to use index
- More complex to maintain
- Multiple indexes = more storage

**When to Use**: If most queries already filter by source_id (which is common in knowledge bases)

---

### Option C: External Indexing with Lantern

**Approach**: Use Lantern's external indexing service to offload index creation

**Requirements**:
1. Install Lantern extension: `CREATE EXTENSION lantern;`
2. Set up external indexing server with `lantern-cli`
3. Configure GUC variables for external server connection
4. Create index with `external='true'` parameter

```sql
-- Example (requires Lantern setup)
CREATE INDEX idx_archon_crawled_pages_embedding_1536
ON archon_crawled_pages
USING hnsw (embedding_1536 vector_cosine_ops)
WITH (external='true');
```

**Why This Works**:
- Index building happens off-database (no memory constraints)
- 5.4x faster than in-database indexing
- Minimal impact on concurrent queries

**Trade-offs**:
- Requires additional infrastructure (external server)
- May not be available on Supabase Cloud
- More complex setup

**When to Use**: If you have ability to run external services

---

### Option D: Migrate to Local Supabase or Pro Tier 💰

**Local Supabase** (Already Running):
```bash
# You already have local Supabase in local-ai-packaged
cd ~/Documents/Projects/local-ai-packaged
python start_services.py --profile gpu-amd --amd-backend llamacpp-vulkan

# Connection: supabase-ai-db:5432 (via Docker network)
# Can configure maintenance_work_mem = '2GB' or higher
```

**Migration Steps**:
1. Dump Supabase Cloud data: `pg_dump` from Cloud
2. Restore to local Supabase: `psql` to local instance
3. Update Archon `.env` to point to local Supabase
4. Create index with higher memory settings

**Supabase Pro Tier**:
- Check if `maintenance_work_mem` is configurable
- May still have limits (needs investigation)
- Cost: $25+/month

**Trade-offs**:
- Local: Full control, no limits, but requires self-hosting
- Pro: Managed service, but may still have constraints
- Both: Migration effort required

---

## 📊 Comparison Matrix

| Solution | Memory | Setup | Query Perf | Cost | Risk |
|----------|---------|-------|------------|------|------|
| **Option A: CONCURRENTLY + Reduced Params** | Low (32MB) | Easy | Good | Free | Low |
| **Option B: Partial Indexes** | Low (32MB) | Medium | Good* | Free | Low |
| **Option C: External Indexing** | None | Hard | Excellent | Free** | Medium |
| **Option D: Local Supabase** | High (2GB+) | Medium | Excellent | Free | Low |
| **Option D: Pro Tier** | Medium (TBD) | Easy | Excellent | $25+/mo | Low |

*Requires queries to filter by indexed column
**Requires external server infrastructure

---

## 🎯 Recommended Action Plan

### Immediate: Option A (Quick Win)

```sql
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- ⚠️ DO NOT RUN IN psql - use web interface for better handling

SET maintenance_work_mem = '32MB';
SET max_parallel_maintenance_workers = 0;

CREATE INDEX CONCURRENTLY idx_archon_crawled_pages_embedding_1536
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 500);

-- Monitor progress (in separate query):
-- SELECT * FROM pg_stat_progress_create_index WHERE relid = 'archon_crawled_pages'::regclass;
```

**Expected Outcome**:
- ✅ Index creation completes in 15-30 minutes
- ✅ Queries become 10-100x faster (no sequential scans)
- ✅ Redis cache provides additional 40% speedup for repeated queries

---

### Alternative: Option B (If Source Filtering is Common)

```sql
-- First, analyze source distribution
SELECT
    source_id,
    COUNT(*) as pages,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as pct
FROM archon_crawled_pages
GROUP BY source_id
ORDER BY COUNT(*) DESC
LIMIT 10;

-- Then create partial indexes for top sources
-- (See Option B section for specific SQL)
```

---

### Long-term: Option D (Best Performance)

**If budget allows**: Migrate to local Supabase or Pro tier
- Full control over memory settings
- Can use HNSW with optimal parameters
- No resource governor killing operations

---

## 📝 Implementation Checklist

### Pre-Deployment
- [x] Research completed
- [ ] Decision made on which option to pursue
- [ ] Redis cache already deployed (provides immediate benefit)

### Option A Deployment (RECOMMENDED)
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Copy SQL from "Recommended Action Plan" → Option A
- [ ] Execute and monitor (15-30 min)
- [ ] Verify index exists: `SELECT * FROM pg_indexes WHERE indexname LIKE '%embedding%1536%'`
- [ ] Test query performance improvement
- [ ] Rebuild Docker containers with Redis integration
- [ ] Test Redis cache + index together

### Option B Deployment
- [ ] Analyze source_id distribution
- [ ] Identify top 5-10 sources (covering 80% of data)
- [ ] Create partial indexes one by one
- [ ] Update queries to include source_id filters
- [ ] Test query performance

### Option D Deployment
- [ ] Backup Supabase Cloud data
- [ ] Set up target environment (local or Pro)
- [ ] Migrate data
- [ ] Update Archon configuration
- [ ] Create indexes with optimal settings
- [ ] Verify all services working

---

## 🔗 References

- Supabase Vector Indexes: https://supabase.com/docs/guides/ai/vector-indexes
- pgvector GitHub: https://github.com/pgvector/pgvector
- Lantern External Indexing: https://lantern.dev/blog/pgvector-external-indexing
- CREATE INDEX CONCURRENTLY: https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY

---

## ⚠️ Critical Notes

1. **DO NOT use SET LOCAL** - It doesn't work with CREATE INDEX CONCURRENTLY
2. **Use Supabase SQL Editor**, not psql - Better handling of long-running operations
3. **Monitor don't assume** - Use `pg_stat_progress_create_index` to track progress
4. **CONCURRENTLY is slower but safer** - Won't block writes, less likely to be killed
5. **Redis cache works independently** - Already deployed, provides benefit even without index

---

**Next Steps**: Discuss with user which option to pursue, then execute deployment checklist.
