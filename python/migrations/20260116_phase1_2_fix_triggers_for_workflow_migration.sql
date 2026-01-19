-- Phase 1.2: Fix Triggers After status → workflow_stage_id Migration
-- Created: 2026-01-16
-- Purpose: Update trigger functions to use workflow_stage_id instead of status
-- Issue: Triggers still reference OLD.status / NEW.status which no longer exists

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Phase 1.2: Fix Triggers for Workflow Migration';
    RAISE NOTICE '========================================';

    -- =========================================================================
    -- 1. UPDATE log_task_changes() to track workflow_stage_id changes
    -- =========================================================================

    RAISE NOTICE '1. Updating log_task_changes() function...';

    CREATE OR REPLACE FUNCTION public.log_task_changes()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $function$
    DECLARE
        change_detected BOOLEAN := false;
        old_stage_name TEXT;
        new_stage_name TEXT;
    BEGIN
        -- Only log on UPDATE, not INSERT or DELETE
        IF TG_OP <> 'UPDATE' THEN
            RETURN NEW;
        END IF;

        -- Check workflow_stage_id change (replaces old status check)
        IF OLD.workflow_stage_id IS DISTINCT FROM NEW.workflow_stage_id THEN
            -- Get stage names for readable history
            SELECT name INTO old_stage_name
            FROM public.archon_workflow_stages
            WHERE id = OLD.workflow_stage_id;

            SELECT name INTO new_stage_name
            FROM public.archon_workflow_stages
            WHERE id = NEW.workflow_stage_id;

            INSERT INTO public.archon_task_history (task_id, field_name, old_value, new_value, changed_by)
            VALUES (NEW.id, 'workflow_stage', old_stage_name, new_stage_name, NEW.assignee);
            change_detected := true;
        END IF;

        -- Check assignee change
        IF OLD.assignee IS DISTINCT FROM NEW.assignee THEN
            INSERT INTO public.archon_task_history (task_id, field_name, old_value, new_value, changed_by)
            VALUES (NEW.id, 'assignee', OLD.assignee, NEW.assignee, NEW.assignee);
            change_detected := true;
        END IF;

        -- Check priority change
        IF OLD.priority IS DISTINCT FROM NEW.priority THEN
            INSERT INTO public.archon_task_history (task_id, field_name, old_value, new_value, changed_by)
            VALUES (NEW.id, 'priority', OLD.priority::text, NEW.priority::text, NEW.assignee);
            change_detected := true;
        END IF;

        -- Check title change
        IF OLD.title IS DISTINCT FROM NEW.title THEN
            INSERT INTO public.archon_task_history (task_id, field_name, old_value, new_value, changed_by)
            VALUES (NEW.id, 'title', OLD.title, NEW.title, NEW.assignee);
            change_detected := true;
        END IF;

        -- Check description change (only if significant - more than 10 chars difference)
        IF OLD.description IS DISTINCT FROM NEW.description AND
           ABS(LENGTH(OLD.description) - LENGTH(NEW.description)) > 10 THEN
            INSERT INTO public.archon_task_history (task_id, field_name, old_value, new_value, changed_by)
            VALUES (
                NEW.id,
                'description',
                LEFT(OLD.description, 500),
                LEFT(NEW.description, 500),
                NEW.assignee
            );
            change_detected := true;
        END IF;

        -- Check task_order change
        IF OLD.task_order IS DISTINCT FROM NEW.task_order THEN
            INSERT INTO public.archon_task_history (task_id, field_name, old_value, new_value, changed_by)
            VALUES (NEW.id, 'task_order', OLD.task_order::text, NEW.task_order::text, 'system');
            change_detected := true;
        END IF;

        -- Check feature change
        IF OLD.feature IS DISTINCT FROM NEW.feature THEN
            INSERT INTO public.archon_task_history (task_id, field_name, old_value, new_value, changed_by)
            VALUES (NEW.id, 'feature', OLD.feature, NEW.feature, NEW.assignee);
            change_detected := true;
        END IF;

        RETURN NEW;
    END;
    $function$;

    RAISE NOTICE '✅ Updated log_task_changes() to use workflow_stage_id';

    -- =========================================================================
    -- 2. UPDATE set_task_completed() to check workflow stage name
    -- =========================================================================

    RAISE NOTICE '2. Updating set_task_completed() function...';

    CREATE OR REPLACE FUNCTION public.set_task_completed()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $function$
    DECLARE
        old_stage_name TEXT;
        new_stage_name TEXT;
    BEGIN
        -- Only process on UPDATE
        IF TG_OP <> 'UPDATE' THEN
            RETURN NEW;
        END IF;

        -- Skip if workflow_stage_id didn't change
        IF OLD.workflow_stage_id = NEW.workflow_stage_id THEN
            RETURN NEW;
        END IF;

        -- Get stage names
        SELECT name INTO old_stage_name
        FROM public.archon_workflow_stages
        WHERE id = OLD.workflow_stage_id;

        SELECT name INTO new_stage_name
        FROM public.archon_workflow_stages
        WHERE id = NEW.workflow_stage_id;

        -- Task just completed: workflow stage changed TO 'Done'
        IF old_stage_name <> 'Done' AND new_stage_name = 'Done' THEN
            NEW.completed_at := NOW();
            NEW.completed_by := NEW.assignee;
            RETURN NEW;
        END IF;

        -- Task reopened: workflow stage changed FROM 'Done' to something else
        IF old_stage_name = 'Done' AND new_stage_name <> 'Done' THEN
            NEW.completed_at := NULL;
            NEW.completed_by := NULL;
            RETURN NEW;
        END IF;

        -- No status change affecting completion
        RETURN NEW;
    END;
    $function$;

    RAISE NOTICE '✅ Updated set_task_completed() to use workflow_stage_id';

    -- =========================================================================
    -- 3. VERIFY TRIGGERS ARE PROPERLY ATTACHED
    -- =========================================================================

    RAISE NOTICE '3. Verifying trigger attachments...';

    -- Triggers should already exist, but verify they're using updated functions
    DECLARE
        trigger_count INT;
    BEGIN
        SELECT COUNT(*) INTO trigger_count
        FROM information_schema.triggers
        WHERE event_object_table = 'archon_tasks'
          AND action_statement LIKE '%log_task_changes%';

        IF trigger_count > 0 THEN
            RAISE NOTICE '✅ log_task_changes triggers found: % triggers', trigger_count;
        ELSE
            RAISE WARNING '⚠️  No log_task_changes triggers found - may need to recreate';
        END IF;

        SELECT COUNT(*) INTO trigger_count
        FROM information_schema.triggers
        WHERE event_object_table = 'archon_tasks'
          AND action_statement LIKE '%set_task_completed%';

        IF trigger_count > 0 THEN
            RAISE NOTICE '✅ set_task_completed trigger found';
        ELSE
            RAISE WARNING '⚠️  No set_task_completed trigger found - may need to recreate';
        END IF;
    END;

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TRIGGER FIXES COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary of changes:';
    RAISE NOTICE '  - log_task_changes(): OLD.status → OLD.workflow_stage_id';
    RAISE NOTICE '  - set_task_completed(): status checks → workflow stage name checks';
    RAISE NOTICE '  - Task history now logs "workflow_stage" field instead of "status"';
    RAISE NOTICE '  - Completion tracking now uses workflow stage names';
    RAISE NOTICE '';

END $$;
