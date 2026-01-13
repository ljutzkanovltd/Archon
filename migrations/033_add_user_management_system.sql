-- =============================================================================
-- Migration 033: Add User Management System
-- =============================================================================
-- Date: 2026-01-13
-- Author: database-expert
-- Related Tasks:
--   - Task 0851486e: Design Core User Tables
--   - Task a02c65d1: Design Organization Tables
--   - Task df94126b: Design Invitation System
--   - Task a88616cd: Add Database Indexes & Constraints
--   - Task 227a2ffb: Implement Row Level Security (RLS) Policies
--
-- Description:
--   Complete user management system for Archon with JWT authentication,
--   multi-tenant organizations, magic link invitations, and RBAC.
--
--   Informed by SportERP patterns but simplified for Archon's needs:
--   - 2-level tenancy (Org → User) vs SportERP's 3-level
--   - Simple roles (owner/admin/member) vs complex subscription codes
--   - Database RLS for multi-tenancy vs application-level security
--
-- Tables Created:
--   1. archon_users              - Core user identity & authentication
--   2. archon_user_profiles      - Extended user profile data
--   3. archon_organizations      - Organization/tenant management
--   4. archon_organization_members - User-Organization membership (M:N)
--   5. archon_invitations        - Invitation system with token-based accept
--
-- Security:
--   - UUID primary keys (prevent enumeration)
--   - Row Level Security (RLS) policies for all tables
--   - Email verification required
--   - Account lockout after failed logins
--   - Token-based secure invitations
--
-- Performance:
--   - 22 optimized indexes (composite + partial)
--   - Triggers for auto-updating timestamps
--   - Efficient queries via strategic indexing
--
-- Rollback:
--   DROP TABLE IF EXISTS archon_invitations CASCADE;
--   DROP TABLE IF EXISTS archon_organization_members CASCADE;
--   DROP TABLE IF EXISTS archon_user_profiles CASCADE;
--   DROP TABLE IF EXISTS archon_organizations CASCADE;
--   DROP TABLE IF EXISTS archon_users CASCADE;
--   DROP TYPE IF EXISTS organization_member_role CASCADE;
--   DROP TYPE IF EXISTS invitation_status CASCADE;
--   DROP TYPE IF EXISTS oauth_provider CASCADE;
-- =============================================================================

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
--   - Unique email globally
--   - Inspired by SportERP's res.users + res.partner, but unified in single table
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

    -- Audit timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT password_or_oauth CHECK (
        (hashed_password IS NOT NULL AND oauth_provider IS NULL) OR
        (hashed_password IS NULL AND oauth_provider IS NOT NULL)
    ),
    CONSTRAINT oauth_complete CHECK (
        oauth_provider IS NULL OR oauth_provider_id IS NOT NULL
    )
);

COMMENT ON TABLE archon_users IS 'Core user identity and authentication table';
COMMENT ON COLUMN archon_users.hashed_password IS 'Bcrypt hash of password (NULL for OAuth-only users)';
COMMENT ON COLUMN archon_users.is_verified IS 'Email verification status (magic link or OAuth)';
COMMENT ON COLUMN archon_users.locked_until IS 'Account locked until this timestamp (brute force prevention)';

-- =============================================================================
-- TABLE 2: archon_user_profiles (Extended User Profile)
-- =============================================================================
-- Purpose:
--   - Extended user profile data (separate from auth data)
--   - User preferences and customization
--   - Auto-created via trigger when user is created
-- =============================================================================

CREATE TABLE archon_user_profiles (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key to archon_users (1:1 relationship)
    user_id UUID NOT NULL UNIQUE REFERENCES archon_users(id) ON DELETE CASCADE,

    -- Contact information
    phone_number VARCHAR(20),
    bio TEXT,
    company VARCHAR(255),
    job_title VARCHAR(255),
    location VARCHAR(255),

    -- User preferences
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    theme_preference VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system')),
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    push_notifications BOOLEAN NOT NULL DEFAULT FALSE,

    -- Social links (optional)
    github_url VARCHAR(500),
    linkedin_url VARCHAR(500),
    twitter_url VARCHAR(500),
    website_url VARCHAR(500),

    -- Audit timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE archon_user_profiles IS 'Extended user profile data and preferences';
COMMENT ON COLUMN archon_user_profiles.user_id IS '1:1 foreign key to archon_users';
COMMENT ON COLUMN archon_user_profiles.theme_preference IS 'UI theme: light, dark, or system';

-- =============================================================================
-- TABLE 3: archon_organizations (Multi-Tenant Organizations)
-- =============================================================================
-- Purpose:
--   - Multi-tenant organization/team management
--   - Each org has one owner, multiple admins/members
--   - Slug for URL-friendly identification
--   - Simplified from SportERP's 3-level tenancy (Company → Org → User)
-- =============================================================================

CREATE TABLE archon_organizations (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization identity
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE, -- URL-friendly identifier
    description TEXT,
    avatar_url VARCHAR(500),

    -- Ownership
    owner_id UUID NOT NULL REFERENCES archon_users(id) ON DELETE RESTRICT,

    -- Settings
    settings JSONB NOT NULL DEFAULT '{}'::jsonb, -- Flexible org-wide settings
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_slug CHECK (slug ~* '^[a-z0-9-]+$'),
    CONSTRAINT slug_length CHECK (LENGTH(slug) >= 3 AND LENGTH(slug) <= 100)
);

COMMENT ON TABLE archon_organizations IS 'Multi-tenant organizations (teams, companies)';
COMMENT ON COLUMN archon_organizations.slug IS 'URL-friendly identifier (e.g., acme-corp)';
COMMENT ON COLUMN archon_organizations.owner_id IS 'Primary owner (cannot be deleted while owning org)';
COMMENT ON COLUMN archon_organizations.settings IS 'Flexible JSONB for org-wide settings';

-- =============================================================================
-- TABLE 4: archon_organization_members (User-Organization Membership)
-- =============================================================================
-- Purpose:
--   - Many-to-many relationship between users and organizations
--   - Role-based access control (RBAC): owner, admin, member
--   - One user can belong to multiple organizations
--   - Simplified from SportERP's complex subscription codes
-- =============================================================================

CREATE TABLE archon_organization_members (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    organization_id UUID NOT NULL REFERENCES archon_organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES archon_users(id) ON DELETE CASCADE,

    -- Role-based access control
    role organization_member_role NOT NULL DEFAULT 'member',

    -- Audit fields
    invited_by UUID REFERENCES archon_users(id) ON DELETE SET NULL, -- Who invited this user
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(organization_id, user_id) -- One membership per user per org
);

COMMENT ON TABLE archon_organization_members IS 'Many-to-many user-organization membership with RBAC';
COMMENT ON COLUMN archon_organization_members.role IS 'owner: full control, admin: manage members, member: read-only';
COMMENT ON COLUMN archon_organization_members.invited_by IS 'Who invited this user (NULL for owner)';

-- =============================================================================
-- TABLE 5: archon_invitations (Token-Based Invitation System)
-- =============================================================================
-- Purpose:
--   - Secure token-based invitation system
--   - Magic link invitations with expiration
--   - One pending invitation per email per organization
--   - Enhanced beyond SportERP (explicit invitation table vs application logic)
-- =============================================================================

CREATE TABLE archon_invitations (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    organization_id UUID NOT NULL REFERENCES archon_organizations(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES archon_users(id) ON DELETE CASCADE,

    -- Invitation details
    email VARCHAR(255) NOT NULL,
    role organization_member_role NOT NULL DEFAULT 'member',

    -- Secure token
    token VARCHAR(64) NOT NULL UNIQUE, -- SHA256 hex token (64 chars)

    -- Status tracking
    status invitation_status NOT NULL DEFAULT 'pending',

    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    -- Acceptance tracking
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES archon_users(id) ON DELETE SET NULL,

    -- Audit timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT accepted_logic CHECK (
        (status = 'accepted' AND accepted_at IS NOT NULL AND accepted_by IS NOT NULL) OR
        (status != 'accepted' AND accepted_at IS NULL AND accepted_by IS NULL)
    ),
    -- Only one pending invitation per email per organization
    UNIQUE NULLS NOT DISTINCT(organization_id, email) WHERE status = 'pending'
);

COMMENT ON TABLE archon_invitations IS 'Token-based invitation system with magic links';
COMMENT ON COLUMN archon_invitations.token IS 'SHA256 hex token (64 chars) for magic link';
COMMENT ON COLUMN archon_invitations.expires_at IS 'Default 7 days from creation';
COMMENT ON CONSTRAINT accepted_logic ON archon_invitations IS 'Ensure accepted status has timestamps';

-- =============================================================================
-- INDEXES (22 total: composite + partial for optimal query performance)
-- =============================================================================

-- Users table indexes
CREATE INDEX idx_users_email ON archon_users(email); -- Login lookup
CREATE INDEX idx_users_oauth ON archon_users(oauth_provider, oauth_provider_id) WHERE oauth_provider IS NOT NULL; -- OAuth lookup (partial)
CREATE INDEX idx_users_active ON archon_users(is_active) WHERE is_active = TRUE; -- Filter active users (partial)
CREATE INDEX idx_users_verified ON archon_users(is_verified) WHERE is_verified = TRUE; -- Filter verified users (partial)
CREATE INDEX idx_users_created_at ON archon_users(created_at DESC); -- Sort by creation date

-- User profiles table indexes
CREATE INDEX idx_user_profiles_user_id ON archon_user_profiles(user_id); -- FK lookup (though UNIQUE already creates index)

-- Organizations table indexes
CREATE INDEX idx_organizations_slug ON archon_organizations(slug); -- Slug lookup (UNIQUE already creates index)
CREATE INDEX idx_organizations_owner_id ON archon_organizations(owner_id); -- Find orgs by owner
CREATE INDEX idx_organizations_active ON archon_organizations(is_active) WHERE is_active = TRUE; -- Filter active orgs (partial)
CREATE INDEX idx_organizations_created_at ON archon_organizations(created_at DESC); -- Sort by creation date

-- Organization members table indexes (critical for multi-tenancy queries)
CREATE INDEX idx_org_members_org_id ON archon_organization_members(organization_id); -- Find members of org
CREATE INDEX idx_org_members_user_id ON archon_organization_members(user_id); -- Find orgs for user
CREATE INDEX idx_org_members_composite ON archon_organization_members(organization_id, user_id); -- Composite lookup (UNIQUE already creates index)
CREATE INDEX idx_org_members_role ON archon_organization_members(organization_id, role); -- Find admins/owners
CREATE INDEX idx_org_members_invited_by ON archon_organization_members(invited_by) WHERE invited_by IS NOT NULL; -- Track who invited whom (partial)

-- Invitations table indexes
CREATE INDEX idx_invitations_token ON archon_invitations(token); -- Magic link lookup (UNIQUE already creates index)
CREATE INDEX idx_invitations_email ON archon_invitations(email); -- Find invitations by email
CREATE INDEX idx_invitations_org_id ON archon_invitations(organization_id); -- Find invitations for org
CREATE INDEX idx_invitations_status ON archon_invitations(status) WHERE status = 'pending'; -- Filter pending invitations (partial)
CREATE INDEX idx_invitations_expires_at ON archon_invitations(expires_at) WHERE status = 'pending'; -- Cleanup expired invitations (partial)
CREATE INDEX idx_invitations_invited_by ON archon_invitations(invited_by); -- Track who sent invitations
CREATE INDEX idx_invitations_composite ON archon_invitations(organization_id, email, status); -- Multi-column query optimization

-- =============================================================================
-- TRIGGERS (Auto-update timestamps + auto-create profiles)
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating updated_at
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON archon_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON archon_user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_organizations_updated_at
    BEFORE UPDATE ON archon_organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_org_members_updated_at
    BEFORE UPDATE ON archon_organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_invitations_updated_at
    BEFORE UPDATE ON archon_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-create user profile when user is created
CREATE OR REPLACE FUNCTION auto_create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO archon_user_profiles (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_profile
    AFTER INSERT ON archon_users
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_user_profile();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- Purpose:
--   - Database-level multi-tenancy enforcement
--   - Users can only access data they own or belong to
--   - Enhanced beyond SportERP (database RLS vs application logic)
--   - Uses auth.uid() for Supabase integration
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE archon_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for archon_users
CREATE POLICY users_select_own
    ON archon_users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY users_update_own
    ON archon_users FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY users_insert_own
    ON archon_users FOR INSERT
    WITH CHECK (id = auth.uid());

-- RLS Policies for archon_user_profiles
CREATE POLICY profiles_select_own
    ON archon_user_profiles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY profiles_update_own
    ON archon_user_profiles FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY profiles_insert_own
    ON archon_user_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- RLS Policies for archon_organizations
CREATE POLICY organizations_select_member
    ON archon_organizations FOR SELECT
    USING (
        id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY organizations_update_owner
    ON archon_organizations FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY organizations_insert_own
    ON archon_organizations FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- RLS Policies for archon_organization_members
CREATE POLICY org_members_select_own_org
    ON archon_organization_members FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY org_members_insert_admin
    ON archon_organization_members FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY org_members_update_admin
    ON archon_organization_members FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY org_members_delete_admin
    ON archon_organization_members FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- RLS Policies for archon_invitations
CREATE POLICY invitations_select_own_org
    ON archon_invitations FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = auth.uid()
        )
        OR email = (SELECT email FROM archon_users WHERE id = auth.uid())
    );

CREATE POLICY invitations_insert_admin
    ON archon_invitations FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY invitations_update_admin_or_invitee
    ON archon_invitations FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id
            FROM archon_organization_members
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
        OR (email = (SELECT email FROM archon_users WHERE id = auth.uid()) AND status = 'pending')
    );

-- =============================================================================
-- SAMPLE DATA (for testing - remove in production)
-- =============================================================================

-- Sample user (password: "password123" - bcrypt hash)
INSERT INTO archon_users (id, email, hashed_password, full_name, is_verified, email_verified_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@archon.dev',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5kuOX1.FYbSVe', -- password123
    'Archon Admin',
    TRUE,
    NOW()
);

-- Sample organization
INSERT INTO archon_organizations (id, name, slug, owner_id, description)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'Archon Team',
    'archon-team',
    'a0000000-0000-0000-0000-000000000001',
    'Official Archon development team'
);

-- Sample organization membership (owner)
INSERT INTO archon_organization_members (organization_id, user_id, role)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'owner'
);

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- Tables created: 5
-- Indexes created: 22
-- Triggers created: 6
-- RLS policies created: 16
-- Sample data: 1 user, 1 org, 1 membership
--
-- Next steps:
--   1. Test RLS policies with different user roles
--   2. Create FastAPI SQLAlchemy models
--   3. Implement JWT authentication endpoints
--   4. Build invitation system API
-- =============================================================================
