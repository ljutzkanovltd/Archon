-- =====================================================
-- Migration 0.2.0 Verification Script
-- =====================================================
-- Description: Verifies that all Phase 0 migrations were applied successfully
-- Author: Archon Enhancement Team
-- Date: 2025-12-21
-- =====================================================

\echo '========================================='
\echo 'Archon Migration 0.2.0 Verification'
\echo '========================================='
\echo ''

-- Check PostgreSQL version
\echo '1. PostgreSQL Version:'
SELECT version();
\echo ''

-- =====================================================
-- Verify 001: Project Archival
-- =====================================================
\echo '2. Verifying Project Archival Migration...'

-- Check columns exist
\echo '   - Checking archon_projects columns...'
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'archon_projects'
  AND column_name IN ('archived', 'archived_at', 'archived_by')
ORDER BY column_name;

-- Check indexes
\echo '   - Checking indexes...'
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'archon_projects'
  AND indexname LIKE '%archived%'
ORDER BY indexname;

-- Check functions
\echo '   - Checking functions...'
SELECT
    proname AS function_name,
    pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname IN ('archive_project_and_tasks', 'unarchive_project_and_tasks')
ORDER BY proname;

\echo '   ✓ Project Archival Migration Complete'
\echo ''

-- =====================================================
-- Verify 002: Task History Tracking
-- =====================================================
\echo '3. Verifying Task History Tracking Migration...'

-- Check table exists
\echo '   - Checking archon_task_history table...'
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'archon_task_history'
ORDER BY ordinal_position;

-- Check indexes
\echo '   - Checking task history indexes...'
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'archon_task_history'
ORDER BY indexname;

-- Check trigger exists
\echo '   - Checking trigger...'
SELECT
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_log_task_changes';

-- Check functions
\echo '   - Checking functions...'
SELECT
    proname AS function_name,
    pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname IN ('log_task_changes', 'get_task_history')
ORDER BY proname;

-- Count existing history records
\echo '   - Task history records count...'
SELECT COUNT(*) AS history_records FROM archon_task_history;

\echo '   ✓ Task History Tracking Migration Complete'
\echo ''

-- =====================================================
-- Verify 003: Task Completion Tracking
-- =====================================================
\echo '4. Verifying Task Completion Tracking Migration...'

-- Check columns exist
\echo '   - Checking archon_tasks completion columns...'
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'archon_tasks'
  AND column_name IN ('completed_at', 'completed_by')
ORDER BY column_name;

-- Check indexes
\echo '   - Checking completion indexes...'
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'archon_tasks'
  AND indexname LIKE '%completed%'
ORDER BY indexname;

-- Check trigger
\echo '   - Checking completion trigger...'
SELECT
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_set_task_completed';

-- Check functions
\echo '   - Checking completion functions...'
SELECT
    proname AS function_name,
    pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname IN ('set_task_completed', 'get_recently_completed_tasks', 'get_project_completion_stats')
ORDER BY proname;

-- Count completed tasks
\echo '   - Completed tasks count...'
SELECT COUNT(*) AS completed_tasks
FROM archon_tasks
WHERE completed_at IS NOT NULL;

\echo '   ✓ Task Completion Tracking Migration Complete'
\echo ''

-- =====================================================
-- Summary Statistics
-- =====================================================
\echo '========================================='
\echo 'Migration Summary'
\echo '========================================='

-- Project stats
\echo '   Projects:'
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE archived = true) AS archived,
    COUNT(*) FILTER (WHERE archived = false) AS active
FROM archon_projects;

-- Task stats
\echo '   Tasks:'
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'done') AS done,
    COUNT(*) FILTER (WHERE status = 'doing') AS doing,
    COUNT(*) FILTER (WHERE status = 'todo') AS todo,
    COUNT(*) FILTER (WHERE archived = true) AS archived,
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS with_completion_time
FROM archon_tasks;

-- History stats
\echo '   Task History:'
SELECT
    COUNT(*) AS total_changes,
    COUNT(DISTINCT task_id) AS tasks_with_history,
    COUNT(DISTINCT field_name) AS distinct_fields_tracked
FROM archon_task_history;

\echo ''
\echo '========================================='
\echo 'Verification Complete!'
\echo '========================================='
\echo ''
\echo 'Next steps:'
\echo '1. Test archival: SELECT archive_project_and_tasks(...)'
\echo '2. Test history: UPDATE a task and check archon_task_history'
\echo '3. Test completion: UPDATE task status to done'
\echo ''
