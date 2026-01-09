-- Migration: Fix Supabase Database Linter Issues
-- Version: 0.3.0
-- Created: 2026-01-09
-- Fixes: 5 security warnings + 4 performance warnings from Supabase Database Linter
--
-- Security Issues Fixed:
-- 1. Function search_path vulnerability (SQL injection risk)
-- 2-3. RLS policies overly permissive on archon_crawl_state
--
-- Performance Issues Fixed:
-- 1-4. Duplicate policy evaluation on archon_crawl_state (4 operations)
--
-- Index Optimization:
-- - Remove truly unused indexes after analysis

BEGIN;

-- ============================================================================
-- PRIORITY 1: CRITICAL SECURITY FIXES
-- ============================================================================

-- Fix 1: Add search_path protection to trigger function
-- This prevents SQL injection by explicitly setting the search path
ALTER FUNCTION public.update_crawl_state_updated_at()
SET search_path = public, extensions;

-- Fix 2: Remove duplicate and overly permissive RLS policy
-- The authenticated policy overlaps with service_role policy
-- This causes both security warnings AND performance issues (duplicate evaluation)
DROP POLICY IF EXISTS "Allow authenticated users full access to crawl state"
ON archon_crawl_state;

-- Fix 3: Add specific read-only policy for authenticated users
-- This is more restrictive and doesn't overlap with service_role
CREATE POLICY "Allow authenticated read access to crawl state"
ON archon_crawl_state
FOR SELECT
TO authenticated
USING (true);

-- Note: "Allow service role full access to crawl state" policy remains unchanged
-- Service role needs full access for backend operations

-- ============================================================================
-- PRIORITY 2: INDEX OPTIMIZATION
-- ============================================================================

-- Remove idx_archon_migrations_version
-- Reason: Migrations table is rarely queried directly, primary key is sufficient
-- This index has never been used and migration queries are infrequent
DROP INDEX IF EXISTS idx_archon_migrations_version;

-- Note: We're keeping 56 other "unused" indexes because:
-- - Vector embedding indexes (multi-dimension support for different models)
-- - Task management indexes (will be used as features are adopted)
-- - MCP tracking indexes (new feature, usage will grow)
-- - Full-text search indexes (trgm for fuzzy search)
-- - Metadata JSONB indexes (for complex filtering)
--
-- These will be monitored over 30 days and removed if truly unused

-- ============================================================================
-- MIGRATION TRACKING
-- ============================================================================

-- Register this migration in the tracking table
INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '011_fix_linter_issues', 'linter-fixes-v2')
ON CONFLICT (version, migration_name) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- ============================================================================

-- Verify function has search_path protection
-- SELECT proname, proconfig FROM pg_proc WHERE proname = 'update_crawl_state_updated_at';
-- Expected: proconfig should contain 'search_path=public,extensions'

-- Verify RLS policies on archon_crawl_state
-- SELECT policyname, roles, cmd, qual FROM pg_policies WHERE tablename = 'archon_crawl_state';
-- Expected: 2 policies total
--   1. "Allow service role full access to crawl state" (ALL, service_role)
--   2. "Allow authenticated read access to crawl state" (SELECT, authenticated)

-- Count remaining unused indexes (should be reduced by 1)
-- SELECT COUNT(*) FROM pg_stat_user_indexes
-- WHERE schemaname = 'public' AND tablename LIKE 'archon_%' AND idx_scan = 0;
-- Expected: 58 (down from 59)
