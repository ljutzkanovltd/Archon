-- =====================================================
-- Migration: Create Workflows and Workflow Stages Tables
-- Version: 0.5.0
-- Date: 2026-01-15
-- Description: Add workflow and workflow stages tables for customizable task workflows
--              Fixed workflows per project type (Agile, Marketing, Research, Bug Tracking)
-- =====================================================

-- Create archon_workflows table
CREATE TABLE IF NOT EXISTS archon_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    project_type_id UUID NOT NULL REFERENCES archon_project_types(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(project_type_id, name)
);

-- Create archon_workflow_stages table
CREATE TABLE IF NOT EXISTS archon_workflow_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES archon_workflows(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    stage_order INTEGER NOT NULL,
    is_initial BOOLEAN NOT NULL DEFAULT FALSE,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    color VARCHAR(7) DEFAULT '#6B7280', -- Default gray
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(workflow_id, name),
    UNIQUE(workflow_id, stage_order),
    CHECK (stage_order >= 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_archon_workflows_project_type
    ON archon_workflows(project_type_id);

CREATE INDEX IF NOT EXISTS idx_archon_workflows_is_default
    ON archon_workflows(is_default) WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_archon_workflow_stages_workflow
    ON archon_workflow_stages(workflow_id);

CREATE INDEX IF NOT EXISTS idx_archon_workflow_stages_order
    ON archon_workflow_stages(workflow_id, stage_order);

-- Add comments for documentation
COMMENT ON TABLE archon_workflows IS 'Workflow definitions for different project types (fixed workflows per type)';
COMMENT ON TABLE archon_workflow_stages IS 'Stages within a workflow (ordered sequence of task states)';
COMMENT ON COLUMN archon_workflows.is_default IS 'TRUE if this is the default workflow for its project type';
COMMENT ON COLUMN archon_workflow_stages.stage_order IS 'Ordering of stages (0-based, unique per workflow)';
COMMENT ON COLUMN archon_workflow_stages.is_initial IS 'TRUE if this is the starting stage for new tasks';
COMMENT ON COLUMN archon_workflow_stages.is_final IS 'TRUE if this stage represents completion';
COMMENT ON COLUMN archon_workflow_stages.color IS 'Hex color code for UI display (e.g., #3B82F6)';

-- Seed default workflows for each project type
DO $$
DECLARE
    software_dev_type_id UUID;
    marketing_type_id UUID;
    research_type_id UUID;
    bug_tracking_type_id UUID;

    agile_workflow_id UUID;
    marketing_workflow_id UUID;
    research_workflow_id UUID;
    bug_workflow_id UUID;
BEGIN
    -- Get project type IDs
    SELECT id INTO software_dev_type_id FROM archon_project_types WHERE name = 'software_development';
    SELECT id INTO marketing_type_id FROM archon_project_types WHERE name = 'marketing_campaign';
    SELECT id INTO research_type_id FROM archon_project_types WHERE name = 'research_project';
    SELECT id INTO bug_tracking_type_id FROM archon_project_types WHERE name = 'bug_tracking';

    -- Create Software Development Agile Workflow
    INSERT INTO archon_workflows (id, name, description, project_type_id, is_default)
    VALUES (gen_random_uuid(), 'Standard Agile', 'Standard agile workflow with backlog, in progress, review, and done', software_dev_type_id, TRUE)
    RETURNING id INTO agile_workflow_id;

    INSERT INTO archon_workflow_stages (workflow_id, name, description, stage_order, is_initial, is_final, color) VALUES
        (agile_workflow_id, 'Backlog', 'Tasks awaiting sprint assignment', 0, TRUE, FALSE, '#6B7280'),
        (agile_workflow_id, 'In Progress', 'Active development work', 1, FALSE, FALSE, '#3B82F6'),
        (agile_workflow_id, 'Review', 'Code review and testing', 2, FALSE, FALSE, '#F59E0B'),
        (agile_workflow_id, 'Done', 'Completed and deployed', 3, FALSE, TRUE, '#10B981');

    -- Create Marketing Campaign Workflow
    INSERT INTO archon_workflows (id, name, description, project_type_id, is_default)
    VALUES (gen_random_uuid(), 'Marketing Flow', 'Marketing campaign workflow from planning to publishing', marketing_type_id, TRUE)
    RETURNING id INTO marketing_workflow_id;

    INSERT INTO archon_workflow_stages (workflow_id, name, description, stage_order, is_initial, is_final, color) VALUES
        (marketing_workflow_id, 'Planning', 'Campaign planning and ideation', 0, TRUE, FALSE, '#6B7280'),
        (marketing_workflow_id, 'Content Creation', 'Creating content assets', 1, FALSE, FALSE, '#8B5CF6'),
        (marketing_workflow_id, 'Review', 'Content review and approval', 2, FALSE, FALSE, '#F59E0B'),
        (marketing_workflow_id, 'Publishing', 'Publishing to channels', 3, FALSE, FALSE, '#3B82F6'),
        (marketing_workflow_id, 'Completed', 'Campaign completed', 4, FALSE, TRUE, '#10B981');

    -- Create Research Project Workflow
    INSERT INTO archon_workflows (id, name, description, project_type_id, is_default)
    VALUES (gen_random_uuid(), 'Research Flow', 'Research project workflow from literature review to publication', research_type_id, TRUE)
    RETURNING id INTO research_workflow_id;

    INSERT INTO archon_workflow_stages (workflow_id, name, description, stage_order, is_initial, is_final, color) VALUES
        (research_workflow_id, 'Literature Review', 'Reviewing existing research', 0, TRUE, FALSE, '#6B7280'),
        (research_workflow_id, 'Data Collection', 'Gathering research data', 1, FALSE, FALSE, '#8B5CF6'),
        (research_workflow_id, 'Analysis', 'Data analysis and interpretation', 2, FALSE, FALSE, '#3B82F6'),
        (research_workflow_id, 'Writing', 'Writing research paper', 3, FALSE, FALSE, '#F59E0B'),
        (research_workflow_id, 'Published', 'Research published', 4, FALSE, TRUE, '#10B981');

    -- Create Bug Tracking Workflow
    INSERT INTO archon_workflows (id, name, description, project_type_id, is_default)
    VALUES (gen_random_uuid(), 'Bug Flow', 'Bug tracking workflow from report to resolution', bug_tracking_type_id, TRUE)
    RETURNING id INTO bug_workflow_id;

    INSERT INTO archon_workflow_stages (workflow_id, name, description, stage_order, is_initial, is_final, color) VALUES
        (bug_workflow_id, 'Reported', 'New bug report', 0, TRUE, FALSE, '#EF4444'),
        (bug_workflow_id, 'Triaged', 'Bug triaged and assigned', 1, FALSE, FALSE, '#F59E0B'),
        (bug_workflow_id, 'In Progress', 'Bug fix in progress', 2, FALSE, FALSE, '#3B82F6'),
        (bug_workflow_id, 'Testing', 'Fix being tested', 3, FALSE, FALSE, '#8B5CF6'),
        (bug_workflow_id, 'Resolved', 'Bug resolved', 4, FALSE, TRUE, '#10B981');

    -- Update archon_project_types with default workflow IDs
    UPDATE archon_project_types SET default_workflow_id = agile_workflow_id WHERE name = 'software_development';
    UPDATE archon_project_types SET default_workflow_id = marketing_workflow_id WHERE name = 'marketing_campaign';
    UPDATE archon_project_types SET default_workflow_id = research_workflow_id WHERE name = 'research_project';
    UPDATE archon_project_types SET default_workflow_id = bug_workflow_id WHERE name = 'bug_tracking';
END $$;

-- Now add the foreign key constraint from archon_project_types to archon_workflows
ALTER TABLE archon_project_types
    ADD CONSTRAINT fk_project_types_default_workflow
    FOREIGN KEY (default_workflow_id)
    REFERENCES archon_workflows(id)
    ON DELETE SET NULL;

-- Add migration record
INSERT INTO archon_migrations (version, migration_name)
VALUES ('0.5.0', '002_create_workflows_tables')
ON CONFLICT (version, migration_name) DO NOTHING;
