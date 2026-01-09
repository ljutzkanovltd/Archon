-- =====================================================
-- Create HNSW Index for archon_crawled_pages (Final)
-- =====================================================
-- This completes the HNSW upgrade by creating the main table index.
-- Code examples table already has HNSW index from previous run.
--
-- IMPORTANT: CONCURRENTLY cannot be inside a transaction block.
-- =====================================================

-- Set session parameters
SET statement_timeout = '30min';
SET maintenance_work_mem = '2GB';

-- Create HNSW index for main table (CONCURRENTLY - no transaction needed)
-- This will take 5-15 minutes for 212k rows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archon_crawled_pages_embedding_1536_hnsw
ON archon_crawled_pages
USING hnsw (embedding_1536 vector_cosine_ops)
WITH (m = 8, ef_construction = 32);

-- Reset session parameters
RESET statement_timeout;
RESET maintenance_work_mem;

-- Verification query (run separately after completion)
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'archon_crawled_pages'
-- AND indexname LIKE '%hnsw%';
