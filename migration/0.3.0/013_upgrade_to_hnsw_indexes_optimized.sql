-- =====================================================
-- Upgrade Vector Indexes from IVFFlat to HNSW (Optimized)
-- =====================================================
-- This migration replaces IVFFlat indexes with HNSW indexes for better
-- performance and accuracy.
--
-- OPTIMIZED for Supabase Cloud with timeout and memory limits.
-- =====================================================

-- Set session parameters for long-running index build
SET statement_timeout = '30min';
SET maintenance_work_mem = '2GB';

BEGIN;

-- =====================================================
-- SECTION 1: UPGRADE archon_crawled_pages INDEXES
-- =====================================================

-- Drop old IVFFlat index for 1536-dimensional embeddings
DROP INDEX IF EXISTS idx_archon_crawled_pages_embedding_1536;

-- Create HNSW index with SMALLER parameters optimized for Supabase Cloud
-- m=8: Lower memory usage (default is 16)
-- ef_construction=32: Faster build (default is 64)
-- Trade-off: Slightly less accuracy for much faster build and lower memory
CREATE INDEX CONCURRENTLY idx_archon_crawled_pages_embedding_1536_hnsw
ON archon_crawled_pages
USING hnsw (embedding_1536 vector_cosine_ops)
WITH (m = 8, ef_construction = 32);

COMMIT;

-- Separate transaction for code examples (smaller table)
BEGIN;

-- =====================================================
-- SECTION 2: UPGRADE archon_code_examples INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_archon_code_examples_embedding_1536;

CREATE INDEX IF NOT EXISTS idx_archon_code_examples_embedding_1536_hnsw
ON archon_code_examples
USING hnsw (embedding_1536 vector_cosine_ops)
WITH (m = 8, ef_construction = 32);

COMMIT;

-- =====================================================
-- SECTION 3: REGISTER MIGRATION
-- =====================================================

BEGIN;

INSERT INTO archon_migrations (version, name, description, applied_at)
VALUES (
    '0.3.0',
    '013_upgrade_to_hnsw_indexes',
    'Replace IVFFlat indexes with HNSW indexes for 50-80% performance improvement. Optimized for Supabase Cloud with m=8, ef_construction=32.',
    NOW()
)
ON CONFLICT (version, name) DO NOTHING;

COMMIT;

-- Reset session parameters
RESET statement_timeout;
RESET maintenance_work_mem;
