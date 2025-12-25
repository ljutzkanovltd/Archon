-- =====================================================
-- Migration 0.2.0/002: Add Task History Tracking
-- =====================================================
-- Description: Creates archon_task_history table and triggers
--              to automatically log all task field changes
-- Author: Archon Enhancement Team
-- Date: 2025-12-21
-- Dependencies: Requires archon_tasks table
-- =====================================================

-- Create task history table
CREATE TABLE IF NOT EXISTS archon_task_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES archon_tasks(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT DEFAULT 'system',
    changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    change_reason TEXT NULL
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_archon_task_history_task_id
    ON archon_task_history(task_id);

CREATE INDEX IF NOT EXISTS idx_archon_task_history_changed_at
    ON archon_task_history(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_archon_task_history_field_name
    ON archon_task_history(field_name);

-- Composite index for common query: get all changes for a task ordered by time
CREATE INDEX IF NOT EXISTS idx_archon_task_history_task_time
    ON archon_task_history(task_id, changed_at DESC);

-- Add comments
COMMENT ON TABLE archon_task_history IS 'Audit trail of all task field changes';
COMMENT ON COLUMN archon_task_history.task_id IS 'Reference to the task that was changed';
COMMENT ON COLUMN archon_task_history.field_name IS 'Name of the field that changed (status, assignee, priority, title, description)';
COMMENT ON COLUMN archon_task_history.old_value IS 'Previous value before the change';
COMMENT ON COLUMN archon_task_history.new_value IS 'New value after the change';
COMMENT ON COLUMN archon_task_history.changed_by IS 'User or system that made the change';
COMMENT ON COLUMN archon_task_history.changed_at IS 'Timestamp when the change occurred';
COMMENT ON COLUMN archon_task_history.change_reason IS 'Optional explanation for the change';

-- =====================================================
-- Create trigger function to log task changes
-- =====================================================

CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
DECLARE
    change_detected BOOLEAN := false;
BEGIN
    -- Only log on UPDATE, not INSERT or DELETE
    IF TG_OP <> 'UPDATE' THEN
        RETURN NEW;
    END IF;

    -- Check status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO archon_task_history (task_id, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'status', OLD.status, NEW.status, NEW.assignee);
        change_detected := true;
    END IF;

    -- Check assignee change
    IF OLD.assignee IS DISTINCT FROM NEW.assignee THEN
        INSERT INTO archon_task_history (task_id, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'assignee', OLD.assignee, NEW.assignee, NEW.assignee);
        change_detected := true;
    END IF;

    -- Check priority change
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO archon_task_history (task_id, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'priority', OLD.priority::text, NEW.priority::text, NEW.assignee);
        change_detected := true;
    END IF;

    -- Check title change
    IF OLD.title IS DISTINCT FROM NEW.title THEN
        INSERT INTO archon_task_history (task_id, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'title', OLD.title, NEW.title, NEW.assignee);
        change_detected := true;
    END IF;

    -- Check description change (only if significant - more than 10 chars difference)
    IF OLD.description IS DISTINCT FROM NEW.description AND
       ABS(LENGTH(OLD.description) - LENGTH(NEW.description)) > 10 THEN
        INSERT INTO archon_task_history (task_id, field_name, old_value, new_value, changed_by)
        VALUES (
            NEW.id,
            'description',
            LEFT(OLD.description, 500),  -- Store first 500 chars
            LEFT(NEW.description, 500),
            NEW.assignee
        );
        change_detected := true;
    END IF;

    -- Check task_order change
    IF OLD.task_order IS DISTINCT FROM NEW.task_order THEN
        INSERT INTO archon_task_history (task_id, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'task_order', OLD.task_order::text, NEW.task_order::text, 'system');
        change_detected := true;
    END IF;

    -- Check feature change
    IF OLD.feature IS DISTINCT FROM NEW.feature THEN
        INSERT INTO archon_task_history (task_id, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'feature', OLD.feature, NEW.feature, NEW.assignee);
        change_detected := true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_task_changes IS
'Trigger function that automatically logs changes to tracked task fields';

-- =====================================================
-- Create trigger on archon_tasks
-- =====================================================

DROP TRIGGER IF EXISTS trigger_log_task_changes ON archon_tasks;

CREATE TRIGGER trigger_log_task_changes
    AFTER UPDATE ON archon_tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_changes();

COMMENT ON TRIGGER trigger_log_task_changes ON archon_tasks IS
'Automatically logs all changes to task fields in archon_task_history table';

-- =====================================================
-- Helper function to get task history
-- =====================================================

CREATE OR REPLACE FUNCTION get_task_history(
    task_id_param UUID,
    field_name_param TEXT DEFAULT NULL,
    limit_param INTEGER DEFAULT 50
)
RETURNS TABLE (
    change_id UUID,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    changed_at TIMESTAMPTZ,
    change_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.id,
        h.field_name,
        h.old_value,
        h.new_value,
        h.changed_by,
        h.changed_at,
        h.change_reason
    FROM archon_task_history h
    WHERE h.task_id = task_id_param
      AND (field_name_param IS NULL OR h.field_name = field_name_param)
    ORDER BY h.changed_at DESC
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_task_history IS
'Retrieves change history for a task, optionally filtered by field name';

-- =====================================================
-- Verification queries (for testing)
-- =====================================================
-- Create a test task and update it:
-- UPDATE archon_tasks SET status = 'doing' WHERE id = '<task-uuid>';
-- UPDATE archon_tasks SET assignee = 'new-user' WHERE id = '<task-uuid>';
--
-- View history:
-- SELECT * FROM get_task_history('<task-uuid>');
--
-- View only status changes:
-- SELECT * FROM get_task_history('<task-uuid>', 'status');
--
-- Raw query:
-- SELECT * FROM archon_task_history
-- WHERE task_id = '<task-uuid>'
-- ORDER BY changed_at DESC;

-- =====================================================
-- Migration complete
-- =====================================================
