-- =====================================================
-- Create IVFFlat Index (Clean Slate)
-- =====================================================
-- Creates IVFFlat index for archon_crawled_pages
-- No HNSW index exists, so this is a clean creation
-- =====================================================

-- Extended timeout for index build
SET statement_timeout = '15min';

-- Create IVFFlat index (original configuration that was working)
-- lists = 1000 is appropriate for 200k+ rows
-- This will take ~5-10 minutes
CREATE INDEX idx_archon_crawled_pages_embedding_1536
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 1000);

-- Reset timeout
RESET statement_timeout;

-- Verification (run separately after completion)
-- SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
--        CASE WHEN indisvalid THEN 'VALID' ELSE 'INVALID' END as status
-- FROM pg_indexes
-- JOIN pg_class ON pg_class.relname = indexname
-- JOIN pg_index ON pg_index.indexrelid = pg_class.oid
-- WHERE tablename = 'archon_crawled_pages' AND indexname LIKE '%embedding%1536%';
