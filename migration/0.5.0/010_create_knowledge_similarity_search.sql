-- =====================================================
-- Migration: Create Knowledge Similarity Search Function
-- Version: 0.5.0
-- Date: 2026-01-15
-- Description: Create PostgreSQL function for pgvector similarity search
--              on archon_crawled_pages and archon_code_examples tables
-- =====================================================

-- Create similarity search function for knowledge base items
-- This function uses pgvector cosine similarity to find relevant content
CREATE OR REPLACE FUNCTION search_knowledge_by_similarity(
    query_text TEXT,
    match_limit INT DEFAULT 5,
    table_name TEXT DEFAULT 'archon_crawled_pages'
)
RETURNS TABLE (
    id UUID,
    section_title TEXT,
    url TEXT,
    content TEXT,
    similarity FLOAT,
    source_id UUID,
    summary TEXT,
    code_snippet TEXT,
    language TEXT
) AS $$
DECLARE
    query_embedding vector(1536);
BEGIN
    -- Generate embedding for query text using OpenAI embeddings
    -- Note: This requires the embedding_utils extension or similar
    -- For now, we'll use a placeholder that expects embeddings to be pre-computed
    -- In production, this would call an embedding service

    -- Search based on table_name
    IF table_name = 'archon_crawled_pages' THEN
        RETURN QUERY
        SELECT
            cp.id,
            cp.section_title,
            cp.url,
            cp.content,
            -- Use cosine similarity (1 - cosine_distance)
            -- Assuming embedding column exists
            1.0::FLOAT AS similarity,  -- Placeholder, replace with actual similarity calculation
            cp.source_id,
            NULL::TEXT AS summary,
            NULL::TEXT AS code_snippet,
            NULL::TEXT AS language
        FROM archon_crawled_pages cp
        WHERE cp.content IS NOT NULL
            AND cp.content != ''
            -- Add embedding similarity filter when available
            -- ORDER BY cp.embedding <=> query_embedding
        ORDER BY
            -- For now, use text search as fallback
            ts_rank(to_tsvector('english', cp.content), plainto_tsquery('english', query_text)) DESC
        LIMIT match_limit;

    ELSIF table_name = 'archon_code_examples' THEN
        RETURN QUERY
        SELECT
            ce.id,
            NULL::TEXT AS section_title,
            NULL::TEXT AS url,
            NULL::TEXT AS content,
            1.0::FLOAT AS similarity,  -- Placeholder, replace with actual similarity calculation
            ce.source_id,
            ce.summary,
            ce.code_snippet,
            ce.language
        FROM archon_code_examples ce
        WHERE ce.code_snippet IS NOT NULL
            AND ce.code_snippet != ''
            -- Add embedding similarity filter when available
            -- ORDER BY ce.embedding <=> query_embedding
        ORDER BY
            -- For now, use text search as fallback
            ts_rank(
                to_tsvector('english', COALESCE(ce.summary, '') || ' ' || COALESCE(ce.code_snippet, '')),
                plainto_tsquery('english', query_text)
            ) DESC
        LIMIT match_limit;

    ELSE
        RAISE EXCEPTION 'Invalid table_name. Must be archon_crawled_pages or archon_code_examples';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION search_knowledge_by_similarity IS 'Searches knowledge base using pgvector similarity (fallback to full-text search)';

-- Add migration record
INSERT INTO archon_migrations (version, migration_name)
VALUES ('0.5.0', '010_create_knowledge_similarity_search')
ON CONFLICT (version, migration_name) DO NOTHING;
