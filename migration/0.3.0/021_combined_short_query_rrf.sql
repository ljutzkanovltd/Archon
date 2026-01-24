-- Combined: Short Query Validation + RRF Scoring
-- This combines the best of both migrations

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
    k_constant INT := 60;  -- RRF constant
BEGIN
    -- Determine which embedding column to use
    CASE embedding_dimension
        WHEN 384 THEN embedding_column := 'embedding_384';
        WHEN 768 THEN embedding_column := 'embedding_768';
        WHEN 1024 THEN embedding_column := 'embedding_1024';
        WHEN 1536 THEN embedding_column := 'embedding_1536';
        WHEN 3072 THEN embedding_column := 'embedding_3072';
        WHEN 3584 THEN embedding_column := 'embedding_3584';
        ELSE RAISE EXCEPTION 'Unsupported embedding dimension: %', embedding_dimension;
    END CASE;

    -- Fetch more results for reranking
    max_vector_results := match_count * 2;
    max_text_results := match_count * 2;

    -- Check if query is too short for full-text search (<4 characters)
    is_short_query := LENGTH(TRIM(query_text)) < 4;

    IF is_short_query THEN
        -- SHORT QUERY PATH: Vector search only (text search skipped)
        sql_query := format('
        SELECT
            cp.id,
            cp.url,
            cp.chunk_number,
            cp.content,
            cp.metadata,
            cp.source_id,
            1 - (cp.%I <=> $1) AS similarity,
            ''vector'' AS match_type
        FROM archon_crawled_pages cp
        WHERE cp.metadata @> $4
            AND ($5 IS NULL OR cp.source_id = $5)
            AND cp.%I IS NOT NULL
        ORDER BY cp.%I <=> $1
        LIMIT $2',
        embedding_column, embedding_column, embedding_column);

        -- Execute vector-only query for short queries
        RETURN QUERY EXECUTE sql_query USING query_embedding, match_count, max_text_results, filter, source_filter, query_text, k_constant;
    ELSE
        -- NORMAL QUERY PATH: Hybrid search with RRF scoring
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
                (
                    (1.0 / ($7 + COALESCE(v.vector_rank, 999))) +
                    (1.0 / ($7 + COALESCE(t.text_rank, 999)))
                )::float8 AS rrf_score,
                CASE
                    WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN ''hybrid''
                    WHEN v.id IS NOT NULL THEN ''vector''
                    ELSE ''keyword''
                END AS match_type
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
            rrf_score AS similarity,
            match_type
        FROM rrf_scores
        ORDER BY rrf_score DESC
        LIMIT $2',
        embedding_column, embedding_column, embedding_column, embedding_column);

        -- Execute RRF hybrid query for normal queries
        RETURN QUERY EXECUTE sql_query USING query_embedding, max_vector_results, max_text_results, filter, source_filter, query_text, k_constant;
    END IF;
END;
$$;

-- Same for code examples
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
    k_constant INT := 60;
BEGIN
    CASE embedding_dimension
        WHEN 384 THEN embedding_column := 'embedding_384';
        WHEN 768 THEN embedding_column := 'embedding_768';
        WHEN 1024 THEN embedding_column := 'embedding_1024';
        WHEN 1536 THEN embedding_column := 'embedding_1536';
        WHEN 3072 THEN embedding_column := 'embedding_3072';
        WHEN 3584 THEN embedding_column := 'embedding_3584';
        ELSE RAISE EXCEPTION 'Unsupported embedding dimension: %', embedding_dimension;
    END CASE;

    max_vector_results := match_count * 2;
    max_text_results := match_count * 2;
    is_short_query := LENGTH(TRIM(query_text)) < 4;

    IF is_short_query THEN
        sql_query := format('
        SELECT
            ce.id,
            ce.url,
            ce.chunk_number,
            ce.content,
            ce.summary,
            ce.metadata,
            ce.source_id,
            1 - (ce.%I <=> $1) AS similarity,
            ''vector'' AS match_type
        FROM archon_code_examples ce
        WHERE ce.metadata @> $4
            AND ($5 IS NULL OR ce.source_id = $5)
            AND ce.%I IS NOT NULL
        ORDER BY ce.%I <=> $1
        LIMIT $2',
        embedding_column, embedding_column, embedding_column);

        RETURN QUERY EXECUTE sql_query USING query_embedding, match_count, max_text_results, filter, source_filter, query_text, k_constant;
    ELSE
        sql_query := format('
        WITH vector_results AS (
            SELECT
                ce.id, ce.url, ce.chunk_number, ce.content, ce.summary,
                ce.metadata, ce.source_id,
                1 - (ce.%I <=> $1) AS vector_sim,
                ROW_NUMBER() OVER (ORDER BY ce.%I <=> $1) AS vector_rank
            FROM archon_code_examples ce
            WHERE ce.metadata @> $4
                AND ($5 IS NULL OR ce.source_id = $5)
                AND ce.%I IS NOT NULL
            ORDER BY ce.%I <=> $1
            LIMIT $2
        ),
        text_results AS (
            SELECT
                ce.id, ce.url, ce.chunk_number, ce.content, ce.summary,
                ce.metadata, ce.source_id,
                ts_rank_cd(ce.content_search_vector, plainto_tsquery(''english'', $6)) AS text_sim,
                ROW_NUMBER() OVER (ORDER BY ts_rank_cd(ce.content_search_vector, plainto_tsquery(''english'', $6)) DESC) AS text_rank
            FROM archon_code_examples ce
            WHERE ce.metadata @> $4
                AND ($5 IS NULL OR ce.source_id = $5)
                AND ce.content_search_vector @@ plainto_tsquery(''english'', $6)
            ORDER BY text_sim DESC
            LIMIT $3
        ),
        rrf_scores AS (
            SELECT
                COALESCE(v.id, t.id) AS id,
                COALESCE(v.url, t.url) AS url,
                COALESCE(v.chunk_number, t.chunk_number) AS chunk_number,
                COALESCE(v.content, t.content) AS content,
                COALESCE(v.summary, t.summary) AS summary,
                COALESCE(v.metadata, t.metadata) AS metadata,
                COALESCE(v.source_id, t.source_id) AS source_id,
                (
                    (1.0 / ($7 + COALESCE(v.vector_rank, 999))) +
                    (1.0 / ($7 + COALESCE(t.text_rank, 999)))
                ) AS rrf_score,
                CASE
                    WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN ''hybrid''
                    WHEN v.id IS NOT NULL THEN ''vector''
                    ELSE ''keyword''
                END AS match_type
            FROM vector_results v
            FULL OUTER JOIN text_results t ON v.id = t.id
        )
        SELECT
            id, url, chunk_number, content, summary,
            metadata, source_id,
            rrf_score AS similarity,
            match_type
        FROM rrf_scores
        ORDER BY rrf_score DESC
        LIMIT $2',
        embedding_column, embedding_column, embedding_column, embedding_column);

        RETURN QUERY EXECUTE sql_query USING query_embedding, max_vector_results, max_text_results, filter, source_filter, query_text, k_constant;
    END IF;
END;
$$;
