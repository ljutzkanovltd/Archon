-- =====================================================
-- Migration 0.2.0 ROLLBACK Script
-- =====================================================
-- Description: Rolls back all Phase 0 enhancements
-- WARNING: This will permanently delete task history data!
-- Author: Archon Enhancement Team
-- Date: 2025-12-21
-- =====================================================

-- Prompt for confirmation
DO $$
BEGIN
    RAISE NOTICE 'WARNING: This rollback will delete all task history data.';
    RAISE NOTICE 'Press Ctrl+C now to cancel, or wait 5 seconds to continue...';
    PERFORM pg_sleep(5);
END $$;

-- =====================================================
-- Rollback 003: Task Completion Tracking
-- =====================================================

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_set_task_completed ON archon_tasks;

-- Drop functions
DROP FUNCTION IF EXISTS set_task_completed();
DROP FUNCTION IF EXISTS get_recently_completed_tasks(INTEGER, UUID, INTEGER);
DROP FUNCTION IF EXISTS get_project_completion_stats(UUID);

-- Drop indexes
DROP INDEX IF EXISTS idx_archon_tasks_completed_at;
DROP INDEX IF EXISTS idx_archon_tasks_project_completed;

-- Remove columns
ALTER TABLE archon_tasks
    DROP COLUMN IF EXISTS completed_at,
    DROP COLUMN IF EXISTS completed_by;

-- =====================================================
-- Rollback 002: Task History Tracking
-- =====================================================

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_log_task_changes ON archon_tasks;

-- Drop functions
DROP FUNCTION IF EXISTS log_task_changes();
DROP FUNCTION IF EXISTS get_task_history(UUID, TEXT, INTEGER);

-- Drop table (THIS DELETES ALL HISTORY DATA!)
DROP TABLE IF EXISTS archon_task_history CASCADE;

-- =====================================================
-- Rollback 001: Project Archival
-- =====================================================

-- Drop functions
DROP FUNCTION IF EXISTS archive_project_and_tasks(UUID, TEXT);
DROP FUNCTION IF EXISTS unarchive_project_and_tasks(UUID);

-- Drop indexes
DROP INDEX IF EXISTS idx_archon_projects_archived;
DROP INDEX IF EXISTS idx_archon_projects_archived_at;
DROP INDEX IF EXISTS idx_archon_projects_active;

-- Remove columns
ALTER TABLE archon_projects
    DROP COLUMN IF EXISTS archived,
    DROP COLUMN IF EXISTS archived_at,
    DROP COLUMN IF EXISTS archived_by;

-- =====================================================
-- Rollback complete
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Rollback complete. All Phase 0 enhancements have been removed.';
    RAISE NOTICE 'IMPORTANT: Task history data has been permanently deleted!';
END $$;
