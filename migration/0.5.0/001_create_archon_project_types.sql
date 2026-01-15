-- =====================================================
-- Migration: Create archon_project_types Table
-- Version: 0.5.0
-- Date: 2026-01-15
-- Description: Add project types table for Jira-like PM upgrade
--              Supports different project templates (Software, Marketing, Research)
--              with customizable workflows per type
-- =====================================================

-- Create archon_project_types table
CREATE TABLE IF NOT EXISTS archon_project_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50), -- Icon identifier for UI (e.g., 'code', 'megaphone', 'microscope')
    color VARCHAR(7), -- Hex color code for UI (e.g., '#3B82F6')

    -- Default workflow (nullable initially - will be set after workflows table created)
    default_workflow_id UUID,

    -- JSONB settings for extensibility
    settings JSONB DEFAULT '{}'::jsonb,
    -- Example settings: { "default_sprint_length_days": 14, "enable_story_points": true }

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_archon_project_types_name
    ON archon_project_types(name);

CREATE INDEX IF NOT EXISTS idx_archon_project_types_created_at
    ON archon_project_types(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE archon_project_types IS 'Project type templates (Software Dev, Marketing, Research) with customizable workflows';
COMMENT ON COLUMN archon_project_types.name IS 'Unique project type identifier (e.g., software_development, marketing_campaign)';
COMMENT ON COLUMN archon_project_types.description IS 'Human-readable description of this project type';
COMMENT ON COLUMN archon_project_types.default_workflow_id IS 'Default workflow for projects of this type (FK to archon_workflows)';
COMMENT ON COLUMN archon_project_types.settings IS 'JSONB custom settings: sprint length, story points, custom fields, etc.';

-- Seed default project types
INSERT INTO archon_project_types (id, name, description, icon, color, settings) VALUES
    (gen_random_uuid(), 'software_development', 'Software development projects with agile workflows', 'code', '#3B82F6',
     '{"default_sprint_length_days": 14, "enable_story_points": true, "default_stages": ["Backlog", "In Progress", "Review", "Done"]}'::jsonb),

    (gen_random_uuid(), 'marketing_campaign', 'Marketing campaigns and content creation', 'megaphone', '#EC4899',
     '{"default_sprint_length_days": 7, "enable_story_points": false, "default_stages": ["Planning", "Content Creation", "Review", "Publishing", "Completed"]}'::jsonb),

    (gen_random_uuid(), 'research_project', 'Research and data analysis projects', 'microscope', '#8B5CF6',
     '{"default_sprint_length_days": 21, "enable_story_points": false, "default_stages": ["Literature Review", "Data Collection", "Analysis", "Writing", "Published"]}'::jsonb),

    (gen_random_uuid(), 'bug_tracking', 'Bug tracking and issue resolution', 'bug', '#EF4444',
     '{"default_sprint_length_days": 7, "enable_story_points": false, "default_stages": ["Reported", "Triaged", "In Progress", "Testing", "Resolved"]}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Add migration record
INSERT INTO archon_migrations (version, migration_name)
VALUES ('0.5.0', '001_create_archon_project_types')
ON CONFLICT (version, migration_name) DO NOTHING;
