-- Phase 1.4: Fix workflow FK constraints - Remove duplicates and ensure proper cascade rules
-- This migration cleans up duplicate FK constraints and ensures referential integrity

-- ============================================================================
-- PART 1: Remove duplicate FK constraint on archon_tasks.workflow_stage_id
-- ============================================================================

-- Drop the manually created RESTRICT constraint (keep the SET NULL one)
ALTER TABLE archon_tasks
DROP CONSTRAINT IF EXISTS fk_archon_tasks_workflow_stage;

-- Verify the remaining constraint has proper SET NULL behavior
-- (archon_tasks_workflow_stage_id_fkey already has ON DELETE SET NULL)

-- ============================================================================
-- PART 2: Verify all workflow-related FK constraints have proper cascade rules
-- ============================================================================

-- archon_workflow_stages.workflow_id → archon_workflows.id
-- Should CASCADE delete when workflow is deleted
DO $$
BEGIN
    -- Drop existing constraint if it doesn't have CASCADE
    IF EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'archon_workflow_stages'
          AND con.conname = 'archon_workflow_stages_workflow_id_fkey'
          AND con.confdeltype != 'c'  -- 'c' = CASCADE
    ) THEN
        ALTER TABLE archon_workflow_stages
        DROP CONSTRAINT archon_workflow_stages_workflow_id_fkey;

        ALTER TABLE archon_workflow_stages
        ADD CONSTRAINT archon_workflow_stages_workflow_id_fkey
        FOREIGN KEY (workflow_id) REFERENCES archon_workflows(id) ON DELETE CASCADE;
    END IF;
END $$;

-- archon_workflows.project_type_id → archon_project_types.id
-- Should RESTRICT delete (don't allow deleting project types with workflows)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'archon_workflows'
          AND con.conname = 'archon_workflows_project_type_id_fkey'
          AND con.confdeltype != 'r'  -- 'r' = RESTRICT
    ) THEN
        ALTER TABLE archon_workflows
        DROP CONSTRAINT archon_workflows_project_type_id_fkey;

        ALTER TABLE archon_workflows
        ADD CONSTRAINT archon_workflows_project_type_id_fkey
        FOREIGN KEY (project_type_id) REFERENCES archon_project_types(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- archon_projects.workflow_id → archon_workflows.id
-- Should SET NULL (allow workflow deletion without deleting projects)
-- (Already correct from Phase 1.5 migration)

-- archon_tasks.workflow_stage_id → archon_workflow_stages.id
-- Should SET NULL (allow stage deletion without deleting tasks)
-- (Already correct - archon_tasks_workflow_stage_id_fkey has SET NULL)

-- ============================================================================
-- PART 3: Add indexes for FK columns that don't have them
-- ============================================================================

-- Index on archon_workflow_stages.workflow_id (for faster joins)
CREATE INDEX IF NOT EXISTS idx_archon_workflow_stages_workflow_id
ON archon_workflow_stages(workflow_id);

-- ============================================================================
-- PART 4: Add comments for documentation
-- ============================================================================

COMMENT ON CONSTRAINT archon_tasks_workflow_stage_id_fkey ON archon_tasks IS
'FK to workflow_stages with SET NULL on delete - allows stage deletion without orphaning tasks';

COMMENT ON CONSTRAINT archon_workflow_stages_workflow_id_fkey ON archon_workflow_stages IS
'FK to workflows with CASCADE on delete - deletes all stages when workflow is deleted';

COMMENT ON CONSTRAINT archon_workflows_project_type_id_fkey ON archon_workflows IS
'FK to project_types with RESTRICT on delete - prevents deletion of project types with active workflows';

COMMENT ON CONSTRAINT fk_archon_projects_workflow ON archon_projects IS
'FK to workflows with SET NULL on delete - allows workflow deletion without orphaning projects';
