-- =====================================================
-- Migration: Create Knowledge Links Table
-- Version: 0.5.0
-- Date: 2026-01-15
-- Description: Create archon_knowledge_links table for linking
--              projects/tasks/sprints to knowledge base items
--              (documents, code examples, RAG pages)
-- =====================================================

-- Create archon_knowledge_links table
CREATE TABLE IF NOT EXISTS archon_knowledge_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL,
    source_id UUID NOT NULL,
    knowledge_type VARCHAR(50) NOT NULL,
    knowledge_id UUID NOT NULL,
    relevance_score DECIMAL(3,2),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CHECK (source_type IN ('project', 'task', 'sprint')),
    CHECK (knowledge_type IN ('document', 'code_example', 'rag_page')),
    CHECK (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 1)),
    UNIQUE (source_type, source_id, knowledge_type, knowledge_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_archon_knowledge_links_source
    ON archon_knowledge_links(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_archon_knowledge_links_knowledge
    ON archon_knowledge_links(knowledge_type, knowledge_id);

CREATE INDEX IF NOT EXISTS idx_archon_knowledge_links_created_by
    ON archon_knowledge_links(created_by);

CREATE INDEX IF NOT EXISTS idx_archon_knowledge_links_relevance
    ON archon_knowledge_links(relevance_score DESC NULLS LAST)
    WHERE relevance_score IS NOT NULL;

-- Add comments
COMMENT ON TABLE archon_knowledge_links IS 'Links between projects/tasks/sprints and knowledge base items (documents, code, RAG pages)';
COMMENT ON COLUMN archon_knowledge_links.source_type IS 'Type of entity being linked: project, task, or sprint';
COMMENT ON COLUMN archon_knowledge_links.source_id IS 'UUID of the project/task/sprint';
COMMENT ON COLUMN archon_knowledge_links.knowledge_type IS 'Type of knowledge item: document, code_example, or rag_page';
COMMENT ON COLUMN archon_knowledge_links.knowledge_id IS 'UUID from archon_crawled_pages or archon_code_examples';
COMMENT ON COLUMN archon_knowledge_links.relevance_score IS 'AI-suggested relevance score (0.00-1.00), NULL for manual links';
COMMENT ON COLUMN archon_knowledge_links.created_by IS 'User identifier or "ai-suggestion" for AI-generated links';

-- Create function to validate source_id exists
CREATE OR REPLACE FUNCTION validate_knowledge_link_source()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate source exists in appropriate table
    IF NEW.source_type = 'project' THEN
        IF NOT EXISTS (SELECT 1 FROM archon_projects WHERE id = NEW.source_id) THEN
            RAISE EXCEPTION 'Project % not found', NEW.source_id;
        END IF;
    ELSIF NEW.source_type = 'task' THEN
        IF NOT EXISTS (SELECT 1 FROM archon_tasks WHERE id = NEW.source_id) THEN
            RAISE EXCEPTION 'Task % not found', NEW.source_id;
        END IF;
    ELSIF NEW.source_type = 'sprint' THEN
        IF NOT EXISTS (SELECT 1 FROM archon_sprints WHERE id = NEW.source_id) THEN
            RAISE EXCEPTION 'Sprint % not found', NEW.source_id;
        END IF;
    END IF;

    -- Validate knowledge item exists
    IF NEW.knowledge_type IN ('document', 'rag_page') THEN
        IF NOT EXISTS (SELECT 1 FROM archon_crawled_pages WHERE id = NEW.knowledge_id) THEN
            RAISE EXCEPTION 'RAG page % not found', NEW.knowledge_id;
        END IF;
    ELSIF NEW.knowledge_type = 'code_example' THEN
        IF NOT EXISTS (SELECT 1 FROM archon_code_examples WHERE id = NEW.knowledge_id) THEN
            RAISE EXCEPTION 'Code example % not found', NEW.knowledge_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate links on insert/update
DROP TRIGGER IF EXISTS trigger_validate_knowledge_link_source ON archon_knowledge_links;
CREATE TRIGGER trigger_validate_knowledge_link_source
    BEFORE INSERT OR UPDATE ON archon_knowledge_links
    FOR EACH ROW
    EXECUTE FUNCTION validate_knowledge_link_source();

-- Add migration record
INSERT INTO archon_migrations (version, migration_name)
VALUES ('0.5.0', '009_create_knowledge_links')
ON CONFLICT (version, migration_name) DO NOTHING;
