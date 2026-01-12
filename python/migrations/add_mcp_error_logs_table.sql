-- Migration: Add MCP Error Logging System
-- Date: 2026-01-12
-- Purpose: Enable real-time error tracking, aggregation, and alerting for MCP operations

-- Create archon_mcp_error_logs table
CREATE TABLE IF NOT EXISTS archon_mcp_error_logs (
    error_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    tool_name VARCHAR(255),
    error_type VARCHAR(50) NOT NULL CHECK (error_type IN ('network', 'database', 'mcp_protocol', 'tool_execution', 'other')),
    error_message TEXT NOT NULL,
    error_details JSONB,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255),
    CONSTRAINT fk_error_session
        FOREIGN KEY (session_id)
        REFERENCES archon_mcp_sessions(session_id)
        ON DELETE CASCADE
);

-- Add indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_mcp_error_logs_timestamp
ON archon_mcp_error_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_error_logs_session_id
ON archon_mcp_error_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_mcp_error_logs_error_type
ON archon_mcp_error_logs(error_type);

CREATE INDEX IF NOT EXISTS idx_mcp_error_logs_severity
ON archon_mcp_error_logs(severity);

CREATE INDEX IF NOT EXISTS idx_mcp_error_logs_unresolved
ON archon_mcp_error_logs(resolved, timestamp DESC)
WHERE resolved = FALSE;

-- Add GIN index for JSONB error_details
CREATE INDEX IF NOT EXISTS idx_mcp_error_logs_details_gin
ON archon_mcp_error_logs USING GIN (error_details);

-- Add comments
COMMENT ON TABLE archon_mcp_error_logs IS 'Stores error logs for MCP operations with categorization and alerting support';
COMMENT ON COLUMN archon_mcp_error_logs.error_id IS 'Unique identifier for the error log entry';
COMMENT ON COLUMN archon_mcp_error_logs.session_id IS 'MCP session that produced this error';
COMMENT ON COLUMN archon_mcp_error_logs.tool_name IS 'MCP tool that was being executed (if applicable)';
COMMENT ON COLUMN archon_mcp_error_logs.error_type IS 'Error category: network, database, mcp_protocol, tool_execution, other';
COMMENT ON COLUMN archon_mcp_error_logs.error_message IS 'Human-readable error message';
COMMENT ON COLUMN archon_mcp_error_logs.error_details IS 'Additional context (stack trace, request payload, etc.)';
COMMENT ON COLUMN archon_mcp_error_logs.severity IS 'Error severity level: low, medium, high, critical';
COMMENT ON COLUMN archon_mcp_error_logs.timestamp IS 'When the error occurred';
COMMENT ON COLUMN archon_mcp_error_logs.resolved IS 'Whether the error has been acknowledged/resolved';
COMMENT ON COLUMN archon_mcp_error_logs.resolved_at IS 'When the error was marked as resolved';
COMMENT ON COLUMN archon_mcp_error_logs.resolved_by IS 'User or system that resolved the error';

-- Create archon_mcp_alerts table for alert management
CREATE TABLE IF NOT EXISTS archon_mcp_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('error_rate', 'error_spike', 'critical_error', 'session_failure')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255)
);

-- Add indexes for alerts
CREATE INDEX IF NOT EXISTS idx_mcp_alerts_status
ON archon_mcp_alerts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_alerts_created_at
ON archon_mcp_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_alerts_severity
ON archon_mcp_alerts(severity);

-- Add GIN index for JSONB metadata
CREATE INDEX IF NOT EXISTS idx_mcp_alerts_metadata_gin
ON archon_mcp_alerts USING GIN (metadata);

-- Add comments
COMMENT ON TABLE archon_mcp_alerts IS 'Stores system alerts generated from error patterns and thresholds';
COMMENT ON COLUMN archon_mcp_alerts.alert_id IS 'Unique identifier for the alert';
COMMENT ON COLUMN archon_mcp_alerts.alert_type IS 'Type of alert: error_rate, error_spike, critical_error, session_failure';
COMMENT ON COLUMN archon_mcp_alerts.severity IS 'Alert severity level';
COMMENT ON COLUMN archon_mcp_alerts.title IS 'Short alert title';
COMMENT ON COLUMN archon_mcp_alerts.message IS 'Detailed alert message';
COMMENT ON COLUMN archon_mcp_alerts.metadata IS 'Additional context (affected sessions, error counts, etc.)';
COMMENT ON COLUMN archon_mcp_alerts.status IS 'Alert status: active, acknowledged, resolved';

-- Add error threshold settings to archon_settings
INSERT INTO archon_settings (key, value, category, description)
VALUES
    ('error_rate_threshold', '5', 'mcp_monitoring', 'Error rate threshold (errors per minute) for generating critical alerts')
ON CONFLICT (key) DO NOTHING;

INSERT INTO archon_settings (key, value, category, description)
VALUES
    ('error_spike_threshold', '3', 'mcp_monitoring', 'Factor increase in error rate to trigger spike alert (e.g., 3x normal rate)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO archon_settings (key, value, category, description)
VALUES
    ('alert_retention_days', '30', 'mcp_monitoring', 'Number of days to retain resolved alerts before cleanup')
ON CONFLICT (key) DO NOTHING;
