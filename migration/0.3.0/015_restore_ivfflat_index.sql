-- =====================================================
-- Restore IVFFlat Index (Rollback from Failed HNSW)
-- =====================================================
-- Drops invalid HNSW index and restores working IVFFlat index
-- This ensures archon_crawled_pages has a functional vector index
-- =====================================================

-- Extended timeout for cleanup operations
SET statement_timeout = '10min';

-- Drop invalid HNSW index (845 MB of unusable space)
DROP INDEX IF EXISTS idx_archon_crawled_pages_embedding_1536_hnsw;

-- Recreate IVFFlat index (original configuration that was working)
-- lists = 1000 is appropriate for 200k+ rows
-- This will take ~5-10 minutes but uses minimal memory
CREATE INDEX idx_archon_crawled_pages_embedding_1536
ON archon_crawled_pages
USING ivfflat (embedding_1536 vector_cosine_ops)
WITH (lists = 1000);

-- Reset timeout
RESET statement_timeout;

-- Success message (comment only)
-- IVFFlat index restored
-- Query performance: back to original performance (8-18s)
-- Space reclaimed: 845 MB from invalid HNSW index
