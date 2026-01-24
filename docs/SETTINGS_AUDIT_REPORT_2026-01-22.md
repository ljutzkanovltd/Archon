# Archon Settings Audit Report
**Date:** 2026-01-22  
**Task:** 1.1 - Audit archon_settings table and verify defaults  
**Status:** COMPLETE

## Executive Summary

**Critical Finding:** `ENABLE_CHUNKING` setting does NOT exist in codebase or database.
- Chunking may be **always-on** or controlled elsewhere
- No toggle to enable/disable chunking found
- Need to verify chunking logic directly

## Database State

**Total Settings:** 96 settings across 10 categories

**Settings by Category:**
- `api_keys`: 8 settings (API keys for various providers)
- `azure_config`: 6 settings (Azure OpenAI configuration)
- `code_extraction`: 11 settings ✅ (Complete)
- `crawl`: 13 settings ✅ (Complete, includes CRAWL_EXTRACT_CODE_EXAMPLES: true)
- `crawl_queue`: 7 settings ✅ (Queue worker enabled)
- `features`: 8 settings (Feature flags)
- `mcp`: 5 settings (MCP integration)
- `mcp_monitoring`: 3 settings (Monitoring thresholds)
- `rag_strategy`: 31 settings ✅ (RAG pipeline configuration)
- `server_config`: 3 settings (Server transport)

## Critical Settings Status

### ✅ PRESENT and CORRECT:
1. **CRAWL_EXTRACT_CODE_EXAMPLES:** `true` (in `crawl` category)
   - Maps to `extract_code_examples` in settings_service.py line 54
   - Code extraction SHOULD be working

2. **Code Validation Thresholds** (in `code_extraction` category):
   - MIN_CODE_BLOCK_LENGTH: 250 ⚠️ (TOO STRICT for docs)
   - MAX_CODE_BLOCK_LENGTH: 5000 ✅
   - MAX_PROSE_RATIO: 0.15 ⚠️ (15%, should be 30% for docs)
   - MIN_CODE_INDICATORS: 3 ⚠️ (should be 2 for simple examples)
   - ENABLE_CODE_SUMMARIES: true ✅
   - ENABLE_PROSE_FILTERING: true ✅
   - ENABLE_DIAGRAM_FILTERING: true ✅

3. **Queue Worker Settings** (in `crawl_queue` category):
   - QUEUE_WORKER_ENABLED: true ✅
   - QUEUE_WORKER_INTERVAL: 30 seconds ✅
   - QUEUE_BATCH_SIZE: 5 ✅
   - QUEUE_MAX_RETRIES: 3 ✅

4. **Document Storage Settings** (in `rag_strategy` category):
   - DOCUMENT_STORAGE_BATCH_SIZE: 100 ✅
   - EMBEDDING_BATCH_SIZE: 200 ✅
   - DELETE_BATCH_SIZE: 100 ✅

### ❌ MISSING:
1. **ENABLE_CHUNKING** - Not found in:
   - archon_settings table ❌
   - settings_service.py DEFAULT_SETTINGS ❌
   - Any Python file in `python/src/server/services/` ❌

### ⚠️ NEEDS OPTIMIZATION:
1. **MIN_CODE_BLOCK_LENGTH:** 250 → Should be 100 (docs have short snippets)
2. **MAX_PROSE_RATIO:** 0.15 → Should be 0.30 (30% for documentation)
3. **MIN_CODE_INDICATORS:** 3 → Should be 2 (simple examples)

## Comparison with settings_service.py Defaults

**File:** `python/src/server/services/settings_service.py`

**DEFAULT_SETTINGS Mapping:**
```python
# Line 54: extract_code_examples exists in defaults
"extract_code_examples": True,

# Line 110: Maps to database key
"crawl.extract_code_examples": {
    "key": "CRAWL_EXTRACT_CODE_EXAMPLES",
    "category": "crawl",
    "encrypted": False
}
```

**No ENABLE_CHUNKING in defaults** - confirms it's not a configurable setting.

## Investigation Needed

### Why is ENABLE_CHUNKING missing?
**Hypothesis 1:** Chunking is always enabled (no toggle)
- Check `document_storage_service.py` for chunking logic
- Verify if chunking happens unconditionally

**Hypothesis 2:** Chunking control is elsewhere
- Perhaps in crawling_service.py request parameters
- Check if there's a per-source metadata flag

**Hypothesis 3:** Chunking was never implemented as configurable
- Original Archon may not have ENABLE_CHUNKING setting
- Check original repository

## Recommendations

### Immediate Actions:
1. **Verify chunking logic** in `document_storage_service.py`
   - Does it always chunk?
   - Is there a conditional check we're missing?

2. **Test chunking directly** with a single page
   - Create test script to chunk sample content
   - Verify chunks are created

3. **Add ENABLE_CHUNKING setting** (if needed)
   - Add to settings_service.py defaults
   - Add to archon_settings table
   - Update chunking logic to check setting

### Optimization (Task 1.3):
1. **Lower MIN_CODE_BLOCK_LENGTH** from 250 → 100
2. **Increase MAX_PROSE_RATIO** from 0.15 → 0.30
3. **Reduce MIN_CODE_INDICATORS** from 3 → 2

## SQL Queries Used

```sql
-- Get all settings
SELECT key, value, category, description
FROM archon_settings
ORDER BY category, key;

-- Count total settings
SELECT COUNT(*) FROM archon_settings;

-- Find chunking/code-related settings
SELECT key FROM archon_settings 
WHERE key LIKE '%CRAWL%' OR key LIKE '%CHUNK%' OR key LIKE '%CODE%';
```

## Files Reviewed

1. `/home/ljutzkanov/Documents/Projects/archon/python/src/server/services/settings_service.py`
   - Lines 23-78: DEFAULT_SETTINGS definition
   - Lines 82-133: SETTINGS_KEY_MAPPING
   - Confirms `extract_code_examples` exists, `ENABLE_CHUNKING` does not

2. Database table: `archon_settings`
   - 96 total settings
   - Complete code extraction settings
   - No ENABLE_CHUNKING setting

## Next Steps

**Task 1.2:** Add missing settings (if needed after chunking verification)
**Task 1.3:** Optimize validation thresholds
**Task 3.1:** Diagnose why chunking produces 0 chunks (priority!)
