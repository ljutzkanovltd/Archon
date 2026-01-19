-- Phase 1.1-1.3: Migrate status to workflow_stage_id and remove status field
-- Created: 2026-01-16
-- Purpose: Replace hardcoded status field with dynamic workflow_stage_id

-- STEP 1: Get default workflow stages for Software Development (most common type)
-- We'll use this to map status values to workflow stages

DO $$
DECLARE
    v_workflow_id UUID;
    v_stage_backlog_id UUID;
    v_stage_in_progress_id UUID;
    v_stage_review_id UUID;
    v_stage_done_id UUID;
BEGIN
    -- Get the Software Development workflow ID
    SELECT id INTO v_workflow_id
    FROM archon_workflows
    WHERE name = 'Software Development'
    LIMIT 1;

    IF v_workflow_id IS NULL THEN
        RAISE EXCEPTION 'Software Development workflow not found';
    END IF;

    -- Get stage IDs by order (assuming stage_order: 1=Backlog, 2=In Progress, 3=Review, 4=Done)
    SELECT id INTO v_stage_backlog_id
    FROM archon_workflow_stages
    WHERE workflow_id = v_workflow_id AND stage_order = 1
    LIMIT 1;

    SELECT id INTO v_stage_in_progress_id
    FROM archon_workflow_stages
    WHERE workflow_id = v_workflow_id AND stage_order = 2
    LIMIT 1;

    SELECT id INTO v_stage_review_id
    FROM archon_workflow_stages
    WHERE workflow_id = v_workflow_id AND stage_order = 3
    LIMIT 1;

    SELECT id INTO v_stage_done_id
    FROM archon_workflow_stages
    WHERE workflow_id = v_workflow_id AND stage_order = 4
    LIMIT 1;

    -- Verify all stages found
    IF v_stage_backlog_id IS NULL OR v_stage_in_progress_id IS NULL OR
       v_stage_review_id IS NULL OR v_stage_done_id IS NULL THEN
        RAISE EXCEPTION 'Not all workflow stages found';
    END IF;

    RAISE NOTICE 'Workflow stages found:';
    RAISE NOTICE '  Backlog: %', v_stage_backlog_id;
    RAISE NOTICE '  In Progress: %', v_stage_in_progress_id;
    RAISE NOTICE '  Review: %', v_stage_review_id;
    RAISE NOTICE '  Done: %', v_stage_done_id;

    -- STEP 2: Migrate tasks from status to workflow_stage_id
    -- Map: todo -> Backlog, doing -> In Progress, review -> Review, done -> Done

    RAISE NOTICE 'Starting migration...';

    -- Migrate todo tasks
    UPDATE archon_tasks
    SET workflow_stage_id = v_stage_backlog_id
    WHERE status = 'todo' AND workflow_stage_id IS NULL;

    RAISE NOTICE 'Migrated todo tasks to Backlog stage';

    -- Migrate doing tasks
    UPDATE archon_tasks
    SET workflow_stage_id = v_stage_in_progress_id
    WHERE status = 'doing' AND workflow_stage_id IS NULL;

    RAISE NOTICE 'Migrated doing tasks to In Progress stage';

    -- Migrate review tasks
    UPDATE archon_tasks
    SET workflow_stage_id = v_stage_review_id
    WHERE status = 'review' AND workflow_stage_id IS NULL;

    RAISE NOTICE 'Migrated review tasks to Review stage';

    -- Migrate done tasks
    UPDATE archon_tasks
    SET workflow_stage_id = v_stage_done_id
    WHERE status = 'done' AND workflow_stage_id IS NULL;

    RAISE NOTICE 'Migrated done tasks to Done stage';

    -- Handle NULL status (assign to Backlog)
    UPDATE archon_tasks
    SET workflow_stage_id = v_stage_backlog_id
    WHERE status IS NULL AND workflow_stage_id IS NULL;

    RAISE NOTICE 'Migrated NULL status tasks to Backlog stage';

    -- Verify migration
    DECLARE
        v_null_count INT;
    BEGIN
        SELECT COUNT(*) INTO v_null_count
        FROM archon_tasks
        WHERE workflow_stage_id IS NULL;

        IF v_null_count > 0 THEN
            RAISE WARNING '% tasks still have NULL workflow_stage_id', v_null_count;
        ELSE
            RAISE NOTICE 'All tasks successfully migrated to workflow stages';
        END IF;
    END;

    -- STEP 3: Add NOT NULL constraint to workflow_stage_id
    ALTER TABLE archon_tasks
        ALTER COLUMN workflow_stage_id SET NOT NULL;

    RAISE NOTICE 'Added NOT NULL constraint to workflow_stage_id';

    -- STEP 4: Add foreign key constraint if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_archon_tasks_workflow_stage'
    ) THEN
        ALTER TABLE archon_tasks
            ADD CONSTRAINT fk_archon_tasks_workflow_stage
            FOREIGN KEY (workflow_stage_id)
            REFERENCES archon_workflow_stages(id)
            ON DELETE RESTRICT;

        RAISE NOTICE 'Added foreign key constraint for workflow_stage_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists';
    END IF;

    -- STEP 5: Drop the status column
    ALTER TABLE archon_tasks DROP COLUMN IF EXISTS status;

    RAISE NOTICE 'Dropped status column';

    -- STEP 6: Drop the task_status enum type
    DROP TYPE IF EXISTS task_status CASCADE;

    RAISE NOTICE 'Dropped task_status enum type';

    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '========================================';

END $$;

-- Verify final state
SELECT
    COUNT(*) as total_tasks,
    COUNT(workflow_stage_id) as tasks_with_stage,
    COUNT(*) - COUNT(workflow_stage_id) as tasks_without_stage
FROM archon_tasks;
