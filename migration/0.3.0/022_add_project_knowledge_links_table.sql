-- =====================================================
-- Migration 0.3.0/022: Add archon_project_knowledge_links table
-- =====================================================
-- Description: Creates table for bidirectional linking between projects and KB items
--              Enables "Link from Global KB" feature and backlinks discovery
-- Author: Database Expert Agent
-- Date: 2026-01-24
-- Related Task: e8034a5a-8cd0-466e-96c4-f019735451a4
-- UX Research: KB_PROJECT_LINKING_UX_RESEARCH.md
-- Dependencies: Requires archon_projects and archon_sources tables
-- =====================================================

-- =====================================================
-- CONTEXT & PURPOSE
-- =====================================================
-- This table enables bidirectional linking between projects and knowledge base items:
-- 1. Project → KB: Users can link existing global KB items to projects
-- 2. KB → Project: Users can see which projects reference a KB item (backlinks)
--
-- This addresses a critical UX gap where users could upload documents to projects
-- and promote to global KB, but had NO way to link existing global KB items back
-- to projects.
--
-- All leading tools (Notion, Obsidian, Linear, GitHub) implement this pattern.
-- =====================================================

-- =====================================================
-- TABLE: archon_project_knowledge_links
-- =====================================================
-- Tracks explicit manual links between projects and knowledge base items

CREATE TABLE IF NOT EXISTS archon_project_knowledge_links (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    project_id UUID NOT NULL REFERENCES archon_projects(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES archon_sources(source_id) ON DELETE CASCADE,

    -- Link metadata
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    linked_by VARCHAR(255),  -- User who created the link (e.g., "User", "Admin")
    link_type VARCHAR(50) NOT NULL DEFAULT 'manual',  -- 'manual' or 'auto' (future: AI-suggested)

    -- Optional link metadata
    relevance_score DECIMAL(3, 2) DEFAULT NULL,  -- 0.00 to 1.00 (AI-suggested links only)
    notes TEXT,  -- User-added notes about why this link is relevant

    -- Audit timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_project_source_link UNIQUE(project_id, source_id),  -- Prevent duplicate links
    CONSTRAINT valid_link_type CHECK (link_type IN ('manual', 'auto')),
    CONSTRAINT valid_relevance_score CHECK (relevance_score IS NULL OR (relevance_score >= 0.0 AND relevance_score <= 1.0))
);

-- =====================================================
-- INDEXES
-- =====================================================
-- Optimized for common query patterns:
-- 1. "Show all KB items linked to this project" (project detail view)
-- 2. "Show all projects that reference this KB item" (backlinks)
-- 3. "Show recently linked items" (activity feed)

-- Index for project → KB queries (most common)
CREATE INDEX IF NOT EXISTS idx_project_knowledge_project
    ON archon_project_knowledge_links(project_id, linked_at DESC);

-- Index for KB → project queries (backlinks)
CREATE INDEX IF NOT EXISTS idx_project_knowledge_source
    ON archon_project_knowledge_links(source_id, linked_at DESC);

-- Index for recent activity queries
CREATE INDEX IF NOT EXISTS idx_project_knowledge_linked_at
    ON archon_project_knowledge_links(linked_at DESC);

-- Index for filtering by link type (manual vs auto)
CREATE INDEX IF NOT EXISTS idx_project_knowledge_link_type
    ON archon_project_knowledge_links(link_type, linked_at DESC);

-- Index for finding links by creator
CREATE INDEX IF NOT EXISTS idx_project_knowledge_linked_by
    ON archon_project_knowledge_links(linked_by, linked_at DESC);

-- Composite index for link type + relevance score (for AI-suggested links)
CREATE INDEX IF NOT EXISTS idx_project_knowledge_auto_relevance
    ON archon_project_knowledge_links(link_type, relevance_score DESC)
    WHERE link_type = 'auto' AND relevance_score IS NOT NULL;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_knowledge_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_project_knowledge_links_updated_at IS
'Automatically updates updated_at timestamp when a link is modified';

-- Create trigger
DROP TRIGGER IF EXISTS trigger_project_knowledge_links_updated_at ON archon_project_knowledge_links;

CREATE TRIGGER trigger_project_knowledge_links_updated_at
    BEFORE UPDATE ON archon_project_knowledge_links
    FOR EACH ROW
    EXECUTE FUNCTION update_project_knowledge_links_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE archon_project_knowledge_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Service role has full access to project knowledge links" ON archon_project_knowledge_links;
DROP POLICY IF EXISTS "Authenticated users can view project knowledge links" ON archon_project_knowledge_links;
DROP POLICY IF EXISTS "Authenticated users can create project knowledge links" ON archon_project_knowledge_links;
DROP POLICY IF EXISTS "Authenticated users can update own project knowledge links" ON archon_project_knowledge_links;
DROP POLICY IF EXISTS "Authenticated users can delete own project knowledge links" ON archon_project_knowledge_links;

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to project knowledge links"
    ON archon_project_knowledge_links
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Authenticated users can view all links
CREATE POLICY "Authenticated users can view project knowledge links"
    ON archon_project_knowledge_links
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Authenticated users can create links
CREATE POLICY "Authenticated users can create project knowledge links"
    ON archon_project_knowledge_links
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Authenticated users can update links (e.g., add notes)
CREATE POLICY "Authenticated users can update own project knowledge links"
    ON archon_project_knowledge_links
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy: Authenticated users can delete links (unlink)
CREATE POLICY "Authenticated users can delete own project knowledge links"
    ON archon_project_knowledge_links
    FOR DELETE
    TO authenticated
    USING (true);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get backlinks for a knowledge base item
CREATE OR REPLACE FUNCTION get_knowledge_backlinks(p_source_id TEXT)
RETURNS TABLE (
    link_id UUID,
    project_id UUID,
    project_title TEXT,
    link_type VARCHAR,
    relevance_score DECIMAL,
    linked_at TIMESTAMPTZ,
    linked_by VARCHAR,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pkl.id as link_id,
        pkl.project_id,
        p.title as project_title,
        pkl.link_type,
        pkl.relevance_score,
        pkl.linked_at,
        pkl.linked_by,
        pkl.notes
    FROM archon_project_knowledge_links pkl
    JOIN archon_projects p ON p.id = pkl.project_id
    WHERE pkl.source_id = p_source_id
    ORDER BY pkl.linked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_knowledge_backlinks IS
'Returns all projects that link to a specific knowledge base item (backlinks)';

-- Function: Get knowledge items linked to a project
CREATE OR REPLACE FUNCTION get_project_knowledge_links(p_project_id UUID)
RETURNS TABLE (
    link_id UUID,
    source_id TEXT,
    source_title TEXT,
    source_url TEXT,
    knowledge_type TEXT,
    link_type VARCHAR,
    relevance_score DECIMAL,
    linked_at TIMESTAMPTZ,
    linked_by VARCHAR,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pkl.id as link_id,
        pkl.source_id,
        s.title as source_title,
        s.source_url,
        s.metadata->>'knowledge_type' as knowledge_type,
        pkl.link_type,
        pkl.relevance_score,
        pkl.linked_at,
        pkl.linked_by,
        pkl.notes
    FROM archon_project_knowledge_links pkl
    JOIN archon_sources s ON s.source_id = pkl.source_id
    WHERE pkl.project_id = p_project_id
    ORDER BY pkl.linked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_project_knowledge_links IS
'Returns all knowledge base items linked to a specific project';

-- Function: Check if a link already exists
CREATE OR REPLACE FUNCTION knowledge_link_exists(
    p_project_id UUID,
    p_source_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    link_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO link_count
    FROM archon_project_knowledge_links
    WHERE project_id = p_project_id
      AND source_id = p_source_id;

    RETURN link_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION knowledge_link_exists IS
'Checks if a link already exists between a project and knowledge base item';

-- Function: Get link statistics
CREATE OR REPLACE FUNCTION get_link_statistics(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_links BIGINT,
    manual_links BIGINT,
    auto_links BIGINT,
    unique_projects BIGINT,
    unique_sources BIGINT,
    links_last_24h BIGINT,
    avg_relevance_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_links,
        COUNT(*) FILTER (WHERE link_type = 'manual')::BIGINT as manual_links,
        COUNT(*) FILTER (WHERE link_type = 'auto')::BIGINT as auto_links,
        COUNT(DISTINCT project_id)::BIGINT as unique_projects,
        COUNT(DISTINCT source_id)::BIGINT as unique_sources,
        COUNT(*) FILTER (WHERE linked_at > NOW() - INTERVAL '24 hours')::BIGINT as links_last_24h,
        ROUND(AVG(relevance_score), 2) as avg_relevance_score
    FROM archon_project_knowledge_links
    WHERE linked_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_link_statistics IS
'Returns aggregated statistics about project-knowledge links';

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE archon_project_knowledge_links IS
'Tracks explicit manual links between projects and knowledge base items. Enables bidirectional discovery: projects can link to KB items, and KB items can show which projects reference them (backlinks). This addresses the UX gap identified in KB_PROJECT_LINKING_UX_RESEARCH.md.';

COMMENT ON COLUMN archon_project_knowledge_links.id IS
'Unique identifier for this link';

COMMENT ON COLUMN archon_project_knowledge_links.project_id IS
'Reference to the project (archon_projects.id)';

COMMENT ON COLUMN archon_project_knowledge_links.source_id IS
'Reference to the knowledge base item (archon_sources.source_id)';

COMMENT ON COLUMN archon_project_knowledge_links.linked_at IS
'Timestamp when the link was created';

COMMENT ON COLUMN archon_project_knowledge_links.linked_by IS
'User or agent who created the link (e.g., "User", "Admin", "planner")';

COMMENT ON COLUMN archon_project_knowledge_links.link_type IS
'Type of link: "manual" (user-created) or "auto" (AI-suggested and accepted)';

COMMENT ON COLUMN archon_project_knowledge_links.relevance_score IS
'Relevance score from 0.00 to 1.00 (only for auto-suggested links)';

COMMENT ON COLUMN archon_project_knowledge_links.notes IS
'Optional user notes explaining why this link is relevant';

COMMENT ON COLUMN archon_project_knowledge_links.created_at IS
'Timestamp when the record was created';

COMMENT ON COLUMN archon_project_knowledge_links.updated_at IS
'Timestamp when the record was last updated (auto-updated by trigger)';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify table was created successfully
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'archon_project_knowledge_links'
    ) THEN
        RAISE EXCEPTION 'Migration failed: archon_project_knowledge_links table not created';
    END IF;

    -- Verify unique constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'archon_project_knowledge_links'
          AND constraint_name = 'unique_project_source_link'
    ) THEN
        RAISE EXCEPTION 'Migration failed: unique_project_source_link constraint not created';
    END IF;

    -- Verify primary key exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'archon_project_knowledge_links'
          AND constraint_type = 'PRIMARY KEY'
    ) THEN
        RAISE EXCEPTION 'Migration failed: PRIMARY KEY not created';
    END IF;

    -- Verify foreign keys exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'archon_project_knowledge_links'
          AND constraint_type = 'FOREIGN KEY'
    ) THEN
        RAISE EXCEPTION 'Migration failed: FOREIGN KEY constraints not created';
    END IF;

    -- Verify indexes
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'archon_project_knowledge_links'
          AND indexname = 'idx_project_knowledge_project'
    ) THEN
        RAISE EXCEPTION 'Migration failed: idx_project_knowledge_project index not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'archon_project_knowledge_links'
          AND indexname = 'idx_project_knowledge_source'
    ) THEN
        RAISE EXCEPTION 'Migration failed: idx_project_knowledge_source index not created';
    END IF;

    -- Verify triggers
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_project_knowledge_links_updated_at'
    ) THEN
        RAISE EXCEPTION 'Migration failed: trigger_project_knowledge_links_updated_at not created';
    END IF;

    -- Verify RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'archon_project_knowledge_links'
          AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'Migration failed: Row Level Security not enabled';
    END IF;

    -- Verify helper functions exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_knowledge_backlinks'
    ) THEN
        RAISE EXCEPTION 'Migration failed: get_knowledge_backlinks function not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_project_knowledge_links'
    ) THEN
        RAISE EXCEPTION 'Migration failed: get_project_knowledge_links function not created';
    END IF;

    RAISE NOTICE 'Migration 022_add_project_knowledge_links_table completed successfully';
END;
$$;

-- =====================================================
-- REGISTER MIGRATION
-- =====================================================

-- Self-record this migration
INSERT INTO archon_migrations (version, migration_name, applied_at)
VALUES ('0.3.0', '022_add_project_knowledge_links_table', NOW())
ON CONFLICT (version, migration_name) DO NOTHING;

-- =====================================================
-- ROLLBACK SCRIPT (for reference)
-- =====================================================
-- To rollback this migration, run:
-- DROP TABLE IF EXISTS archon_project_knowledge_links CASCADE;
-- DROP FUNCTION IF EXISTS update_project_knowledge_links_updated_at() CASCADE;
-- DROP FUNCTION IF EXISTS get_knowledge_backlinks(TEXT) CASCADE;
-- DROP FUNCTION IF EXISTS get_project_knowledge_links(UUID) CASCADE;
-- DROP FUNCTION IF EXISTS knowledge_link_exists(UUID, TEXT) CASCADE;
-- DROP FUNCTION IF EXISTS get_link_statistics(INTEGER) CASCADE;
-- DELETE FROM archon_migrations WHERE migration_name = '022_add_project_knowledge_links_table';

-- =====================================================
-- USAGE EXAMPLES (for testing)
-- =====================================================
-- Create a manual link:
-- INSERT INTO archon_project_knowledge_links (project_id, source_id, linked_by, notes)
-- VALUES (
--     '550e8400-e29b-41d4-a716-446655440000',
--     'source_abc123',
--     'User',
--     'This authentication guide is relevant for implementing JWT tokens'
-- );
--
-- Get backlinks for a KB item:
-- SELECT * FROM get_knowledge_backlinks('source_abc123');
--
-- Get all KB items linked to a project:
-- SELECT * FROM get_project_knowledge_links('550e8400-e29b-41d4-a716-446655440000');
--
-- Check if link exists:
-- SELECT knowledge_link_exists('550e8400-e29b-41d4-a716-446655440000', 'source_abc123');
--
-- Get link statistics for last 30 days:
-- SELECT * FROM get_link_statistics(30);
--
-- Unlink (delete):
-- DELETE FROM archon_project_knowledge_links
-- WHERE project_id = '550e8400-e29b-41d4-a716-446655440000'
--   AND source_id = 'source_abc123';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
