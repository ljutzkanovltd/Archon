-- Migration: 007_optimize_rls_initplan.sql
-- Purpose: Optimize RLS policies to prevent InitPlan performance issues
-- Date: 2026-01-04
-- Performance: WARN - Using auth.uid() directly in RLS causes re-evaluation per row
-- Solution: Wrap auth functions in (SELECT ...) to force single evaluation

-- =============================================================================
-- NOTE: This migration recreates RLS policies with optimized auth function calls
-- The pattern (SELECT auth.role()) is evaluated once per query instead of per row
-- =============================================================================

-- =============================================================================
-- SECTION 1: archon_settings
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_settings" ON archon_settings;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_settings" ON archon_settings;

CREATE POLICY "Allow service role full access to archon_settings"
ON archon_settings FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_settings"
ON archon_settings FOR SELECT TO authenticated
USING (true);

-- =============================================================================
-- SECTION 2: archon_migrations
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_migrations" ON archon_migrations;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_migrations" ON archon_migrations;

CREATE POLICY "Allow service role full access to archon_migrations"
ON archon_migrations FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_migrations"
ON archon_migrations FOR SELECT TO authenticated
USING (true);

-- =============================================================================
-- SECTION 3: archon_projects
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_projects" ON archon_projects;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_projects" ON archon_projects;

CREATE POLICY "Allow service role full access to archon_projects"
ON archon_projects FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_projects"
ON archon_projects FOR SELECT TO authenticated
USING (true);

-- =============================================================================
-- SECTION 4: archon_tasks
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_tasks" ON archon_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_tasks" ON archon_tasks;

CREATE POLICY "Allow service role full access to archon_tasks"
ON archon_tasks FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_tasks"
ON archon_tasks FOR SELECT TO authenticated
USING (true);

-- =============================================================================
-- SECTION 5: archon_project_sources
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_project_sources" ON archon_project_sources;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_project_sources" ON archon_project_sources;

CREATE POLICY "Allow service role full access to archon_project_sources"
ON archon_project_sources FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_project_sources"
ON archon_project_sources FOR SELECT TO authenticated
USING (true);

-- =============================================================================
-- SECTION 6: archon_document_versions
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_document_versions" ON archon_document_versions;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_document_versions" ON archon_document_versions;

CREATE POLICY "Allow service role full access to archon_document_versions"
ON archon_document_versions FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_document_versions"
ON archon_document_versions FOR SELECT TO authenticated
USING (true);

-- =============================================================================
-- SECTION 7: archon_prompts
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_prompts" ON archon_prompts;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_prompts" ON archon_prompts;

CREATE POLICY "Allow service role full access to archon_prompts"
ON archon_prompts FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_prompts"
ON archon_prompts FOR SELECT TO authenticated
USING (true);

-- =============================================================================
-- SECTION 8: archon_mcp_sessions
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_mcp_sessions" ON archon_mcp_sessions;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_mcp_sessions" ON archon_mcp_sessions;

CREATE POLICY "Allow service role full access to archon_mcp_sessions"
ON archon_mcp_sessions FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_mcp_sessions"
ON archon_mcp_sessions FOR SELECT TO authenticated
USING (true);

-- =============================================================================
-- SECTION 9: archon_mcp_requests
-- =============================================================================
DROP POLICY IF EXISTS "Allow service role full access to archon_mcp_requests" ON archon_mcp_requests;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_mcp_requests" ON archon_mcp_requests;

CREATE POLICY "Allow service role full access to archon_mcp_requests"
ON archon_mcp_requests FOR ALL
USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_mcp_requests"
ON archon_mcp_requests FOR SELECT TO authenticated
USING (true);

-- =============================================================================
-- SECTION 10: archon_llm_pricing (if exists)
-- =============================================================================
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

-- =============================================================================
-- SECTION 11: Record Migration
-- =============================================================================

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '007_optimize_rls_initplan', 'performance-fix')
ON CONFLICT (version, migration_name) DO NOTHING;
