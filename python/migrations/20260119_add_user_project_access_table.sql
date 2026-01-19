-- Migration: Add User Project Access Control System
-- Date: 2026-01-19
-- Purpose: Create archon_user_project_access table for managing user access to projects

-- ============================================================================
-- 1. Create archon_user_project_access table
-- ============================================================================

CREATE TABLE IF NOT EXISTS archon_user_project_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES archon_users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES archon_projects(id) ON DELETE CASCADE,
    access_level VARCHAR(20) NOT NULL CHECK (access_level IN ('owner', 'member')),
    added_by UUID REFERENCES archon_users(id) ON DELETE SET NULL,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    removed_at TIMESTAMP WITH TIME ZONE,
    removed_by UUID REFERENCES archon_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Ensure unique user-project combinations (active records only)
    CONSTRAINT unique_user_project_active UNIQUE (user_id, project_id)
);

-- ============================================================================
-- 2. Create indexes for performance
-- ============================================================================

CREATE INDEX idx_user_project_access_user_id ON archon_user_project_access(user_id)
    WHERE removed_at IS NULL;

CREATE INDEX idx_user_project_access_project_id ON archon_user_project_access(project_id)
    WHERE removed_at IS NULL;

CREATE INDEX idx_user_project_access_active ON archon_user_project_access(user_id, project_id)
    WHERE removed_at IS NULL;

CREATE INDEX idx_user_project_access_access_level ON archon_user_project_access(access_level)
    WHERE removed_at IS NULL;

-- ============================================================================
-- 3. Create trigger for updated_at timestamp
-- ============================================================================

CREATE TRIGGER trigger_user_project_access_updated_at
    BEFORE UPDATE ON archon_user_project_access
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE archon_user_project_access ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own access records
CREATE POLICY "user_project_access_select_own"
    ON archon_user_project_access
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR added_by = auth.uid());

-- Allow service role full access
CREATE POLICY "user_project_access_service_role_all"
    ON archon_user_project_access
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. Seed admin users with access to all projects
-- ============================================================================

-- Grant all admin users access to all existing projects as owners
INSERT INTO archon_user_project_access (user_id, project_id, access_level, added_by, added_at)
SELECT
    u.id as user_id,
    p.id as project_id,
    'owner' as access_level,
    u.id as added_by,
    NOW() as added_at
FROM
    archon_users u
    CROSS JOIN archon_projects p
WHERE
    u.role = 'admin'
    AND p.archived = false
    AND NOT EXISTS (
        SELECT 1
        FROM archon_user_project_access upa
        WHERE upa.user_id = u.id
        AND upa.project_id = p.id
        AND upa.removed_at IS NULL
    );

-- ============================================================================
-- 6. Create helper function to check user project access
-- ============================================================================

CREATE OR REPLACE FUNCTION has_project_access(
    p_user_id UUID,
    p_project_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_has_access BOOLEAN;
BEGIN
    -- Check if user is admin
    SELECT role = 'admin' INTO v_is_admin
    FROM archon_users
    WHERE id = p_user_id;

    -- Admins have access to everything
    IF v_is_admin THEN
        RETURN TRUE;
    END IF;

    -- Check if user has explicit access to the project
    SELECT EXISTS(
        SELECT 1
        FROM archon_user_project_access
        WHERE user_id = p_user_id
        AND project_id = p_project_id
        AND removed_at IS NULL
    ) INTO v_has_access;

    RETURN v_has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Create helper function to get user accessible project IDs
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_accessible_project_ids(
    p_user_id UUID
) RETURNS TABLE(project_id UUID) AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    -- Check if user is admin
    SELECT role = 'admin' INTO v_is_admin
    FROM archon_users
    WHERE id = p_user_id;

    -- Admins see all projects
    IF v_is_admin THEN
        RETURN QUERY
        SELECT id FROM archon_projects WHERE archived = false;
    ELSE
        -- Regular users see only assigned projects
        RETURN QUERY
        SELECT upa.project_id
        FROM archon_user_project_access upa
        WHERE upa.user_id = p_user_id
        AND upa.removed_at IS NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Record migration
-- ============================================================================

INSERT INTO archon_migrations (migration_name, applied_at, description)
VALUES (
    '20260119_add_user_project_access_table',
    NOW(),
    'Create archon_user_project_access table with RLS policies and helper functions for user project access control'
)
ON CONFLICT (migration_name) DO NOTHING;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify migration
DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_function_exists BOOLEAN;
    v_admin_access_count INTEGER;
BEGIN
    -- Check table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'archon_user_project_access'
    ) INTO v_table_exists;

    -- Check helper function exists
    SELECT EXISTS (
        SELECT FROM pg_proc
        WHERE proname = 'has_project_access'
    ) INTO v_function_exists;

    -- Check admin access records created
    SELECT COUNT(*) INTO v_admin_access_count
    FROM archon_user_project_access upa
    JOIN archon_users u ON u.id = upa.user_id
    WHERE u.role = 'admin' AND upa.removed_at IS NULL;

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'Migration Verification:';
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'Table archon_user_project_access exists: %', v_table_exists;
    RAISE NOTICE 'Function has_project_access exists: %', v_function_exists;
    RAISE NOTICE 'Admin access records created: %', v_admin_access_count;
    RAISE NOTICE '=======================================================';

    IF NOT v_table_exists THEN
        RAISE EXCEPTION 'Migration verification failed: Table not created';
    END IF;

    IF NOT v_function_exists THEN
        RAISE EXCEPTION 'Migration verification failed: Helper function not created';
    END IF;
END $$;
