-- Migration: 002_optimize_knowledge_queries.sql
-- Purpose: Add bulk counts function and optimized indexes for knowledge base queries
-- Date: 2026-01-04
-- Description:
--   - Adds get_bulk_source_counts() function for efficient bulk count retrieval
--   - Adds covering indexes for count queries to avoid full table scans
--   - Fixes the N+1 query problem in knowledge base frontend

-- =============================================================================
-- SECTION 1: Covering Indexes for Count Queries
-- =============================================================================
-- These indexes allow count queries to be satisfied entirely from the index
-- without reading the main table data (index-only scans)

-- Covering index for archon_crawled_pages count queries
CREATE INDEX IF NOT EXISTS idx_archon_crawled_pages_source_id_count
ON archon_crawled_pages (source_id)
INCLUDE (id);

COMMENT ON INDEX idx_archon_crawled_pages_source_id_count IS
    'Covering index for efficient COUNT(*) queries by source_id';

-- Covering index for archon_code_examples count queries
CREATE INDEX IF NOT EXISTS idx_archon_code_examples_source_id_count
ON archon_code_examples (source_id)
INCLUDE (id);

COMMENT ON INDEX idx_archon_code_examples_source_id_count IS
    'Covering index for efficient COUNT(*) queries by source_id';


-- =============================================================================
-- SECTION 2: Bulk Counts Function
-- =============================================================================
-- This function retrieves document and code example counts for multiple sources
-- in a single query, replacing N*2 individual queries with 1 efficient query

CREATE OR REPLACE FUNCTION get_bulk_source_counts(source_ids TEXT[])
RETURNS TABLE(
    source_id TEXT,
    documents_count BIGINT,
    code_examples_count BIGINT
)
LANGUAGE SQL
STABLE
PARALLEL SAFE
AS $$
    SELECT
        s.source_id,
        COALESCE(p.cnt, 0) as documents_count,
        COALESCE(c.cnt, 0) as code_examples_count
    FROM unnest(source_ids) AS s(source_id)
    LEFT JOIN (
        SELECT cp.source_id, COUNT(*) as cnt
        FROM archon_crawled_pages cp
        WHERE cp.source_id = ANY(source_ids)
        GROUP BY cp.source_id
    ) p ON s.source_id = p.source_id
    LEFT JOIN (
        SELECT ce.source_id, COUNT(*) as cnt
        FROM archon_code_examples ce
        WHERE ce.source_id = ANY(source_ids)
        GROUP BY ce.source_id
    ) c ON s.source_id = c.source_id;
$$;

COMMENT ON FUNCTION get_bulk_source_counts(TEXT[]) IS
    'Efficiently retrieve document and code example counts for multiple sources in one query. '
    'Replaces N*2 individual count queries with a single batch query.';


-- =============================================================================
-- SECTION 3: Grant Permissions
-- =============================================================================
-- Ensure the function is accessible via PostgREST

GRANT EXECUTE ON FUNCTION get_bulk_source_counts(TEXT[]) TO authenticator, anon, authenticated;


-- =============================================================================
-- SECTION 4: Verification Queries (for testing)
-- =============================================================================
-- After running this migration, test with:
--
-- SELECT * FROM get_bulk_source_counts(ARRAY['source_id_1', 'source_id_2']);
--
-- Or via PostgREST:
-- POST /rest/v1/rpc/get_bulk_source_counts
-- { "source_ids": ["source_id_1", "source_id_2"] }


-- =============================================================================
-- SECTION 5: Index Analysis (for performance verification)
-- =============================================================================
-- Run these queries after migration to verify index usage:
--
-- EXPLAIN ANALYZE SELECT COUNT(*) FROM archon_crawled_pages WHERE source_id = 'test';
--
-- Expected: Should show "Index Only Scan using idx_archon_crawled_pages_source_id_count"
