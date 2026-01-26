-- Migration: 038_add_project_documents_rls.sql
-- Description: Enhanced RLS policies and vector search function for archon_project_documents
-- Author: Database Expert Agent
-- Date: 2026-01-26
-- Task IDs: 7e2a886f-da35-472f-a069-57daad99599b, 8e7a6d53-9002-4f3f-af3b-7b4d20aa9c5c
-- Depends on: 037_add_project_documents_table.sql

-- ==============================================================================
-- DROP EXISTING BASIC RLS POLICIES FROM MIGRATION 037
-- ==============================================================================
-- These policies were too permissive and need to be replaced with
-- proper access control via archon_user_project_access table

BEGIN;

-- Drop existing policies from migration 037
DROP POLICY IF EXISTS project_docs_select_own_projects ON public.archon_project_documents;
DROP POLICY IF EXISTS project_docs_insert_own_projects ON public.archon_project_documents;
DROP POLICY IF EXISTS project_docs_update_own ON public.archon_project_documents;
DROP POLICY IF EXISTS project_docs_delete_own ON public.archon_project_documents;
DROP POLICY IF EXISTS project_docs_service_role_all ON public.archon_project_documents;

-- ==============================================================================
-- ENHANCED RLS POLICIES WITH archon_user_project_access
-- ==============================================================================

-- Policy 1: Users can read documents from accessible projects
-- Uses archon_user_project_access to determine project access
CREATE POLICY "Users can read project documents via user_project_access"
ON public.archon_project_documents
FOR SELECT
TO authenticated
USING (
    project_id IN (
        SELECT upa.project_id
        FROM archon_user_project_access upa
        WHERE upa.user_id = auth.uid()
          AND upa.removed_at IS NULL  -- Active access only
    )
);

-- Policy 2: Owners can upload documents
-- Only users with 'owner' access level can insert documents
CREATE POLICY "Owners can upload project documents"
ON public.archon_project_documents
FOR INSERT
TO authenticated
WITH CHECK (
    uploaded_by = auth.uid()  -- Must be uploader
    AND
    project_id IN (
        SELECT upa.project_id
        FROM archon_user_project_access upa
        WHERE upa.user_id = auth.uid()
          AND upa.access_level = 'owner'
          AND upa.removed_at IS NULL
    )
);

-- Policy 3: Owners can update documents
-- Only project owners can update documents
CREATE POLICY "Owners can update project documents"
ON public.archon_project_documents
FOR UPDATE
TO authenticated
USING (
    project_id IN (
        SELECT upa.project_id
        FROM archon_user_project_access upa
        WHERE upa.user_id = auth.uid()
          AND upa.access_level = 'owner'
          AND upa.removed_at IS NULL
    )
)
WITH CHECK (
    project_id IN (
        SELECT upa.project_id
        FROM archon_user_project_access upa
        WHERE upa.user_id = auth.uid()
          AND upa.access_level = 'owner'
          AND upa.removed_at IS NULL
    )
);

-- Policy 4: Uploaders and owners can delete
-- Uploaders can delete their own documents, owners can delete any document
CREATE POLICY "Uploaders and owners can delete project documents"
ON public.archon_project_documents
FOR DELETE
TO authenticated
USING (
    uploaded_by = auth.uid()  -- Own documents
    OR
    project_id IN (
        SELECT upa.project_id
        FROM archon_user_project_access upa
        WHERE upa.user_id = auth.uid()
          AND upa.access_level = 'owner'
          AND upa.removed_at IS NULL
    )
);

-- Policy 5: Service role full access (backend API operations)
CREATE POLICY "Service role full access to project documents"
ON public.archon_project_documents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- VECTOR SEARCH FUNCTION FOR MULTI-PROJECT SEARCH
-- ==============================================================================

-- Function: match_project_documents
-- Purpose: Search documents across multiple projects using vector similarity
-- Features:
--   - Multi-dimensional embedding support (384, 768, 1024, 1536, 3072)
--   - Multi-project filtering via project_ids array
--   - User-scoped access control (optional user_id parameter)
--   - Dynamic column selection based on embedding dimension
--   - Cosine similarity scoring (1 - distance)
--   - IVFFlat index optimization

CREATE OR REPLACE FUNCTION public.match_project_documents(
  query_embedding VECTOR(1536),
  embedding_dimension INTEGER DEFAULT 1536,
  match_count INTEGER DEFAULT 10,
  project_ids UUID[] DEFAULT NULL,
  user_id UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  project_id UUID,
  filename VARCHAR,
  chunk_number INTEGER,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  embedding_column TEXT;
BEGIN
  -- Validate embedding dimension
  IF embedding_dimension NOT IN (384, 768, 1024, 1536, 3072) THEN
    RAISE EXCEPTION 'Invalid embedding dimension: %. Must be 384, 768, 1024, 1536, or 3072', embedding_dimension;
  END IF;

  -- Determine which embedding column to use based on dimension
  embedding_column := CASE embedding_dimension
    WHEN 384 THEN 'embedding_384'
    WHEN 768 THEN 'embedding_768'
    WHEN 1024 THEN 'embedding_1024'
    WHEN 1536 THEN 'embedding_1536'
    WHEN 3072 THEN 'embedding_3072'
  END;

  -- Use EXECUTE for dynamic column selection
  -- Filters:
  --   1. project_ids: If provided, only search these projects
  --   2. user_id: If provided, only search projects accessible to this user
  --   3. embedding_column IS NOT NULL: Only return chunks with embeddings
  RETURN QUERY EXECUTE format(
    'SELECT
      pd.id,
      pd.project_id,
      pd.filename,
      pd.chunk_number,
      pd.content,
      pd.metadata,
      1 - (pd.%I <=> $1) AS similarity
    FROM archon_project_documents pd
    WHERE
      ($2::UUID[] IS NULL OR pd.project_id = ANY($2))
      AND (
        $3::UUID IS NULL
        OR pd.project_id IN (
          SELECT upa.project_id
          FROM archon_user_project_access upa
          WHERE upa.user_id = $3
            AND upa.removed_at IS NULL
        )
      )
      AND pd.%I IS NOT NULL
    ORDER BY pd.%I <=> $1
    LIMIT $4',
    embedding_column, embedding_column, embedding_column
  )
  USING query_embedding, project_ids, user_id, match_count;
END;
$$;

-- ==============================================================================
-- GRANT PERMISSIONS
-- ==============================================================================

-- Grant execute to authenticated users (for user-scoped searches)
GRANT EXECUTE ON FUNCTION public.match_project_documents TO authenticated;

-- Grant execute to service role (for backend API operations)
GRANT EXECUTE ON FUNCTION public.match_project_documents TO service_role;

-- ==============================================================================
-- COMMENTS
-- ==============================================================================

COMMENT ON FUNCTION public.match_project_documents(VECTOR, INTEGER, INTEGER, UUID[], UUID) IS
    'Search project documents across multiple projects using vector similarity.
     Supports multi-dimensional embeddings (384, 768, 1024, 1536, 3072).
     Respects user access control via archon_user_project_access when user_id is provided.
     Returns top matches sorted by cosine similarity (1 - distance).';

-- ==============================================================================
-- VERIFICATION
-- ==============================================================================

DO $$
BEGIN
    -- Verify RLS is still enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'archon_project_documents'
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS is not enabled on archon_project_documents';
    END IF;

    -- Verify new policies exist (5 policies)
    IF (
        SELECT COUNT(*)
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'archon_project_documents'
    ) < 5 THEN
        RAISE EXCEPTION 'Not all RLS policies were created (expected 5)';
    END IF;

    -- Verify match_project_documents function exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'match_project_documents'
    ) THEN
        RAISE EXCEPTION 'Function match_project_documents was not created';
    END IF;

    RAISE NOTICE 'Migration 038_add_project_documents_rls.sql completed successfully';
    RAISE NOTICE 'RLS policies: 5 policies created with archon_user_project_access integration';
    RAISE NOTICE 'Vector search function: match_project_documents created';
END $$;

COMMIT;

-- ==============================================================================
-- USAGE EXAMPLES
-- ==============================================================================

-- Example 1: Search across all accessible projects for current user
-- SELECT * FROM public.match_project_documents(
--     '[0.1, 0.2, ...]'::vector(1536),  -- Query embedding
--     1536,                              -- Embedding dimension
--     10,                                -- Max results
--     NULL,                              -- All projects (no filter)
--     auth.uid()                         -- Current user's accessible projects only
-- );

-- Example 2: Search specific projects (no user filter)
-- SELECT * FROM public.match_project_documents(
--     '[0.1, 0.2, ...]'::vector(1536),
--     1536,
--     10,
--     ARRAY['project-uuid-1', 'project-uuid-2']::UUID[],  -- Specific projects
--     NULL                                                 -- No user filter
-- );

-- Example 3: Search with different embedding dimension (text-embedding-3-small)
-- SELECT * FROM public.match_project_documents(
--     '[0.1, 0.2, ...]'::vector(1024),
--     1024,
--     20,
--     NULL,
--     auth.uid()
-- );

-- Example 4: Backend API usage (service role, no user restriction)
-- SELECT * FROM public.match_project_documents(
--     '[0.1, 0.2, ...]'::vector(1536),
--     1536,
--     50,
--     ARRAY['project-uuid']::UUID[],
--     NULL  -- Service role can search without user restriction
-- );
