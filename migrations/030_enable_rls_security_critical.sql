-- Migration: Enable RLS on Critical Tables (Security Remediation)
-- Version: 030
-- Created: 2026-01-12
-- Purpose: Fix 7 critical security issues identified by Supabase advisors
-- Risk Level: HIGH - Prevents unauthorized data access via PostgREST API
-- Deployment: Production URGENT (within 24 hours)

-- ============================================================================
-- CRITICAL SECURITY ISSUE: RLS Disabled on Public Tables
--
-- Impact: Any authenticated user can read/modify all data in these tables
-- Risk: Data exposure, unauthorized modifications, no audit trail protection
--
-- This migration enables RLS and creates appropriate policies for:
-- 1. archon_agent_work_orders
-- 2. archon_agent_work_order_steps
-- 3. archon_configured_repositories
-- 4. archon_mcp_alerts
-- 5. archon_mcp_error_logs
-- 6. archon_task_history
-- 7. backup_test_validation
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ARCHON_AGENT_WORK_ORDERS
-- ============================================================================

-- Enable RLS
ALTER TABLE archon_agent_work_orders ENABLE ROW LEVEL SECURITY;

-- Service role: Full access (backend API)
CREATE POLICY "Service role full access to work orders"
  ON archon_agent_work_orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users: Read-only access
CREATE POLICY "Authenticated users can read work orders"
  ON archon_agent_work_orders
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 2. ARCHON_AGENT_WORK_ORDER_STEPS
-- ============================================================================

-- Enable RLS
ALTER TABLE archon_agent_work_order_steps ENABLE ROW LEVEL SECURITY;

-- Service role: Full access (backend API)
CREATE POLICY "Service role full access to work order steps"
  ON archon_agent_work_order_steps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users: Read-only access
CREATE POLICY "Authenticated users can read work order steps"
  ON archon_agent_work_order_steps
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 3. ARCHON_CONFIGURED_REPOSITORIES
-- ============================================================================

-- Enable RLS
ALTER TABLE archon_configured_repositories ENABLE ROW LEVEL SECURITY;

-- Service role: Full access (backend API)
CREATE POLICY "Service role full access to configured repositories"
  ON archon_configured_repositories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users: Read-only access
CREATE POLICY "Authenticated users can read configured repositories"
  ON archon_configured_repositories
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 4. ARCHON_MCP_ALERTS
-- ============================================================================

-- Enable RLS
ALTER TABLE archon_mcp_alerts ENABLE ROW LEVEL SECURITY;

-- Service role: Full access (backend API)
CREATE POLICY "Service role full access to MCP alerts"
  ON archon_mcp_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users: Read-only access
CREATE POLICY "Authenticated users can read MCP alerts"
  ON archon_mcp_alerts
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 5. ARCHON_MCP_ERROR_LOGS (Contains sensitive session_id)
-- ============================================================================

-- Enable RLS
ALTER TABLE archon_mcp_error_logs ENABLE ROW LEVEL SECURITY;

-- Service role: Full access (backend API)
CREATE POLICY "Service role full access to MCP error logs"
  ON archon_mcp_error_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users: Read-only access
-- Note: session_id column is exposed but read-only
CREATE POLICY "Authenticated users can read MCP error logs"
  ON archon_mcp_error_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 6. ARCHON_TASK_HISTORY
-- ============================================================================

-- Enable RLS
ALTER TABLE archon_task_history ENABLE ROW LEVEL SECURITY;

-- Service role: Full access (backend API)
CREATE POLICY "Service role full access to task history"
  ON archon_task_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users: Read-only access
CREATE POLICY "Authenticated users can read task history"
  ON archon_task_history
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 7. BACKUP_TEST_VALIDATION (Test table - can be restrictive)
-- ============================================================================

-- Enable RLS
ALTER TABLE backup_test_validation ENABLE ROW LEVEL SECURITY;

-- Service role: Full access (backend API)
CREATE POLICY "Service role full access to backup test validation"
  ON backup_test_validation
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No authenticated user access (internal test table)

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify RLS is enabled on all 7 tables
DO $$
DECLARE
  rls_disabled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rls_disabled_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'archon_agent_work_orders',
      'archon_agent_work_order_steps',
      'archon_configured_repositories',
      'archon_mcp_alerts',
      'archon_mcp_error_logs',
      'archon_task_history',
      'backup_test_validation'
    )
    AND rowsecurity = false;

  IF rls_disabled_count > 0 THEN
    RAISE EXCEPTION 'RLS verification failed: % tables still have RLS disabled', rls_disabled_count;
  END IF;

  RAISE NOTICE 'RLS verification passed: All 7 tables have RLS enabled';
END $$;

-- Verify policies were created (expecting 13 policies total)
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'archon_agent_work_orders',
      'archon_agent_work_order_steps',
      'archon_configured_repositories',
      'archon_mcp_alerts',
      'archon_mcp_error_logs',
      'archon_task_history',
      'backup_test_validation'
    );

  IF policy_count < 13 THEN
    RAISE WARNING 'Policy count lower than expected: % policies (expected 13)', policy_count;
  ELSE
    RAISE NOTICE 'Policy verification passed: % policies created', policy_count;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

-- Run these queries after migration to verify security:

-- 1. Check RLS status
-- SELECT
--   schemaname,
--   tablename,
--   rowsecurity as rls_enabled
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename LIKE 'archon_%'
-- ORDER BY tablename;

-- 2. Check policies
-- SELECT
--   schemaname,
--   tablename,
--   policyname,
--   roles,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'archon_agent_work_orders',
--     'archon_agent_work_order_steps',
--     'archon_configured_repositories',
--     'archon_mcp_alerts',
--     'archon_mcp_error_logs',
--     'archon_task_history',
--     'backup_test_validation'
--   )
-- ORDER BY tablename, policyname;

-- 3. Test access as authenticated user (should work for SELECT only)
-- SET ROLE authenticated;
-- SELECT COUNT(*) FROM archon_mcp_alerts; -- Should work
-- INSERT INTO archon_mcp_alerts (...) VALUES (...); -- Should fail
-- RESET ROLE;

-- ============================================================================
-- ROLLBACK PROCEDURE (Emergency Only)
-- ============================================================================

-- If this migration causes issues, rollback with:
--
-- BEGIN;
--
-- -- Drop all policies
-- DROP POLICY IF EXISTS "Service role full access to work orders" ON archon_agent_work_orders;
-- DROP POLICY IF EXISTS "Authenticated users can read work orders" ON archon_agent_work_orders;
-- DROP POLICY IF EXISTS "Service role full access to work order steps" ON archon_agent_work_order_steps;
-- DROP POLICY IF EXISTS "Authenticated users can read work order steps" ON archon_agent_work_order_steps;
-- DROP POLICY IF EXISTS "Service role full access to configured repositories" ON archon_configured_repositories;
-- DROP POLICY IF EXISTS "Authenticated users can read configured repositories" ON archon_configured_repositories;
-- DROP POLICY IF EXISTS "Service role full access to MCP alerts" ON archon_mcp_alerts;
-- DROP POLICY IF EXISTS "Authenticated users can read MCP alerts" ON archon_mcp_alerts;
-- DROP POLICY IF EXISTS "Service role full access to MCP error logs" ON archon_mcp_error_logs;
-- DROP POLICY IF EXISTS "Authenticated users can read MCP error logs" ON archon_mcp_error_logs;
-- DROP POLICY IF EXISTS "Service role full access to task history" ON archon_task_history;
-- DROP POLICY IF EXISTS "Authenticated users can read task history" ON archon_task_history;
-- DROP POLICY IF EXISTS "Service role full access to backup test validation" ON backup_test_validation;
--
-- -- Disable RLS (WARNING: This reverts to insecure state)
-- ALTER TABLE archon_agent_work_orders DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE archon_agent_work_order_steps DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE archon_configured_repositories DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE archon_mcp_alerts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE archon_mcp_error_logs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE archon_task_history DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE backup_test_validation DISABLE ROW LEVEL SECURITY;
--
-- COMMIT;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

-- Security Context:
-- - This migration fixes 7 CRITICAL security issues identified by Supabase
-- - Without RLS, any authenticated user can access ALL data in these tables
-- - Sensitive session_id columns are exposed in 2 tables
-- - PostgREST API exposes these tables without protection
--
-- Policy Design:
-- - Service role: Full access (FOR ALL) - backend API needs complete control
-- - Authenticated users: Read-only (FOR SELECT) - frontend/MCP can query
-- - backup_test_validation: Service role only (internal test table)
--
-- Testing:
-- - Test backend API functionality after migration
-- - Test frontend data fetching after migration
-- - Verify MCP tools work correctly after migration
-- - Test with both service_role and authenticated contexts
--
-- Performance Impact:
-- - Minimal - RLS policies use (true) predicates
-- - No complex filtering or joins in policies
-- - Should not impact query performance
--
-- Deployment:
-- - Deploy to local Supabase first for testing
-- - Test all API endpoints and MCP tools
-- - Deploy to remote Supabase Cloud within 24 hours
-- - Monitor error logs for RLS-related issues
