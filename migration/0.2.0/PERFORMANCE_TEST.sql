-- Performance Testing Script for Phase 0 Archival System
-- Tests query performance with large datasets

-- ============================================
-- SETUP: Create test data
-- ============================================

BEGIN;

-- Create temporary test projects (100 projects)
DO $$
DECLARE
    i INTEGER;
    project_id UUID;
BEGIN
    FOR i IN 1..100 LOOP
        INSERT INTO archon_projects (title, description, archived, archived_at, archived_by, created_at, updated_at)
        VALUES (
            'Performance Test Project ' || i,
            'Test project for performance benchmarking',
            (i % 4 = 0),  -- 25% archived
            CASE WHEN i % 4 = 0 THEN NOW() - (i || ' days')::INTERVAL ELSE NULL END,
            CASE WHEN i % 4 = 0 THEN 'PerfTest' ELSE NULL END,
            NOW() - (365 - i || ' days')::INTERVAL,
            NOW()
        )
        RETURNING id INTO project_id;

        -- Create 100 tasks per project (10,000 total tasks)
        FOR j IN 1..100 LOOP
            INSERT INTO archon_tasks (
                project_id,
                title,
                description,
                status,
                assignee,
                priority,
                archived,
                completed_at,
                completed_by,
                created_at,
                updated_at
            )
            VALUES (
                project_id,
                'Performance Test Task ' || j || ' for Project ' || i,
                'Test task for benchmarking',
                (CASE
                    WHEN j % 4 = 0 THEN 'done'
                    WHEN j % 4 = 1 THEN 'doing'
                    WHEN j % 4 = 2 THEN 'review'
                    ELSE 'todo'
                END)::task_status,
                CASE WHEN j % 3 = 0 THEN 'User' WHEN j % 3 = 1 THEN 'Archon' ELSE 'Admin' END,
                (CASE WHEN j % 3 = 0 THEN 'high' WHEN j % 3 = 1 THEN 'medium' ELSE 'low' END)::task_priority,
                (i % 4 = 0),  -- Archived if project is archived
                CASE WHEN j % 4 = 0 THEN NOW() - (j || ' hours')::INTERVAL ELSE NULL END,
                CASE WHEN j % 4 = 0 THEN 'User' ELSE NULL END,
                NOW() - ((100 - j) || ' hours')::INTERVAL,
                NOW()
            );
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Created 100 test projects with 10,000 test tasks';
END $$;

-- Create task history entries (1000 changes)
DO $$
DECLARE
    task_record RECORD;
    i INTEGER;
BEGIN
    -- Get first 10 completed tasks
    FOR task_record IN (
        SELECT id FROM archon_tasks WHERE status = 'done' LIMIT 10
    ) LOOP
        -- Create 100 history entries per task
        FOR i IN 1..100 LOOP
            INSERT INTO archon_task_history (
                task_id,
                field_name,
                old_value,
                new_value,
                changed_by,
                changed_at,
                change_reason
            )
            VALUES (
                task_record.id,
                CASE WHEN i % 4 = 0 THEN 'status' WHEN i % 4 = 1 THEN 'assignee' WHEN i % 4 = 2 THEN 'priority' ELSE 'title' END,
                'old_value_' || i,
                'new_value_' || i,
                CASE WHEN i % 2 = 0 THEN 'User' ELSE 'Archon' END,
                NOW() - ((100 - i) || ' minutes')::INTERVAL,
                NULL
            );
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Created 1,000 task history entries';
END $$;

COMMIT;

-- ============================================
-- PERFORMANCE TESTS
-- ============================================

\echo ''
\echo '============================================'
\echo 'PERFORMANCE TEST RESULTS'
\echo '============================================'
\echo ''

-- Test 1: List active projects (with archived filter)
\echo '--- Test 1: List Active Projects (Indexed Query) ---'
\timing on
EXPLAIN ANALYZE
SELECT *
FROM archon_projects
WHERE archived = FALSE
ORDER BY created_at DESC;
\timing off
\echo ''

-- Test 2: List all projects (no filter)
\echo '--- Test 2: List All Projects (Full Scan) ---'
\timing on
EXPLAIN ANALYZE
SELECT *
FROM archon_projects
ORDER BY created_at DESC;
\timing off
\echo ''

-- Test 3: Archive project and tasks (cascade update)
\echo '--- Test 3: Archive Project with 100 Tasks ---'
\timing on
SELECT archive_project_and_tasks(
    (SELECT id FROM archon_projects WHERE title LIKE 'Performance Test Project 1' LIMIT 1),
    'PerfTestUser'
);
\timing off
\echo ''

-- Test 4: Get task history for task with 100 changes
\echo '--- Test 4: Get Task History (100 changes) ---'
\timing on
EXPLAIN ANALYZE
SELECT *
FROM get_task_history(
    (SELECT id FROM archon_tasks WHERE status = 'done' LIMIT 1),
    NULL,
    100
);
\timing off
\echo ''

-- Test 5: Get task history filtered by field
\echo '--- Test 5: Get Filtered Task History (status only) ---'
\timing on
EXPLAIN ANALYZE
SELECT *
FROM get_task_history(
    (SELECT id FROM archon_tasks WHERE status = 'done' LIMIT 1),
    'status',
    50
);
\timing off
\echo ''

-- Test 6: Get completion stats for project
\echo '--- Test 6: Get Project Completion Stats ---'
\timing on
EXPLAIN ANALYZE
SELECT *
FROM get_project_completion_stats(
    (SELECT id FROM archon_projects LIMIT 1)
);
\timing off
\echo ''

-- Test 7: Get recently completed tasks
\echo '--- Test 7: Get Recently Completed Tasks (30 days) ---'
\timing on
EXPLAIN ANALYZE
SELECT *
FROM get_recently_completed_tasks(
    30,
    NULL,
    50
);
\timing off
\echo ''

-- Test 8: Count archived vs active projects
\echo '--- Test 8: Aggregate Query (Archived vs Active) ---'
\timing on
EXPLAIN ANALYZE
SELECT
    COUNT(*) FILTER (WHERE archived = TRUE) AS archived_count,
    COUNT(*) FILTER (WHERE archived = FALSE) AS active_count,
    COUNT(*) AS total_count
FROM archon_projects;
\timing off
\echo ''

-- Test 9: Find tasks completed in last 7 days (index usage)
\echo '--- Test 9: Date Range Query (Completed Tasks) ---'
\timing on
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM archon_tasks
WHERE completed_at >= NOW() - INTERVAL '7 days'
  AND completed_at IS NOT NULL;
\timing off
\echo ''

-- Test 10: Get task history count by field (aggregation)
\echo '--- Test 10: History Aggregation by Field ---'
\timing on
EXPLAIN ANALYZE
SELECT
    field_name,
    COUNT(*) as change_count
FROM archon_task_history
WHERE task_id = (SELECT id FROM archon_tasks WHERE status = 'done' LIMIT 1)
GROUP BY field_name
ORDER BY change_count DESC;
\timing off
\echo ''

-- ============================================
-- INDEX USAGE VERIFICATION
-- ============================================

\echo ''
\echo '============================================'
\echo 'INDEX USAGE VERIFICATION'
\echo '============================================'
\echo ''

-- Verify indexes exist
\echo '--- Existing Indexes ---'
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('archon_projects', 'archon_tasks', 'archon_task_history')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

\echo ''

-- ============================================
-- STATISTICS
-- ============================================

\echo ''
\echo '============================================'
\echo 'DATABASE STATISTICS'
\echo '============================================'
\echo ''

-- Table sizes
\echo '--- Table Sizes ---'
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE tablename IN ('archon_projects', 'archon_tasks', 'archon_task_history')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

\echo ''

-- Row counts
\echo '--- Row Counts ---'
SELECT 'archon_projects' AS table_name, COUNT(*) AS row_count FROM archon_projects
UNION ALL
SELECT 'archon_tasks', COUNT(*) FROM archon_tasks
UNION ALL
SELECT 'archon_task_history', COUNT(*) FROM archon_task_history;

\echo ''

-- Archived vs active counts
\echo '--- Archived vs Active ---'
SELECT
    'Projects' AS entity,
    COUNT(*) FILTER (WHERE archived = TRUE) AS archived,
    COUNT(*) FILTER (WHERE archived = FALSE) AS active,
    COUNT(*) AS total
FROM archon_projects
UNION ALL
SELECT
    'Tasks',
    COUNT(*) FILTER (WHERE archived = TRUE),
    COUNT(*) FILTER (WHERE archived = FALSE),
    COUNT(*)
FROM archon_tasks;

\echo ''

-- Completion stats
\echo '--- Completion Stats ---'
SELECT
    COUNT(*) FILTER (WHERE status = 'done') AS completed_tasks,
    COUNT(*) FILTER (WHERE status = 'doing' OR status = 'review') AS in_progress_tasks,
    COUNT(*) FILTER (WHERE status = 'todo') AS todo_tasks,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'done') / COUNT(*), 2) AS completion_rate_pct
FROM archon_tasks
WHERE archived = FALSE;

\echo ''

-- ============================================
-- CLEANUP
-- ============================================

\echo ''
\echo '============================================'
\echo 'CLEANUP'
\echo '============================================'
\echo ''

-- Delete test data
BEGIN;

DELETE FROM archon_task_history
WHERE task_id IN (
    SELECT t.id FROM archon_tasks t
    JOIN archon_projects p ON t.project_id = p.id
    WHERE p.title LIKE 'Performance Test Project%'
);

DELETE FROM archon_tasks
WHERE project_id IN (
    SELECT id FROM archon_projects
    WHERE title LIKE 'Performance Test Project%'
);

DELETE FROM archon_projects
WHERE title LIKE 'Performance Test Project%';

COMMIT;

\echo 'Test data cleaned up successfully'
\echo ''
\echo '============================================'
\echo 'PERFORMANCE TESTING COMPLETE'
\echo '============================================'
