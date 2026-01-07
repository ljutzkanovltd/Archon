-- Migration: 010_add_crawled_pages_source_id_index.sql
-- Purpose: Add index on archon_crawled_pages.source_id for faster chunk queries
-- Date: 2026-01-04
-- Performance: CRITICAL - Chunks endpoint times out without this index
--
-- Problem: The /api/knowledge-items/{source_id}/chunks endpoint times out on
--          Supabase free/pro tiers because queries on archon_crawled_pages
--          require sequential scans without an index on source_id.
--
-- Solution: Create composite index on (source_id, url) to support both:
--           1. Filtering by source_id (WHERE source_id = ?)
--           2. Ordering by url (ORDER BY url)

-- =============================================================================
-- SECTION 1: Create Index on archon_crawled_pages.source_id
-- =============================================================================
-- NOTE: If running in Supabase SQL Editor and CONCURRENTLY fails,
-- remove the CONCURRENTLY keyword and run each CREATE INDEX separately.

-- Create composite index for efficient source_id filtering and url ordering
CREATE INDEX IF NOT EXISTS idx_archon_crawled_pages_source_id_url
ON archon_crawled_pages(source_id, url);

COMMENT ON INDEX idx_archon_crawled_pages_source_id_url IS
'Composite index for efficient chunk queries by source_id with url ordering';

-- Also create a simple index on source_id alone for count queries
CREATE INDEX IF NOT EXISTS idx_archon_crawled_pages_source_id
ON archon_crawled_pages(source_id);

COMMENT ON INDEX idx_archon_crawled_pages_source_id IS
'Index on source_id for efficient count queries and filtering';


-- =============================================================================
-- SECTION 2: Create Index on archon_code_examples.source_id (if missing)
-- =============================================================================

-- Code examples also query by source_id, add index if not exists
CREATE INDEX IF NOT EXISTS idx_archon_code_examples_source_id
ON archon_code_examples(source_id);

COMMENT ON INDEX idx_archon_code_examples_source_id IS
'Index on source_id for efficient code examples filtering';


-- =============================================================================
-- SECTION 3: Record Migration
-- =============================================================================

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '010_add_crawled_pages_source_id_index', 'performance-fix')
ON CONFLICT (version, migration_name) DO NOTHING;


-- =============================================================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================================================
--
-- 1. Check indexes were created:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('archon_crawled_pages', 'archon_code_examples')
-- ORDER BY tablename, indexname;
--
-- 2. Test chunks query uses index:
-- EXPLAIN ANALYZE
-- SELECT id, source_id, content, metadata, url
-- FROM archon_crawled_pages
-- WHERE source_id = '2acbe9e28c4ba0b9'
-- ORDER BY url, id
-- LIMIT 20;
-- Expected: Index Scan or Bitmap Index Scan on idx_archon_crawled_pages_source_id_url
