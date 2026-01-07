-- Migration: 003_register_missing_migrations.sql
-- Run this in Supabase SQL Editor

INSERT INTO archon_migrations (version, migration_name, checksum)
VALUES
  ('0.2.0', '001_add_project_archival', 'retroactive'),
  ('0.2.0', '002_add_task_history_tracking', 'retroactive'),
  ('0.2.0', '003_add_task_completion_tracking', 'retroactive'),
  ('0.3.0', '002_optimize_knowledge_queries', 'retroactive'),
  ('0.3.0', '003_register_missing_migrations', 'self-record')
ON CONFLICT (version, migration_name) DO NOTHING;
