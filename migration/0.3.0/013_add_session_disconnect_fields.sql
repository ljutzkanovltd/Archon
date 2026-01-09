-- =====================================================
-- Migration 0.3.0/013: Add Session Disconnect Fields
-- =====================================================
-- Description: Adds total_duration and disconnect_reason fields
--              to archon_mcp_sessions for session cleanup tracking
-- Author: Archon Session Tracking Enhancement
-- Date: 2026-01-09
-- Dependencies: 001_add_mcp_client_tracking.sql
-- =====================================================

-- Add total_duration column (session duration in seconds)
ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS total_duration INTEGER;

-- Add disconnect_reason column
ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS disconnect_reason VARCHAR(100);

-- Add index for disconnect_reason
CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_disconnect_reason
    ON archon_mcp_sessions(disconnect_reason);

-- Update comments
COMMENT ON COLUMN archon_mcp_sessions.total_duration IS
'Total session duration in seconds (calculated when session is closed)';

COMMENT ON COLUMN archon_mcp_sessions.disconnect_reason IS
'Reason for disconnect: client_disconnect, timeout, server_shutdown, or error:<ErrorType>';

-- =====================================================
-- Update Helper Function to Include New Fields
-- =====================================================

-- Drop and recreate get_active_mcp_clients function with new columns
DROP FUNCTION IF EXISTS get_active_mcp_clients();

CREATE OR REPLACE FUNCTION get_active_mcp_clients()
RETURNS TABLE (
    session_id UUID,
    client_type VARCHAR,
    client_version VARCHAR,
    connected_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ,
    total_duration INTEGER,
    status VARCHAR,
    disconnect_reason VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.session_id,
        s.client_type,
        s.client_version,
        s.connected_at,
        s.last_activity,
        s.total_duration,
        s.status,
        s.disconnect_reason
    FROM archon_mcp_sessions s
    WHERE s.status IN ('active', 'idle')
      AND s.disconnected_at IS NULL
    ORDER BY s.last_activity DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_mcp_clients IS
'Returns all currently connected MCP clients with duration and disconnect info';

-- =====================================================
-- Add Helper Function for Disconnected Sessions
-- =====================================================

CREATE OR REPLACE FUNCTION get_disconnected_sessions(
    start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
    end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    session_id UUID,
    client_type VARCHAR,
    client_version VARCHAR,
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    total_duration INTEGER,
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
        s.disconnect_reason,
        (
            SELECT COUNT(*)
            FROM archon_mcp_requests r
            WHERE r.session_id = s.session_id
        ) AS total_requests
    FROM archon_mcp_sessions s
    WHERE s.status = 'disconnected'
      AND s.disconnected_at BETWEEN start_date AND end_date
    ORDER BY s.disconnected_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_disconnected_sessions IS
'Returns disconnected sessions within a date range with duration and request count';

-- =====================================================
-- Add Session Statistics View
-- =====================================================

CREATE OR REPLACE VIEW archon_mcp_session_stats AS
SELECT
    client_type,
    COUNT(*) AS total_sessions,
    COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_sessions,
    COUNT(CASE WHEN status = 'disconnected' THEN 1 END) AS disconnected_sessions,
    AVG(total_duration) AS avg_duration_seconds,
    MAX(total_duration) AS max_duration_seconds,
    COUNT(CASE WHEN disconnect_reason = 'timeout' THEN 1 END) AS timeout_disconnects,
    COUNT(CASE WHEN disconnect_reason = 'client_disconnect' THEN 1 END) AS client_disconnects,
    COUNT(CASE WHEN disconnect_reason = 'server_shutdown' THEN 1 END) AS server_shutdown_disconnects,
    COUNT(CASE WHEN disconnect_reason LIKE 'error:%' THEN 1 END) AS error_disconnects
FROM archon_mcp_sessions
GROUP BY client_type;

COMMENT ON VIEW archon_mcp_session_stats IS
'Aggregated statistics about MCP sessions by client type';

-- =====================================================
-- Populate total_duration for Existing Disconnected Sessions
-- =====================================================

-- Update disconnected sessions that don't have duration calculated
UPDATE archon_mcp_sessions
SET total_duration = EXTRACT(EPOCH FROM (disconnected_at - connected_at))::INTEGER
WHERE status = 'disconnected'
  AND disconnected_at IS NOT NULL
  AND total_duration IS NULL;

-- =====================================================
-- Record Migration
-- =====================================================

INSERT INTO archon_migrations (version, migration_name, applied_at)
VALUES ('0.3.0', '013_add_session_disconnect_fields', NOW())
ON CONFLICT (version, migration_name) DO UPDATE
    SET applied_at = NOW();

-- =====================================================
-- Verification Queries (for testing)
-- =====================================================

-- View session statistics:
-- SELECT * FROM archon_mcp_session_stats;
--
-- View disconnected sessions from last 24 hours:
-- SELECT * FROM get_disconnected_sessions(NOW() - INTERVAL '24 hours', NOW());
--
-- Check total_duration calculation:
-- SELECT
--     session_id,
--     client_type,
--     connected_at,
--     disconnected_at,
--     total_duration,
--     disconnect_reason
-- FROM archon_mcp_sessions
-- WHERE status = 'disconnected'
-- ORDER BY disconnected_at DESC
-- LIMIT 10;

-- =====================================================
-- Migration Complete
-- =====================================================
