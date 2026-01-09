-- =====================================================
-- HOTFIX: Add Missing Functions and Views (Migrations 013 & 014)
-- =====================================================
-- Run AFTER HOTFIX_add_missing_columns.sql
-- =====================================================

-- =====================================================
-- Migration 013 Functions & Views
-- =====================================================

-- Function: get_disconnected_sessions
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

-- View: archon_mcp_session_stats
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

-- =====================================================
-- Migration 014 Functions & Views
-- =====================================================

-- View: archon_mcp_user_stats
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
    (
        SELECT COUNT(*)
        FROM archon_mcp_requests r
        WHERE r.session_id IN (
            SELECT session_id
            FROM archon_mcp_sessions s2
            WHERE s2.user_id = s.user_id
        )
    ) AS total_requests,
    (
        SELECT COALESCE(SUM(total_tokens), 0)
        FROM archon_mcp_requests r
        WHERE r.session_id IN (
            SELECT session_id
            FROM archon_mcp_sessions s2
            WHERE s2.user_id = s.user_id
        )
    ) AS total_tokens,
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

-- Function: get_user_sessions
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

-- Function: get_user_activity_summary
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

-- =====================================================
-- Verify Everything Was Created
-- =====================================================

-- Check functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
    'get_disconnected_sessions',
    'get_user_sessions',
    'get_user_activity_summary',
    'get_active_mcp_clients'
)
ORDER BY routine_name;

-- Check views
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name IN ('archon_mcp_session_stats', 'archon_mcp_user_stats')
ORDER BY table_name;
