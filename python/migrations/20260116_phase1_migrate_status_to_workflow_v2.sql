-- Phase 1.1-1.3: Migrate status to workflow_stage_id and remove status field (CORRECTED)
-- Created: 2026-01-16
-- Purpose: Replace hardcoded status field with dynamic workflow_stage_id

DO $$
DECLARE
    v_workflow_id UUID := '29d6341c-0352-46e7-95d3-c26ae27a1aff'; -- Standard Agile workflow
    v_stage_backlog_id UUID;
    v_stage_in_progress_id UUID;
    v_stage_review_id UUID;
    v_stage_done_id UUID;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Phase 1 Migration: status → workflow_stage_id';
    RAISE NOTICE '========================================';

    -- Get stage IDs by order
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
        RAISE EXCEPTION 'Not all workflow stages found for Standard Agile workflow';
    END IF;

    RAISE NOTICE 'Using Standard Agile workflow stages:';
    RAISE NOTICE '  Stage 1 (Backlog): %', v_stage_backlog_id;
    RAISE NOTICE '  Stage 2 (In Progress): %', v_stage_in_progress_id;
    RAISE NOTICE '  Stage 3 (Review): %', v_stage_review_id;
    RAISE NOTICE '  Stage 4 (Done): %', v_stage_done_id;

    -- Count tasks before migration
    DECLARE
        v_todo_count INT;
        v_doing_count INT;
        v_review_count INT;
        v_done_count INT;
        v_null_count INT;
    BEGIN
        SELECT COUNT(*) INTO v_todo_count FROM archon_tasks WHERE status = 'todo' AND workflow_stage_id IS NULL;
        SELECT COUNT(*) INTO v_doing_count FROM archon_tasks WHERE status = 'doing' AND workflow_stage_id IS NULL;
        SELECT COUNT(*) INTO v_review_count FROM archon_tasks WHERE status = 'review' AND workflow_stage_id IS NULL;
        SELECT COUNT(*) INTO v_done_count FROM archon_tasks WHERE status = 'done' AND workflow_stage_id IS NULL;
        SELECT COUNT(*) INTO v_null_count FROM archon_tasks WHERE status IS NULL AND workflow_stage_id IS NULL;

        RAISE NOTICE '--------------------------------------';
        RAISE NOTICE 'Tasks to migrate:';
        RAISE NOTICE '  todo: % tasks', v_todo_count;
        RAISE NOTICE '  doing: % tasks', v_doing_count;
        RAISE NOTICE '  review: % tasks', v_review_count;
        RAISE NOTICE '  done: % tasks', v_done_count;
        RAISE NOTICE '  NULL status: % tasks', v_null_count;
        RAISE NOTICE '--------------------------------------';
    END;

    -- STEP 2: Migrate tasks from status to workflow_stage_id
    -- Migrate todo tasks
    UPDATE archon_tasks
    SET workflow_stage_id = v_stage_backlog_id
    WHERE status = 'todo' AND workflow_stage_id IS NULL;

    RAISE NOTICE '✅ Migrated todo → Backlog';

    -- Migrate doing tasks
    UPDATE archon_tasks
    SET workflow_stage_id = v_stage_in_progress_id
    WHERE status = 'doing' AND workflow_stage_id IS NULL;

    RAISE NOTICE '✅ Migrated doing → In Progress';

    -- Migrate review tasks
    UPDATE archon_tasks
    SET workflow_stage_id = v_stage_review_id
    WHERE status = 'review' AND workflow_stage_id IS NULL;

    RAISE NOTICE '✅ Migrated review → Review';

    -- Migrate done tasks
    UPDATE archon_tasks
    SET workflow_stage_id = v_stage_done_id
    WHERE status = 'done' AND workflow_stage_id IS NULL;

    RAISE NOTICE '✅ Migrated done → Done';

    -- Handle NULL status (assign to Backlog)
    UPDATE archon_tasks
    SET workflow_stage_id = v_stage_backlog_id
    WHERE status IS NULL AND workflow_stage_id IS NULL;

    RAISE NOTICE '✅ Migrated NULL status → Backlog';

    -- Verify migration
    DECLARE
        v_remaining_null INT;
    BEGIN
        SELECT COUNT(*) INTO v_remaining_null
        FROM archon_tasks
        WHERE workflow_stage_id IS NULL;

        IF v_remaining_null > 0 THEN
            RAISE WARNING '⚠️  % tasks still have NULL workflow_stage_id', v_remaining_null;
        ELSE
            RAISE NOTICE '✅ All tasks successfully migrated!';
        END IF;
    END;

    -- STEP 3: Add NOT NULL constraint to workflow_stage_id
    ALTER TABLE archon_tasks
        ALTER COLUMN workflow_stage_id SET NOT NULL;

    RAISE NOTICE '✅ Added NOT NULL constraint to workflow_stage_id';

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

        RAISE NOTICE '✅ Added foreign key constraint';
    ELSE
        RAISE NOTICE '✅ Foreign key constraint already exists';
    END IF;

    -- STEP 5: Drop the status column
    ALTER TABLE archon_tasks DROP COLUMN IF EXISTS status;

    RAISE NOTICE '✅ Dropped status column';

    -- STEP 6: Drop the task_status enum type
    DROP TYPE IF EXISTS task_status CASCADE;

    RAISE NOTICE '✅ Dropped task_status enum type';

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '========================================';

END $$;

-- Final verification
SELECT
    COUNT(*) as total_tasks,
    COUNT(workflow_stage_id) as tasks_with_stage
FROM archon_tasks;
