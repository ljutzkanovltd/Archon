-- =====================================================
-- Migration 0.3.0/001: Add MCP Client Tracking & Token Usage
-- =====================================================
-- Description: Creates tables for MCP client detection, request tracking,
--              and token/cost analytics
-- Author: Archon Enhancement Team
-- Date: 2025-12-24
-- Dependencies: Requires archon_migrations table
-- =====================================================

-- =====================================================
-- 1. MCP Sessions Table (Client Detection)
-- =====================================================

CREATE TABLE IF NOT EXISTS archon_mcp_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_type VARCHAR(50) NOT NULL DEFAULT 'Unknown',
    client_version VARCHAR(50),
    client_capabilities JSONB,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    CONSTRAINT valid_status CHECK (status IN ('active', 'idle', 'disconnected'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_status
    ON archon_mcp_sessions(status);

CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_client_type
    ON archon_mcp_sessions(client_type);

CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_connected_at
    ON archon_mcp_sessions(connected_at DESC);

CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_last_activity
    ON archon_mcp_sessions(last_activity DESC);

-- Composite index for active sessions query
CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_status_activity
    ON archon_mcp_sessions(status, last_activity DESC);

-- Comments
COMMENT ON TABLE archon_mcp_sessions IS 'Tracks connected MCP clients (Claude Code, Cursor, Windsurf, etc.)';
COMMENT ON COLUMN archon_mcp_sessions.session_id IS 'Unique session identifier';
COMMENT ON COLUMN archon_mcp_sessions.client_type IS 'Type of MCP client (Claude, Cursor, Windsurf, Cline, etc.)';
COMMENT ON COLUMN archon_mcp_sessions.client_version IS 'Client version string from initialize request';
COMMENT ON COLUMN archon_mcp_sessions.client_capabilities IS 'Client capabilities from MCP initialize';
COMMENT ON COLUMN archon_mcp_sessions.connected_at IS 'When the client first connected';
COMMENT ON COLUMN archon_mcp_sessions.disconnected_at IS 'When the client disconnected (NULL if still connected)';
COMMENT ON COLUMN archon_mcp_sessions.last_activity IS 'Timestamp of last request from this client';
COMMENT ON COLUMN archon_mcp_sessions.status IS 'Connection status: active, idle (>5min), disconnected';
COMMENT ON COLUMN archon_mcp_sessions.metadata IS 'Additional client information (user-agent, platform, etc.)';

-- =====================================================
-- 2. MCP Requests Table (Token & Cost Tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS archon_mcp_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES archon_mcp_sessions(session_id) ON DELETE CASCADE,
    method VARCHAR(100) NOT NULL,
    tool_name VARCHAR(100),
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
    estimated_cost DECIMAL(10, 6) DEFAULT 0.000000,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    error_message TEXT,
    CONSTRAINT valid_status CHECK (status IN ('success', 'error', 'timeout'))
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_archon_mcp_requests_session_id
    ON archon_mcp_requests(session_id);

CREATE INDEX IF NOT EXISTS idx_archon_mcp_requests_timestamp
    ON archon_mcp_requests(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_archon_mcp_requests_method
    ON archon_mcp_requests(method);

CREATE INDEX IF NOT EXISTS idx_archon_mcp_requests_tool_name
    ON archon_mcp_requests(tool_name);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_archon_mcp_requests_session_time
    ON archon_mcp_requests(session_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_archon_mcp_requests_method_time
    ON archon_mcp_requests(method, timestamp DESC);

-- Comments
COMMENT ON TABLE archon_mcp_requests IS 'Tracks all MCP requests with token usage and cost';
COMMENT ON COLUMN archon_mcp_requests.request_id IS 'Unique request identifier';
COMMENT ON COLUMN archon_mcp_requests.session_id IS 'Reference to the MCP session that made this request';
COMMENT ON COLUMN archon_mcp_requests.method IS 'MCP method called (tools/list, tools/call, resources/read, etc.)';
COMMENT ON COLUMN archon_mcp_requests.tool_name IS 'Name of tool if method is tools/call';
COMMENT ON COLUMN archon_mcp_requests.prompt_tokens IS 'Number of input tokens';
COMMENT ON COLUMN archon_mcp_requests.completion_tokens IS 'Number of output tokens';
COMMENT ON COLUMN archon_mcp_requests.total_tokens IS 'Total tokens (auto-calculated)';
COMMENT ON COLUMN archon_mcp_requests.estimated_cost IS 'Estimated cost in USD based on archon_llm_pricing';
COMMENT ON COLUMN archon_mcp_requests.timestamp IS 'When the request was made';
COMMENT ON COLUMN archon_mcp_requests.duration_ms IS 'Request duration in milliseconds';
COMMENT ON COLUMN archon_mcp_requests.status IS 'Request status: success, error, timeout';
COMMENT ON COLUMN archon_mcp_requests.error_message IS 'Error details if status is error';

-- =====================================================
-- 3. LLM Pricing Table
-- =====================================================

CREATE TABLE IF NOT EXISTS archon_llm_pricing (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    input_price_per_1k DECIMAL(10, 6) NOT NULL,
    output_price_per_1k DECIMAL(10, 6) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    CONSTRAINT unique_model_provider_date UNIQUE (model_name, provider, effective_date)
);

-- Index for price lookups
CREATE INDEX IF NOT EXISTS idx_archon_llm_pricing_model_provider
    ON archon_llm_pricing(model_name, provider, effective_date DESC);

-- Comments
COMMENT ON TABLE archon_llm_pricing IS 'LLM pricing data for cost estimation';
COMMENT ON COLUMN archon_llm_pricing.model_name IS 'Model identifier (e.g., gpt-4, claude-3-5-sonnet-20241022)';
COMMENT ON COLUMN archon_llm_pricing.provider IS 'Provider (OpenAI, Anthropic)';
COMMENT ON COLUMN archon_llm_pricing.input_price_per_1k IS 'Input token price per 1,000 tokens (USD)';
COMMENT ON COLUMN archon_llm_pricing.output_price_per_1k IS 'Output token price per 1,000 tokens (USD)';
COMMENT ON COLUMN archon_llm_pricing.effective_date IS 'Date when this pricing became effective';
COMMENT ON COLUMN archon_llm_pricing.notes IS 'Additional pricing information or context';

-- =====================================================
-- 4. Seed Pricing Data (Current as of Dec 2024)
-- =====================================================

INSERT INTO archon_llm_pricing (model_name, provider, input_price_per_1k, output_price_per_1k, effective_date, notes)
VALUES
    -- OpenAI Models
    ('gpt-4', 'OpenAI', 0.030, 0.060, '2024-01-01', 'GPT-4 base model'),
    ('gpt-4-turbo', 'OpenAI', 0.010, 0.030, '2024-01-01', 'GPT-4 Turbo'),
    ('gpt-4o', 'OpenAI', 0.0025, 0.010, '2024-05-13', 'GPT-4o'),
    ('gpt-4o-mini', 'OpenAI', 0.00015, 0.0006, '2024-07-18', 'GPT-4o Mini'),
    ('gpt-3.5-turbo', 'OpenAI', 0.0005, 0.0015, '2023-11-06', 'GPT-3.5 Turbo'),

    -- Anthropic Models
    ('claude-3-5-sonnet-20241022', 'Anthropic', 0.003, 0.015, '2024-10-22', 'Claude 3.5 Sonnet (Latest)'),
    ('claude-3-5-sonnet-20240620', 'Anthropic', 0.003, 0.015, '2024-06-20', 'Claude 3.5 Sonnet (Legacy)'),
    ('claude-3-5-haiku-20241022', 'Anthropic', 0.001, 0.005, '2024-11-04', 'Claude 3.5 Haiku'),
    ('claude-3-opus-20240229', 'Anthropic', 0.015, 0.075, '2024-02-29', 'Claude 3 Opus'),
    ('claude-3-sonnet-20240229', 'Anthropic', 0.003, 0.015, '2024-02-29', 'Claude 3 Sonnet'),
    ('claude-3-haiku-20240307', 'Anthropic', 0.00025, 0.00125, '2024-03-07', 'Claude 3 Haiku')
ON CONFLICT (model_name, provider, effective_date) DO NOTHING;

-- =====================================================
-- 5. Helper Functions
-- =====================================================

-- Function to get active MCP clients
CREATE OR REPLACE FUNCTION get_active_mcp_clients()
RETURNS TABLE (
    session_id UUID,
    client_type VARCHAR,
    client_version VARCHAR,
    connected_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.session_id,
        s.client_type,
        s.client_version,
        s.connected_at,
        s.last_activity,
        s.status
    FROM archon_mcp_sessions s
    WHERE s.status IN ('active', 'idle')
      AND s.disconnected_at IS NULL
    ORDER BY s.last_activity DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_mcp_clients IS
'Returns all currently connected MCP clients';

-- Function to get usage summary
CREATE OR REPLACE FUNCTION get_mcp_usage_summary(
    start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_requests BIGINT,
    total_prompt_tokens BIGINT,
    total_completion_tokens BIGINT,
    total_tokens BIGINT,
    total_cost DECIMAL,
    unique_sessions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT,
        SUM(prompt_tokens)::BIGINT,
        SUM(completion_tokens)::BIGINT,
        SUM(total_tokens)::BIGINT,
        SUM(estimated_cost)::DECIMAL,
        COUNT(DISTINCT session_id)::BIGINT
    FROM archon_mcp_requests
    WHERE timestamp BETWEEN start_date AND end_date
      AND status = 'success';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_mcp_usage_summary IS
'Returns aggregated MCP usage statistics for a date range';

-- Function to get usage by tool
CREATE OR REPLACE FUNCTION get_mcp_usage_by_tool(
    start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    tool_name VARCHAR,
    request_count BIGINT,
    total_tokens BIGINT,
    total_cost DECIMAL,
    avg_duration_ms DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.tool_name,
        COUNT(*)::BIGINT,
        SUM(r.total_tokens)::BIGINT,
        SUM(r.estimated_cost)::DECIMAL,
        AVG(r.duration_ms)::DECIMAL
    FROM archon_mcp_requests r
    WHERE r.timestamp BETWEEN start_date AND end_date
      AND r.status = 'success'
      AND r.tool_name IS NOT NULL
    GROUP BY r.tool_name
    ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_mcp_usage_by_tool IS
'Returns usage statistics grouped by MCP tool';

-- Function to calculate request cost
CREATE OR REPLACE FUNCTION calculate_request_cost(
    model_name_param VARCHAR,
    provider_param VARCHAR,
    prompt_tokens_param INTEGER,
    completion_tokens_param INTEGER
)
RETURNS DECIMAL AS $$
DECLARE
    input_price DECIMAL;
    output_price DECIMAL;
    total_cost DECIMAL;
BEGIN
    -- Get the most recent pricing for this model
    SELECT input_price_per_1k, output_price_per_1k
    INTO input_price, output_price
    FROM archon_llm_pricing
    WHERE model_name = model_name_param
      AND provider = provider_param
    ORDER BY effective_date DESC
    LIMIT 1;

    -- If pricing not found, return 0
    IF input_price IS NULL THEN
        RETURN 0.000000;
    END IF;

    -- Calculate cost: (tokens / 1000) * price_per_1k
    total_cost :=
        (prompt_tokens_param::DECIMAL / 1000.0 * input_price) +
        (completion_tokens_param::DECIMAL / 1000.0 * output_price);

    RETURN ROUND(total_cost, 6);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_request_cost IS
'Calculates the estimated cost for a request based on current pricing';

-- =====================================================
-- 6. Trigger to Auto-Update Session Status
-- =====================================================

CREATE OR REPLACE FUNCTION update_session_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_activity on the session
    UPDATE archon_mcp_sessions
    SET last_activity = NEW.timestamp,
        status = CASE
            WHEN NEW.timestamp > NOW() - INTERVAL '5 minutes' THEN 'active'
            WHEN NEW.timestamp > NOW() - INTERVAL '1 hour' THEN 'idle'
            ELSE 'idle'
        END
    WHERE session_id = NEW.session_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_session_status IS
'Trigger function that updates session status and last_activity on each request';

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_session_status ON archon_mcp_requests;

CREATE TRIGGER trigger_update_session_status
    AFTER INSERT ON archon_mcp_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_session_status();

COMMENT ON TRIGGER trigger_update_session_status ON archon_mcp_requests IS
'Automatically updates session last_activity and status when requests are logged';

-- =====================================================
-- 7. Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE archon_mcp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_mcp_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_llm_pricing ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Allow service role full access to archon_mcp_sessions" ON archon_mcp_sessions;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_mcp_sessions" ON archon_mcp_sessions;
DROP POLICY IF EXISTS "Allow service role full access to archon_mcp_requests" ON archon_mcp_requests;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_mcp_requests" ON archon_mcp_requests;
DROP POLICY IF EXISTS "Allow service role full access to archon_llm_pricing" ON archon_llm_pricing;
DROP POLICY IF EXISTS "Allow authenticated users to read archon_llm_pricing" ON archon_llm_pricing;

-- MCP Sessions policies
CREATE POLICY "Allow service role full access to archon_mcp_sessions" ON archon_mcp_sessions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_mcp_sessions" ON archon_mcp_sessions
    FOR SELECT TO authenticated
    USING (true);

-- MCP Requests policies
CREATE POLICY "Allow service role full access to archon_mcp_requests" ON archon_mcp_requests
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_mcp_requests" ON archon_mcp_requests
    FOR SELECT TO authenticated
    USING (true);

-- LLM Pricing policies
CREATE POLICY "Allow service role full access to archon_llm_pricing" ON archon_llm_pricing
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read archon_llm_pricing" ON archon_llm_pricing
    FOR SELECT TO authenticated
    USING (true);

-- =====================================================
-- 8. Record Migration
-- =====================================================

-- Self-record this migration
INSERT INTO archon_migrations (version, migration_name)
VALUES ('0.3.0', '001_add_mcp_client_tracking')
ON CONFLICT (version, migration_name) DO NOTHING;

-- =====================================================
-- Verification Queries (for testing)
-- =====================================================
-- Test client detection:
-- INSERT INTO archon_mcp_sessions (client_type, client_version)
-- VALUES ('Claude Code', '1.0.0');
--
-- Test request tracking:
-- INSERT INTO archon_mcp_requests (session_id, method, tool_name, prompt_tokens, completion_tokens)
-- VALUES ('<session-uuid>', 'tools/call', 'rag_search_knowledge_base', 150, 300);
--
-- View active clients:
-- SELECT * FROM get_active_mcp_clients();
--
-- View usage summary:
-- SELECT * FROM get_mcp_usage_summary();
--
-- View usage by tool:
-- SELECT * FROM get_mcp_usage_by_tool();
--
-- Calculate cost example:
-- SELECT calculate_request_cost('claude-3-5-sonnet-20241022', 'Anthropic', 1000, 2000);
--
-- View all pricing:
-- SELECT * FROM archon_llm_pricing ORDER BY provider, model_name;

-- =====================================================
-- Migration complete
-- =====================================================
