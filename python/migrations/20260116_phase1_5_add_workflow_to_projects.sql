-- Phase 1.5: Add workflow_id column to archon_projects table
-- This enables project-level workflow assignment for the Jira-like PM upgrade

-- Add workflow_id column (nullable, allows projects without workflows)
ALTER TABLE archon_projects
ADD COLUMN workflow_id UUID;

-- Add foreign key constraint to archon_workflows
ALTER TABLE archon_projects
ADD CONSTRAINT fk_archon_projects_workflow
FOREIGN KEY (workflow_id) REFERENCES archon_workflows(id) ON DELETE SET NULL;

-- Add index for workflow lookups
CREATE INDEX idx_archon_projects_workflow_id ON archon_projects(workflow_id);

-- Add comment for documentation
COMMENT ON COLUMN archon_projects.workflow_id IS 'Optional workflow assignment for project. If null, tasks use default workflow stages.';
