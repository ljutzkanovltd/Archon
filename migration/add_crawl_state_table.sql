-- Migration: Add crawl state persistence table for pause/resume functionality
-- Created: 2026-01-08
-- Description: Enables pausing and resuming crawls without losing progress

-- Create crawl state table
CREATE TABLE IF NOT EXISTS archon_crawl_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    progress_id TEXT UNIQUE NOT NULL,
    source_id TEXT,
    crawl_type TEXT NOT NULL,  -- 'sitemap', 'recursive', 'llms-txt', 'single_page', 'batch'
    status TEXT NOT NULL CHECK (status IN ('paused', 'resumed', 'running')),

    -- State persistence for resume
    crawl_results JSONB DEFAULT '[]'::jsonb,  -- Accumulated pages crawled so far
    pending_urls JSONB DEFAULT '[]'::jsonb,   -- URLs still to crawl
    visited_urls JSONB DEFAULT '[]'::jsonb,   -- URLs already visited (deduplication)
    current_depth INTEGER DEFAULT 0,
    max_depth INTEGER,

    -- Progress tracking
    pages_crawled INTEGER DEFAULT 0,
    total_pages INTEGER DEFAULT 0,
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),

    -- Request metadata for resume
    original_request JSONB NOT NULL,  -- Full crawl request to recreate crawler

    -- Timestamps
    paused_at TIMESTAMP WITH TIME ZONE,
    resumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Foreign key (optional - source might not exist yet)
    FOREIGN KEY (source_id) REFERENCES archon_sources(source_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crawl_state_progress_id ON archon_crawl_state(progress_id);
CREATE INDEX IF NOT EXISTS idx_crawl_state_status ON archon_crawl_state(status);
CREATE INDEX IF NOT EXISTS idx_crawl_state_source_id ON archon_crawl_state(source_id);
CREATE INDEX IF NOT EXISTS idx_crawl_state_created_at ON archon_crawl_state(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_crawl_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_crawl_state_updated_at
    BEFORE UPDATE ON archon_crawl_state
    FOR EACH ROW
    EXECUTE FUNCTION update_crawl_state_updated_at();

-- Add RLS policies for security
ALTER TABLE archon_crawl_state ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Allow authenticated users full access to crawl state"
    ON archon_crawl_state
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to crawl state"
    ON archon_crawl_state
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- Add comment
COMMENT ON TABLE archon_crawl_state IS 'Stores crawl state for pause/resume functionality';
