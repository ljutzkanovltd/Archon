-- Migration: 035_fix_archive_functions_schema_qualified.sql
-- Description: Fix archive_project_and_tasks and unarchive_project_and_tasks functions
--              to use fully-qualified table names (public.archon_projects, public.archon_tasks)
--              while maintaining security fix from migration 031 (search_path = '')
-- Issue: Migration 031 set search_path = '' for security, but functions used unqualified
--        table names, causing "relation does not exist" errors
-- Date: 2026-01-14

-- ============================================================================
-- Function: archive_project_and_tasks
-- Description: Archives a project and all associated tasks (including nested children)
-- Returns: JSON with success status and metadata
-- ============================================================================

CREATE OR REPLACE FUNCTION public.archive_project_and_tasks(
    project_id_param UUID,
    archived_by_param TEXT DEFAULT 'system'::text
)
RETURNS JSON
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
    project_exists BOOLEAN;
    already_archived BOOLEAN;
    tasks_archived_count INTEGER := 0;
    result JSON;
BEGIN
    -- Check if project exists (FULLY QUALIFIED)
    SELECT EXISTS(
        SELECT 1 FROM public.archon_projects WHERE id = project_id_param
    ) INTO project_exists;

    IF NOT project_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Project not found',
            'project_id', project_id_param
        );
    END IF;

    -- Check if already archived (FULLY QUALIFIED)
    SELECT archived INTO already_archived
    FROM public.archon_projects
    WHERE id = project_id_param;

    IF already_archived THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Project is already archived',
            'project_id', project_id_param
        );
    END IF;

    -- Archive the project (FULLY QUALIFIED)
    UPDATE public.archon_projects
    SET
        archived = TRUE,
        archived_at = NOW(),
        archived_by = archived_by_param,
        updated_at = NOW()
    WHERE id = project_id_param;

    -- Archive all tasks in the project (including children via existing function) (FULLY QUALIFIED)
    WITH project_tasks AS (
        SELECT id FROM public.archon_tasks
        WHERE project_id = project_id_param
        AND archived = FALSE
        AND parent_task_id IS NULL  -- Only root tasks, children will be handled by cascade
    )
    UPDATE public.archon_tasks
    SET
        archived = TRUE,
        archived_at = NOW(),
        archived_by = archived_by_param,
        updated_at = NOW()
    WHERE id IN (SELECT id FROM project_tasks);

    -- Also archive child tasks (FULLY QUALIFIED)
    UPDATE public.archon_tasks
    SET
        archived = TRUE,
        archived_at = NOW(),
        archived_by = archived_by_param,
        updated_at = NOW()
    WHERE parent_task_id IN (
        SELECT id FROM public.archon_tasks
        WHERE project_id = project_id_param
    ) AND archived = FALSE;

    -- Get count of archived tasks (FULLY QUALIFIED)
    SELECT COUNT(*) INTO tasks_archived_count
    FROM public.archon_tasks
    WHERE project_id = project_id_param AND archived = TRUE;

    -- Return success result
    RETURN json_build_object(
        'success', true,
        'project_id', project_id_param,
        'archived_at', NOW(),
        'archived_by', archived_by_param,
        'tasks_archived', tasks_archived_count
    );
END;
$function$;

COMMENT ON FUNCTION public.archive_project_and_tasks(UUID, TEXT) IS 'Archives a project and all associated tasks (including nested children). Returns JSON with success status and metadata.';

-- ============================================================================
-- Function: unarchive_project_and_tasks
-- Description: Unarchives a project and all associated tasks
-- Returns: JSON with success status and metadata
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unarchive_project_and_tasks(
    project_id_param UUID
)
RETURNS JSON
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
    project_exists BOOLEAN;
    is_archived BOOLEAN;
    tasks_restored_count INTEGER := 0;
BEGIN
    -- Check if project exists (FULLY QUALIFIED)
    SELECT EXISTS(
        SELECT 1 FROM public.archon_projects WHERE id = project_id_param
    ) INTO project_exists;

    IF NOT project_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Project not found',
            'project_id', project_id_param
        );
    END IF;

    -- Check if archived (FULLY QUALIFIED)
    SELECT archived INTO is_archived
    FROM public.archon_projects
    WHERE id = project_id_param;

    IF NOT is_archived THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Project is not archived',
            'project_id', project_id_param
        );
    END IF;

    -- Unarchive the project (FULLY QUALIFIED)
    UPDATE public.archon_projects
    SET
        archived = FALSE,
        archived_at = NULL,
        archived_by = NULL,
        updated_at = NOW()
    WHERE id = project_id_param;

    -- Unarchive all tasks in the project (FULLY QUALIFIED)
    UPDATE public.archon_tasks
    SET
        archived = FALSE,
        archived_at = NULL,
        archived_by = NULL,
        updated_at = NOW()
    WHERE project_id = project_id_param AND archived = TRUE;

    -- Get count of restored tasks
    GET DIAGNOSTICS tasks_restored_count = ROW_COUNT;

    -- Return success result
    RETURN json_build_object(
        'success', true,
        'project_id', project_id_param,
        'tasks_unarchived', tasks_restored_count
    );
END;
$function$;

COMMENT ON FUNCTION public.unarchive_project_and_tasks(UUID) IS 'Unarchives a project and all associated tasks. Returns JSON with success status and metadata.';

-- ============================================================================
-- Migration Complete
-- ============================================================================
