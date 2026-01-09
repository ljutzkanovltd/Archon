-- =====================================================
-- Clean up invalid index and rebuild HNSW properly
-- =====================================================
-- Drops invalid HNSW index from failed build
-- Drops old IVFFlat index (no longer needed)
-- Creates fresh HNSW index with minimal parameters
-- =====================================================

-- Extended timeout for long operation
SET statement_timeout = '60min';

-- Drop invalid HNSW index (from previous failed attempt)
DROP INDEX CONCURRENTLY IF EXISTS idx_archon_crawled_pages_embedding_1536_hnsw;

-- Drop old IVFFlat index (being replaced)
DROP INDEX IF EXISTS idx_archon_crawled_pages_embedding_1536;

-- Create fresh HNSW index with minimal memory footprint
-- m=4, ef_construction=16: Absolute minimum for Supabase Cloud
-- Will take 10-20 minutes but uses minimal memory
CREATE INDEX CONCURRENTLY idx_archon_crawled_pages_embedding_1536_hnsw
ON archon_crawled_pages
USING hnsw (embedding_1536 vector_cosine_ops)
WITH (m = 4, ef_construction = 16);

-- Reset timeout
RESET statement_timeout;

-- Verification (run separately after completion)
-- SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
--        CASE WHEN indisvalid THEN 'VALID' ELSE 'INVALID' END as status
-- FROM pg_indexes
-- JOIN pg_class ON pg_class.relname = indexname
-- JOIN pg_index ON pg_index.indexrelid = pg_class.oid
-- WHERE indexname LIKE '%embedding_1536%hnsw%';
