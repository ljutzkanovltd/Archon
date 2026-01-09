-- =====================================================
-- HOTFIX: Add Missing Columns (Migrations 013 & 014)
-- =====================================================
-- Run this if migrations 013/014 were recorded but columns weren't added
-- =====================================================

-- Migration 013 columns
ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS total_duration INTEGER;

ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS disconnect_reason VARCHAR(100);

-- Migration 014 columns
ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);

ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_disconnect_reason
    ON archon_mcp_sessions(disconnect_reason);

CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_user_id
    ON archon_mcp_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_user_email
    ON archon_mcp_sessions(user_email);

CREATE INDEX IF NOT EXISTS idx_archon_mcp_sessions_user_activity
    ON archon_mcp_sessions(user_id, last_activity DESC)
    WHERE user_id IS NOT NULL;

-- Verify columns were added
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'archon_mcp_sessions'
  AND column_name IN (
      'total_duration',
      'disconnect_reason',
      'user_id',
      'user_email',
      'user_name'
  )
ORDER BY column_name;
