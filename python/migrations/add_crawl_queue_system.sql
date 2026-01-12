-- Migration: Add Crawl Queue System
-- Date: 2026-01-12
-- Purpose: Production-grade queue system for batch crawling with retry logic and human-in-the-loop failure handling

-- Create archon_crawl_batches table
CREATE TABLE IF NOT EXISTS archon_crawl_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_sources INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create archon_crawl_queue table
CREATE TABLE IF NOT EXISTS archon_crawl_queue (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID,
    source_id TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    priority INTEGER NOT NULL DEFAULT 50,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    error_type VARCHAR(50) CHECK (error_type IN ('network', 'rate_limit', 'parse_error', 'timeout', 'other')),
    error_details JSONB,
    requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_queue_batch
        FOREIGN KEY (batch_id)
        REFERENCES archon_crawl_batches(batch_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_queue_source
        FOREIGN KEY (source_id)
        REFERENCES archon_sources(source_id)
        ON DELETE CASCADE
);

-- Add indexes for efficient queue operations
CREATE INDEX IF NOT EXISTS idx_crawl_queue_status_priority
ON archon_crawl_queue(status, priority DESC, created_at ASC)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_crawl_queue_batch_id
ON archon_crawl_queue(batch_id);

CREATE INDEX IF NOT EXISTS idx_crawl_queue_source_id
ON archon_crawl_queue(source_id);

CREATE INDEX IF NOT EXISTS idx_crawl_queue_next_retry
ON archon_crawl_queue(next_retry_at)
WHERE status = 'failed' AND retry_count < max_retries;

CREATE INDEX IF NOT EXISTS idx_crawl_queue_human_review
ON archon_crawl_queue(requires_human_review, created_at DESC)
WHERE requires_human_review = TRUE;

CREATE INDEX IF NOT EXISTS idx_crawl_queue_error_type
ON archon_crawl_queue(error_type)
WHERE error_type IS NOT NULL;

-- Add GIN index for JSONB error_details
CREATE INDEX IF NOT EXISTS idx_crawl_queue_error_details_gin
ON archon_crawl_queue USING GIN (error_details);

-- Add indexes for archon_crawl_batches
CREATE INDEX IF NOT EXISTS idx_crawl_batches_status
ON archon_crawl_batches(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawl_batches_created_at
ON archon_crawl_batches(created_at DESC);

-- Add GIN index for batch metadata
CREATE INDEX IF NOT EXISTS idx_crawl_batches_metadata_gin
ON archon_crawl_batches USING GIN (metadata);

-- Add comments for archon_crawl_batches
COMMENT ON TABLE archon_crawl_batches IS 'Tracks batches of crawl operations for progress monitoring';
COMMENT ON COLUMN archon_crawl_batches.batch_id IS 'Unique identifier for the batch';
COMMENT ON COLUMN archon_crawl_batches.total_sources IS 'Total number of sources in this batch';
COMMENT ON COLUMN archon_crawl_batches.completed IS 'Number of successfully completed sources';
COMMENT ON COLUMN archon_crawl_batches.failed IS 'Number of failed sources (after max retries)';
COMMENT ON COLUMN archon_crawl_batches.status IS 'Batch status: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN archon_crawl_batches.created_by IS 'User or system that created the batch';
COMMENT ON COLUMN archon_crawl_batches.created_at IS 'When the batch was created';
COMMENT ON COLUMN archon_crawl_batches.started_at IS 'When the batch processing started';
COMMENT ON COLUMN archon_crawl_batches.completed_at IS 'When the batch processing completed';
COMMENT ON COLUMN archon_crawl_batches.metadata IS 'Additional batch metadata (source types, estimated duration, etc.)';

-- Add comments for archon_crawl_queue
COMMENT ON TABLE archon_crawl_queue IS 'Queue system for managing crawl operations with retry logic and failure handling';
COMMENT ON COLUMN archon_crawl_queue.item_id IS 'Unique identifier for the queue item';
COMMENT ON COLUMN archon_crawl_queue.batch_id IS 'Batch this item belongs to (optional)';
COMMENT ON COLUMN archon_crawl_queue.source_id IS 'Source to be crawled (FK to archon_sources)';
COMMENT ON COLUMN archon_crawl_queue.status IS 'Item status: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN archon_crawl_queue.priority IS 'Priority (higher = more urgent), default 50';
COMMENT ON COLUMN archon_crawl_queue.retry_count IS 'Number of retry attempts so far';
COMMENT ON COLUMN archon_crawl_queue.max_retries IS 'Maximum retry attempts before flagging for review';
COMMENT ON COLUMN archon_crawl_queue.error_message IS 'Human-readable error message from last failure';
COMMENT ON COLUMN archon_crawl_queue.error_type IS 'Error category: network, rate_limit, parse_error, timeout, other';
COMMENT ON COLUMN archon_crawl_queue.error_details IS 'Detailed error information (stack trace, response, etc.)';
COMMENT ON COLUMN archon_crawl_queue.requires_human_review IS 'Flagged for human intervention after max retries';
COMMENT ON COLUMN archon_crawl_queue.created_at IS 'When the item was added to queue';
COMMENT ON COLUMN archon_crawl_queue.started_at IS 'When crawling started';
COMMENT ON COLUMN archon_crawl_queue.completed_at IS 'When crawling completed successfully';
COMMENT ON COLUMN archon_crawl_queue.last_retry_at IS 'When the last retry attempt was made';
COMMENT ON COLUMN archon_crawl_queue.next_retry_at IS 'When the next retry should be attempted (exponential backoff)';

-- Add queue configuration settings
INSERT INTO archon_settings (key, value, category, description)
VALUES
    ('QUEUE_WORKER_ENABLED', 'true', 'crawl_queue', 'Enable/disable the background queue worker')
ON CONFLICT (key) DO NOTHING;

INSERT INTO archon_settings (key, value, category, description)
VALUES
    ('QUEUE_WORKER_INTERVAL', '30', 'crawl_queue', 'Queue polling interval in seconds (default: 30)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO archon_settings (key, value, category, description)
VALUES
    ('QUEUE_BATCH_SIZE', '5', 'crawl_queue', 'Number of sources to process concurrently (default: 5)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO archon_settings (key, value, category, description)
VALUES
    ('QUEUE_RETRY_DELAYS', '[60, 300, 900]', 'crawl_queue', 'Retry delays in seconds: [1min, 5min, 15min]')
ON CONFLICT (key) DO NOTHING;

INSERT INTO archon_settings (key, value, category, description)
VALUES
    ('QUEUE_MAX_RETRIES', '3', 'crawl_queue', 'Maximum retry attempts before flagging for human review')
ON CONFLICT (key) DO NOTHING;

INSERT INTO archon_settings (key, value, category, description)
VALUES
    ('QUEUE_PRIORITY_LLMS_TXT', '100', 'crawl_queue', 'Priority for llms.txt sources (fast crawls)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO archon_settings (key, value, category, description)
VALUES
    ('QUEUE_PRIORITY_SITEMAP', '50', 'crawl_queue', 'Priority for sitemap-based crawls (slower)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO archon_settings (key, value, category, description)
VALUES
    ('QUEUE_CLEANUP_RETENTION_DAYS', '30', 'crawl_queue', 'Days to retain completed/failed queue items before cleanup')
ON CONFLICT (key) DO NOTHING;
