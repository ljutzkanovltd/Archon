-- =====================================================
-- Migration 0.2.0/003: Add Task Completion Tracking
-- =====================================================
-- Description: Adds completed_at and completed_by fields
--              with automatic triggers when status changes to 'done'
-- Author: Archon Enhancement Team
-- Date: 2025-12-21
-- Dependencies: Requires archon_tasks table
-- =====================================================

-- Add completion tracking fields
ALTER TABLE archon_tasks
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS completed_by TEXT NULL;

-- Add index for querying recently completed tasks
CREATE INDEX IF NOT EXISTS idx_archon_tasks_completed_at
    ON archon_tasks(completed_at DESC)
    WHERE completed_at IS NOT NULL;

-- Composite index for completed tasks by project
CREATE INDEX IF NOT EXISTS idx_archon_tasks_project_completed
    ON archon_tasks(project_id, completed_at DESC)
    WHERE status = 'done';

-- Add comments
COMMENT ON COLUMN archon_tasks.completed_at IS 'Timestamp when task status changed to "done" - auto-populated by trigger';
COMMENT ON COLUMN archon_tasks.completed_by IS 'User who completed the task - auto-populated from assignee';

-- =====================================================
-- Create trigger function to auto-set completion fields
-- =====================================================

CREATE OR REPLACE FUNCTION set_task_completed()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process on UPDATE
    IF TG_OP <> 'UPDATE' THEN
        RETURN NEW;
    END IF;

    -- Task just completed: status changed TO 'done'
    IF OLD.status <> 'done' AND NEW.status = 'done' THEN
        NEW.completed_at := NOW();
        NEW.completed_by := NEW.assignee;
        RETURN NEW;
    END IF;

    -- Task reopened: status changed FROM 'done' to something else
    IF OLD.status = 'done' AND NEW.status <> 'done' THEN
        NEW.completed_at := NULL;
        NEW.completed_by := NULL;
        RETURN NEW;
    END IF;

    -- No status change affecting completion
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_task_completed IS
'Trigger function that automatically sets/clears completed_at and completed_by based on status changes';

-- =====================================================
-- Create trigger on archon_tasks
-- =====================================================

DROP TRIGGER IF EXISTS trigger_set_task_completed ON archon_tasks;

CREATE TRIGGER trigger_set_task_completed
    BEFORE UPDATE ON archon_tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_task_completed();

COMMENT ON TRIGGER trigger_set_task_completed ON archon_tasks IS
'Automatically sets completion timestamp and user when task status changes to "done"';

-- =====================================================
-- Backfill completed_at for existing done tasks
-- =====================================================
-- This estimates completion time as updated_at for tasks already marked done

UPDATE archon_tasks
SET
    completed_at = updated_at,
    completed_by = assignee
WHERE status = 'done'
  AND completed_at IS NULL;

-- =====================================================
-- Helper functions for completion analytics
-- =====================================================

-- Get recently completed tasks
CREATE OR REPLACE FUNCTION get_recently_completed_tasks(
    days_param INTEGER DEFAULT 7,
    project_id_param UUID DEFAULT NULL,
    limit_param INTEGER DEFAULT 50
)
RETURNS TABLE (
    task_id UUID,
    title TEXT,
    project_id UUID,
    completed_at TIMESTAMPTZ,
    completed_by TEXT,
    time_to_complete INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.title,
        t.project_id,
        t.completed_at,
        t.completed_by,
        t.completed_at - t.created_at AS time_to_complete
    FROM archon_tasks t
    WHERE t.completed_at IS NOT NULL
      AND t.completed_at >= NOW() - (days_param || ' days')::INTERVAL
      AND (project_id_param IS NULL OR t.project_id = project_id_param)
    ORDER BY t.completed_at DESC
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_recently_completed_tasks IS
'Retrieves tasks completed in the last N days with completion time metrics';

-- Get completion stats for a project
CREATE OR REPLACE FUNCTION get_project_completion_stats(
    project_id_param UUID
)
RETURNS JSON AS $$
DECLARE
    total_tasks INTEGER;
    completed_tasks INTEGER;
    in_progress_tasks INTEGER;
    avg_completion_time INTERVAL;
    result JSON;
BEGIN
    -- Get task counts
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'done'),
        COUNT(*) FILTER (WHERE status = 'doing')
    INTO total_tasks, completed_tasks, in_progress_tasks
    FROM archon_tasks
    WHERE project_id = project_id_param
      AND archived = false;

    -- Get average completion time
    SELECT AVG(completed_at - created_at)
    INTO avg_completion_time
    FROM archon_tasks
    WHERE project_id = project_id_param
      AND completed_at IS NOT NULL;

    -- Build result JSON
    result := json_build_object(
        'project_id', project_id_param,
        'total_tasks', total_tasks,
        'completed_tasks', completed_tasks,
        'in_progress_tasks', in_progress_tasks,
        'completion_rate', CASE
            WHEN total_tasks > 0 THEN ROUND((completed_tasks::NUMERIC / total_tasks::NUMERIC) * 100, 2)
            ELSE 0
        END,
        'avg_completion_time_hours', CASE
            WHEN avg_completion_time IS NOT NULL THEN
                ROUND(EXTRACT(EPOCH FROM avg_completion_time) / 3600, 2)
            ELSE NULL
        END
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_project_completion_stats IS
'Returns completion statistics for a project including rates and average time';

-- =====================================================
-- Verification queries (for testing)
-- =====================================================
-- Test completion tracking:
-- UPDATE archon_tasks SET status = 'done' WHERE id = '<task-uuid>';
-- SELECT id, title, status, completed_at, completed_by
-- FROM archon_tasks WHERE id = '<task-uuid>';
--
-- Test reopening:
-- UPDATE archon_tasks SET status = 'doing' WHERE id = '<task-uuid>';
-- SELECT id, title, status, completed_at, completed_by
-- FROM archon_tasks WHERE id = '<task-uuid>';
--
-- Get recently completed tasks:
-- SELECT * FROM get_recently_completed_tasks(7);
--
-- Get project stats:
-- SELECT get_project_completion_stats('<project-uuid>');
--
-- Query tasks completed today:
-- SELECT id, title, completed_at, completed_by
-- FROM archon_tasks
-- WHERE completed_at >= CURRENT_DATE
-- ORDER BY completed_at DESC;

-- =====================================================
-- Migration complete
-- =====================================================
