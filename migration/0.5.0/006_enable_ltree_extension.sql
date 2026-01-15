-- =====================================================
-- Migration: Enable ltree Extension for Project Hierarchy
-- Version: 0.5.0
-- Date: 2026-01-15
-- Description: Enable PostgreSQL ltree extension and add
--              hierarchy_path column to archon_projects for
--              efficient hierarchical queries
-- =====================================================

-- Enable ltree extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS ltree;

-- Add hierarchy_path column to archon_projects
ALTER TABLE archon_projects
    ADD COLUMN IF NOT EXISTS hierarchy_path ltree;

-- Create GiST index for efficient ltree queries
-- GiST (Generalized Search Tree) supports ancestor/descendant queries
CREATE INDEX IF NOT EXISTS idx_archon_projects_hierarchy_path
    ON archon_projects USING GIST (hierarchy_path);

-- Add additional B-tree index for exact path matches
CREATE INDEX IF NOT EXISTS idx_archon_projects_hierarchy_path_btree
    ON archon_projects (hierarchy_path);

-- Add comments
COMMENT ON COLUMN archon_projects.hierarchy_path IS 'Hierarchical path using ltree (e.g., ''root.project1.subproject1'')';
COMMENT ON INDEX idx_archon_projects_hierarchy_path IS 'GiST index for efficient ancestor (@>) and descendant (<@) queries';

-- Create function to update hierarchy paths
CREATE OR REPLACE FUNCTION update_project_hierarchy_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path ltree;
BEGIN
    -- If this is a root project (no parent in hierarchy table), set path to just project ID
    IF NOT EXISTS (
        SELECT 1 FROM archon_project_hierarchy
        WHERE child_project_id = NEW.id
    ) THEN
        NEW.hierarchy_path := text2ltree('root.' || replace(NEW.id::text, '-', '_'));
    ELSE
        -- Get parent's path
        SELECT p.hierarchy_path INTO parent_path
        FROM archon_projects p
        JOIN archon_project_hierarchy h ON h.parent_project_id = p.id
        WHERE h.child_project_id = NEW.id
        LIMIT 1;

        -- Construct new path by appending current project ID
        IF parent_path IS NOT NULL THEN
            NEW.hierarchy_path := parent_path || text2ltree(replace(NEW.id::text, '-', '_'));
        ELSE
            -- Fallback if parent path not set yet
            NEW.hierarchy_path := text2ltree('root.' || replace(NEW.id::text, '-', '_'));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update hierarchy_path on insert
-- Note: Updates will be handled by archon_project_hierarchy trigger
DROP TRIGGER IF EXISTS trigger_update_project_hierarchy_path ON archon_projects;
CREATE TRIGGER trigger_update_project_hierarchy_path
    BEFORE INSERT ON archon_projects
    FOR EACH ROW
    WHEN (NEW.hierarchy_path IS NULL)
    EXECUTE FUNCTION update_project_hierarchy_path();

-- Initialize hierarchy_path for existing projects (set all as root-level initially)
UPDATE archon_projects
SET hierarchy_path = text2ltree('root.' || replace(id::text, '-', '_'))
WHERE hierarchy_path IS NULL;

-- Add migration record
INSERT INTO archon_migrations (version, migration_name)
VALUES ('0.5.0', '006_enable_ltree_extension')
ON CONFLICT (version, migration_name) DO NOTHING;
