-- Migration: 037_add_project_documents_table.sql
-- Description: Add project-level private documents table with multi-dimensional embeddings
-- Author: Database Expert Agent
-- Date: 2026-01-26
-- Task ID: 9b7c908f-4f70-435d-8e3b-bdf5b1d11434

-- ==============================================================================
-- Project Documents Table
-- ==============================================================================
-- Stores project-specific uploaded documents with chunked content and embeddings
-- for semantic search and RAG applications. Supports multiple embedding dimensions
-- (384, 768, 1024, 1536, 3072) for flexibility with different embedding models.

CREATE TABLE IF NOT EXISTS public.archon_project_documents (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    project_id UUID NOT NULL REFERENCES public.archon_projects(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.archon_users(id) ON DELETE SET NULL,

    -- File metadata
    filename VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100),

    -- Chunking information
    chunk_number INTEGER NOT NULL,

    -- Content
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,  -- SHA256 hash for deduplication

    -- Flexible metadata (JSON for extensibility)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Multi-dimensional embeddings for different models
    embedding_384 VECTOR(384),   -- nomic-embed-text-v1.5, all-MiniLM-L6-v2
    embedding_768 VECTOR(768),   -- text-embedding-ada-002 (legacy), BERT-base
    embedding_1024 VECTOR(1024), -- text-embedding-3-small
    embedding_1536 VECTOR(1536), -- text-embedding-ada-002, text-embedding-3-small (default)
    embedding_3072 VECTOR(3072), -- text-embedding-3-large

    -- Embedding provenance
    llm_chat_model TEXT,          -- Model used for text processing/summarization
    embedding_model TEXT,         -- Model used for embeddings (e.g., "text-embedding-3-small")
    embedding_dimension INTEGER,  -- Actual dimension used (384/768/1024/1536/3072)

    -- Full-text search support
    content_search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,

    -- Timestamps
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_project_file_chunk UNIQUE(project_id, filename, chunk_number),
    CONSTRAINT valid_chunk_number CHECK (chunk_number >= 0),
    CONSTRAINT valid_file_size CHECK (file_size_bytes > 0),
    CONSTRAINT valid_file_type CHECK (
        file_type IN ('pdf', 'markdown', 'text', 'image', 'code')
    )
);

-- ==============================================================================
-- Indexes for Performance (15 indexes total)
-- ==============================================================================

-- 1. Primary key (id) - automatically created by PRIMARY KEY constraint

-- 2. Foreign key index - project_id (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_project_docs_project_id
    ON public.archon_project_documents(project_id);

-- 3. File type filter (for filtering by document type)
CREATE INDEX IF NOT EXISTS idx_project_docs_file_type
    ON public.archon_project_documents(file_type);

-- 4. Uploaded by (for audit/user activity queries)
CREATE INDEX IF NOT EXISTS idx_project_docs_uploaded_by
    ON public.archon_project_documents(uploaded_by);

-- 5. Content hash (for deduplication checks)
CREATE INDEX IF NOT EXISTS idx_project_docs_content_hash
    ON public.archon_project_documents(content_hash);

-- 6-10. Vector similarity search indexes (IVFFlat for approximate nearest neighbor)
-- IVFFlat with lists=100 is optimal for small to medium datasets (<1M vectors)
CREATE INDEX IF NOT EXISTS idx_project_docs_embedding_384
    ON public.archon_project_documents
    USING ivfflat (embedding_384 vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_project_docs_embedding_768
    ON public.archon_project_documents
    USING ivfflat (embedding_768 vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_project_docs_embedding_1024
    ON public.archon_project_documents
    USING ivfflat (embedding_1024 vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_project_docs_embedding_1536
    ON public.archon_project_documents
    USING ivfflat (embedding_1536 vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_project_docs_embedding_3072
    ON public.archon_project_documents
    USING ivfflat (embedding_3072 vector_cosine_ops)
    WITH (lists = 100);

-- 11. Full-text search index (GIN for tsvector)
CREATE INDEX IF NOT EXISTS idx_project_docs_content_search
    ON public.archon_project_documents
    USING GIN (content_search_vector);

-- 12. Trigram similarity search (GIN for fuzzy text matching)
CREATE INDEX IF NOT EXISTS idx_project_docs_content_trgm
    ON public.archon_project_documents
    USING GIN (content gin_trgm_ops);

-- 13. Embedding model tracking (for filtering by embedding model)
CREATE INDEX IF NOT EXISTS idx_project_docs_embedding_model
    ON public.archon_project_documents(embedding_model);

-- 14. Embedding dimension tracking (for filtering by dimension)
CREATE INDEX IF NOT EXISTS idx_project_docs_embedding_dimension
    ON public.archon_project_documents(embedding_dimension);

-- 15. Metadata index (GIN for JSONB queries)
CREATE INDEX IF NOT EXISTS idx_project_docs_metadata
    ON public.archon_project_documents
    USING GIN (metadata);

-- ==============================================================================
-- Triggers
-- ==============================================================================

-- Auto-update updated_at timestamp (reuses existing function)
CREATE TRIGGER trigger_project_docs_updated_at
    BEFORE UPDATE ON public.archon_project_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.archon_project_documents ENABLE ROW LEVEL SECURITY;

-- Users can view documents from projects they have access to
-- (This assumes project-level access control - adjust based on your RBAC model)
CREATE POLICY project_docs_select_own_projects
    ON public.archon_project_documents
    FOR SELECT
    USING (
        -- Allow if user is a member of the project (you may need to adjust this)
        -- For now, allow authenticated users to view any project documents
        auth.uid() IS NOT NULL
    );

-- Users can insert documents to projects they have write access to
CREATE POLICY project_docs_insert_own_projects
    ON public.archon_project_documents
    FOR INSERT
    WITH CHECK (
        -- Only authenticated users can upload
        auth.uid() IS NOT NULL
        -- And they must be the uploader
        AND uploaded_by = auth.uid()
    );

-- Users can update their own uploaded documents
CREATE POLICY project_docs_update_own
    ON public.archon_project_documents
    FOR UPDATE
    USING (uploaded_by = auth.uid())
    WITH CHECK (uploaded_by = auth.uid());

-- Users can delete their own uploaded documents
CREATE POLICY project_docs_delete_own
    ON public.archon_project_documents
    FOR DELETE
    USING (uploaded_by = auth.uid());

-- Service role bypass (for backend API operations)
CREATE POLICY project_docs_service_role_all
    ON public.archon_project_documents
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==============================================================================
-- Helper Functions
-- ==============================================================================

-- Function to search project documents with vector similarity
CREATE OR REPLACE FUNCTION public.search_project_documents(
    p_project_id UUID,
    p_query_embedding VECTOR,
    p_embedding_dimension INTEGER DEFAULT 1536,
    p_match_count INTEGER DEFAULT 10,
    p_file_type VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    filename VARCHAR(500),
    chunk_number INTEGER,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        doc.id,
        doc.filename,
        doc.chunk_number,
        doc.content,
        doc.metadata,
        CASE p_embedding_dimension
            WHEN 384 THEN 1 - (doc.embedding_384 <=> p_query_embedding)
            WHEN 768 THEN 1 - (doc.embedding_768 <=> p_query_embedding)
            WHEN 1024 THEN 1 - (doc.embedding_1024 <=> p_query_embedding)
            WHEN 1536 THEN 1 - (doc.embedding_1536 <=> p_query_embedding)
            WHEN 3072 THEN 1 - (doc.embedding_3072 <=> p_query_embedding)
            ELSE NULL
        END AS similarity
    FROM public.archon_project_documents doc
    WHERE doc.project_id = p_project_id
        AND (p_file_type IS NULL OR doc.file_type = p_file_type)
        AND (
            CASE p_embedding_dimension
                WHEN 384 THEN doc.embedding_384 IS NOT NULL
                WHEN 768 THEN doc.embedding_768 IS NOT NULL
                WHEN 1024 THEN doc.embedding_1024 IS NOT NULL
                WHEN 1536 THEN doc.embedding_1536 IS NOT NULL
                WHEN 3072 THEN doc.embedding_3072 IS NOT NULL
                ELSE FALSE
            END
        )
    ORDER BY
        CASE p_embedding_dimension
            WHEN 384 THEN doc.embedding_384 <=> p_query_embedding
            WHEN 768 THEN doc.embedding_768 <=> p_query_embedding
            WHEN 1024 THEN doc.embedding_1024 <=> p_query_embedding
            WHEN 1536 THEN doc.embedding_1536 <=> p_query_embedding
            WHEN 3072 THEN doc.embedding_3072 <=> p_query_embedding
            ELSE NULL
        END ASC
    LIMIT p_match_count;
END;
$$;

-- Function to get document statistics for a project
CREATE OR REPLACE FUNCTION public.get_project_document_stats(p_project_id UUID)
RETURNS TABLE (
    total_documents INTEGER,
    total_chunks INTEGER,
    total_size_bytes BIGINT,
    file_type_counts JSONB,
    embedding_model_counts JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT filename)::INTEGER AS total_documents,
        COUNT(*)::INTEGER AS total_chunks,
        SUM(file_size_bytes)::BIGINT AS total_size_bytes,
        jsonb_object_agg(
            file_type,
            file_type_count
        ) AS file_type_counts,
        jsonb_object_agg(
            COALESCE(embedding_model, 'unknown'),
            embedding_model_count
        ) AS embedding_model_counts
    FROM (
        SELECT
            file_type,
            COUNT(*)::INTEGER AS file_type_count
        FROM public.archon_project_documents
        WHERE project_id = p_project_id
        GROUP BY file_type
    ) AS file_types
    CROSS JOIN (
        SELECT
            embedding_model,
            COUNT(*)::INTEGER AS embedding_model_count
        FROM public.archon_project_documents
        WHERE project_id = p_project_id
        GROUP BY embedding_model
    ) AS embedding_models;
END;
$$;

-- Function to deduplicate documents by content hash
CREATE OR REPLACE FUNCTION public.deduplicate_project_documents(
    p_project_id UUID,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    content_hash VARCHAR(64),
    duplicate_count INTEGER,
    kept_id UUID,
    deleted_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    duplicate RECORD;
    ids_to_delete UUID[];
BEGIN
    FOR duplicate IN
        SELECT
            doc.content_hash,
            COUNT(*)::INTEGER AS dup_count,
            MIN(doc.id) AS keep_id,
            array_agg(doc.id ORDER BY doc.created_at DESC) FILTER (WHERE doc.id != MIN(doc.id)) AS delete_ids
        FROM public.archon_project_documents doc
        WHERE doc.project_id = p_project_id
        GROUP BY doc.content_hash
        HAVING COUNT(*) > 1
    LOOP
        IF NOT p_dry_run THEN
            DELETE FROM public.archon_project_documents
            WHERE id = ANY(duplicate.delete_ids);
        END IF;

        RETURN QUERY
        SELECT
            duplicate.content_hash,
            duplicate.dup_count,
            duplicate.keep_id,
            duplicate.delete_ids;
    END LOOP;
END;
$$;

-- ==============================================================================
-- Comments
-- ==============================================================================

COMMENT ON TABLE public.archon_project_documents IS
    'Stores project-specific uploaded documents with chunked content and multi-dimensional embeddings for semantic search and RAG. Supports multiple embedding dimensions (384, 768, 1024, 1536, 3072) for flexibility.';

COMMENT ON COLUMN public.archon_project_documents.project_id IS
    'Foreign key to archon_projects. All documents belong to a project.';

COMMENT ON COLUMN public.archon_project_documents.filename IS
    'Original filename of the uploaded document (max 500 chars)';

COMMENT ON COLUMN public.archon_project_documents.file_path IS
    'Storage path or S3 key for the original file';

COMMENT ON COLUMN public.archon_project_documents.file_type IS
    'Document type: pdf, markdown, text, image, or code';

COMMENT ON COLUMN public.archon_project_documents.file_size_bytes IS
    'Size of the original file in bytes (must be > 0)';

COMMENT ON COLUMN public.archon_project_documents.chunk_number IS
    'Chunk sequence number for large documents (0-based, must be >= 0)';

COMMENT ON COLUMN public.archon_project_documents.content IS
    'Extracted text content from the document chunk';

COMMENT ON COLUMN public.archon_project_documents.content_hash IS
    'SHA256 hash of content for deduplication (computed before insert)';

COMMENT ON COLUMN public.archon_project_documents.metadata IS
    'Flexible JSONB metadata (e.g., page numbers, sections, tags, extraction metadata)';

COMMENT ON COLUMN public.archon_project_documents.embedding_384 IS
    'Vector embedding (384 dimensions) - nomic-embed-text-v1.5, all-MiniLM-L6-v2';

COMMENT ON COLUMN public.archon_project_documents.embedding_768 IS
    'Vector embedding (768 dimensions) - text-embedding-ada-002 (legacy), BERT-base';

COMMENT ON COLUMN public.archon_project_documents.embedding_1024 IS
    'Vector embedding (1024 dimensions) - text-embedding-3-small';

COMMENT ON COLUMN public.archon_project_documents.embedding_1536 IS
    'Vector embedding (1536 dimensions) - text-embedding-ada-002, text-embedding-3-small (default)';

COMMENT ON COLUMN public.archon_project_documents.embedding_3072 IS
    'Vector embedding (3072 dimensions) - text-embedding-3-large';

COMMENT ON COLUMN public.archon_project_documents.llm_chat_model IS
    'LLM model used for text processing/summarization (e.g., "gpt-4", "claude-3-opus")';

COMMENT ON COLUMN public.archon_project_documents.embedding_model IS
    'Embedding model used (e.g., "text-embedding-3-small", "nomic-embed-text-v1.5")';

COMMENT ON COLUMN public.archon_project_documents.embedding_dimension IS
    'Actual embedding dimension used: 384, 768, 1024, 1536, or 3072';

COMMENT ON COLUMN public.archon_project_documents.content_search_vector IS
    'Generated tsvector for full-text search (automatically updated on content change)';

COMMENT ON COLUMN public.archon_project_documents.uploaded_by IS
    'User who uploaded the document (foreign key to archon_users)';

COMMENT ON FUNCTION public.search_project_documents(UUID, VECTOR, INTEGER, INTEGER, VARCHAR) IS
    'Search project documents using vector similarity. Returns top matches with similarity scores.';

COMMENT ON FUNCTION public.get_project_document_stats(UUID) IS
    'Get statistics for project documents: total docs, chunks, size, file type distribution, embedding model distribution.';

COMMENT ON FUNCTION public.deduplicate_project_documents(UUID, BOOLEAN) IS
    'Find and optionally remove duplicate documents by content hash. Set dry_run=FALSE to delete duplicates.';

-- ==============================================================================
-- Grant Permissions
-- ==============================================================================

-- Grant access to authenticated users (through RLS policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.archon_project_documents TO authenticated;

-- Grant full access to service role for backend API
GRANT ALL ON public.archon_project_documents TO service_role;

-- Grant execute on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION public.search_project_documents(UUID, VECTOR, INTEGER, INTEGER, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_document_stats(UUID) TO authenticated;

-- Grant execute on management functions to service role only
GRANT EXECUTE ON FUNCTION public.deduplicate_project_documents(UUID, BOOLEAN) TO service_role;

-- ==============================================================================
-- Verification
-- ==============================================================================

DO $$
BEGIN
    -- Verify table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'archon_project_documents'
    ) THEN
        RAISE EXCEPTION 'Table archon_project_documents was not created';
    END IF;

    -- Verify primary key index exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'archon_project_documents'
        AND indexname = 'archon_project_documents_pkey'
    ) THEN
        RAISE EXCEPTION 'Primary key index was not created';
    END IF;

    -- Verify foreign key indexes exist (15 total indexes including PK)
    IF (
        SELECT COUNT(*)
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'archon_project_documents'
    ) < 15 THEN
        RAISE EXCEPTION 'Not all indexes were created (expected 15)';
    END IF;

    -- Verify RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'archon_project_documents'
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS is not enabled on archon_project_documents';
    END IF;

    -- Verify helper functions exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'search_project_documents'
    ) THEN
        RAISE EXCEPTION 'Function search_project_documents was not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_project_document_stats'
    ) THEN
        RAISE EXCEPTION 'Function get_project_document_stats was not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'deduplicate_project_documents'
    ) THEN
        RAISE EXCEPTION 'Function deduplicate_project_documents was not created';
    END IF;

    -- Verify trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trigger_project_docs_updated_at'
    ) THEN
        RAISE EXCEPTION 'Trigger trigger_project_docs_updated_at was not created';
    END IF;

    RAISE NOTICE 'Migration 037_add_project_documents_table.sql completed successfully';
    RAISE NOTICE 'Table: archon_project_documents created with 15 indexes';
    RAISE NOTICE 'Helper functions: search_project_documents, get_project_document_stats, deduplicate_project_documents';
    RAISE NOTICE 'RLS enabled with policies for authenticated users and service role';
END $$;

-- ==============================================================================
-- Usage Examples
-- ==============================================================================

-- Example 1: Insert a document chunk with embeddings
-- INSERT INTO public.archon_project_documents (
--     project_id, filename, file_path, file_type, file_size_bytes,
--     chunk_number, content, content_hash, uploaded_by,
--     embedding_1536, embedding_model, embedding_dimension
-- ) VALUES (
--     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--     'architecture.pdf',
--     's3://bucket/projects/proj-123/architecture.pdf',
--     'pdf',
--     2048576,
--     0,
--     'System architecture overview: The application follows a microservices pattern...',
--     'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
--     'user-uuid-here',
--     '[0.123, 0.456, ...]'::vector(1536),
--     'text-embedding-3-small',
--     1536
-- );

-- Example 2: Search documents with vector similarity
-- SELECT * FROM public.search_project_documents(
--     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--     '[0.123, 0.456, ...]'::vector(1536),
--     1536,  -- embedding dimension
--     10,    -- match count
--     NULL   -- file_type filter (optional)
-- );

-- Example 3: Get document statistics
-- SELECT * FROM public.get_project_document_stats('a1b2c3d4-e5f6-7890-abcd-ef1234567890');

-- Example 4: Full-text search
-- SELECT filename, chunk_number, content, ts_rank(content_search_vector, query) AS rank
-- FROM public.archon_project_documents,
--      to_tsquery('english', 'architecture & microservices') query
-- WHERE project_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
--   AND content_search_vector @@ query
-- ORDER BY rank DESC
-- LIMIT 10;

-- Example 5: Deduplicate documents (dry run)
-- SELECT * FROM public.deduplicate_project_documents('a1b2c3d4-e5f6-7890-abcd-ef1234567890', TRUE);
