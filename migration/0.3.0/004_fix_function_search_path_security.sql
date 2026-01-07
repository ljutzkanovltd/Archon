-- Migration: 004_fix_function_search_path_security.sql
-- Purpose: Fix search_path injection vulnerability in 26 PostgreSQL functions
-- Date: 2026-01-04
-- Security: WARN - Functions without explicit search_path are vulnerable to
--           search_path injection attacks where malicious schemas can intercept calls
-- Solution: Set search_path = public for all affected functions

-- =============================================================================
-- SECTION 1: Task Management Functions
-- =============================================================================

ALTER FUNCTION IF EXISTS archive_task(UUID, TEXT) SET search_path = public;
ALTER FUNCTION IF EXISTS archive_project_and_tasks(UUID, TEXT) SET search_path = public;
ALTER FUNCTION IF EXISTS unarchive_project_and_tasks(UUID) SET search_path = public;
ALTER FUNCTION IF EXISTS log_task_changes() SET search_path = public;
ALTER FUNCTION IF EXISTS set_task_completed(UUID) SET search_path = public;
ALTER FUNCTION IF EXISTS get_task_history(UUID, TEXT, INTEGER) SET search_path = public;
ALTER FUNCTION IF EXISTS get_recently_completed_tasks(INTEGER, INTEGER) SET search_path = public;
ALTER FUNCTION IF EXISTS get_project_completion_stats(UUID, INTEGER) SET search_path = public;

-- =============================================================================
-- SECTION 2: MCP Session/Request Functions
-- =============================================================================

ALTER FUNCTION IF EXISTS update_session_status(UUID, TEXT) SET search_path = public;
ALTER FUNCTION IF EXISTS calculate_request_cost(TEXT, INTEGER, INTEGER, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION IF EXISTS get_active_mcp_clients() SET search_path = public;
ALTER FUNCTION IF EXISTS get_mcp_usage_summary(INTERVAL) SET search_path = public;
ALTER FUNCTION IF EXISTS get_mcp_usage_by_tool(INTERVAL) SET search_path = public;

-- =============================================================================
-- SECTION 3: Embedding/Search Functions
-- =============================================================================

ALTER FUNCTION IF EXISTS get_embedding_column_name() SET search_path = public, extensions;
ALTER FUNCTION IF EXISTS detect_embedding_dimension() SET search_path = public, extensions;

-- Match functions (vector search)
ALTER FUNCTION IF EXISTS match_archon_crawled_pages(vector, DOUBLE PRECISION, INTEGER) SET search_path = public, extensions;
ALTER FUNCTION IF EXISTS match_archon_code_examples(vector, DOUBLE PRECISION, INTEGER) SET search_path = public, extensions;
ALTER FUNCTION IF EXISTS match_archon_crawled_pages_adaptive(vector, DOUBLE PRECISION, INTEGER) SET search_path = public, extensions;
ALTER FUNCTION IF EXISTS match_archon_code_examples_adaptive(vector, DOUBLE PRECISION, INTEGER) SET search_path = public, extensions;

-- Hybrid search functions
ALTER FUNCTION IF EXISTS hybrid_search_archon_crawled_pages(TEXT, vector, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) SET search_path = public, extensions;
ALTER FUNCTION IF EXISTS hybrid_search_archon_code_examples(TEXT, vector, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) SET search_path = public, extensions;
ALTER FUNCTION IF EXISTS hybrid_search_archon_crawled_pages_adaptive(TEXT, vector, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) SET search_path = public, extensions;
ALTER FUNCTION IF EXISTS hybrid_search_archon_code_examples_adaptive(TEXT, vector, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) SET search_path = public, extensions;

-- =============================================================================
-- SECTION 4: Utility Functions
-- =============================================================================

ALTER FUNCTION IF EXISTS update_updated_at_column() SET search_path = public;
ALTER FUNCTION IF EXISTS get_bulk_source_counts(TEXT[]) SET search_path = public;

-- =============================================================================
-- SECTION 5: Record Migration
-- =============================================================================

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '004_fix_function_search_path_security', 'security-fix')
ON CONFLICT (version, migration_name) DO NOTHING;
