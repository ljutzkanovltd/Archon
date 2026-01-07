-- =============================================================================
-- COMBINED MIGRATION: 004-007 Security and Performance Fixes
-- =============================================================================
-- Run this in Supabase SQL Editor
-- Date: 2026-01-04
--
-- Includes:
--   004: Fix function search_path security vulnerability (26 functions)
--   005: Add RLS policy for archon_task_history table
--   006: Add index on archon_tasks.parent_task_id foreign key
--   007: Optimize RLS policies to prevent InitPlan performance issues
-- =============================================================================


-- =============================================================================
-- 004: FIX FUNCTION SEARCH_PATH SECURITY
-- =============================================================================
-- Security: WARN - Functions without explicit search_path are vulnerable to
--           search_path injection attacks

DO $$
BEGIN
  -- Task Management Functions
  ALTER FUNCTION archive_task(UUID, TEXT) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION archive_project_and_tasks(UUID, TEXT) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION unarchive_project_and_tasks(UUID) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION log_task_changes() SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION set_task_completed(UUID) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION get_task_history(UUID, TEXT, INTEGER) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION get_recently_completed_tasks(INTEGER, INTEGER) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION get_project_completion_stats(UUID, INTEGER) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- MCP Session/Request Functions
DO $$
BEGIN
  ALTER FUNCTION update_session_status(UUID, TEXT) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION calculate_request_cost(TEXT, INTEGER, INTEGER, TEXT, TEXT) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION get_active_mcp_clients() SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION get_mcp_usage_summary(INTERVAL) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION get_mcp_usage_by_tool(INTERVAL) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Embedding/Search Functions
DO $$
BEGIN
  ALTER FUNCTION get_embedding_column_name() SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION detect_embedding_dimension() SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Match functions (vector search)
DO $$
BEGIN
  ALTER FUNCTION match_archon_crawled_pages(vector, DOUBLE PRECISION, INTEGER) SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION match_archon_code_examples(vector, DOUBLE PRECISION, INTEGER) SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION match_archon_crawled_pages_adaptive(vector, DOUBLE PRECISION, INTEGER) SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION match_archon_code_examples_adaptive(vector, DOUBLE PRECISION, INTEGER) SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Hybrid search functions
DO $$
BEGIN
  ALTER FUNCTION hybrid_search_archon_crawled_pages(TEXT, vector, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION hybrid_search_archon_code_examples(TEXT, vector, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION hybrid_search_archon_crawled_pages_adaptive(TEXT, vector, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION hybrid_search_archon_code_examples_adaptive(TEXT, vector, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Utility Functions
DO $$
BEGIN
  ALTER FUNCTION update_updated_at_column() SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION get_bulk_source_counts(TEXT[]) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '004_fix_function_search_path_security', 'security-fix')
ON CONFLICT (version, migration_name) DO NOTHING;


-- =============================================================================
-- 005: ADD RLS POLICY FOR ARCHON_TASK_HISTORY
-- =============================================================================
-- Security: INFO - Table has RLS enabled but no policies (blocks all access)

DROP POLICY IF EXISTS "Allow service role full access to archon_task_history" ON archon_task_history;
DROP POLICY IF EXISTS "Allow authenticated read access to archon_task_history" ON archon_task_history;

CREATE POLICY "Allow service role full access to archon_task_history"
ON archon_task_history FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated read access to archon_task_history"
ON archon_task_history FOR SELECT TO authenticated
USING (true);

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '005_add_task_history_rls_policy', 'security-fix')
ON CONFLICT (version, migration_name) DO NOTHING;


-- =============================================================================
-- 006: ADD INDEX ON PARENT_TASK_ID FOREIGN KEY
-- =============================================================================
-- Performance: INFO - Unindexed foreign keys cause slow JOIN operations

CREATE INDEX IF NOT EXISTS idx_archon_tasks_parent_task_id
ON archon_tasks(parent_task_id)
WHERE parent_task_id IS NOT NULL;

COMMENT ON INDEX idx_archon_tasks_parent_task_id IS
'Index on parent_task_id FK for efficient subtask queries and cascade operations';

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '006_add_parent_task_id_index', 'performance-fix')
ON CONFLICT (version, migration_name) DO NOTHING;


-- =============================================================================
-- 007: OPTIMIZE RLS POLICIES (INITPLAN FIX)
-- =============================================================================
-- Performance: WARN - Using auth.uid() directly causes re-evaluation per row
-- Solution: Wrap in (SELECT ...) to force single evaluation per query

-- archon_settings
DROP POLICY IF EXISTS "Allow service role full access to archon_settings" ON archon_settings;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_settings" ON archon_settings;

CREATE POLICY "Allow service role full access to archon_settings"
ON archon_settings FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_settings"
ON archon_settings FOR SELECT TO authenticated
USING (true);

-- archon_migrations
DROP POLICY IF EXISTS "Allow service role full access to archon_migrations" ON archon_migrations;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_migrations" ON archon_migrations;

CREATE POLICY "Allow service role full access to archon_migrations"
ON archon_migrations FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_migrations"
ON archon_migrations FOR SELECT TO authenticated
USING (true);

-- archon_projects
DROP POLICY IF EXISTS "Allow service role full access to archon_projects" ON archon_projects;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_projects" ON archon_projects;

CREATE POLICY "Allow service role full access to archon_projects"
ON archon_projects FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_projects"
ON archon_projects FOR SELECT TO authenticated
USING (true);

-- archon_tasks
DROP POLICY IF EXISTS "Allow service role full access to archon_tasks" ON archon_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_tasks" ON archon_tasks;

CREATE POLICY "Allow service role full access to archon_tasks"
ON archon_tasks FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_tasks"
ON archon_tasks FOR SELECT TO authenticated
USING (true);

-- archon_project_sources
DROP POLICY IF EXISTS "Allow service role full access to archon_project_sources" ON archon_project_sources;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_project_sources" ON archon_project_sources;

CREATE POLICY "Allow service role full access to archon_project_sources"
ON archon_project_sources FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_project_sources"
ON archon_project_sources FOR SELECT TO authenticated
USING (true);

-- archon_document_versions
DROP POLICY IF EXISTS "Allow service role full access to archon_document_versions" ON archon_document_versions;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_document_versions" ON archon_document_versions;

CREATE POLICY "Allow service role full access to archon_document_versions"
ON archon_document_versions FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_document_versions"
ON archon_document_versions FOR SELECT TO authenticated
USING (true);

-- archon_prompts
DROP POLICY IF EXISTS "Allow service role full access to archon_prompts" ON archon_prompts;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_prompts" ON archon_prompts;

CREATE POLICY "Allow service role full access to archon_prompts"
ON archon_prompts FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_prompts"
ON archon_prompts FOR SELECT TO authenticated
USING (true);

-- archon_mcp_sessions
DROP POLICY IF EXISTS "Allow service role full access to archon_mcp_sessions" ON archon_mcp_sessions;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_mcp_sessions" ON archon_mcp_sessions;

CREATE POLICY "Allow service role full access to archon_mcp_sessions"
ON archon_mcp_sessions FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_mcp_sessions"
ON archon_mcp_sessions FOR SELECT TO authenticated
USING (true);

-- archon_mcp_requests
DROP POLICY IF EXISTS "Allow service role full access to archon_mcp_requests" ON archon_mcp_requests;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_mcp_requests" ON archon_mcp_requests;

CREATE POLICY "Allow service role full access to archon_mcp_requests"
ON archon_mcp_requests FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_mcp_requests"
ON archon_mcp_requests FOR SELECT TO authenticated
USING (true);

-- archon_llm_pricing (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'archon_llm_pricing') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow service role full access to archon_llm_pricing" ON archon_llm_pricing';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated users to read archon_llm_pricing" ON archon_llm_pricing';

    EXECUTE 'CREATE POLICY "Allow service role full access to archon_llm_pricing"
      ON archon_llm_pricing FOR ALL
      USING ((SELECT auth.role()) = ''service_role'')';

    EXECUTE 'CREATE POLICY "Allow authenticated users to read archon_llm_pricing"
      ON archon_llm_pricing FOR SELECT TO authenticated
      USING (true)';
  END IF;
END $$;

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '007_optimize_rls_initplan', 'performance-fix')
ON CONFLICT (version, migration_name) DO NOTHING;


-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- After running, verify with:
-- SELECT version, migration_name, applied_at FROM archon_migrations WHERE version = '0.3.0' ORDER BY migration_name;
