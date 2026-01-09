-- =====================================================
-- Migration 0.3.0/014: Add User Context to MCP Sessions
-- =====================================================
-- Description: Adds user tracking fields to archon_mcp_sessions table
--              for multi-user support and usage tracking
-- Author: Archon Multi-User Enhancement
-- Date: 2026-01-09
-- Dependencies: 001_add_mcp_client_tracking.sql
-- =====================================================

-- Add user context columns to archon_mcp_sessions
ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);

ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);

-- Add indexes for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_user_id
    ON archon_mcp_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_user_email
    ON archon_mcp_sessions(user_email);

-- Composite index for user activity tracking
CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_user_activity
    ON archon_mcp_sessions(user_id, last_activity DESC)
    WHERE user_id IS NOT NULL;

-- Update comments
COMMENT ON COLUMN archon_mcp_sessions.user_id IS
'UUID of authenticated user (NULL if user tracking not enabled)';

COMMENT ON COLUMN archon_mcp_sessions.user_email IS
'Email address of authenticated user for identification and reporting';

COMMENT ON COLUMN archon_mcp_sessions.user_name IS
'Display name of authenticated user for UI display';

-- =====================================================
-- Add User Statistics View
-- =====================================================

CREATE OR REPLACE VIEW archon_mcp_user_stats AS
SELECT
    user_id,
    user_email,
    user_name,
    COUNT(*) AS total_sessions,
    COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_sessions,
    COUNT(CASE WHEN status = 'disconnected' THEN 1 END) AS disconnected_sessions,
    AVG(total_duration) AS avg_session_duration_seconds,
    MAX(total_duration) AS max_session_duration_seconds,
    MIN(connected_at) AS first_session_at,
    MAX(last_activity) AS last_activity_at,
    -- Calculate total requests per user
    (
        SELECT COUNT(*)
        FROM archon_mcp_requests r
        WHERE r.session_id IN (
            SELECT session_id
            FROM archon_mcp_sessions s2
            WHERE s2.user_id = s.user_id
        )
    ) AS total_requests,
    -- Calculate total tokens per user
    (
        SELECT COALESCE(SUM(total_tokens), 0)
        FROM archon_mcp_requests r
        WHERE r.session_id IN (
            SELECT session_id
            FROM archon_mcp_sessions s2
            WHERE s2.user_id = s.user_id
        )
    ) AS total_tokens,
    -- Calculate total cost per user
    (
        SELECT COALESCE(SUM(estimated_cost), 0)
        FROM archon_mcp_requests r
        WHERE r.session_id IN (
            SELECT session_id
            FROM archon_mcp_sessions s2
            WHERE s2.user_id = s.user_id
        )
    ) AS total_cost
FROM archon_mcp_sessions s
WHERE user_id IS NOT NULL
GROUP BY user_id, user_email, user_name;

COMMENT ON VIEW archon_mcp_user_stats IS
'Aggregated usage statistics per user for multi-tenant deployments';

-- =====================================================
-- Add Helper Function for User Sessions
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_sessions(
    p_user_id UUID,
    start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    session_id UUID,
    client_type VARCHAR,
    client_version VARCHAR,
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    total_duration INTEGER,
    status VARCHAR,
    disconnect_reason VARCHAR,
    total_requests BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.session_id,
        s.client_type,
        s.client_version,
        s.connected_at,
        s.disconnected_at,
        s.total_duration,
        s.status,
        s.disconnect_reason,
        (
            SELECT COUNT(*)
            FROM archon_mcp_requests r
            WHERE r.session_id = s.session_id
        ) AS total_requests
    FROM archon_mcp_sessions s
    WHERE s.user_id = p_user_id
      AND s.connected_at BETWEEN start_date AND end_date
    ORDER BY s.connected_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_sessions IS
'Returns all sessions for a specific user within a date range with request counts';

-- =====================================================
-- Add Helper Function for User Activity Summary
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_activity_summary(
    p_user_id UUID,
    days INTEGER DEFAULT 30
)
RETURNS TABLE (
    user_id UUID,
    user_email VARCHAR,
    user_name VARCHAR,
    total_sessions BIGINT,
    active_sessions BIGINT,
    total_requests BIGINT,
    total_tokens BIGINT,
    total_cost DECIMAL,
    avg_session_duration INTEGER,
    most_used_client VARCHAR,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH user_data AS (
        SELECT
            s.user_id,
            s.user_email,
            s.user_name,
            s.client_type,
            s.connected_at,
            s.last_activity,
            s.status,
            s.total_duration
        FROM archon_mcp_sessions s
        WHERE s.user_id = p_user_id
          AND s.connected_at >= NOW() - (days || ' days')::INTERVAL
    ),
    client_usage AS (
        SELECT
            client_type,
            COUNT(*) AS usage_count
        FROM user_data
        GROUP BY client_type
        ORDER BY usage_count DESC
        LIMIT 1
    ),
    request_stats AS (
        SELECT
            COUNT(*) AS req_count,
            COALESCE(SUM(r.total_tokens), 0) AS token_count,
            COALESCE(SUM(r.estimated_cost), 0) AS cost_sum
        FROM archon_mcp_requests r
        WHERE r.session_id IN (
            SELECT session_id
            FROM archon_mcp_sessions
            WHERE user_id = p_user_id
              AND connected_at >= NOW() - (days || ' days')::INTERVAL
        )
    )
    SELECT
        ud.user_id,
        ud.user_email,
        ud.user_name,
        COUNT(*)::BIGINT AS total_sessions,
        COUNT(CASE WHEN ud.status = 'active' THEN 1 END)::BIGINT AS active_sessions,
        rs.req_count AS total_requests,
        rs.token_count AS total_tokens,
        rs.cost_sum AS total_cost,
        AVG(ud.total_duration)::INTEGER AS avg_session_duration,
        cu.client_type AS most_used_client,
        MIN(ud.connected_at) AS first_seen,
        MAX(ud.last_activity) AS last_seen
    FROM user_data ud
    CROSS JOIN request_stats rs
    LEFT JOIN client_usage cu ON TRUE
    GROUP BY ud.user_id, ud.user_email, ud.user_name, rs.req_count, rs.token_count, rs.cost_sum, cu.client_type;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_activity_summary IS
'Returns comprehensive activity summary for a specific user over a time period';

-- =====================================================
-- Update Row Level Security Policies
-- =====================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can read their own sessions" ON archon_mcp_sessions;

-- Create policy for user-specific access (for multi-tenant deployments)
-- Note: This policy is optional and disabled by default
-- Enable when implementing user authentication with:
--   ALTER TABLE archon_mcp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own sessions" ON archon_mcp_sessions
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);

-- Keep policy disabled by default for backward compatibility
-- Existing service role policy still allows full access

COMMENT ON POLICY "Users can read their own sessions" ON archon_mcp_sessions IS
'Allows authenticated users to read only their own sessions (enable RLS when ready for multi-user)';

-- =====================================================
-- Data Migration Notes
-- =====================================================

-- No data migration needed - new columns are NULL by default
-- Existing sessions will continue to work without user context
-- Future sessions can optionally include user information

-- To populate user_id for existing sessions (if user data available):
-- UPDATE archon_mcp_sessions
-- SET user_id = '<user-uuid>', user_email = 'user@example.com', user_name = 'User Name'
-- WHERE session_id = '<session-uuid>';

-- =====================================================
-- Record Migration
-- =====================================================

INSERT INTO archon_migrations (version, migration_name, applied_at)
VALUES ('0.3.0', '014_add_user_context_to_sessions', NOW())
ON CONFLICT (version, migration_name) DO UPDATE
    SET applied_at = NOW();

-- =====================================================
-- Verification Queries (for testing)
-- =====================================================

-- View user statistics:
-- SELECT * FROM archon_mcp_user_stats;
--
-- Get sessions for a specific user:
-- SELECT * FROM get_user_sessions('<user-uuid>');
--
-- Get user activity summary:
-- SELECT * FROM get_user_activity_summary('<user-uuid>', 30);
--
-- Check user context in sessions:
-- SELECT
--     session_id,
--     client_type,
--     user_email,
--     user_name,
--     connected_at,
--     status
-- FROM archon_mcp_sessions
-- WHERE user_id IS NOT NULL
-- ORDER BY connected_at DESC
-- LIMIT 10;

-- =====================================================
-- Migration Complete
-- =====================================================
