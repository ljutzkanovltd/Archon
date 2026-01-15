-- =====================================================
-- Migration: Create Team Management Tables
-- Version: 0.5.0
-- Date: 2026-01-15
-- Description: Create archon_teams and archon_team_members tables
--              for team management and user assignments
-- =====================================================

-- Create archon_teams table
CREATE TABLE IF NOT EXISTS archon_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    project_id UUID REFERENCES archon_projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create archon_team_members table
CREATE TABLE IF NOT EXISTS archon_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES archon_teams(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CHECK (role IN ('member', 'lead', 'observer')),
    UNIQUE (team_id, user_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_archon_teams_project
    ON archon_teams(project_id);

CREATE INDEX IF NOT EXISTS idx_archon_team_members_team
    ON archon_team_members(team_id);

CREATE INDEX IF NOT EXISTS idx_archon_team_members_user
    ON archon_team_members(user_id);

CREATE INDEX IF NOT EXISTS idx_archon_team_members_role
    ON archon_team_members(role);

-- Add comments
COMMENT ON TABLE archon_teams IS 'Teams for project collaboration and user grouping';
COMMENT ON TABLE archon_team_members IS 'Members of teams with their roles';

COMMENT ON COLUMN archon_teams.project_id IS 'Optional project association - NULL for organization-wide teams';
COMMENT ON COLUMN archon_team_members.role IS 'Team member role: member (contributor), lead (team manager), observer (view-only)';
COMMENT ON COLUMN archon_team_members.user_id IS 'User identifier - matches assignee field in archon_tasks';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_archon_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_archon_teams_updated_at ON archon_teams;
CREATE TRIGGER trigger_update_archon_teams_updated_at
    BEFORE UPDATE ON archon_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_archon_teams_updated_at();

-- Add migration record
INSERT INTO archon_migrations (version, migration_name)
VALUES ('0.5.0', '008_create_teams')
ON CONFLICT (version, migration_name) DO NOTHING;
