-- Migration: Fix Function search_path Vulnerability (Security Remediation)
-- Version: 031
-- Created: 2026-01-12
-- Purpose: Fix 32 functions with mutable search_path (SQL injection risk)
-- Risk Level: MEDIUM - Function hijacking via malicious schemas
-- Deployment: Production (Week 1)

-- ============================================================================
-- SECURITY ISSUE: Function search_path Mutable
--
-- Impact: Functions without SET search_path can be hijacked by attacker schemas
-- Risk: SQL injection, privilege escalation, data exfiltration
--
-- Fix: Add SET search_path = '' to all 32 vulnerable functions
-- This forces all unqualified references to use pg_catalog schema only
-- ============================================================================

BEGIN;

-- ============================================================================
-- CATEGORY 1: SESSION MANAGEMENT (4 functions)
-- ============================================================================

-- 1. update_session_status
ALTER FUNCTION update_session_status()
SET search_path = '';

-- 2. get_disconnected_sessions
ALTER FUNCTION get_disconnected_sessions(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
SET search_path = '';

-- 3. get_active_mcp_clients
ALTER FUNCTION get_active_mcp_clients()
SET search_path = '';

-- 4. get_user_sessions
ALTER FUNCTION get_user_sessions(
  p_user_id uuid,
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
SET search_path = '';

-- ============================================================================
-- CATEGORY 2: TASK MANAGEMENT (5 functions)
-- ============================================================================

-- 5. log_task_changes
ALTER FUNCTION log_task_changes()
SET search_path = '';

-- 6. get_recently_completed_tasks
ALTER FUNCTION get_recently_completed_tasks(
  days_param integer,
  project_id_param uuid,
  limit_param integer
)
SET search_path = '';

-- 7. set_task_completed
ALTER FUNCTION set_task_completed()
SET search_path = '';

-- 8. get_task_history
ALTER FUNCTION get_task_history(
  task_id_param uuid,
  field_name_param text,
  limit_param integer
)
SET search_path = '';

-- 9. get_project_completion_stats
ALTER FUNCTION get_project_completion_stats(
  project_id_param uuid
)
SET search_path = '';

-- ============================================================================
-- CATEGORY 3: VECTOR SEARCH (8 functions)
-- ============================================================================

-- 10. hybrid_search_archon_code_examples
ALTER FUNCTION hybrid_search_archon_code_examples(
  query_embedding vector,
  query_text text,
  match_count integer,
  filter jsonb,
  source_filter text
)
SET search_path = '';

-- 11. match_archon_code_examples
ALTER FUNCTION match_archon_code_examples(
  query_embedding vector,
  match_count integer,
  filter jsonb,
  source_filter text
)
SET search_path = '';

-- 12. hybrid_search_archon_crawled_pages
ALTER FUNCTION hybrid_search_archon_crawled_pages(
  query_embedding vector,
  query_text text,
  match_count integer,
  filter jsonb,
  source_filter text
)
SET search_path = '';

-- 13. match_archon_crawled_pages
ALTER FUNCTION match_archon_crawled_pages(
  query_embedding vector,
  match_count integer,
  filter jsonb,
  source_filter text
)
SET search_path = '';

-- 14. hybrid_search_archon_code_examples_multi
ALTER FUNCTION hybrid_search_archon_code_examples_multi(
  query_embedding vector,
  embedding_dimension integer,
  query_text text,
  match_count integer,
  filter jsonb,
  source_filter text
)
SET search_path = '';

-- 15. match_archon_code_examples_multi
ALTER FUNCTION match_archon_code_examples_multi(
  query_embedding vector,
  embedding_dimension integer,
  match_count integer,
  filter jsonb,
  source_filter text
)
SET search_path = '';

-- 16. hybrid_search_archon_crawled_pages_multi
ALTER FUNCTION hybrid_search_archon_crawled_pages_multi(
  query_embedding vector,
  embedding_dimension integer,
  query_text text,
  match_count integer,
  filter jsonb,
  source_filter text
)
SET search_path = '';

-- 17. match_archon_crawled_pages_multi
ALTER FUNCTION match_archon_crawled_pages_multi(
  query_embedding vector,
  embedding_dimension integer,
  match_count integer,
  filter jsonb,
  source_filter text
)
SET search_path = '';

-- ============================================================================
-- CATEGORY 4: PROJECT/ARCHIVE MANAGEMENT (4 functions)
-- ============================================================================

-- 18. archive_project_and_tasks
ALTER FUNCTION archive_project_and_tasks(
  project_id_param uuid,
  archived_by_param text
)
SET search_path = '';

-- 19. archive_task
ALTER FUNCTION archive_task(
  task_id_param uuid,
  archived_by_param text
)
SET search_path = '';

-- 20. unarchive_project_and_tasks
ALTER FUNCTION unarchive_project_and_tasks(
  project_id_param uuid
)
SET search_path = '';

-- 21. purge_old_task_history
ALTER FUNCTION purge_old_task_history(
  retention_days integer,
  keep_archived boolean,
  dry_run boolean
)
SET search_path = '';

-- ============================================================================
-- CATEGORY 5: MCP ANALYTICS (4 functions)
-- ============================================================================

-- 22. calculate_request_cost
ALTER FUNCTION calculate_request_cost(
  model_name_param character varying,
  provider_param character varying,
  prompt_tokens_param integer,
  completion_tokens_param integer
)
SET search_path = '';

-- 23. get_mcp_usage_by_tool
ALTER FUNCTION get_mcp_usage_by_tool(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
SET search_path = '';

-- 24. get_mcp_usage_summary
ALTER FUNCTION get_mcp_usage_summary(
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
SET search_path = '';

-- 25. get_user_activity_summary
ALTER FUNCTION get_user_activity_summary(
  p_user_id uuid,
  days integer
)
SET search_path = '';

-- ============================================================================
-- CATEGORY 6: UTILITY/HELPER FUNCTIONS (7 functions)
-- ============================================================================

-- 26. get_sync_stats
ALTER FUNCTION get_sync_stats(
  p_days integer
)
SET search_path = '';

-- 27. get_embedding_column_name
ALTER FUNCTION get_embedding_column_name(
  dimension integer
)
SET search_path = '';

-- 28. detect_embedding_dimension
ALTER FUNCTION detect_embedding_dimension(
  embedding_vector vector
)
SET search_path = '';

-- 29. get_latest_sync
ALTER FUNCTION get_latest_sync(
  p_direction text
)
SET search_path = '';

-- 30. update_updated_at_column
ALTER FUNCTION update_updated_at_column()
SET search_path = '';

-- 31. update_sync_history_updated_at
ALTER FUNCTION update_sync_history_updated_at()
SET search_path = '';

-- 32. update_crawl_state_updated_at
ALTER FUNCTION update_crawl_state_updated_at()
SET search_path = '';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all 32 functions now have search_path set
DO $$
DECLARE
  functions_without_search_path INTEGER;
BEGIN
  SELECT COUNT(*) INTO functions_without_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'update_session_status',
      'get_sync_stats',
      'calculate_request_cost',
      'archive_project_and_tasks',
      'hybrid_search_archon_code_examples',
      'archive_task',
      'get_disconnected_sessions',
      'get_task_history',
      'get_active_mcp_clients',
      'log_task_changes',
      'get_recently_completed_tasks',
      'set_task_completed',
      'match_archon_code_examples',
      'update_sync_history_updated_at',
      'update_crawl_state_updated_at',
      'hybrid_search_archon_crawled_pages_multi',
      'match_archon_code_examples_multi',
      'get_embedding_column_name',
      'hybrid_search_archon_code_examples_multi',
      'hybrid_search_archon_crawled_pages',
      'match_archon_crawled_pages',
      'update_updated_at_column',
      'unarchive_project_and_tasks',
      'purge_old_task_history',
      'get_mcp_usage_by_tool',
      'get_user_sessions',
      'detect_embedding_dimension',
      'get_mcp_usage_summary',
      'get_project_completion_stats',
      'match_archon_crawled_pages_multi',
      'get_latest_sync',
      'get_user_activity_summary'
    )
    AND p.proconfig IS NULL;  -- NULL means no search_path set

  IF functions_without_search_path > 0 THEN
    RAISE EXCEPTION 'Search path verification failed: % functions still have no search_path set', functions_without_search_path;
  END IF;

  RAISE NOTICE 'Search path verification passed: All 32 functions have search_path set to empty string';
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

-- Run these queries after migration to verify function security:

-- 1. Check all 32 functions have search_path = ''
-- SELECT
--   p.proname AS function_name,
--   p.proconfig AS config_settings
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'update_session_status', 'get_sync_stats', ...
--   )
-- ORDER BY p.proname;
--
-- Expected: config_settings = '{"search_path="}' for all 32 functions

-- 2. Verify no remaining functions with mutable search_path
-- SELECT COUNT(*)
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.proconfig IS NULL
--   AND p.proname LIKE 'archon_%' OR p.proname IN ('get_%', 'update_%', 'match_%', 'hybrid_%');
--
-- Expected: Significantly reduced count (only non-Archon functions)

-- ============================================================================
-- ROLLBACK PROCEDURE (Emergency Only)
-- ============================================================================

-- If this migration causes issues, rollback with:
--
-- BEGIN;
--
-- -- Reset search_path for all 32 functions (returns to mutable state)
-- ALTER FUNCTION update_session_status() RESET search_path;
-- ALTER FUNCTION get_sync_stats(integer) RESET search_path;
-- ALTER FUNCTION calculate_request_cost(varchar, varchar, int, int) RESET search_path;
-- -- ... (repeat for all 32 functions)
--
-- COMMIT;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

-- Security Context:
-- - Fixes 32 WARNING-level vulnerabilities (function search_path mutable)
-- - Prevents SQL injection via schema/operator hijacking
-- - Attack requires schema creation permissions (MEDIUM likelihood)
-- - But impact is HIGH (privilege escalation, data theft)
--
-- Fix Mechanism:
-- - SET search_path = '' forces all operators/functions to use pg_catalog
-- - No function body changes required
-- - No runtime performance impact (resolved at function creation time)
-- - PostgreSQL security best practice
--
-- Testing:
-- - Test all vector search operations (most complex functions)
-- - Test task CRUD operations
-- - Test session management
-- - Test MCP tool calls
-- - Verify no SQL errors in logs
--
-- Performance Impact:
-- - Expected: <1% overhead (negligible)
-- - May actually improve performance (fewer schema lookups)
-- - Benchmark before/after to confirm
--
-- Deployment:
-- - Deploy to local Supabase first for testing
-- - Test all API endpoints and MCP tools
-- - Deploy to remote Supabase Cloud after local tests pass
-- - Monitor Supabase security advisors for confirmation
