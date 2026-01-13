-- Migration: 034_add_password_reset_tokens.sql
-- Description: Add password reset tokens table for password recovery workflow
-- Author: Archon Team
-- Date: 2026-01-13

-- ==============================================================================
-- Password Reset Tokens Table
-- ==============================================================================
-- Stores temporary tokens for password reset requests with expiration

CREATE TABLE IF NOT EXISTS public.archon_password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.archon_users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,  -- IPv4 (15) or IPv6 (45)
    user_agent TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_token_length CHECK (LENGTH(token) >= 32),
    CONSTRAINT expires_after_creation CHECK (expires_at > created_at),
    CONSTRAINT used_after_creation CHECK (used_at IS NULL OR used_at >= created_at)
);

-- ==============================================================================
-- Indexes for Performance
-- ==============================================================================

-- Primary lookup by token (most common query)
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token
    ON public.archon_password_reset_tokens(token)
    WHERE used_at IS NULL;

-- Lookup tokens by user (for listing user's reset requests)
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
    ON public.archon_password_reset_tokens(user_id);

-- Cleanup expired/used tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
    ON public.archon_password_reset_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used_at
    ON public.archon_password_reset_tokens(used_at);

-- Composite index for active tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active
    ON public.archon_password_reset_tokens(user_id, expires_at, used_at)
    WHERE used_at IS NULL;

-- ==============================================================================
-- Triggers
-- ==============================================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER trigger_password_reset_tokens_updated_at
    BEFORE UPDATE ON public.archon_password_reset_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.archon_password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view their own password reset tokens
CREATE POLICY password_reset_tokens_select_own
    ON public.archon_password_reset_tokens
    FOR SELECT
    USING (user_id = auth.uid());

-- Users cannot directly insert/update/delete tokens (must use API)
-- Tokens are managed exclusively through backend API for security

-- ==============================================================================
-- Cleanup Function
-- ==============================================================================
-- Function to clean up expired and old used tokens

CREATE OR REPLACE FUNCTION cleanup_password_reset_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete tokens that are:
    -- 1. Expired for more than 7 days
    -- 2. Used and older than 7 days
    DELETE FROM public.archon_password_reset_tokens
    WHERE
        (expires_at < NOW() - INTERVAL '7 days')
        OR
        (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '7 days');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$;

-- ==============================================================================
-- Comments
-- ==============================================================================

COMMENT ON TABLE public.archon_password_reset_tokens IS
    'Stores password reset tokens for user password recovery workflow. Tokens expire after 1 hour by default.';

COMMENT ON COLUMN public.archon_password_reset_tokens.token IS
    'Unique random token (UUID format) sent to user via email';

COMMENT ON COLUMN public.archon_password_reset_tokens.expires_at IS
    'Token expiration timestamp (typically 1 hour from creation)';

COMMENT ON COLUMN public.archon_password_reset_tokens.used_at IS
    'Timestamp when token was used to reset password (NULL if unused)';

COMMENT ON COLUMN public.archon_password_reset_tokens.ip_address IS
    'IP address of request that created the token (for security audit)';

COMMENT ON COLUMN public.archon_password_reset_tokens.user_agent IS
    'User agent of request that created the token (for security audit)';

COMMENT ON FUNCTION cleanup_password_reset_tokens() IS
    'Cleanup function to remove expired and old used tokens. Run via cron job or scheduled task.';

-- ==============================================================================
-- Grant Permissions
-- ==============================================================================

-- Grant access to authenticated users (through RLS policies)
GRANT SELECT ON public.archon_password_reset_tokens TO authenticated;

-- Grant full access to service role for backend API
GRANT ALL ON public.archon_password_reset_tokens TO service_role;

-- ==============================================================================
-- Verification
-- ==============================================================================

DO $$
BEGIN
    -- Verify table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'archon_password_reset_tokens'
    ) THEN
        RAISE EXCEPTION 'Table archon_password_reset_tokens was not created';
    END IF;

    -- Verify indexes exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'archon_password_reset_tokens'
        AND indexname = 'idx_password_reset_tokens_token'
    ) THEN
        RAISE EXCEPTION 'Index idx_password_reset_tokens_token was not created';
    END IF;

    -- Verify RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'archon_password_reset_tokens'
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS is not enabled on archon_password_reset_tokens';
    END IF;

    RAISE NOTICE 'Migration 034_add_password_reset_tokens.sql completed successfully';
END $$;
