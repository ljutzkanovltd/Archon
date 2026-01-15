-- =====================================================
-- Migration: Enhance archon_tasks with Sprint and Workflow Fields
-- Version: 0.5.0
-- Date: 2026-01-15
-- Description: Add sprint assignment, workflow stages, story points,
--              time tracking, and task hierarchy fields to archon_tasks
-- =====================================================

-- Add new columns to archon_tasks
ALTER TABLE archon_tasks
    ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES archon_sprints(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS workflow_stage_id UUID REFERENCES archon_workflow_stages(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS story_points INTEGER CHECK (story_points IS NULL OR story_points >= 0),
    ADD COLUMN IF NOT EXISTS time_estimate_hours DECIMAL(10,2) CHECK (time_estimate_hours IS NULL OR time_estimate_hours > 0),
    ADD COLUMN IF NOT EXISTS time_spent_hours DECIMAL(10,2) DEFAULT 0 CHECK (time_spent_hours >= 0),
    ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES archon_tasks(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS due_date DATE;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_archon_tasks_sprint
    ON archon_tasks(sprint_id) WHERE sprint_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_archon_tasks_workflow_stage
    ON archon_tasks(workflow_stage_id);

CREATE INDEX IF NOT EXISTS idx_archon_tasks_parent
    ON archon_tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_archon_tasks_due_date
    ON archon_tasks(due_date) WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_archon_tasks_story_points
    ON archon_tasks(story_points) WHERE story_points IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_archon_tasks_sprint_stage
    ON archon_tasks(sprint_id, workflow_stage_id);

CREATE INDEX IF NOT EXISTS idx_archon_tasks_project_sprint
    ON archon_tasks(project_id, sprint_id);

-- Add comments
COMMENT ON COLUMN archon_tasks.sprint_id IS 'Sprint assignment (NULL if in backlog)';
COMMENT ON COLUMN archon_tasks.workflow_stage_id IS 'Current workflow stage (replaces hardcoded status enum)';
COMMENT ON COLUMN archon_tasks.story_points IS 'Agile story points estimate (0-100)';
COMMENT ON COLUMN archon_tasks.time_estimate_hours IS 'Original time estimate in hours';
COMMENT ON COLUMN archon_tasks.time_spent_hours IS 'Total time spent (auto-calculated from time_logs)';
COMMENT ON COLUMN archon_tasks.parent_task_id IS 'Parent task for subtask hierarchy';
COMMENT ON COLUMN archon_tasks.due_date IS 'Task due date';

-- Create function to update time_spent_hours from time_logs
CREATE OR REPLACE FUNCTION update_task_time_spent()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate total time spent for the task
    UPDATE archon_tasks
    SET time_spent_hours = (
        SELECT COALESCE(SUM(hours), 0)
        FROM archon_time_logs
        WHERE task_id = NEW.task_id
    )
    WHERE id = NEW.task_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update time_spent_hours when time is logged
DROP TRIGGER IF EXISTS trigger_update_task_time_spent ON archon_time_logs;
CREATE TRIGGER trigger_update_task_time_spent
    AFTER INSERT OR UPDATE OR DELETE ON archon_time_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_task_time_spent();

-- Create function to sync workflow_stage_id with existing status field (backwards compatibility)
CREATE OR REPLACE FUNCTION sync_task_workflow_stage()
RETURNS TRIGGER AS $$
BEGIN
    -- If workflow_stage_id changed, update status field (for backwards compatibility)
    IF NEW.workflow_stage_id IS NOT NULL AND
       (OLD.workflow_stage_id IS NULL OR NEW.workflow_stage_id != OLD.workflow_stage_id) THEN

        -- Get the stage name and update status
        SELECT name INTO NEW.status
        FROM archon_workflow_stages
        WHERE id = NEW.workflow_stage_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync workflow stage changes to status
DROP TRIGGER IF EXISTS trigger_sync_task_workflow_stage ON archon_tasks;
CREATE TRIGGER trigger_sync_task_workflow_stage
    BEFORE UPDATE ON archon_tasks
    FOR EACH ROW
    WHEN (NEW.workflow_stage_id IS DISTINCT FROM OLD.workflow_stage_id)
    EXECUTE FUNCTION sync_task_workflow_stage();

-- Migrate existing tasks to use workflow stages
-- Map existing status values to default workflow stages
DO $$
DECLARE
    default_workflow_id UUID;
    backlog_stage_id UUID;
    in_progress_stage_id UUID;
    review_stage_id UUID;
    done_stage_id UUID;
BEGIN
    -- Get the default agile workflow (created in migration 002)
    SELECT w.id INTO default_workflow_id
    FROM archon_workflows w
    JOIN archon_project_types pt ON pt.id = w.project_type_id
    WHERE pt.name = 'software_development' AND w.is_default = TRUE
    LIMIT 1;

    IF default_workflow_id IS NOT NULL THEN
        -- Get stage IDs
        SELECT id INTO backlog_stage_id FROM archon_workflow_stages
        WHERE workflow_id = default_workflow_id AND stage_order = 0;

        SELECT id INTO in_progress_stage_id FROM archon_workflow_stages
        WHERE workflow_id = default_workflow_id AND stage_order = 1;

        SELECT id INTO review_stage_id FROM archon_workflow_stages
        WHERE workflow_id = default_workflow_id AND stage_order = 2;

        SELECT id INTO done_stage_id FROM archon_workflow_stages
        WHERE workflow_id = default_workflow_id AND stage_order = 3;

        -- Migrate existing tasks to workflow stages based on current status
        UPDATE archon_tasks SET workflow_stage_id = backlog_stage_id WHERE status = 'todo';
        UPDATE archon_tasks SET workflow_stage_id = in_progress_stage_id WHERE status = 'doing';
        UPDATE archon_tasks SET workflow_stage_id = review_stage_id WHERE status = 'review';
        UPDATE archon_tasks SET workflow_stage_id = done_stage_id WHERE status = 'done';
    END IF;
END $$;

-- Add migration record
INSERT INTO archon_migrations (version, migration_name)
VALUES ('0.5.0', '005_enhance_archon_tasks')
ON CONFLICT (version, migration_name) DO NOTHING;
