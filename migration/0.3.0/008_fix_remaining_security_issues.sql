-- Migration: 008_fix_remaining_security_issues.sql
-- Purpose: Corrective fix for functions missed by 004 due to wrong signatures
-- Date: 2026-01-04
-- Security: WARN - 8 functions still vulnerable to search_path injection
-- Also: Cleanup duplicate RLS policies created during optimization

-- =============================================================================
-- PART 1: Fix Function search_path with CORRECT Signatures
-- =============================================================================
-- These functions were not fixed in 004 because the signatures were wrong.
-- Signatures verified from: SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc

-- Vector search functions (correct signatures)
ALTER FUNCTION match_archon_crawled_pages(vector, integer, jsonb, text)
  SET search_path = public, extensions;

ALTER FUNCTION match_archon_crawled_pages_multi(vector, integer, integer, jsonb, text)
  SET search_path = public, extensions;

ALTER FUNCTION match_archon_code_examples(vector, integer, jsonb, text)
  SET search_path = public, extensions;

ALTER FUNCTION match_archon_code_examples_multi(vector, integer, integer, jsonb, text)
  SET search_path = public, extensions;

-- Hybrid search functions (correct signatures)
ALTER FUNCTION hybrid_search_archon_crawled_pages(vector, text, integer, jsonb, text)
  SET search_path = public, extensions;

ALTER FUNCTION hybrid_search_archon_crawled_pages_multi(vector, integer, text, integer, jsonb, text)
  SET search_path = public, extensions;

ALTER FUNCTION hybrid_search_archon_code_examples(vector, text, integer, jsonb, text)
  SET search_path = public, extensions;

ALTER FUNCTION hybrid_search_archon_code_examples_multi(vector, integer, text, integer, jsonb, text)
  SET search_path = public, extensions;


-- =============================================================================
-- PART 2: Fix Other Functions with Correct Signatures
-- =============================================================================
-- These were also missed due to signature mismatches

-- Trigger functions (no arguments)
DO $$
BEGIN
  ALTER FUNCTION set_task_completed() SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION update_session_status() SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Stats functions with correct signatures
DO $$
BEGIN
  ALTER FUNCTION get_project_completion_stats(uuid) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION get_recently_completed_tasks(integer, uuid, integer) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- MCP functions with correct signatures (timestamptz, not interval)
DO $$
BEGIN
  ALTER FUNCTION calculate_request_cost(varchar, varchar, integer, integer) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION get_mcp_usage_summary(timestamptz, timestamptz) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION get_mcp_usage_by_tool(timestamptz, timestamptz) SET search_path = public;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Embedding functions with correct signatures
DO $$
BEGIN
  ALTER FUNCTION get_embedding_column_name(integer) SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  ALTER FUNCTION detect_embedding_dimension(vector) SET search_path = public, extensions;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;


-- =============================================================================
-- PART 3: Remove Duplicate RLS Policies
-- =============================================================================
-- Old unoptimized policies that were replaced by 007 but not dropped

-- archon_settings: remove old policies (replaced by optimized versions)
DROP POLICY IF EXISTS "Allow service role full access" ON archon_settings;
DROP POLICY IF EXISTS "Allow authenticated users to read and update" ON archon_settings;

-- archon_projects: remove duplicate
DROP POLICY IF EXISTS "Allow authenticated users to read and update archon_projects" ON archon_projects;

-- archon_project_sources: remove duplicate (truncated name)
DROP POLICY IF EXISTS "Allow authenticated users to read and update archon_project_sou" ON archon_project_sources;

-- archon_tasks: remove duplicate
DROP POLICY IF EXISTS "Allow authenticated users to read and update archon_tasks" ON archon_tasks;


-- =============================================================================
-- PART 4: Record Migration
-- =============================================================================

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '008_fix_remaining_security_issues', 'corrective-fix')
ON CONFLICT (version, migration_name) DO NOTHING;


-- =============================================================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================================================
--
-- 1. Check all vector/hybrid functions now have search_path:
-- SELECT p.proname, p.proconfig
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND (p.proname LIKE 'hybrid_search_archon%' OR p.proname LIKE 'match_archon%')
-- ORDER BY p.proname;
-- Expected: All should show proconfig with search_path values
--
-- 2. Check no duplicate policies remain:
-- SELECT schemaname, tablename, policyname
-- FROM pg_policies
-- WHERE tablename LIKE 'archon%'
-- ORDER BY tablename, policyname;
-- Expected: Each table should have exactly 2 policies (service_role + authenticated)
