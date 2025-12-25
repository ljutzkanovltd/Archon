-- =====================================================
-- Migration 0.2.0/001: Add Project Archival System
-- =====================================================
-- Description: Adds archival capabilities to archon_projects table
--              with soft-delete pattern for historical tracking
-- Author: Archon Enhancement Team
-- Date: 2025-12-21
-- Dependencies: Requires archon_projects table from complete_setup.sql
-- =====================================================

-- Add archival fields to archon_projects table
ALTER TABLE archon_projects
  ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS archived_by TEXT NULL;

-- Add indexes for efficient querying of archived projects
CREATE INDEX IF NOT EXISTS idx_archon_projects_archived
  ON archon_projects(archived);

CREATE INDEX IF NOT EXISTS idx_archon_projects_archived_at
  ON archon_projects(archived_at);

-- Add composite index for filtering active projects (most common query)
CREATE INDEX IF NOT EXISTS idx_archon_projects_active
  ON archon_projects(archived)
  WHERE archived = false;

-- Add comments to document the new columns
COMMENT ON COLUMN archon_projects.archived IS 'Soft delete flag - TRUE if project is archived/deleted';
COMMENT ON COLUMN archon_projects.archived_at IS 'Timestamp when project was archived';
COMMENT ON COLUMN archon_projects.archived_by IS 'User/system that archived the project';

-- =====================================================
-- Create archive_project_and_tasks() function
-- =====================================================
-- This function archives a project and all its associated tasks
-- Uses existing archive_task_and_children() for task cascading

CREATE OR REPLACE FUNCTION archive_project_and_tasks(
    project_id_param UUID,
    archived_by_param TEXT DEFAULT 'system'
)
RETURNS JSON AS $$
DECLARE
    project_exists BOOLEAN;
    already_archived BOOLEAN;
    tasks_archived_count INTEGER := 0;
    result JSON;
BEGIN
    -- Check if project exists
    SELECT EXISTS(
        SELECT 1 FROM archon_projects WHERE id = project_id_param
    ) INTO project_exists;

    IF NOT project_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Project not found',
            'project_id', project_id_param
        );
    END IF;

    -- Check if already archived
    SELECT archived INTO already_archived
    FROM archon_projects
    WHERE id = project_id_param;

    IF already_archived THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Project is already archived',
            'project_id', project_id_param
        );
    END IF;

    -- Archive the project
    UPDATE archon_projects
    SET
        archived = TRUE,
        archived_at = NOW(),
        archived_by = archived_by_param,
        updated_at = NOW()
    WHERE id = project_id_param;

    -- Archive all tasks in the project (including children via existing function)
    WITH project_tasks AS (
        SELECT id FROM archon_tasks
        WHERE project_id = project_id_param
        AND archived = FALSE
        AND parent_task_id IS NULL  -- Only root tasks, children will be handled by cascade
    )
    UPDATE archon_tasks
    SET
        archived = TRUE,
        archived_at = NOW(),
        archived_by = archived_by_param,
        updated_at = NOW()
    WHERE id IN (SELECT id FROM project_tasks);

    -- Also archive child tasks
    UPDATE archon_tasks
    SET
        archived = TRUE,
        archived_at = NOW(),
        archived_by = archived_by_param,
        updated_at = NOW()
    WHERE parent_task_id IN (
        SELECT id FROM archon_tasks
        WHERE project_id = project_id_param
    ) AND archived = FALSE;

    -- Get count of archived tasks
    SELECT COUNT(*) INTO tasks_archived_count
    FROM archon_tasks
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
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION archive_project_and_tasks IS
'Archives a project and all associated tasks (including nested children). Returns JSON with success status and metadata.';

-- =====================================================
-- Create unarchive_project_and_tasks() function
-- =====================================================
-- This function restores an archived project and its tasks

CREATE OR REPLACE FUNCTION unarchive_project_and_tasks(
    project_id_param UUID
)
RETURNS JSON AS $$
DECLARE
    project_exists BOOLEAN;
    is_archived BOOLEAN;
    tasks_restored_count INTEGER := 0;
BEGIN
    -- Check if project exists
    SELECT EXISTS(
        SELECT 1 FROM archon_projects WHERE id = project_id_param
    ) INTO project_exists;

    IF NOT project_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Project not found',
            'project_id', project_id_param
        );
    END IF;

    -- Check if archived
    SELECT archived INTO is_archived
    FROM archon_projects
    WHERE id = project_id_param;

    IF NOT is_archived THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Project is not archived',
            'project_id', project_id_param
        );
    END IF;

    -- Unarchive the project
    UPDATE archon_projects
    SET
        archived = FALSE,
        archived_at = NULL,
        archived_by = NULL,
        updated_at = NOW()
    WHERE id = project_id_param;

    -- Unarchive all tasks in the project
    UPDATE archon_tasks
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
        'tasks_restored', tasks_restored_count
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION unarchive_project_and_tasks IS
'Restores an archived project and all its tasks. Returns JSON with success status and count of restored tasks.';

-- =====================================================
-- Update existing queries to filter archived by default
-- =====================================================
-- Note: Application code should be updated to:
-- 1. Filter WHERE archived = false by default
-- 2. Add include_archived parameter to list endpoints
-- 3. Use idx_archon_projects_active index for performance

-- =====================================================
-- Verification queries (for testing)
-- =====================================================
-- Test archiving a project:
-- SELECT archive_project_and_tasks('<project-uuid>', 'test-user');
--
-- Verify archived:
-- SELECT id, title, archived, archived_at, archived_by
-- FROM archon_projects WHERE archived = true;
--
-- Test unarchiving:
-- SELECT unarchive_project_and_tasks('<project-uuid>');
--
-- Count active vs archived:
-- SELECT archived, COUNT(*) FROM archon_projects GROUP BY archived;

-- =====================================================
-- Migration complete
-- =====================================================
