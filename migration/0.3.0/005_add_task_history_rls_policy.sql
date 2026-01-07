-- Migration: 005_add_task_history_rls_policy.sql
-- Purpose: Add RLS policy for archon_task_history table
-- Date: 2026-01-04
-- Security: INFO - Table has RLS enabled but no policies (blocks all access)

-- =============================================================================
-- SECTION 1: Add RLS Policies for archon_task_history
-- =============================================================================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Allow service role full access to archon_task_history" ON archon_task_history;
DROP POLICY IF EXISTS "Allow authenticated read access to archon_task_history" ON archon_task_history;

-- Service role has full access
CREATE POLICY "Allow service role full access to archon_task_history"
ON archon_task_history
FOR ALL
USING ((SELECT auth.role()) = 'service_role');

-- Authenticated users can read task history
CREATE POLICY "Allow authenticated read access to archon_task_history"
ON archon_task_history
FOR SELECT
TO authenticated
USING (true);

-- =============================================================================
-- SECTION 2: Record Migration
-- =============================================================================

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '005_add_task_history_rls_policy', 'security-fix')
ON CONFLICT (version, migration_name) DO NOTHING;
