-- =====================================================
-- Migration: Create archon_sprints Table
-- Version: 0.5.0
-- Date: 2026-01-15
-- Description: Add sprints table for agile project management
--              Supports sprint planning, tracking, and velocity calculation
-- =====================================================

-- Create archon_sprints table
CREATE TABLE IF NOT EXISTS archon_sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES archon_projects(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    goal TEXT, -- Sprint objective/goal
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'planned',
    velocity INTEGER, -- Story points completed (calculated)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Constraints
    CHECK (end_date > start_date),
    CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
    CHECK (velocity IS NULL OR velocity >= 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_archon_sprints_project
    ON archon_sprints(project_id);

CREATE INDEX IF NOT EXISTS idx_archon_sprints_status
    ON archon_sprints(status);

CREATE INDEX IF NOT EXISTS idx_archon_sprints_dates
    ON archon_sprints(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_archon_sprints_active
    ON archon_sprints(project_id, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_archon_sprints_project_dates
    ON archon_sprints(project_id, start_date DESC);

-- Add comments
COMMENT ON TABLE archon_sprints IS 'Sprints/iterations for agile project management';
COMMENT ON COLUMN archon_sprints.goal IS 'Sprint objective or goal statement';
COMMENT ON COLUMN archon_sprints.status IS 'Sprint status: planned, active, completed, cancelled';
COMMENT ON COLUMN archon_sprints.velocity IS 'Story points completed in this sprint (auto-calculated)';

-- Add migration record
INSERT INTO archon_migrations (version, migration_name)
VALUES ('0.5.0', '003_create_archon_sprints')
ON CONFLICT (version, migration_name) DO NOTHING;
