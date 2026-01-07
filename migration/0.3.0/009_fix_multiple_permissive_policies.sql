-- Migration: 009_fix_multiple_permissive_policies.sql
-- Purpose: Fix "Multiple Permissive Policies" performance warnings on 11 tables
-- Date: 2026-01-04
-- Performance: WARN - Multiple permissive policies for same role/action cause overhead
--
-- Problem: Current service_role policies use USING ((SELECT auth.role()) = 'service_role')
--          which is PERMISSIVE and applies to all roles. When authenticated users query,
--          PostgreSQL evaluates BOTH policies (wasted work).
--
-- Solution: Change service_role policies to use role targeting: TO service_role
--           This ensures the policy only applies to service_role connections.

-- =============================================================================
-- SECTION 1: archon_settings
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_settings" ON archon_settings;

CREATE POLICY "Allow service role full access to archon_settings"
ON archon_settings FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SECTION 2: archon_migrations
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_migrations" ON archon_migrations;

CREATE POLICY "Allow service role full access to archon_migrations"
ON archon_migrations FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SECTION 3: archon_projects
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_projects" ON archon_projects;

CREATE POLICY "Allow service role full access to archon_projects"
ON archon_projects FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SECTION 4: archon_tasks
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_tasks" ON archon_tasks;

CREATE POLICY "Allow service role full access to archon_tasks"
ON archon_tasks FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SECTION 5: archon_task_history
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_task_history" ON archon_task_history;

CREATE POLICY "Allow service role full access to archon_task_history"
ON archon_task_history FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SECTION 6: archon_project_sources
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_project_sources" ON archon_project_sources;

CREATE POLICY "Allow service role full access to archon_project_sources"
ON archon_project_sources FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SECTION 7: archon_document_versions
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_document_versions" ON archon_document_versions;

CREATE POLICY "Allow service role full access to archon_document_versions"
ON archon_document_versions FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SECTION 8: archon_prompts
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_prompts" ON archon_prompts;

CREATE POLICY "Allow service role full access to archon_prompts"
ON archon_prompts FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SECTION 9: archon_mcp_sessions
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_mcp_sessions" ON archon_mcp_sessions;

CREATE POLICY "Allow service role full access to archon_mcp_sessions"
ON archon_mcp_sessions FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SECTION 10: archon_mcp_requests
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_mcp_requests" ON archon_mcp_requests;

CREATE POLICY "Allow service role full access to archon_mcp_requests"
ON archon_mcp_requests FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SECTION 11: archon_llm_pricing
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_llm_pricing" ON archon_llm_pricing;

CREATE POLICY "Allow service role full access to archon_llm_pricing"
ON archon_llm_pricing FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- SECTION 12: Record Migration
-- =============================================================================

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '009_fix_multiple_permissive_policies', 'performance-fix')
ON CONFLICT (version, migration_name) DO NOTHING;


-- =============================================================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================================================
--
-- 1. Check no multiple permissive policies for same role/action:
-- SELECT schemaname, tablename, COUNT(*) as policy_count
-- FROM pg_policies
-- WHERE tablename LIKE 'archon%'
-- GROUP BY schemaname, tablename
-- ORDER BY tablename;
-- Expected: Each table should have exactly 2 policies
--
-- 2. Verify policies are role-targeted:
-- SELECT tablename, policyname, roles
-- FROM pg_policies
-- WHERE tablename LIKE 'archon%'
-- ORDER BY tablename, policyname;
-- Expected: service_role policies show {service_role}, authenticated show {authenticated}
