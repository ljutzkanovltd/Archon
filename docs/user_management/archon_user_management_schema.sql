-- =============================================================================
-- ARCHON USER MANAGEMENT SYSTEM - DATABASE SCHEMA
-- =============================================================================
-- Version: 1.0
-- Date: 2026-01-13
-- Database: PostgreSQL 15+
-- Target: Supabase (with Row Level Security support)
--
-- Description:
--   Complete database schema for Archon's user management system, informed by
--   SportERP's authentication patterns but simplified for Archon's needs.
--
-- Tables:
--   1. archon_users              - Core user identity & authentication
--   2. archon_user_profiles      - Extended user profile data
--   3. archon_organizations      - Organization/tenant management
--   4. archon_organization_members - User-Organization membership (M:N)
--   5. archon_invitations        - Invitation system with token-based accept
--
-- Design Principles:
--   - UUIDs for all primary keys (security + scalability)
--   - Explicit timestamps (created_at, updated_at) with triggers
--   - Foreign key constraints with ON DELETE CASCADE/SET NULL
--   - Composite indexes for common query patterns
--   - CHECK constraints for data validation
--   - Row Level Security (RLS) for multi-tenancy
--   - Support for multiple OAuth providers (Google, GitHub, GitLab)
-- =============================================================================

-- =============================================================================
-- CLEANUP (for development/testing only - remove in production migrations)
-- =============================================================================
-- DROP TABLE IF EXISTS archon_invitations CASCADE;
-- DROP TABLE IF EXISTS archon_organization_members CASCADE;
-- DROP TABLE IF EXISTS archon_user_profiles CASCADE;
-- DROP TABLE IF EXISTS archon_organizations CASCADE;
-- DROP TABLE IF EXISTS archon_users CASCADE;
-- DROP TYPE IF EXISTS organization_member_role CASCADE;
-- DROP TYPE IF EXISTS invitation_status CASCADE;
-- DROP TYPE IF EXISTS oauth_provider CASCADE;

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Organization member roles (simplified from SportERP's complex subscription codes)
CREATE TYPE organization_member_role AS ENUM ('owner', 'admin', 'member');

-- Invitation status
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- OAuth providers (extensible list)
CREATE TYPE oauth_provider AS ENUM ('google', 'github', 'gitlab', 'microsoft');

-- =============================================================================
-- TABLE 1: archon_users (Core User Identity)
-- =============================================================================
-- Purpose:
--   - Primary user identity table
--   - Handles authentication (password OR OAuth)
--   - Unique email globally (alternative: scope per organization)
--   - Inspired by SportERP's res.users + res.partner, but unified
--
-- Key Differences vs SportERP:
--   - Single table instead of res.users + res.partner
--   - OAuth provider fields built-in (SportERP uses JSONB)
--   - Email verification required (SportERP lacks this)
--   - Simpler: No Odoo ORM complexity
-- =============================================================================

CREATE TABLE archon_users (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Authentication (email + password OR OAuth)
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255), -- NULL for OAuth-only users

    -- OAuth provider fields (optional)
    oauth_provider oauth_provider, -- NULL for password-based users
    oauth_provider_id VARCHAR(255), -- Provider's user ID (e.g., Google sub)
    oauth_access_token TEXT, -- Store for API calls (optional)
    oauth_refresh_token TEXT, -- For token refresh (optional)
    oauth_token_expires_at TIMESTAMPTZ, -- Token expiration

    -- Basic profile (denormalized for quick access)
    full_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),

    -- Account status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE, -- Email verification status
    email_verified_at TIMESTAMPTZ,

    -- Security
    last_login_at TIMESTAMPTZ,
    last_login_ip INET, -- Track last login IP for security
    password_changed_at TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ, -- Account lockout after too many failed attempts

    -- Two-Factor Authentication (future)
    is_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    totp_secret VARCHAR(32), -- For TOTP-based 2FA

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ, -- Soft delete (NULL = active)

    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT password_or_oauth CHECK (
        (hashed_password IS NOT NULL AND oauth_provider IS NULL) OR
        (hashed_password IS NULL AND oauth_provider IS NOT NULL)
    ),
    CONSTRAINT oauth_consistency CHECK (
        (oauth_provider IS NULL AND oauth_provider_id IS NULL) OR
        (oauth_provider IS NOT NULL AND oauth_provider_id IS NOT NULL)
    )
);

-- Indexes for archon_users
CREATE INDEX idx_users_email ON archon_users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_oauth ON archon_users(oauth_provider, oauth_provider_id) WHERE oauth_provider IS NOT NULL;
CREATE INDEX idx_users_active ON archon_users(is_active) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_users_unverified ON archon_users(is_verified) WHERE is_verified = FALSE AND deleted_at IS NULL;
CREATE INDEX idx_users_last_login ON archon_users(last_login_at DESC);

-- Comments
COMMENT ON TABLE archon_users IS 'Core user identity and authentication table';
COMMENT ON COLUMN archon_users.hashed_password IS 'bcrypt/argon2 hashed password - NULL for OAuth-only users';
COMMENT ON COLUMN archon_users.oauth_provider IS 'OAuth provider (google, github, etc.) - NULL for password users';
COMMENT ON COLUMN archon_users.is_verified IS 'Email verification status - users must verify email to access system';
COMMENT ON COLUMN archon_users.failed_login_attempts IS 'Track failed login attempts for account lockout';
COMMENT ON COLUMN archon_users.locked_until IS 'Account locked until this timestamp after too many failed logins';

-- =============================================================================
-- TABLE 2: archon_user_profiles (Extended User Profile)
-- =============================================================================
-- Purpose:
--   - Separate table for profile data (keeps archon_users lean)
--   - Optional fields that don't affect authentication
--   - 1:1 relationship with archon_users
--   - Inspired by SportERP's res.partner extended fields
--
-- Key Differences vs SportERP:
--   - Focused: Only 10 essential fields (vs 30+ in SportERP)
--   - No Odoo-specific fields (company_ids, employee_id, etc.)
--   - User preferences (theme, language) added
-- =============================================================================

CREATE TABLE archon_user_profiles (
    -- Primary key and foreign key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES archon_users(id) ON DELETE CASCADE,

    -- Contact information
    phone_number VARCHAR(20),

    -- Profile fields
    bio TEXT,
    job_title VARCHAR(100),
    website VARCHAR(500),
    location VARCHAR(255), -- City, Country

    -- User preferences
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    language VARCHAR(10) NOT NULL DEFAULT 'en', -- ISO 639-1 code
    theme_preference VARCHAR(20) NOT NULL DEFAULT 'system', -- 'light', 'dark', 'system'
    date_format VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',

    -- Notification preferences
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    desktop_notifications BOOLEAN NOT NULL DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_phone CHECK (phone_number ~* '^\+?[1-9]\d{1,14}$' OR phone_number IS NULL),
    CONSTRAINT valid_website CHECK (website ~* '^https?://' OR website IS NULL),
    CONSTRAINT valid_theme CHECK (theme_preference IN ('light', 'dark', 'system')),
    CONSTRAINT valid_timezone CHECK (timezone ~ '^[A-Z][a-z]+/[A-Z][a-z]+$' OR timezone = 'UTC')
);

-- Indexes for archon_user_profiles
CREATE INDEX idx_profiles_user_id ON archon_user_profiles(user_id);
CREATE INDEX idx_profiles_location ON archon_user_profiles(location) WHERE location IS NOT NULL;

-- Comments
COMMENT ON TABLE archon_user_profiles IS 'Extended user profile data and preferences';
COMMENT ON COLUMN archon_user_profiles.timezone IS 'User timezone (e.g., America/New_York, Europe/London)';
COMMENT ON COLUMN archon_user_profiles.theme_preference IS 'UI theme preference: light, dark, or system';

-- =============================================================================
-- TABLE 3: archon_organizations (Organization/Tenant Management)
-- =============================================================================
-- Purpose:
--   - Multi-tenant organization structure
--   - Each organization owns projects, tasks, documents
--   - Users can belong to multiple organizations
--   - Inspired by SportERP's organisation.organisation
--
-- Key Differences vs SportERP:
--   - No company_id (removed 3-level tenancy)
--   - Simpler: No Odoo-specific fields (stage_id, partner_id)
--   - owner_id required (clear ownership)
--   - slug for URL-friendly identifiers
-- =============================================================================

CREATE TABLE archon_organizations (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization identity
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE, -- URL-friendly identifier (e.g., "my-org")
    description TEXT,

    -- Ownership
    owner_id UUID NOT NULL REFERENCES archon_users(id) ON DELETE RESTRICT, -- Owner cannot be deleted

    -- Branding
    logo_url VARCHAR(500),
    primary_color VARCHAR(7), -- Hex color (e.g., #FF5733)
    secondary_color VARCHAR(7),

    -- Settings
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    max_members INTEGER NOT NULL DEFAULT 50, -- Member limit for free/paid tiers

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ, -- Soft delete

    -- Constraints
    CONSTRAINT valid_slug CHECK (slug ~* '^[a-z0-9-]+$' AND LENGTH(slug) >= 3),
    CONSTRAINT valid_name CHECK (LENGTH(name) >= 3 AND LENGTH(name) <= 255),
    CONSTRAINT valid_primary_color CHECK (primary_color ~* '^#[0-9A-Fa-f]{6}$' OR primary_color IS NULL),
    CONSTRAINT valid_secondary_color CHECK (secondary_color ~* '^#[0-9A-Fa-f]{6}$' OR secondary_color IS NULL),
    CONSTRAINT valid_max_members CHECK (max_members > 0 AND max_members <= 10000)
);

-- Indexes for archon_organizations
CREATE INDEX idx_orgs_slug ON archon_organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_owner ON archon_organizations(owner_id);
CREATE INDEX idx_orgs_active ON archon_organizations(is_active) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_orgs_created ON archon_organizations(created_at DESC);

-- Comments
COMMENT ON TABLE archon_organizations IS 'Organizations (tenants) - each org owns projects/tasks/docs';
COMMENT ON COLUMN archon_organizations.slug IS 'URL-friendly identifier (lowercase, hyphens, unique)';
COMMENT ON COLUMN archon_organizations.owner_id IS 'Organization owner (cannot be deleted while owning org)';
COMMENT ON COLUMN archon_organizations.max_members IS 'Maximum members allowed (for free/paid tier limits)';

-- =============================================================================
-- TABLE 4: archon_organization_members (User-Organization Membership)
-- =============================================================================
-- Purpose:
--   - Many-to-Many relationship between users and organizations
--   - Users can belong to multiple organizations with different roles
--   - Each organization can have multiple members
--   - Inspired by SportERP's organisation.user, but simplified
--
-- Key Differences vs SportERP:
--   - Simple role ENUM (owner/admin/member) vs complex subscription codes
--   - No bridge table complexity (no privilege_group_id, component_ids)
--   - Clear join semantics (invited_by, joined_at)
-- =============================================================================

CREATE TABLE archon_organization_members (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    organization_id UUID NOT NULL REFERENCES archon_organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES archon_users(id) ON DELETE CASCADE,

    -- Role in organization
    role organization_member_role NOT NULL DEFAULT 'member',

    -- Invitation/join tracking
    invited_by UUID REFERENCES archon_users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    joined_at TIMESTAMPTZ, -- NULL = pending invitation, NOT NULL = accepted

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE, -- Can temporarily deactivate members

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_org_user UNIQUE (organization_id, user_id),
    CONSTRAINT owner_must_be_active CHECK (
        (role = 'owner' AND is_active = TRUE) OR role != 'owner'
    )
);

-- Indexes for archon_organization_members
CREATE INDEX idx_members_org_user ON archon_organization_members(organization_id, user_id);
CREATE INDEX idx_members_user_orgs ON archon_organization_members(user_id, organization_id);
CREATE INDEX idx_members_role ON archon_organization_members(organization_id, role);
CREATE INDEX idx_members_active ON archon_organization_members(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_members_pending ON archon_organization_members(joined_at) WHERE joined_at IS NULL;

-- Comments
COMMENT ON TABLE archon_organization_members IS 'User-Organization membership (M:N) with roles';
COMMENT ON COLUMN archon_organization_members.role IS 'Member role: owner (full control), admin (manage users), member (basic access)';
COMMENT ON COLUMN archon_organization_members.invited_by IS 'User who invited this member (NULL for self-created orgs)';
COMMENT ON COLUMN archon_organization_members.joined_at IS 'NULL = pending invitation, NOT NULL = accepted';

-- =============================================================================
-- TABLE 5: archon_invitations (Invitation System)
-- =============================================================================
-- Purpose:
--   - Token-based invitation system for organizations
--   - Secure, time-limited invitation links
--   - Track invitation lifecycle (pending/accepted/expired/revoked)
--   - NOT present in SportERP (they use subscription codes)
--
-- Key Differences vs SportERP:
--   - Explicit invitation table (SportERP uses implicit subscription codes)
--   - Token-based with expiration (more secure)
--   - Audit trail (who invited, when accepted, etc.)
-- =============================================================================

CREATE TABLE archon_invitations (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    organization_id UUID NOT NULL REFERENCES archon_organizations(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES archon_users(id) ON DELETE SET NULL,

    -- Invitation details
    email VARCHAR(255) NOT NULL, -- Invitee email (may not be registered yet)
    token VARCHAR(64) NOT NULL UNIQUE, -- Secure random token for invitation link
    role organization_member_role NOT NULL DEFAULT 'member',

    -- Invitation status
    status invitation_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL, -- Invitation expiration (e.g., 7 days)

    -- Acceptance tracking
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES archon_users(id) ON DELETE SET NULL, -- User who accepted

    -- Revocation tracking
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES archon_users(id) ON DELETE SET NULL,
    revocation_reason TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT valid_token CHECK (LENGTH(token) = 64), -- SHA256 hex (32 bytes = 64 hex chars)
    CONSTRAINT valid_expiration CHECK (expires_at > created_at),
    CONSTRAINT accepted_consistency CHECK (
        (status = 'accepted' AND accepted_at IS NOT NULL AND accepted_by IS NOT NULL) OR
        (status != 'accepted' AND accepted_at IS NULL AND accepted_by IS NULL)
    ),
    CONSTRAINT revoked_consistency CHECK (
        (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL) OR
        (status != 'revoked')
    )
);

-- Indexes for archon_invitations
CREATE INDEX idx_invitations_token ON archon_invitations(token) WHERE status = 'pending';
CREATE INDEX idx_invitations_email ON archon_invitations(email);
CREATE INDEX idx_invitations_org ON archon_invitations(organization_id);
CREATE INDEX idx_invitations_status ON archon_invitations(status);
CREATE INDEX idx_invitations_expires ON archon_invitations(expires_at) WHERE status = 'pending';
CREATE UNIQUE INDEX idx_invitations_pending_email_org ON archon_invitations(organization_id, email)
    WHERE status = 'pending'; -- Prevent duplicate pending invitations

-- Comments
COMMENT ON TABLE archon_invitations IS 'Token-based invitation system for organizations';
COMMENT ON COLUMN archon_invitations.token IS 'Secure random token (SHA256 hex) for invitation link';
COMMENT ON COLUMN archon_invitations.expires_at IS 'Invitation expiration (typically 7 days from creation)';
COMMENT ON COLUMN archon_invitations.status IS 'Invitation lifecycle: pending → accepted/expired/revoked';

-- =============================================================================
-- TRIGGERS: Auto-update updated_at timestamps
-- =============================================================================

-- Generic trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON archon_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON archon_user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orgs_updated_at
    BEFORE UPDATE ON archon_organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at
    BEFORE UPDATE ON archon_organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invitations_updated_at
    BEFORE UPDATE ON archon_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TRIGGERS: Auto-create user profile on user creation
-- =============================================================================

CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO archon_user_profiles (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_profile_on_user_creation
    AFTER INSERT ON archon_users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- =============================================================================
-- TRIGGERS: Auto-expire invitations
-- =============================================================================

CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark expired invitations
    UPDATE archon_invitations
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- This trigger runs on INSERT to check for expired invitations
-- In production, use a cron job or scheduled task for better performance
CREATE TRIGGER check_expired_invitations
    AFTER INSERT ON archon_invitations
    FOR EACH STATEMENT
    EXECUTE FUNCTION expire_old_invitations();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE archon_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_invitations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES: archon_users
-- =============================================================================

-- Users can read their own user record
CREATE POLICY users_select_own
    ON archon_users
    FOR SELECT
    USING (id = current_setting('app.current_user_id')::UUID);

-- Users can update their own profile
CREATE POLICY users_update_own
    ON archon_users
    FOR UPDATE
    USING (id = current_setting('app.current_user_id')::UUID);

-- Users cannot delete themselves (require admin action)
-- No DELETE policy = users cannot delete their own accounts

-- =============================================================================
-- RLS POLICIES: archon_user_profiles
-- =============================================================================

-- Users can read their own profile
CREATE POLICY profiles_select_own
    ON archon_user_profiles
    FOR SELECT
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Users can update their own profile
CREATE POLICY profiles_update_own
    ON archon_user_profiles
    FOR UPDATE
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- =============================================================================
-- RLS POLICIES: archon_organizations
-- =============================================================================

-- Users can read organizations they're members of
CREATE POLICY orgs_select_member
    ON archon_organizations
    FOR SELECT
    USING (
        id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = current_setting('app.current_user_id')::UUID
            AND is_active = TRUE
        )
    );

-- Only owners can update organizations
CREATE POLICY orgs_update_owner
    ON archon_organizations
    FOR UPDATE
    USING (owner_id = current_setting('app.current_user_id')::UUID);

-- Only owners can delete organizations
CREATE POLICY orgs_delete_owner
    ON archon_organizations
    FOR DELETE
    USING (owner_id = current_setting('app.current_user_id')::UUID);

-- =============================================================================
-- RLS POLICIES: archon_organization_members
-- =============================================================================

-- Users can read members of organizations they belong to
CREATE POLICY members_select_same_org
    ON archon_organization_members
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = current_setting('app.current_user_id')::UUID
            AND is_active = TRUE
        )
    );

-- Owners and admins can add members
CREATE POLICY members_insert_owner_admin
    ON archon_organization_members
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = current_setting('app.current_user_id')::UUID
            AND role IN ('owner', 'admin')
            AND is_active = TRUE
        )
    );

-- Owners and admins can update members (change roles, deactivate)
CREATE POLICY members_update_owner_admin
    ON archon_organization_members
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = current_setting('app.current_user_id')::UUID
            AND role IN ('owner', 'admin')
            AND is_active = TRUE
        )
    );

-- Owners and admins can remove members
CREATE POLICY members_delete_owner_admin
    ON archon_organization_members
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = current_setting('app.current_user_id')::UUID
            AND role IN ('owner', 'admin')
            AND is_active = TRUE
        )
    );

-- =============================================================================
-- RLS POLICIES: archon_invitations
-- =============================================================================

-- Owners and admins can read invitations for their organizations
CREATE POLICY invitations_select_owner_admin
    ON archon_invitations
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = current_setting('app.current_user_id')::UUID
            AND role IN ('owner', 'admin')
            AND is_active = TRUE
        )
    );

-- Invited users can read their own pending invitations (by token)
CREATE POLICY invitations_select_by_token
    ON archon_invitations
    FOR SELECT
    USING (status = 'pending' AND expires_at > NOW());

-- Owners and admins can create invitations
CREATE POLICY invitations_insert_owner_admin
    ON archon_invitations
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = current_setting('app.current_user_id')::UUID
            AND role IN ('owner', 'admin')
            AND is_active = TRUE
        )
    );

-- Owners and admins can revoke invitations
CREATE POLICY invitations_update_owner_admin
    ON archon_invitations
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = current_setting('app.current_user_id')::UUID
            AND role IN ('owner', 'admin')
            AND is_active = TRUE
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check if user is owner/admin of an organization
CREATE OR REPLACE FUNCTION is_org_owner_or_admin(
    p_user_id UUID,
    p_organization_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM archon_organization_members
        WHERE user_id = p_user_id
        AND organization_id = p_organization_id
        AND role IN ('owner', 'admin')
        AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate secure invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS VARCHAR(64) AS $$
DECLARE
    token VARCHAR(64);
BEGIN
    -- Generate random 32-byte token, encode as hex (64 chars)
    token := encode(gen_random_bytes(32), 'hex');
    RETURN token;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SAMPLE DATA (for testing - remove in production)
-- =============================================================================

-- Sample user 1 (password-based)
INSERT INTO archon_users (id, email, hashed_password, full_name, is_verified)
VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    'alice@example.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5oBzU8Kw8n7fO', -- "password123"
    'Alice Johnson',
    TRUE
);

-- Sample user 2 (Google OAuth)
INSERT INTO archon_users (id, email, oauth_provider, oauth_provider_id, full_name, is_verified)
VALUES (
    '550e8400-e29b-41d4-a716-446655440002',
    'bob@example.com',
    'google',
    'google-user-12345',
    'Bob Smith',
    TRUE
);

-- Sample organization
INSERT INTO archon_organizations (id, name, slug, owner_id)
VALUES (
    '650e8400-e29b-41d4-a716-446655440001',
    'Acme Corporation',
    'acme-corp',
    '550e8400-e29b-41d4-a716-446655440001' -- Alice is owner
);

-- Sample organization members
INSERT INTO archon_organization_members (organization_id, user_id, role, joined_at)
VALUES
    ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'owner', NOW()),
    ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'member', NOW());

-- Sample invitation (pending)
INSERT INTO archon_invitations (
    organization_id,
    invited_by,
    email,
    token,
    role,
    expires_at
)
VALUES (
    '650e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001', -- Alice invites
    'charlie@example.com',
    encode(gen_random_bytes(32), 'hex'),
    'member',
    NOW() + INTERVAL '7 days'
);

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================

-- Verification queries (run after schema creation)
/*
-- Count tables
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'archon_%';
-- Expected: 5 tables

-- Count indexes
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname = 'public' AND tablename LIKE 'archon_%';
-- Expected: 20+ indexes

-- Count triggers
SELECT COUNT(*) FROM information_schema.triggers
WHERE trigger_schema = 'public' AND event_object_table LIKE 'archon_%';
-- Expected: 6 triggers

-- Count RLS policies
SELECT COUNT(*) FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'archon_%';
-- Expected: 15+ policies
*/
