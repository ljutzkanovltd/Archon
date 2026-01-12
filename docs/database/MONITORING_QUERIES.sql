-- =============================================================================
-- Archon Performance Monitoring Queries
-- =============================================================================
-- Purpose: Track memory usage, identify performance bottlenecks, and monitor
--          crawl queue operations during bulk re-crawling.
--
-- Usage: Run these queries periodically or integrate into monitoring dashboards
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MEMORY & RESOURCE MONITORING
-- -----------------------------------------------------------------------------

-- Check database size and memory usage
SELECT
    pg_size_pretty(pg_database_size(current_database())) AS database_size,
    pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||relname))) AS archon_tables_size
FROM pg_stat_user_tables
WHERE relname LIKE 'archon_%';

-- Check table sizes with index breakdown
SELECT
    schemaname,
    relname as tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname) - pg_relation_size(schemaname||'.'||relname)) AS index_size,
    n_live_tup AS row_count,
    n_dead_tup AS dead_rows,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_row_percent
FROM pg_stat_user_tables
WHERE relname LIKE 'archon_%'
ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC;

-- Check for table bloat (dead rows that need VACUUM)
SELECT
    schemaname,
    relname,
    n_live_tup,
    n_dead_tup,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_row_percent,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE relname LIKE 'archon_%'
  AND n_dead_tup > 1000
ORDER BY n_dead_tup DESC;

-- Check active connections and queries
SELECT
    pid,
    usename,
    application_name,
    state,
    query_start,
    state_change,
    EXTRACT(EPOCH FROM (now() - query_start)) AS query_duration_seconds,
    LEFT(query, 100) AS query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
ORDER BY query_start DESC;

-- Check for long-running queries (> 30 seconds)
SELECT
    pid,
    now() - query_start AS duration,
    usename,
    query
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '30 seconds'
ORDER BY duration DESC;

-- -----------------------------------------------------------------------------
-- 2. CRAWL QUEUE MONITORING
-- -----------------------------------------------------------------------------

-- Overall queue status
SELECT
    status,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM archon_crawl_queue
GROUP BY status
ORDER BY count DESC;

-- Queue items by error type
SELECT
    error_type,
    COUNT(*) as count,
    ROUND(AVG(retry_count), 2) AS avg_retries,
    COUNT(*) FILTER (WHERE requires_human_review) AS requiring_review
FROM archon_crawl_queue
WHERE error_type IS NOT NULL
GROUP BY error_type
ORDER BY count DESC;

-- Queue items requiring human review
SELECT
    item_id,
    source_id,
    error_type,
    error_message,
    retry_count,
    created_at,
    last_retry_at
FROM archon_crawl_queue
WHERE requires_human_review = true
ORDER BY created_at DESC;

-- Batch progress summary
SELECT
    b.batch_id,
    b.status AS batch_status,
    b.total_items,
    b.completed_items,
    b.failed_items,
    ROUND(100.0 * b.completed_items / NULLIF(b.total_items, 0), 2) AS completion_percent,
    b.started_at,
    b.completed_at,
    CASE
        WHEN b.completed_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (b.completed_at - b.started_at)) / 60.0
        ELSE
            EXTRACT(EPOCH FROM (NOW() - b.started_at)) / 60.0
    END AS duration_minutes
FROM archon_crawl_batches b
ORDER BY b.started_at DESC;

-- Items stuck in 'running' state (potential crashes)
SELECT
    item_id,
    source_id,
    status,
    started_at,
    EXTRACT(EPOCH FROM (NOW() - started_at)) / 60.0 AS running_minutes
FROM archon_crawl_queue
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '30 minutes'
ORDER BY started_at ASC;

-- Upcoming retry schedule
SELECT
    item_id,
    source_id,
    retry_count,
    max_retries,
    error_type,
    next_retry_at,
    EXTRACT(EPOCH FROM (next_retry_at - NOW())) / 60.0 AS minutes_until_retry
FROM archon_crawl_queue
WHERE status = 'failed'
  AND retry_count < max_retries
  AND next_retry_at IS NOT NULL
ORDER BY next_retry_at ASC
LIMIT 20;

-- -----------------------------------------------------------------------------
-- 3. CRAWL PERFORMANCE METRICS
-- -----------------------------------------------------------------------------

-- Source crawl statistics
SELECT
    s.source_id,
    s.source_display_name,
    s.source_url,
    COUNT(DISTINCT cp.page_id) AS pages_crawled,
    COUNT(DISTINCT ce.id) AS code_examples_extracted,
    MAX(cp.crawled_at) AS last_crawled_at,
    pg_size_pretty(SUM(LENGTH(cp.markdown_content))) AS total_content_size
FROM archon_sources s
LEFT JOIN archon_crawled_pages cp ON s.source_id = cp.source_id
LEFT JOIN archon_code_examples ce ON s.source_id = ce.source_id
GROUP BY s.source_id, s.source_display_name, s.source_url
ORDER BY pages_crawled DESC;

-- Page metadata aggregation by source
SELECT
    s.source_id,
    s.source_display_name,
    COUNT(pm.id) AS total_pages,
    ROUND(AVG(pm.word_count), 0) AS avg_word_count,
    MIN(pm.created_at) AS first_indexed,
    MAX(pm.created_at) AS last_indexed
FROM archon_sources s
LEFT JOIN archon_page_metadata pm ON s.source_id = pm.source_id
GROUP BY s.source_id, s.source_display_name
ORDER BY total_pages DESC;

-- Embedding distribution by model and dimension
SELECT
    embedding_model,
    embedding_dimension,
    COUNT(*) as count,
    pg_size_pretty(SUM(octet_length(embedding_768::text))) AS approx_size
FROM archon_crawled_pages
WHERE embedding_768 IS NOT NULL
GROUP BY embedding_model, embedding_dimension
ORDER BY count DESC;

-- Code examples by language
SELECT
    metadata->>'language' AS language,
    COUNT(*) AS count,
    ROUND(AVG(LENGTH(content)), 0) AS avg_length
FROM archon_code_examples
WHERE metadata->>'language' IS NOT NULL
GROUP BY metadata->>'language'
ORDER BY count DESC
LIMIT 20;

-- -----------------------------------------------------------------------------
-- 4. SLOW QUERY DETECTION
-- -----------------------------------------------------------------------------

-- Find queries with high execution time (requires pg_stat_statements extension)
-- Note: This requires pg_stat_statements to be enabled
-- Add to postgresql.conf: shared_preload_libraries = 'pg_stat_statements'
/*
SELECT
    query,
    calls,
    total_exec_time / 1000.0 AS total_exec_time_seconds,
    mean_exec_time / 1000.0 AS mean_exec_time_seconds,
    max_exec_time / 1000.0 AS max_exec_time_seconds
FROM pg_stat_statements
WHERE query LIKE '%archon_%'
ORDER BY mean_exec_time DESC
LIMIT 20;
*/

-- Check for missing indexes (sequential scans on large tables)
SELECT
    schemaname,
    relname,
    seq_scan,
    seq_tup_read,
    idx_scan,
    seq_tup_read / NULLIF(seq_scan, 0) AS avg_seq_tup_per_scan,
    n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname LIKE 'archon_%'
  AND seq_scan > 0
  AND n_live_tup > 1000
ORDER BY seq_tup_read DESC;

-- Check index usage efficiency
SELECT
    schemaname,
    relname,
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND relname LIKE 'archon_%'
ORDER BY idx_scan DESC;

-- Identify unused indexes (candidates for removal)
SELECT
    schemaname,
    relname,
    indexrelname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND relname LIKE 'archon_%'
  AND idx_scan = 0
  AND pg_relation_size(indexrelid) > 65536  -- Larger than 64KB
ORDER BY pg_relation_size(indexrelid) DESC;

-- -----------------------------------------------------------------------------
-- 5. PERFORMANCE BASELINES
-- -----------------------------------------------------------------------------

-- Baseline: Queue polling query (should be < 1ms)
EXPLAIN ANALYZE
SELECT item_id, source_id, status, priority, retry_count, max_retries,
       error_message, error_type, created_at, next_retry_at
FROM archon_crawl_queue
WHERE status = 'pending'
ORDER BY priority DESC, created_at ASC
LIMIT 5;

-- Baseline: Batch progress query (should be < 1ms)
EXPLAIN ANALYZE
SELECT
    batch_id,
    COUNT(*) as total_items,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
FROM archon_crawl_queue
WHERE batch_id = (SELECT batch_id FROM archon_crawl_queue LIMIT 1)
GROUP BY batch_id;

-- Baseline: Source lookup query (should be < 1ms)
EXPLAIN ANALYZE
SELECT *
FROM archon_sources
WHERE source_id IN (
    SELECT DISTINCT source_id
    FROM archon_crawl_queue
    WHERE status = 'pending'
    LIMIT 5
);

-- -----------------------------------------------------------------------------
-- 6. VACUUM & MAINTENANCE RECOMMENDATIONS
-- -----------------------------------------------------------------------------

-- Tables that need VACUUM (>10% dead rows)
SELECT
    schemaname,
    relname,
    n_live_tup,
    n_dead_tup,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_row_percent,
    last_vacuum,
    last_autovacuum,
    CASE
        WHEN ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) > 20 THEN 'VACUUM ANALYZE ' || relname || ';'
        WHEN ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) > 10 THEN 'ANALYZE ' || relname || ';'
        ELSE 'No action needed'
    END AS recommended_action
FROM pg_stat_user_tables
WHERE relname LIKE 'archon_%'
  AND n_live_tup > 100
ORDER BY dead_row_percent DESC NULLS LAST;

-- Index bloat estimation
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS index_scans,
    CASE
        WHEN idx_scan = 0 AND pg_relation_size(indexrelid) > 65536 THEN 'Consider removing'
        WHEN idx_scan < 100 THEN 'Low usage - monitor'
        ELSE 'Actively used'
    END AS usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'archon_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- =============================================================================
-- END OF MONITORING QUERIES
-- =============================================================================

-- USAGE EXAMPLES:
--
-- 1. Quick health check:
--    Run sections 1 (Memory) and 2 (Queue Status)
--
-- 2. During active crawling:
--    Monitor sections 2 (Queue) and 3 (Performance) every 5 minutes
--
-- 3. Post-crawl analysis:
--    Run sections 3 (Performance) and 6 (Maintenance)
--
-- 4. Performance troubleshooting:
--    Run sections 4 (Slow Queries) and 5 (Baselines)
--
-- =============================================================================
