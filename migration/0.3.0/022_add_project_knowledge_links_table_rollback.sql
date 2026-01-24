-- =====================================================
-- ROLLBACK Migration 0.3.0/022: Remove archon_project_knowledge_links table
-- =====================================================
-- Description: Rollback script for archon_project_knowledge_links migration
-- Author: Database Expert Agent
-- Date: 2026-01-24
-- Related Migration: 022_add_project_knowledge_links_table.sql
-- =====================================================

-- =====================================================
-- WARNING: This will permanently delete all project-knowledge links!
-- =====================================================

-- Drop helper functions (CASCADE removes dependencies)
DROP FUNCTION IF EXISTS get_link_statistics(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS knowledge_link_exists(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_project_knowledge_links(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_knowledge_backlinks(TEXT) CASCADE;
DROP FUNCTION IF EXISTS update_project_knowledge_links_updated_at() CASCADE;

-- Drop table (CASCADE removes foreign keys and triggers)
DROP TABLE IF EXISTS archon_project_knowledge_links CASCADE;

-- Remove migration record
DELETE FROM archon_migrations
WHERE migration_name = '022_add_project_knowledge_links_table';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify table was removed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'archon_project_knowledge_links'
    ) THEN
        RAISE EXCEPTION 'Rollback failed: archon_project_knowledge_links table still exists';
    END IF;

    -- Verify functions were removed
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname IN (
            'get_knowledge_backlinks',
            'get_project_knowledge_links',
            'knowledge_link_exists',
            'get_link_statistics',
            'update_project_knowledge_links_updated_at'
        )
    ) THEN
        RAISE EXCEPTION 'Rollback failed: Helper functions still exist';
    END IF;

    RAISE NOTICE 'Rollback of migration 022_add_project_knowledge_links_table completed successfully';
END;
$$;

-- =====================================================
-- ROLLBACK COMPLETE
-- =====================================================
