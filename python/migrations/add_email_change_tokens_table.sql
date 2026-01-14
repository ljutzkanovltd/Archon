-- Migration: Add archon_email_change_tokens table
-- Description: Create table for email change verification tokens
-- Author: Archon Team
-- Date: 2026-01-14

-- Create archon_email_change_tokens table
CREATE TABLE IF NOT EXISTS archon_email_change_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    new_email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_email CHECK (new_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_token_length CHECK (LENGTH(token) >= 32),
    CONSTRAINT expires_after_creation CHECK (expires_at > created_at),
    CONSTRAINT used_after_creation CHECK (used_at IS NULL OR used_at >= created_at),

    -- Foreign key
    CONSTRAINT archon_email_change_tokens_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES archon_users(id)
        ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_email_change_tokens_user_id ON archon_email_change_tokens(user_id);
CREATE INDEX idx_email_change_tokens_token ON archon_email_change_tokens(token) WHERE used_at IS NULL;
CREATE INDEX idx_email_change_tokens_expires_at ON archon_email_change_tokens(expires_at);
CREATE INDEX idx_email_change_tokens_used_at ON archon_email_change_tokens(used_at);
CREATE INDEX idx_email_change_tokens_new_email ON archon_email_change_tokens(new_email);

-- Create composite index for active tokens
CREATE INDEX idx_email_change_tokens_active
    ON archon_email_change_tokens(user_id, expires_at, used_at)
    WHERE used_at IS NULL;

-- Add trigger for updated_at timestamp
CREATE OR REPLACE TRIGGER trigger_email_change_tokens_updated_at
    BEFORE UPDATE ON archon_email_change_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE archon_email_change_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own email change tokens
CREATE POLICY email_change_tokens_select_own
    ON archon_email_change_tokens
    FOR SELECT
    USING (user_id = auth.uid());

-- Add comment to table
COMMENT ON TABLE archon_email_change_tokens IS 'Stores tokens for email change verification process';
COMMENT ON COLUMN archon_email_change_tokens.new_email IS 'The new email address being verified';
COMMENT ON COLUMN archon_email_change_tokens.token IS 'Unique verification token (min 32 chars)';
COMMENT ON COLUMN archon_email_change_tokens.expires_at IS 'Token expiration timestamp (typically 1 hour)';
COMMENT ON COLUMN archon_email_change_tokens.used_at IS 'Timestamp when token was used (NULL if unused)';
