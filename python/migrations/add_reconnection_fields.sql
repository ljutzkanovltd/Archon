-- Migration: Add Session Reconnection Support
-- Date: 2026-01-11
-- Purpose: Enable JWT-based session reconnection for MCP clients

-- Add reconnection support fields to archon_mcp_sessions
ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS reconnect_token_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS reconnect_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reconnect_count INTEGER DEFAULT 0;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_token_hash
ON archon_mcp_sessions(reconnect_token_hash);

-- Add index for reconnection stats
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_reconnect_count
ON archon_mcp_sessions(reconnect_count)
WHERE reconnect_count > 0;

-- Add comment
COMMENT ON COLUMN archon_mcp_sessions.reconnect_token_hash IS 'SHA-256 hash of JWT reconnection token';
COMMENT ON COLUMN archon_mcp_sessions.reconnect_expires_at IS 'Token expiration timestamp (typically 15 minutes from creation)';
COMMENT ON COLUMN archon_mcp_sessions.reconnect_count IS 'Number of times this session has been reconnected';
