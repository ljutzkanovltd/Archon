-- Migration: Add archon_sync_history Table
-- Version: 032
-- Purpose: Track database synchronization operations for audit and monitoring
-- Date: 2026-01-12

BEGIN;

-- Create archon_sync_history table
CREATE TABLE IF NOT EXISTS archon_sync_history (
    -- Primary identification
    sync_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Sync configuration
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('local-to-remote', 'remote-to-local')),

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    phase VARCHAR(30) NOT NULL DEFAULT 'validation'
        CHECK (phase IN ('validation', 'export', 'preparation', 'import', 'finalization', 'verification')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

    -- Verification and error tracking
    verification_details JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    error_details JSONB,

    -- Timing and metrics
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,

    -- Audit tracking
    initiated_by VARCHAR(100) DEFAULT 'system',

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_history_status
    ON archon_sync_history (status);

CREATE INDEX IF NOT EXISTS idx_sync_history_direction
    ON archon_sync_history (direction);

CREATE INDEX IF NOT EXISTS idx_sync_history_started_at
    ON archon_sync_history (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_history_status_direction
    ON archon_sync_history (status, direction);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_archon_sync_history_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_sync_history_updated_at
    BEFORE UPDATE ON archon_sync_history
    FOR EACH ROW
    EXECUTE FUNCTION update_archon_sync_history_updated_at();

-- Add comment to table
COMMENT ON TABLE archon_sync_history IS 'Tracks database synchronization operations between local and remote databases';
COMMENT ON COLUMN archon_sync_history.sync_id IS 'Unique identifier for each sync operation';
COMMENT ON COLUMN archon_sync_history.direction IS 'Sync direction: local-to-remote (backup) or remote-to-local (restore)';
COMMENT ON COLUMN archon_sync_history.status IS 'Current status: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN archon_sync_history.phase IS 'Current phase: validation, export, preparation, import, finalization, verification';
COMMENT ON COLUMN archon_sync_history.progress IS 'Progress percentage (0-100)';
COMMENT ON COLUMN archon_sync_history.verification_details IS 'JSONB object containing verification results after sync completion';
COMMENT ON COLUMN archon_sync_history.error_message IS 'Error message if sync failed';
COMMENT ON COLUMN archon_sync_history.error_details IS 'JSONB object containing detailed error information';
COMMENT ON COLUMN archon_sync_history.duration_seconds IS 'Total sync duration in seconds';
COMMENT ON COLUMN archon_sync_history.initiated_by IS 'User or system that initiated the sync';

COMMIT;
