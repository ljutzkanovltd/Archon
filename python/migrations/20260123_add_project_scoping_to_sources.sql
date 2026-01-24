-- Migration: Add Project Scoping to archon_sources
-- Date: 2026-01-23
-- Purpose: Enable project-private documents and promotion to global KB
-- Phase: 6.3 - Project Document Upload

-- Add project scoping columns to archon_sources
ALTER TABLE archon_sources
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES archon_projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_project_private BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS promoted_to_kb_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS promoted_by VARCHAR(255);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sources_project_id
ON archon_sources(project_id)
WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sources_is_private
ON archon_sources(is_project_private)
WHERE is_project_private = TRUE;

CREATE INDEX IF NOT EXISTS idx_sources_promoted
ON archon_sources(promoted_to_kb_at)
WHERE promoted_to_kb_at IS NOT NULL;

-- Add composite index for project + privacy queries
CREATE INDEX IF NOT EXISTS idx_sources_project_privacy
ON archon_sources(project_id, is_project_private)
WHERE project_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN archon_sources.project_id IS 'Optional project association - NULL for global KB documents';
COMMENT ON COLUMN archon_sources.is_project_private IS 'TRUE = project-only, FALSE = global KB (default: FALSE)';
COMMENT ON COLUMN archon_sources.promoted_to_kb_at IS 'Timestamp when document was promoted from project-private to global KB';
COMMENT ON COLUMN archon_sources.promoted_by IS 'User identifier who promoted the document to KB';

-- Add constraint to ensure promoted_to_kb_at is only set when is_project_private is FALSE
ALTER TABLE archon_sources
ADD CONSTRAINT check_promotion_consistency
CHECK (
    (is_project_private = TRUE AND promoted_to_kb_at IS NULL) OR
    (is_project_private = FALSE)
);

-- Migration notes:
-- 1. project_id is nullable - documents can exist without project association
-- 2. is_project_private defaults to FALSE for existing documents (backward compatible)
-- 3. promoted_to_kb_at tracks promotion history for audit purposes
-- 4. ON DELETE SET NULL ensures documents aren't deleted when project is deleted
-- 5. Constraint ensures promoted_to_kb_at is only set for global KB documents
