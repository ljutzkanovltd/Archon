-- Migration: Add archon_sync_history table for bidirectional database sync tracking
-- Version: 0.3.0
-- Date: 2026-01-12
-- Purpose: Track sync operations between local and remote databases

-- ============================================================================
-- TABLE: archon_sync_history
-- ============================================================================
-- Stores complete history of all database sync operations with progress tracking

CREATE TABLE IF NOT EXISTS archon_sync_history (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_id TEXT UNIQUE NOT NULL,

  -- Sync metadata
  direction TEXT NOT NULL CHECK (direction IN ('local-to-remote', 'remote-to-local', 'bidirectional')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Progress tracking
  total_rows INTEGER,
  synced_rows INTEGER,
  current_table TEXT,
  current_phase TEXT, -- 'validation', 'export', 'import', 'indexing', 'verification'
  percent_complete INTEGER DEFAULT 0 CHECK (percent_complete >= 0 AND percent_complete <= 100),

  -- Results
  tables_synced JSONB DEFAULT '[]'::jsonb, -- Array of {table_name, row_count, duration_seconds}
  verification_results JSONB DEFAULT '{}'::jsonb, -- Row count comparisons per table
  error_message TEXT,
  error_details JSONB DEFAULT '{}'::jsonb,

  -- Performance metrics
  export_size_mb NUMERIC(10, 2),
  import_duration_seconds INTEGER,
  export_duration_seconds INTEGER,
  indexing_duration_seconds INTEGER,

  -- Metadata
  triggered_by TEXT DEFAULT 'User',
  backup_file_path TEXT,
  source_db TEXT, -- 'local' or 'remote'
  target_db TEXT, -- 'local' or 'remote'
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for recent sync history queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_sync_history_started
  ON archon_sync_history(started_at DESC);

-- Index for filtering by status (for active sync monitoring)
CREATE INDEX IF NOT EXISTS idx_sync_history_status
  ON archon_sync_history(status)
  WHERE status IN ('running', 'failed');

-- Index for direction-based queries
CREATE INDEX IF NOT EXISTS idx_sync_history_direction
  ON archon_sync_history(direction, started_at DESC);

-- Index for finding syncs by triggered_by
CREATE INDEX IF NOT EXISTS idx_sync_history_triggered_by
  ON archon_sync_history(triggered_by, started_at DESC);

-- GIN index for JSONB metadata searches
CREATE INDEX IF NOT EXISTS idx_sync_history_metadata
  ON archon_sync_history USING GIN (metadata);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sync_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_history_updated_at
  BEFORE UPDATE ON archon_sync_history
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_history_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE archon_sync_history ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to sync history"
  ON archon_sync_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can view sync history
CREATE POLICY "Authenticated users can view sync history"
  ON archon_sync_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Anon users cannot access sync history (security)
-- No policy created - anon users blocked by default

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Get latest sync by direction
CREATE OR REPLACE FUNCTION get_latest_sync(p_direction TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  sync_id TEXT,
  direction TEXT,
  status TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  synced_rows INTEGER,
  percent_complete INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sh.id,
    sh.sync_id,
    sh.direction,
    sh.status,
    sh.started_at,
    sh.completed_at,
    sh.duration_seconds,
    sh.synced_rows,
    sh.percent_complete
  FROM archon_sync_history sh
  WHERE
    (p_direction IS NULL OR sh.direction = p_direction)
  ORDER BY sh.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get sync statistics by time period
CREATE OR REPLACE FUNCTION get_sync_stats(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  total_syncs BIGINT,
  successful_syncs BIGINT,
  failed_syncs BIGINT,
  avg_duration_seconds NUMERIC,
  total_rows_synced BIGINT,
  local_to_remote_count BIGINT,
  remote_to_local_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_syncs,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_syncs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_syncs,
    ROUND(AVG(duration_seconds)::numeric, 2) as avg_duration_seconds,
    SUM(synced_rows) as total_rows_synced,
    COUNT(*) FILTER (WHERE direction = 'local-to-remote') as local_to_remote_count,
    COUNT(*) FILTER (WHERE direction = 'remote-to-local') as remote_to_local_count
  FROM archon_sync_history
  WHERE started_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE archon_sync_history IS 'Tracks all database sync operations between local and remote Supabase instances. Used for progress monitoring, error tracking, and sync history audit trail.';

COMMENT ON COLUMN archon_sync_history.sync_id IS 'Unique identifier for this sync operation (e.g., sync_20260112_143022)';

COMMENT ON COLUMN archon_sync_history.direction IS 'Direction of sync: local-to-remote, remote-to-local, or bidirectional';

COMMENT ON COLUMN archon_sync_history.current_phase IS 'Current phase of sync: validation, export, import, indexing, verification';

COMMENT ON COLUMN archon_sync_history.tables_synced IS 'JSONB array of synced tables with row counts and durations';

COMMENT ON COLUMN archon_sync_history.verification_results IS 'JSONB object with row count verification results per table';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify table was created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'archon_sync_history'
  ) THEN
    RAISE EXCEPTION 'Migration failed: archon_sync_history table not created';
  END IF;

  -- Verify indexes
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'archon_sync_history' AND indexname = 'idx_sync_history_started'
  ) THEN
    RAISE EXCEPTION 'Migration failed: idx_sync_history_started index not created';
  END IF;

  -- Verify triggers
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_sync_history_updated_at'
  ) THEN
    RAISE EXCEPTION 'Migration failed: trigger_sync_history_updated_at not created';
  END IF;

  RAISE NOTICE 'Migration 021_add_sync_history_table completed successfully';
END;
$$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Register migration
INSERT INTO archon_migrations (version, migration_name, applied_at)
VALUES ('0.3.0', '021_add_sync_history_table', NOW())
ON CONFLICT (version, migration_name) DO NOTHING;
