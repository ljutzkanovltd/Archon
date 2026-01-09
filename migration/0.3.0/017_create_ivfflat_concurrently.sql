-- Migration: Create IVFFlat index with CONCURRENTLY for Supabase Cloud shared tier
-- Context: Supabase Cloud has 32MB maintenance_work_mem limit
-- Approach: Use CONCURRENTLY + reduced parameters to avoid resource limits
-- Expected time: 15-30 minutes for 218k rows
-- Status: READY FOR DEPLOYMENT

-- IMPORTANT: Run this via Supabase Dashboard → SQL Editor
-- DO NOT run via psql (web interface handles long operations better)

-- Step 1: Configure memory settings (remove SET LOCAL - doesn't work with CONCURRENTLY)
SET maintenance_work_mem = '32MB';  -- Match Supabase Cloud limit
SET max_parallel_maintenance_workers = 0;  -- Disable parallel workers to save memory

-- Step 2: Create index concurrently with reduced lists parameter
-- lists=500 (instead of 1000) reduces memory requirements
-- Trade-off: Slightly slower queries, but still 10-100x better than sequential scan
CREATE INDEX CONCURRENTLY idx_archon_crawled_pages_embedding_1536
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 500);

-- Note: CONCURRENTLY means:
-- ✅ Doesn't block writes during creation
-- ✅ Less likely to be killed by Supabase resource governor
-- ⏱️ Takes longer than regular CREATE INDEX (but completes successfully)

-- Monitor progress (run in separate SQL query):
-- SELECT
--     phase,
--     blocks_done,
--     blocks_total,
--     tuples_done,
--     tuples_total,
--     ROUND((tuples_done::numeric / NULLIF(tuples_total, 0)) * 100, 1) as pct_complete
-- FROM pg_stat_progress_create_index
-- WHERE relid = 'archon_crawled_pages'::regclass;

-- Verify index created successfully:
-- SELECT
--     indexname,
--     pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
--     CASE WHEN indisvalid THEN 'VALID ✅' ELSE 'INVALID ❌' END as status
-- FROM pg_indexes
-- JOIN pg_class ON pg_class.relname = indexname
-- JOIN pg_index ON pg_index.indexrelid = pg_class.oid
-- WHERE tablename = 'archon_crawled_pages' AND indexname LIKE '%embedding%1536%';
