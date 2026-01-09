-- Migration: Fix Service Role Policy Overlap on archon_crawl_state
-- Version: 0.3.0
-- Created: 2026-01-09
-- Fixes: Performance warning (duplicate policy evaluation) and security warning (overly permissive)
--
-- Issue: Service role policy targets 'public' (all roles) instead of 'service_role' specifically
-- This causes overlap with authenticated policy, resulting in duplicate evaluation
--
-- Before:
--   - Service role policy: TO public (applies to ALL roles including authenticated)
--   - Authenticated policy: TO authenticated
--   - Result: Authenticated users matched by BOTH policies (performance issue)
--
-- After:
--   - Service role policy: TO service_role (applies ONLY to service role)
--   - Authenticated policy: TO authenticated
--   - Result: Each role has exactly ONE policy (no overlap)

BEGIN;

-- Drop the overly broad service role policy
DROP POLICY IF EXISTS "Allow service role full access to crawl state"
ON archon_crawl_state;

-- Recreate targeting ONLY the service_role
-- This prevents overlap with authenticated policy
CREATE POLICY "Allow service role full access to crawl state"
ON archon_crawl_state
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Note: "USING (true)" for service_role is intentional
-- Service role is the backend and needs unrestricted access
-- This will still show as a security "warning" but it's by design

-- Register migration
INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '012_fix_service_role_policy', 'service-role-policy-fix')
ON CONFLICT (version, migration_name) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify policies after migration
-- SELECT policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'archon_crawl_state'
-- ORDER BY policyname;
--
-- Expected result (2 policies, NO overlap):
--   1. "Allow authenticated read access to crawl state" | {authenticated} | SELECT | true
--   2. "Allow service role full access to crawl state"  | {service_role}  | ALL    | true
--
-- This fixes:
-- ✅ Performance warning: No more duplicate evaluation for authenticated users
-- ✅ Security warning: Service role policy now properly scoped (though "USING true" warning remains - intentional)
