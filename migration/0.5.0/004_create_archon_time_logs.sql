-- =====================================================
-- Migration: Create archon_time_logs Table
-- Version: 0.5.0
-- Date: 2026-01-15
-- Description: Add time logging table for task time tracking
--              Supports manual time entries and automatic rollup to tasks
-- =====================================================

-- Create archon_time_logs table
CREATE TABLE IF NOT EXISTS archon_time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES archon_tasks(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL, -- Who logged the time
    hours DECIMAL(10,2) NOT NULL, -- Time spent in hours
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this work was done
    description TEXT, -- What was accomplished
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CHECK (hours > 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_archon_time_logs_task
    ON archon_time_logs(task_id);

CREATE INDEX IF NOT EXISTS idx_archon_time_logs_user
    ON archon_time_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_archon_time_logs_logged_at
    ON archon_time_logs(logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_archon_time_logs_task_logged_at
    ON archon_time_logs(task_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_archon_time_logs_user_logged_at
    ON archon_time_logs(user_id, logged_at DESC);

-- Add comments
COMMENT ON TABLE archon_time_logs IS 'Time tracking entries for tasks';
COMMENT ON COLUMN archon_time_logs.hours IS 'Time spent in hours (decimal for precision, e.g., 1.5 = 1h 30m)';
COMMENT ON COLUMN archon_time_logs.logged_at IS 'Timestamp when the work was performed';
COMMENT ON COLUMN archon_time_logs.description IS 'Description of work performed during this time';

-- Add migration record
INSERT INTO archon_migrations (version, migration_name)
VALUES ('0.5.0', '004_create_archon_time_logs')
ON CONFLICT (version, migration_name) DO NOTHING;
