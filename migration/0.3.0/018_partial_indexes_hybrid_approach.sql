-- Migration: Hybrid Partial Index Strategy for Supabase Cloud Shared Tier
-- Context: Main source (57% of data) is too large, index smaller sources only
-- Expected: 14 indexes, covering 43% of data (all sources except a3ff295d1c974439)
-- Status: READY FOR DEPLOYMENT

-- ===========================================================================
-- WARNING: Run these ONE AT A TIME in Supabase SQL Editor
-- DO NOT run all at once - may exceed concurrent index build limits
-- ===========================================================================

-- Source 2: a2c3772c3fc50f03 (10,150 rows, 59.5 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_a2c3772c
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 100)
WHERE source_id = 'a2c3772c3fc50f03';

-- Source 3: 4d14a42f7d645f4c (9,733 rows, 57.0 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_4d14a42f
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 100)
WHERE source_id = '4d14a42f7d645f4c';

-- Source 4: 811367d92da2083c (9,299 rows, 54.5 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_811367d9
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 90)
WHERE source_id = '811367d92da2083c';

-- Source 5: ac314e941e2bb7a8 (8,550 rows, 50.1 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_ac314e94
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 85)
WHERE source_id = 'ac314e941e2bb7a8';

-- Source 6: e78dce57d572c115 (6,711 rows, 39.3 MB) - FastAPI docs
CREATE INDEX CONCURRENTLY idx_pages_emb_src_e78dce57
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 70)
WHERE source_id = 'e78dce57d572c115';

-- Source 7: 2acbe9e28c4ba0b9 (6,507 rows, 38.1 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_2acbe9e2
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 65)
WHERE source_id = '2acbe9e28c4ba0b9';

-- Source 8: e037523d85be92fb (6,452 rows, 37.8 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_e037523d
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 65)
WHERE source_id = 'e037523d85be92fb';

-- Source 9: e003faf38bc287b3 (5,767 rows, 33.8 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_e003faf3
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 60)
WHERE source_id = 'e003faf38bc287b3';

-- Source 10: 47d0203a7b9d285a (5,264 rows, 30.8 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_47d0203a
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 50)
WHERE source_id = '47d0203a7b9d285a';

-- Source 11: 7bc86cb1e5f64e27 (3,643 rows, 21.3 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_7bc86cb1
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 35)
WHERE source_id = '7bc86cb1e5f64e27';

-- Source 12: 5c9f1f15ac499ee9 (3,423 rows, 20.1 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_5c9f1f15
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 35)
WHERE source_id = '5c9f1f15ac499ee9';

-- Source 13: 310b3e71be09852d (3,390 rows, 19.9 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_310b3e71
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 35)
WHERE source_id = '310b3e71be09852d';

-- Source 14: ac3964f3d9a17029 (3,107 rows, 18.2 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_ac3964f3
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 30)
WHERE source_id = 'ac3964f3d9a17029';

-- Source 15: 11217e97399022d9 (2,639 rows, 15.5 MB)
CREATE INDEX CONCURRENTLY idx_pages_emb_src_11217e97
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 25)
WHERE source_id = '11217e97399022d9';

-- ===========================================================================
-- VERIFICATION QUERY
-- ===========================================================================
-- Run this after all indexes complete:
SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
    CASE WHEN indisvalid THEN 'VALID ✅' ELSE 'INVALID ❌' END as status
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
JOIN pg_index ON pg_index.indexrelid = pg_class.oid
WHERE tablename = 'archon_crawled_pages'
  AND indexname LIKE 'idx_pages_emb_src%'
ORDER BY indexname;

-- ===========================================================================
-- NOTES
-- ===========================================================================
-- 1. Largest source (a3ff295d1c974439, 124k rows) is NOT indexed
--    - Too large for Supabase Cloud (729 MB)
--    - Queries to this source will use sequential scan
--    - Rely on Redis cache for repeat queries
--
-- 2. Each index should take 2-8 minutes to build
--    - Total time: ~1-2 hours for all 14 indexes
--    - Run during off-peak hours
--
-- 3. Query planner will automatically:
--    - Use partial index when source_id is in WHERE clause
--    - Fall back to seq scan for largest source
--    - Fall back to seq scan when source_id not specified
--
-- 4. Expected performance:
--    - Indexed sources (43% of queries): 1-5s
--    - Main source (57% of queries): 60-180s (first), 0.8-2s (cached)
--    - Combined average with 40% cache hit: ~25s per query
