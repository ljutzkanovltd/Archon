-- =====================================================
-- Migration: Create Project Hierarchy Table
-- Version: 0.5.0
-- Date: 2026-01-15
-- Description: Create archon_project_hierarchy table for parent-child
--              project relationships with automatic ltree path updates
-- =====================================================

-- Create archon_project_hierarchy table
CREATE TABLE IF NOT EXISTS archon_project_hierarchy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_project_id UUID NOT NULL REFERENCES archon_projects(id) ON DELETE CASCADE,
    child_project_id UUID NOT NULL REFERENCES archon_projects(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL DEFAULT 'subproject',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CHECK (parent_project_id != child_project_id),
    CHECK (relationship_type IN ('portfolio', 'program', 'subproject')),
    UNIQUE (parent_project_id, child_project_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_archon_project_hierarchy_parent
    ON archon_project_hierarchy(parent_project_id);

CREATE INDEX IF NOT EXISTS idx_archon_project_hierarchy_child
    ON archon_project_hierarchy(child_project_id);

CREATE INDEX IF NOT EXISTS idx_archon_project_hierarchy_relationship
    ON archon_project_hierarchy(relationship_type);

-- Add comments
COMMENT ON TABLE archon_project_hierarchy IS 'Parent-child relationships between projects for portfolio/program management';
COMMENT ON COLUMN archon_project_hierarchy.relationship_type IS 'Type of relationship: portfolio (strategic grouping), program (coordinated projects), subproject (work breakdown)';

-- Create function to update child project's hierarchy path when relationship changes
CREATE OR REPLACE FUNCTION update_child_hierarchy_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path ltree;
    child_uuid_cleaned text;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Get parent's hierarchy path
        SELECT hierarchy_path INTO parent_path
        FROM archon_projects
        WHERE id = NEW.parent_project_id;

        -- Clean child UUID (replace hyphens with underscores for ltree compatibility)
        child_uuid_cleaned := replace(NEW.child_project_id::text, '-', '_');

        -- Update child's hierarchy path
        UPDATE archon_projects
        SET hierarchy_path = parent_path || text2ltree(child_uuid_cleaned)
        WHERE id = NEW.child_project_id;

        -- Recursively update all descendants
        PERFORM update_descendant_paths(NEW.child_project_id);

    ELSIF TG_OP = 'DELETE' THEN
        -- When relationship is removed, reset child to root level
        UPDATE archon_projects
        SET hierarchy_path = text2ltree('root.' || replace(id::text, '-', '_'))
        WHERE id = OLD.child_project_id;

        -- Recursively update all descendants
        PERFORM update_descendant_paths(OLD.child_project_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create recursive function to update all descendant paths
CREATE OR REPLACE FUNCTION update_descendant_paths(parent_id UUID)
RETURNS VOID AS $$
DECLARE
    child_record RECORD;
    parent_path ltree;
    child_uuid_cleaned text;
BEGIN
    -- Get parent's current path
    SELECT hierarchy_path INTO parent_path
    FROM archon_projects
    WHERE id = parent_id;

    -- Update all direct children
    FOR child_record IN
        SELECT child_project_id
        FROM archon_project_hierarchy
        WHERE parent_project_id = parent_id
    LOOP
        -- Clean child UUID
        child_uuid_cleaned := replace(child_record.child_project_id::text, '-', '_');

        -- Update child's path
        UPDATE archon_projects
        SET hierarchy_path = parent_path || text2ltree(child_uuid_cleaned)
        WHERE id = child_record.child_project_id;

        -- Recursively update this child's descendants
        PERFORM update_descendant_paths(child_record.child_project_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update hierarchy paths
DROP TRIGGER IF EXISTS trigger_update_child_hierarchy_path ON archon_project_hierarchy;
CREATE TRIGGER trigger_update_child_hierarchy_path
    AFTER INSERT OR UPDATE OR DELETE ON archon_project_hierarchy
    FOR EACH ROW
    EXECUTE FUNCTION update_child_hierarchy_path();

-- Create function to validate no circular references
CREATE OR REPLACE FUNCTION validate_no_circular_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if adding this relationship would create a cycle
    -- A cycle exists if the parent is a descendant of the child
    IF EXISTS (
        SELECT 1
        FROM archon_projects parent
        JOIN archon_projects child ON child.id = NEW.child_project_id
        WHERE parent.id = NEW.parent_project_id
          AND parent.hierarchy_path <@ child.hierarchy_path  -- parent is descendant of child
    ) THEN
        RAISE EXCEPTION 'Circular reference detected: parent (%) is already a descendant of child (%)',
            NEW.parent_project_id, NEW.child_project_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent circular references
DROP TRIGGER IF EXISTS trigger_validate_no_circular_hierarchy ON archon_project_hierarchy;
CREATE TRIGGER trigger_validate_no_circular_hierarchy
    BEFORE INSERT OR UPDATE ON archon_project_hierarchy
    FOR EACH ROW
    EXECUTE FUNCTION validate_no_circular_hierarchy();

-- Add migration record
INSERT INTO archon_migrations (version, migration_name)
VALUES ('0.5.0', '007_create_project_hierarchy')
ON CONFLICT (version, migration_name) DO NOTHING;
