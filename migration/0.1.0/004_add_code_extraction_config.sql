-- Migration: Add Code Extraction Configuration to Sources
-- Date: 2026-01-14
-- Purpose: Allow per-source configuration for code extraction (min_length, filters, etc.)
--          Fixes issue where small code snippets (React Hook Form) are filtered out
-- Expected Impact: React Hook Form 0 → 50+ code examples extracted
-- =====================================================

-- Add code_extraction_config column to archon_sources
ALTER TABLE archon_sources
ADD COLUMN IF NOT EXISTS code_extraction_config JSONB DEFAULT '{}'::jsonb;

-- Add index for JSON queries
CREATE INDEX IF NOT EXISTS idx_archon_sources_code_config
ON archon_sources USING gin (code_extraction_config);

-- Add comment explaining the field
COMMENT ON COLUMN archon_sources.code_extraction_config IS
'Per-source code extraction configuration:
{
  "min_code_length": 50-250,           -- Minimum code block length (default: 250)
  "enable_small_snippets": true/false, -- Allow small snippets for tutorial-style docs
  "skip_prose_filter": true/false,     -- Skip prose content filtering
  "code_indicators_min": 1-5,          -- Minimum code indicators required (default: 3)
  "extraction_strategy": "aggressive" | "balanced" | "conservative"
}

Examples:
- Tutorial docs (React Hook Form): {"min_code_length": 50, "enable_small_snippets": true}
- API reference: {"min_code_length": 250, "extraction_strategy": "conservative"}
- Code examples site: {"min_code_length": 100, "skip_prose_filter": true}
';

-- Update React Hook Form source with config for small snippets
UPDATE archon_sources
SET code_extraction_config = jsonb_build_object(
    'min_code_length', 50,
    'enable_small_snippets', true,
    'extraction_strategy', 'aggressive',
    'description', 'Tutorial-style documentation with small code examples'
)
WHERE source_id = '28d45813188ab20e';  -- React Hook Form

-- Verify the update
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM archon_sources
    WHERE source_id = '28d45813188ab20e'
      AND code_extraction_config->>'min_code_length' = '50';

    IF updated_count = 1 THEN
        RAISE NOTICE 'Successfully configured React Hook Form for small snippets (min_code_length: 50)';
    ELSE
        RAISE WARNING 'React Hook Form configuration may not have been applied correctly';
    END IF;
END $$;
