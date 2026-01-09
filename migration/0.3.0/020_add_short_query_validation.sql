-- =====================================================
-- Phase 1.3: Add Short Query Validation
-- =====================================================
-- This migration enhances hybrid search to handle short queries
-- (e.g., "API", "JWT", "REST") by falling back to trigram search
-- when full-text search filters them out.
--
-- Problem: plainto_tsquery('english', 'API') returns 0 results
-- because 'english' config filters short words/stopwords.
--
-- Solution: For short queries (<4 chars), use trigram similarity
-- search instead of ts_vector full-text search.
-- =====================================================

-- Enhanced hybrid search for archon_crawled_pages with short query handling
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
    is_short_query BOOLEAN;
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

    -- Calculate how many results to fetch from each search type
    max_vector_results := match_count;
    max_text_results := match_count;

    -- Check if query is too short for full-text search (<4 characters)
    is_short_query := LENGTH(TRIM(query_text)) < 4;

    -- Build dynamic query with proper embedding column and short query handling
    IF is_short_query THEN
        -- SHORT QUERY PATH: Use trigram similarity instead of ts_vector
        sql_query := format('
        WITH vector_results AS (
            -- Vector similarity search
            SELECT
                cp.id,
                cp.url,
                cp.chunk_number,
                cp.content,
                cp.metadata,
                cp.source_id,
                1 - (cp.%I <=> $1) AS vector_sim
            FROM archon_crawled_pages cp
            WHERE cp.metadata @> $4
                AND ($5 IS NULL OR cp.source_id = $5)
                AND cp.%I IS NOT NULL
            ORDER BY cp.%I <=> $1
            LIMIT $2
        ),
        text_results AS (
            -- Trigram similarity search for short queries
            SELECT
                cp.id,
                cp.url,
                cp.chunk_number,
                cp.content,
                cp.metadata,
                cp.source_id,
                similarity(cp.content, $6) AS text_sim
            FROM archon_crawled_pages cp
            WHERE cp.metadata @> $4
                AND ($5 IS NULL OR cp.source_id = $5)
                AND cp.content %%  $6  -- Trigram similarity operator
            ORDER BY text_sim DESC
            LIMIT $3
        ),
        combined_results AS (
            -- Combine results from both searches
            SELECT
                COALESCE(v.id, t.id) AS id,
                COALESCE(v.url, t.url) AS url,
                COALESCE(v.chunk_number, t.chunk_number) AS chunk_number,
                COALESCE(v.content, t.content) AS content,
                COALESCE(v.metadata, t.metadata) AS metadata,
                COALESCE(v.source_id, t.source_id) AS source_id,
                -- Use vector similarity if available, otherwise text similarity
                COALESCE(v.vector_sim, t.text_sim, 0)::float8 AS similarity,
                -- Determine match type
                CASE
                    WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN ''hybrid''
                    WHEN v.id IS NOT NULL THEN ''vector''
                    ELSE ''keyword''
                END AS match_type
            FROM vector_results v
            FULL OUTER JOIN text_results t ON v.id = t.id
        )
        SELECT * FROM combined_results
        ORDER BY similarity DESC
        LIMIT $2',
        embedding_column, embedding_column, embedding_column);
    ELSE
        -- NORMAL QUERY PATH: Use ts_vector full-text search
        sql_query := format('
        WITH vector_results AS (
            -- Vector similarity search
            SELECT
                cp.id,
                cp.url,
                cp.chunk_number,
                cp.content,
                cp.metadata,
                cp.source_id,
                1 - (cp.%I <=> $1) AS vector_sim
            FROM archon_crawled_pages cp
            WHERE cp.metadata @> $4
                AND ($5 IS NULL OR cp.source_id = $5)
                AND cp.%I IS NOT NULL
            ORDER BY cp.%I <=> $1
            LIMIT $2
        ),
        text_results AS (
            -- Full-text search with ranking
            SELECT
                cp.id,
                cp.url,
                cp.chunk_number,
                cp.content,
                cp.metadata,
                cp.source_id,
                ts_rank_cd(cp.content_search_vector, plainto_tsquery(''english'', $6)) AS text_sim
            FROM archon_crawled_pages cp
            WHERE cp.metadata @> $4
                AND ($5 IS NULL OR cp.source_id = $5)
                AND cp.content_search_vector @@ plainto_tsquery(''english'', $6)
            ORDER BY text_sim DESC
            LIMIT $3
        ),
        combined_results AS (
            -- Combine results from both searches
            SELECT
                COALESCE(v.id, t.id) AS id,
                COALESCE(v.url, t.url) AS url,
                COALESCE(v.chunk_number, t.chunk_number) AS chunk_number,
                COALESCE(v.content, t.content) AS content,
                COALESCE(v.metadata, t.metadata) AS metadata,
                COALESCE(v.source_id, t.source_id) AS source_id,
                -- Use vector similarity if available, otherwise text similarity
                COALESCE(v.vector_sim, t.text_sim, 0)::float8 AS similarity,
                -- Determine match type
                CASE
                    WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN ''hybrid''
                    WHEN v.id IS NOT NULL THEN ''vector''
                    ELSE ''keyword''
                END AS match_type
            FROM vector_results v
            FULL OUTER JOIN text_results t ON v.id = t.id
        )
        SELECT * FROM combined_results
        ORDER BY similarity DESC
        LIMIT $2',
        embedding_column, embedding_column, embedding_column);
    END IF;

    -- Execute dynamic query
    RETURN QUERY EXECUTE sql_query USING query_embedding, max_vector_results, max_text_results, filter, source_filter, query_text;
END;
$$;

-- Legacy compatibility function (defaults to 1536D) - just delegates to multi
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
    RETURN QUERY SELECT * FROM hybrid_search_archon_crawled_pages_multi(query_embedding, 1536, query_text, match_count, filter, source_filter);
END;
$$;

-- Enhanced hybrid search for archon_code_examples with short query handling
CREATE OR REPLACE FUNCTION hybrid_search_archon_code_examples_multi(
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
    summary TEXT,
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
    is_short_query BOOLEAN;
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

    -- Calculate how many results to fetch from each search type
    max_vector_results := match_count;
    max_text_results := match_count;

    -- Check if query is too short for full-text search (<4 characters)
    is_short_query := LENGTH(TRIM(query_text)) < 4;

    -- Build dynamic query with proper embedding column and short query handling
    IF is_short_query THEN
        -- SHORT QUERY PATH: Use trigram similarity instead of ts_vector
        sql_query := format('
        WITH vector_results AS (
            -- Vector similarity search
            SELECT
                ce.id,
                ce.url,
                ce.chunk_number,
                ce.content,
                ce.summary,
                ce.metadata,
                ce.source_id,
                1 - (ce.%I <=> $1) AS vector_sim
            FROM archon_code_examples ce
            WHERE ce.metadata @> $4
                AND ($5 IS NULL OR ce.source_id = $5)
                AND ce.%I IS NOT NULL
            ORDER BY ce.%I <=> $1
            LIMIT $2
        ),
        text_results AS (
            -- Trigram similarity search for short queries (content and summary)
            SELECT
                ce.id,
                ce.url,
                ce.chunk_number,
                ce.content,
                ce.summary,
                ce.metadata,
                ce.source_id,
                GREATEST(
                    similarity(ce.content, $6),
                    similarity(COALESCE(ce.summary, ''''), $6)
                ) AS text_sim
            FROM archon_code_examples ce
            WHERE ce.metadata @> $4
                AND ($5 IS NULL OR ce.source_id = $5)
                AND (ce.content %% $6 OR COALESCE(ce.summary, '''') %% $6)
            ORDER BY text_sim DESC
            LIMIT $3
        ),
        combined_results AS (
            -- Combine results from both searches
            SELECT
                COALESCE(v.id, t.id) AS id,
                COALESCE(v.url, t.url) AS url,
                COALESCE(v.chunk_number, t.chunk_number) AS chunk_number,
                COALESCE(v.content, t.content) AS content,
                COALESCE(v.summary, t.summary) AS summary,
                COALESCE(v.metadata, t.metadata) AS metadata,
                COALESCE(v.source_id, t.source_id) AS source_id,
                -- Use vector similarity if available, otherwise text similarity
                COALESCE(v.vector_sim, t.text_sim, 0)::float8 AS similarity,
                -- Determine match type
                CASE
                    WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN ''hybrid''
                    WHEN v.id IS NOT NULL THEN ''vector''
                    ELSE ''keyword''
                END AS match_type
            FROM vector_results v
            FULL OUTER JOIN text_results t ON v.id = t.id
        )
        SELECT * FROM combined_results
        ORDER BY similarity DESC
        LIMIT $2',
        embedding_column, embedding_column, embedding_column);
    ELSE
        -- NORMAL QUERY PATH: Use ts_vector full-text search
        sql_query := format('
        WITH vector_results AS (
            -- Vector similarity search
            SELECT
                ce.id,
                ce.url,
                ce.chunk_number,
                ce.content,
                ce.summary,
                ce.metadata,
                ce.source_id,
                1 - (ce.%I <=> $1) AS vector_sim
            FROM archon_code_examples ce
            WHERE ce.metadata @> $4
                AND ($5 IS NULL OR ce.source_id = $5)
                AND ce.%I IS NOT NULL
            ORDER BY ce.%I <=> $1
            LIMIT $2
        ),
        text_results AS (
            -- Full-text search with ranking (searches both content and summary)
            SELECT
                ce.id,
                ce.url,
                ce.chunk_number,
                ce.content,
                ce.summary,
                ce.metadata,
                ce.source_id,
                ts_rank_cd(ce.content_search_vector, plainto_tsquery(''english'', $6)) AS text_sim
            FROM archon_code_examples ce
            WHERE ce.metadata @> $4
                AND ($5 IS NULL OR ce.source_id = $5)
                AND ce.content_search_vector @@ plainto_tsquery(''english'', $6)
            ORDER BY text_sim DESC
            LIMIT $3
        ),
        combined_results AS (
            -- Combine results from both searches
            SELECT
                COALESCE(v.id, t.id) AS id,
                COALESCE(v.url, t.url) AS url,
                COALESCE(v.chunk_number, t.chunk_number) AS chunk_number,
                COALESCE(v.content, t.content) AS content,
                COALESCE(v.summary, t.summary) AS summary,
                COALESCE(v.metadata, t.metadata) AS metadata,
                COALESCE(v.source_id, t.source_id) AS source_id,
                -- Use vector similarity if available, otherwise text similarity
                COALESCE(v.vector_sim, t.text_sim, 0)::float8 AS similarity,
                -- Determine match type
                CASE
                    WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN ''hybrid''
                    WHEN v.id IS NOT NULL THEN ''vector''
                    ELSE ''keyword''
                END AS match_type
            FROM vector_results v
            FULL OUTER JOIN text_results t ON v.id = t.id
        )
        SELECT * FROM combined_results
        ORDER BY similarity DESC
        LIMIT $2',
        embedding_column, embedding_column, embedding_column);
    END IF;

    -- Execute dynamic query
    RETURN QUERY EXECUTE sql_query USING query_embedding, max_vector_results, max_text_results, filter, source_filter, query_text;
END;
$$;

-- Legacy compatibility function (defaults to 1536D) - just delegates to multi
CREATE OR REPLACE FUNCTION hybrid_search_archon_code_examples(
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
    summary TEXT,
    metadata JSONB,
    source_id TEXT,
    similarity FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY SELECT * FROM hybrid_search_archon_code_examples_multi(query_embedding, 1536, query_text, match_count, filter, source_filter);
END;
$$;

-- Update comments
COMMENT ON FUNCTION hybrid_search_archon_crawled_pages_multi IS
'Enhanced hybrid search with short query handling (<4 chars). Uses trigram similarity for short queries, ts_vector for normal queries.';

COMMENT ON FUNCTION hybrid_search_archon_code_examples_multi IS
'Enhanced hybrid search on code examples with short query handling. Uses trigram similarity for short queries, ts_vector for normal queries.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Short queries like "API", "JWT", "REST" now work!
-- Queries <4 characters use trigram similarity.
-- Queries >=4 characters use full-text search.
-- =====================================================
