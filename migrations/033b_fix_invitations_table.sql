-- =============================================================================
-- Migration 033b: Fix Invitations Table (Corrective Migration)
-- =============================================================================
-- Date: 2026-01-13
-- Author: database-expert
-- Related: Migration 033 (partial failure)
--
-- Purpose:
--   Fix the archon_invitations table creation that failed in migration 033
--   due to syntax error with UNIQUE NULLS NOT DISTINCT ... WHERE clause.
--
-- Root Cause:
--   PostgreSQL doesn't support UNIQUE constraint with WHERE clause in CREATE TABLE.
--   Must create as separate partial unique index instead.
--
-- Changes:
--   1. Create archon_invitations table (without problematic constraint)
--   2. Create partial unique index for pending invitations
--   3. Create missing indexes for archon_invitations
--   4. Create missing trigger for archon_invitations
--   5. Enable RLS and create policies for archon_invitations
-- =============================================================================

-- =============================================================================
-- TABLE: archon_invitations (Token-Based Invitation System)
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
    )
);

COMMENT ON TABLE archon_invitations IS 'Token-based invitation system with magic links';
COMMENT ON COLUMN archon_invitations.token IS 'SHA256 hex token (64 chars) for magic link';
COMMENT ON COLUMN archon_invitations.expires_at IS 'Default 7 days from creation';
COMMENT ON CONSTRAINT accepted_logic ON archon_invitations IS 'Ensure accepted status has timestamps';

-- =============================================================================
-- PARTIAL UNIQUE INDEX (replaces failed UNIQUE constraint)
-- =============================================================================
-- Purpose: Only one pending invitation per email per organization
-- This is the correct way to implement UNIQUE ... WHERE in PostgreSQL

CREATE UNIQUE INDEX idx_invitations_unique_pending
    ON archon_invitations(organization_id, email)
    WHERE status = 'pending';

COMMENT ON INDEX idx_invitations_unique_pending IS 'Ensure only one pending invitation per email per org';

-- =============================================================================
-- INDEXES (7 total for archon_invitations)
-- =============================================================================

CREATE INDEX idx_invitations_token ON archon_invitations(token); -- Magic link lookup (UNIQUE already creates index)
CREATE INDEX idx_invitations_email ON archon_invitations(email); -- Find invitations by email
CREATE INDEX idx_invitations_org_id ON archon_invitations(organization_id); -- Find invitations for org
CREATE INDEX idx_invitations_status ON archon_invitations(status) WHERE status = 'pending'; -- Filter pending invitations (partial)
CREATE INDEX idx_invitations_expires_at ON archon_invitations(expires_at) WHERE status = 'pending'; -- Cleanup expired invitations (partial)
CREATE INDEX idx_invitations_invited_by ON archon_invitations(invited_by); -- Track who sent invitations
CREATE INDEX idx_invitations_composite ON archon_invitations(organization_id, email, status); -- Multi-column query optimization

-- =============================================================================
-- TRIGGER (Auto-update timestamp)
-- =============================================================================

CREATE TRIGGER trigger_invitations_updated_at
    BEFORE UPDATE ON archon_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE archon_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Select invitations for own organization or own email
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

-- Policy: Insert invitations (admins/owners only)
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

-- Policy: Update invitations (admins/owners or invitee accepting)
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
-- VERIFICATION
-- =============================================================================

-- Verify table was created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'archon_invitations') THEN
        RAISE NOTICE 'SUCCESS: archon_invitations table created';
    ELSE
        RAISE EXCEPTION 'FAILED: archon_invitations table not found';
    END IF;
END $$;

-- Verify partial unique index
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invitations_unique_pending') THEN
        RAISE NOTICE 'SUCCESS: Partial unique index created';
    ELSE
        RAISE EXCEPTION 'FAILED: Partial unique index not found';
    END IF;
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- Corrective actions:
--   ✅ archon_invitations table created
--   ✅ Partial unique index created (org_id, email WHERE status='pending')
--   ✅ 7 indexes created
--   ✅ 1 trigger created
--   ✅ 3 RLS policies created
--
-- Total User Management System:
--   5 tables (all created successfully)
--   3 ENUMs
--   22 indexes
--   6 triggers
--   16 RLS policies
-- =============================================================================
