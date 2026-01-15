-- Migration: 036_add_user_permissions_table.sql
-- Description: Add user permissions table for RBAC Phase 3B
-- Author: Archon Team
-- Date: 2026-01-15

-- ==============================================================================
-- User Permissions Table
-- ==============================================================================
-- Stores granular permissions for each user for fine-grained access control

CREATE TABLE IF NOT EXISTS public.archon_user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.archon_users(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    granted_by UUID REFERENCES public.archon_users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    revoked_by UUID REFERENCES public.archon_users(id) ON DELETE SET NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_user_permission UNIQUE(user_id, permission_key),
    CONSTRAINT valid_permission_key CHECK (
        permission_key IN (
            'view_projects',
            'view_tasks',
            'view_knowledge_base',
            'view_mcp_inspector',
            'view_test_foundation',
            'view_agent_work_orders',
            'manage_database_sync',
            'manage_users',
            'edit_settings'
        )
    ),
    CONSTRAINT revoked_after_granted CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

-- ==============================================================================
-- Indexes for Performance
-- ==============================================================================

-- Primary lookup by user (most common query)
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id
    ON public.archon_user_permissions(user_id);

-- Lookup by permission key (for listing all users with a permission)
CREATE INDEX IF NOT EXISTS idx_user_permissions_key
    ON public.archon_user_permissions(permission_key);

-- Active permissions only (exclude revoked)
CREATE INDEX IF NOT EXISTS idx_user_permissions_active
    ON public.archon_user_permissions(user_id, permission_key)
    WHERE revoked_at IS NULL;

-- Composite index for permission checks
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_key_active
    ON public.archon_user_permissions(user_id, permission_key, revoked_at);

-- Lookup by who granted permissions (audit trail)
CREATE INDEX IF NOT EXISTS idx_user_permissions_granted_by
    ON public.archon_user_permissions(granted_by);

-- ==============================================================================
-- Triggers
-- ==============================================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER trigger_user_permissions_updated_at
    BEFORE UPDATE ON public.archon_user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.archon_user_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own permissions
CREATE POLICY user_permissions_select_own
    ON public.archon_user_permissions
    FOR SELECT
    USING (user_id = auth.uid());

-- Users with manage_users permission can view all permissions
CREATE POLICY user_permissions_select_managers
    ON public.archon_user_permissions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.archon_user_permissions perm
            WHERE perm.user_id = auth.uid()
            AND perm.permission_key = 'manage_users'
            AND perm.revoked_at IS NULL
        )
    );

-- Only users with manage_users permission can insert/update/delete permissions
CREATE POLICY user_permissions_modify_managers
    ON public.archon_user_permissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.archon_user_permissions perm
            WHERE perm.user_id = auth.uid()
            AND perm.permission_key = 'manage_users'
            AND perm.revoked_at IS NULL
        )
    );

-- ==============================================================================
-- Helper Functions
-- ==============================================================================

-- Function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(
    p_user_id UUID,
    p_permission_key VARCHAR(100)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.archon_user_permissions
        WHERE user_id = p_user_id
        AND permission_key = p_permission_key
        AND revoked_at IS NULL
    );
END;
$$;

-- Function to grant permission to user
CREATE OR REPLACE FUNCTION public.grant_user_permission(
    p_user_id UUID,
    p_permission_key VARCHAR(100),
    p_granted_by UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_permission_id UUID;
    v_existing_id UUID;
BEGIN
    -- Check if permission already exists (even if revoked)
    SELECT id INTO v_existing_id
    FROM public.archon_user_permissions
    WHERE user_id = p_user_id
    AND permission_key = p_permission_key;

    IF v_existing_id IS NOT NULL THEN
        -- Update existing permission (un-revoke if necessary)
        UPDATE public.archon_user_permissions
        SET
            granted_at = NOW(),
            granted_by = COALESCE(p_granted_by, granted_by),
            revoked_at = NULL,
            revoked_by = NULL,
            notes = COALESCE(p_notes, notes),
            updated_at = NOW()
        WHERE id = v_existing_id
        RETURNING id INTO v_permission_id;
    ELSE
        -- Insert new permission
        INSERT INTO public.archon_user_permissions (
            user_id,
            permission_key,
            granted_by,
            notes
        ) VALUES (
            p_user_id,
            p_permission_key,
            p_granted_by,
            p_notes
        )
        RETURNING id INTO v_permission_id;
    END IF;

    RETURN v_permission_id;
END;
$$;

-- Function to revoke permission from user
CREATE OR REPLACE FUNCTION public.revoke_user_permission(
    p_user_id UUID,
    p_permission_key VARCHAR(100),
    p_revoked_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rows_affected INTEGER;
BEGIN
    UPDATE public.archon_user_permissions
    SET
        revoked_at = NOW(),
        revoked_by = p_revoked_by,
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND permission_key = p_permission_key
    AND revoked_at IS NULL;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    RETURN v_rows_affected > 0;
END;
$$;

-- Function to get all active permissions for a user
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS TABLE (
    permission_key VARCHAR(100),
    granted_at TIMESTAMP WITH TIME ZONE,
    granted_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        up.permission_key,
        up.granted_at,
        up.granted_by
    FROM public.archon_user_permissions up
    WHERE up.user_id = p_user_id
    AND up.revoked_at IS NULL
    ORDER BY up.granted_at DESC;
END;
$$;

-- ==============================================================================
-- Seed Default Permissions for Admin Users
-- ==============================================================================
-- Grant all permissions to existing admin users (users with email ending in @archon.dev)

DO $$
DECLARE
    admin_user RECORD;
    perm_key TEXT;
    permission_keys TEXT[] := ARRAY[
        'view_projects',
        'view_tasks',
        'view_knowledge_base',
        'view_mcp_inspector',
        'view_test_foundation',
        'view_agent_work_orders',
        'manage_database_sync',
        'manage_users',
        'edit_settings'
    ];
BEGIN
    -- Grant all permissions to admin users
    FOR admin_user IN
        SELECT id, email, full_name
        FROM public.archon_users
        WHERE email LIKE '%@archon.dev'
        AND is_active = true
    LOOP
        RAISE NOTICE 'Granting permissions to admin user: % (%)', admin_user.full_name, admin_user.email;

        FOREACH perm_key IN ARRAY permission_keys
        LOOP
            INSERT INTO public.archon_user_permissions (
                user_id,
                permission_key,
                granted_by,
                notes
            ) VALUES (
                admin_user.id,
                perm_key,
                NULL,  -- System-granted
                'Initial admin permissions granted during migration 036'
            )
            ON CONFLICT (user_id, permission_key) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- ==============================================================================
-- Comments
-- ==============================================================================

COMMENT ON TABLE public.archon_user_permissions IS
    'Stores granular user permissions for RBAC system. Permissions control access to specific features and pages.';

COMMENT ON COLUMN public.archon_user_permissions.permission_key IS
    'Permission identifier. Valid values: view_projects, view_tasks, view_knowledge_base, view_mcp_inspector, view_test_foundation, view_agent_work_orders, manage_database_sync, manage_users, edit_settings';

COMMENT ON COLUMN public.archon_user_permissions.granted_at IS
    'Timestamp when permission was granted (or re-granted after revocation)';

COMMENT ON COLUMN public.archon_user_permissions.granted_by IS
    'User ID who granted this permission (NULL for system-granted)';

COMMENT ON COLUMN public.archon_user_permissions.revoked_at IS
    'Timestamp when permission was revoked (NULL if currently active)';

COMMENT ON COLUMN public.archon_user_permissions.revoked_by IS
    'User ID who revoked this permission (NULL if not revoked)';

COMMENT ON FUNCTION public.user_has_permission(UUID, VARCHAR) IS
    'Check if a user has a specific active permission. Returns true if permission exists and is not revoked.';

COMMENT ON FUNCTION public.grant_user_permission(UUID, VARCHAR, UUID, TEXT) IS
    'Grant a permission to a user. If permission was previously revoked, it will be re-granted. Returns permission ID.';

COMMENT ON FUNCTION public.revoke_user_permission(UUID, VARCHAR, UUID) IS
    'Revoke a permission from a user. Returns true if permission was successfully revoked, false if permission did not exist or was already revoked.';

COMMENT ON FUNCTION public.get_user_permissions(UUID) IS
    'Get all active (non-revoked) permissions for a user. Returns table of permission_key, granted_at, granted_by.';

-- ==============================================================================
-- Grant Permissions
-- ==============================================================================

-- Grant access to authenticated users (through RLS policies)
GRANT SELECT ON public.archon_user_permissions TO authenticated;

-- Grant full access to service role for backend API
GRANT ALL ON public.archon_user_permissions TO service_role;

-- Grant execute on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION public.user_has_permission(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(UUID) TO authenticated;

-- Grant execute on management functions to service role only
GRANT EXECUTE ON FUNCTION public.grant_user_permission(UUID, VARCHAR, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_user_permission(UUID, VARCHAR, UUID) TO service_role;

-- ==============================================================================
-- Verification
-- ==============================================================================

DO $$
BEGIN
    -- Verify table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'archon_user_permissions'
    ) THEN
        RAISE EXCEPTION 'Table archon_user_permissions was not created';
    END IF;

    -- Verify indexes exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'archon_user_permissions'
        AND indexname = 'idx_user_permissions_user_id'
    ) THEN
        RAISE EXCEPTION 'Index idx_user_permissions_user_id was not created';
    END IF;

    -- Verify RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'archon_user_permissions'
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS is not enabled on archon_user_permissions';
    END IF;

    -- Verify helper functions exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'user_has_permission'
    ) THEN
        RAISE EXCEPTION 'Function user_has_permission was not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'grant_user_permission'
    ) THEN
        RAISE EXCEPTION 'Function grant_user_permission was not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'revoke_user_permission'
    ) THEN
        RAISE EXCEPTION 'Function revoke_user_permission was not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_user_permissions'
    ) THEN
        RAISE EXCEPTION 'Function get_user_permissions was not created';
    END IF;

    RAISE NOTICE 'Migration 036_add_user_permissions_table.sql completed successfully';
END $$;
