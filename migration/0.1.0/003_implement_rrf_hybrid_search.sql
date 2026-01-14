-- Migration: Implement RRF (Reciprocal Rank Fusion) for Hybrid Search
-- Date: 2026-01-14
-- Purpose: Replace simple COALESCE score combination with proper RRF algorithm
--          RRF formula: score = 1/(k + rank_vector) + 1/(k + rank_text)
--          where k=60 (standard constant)
-- Expected Impact: +5-10% hybrid search quality improvement
-- =====================================================

-- Drop existing hybrid search functions to recreate with RRF
DROP FUNCTION IF EXISTS hybrid_search_archon_crawled_pages_multi(VECTOR, INTEGER, TEXT, INT, JSONB, TEXT);
DROP FUNCTION IF EXISTS hybrid_search_archon_crawled_pages(VECTOR, TEXT, INT, JSONB, TEXT);

-- Multi-dimensional hybrid search with RRF (Reciprocal Rank Fusion)
CREATE OR REPLACE FUNCTION hybrid_search_archon_crawled_pages_multi(
    query_embedding VECTOR,
    embedding_dimension INTEGER,
    query_text TEXT,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb,
    source_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    url VARCHAR,
    chunk_number INTEGER,
    content TEXT,
    metadata JSONB,
    source_id TEXT,
    similarity FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
    max_vector_results INT;
    max_text_results INT;
    sql_query TEXT;
    embedding_column TEXT;
    k_constant INT := 60;  -- RRF constant (standard value)
BEGIN
    -- Determine which embedding column to use based on dimension
    CASE embedding_dimension
        WHEN 384 THEN embedding_column := 'embedding_384';
        WHEN 768 THEN embedding_column := 'embedding_768';
        WHEN 1024 THEN embedding_column := 'embedding_1024';
        WHEN 1536 THEN embedding_column := 'embedding_1536';
        WHEN 3072 THEN embedding_column := 'embedding_3072';
        ELSE RAISE EXCEPTION 'Unsupported embedding dimension: %', embedding_dimension;
    END CASE;

    -- Fetch more results for reranking (2x match_count for good coverage)
    max_vector_results := match_count * 2;
    max_text_results := match_count * 2;

    -- Build dynamic query with RRF scoring
    sql_query := format('
    WITH vector_results AS (
        -- Vector similarity search with rankings
        SELECT
            cp.id,
            cp.url,
            cp.chunk_number,
            cp.content,
            cp.metadata,
            cp.source_id,
            1 - (cp.%I <=> $1) AS vector_sim,
            ROW_NUMBER() OVER (ORDER BY cp.%I <=> $1) AS vector_rank
        FROM archon_crawled_pages cp
        WHERE cp.metadata @> $4
            AND ($5 IS NULL OR cp.source_id = $5)
            AND cp.%I IS NOT NULL
        ORDER BY cp.%I <=> $1
        LIMIT $2
    ),
    text_results AS (
        -- Full-text search with rankings
        SELECT
            cp.id,
            cp.url,
            cp.chunk_number,
            cp.content,
            cp.metadata,
            cp.source_id,
            ts_rank_cd(cp.content_search_vector, plainto_tsquery(''english'', $6)) AS text_sim,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(cp.content_search_vector, plainto_tsquery(''english'', $6)) DESC) AS text_rank
        FROM archon_crawled_pages cp
        WHERE cp.metadata @> $4
            AND ($5 IS NULL OR cp.source_id = $5)
            AND cp.content_search_vector @@ plainto_tsquery(''english'', $6)
        ORDER BY text_sim DESC
        LIMIT $3
    ),
    rrf_scores AS (
        -- Apply Reciprocal Rank Fusion (RRF) algorithm
        -- Formula: score = 1/(k + rank_vector) + 1/(k + rank_text)
        -- k = 60 (standard constant for RRF)
        SELECT
            COALESCE(v.id, t.id) AS id,
            COALESCE(v.url, t.url) AS url,
            COALESCE(v.chunk_number, t.chunk_number) AS chunk_number,
            COALESCE(v.content, t.content) AS content,
            COALESCE(v.metadata, t.metadata) AS metadata,
            COALESCE(v.source_id, t.source_id) AS source_id,
            -- RRF Score: Combine reciprocal ranks from both searches
            -- Use 999 as placeholder rank for missing results (effectively 0 contribution)
            (
                (1.0 / ($7 + COALESCE(v.vector_rank, 999))) +
                (1.0 / ($7 + COALESCE(t.text_rank, 999)))
            )::float8 AS rrf_score,
            -- Determine match type
            CASE
                WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN ''hybrid''
                WHEN v.id IS NOT NULL THEN ''vector''
                ELSE ''keyword''
            END AS match_type,
            -- Preserve original scores for debugging/analysis
            v.vector_sim AS debug_vector_score,
            t.text_sim AS debug_text_score,
            v.vector_rank AS debug_vector_rank,
            t.text_rank AS debug_text_rank
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT
        id,
        url,
        chunk_number,
        content,
        metadata,
        source_id,
        rrf_score AS similarity,  -- Return RRF score as similarity
        match_type
    FROM rrf_scores
    ORDER BY rrf_score DESC
    LIMIT $8',
    embedding_column, embedding_column, embedding_column, embedding_column);

    -- Execute dynamic query
    -- Parameters: $1=query_embedding, $2=max_vector_results, $3=max_text_results,
    --             $4=filter, $5=source_filter, $6=query_text, $7=k_constant, $8=match_count
    RETURN QUERY EXECUTE sql_query
        USING query_embedding, max_vector_results, max_text_results,
              filter, source_filter, query_text, k_constant, match_count;
END;
$$;

-- Legacy compatibility function (defaults to 1536D embeddings)
CREATE OR REPLACE FUNCTION hybrid_search_archon_crawled_pages(
    query_embedding vector(1536),
    query_text TEXT,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb,
    source_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    url VARCHAR,
    chunk_number INTEGER,
    content TEXT,
    metadata JSONB,
    source_id TEXT,
    similarity FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Call multi-dimensional function with 1536D
    RETURN QUERY SELECT * FROM hybrid_search_archon_crawled_pages_multi(
        query_embedding::vector,
        1536,
        query_text,
        match_count,
        filter,
        source_filter
    );
END;
$$;

-- Add comment explaining RRF
COMMENT ON FUNCTION hybrid_search_archon_crawled_pages_multi IS
'Hybrid search using Reciprocal Rank Fusion (RRF) to combine vector and keyword search results.
RRF formula: score = 1/(k + rank_vector) + 1/(k + rank_text) where k=60.
Returns results ranked by combined RRF score, with match_type indicating source (hybrid/vector/keyword).
Supports multi-dimensional embeddings (384D, 768D, 1024D, 1536D, 3072D).';

COMMENT ON FUNCTION hybrid_search_archon_crawled_pages IS
'Legacy hybrid search function using RRF, defaults to 1536D embeddings.
Wrapper around hybrid_search_archon_crawled_pages_multi for backward compatibility.';
