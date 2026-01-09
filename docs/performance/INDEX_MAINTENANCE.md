# Vector Index Maintenance Guide

**Date**: 2026-01-09
**Purpose**: Operational procedures for maintaining vector indexes as data grows
**Applies To**: All indexing strategies (Partial, Full IVFFlat, HNSW)

---

## Overview

Vector indexes require periodic maintenance as your dataset grows. This guide covers:
- How new data is indexed
- When to rebuild indexes
- How to add indexes for new sources
- Performance monitoring

---

## How New Data is Handled

### Automatic Indexing Behavior

| Index Type | New Data Indexed? | Maintenance Required |
|------------|-------------------|----------------------|
| **IVFFlat** | ✅ Yes (assigned to nearest centroid) | ⚠️ Periodic REINDEX (every 3-6 months) |
| **HNSW** | ✅ Yes (added to graph) | ✅ No maintenance (self-optimizing) |
| **Partial Index** | ✅ Yes (if matches WHERE clause) | ⚠️ Create new indexes for new sources |
| **No Index** | N/A | ✅ No maintenance |

---

## Path A: Partial Index Maintenance

### When You Crawl a New Source

**Step 1: Check row count**
```sql
SELECT source_id, COUNT(*) as rows
FROM archon_crawled_pages
WHERE source_id = 'new_source_id'
GROUP BY source_id;
```

**Step 2: Decide whether to index**
```
Rows < 3,000:    ✅ Safe to index (lists=25-35)
Rows 3k-8k:      ✅ Safe to index (lists=35-85)
Rows 8k-10k:     ⚠️  Risky (lists=90-100, may timeout)
Rows > 10k:      ❌ Skip (won't fit in 32MB)
```

**Step 3: Create partial index** (if safe)
```sql
-- Calculate lists parameter: rows/100 (min 25, max 100)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_<first_8_chars>
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = <calculated_lists>)
WHERE source_id = 'new_source_id';

-- Example for 5,000 row source:
CREATE INDEX CONCURRENTLY idx_pages_emb_src_abc12345
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 50)
WHERE source_id = 'abc12345xyz';
```

**Step 4: Monitor creation**
```sql
-- Check progress
SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    CASE WHEN indisvalid THEN 'VALID ✅' ELSE 'BUILDING 🔨' END as status
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
JOIN pg_index ON pg_index.indexrelid = pg_class.oid
WHERE tablename = 'archon_crawled_pages'
  AND indexname LIKE 'idx_pages_emb_src_%'
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

### When Existing Sources Grow

**Existing indexed sources**:
- ✅ New pages automatically indexed
- ⚠️ If source grows >50% (e.g., 5k → 7.5k rows), consider rebuilding index with higher lists parameter

**Main source** (a3ff295d1c974439, not indexed):
- ❌ Still not indexed (too large)
- 📊 Monitor growth - if it shrinks below 50k rows, could become indexable

**Example: Rebuild index for growing source**
```sql
-- Source grew from 5k to 8k rows
-- Original: lists=50, now should be lists=80

-- Step 1: Drop old index
DROP INDEX CONCURRENTLY idx_pages_emb_src_abc12345;

-- Step 2: Create new index with updated lists
CREATE INDEX CONCURRENTLY idx_pages_emb_src_abc12345
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 80)
WHERE source_id = 'abc12345xyz';
```

### Automation Script (Optional)

```bash
#!/bin/bash
# scripts/maintain-partial-indexes.sh

echo "=== Partial Index Maintenance Check ==="

# Find sources without indexes that are indexable
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
WITH source_stats AS (
  SELECT
    source_id,
    COUNT(*) as row_count,
    ROUND((COUNT(*) * 1536 * 4) / (1024.0 * 1024.0), 1) as est_memory_mb
  FROM archon_crawled_pages
  WHERE embedding_1536 IS NOT NULL
  GROUP BY source_id
),
indexed_sources AS (
  SELECT SUBSTRING(indexname FROM 'idx_pages_emb_src_(.{8})') as source_prefix
  FROM pg_indexes
  WHERE tablename = 'archon_crawled_pages'
    AND indexname LIKE 'idx_pages_emb_src_%'
)
SELECT
  s.source_id,
  s.row_count,
  s.est_memory_mb,
  CASE
    WHEN s.row_count < 3000 THEN 'CREATE (lists=25-35)'
    WHEN s.row_count < 8000 THEN 'CREATE (lists=35-85)'
    WHEN s.row_count < 10000 THEN 'CREATE (lists=90-100, risky)'
    ELSE 'SKIP (too large)'
  END as recommendation
FROM source_stats s
WHERE NOT EXISTS (
  SELECT 1 FROM indexed_sources i
  WHERE s.source_id LIKE i.source_prefix || '%'
)
  AND s.row_count < 10000
ORDER BY s.row_count DESC;
"
```

---

## Path B: Full Index Maintenance (Local Supabase)

### IVFFlat Index Maintenance

**How IVFFlat Works**:
1. During creation: Clusters data into N "centroids" (N = lists parameter)
2. At query time: Searches only relevant clusters
3. New data: Assigned to nearest existing centroid

**Problem**: As data grows, centroids become less optimal (data distribution changes)

**When to Reindex**:
```bash
# Check dataset growth since index creation
SELECT
  (SELECT COUNT(*) FROM archon_crawled_pages) as current_rows,
  (SELECT reltuples FROM pg_class WHERE relname = 'archon_crawled_pages') as rows_at_last_analyze,
  ROUND(
    (COUNT(*)::numeric - (SELECT reltuples FROM pg_class WHERE relname = 'archon_crawled_pages')) /
    NULLIF((SELECT reltuples FROM pg_class WHERE relname = 'archon_crawled_pages'), 0) * 100,
    1
  ) as growth_pct
FROM archon_crawled_pages;

-- Reindex if:
-- 1. growth_pct > 20% (>50k new rows)
-- 2. Query performance degraded >2x
-- 3. 3-6 months since last reindex
```

**Reindexing Procedure**:
```sql
-- Option A: Reindex in-place (blocks writes briefly during finalization)
REINDEX INDEX idx_archon_crawled_pages_embedding_1536;

-- Option B: Create new, drop old (no downtime, more disk space)
CREATE INDEX CONCURRENTLY idx_archon_crawled_pages_embedding_1536_new
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 1000);

-- After completion:
DROP INDEX CONCURRENTLY idx_archon_crawled_pages_embedding_1536;
ALTER INDEX idx_archon_crawled_pages_embedding_1536_new
RENAME TO idx_archon_crawled_pages_embedding_1536;

-- Update statistics
ANALYZE archon_crawled_pages;
```

### HNSW Index Maintenance

**How HNSW Works**:
1. Builds hierarchical graph structure
2. New vectors inserted directly into graph
3. Graph self-optimizes during inserts

**Maintenance Required**: ✅ **None!**

HNSW is designed for incremental updates. No reindexing needed.

**Only rebuild if**:
- Changing HNSW parameters (m, ef_construction)
- Major schema changes
- Index corruption (very rare)

---

## Performance Monitoring

### Key Metrics to Track

**1. Query Performance**
```sql
-- Test query time
EXPLAIN (ANALYZE, BUFFERS)
SELECT url, content_preview
FROM archon_crawled_pages
ORDER BY embedding_1536 <=> '[0.1,0.2,...]'::vector
LIMIT 10;

-- Look for:
-- - "Index Scan using idx_..." (good - index used)
-- - "Seq Scan on archon_crawled_pages" (bad - index not used)
-- - Execution Time: <5000ms (good), >10000ms (consider reindex)
```

**2. Index Health**
```sql
-- Check index size and bloat
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'archon_crawled_pages'
ORDER BY pg_relation_size(indexrelid) DESC;
```

**3. Cache Hit Rate**
```sql
-- Check Redis cache effectiveness
curl -s http://localhost:8181/api/cache/stats | jq '{
  enabled: .cache_stats.enabled,
  hit_rate: .cache_stats.hit_rate,
  total_hits: .cache_stats.keyspace_hits,
  total_misses: .cache_stats.keyspace_misses
}'

-- Target: >40% hit rate
```

**4. Dataset Growth**
```sql
-- Track growth over time
SELECT
    source_id,
    COUNT(*) as current_rows,
    MIN(created_at) as first_crawled,
    MAX(created_at) as last_crawled,
    AGE(NOW(), MAX(created_at)) as days_since_last_crawl
FROM archon_crawled_pages
GROUP BY source_id
ORDER BY COUNT(*) DESC;
```

### Alerting Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Query Time | >5s | >15s | Check index usage, consider reindex |
| Index Scan Usage | <80% | <50% | Analyze why index not used |
| Dataset Growth | >20% | >50% | Schedule reindex |
| Cache Hit Rate | <30% | <20% | Investigate query patterns |
| Disk Space | >70% | >85% | Archive old data, increase storage |

---

## Maintenance Schedule

### Daily (Automated)
```bash
# Monitor query performance
# Check cache hit rate
# Alert on slow queries (>15s)

# Script: scripts/daily-health-check.sh
curl -s http://localhost:8181/api/cache/stats | \
  jq -e '.cache_stats.hit_rate > 0.3' || \
  echo "WARNING: Cache hit rate below 30%"
```

### Weekly (Manual)
```bash
# Review slow query log
# Check for new sources without indexes
# Monitor disk usage

docker exec supabase-ai-db psql -U postgres -c "
SELECT * FROM pg_stat_statements
WHERE query LIKE '%archon_crawled_pages%'
ORDER BY mean_exec_time DESC
LIMIT 10;
"
```

### Monthly (Manual)
```bash
# Analyze table statistics
# Check index bloat
# Review dataset growth

docker exec supabase-ai-db psql -U postgres -c "
ANALYZE archon_crawled_pages;
VACUUM ANALYZE archon_crawled_pages;
"
```

### Quarterly (Manual)
```bash
# Consider reindex if dataset grew >20%
# Review indexing strategy effectiveness
# Archive old/unused sources
```

---

## Troubleshooting

### Issue: Index Not Being Used

**Check if index exists and is valid**:
```sql
SELECT indexname, indisvalid
FROM pg_indexes
JOIN pg_index ON indexrelid = indexname::regclass::oid
WHERE tablename = 'archon_crawled_pages';
```

**Force query planner to use index**:
```sql
SET enable_seqscan = off;  -- For testing only!
EXPLAIN SELECT ... ORDER BY embedding_1536 <=> ...;
SET enable_seqscan = on;
```

**Update statistics**:
```sql
ANALYZE archon_crawled_pages;
```

### Issue: Slow Index Creation

**Monitor progress**:
```sql
SELECT
    phase,
    blocks_done,
    blocks_total,
    tuples_done,
    tuples_total,
    ROUND((tuples_done::numeric / NULLIF(tuples_total, 0)) * 100, 1) as pct_complete
FROM pg_stat_progress_create_index
WHERE relid = 'archon_crawled_pages'::regclass;
```

**Increase resources** (Local Supabase only):
```sql
SET maintenance_work_mem = '4GB';
SET max_parallel_maintenance_workers = 4;
```

### Issue: Query Performance Degraded

**Check if reindex is needed**:
```sql
-- Compare current vs. expected performance
SELECT
  (SELECT COUNT(*) FROM archon_crawled_pages) as total_rows,
  (SELECT pg_size_pretty(pg_relation_size('archon_crawled_pages'))) as table_size,
  (SELECT pg_size_pretty(pg_relation_size('idx_archon_crawled_pages_embedding_1536'))) as index_size;

-- If index_size is much smaller than expected or table grew >20%:
REINDEX INDEX CONCURRENTLY idx_archon_crawled_pages_embedding_1536;
```

---

## Best Practices

### For Partial Indexes (Path A)
1. ✅ Create index immediately after crawling new source (if <10k rows)
2. ✅ Use lists = rows/100 (min 25, max 100)
3. ✅ Run ONE index creation at a time on Supabase Cloud
4. ❌ Don't index sources >10k rows on Supabase Cloud
5. ✅ Monitor for sources that shrink (may become indexable)

### For Full Indexes (Path B)
1. ✅ Use HNSW for frequently changing data (crawl daily/weekly)
2. ✅ Use IVFFlat for stable data (crawl monthly)
3. ✅ Reindex IVFFlat after >20% growth
4. ✅ Run ANALYZE after major data changes
5. ✅ Monitor query performance weekly

### General
1. ✅ Always use CONCURRENTLY for production
2. ✅ Test on staging before production reindex
3. ✅ Schedule maintenance during off-peak hours
4. ✅ Keep at least 2x index size free disk space
5. ✅ Document index rebuild dates (add to monitoring)

---

## Quick Reference Commands

```bash
# Check current indexes
docker exec supabase-ai-db psql -U postgres -c "
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass))
FROM pg_indexes
WHERE tablename = 'archon_crawled_pages';
"

# Check dataset size
docker exec supabase-ai-db psql -U postgres -c "
SELECT COUNT(*), pg_size_pretty(pg_total_relation_size('archon_crawled_pages'))
FROM archon_crawled_pages;
"

# Test query performance
time curl -s -X POST http://localhost:8181/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "match_count": 10}' | jq '.total'

# Check cache stats
curl -s http://localhost:8181/api/cache/stats | jq '.cache_stats.hit_rate'
```

---

**Last Updated**: 2026-01-09
**Review Frequency**: Quarterly
**Next Review**: 2026-04-09
