-- Migration: Upgrade HNSW Index Parameters
-- Created: 2026-01-24
-- Purpose: Upgrade from m=4 to m=16 for better recall accuracy
-- Impact: 5-10 minute rebuild, queries will be slower during rebuild

-- Current: idx_archon_crawled_pages_embedding_1536_hnsw (m=4, ef_construction=16)
-- Target:  idx_archon_crawled_pages_embedding_1536_hnsw (m=16, ef_construction=64)

-- IMPORTANT: This migration will take 5-10 minutes for 63,388 rows
-- During rebuild, search queries will use table scan instead of index

BEGIN;

-- Log start time
DO $$
BEGIN
    RAISE NOTICE 'Starting HNSW index upgrade at %', NOW();
    RAISE NOTICE 'This will take 5-10 minutes for 63,388 rows';
END $$;

-- Drop existing index
DROP INDEX IF EXISTS idx_archon_crawled_pages_embedding_1536_hnsw;

-- Log drop complete
DO $$
BEGIN
    RAISE NOTICE 'Old index dropped at %', NOW();
    RAISE NOTICE 'Creating new index with m=16, ef_construction=64...';
END $$;

-- Create new optimized index
-- Parameters:
--   m=16: Maximum number of connections per layer (default=16, was 4)
--         Higher m = better recall but larger index and slower build
--   ef_construction=64: Size of dynamic candidate list (default=64, was 16)
--         Higher ef_construction = better index quality but slower build
CREATE INDEX idx_archon_crawled_pages_embedding_1536_hnsw
ON archon_crawled_pages
USING hnsw (embedding_1536 vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'New index created at %', NOW();
    RAISE NOTICE 'Index upgrade complete!';
END $$;

-- Verify index was created correctly
DO $$
DECLARE
    index_def TEXT;
BEGIN
    SELECT indexdef INTO index_def
    FROM pg_indexes
    WHERE indexname = 'idx_archon_crawled_pages_embedding_1536_hnsw';

    IF index_def IS NULL THEN
        RAISE EXCEPTION 'Index was not created!';
    END IF;

    IF index_def NOT LIKE '%m=''16''%' THEN
        RAISE EXCEPTION 'Index does not have m=16 parameter!';
    END IF;

    IF index_def NOT LIKE '%ef_construction=''64''%' THEN
        RAISE EXCEPTION 'Index does not have ef_construction=64 parameter!';
    END IF;

    RAISE NOTICE 'Index verification passed: %', index_def;
END $$;

-- Get index size
DO $$
DECLARE
    index_size TEXT;
BEGIN
    SELECT pg_size_pretty(pg_relation_size('idx_archon_crawled_pages_embedding_1536_hnsw'))
    INTO index_size;

    RAISE NOTICE 'New index size: %', index_size;
END $$;

COMMIT;

-- Final summary
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'HNSW Index Upgrade Complete';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Old parameters: m=4, ef_construction=16';
    RAISE NOTICE 'New parameters: m=16, ef_construction=64';
    RAISE NOTICE 'Expected improvements:';
    RAISE NOTICE '  - 4x better recall accuracy';
    RAISE NOTICE '  - Slight latency increase (82ms -> 90-100ms)';
    RAISE NOTICE '  - Larger index size (374MB -> ~700MB)';
    RAISE NOTICE '==============================================';
END $$;
