-- Migration: 006_add_parent_task_id_index.sql
-- Purpose: Add index on archon_tasks.parent_task_id foreign key
-- Date: 2026-01-04
-- Performance: INFO - Unindexed foreign keys cause slow JOIN operations

-- =============================================================================
-- SECTION 1: Add Index for parent_task_id Foreign Key
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_archon_tasks_parent_task_id
ON archon_tasks(parent_task_id)
WHERE parent_task_id IS NOT NULL;

COMMENT ON INDEX idx_archon_tasks_parent_task_id IS
'Index on parent_task_id FK for efficient subtask queries and cascade operations';

-- =============================================================================
-- SECTION 2: Record Migration
-- =============================================================================

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES ('0.3.0', '006_add_parent_task_id_index', 'performance-fix')
ON CONFLICT (version, migration_name) DO NOTHING;
