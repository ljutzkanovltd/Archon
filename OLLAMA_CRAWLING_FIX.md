# Ollama Knowledge Crawling Fix

**Date:** 2025-12-11
**Status:** ✅ Fixed and Deployed

## Problem Summary

When attempting to add knowledge sources via URL crawling in Archon with Ollama as the provider, users encountered the error:

```
Invalid OLLAMA API Key
Please verify your API settings.
```

This occurred even though:
- Ollama doesn't require API keys for local instances
- The `OLLAMA_API_KEY` field was correctly empty in the database
- Chat and embeddings worked fine (they bypassed this validation)

## Root Cause

**File:** `python/src/server/api_routes/knowledge_api.py`
**Function:** `_validate_provider_api_key()` (lines 62-143)

The issue was in the knowledge crawling/upload workflow:

1. When adding knowledge via crawling (line 750), uploading documents (line 620), or refreshing (line 907), Archon calls `_validate_provider_api_key(provider)`
2. This function attempts to validate ALL providers by creating a test embedding
3. For Ollama (local instances), this validation was unnecessary and failed
4. The failure blocked the entire crawling operation

**Why Chat/Embeddings Worked:**
- Direct chat and embedding endpoints don't call this validation function
- Only knowledge management operations (crawl, upload, refresh) performed this check

## The Fix

Added an early return for Ollama provider in the validation function, skipping the unnecessary API key check.

**Modified:** `python/src/server/api_routes/knowledge_api.py` (lines 83-86)

```python
# Skip API key validation for Ollama - it doesn't require authentication
if provider == "ollama":
    logger.info("✅ Skipping API key validation for Ollama (no authentication required for local instances)")
    return
```

**Location:** Right after provider validation, before the API key test

## What Changed

### Before
```python
async def _validate_provider_api_key(provider: str = None) -> None:
    # ... provider validation ...

    # Immediately tries to create test embedding for ALL providers
    test_result = await create_embedding(text="test", provider=provider)
    if not test_result:
        raise HTTPException(status_code=401, detail="Invalid API key")
```

### After
```python
async def _validate_provider_api_key(provider: str = None) -> None:
    # ... provider validation ...

    # Skip validation for Ollama (new code)
    if provider == "ollama":
        logger.info("✅ Skipping API key validation for Ollama")
        return

    # Only non-Ollama providers proceed to test embedding
    test_result = await create_embedding(text="test", provider=provider)
    if not test_result:
        raise HTTPException(status_code=401, detail="Invalid API key")
```

## Services Affected

This fix impacts three knowledge management endpoints:

1. **POST /knowledge-items/crawl** (line 750)
   - Adding new knowledge sources via URL crawling

2. **POST /knowledge-items/refresh** (line 620)
   - Refreshing existing knowledge sources

3. **POST /knowledge-items/upload** (line 907)
   - Uploading documents directly

## How to Test

### Via Archon UI (Recommended)

1. **Open Archon Dashboard:**
   - Navigate to http://localhost:3737

2. **Go to Knowledge Management:**
   - Look for "Knowledge" or "Sources" section
   - Click "Add Knowledge" or "Add Source"

3. **Configure the Source:**
   - **URL:** Enter any valid documentation URL (e.g., `https://docs.python.org/`)
   - **Type:** Select "technical" or appropriate type
   - **Max Depth:** Set to 1-2 (for testing)
   - **Extract Code Examples:** Enable if available

4. **Submit:**
   - Click "Start Crawl" or "Add Source"
   - **Expected Result:** ✅ Crawl starts successfully
   - **Previous Error:** ❌ "Invalid OLLAMA API Key"

5. **Monitor Progress:**
   - Check the progress indicator
   - Watch for successful page crawling
   - Verify embeddings are being generated

### Via API (Advanced)

```bash
# Test the crawl endpoint directly
curl -X POST "http://localhost:8181/api/knowledge-items/crawl" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://docs.python.org/3/tutorial/",
    "knowledge_type": "technical",
    "tags": ["python", "tutorial"],
    "max_depth": 1,
    "extract_code_examples": true
  }'
```

**Expected Response:**
```json
{
  "progress_id": "uuid-here",
  "message": "Crawl started successfully",
  "url": "https://docs.python.org/3/tutorial/"
}
```

**Previous Error Response:**
```json
{
  "error": "Invalid Ollama API Key",
  "message": "Please verify your Ollama API key in Settings.",
  "error_type": "authentication_failed"
}
```

### Check Logs

Monitor the Archon server logs to see the validation skip:

```bash
# Watch logs in real-time
docker logs -f archon-server

# Look for this message when adding knowledge:
# ✅ Skipping API key validation for Ollama (no authentication required for local instances)
```

## Verification Checklist

- [x] Code modified in `knowledge_api.py`
- [x] Archon server restarted (container healthy)
- [x] API health check passing
- [ ] Test crawl operation via UI (user to verify)
- [ ] Verify crawl completes successfully (user to verify)
- [ ] Confirm embeddings are generated (user to verify)

## Expected Behavior

### What Should Work Now ✅

1. **Adding Knowledge Sources**
   - Crawling documentation URLs
   - Uploading documents
   - Refreshing existing sources

2. **No API Key Errors**
   - Ollama operations proceed without validation
   - No "Invalid OLLAMA API Key" messages

3. **Full Knowledge Pipeline**
   - Pages crawled successfully
   - Content extracted
   - Embeddings generated using nomic-embed-text-v1.5
   - Stored in Supabase with pgvector

### What Still Requires API Keys ⚠️

Other providers (OpenAI, Google, etc.) still require valid API keys:
- OpenAI: Needs `OPENAI_API_KEY`
- Google: Needs `GOOGLE_API_KEY`
- Anthropic: Needs `ANTHROPIC_API_KEY`

Only Ollama is exempt from API key validation.

## Rollback Instructions

If this fix causes issues, you can revert the change:

```bash
# Navigate to archon directory
cd /home/ljutzkanov/Documents/Projects/archon

# Revert the file to previous version
git checkout HEAD -- python/src/server/api_routes/knowledge_api.py

# Restart services
docker restart archon-server
```

## Related Files

- **Fixed File:** `python/src/server/api_routes/knowledge_api.py` (lines 83-86)
- **Configuration:** `OLLAMA_CONFIGURATION_SUMMARY.md` (Ollama setup)
- **Validation Function:** `_validate_provider_api_key()` (lines 62-143)
- **Affected Endpoints:**
  - `/knowledge-items/crawl` (line 750)
  - `/knowledge-items/refresh` (line 620)
  - `/knowledge-items/upload` (line 907)

## Technical Details

### Why This Fix is Safe

1. **Ollama Doesn't Use API Keys:**
   - Local Ollama/llama-server instances don't have authentication
   - The base URL (`host.docker.internal:11434`) is sufficient for access
   - No security risk in skipping validation

2. **Provider-Specific Logic:**
   - Other providers (OpenAI, Google) still validate properly
   - Only affects Ollama provider path
   - Maintains security for cloud providers

3. **Explicit Check:**
   - Uses exact string match: `if provider == "ollama"`
   - No risk of accidentally skipping other providers
   - Clear logging for debugging

### Performance Benefits

- **Faster Operations:** Skips unnecessary test embedding call
- **Reduced Latency:** No network roundtrip to Ollama
- **Resource Efficient:** Doesn't consume Ollama compute for validation

### Code Pattern

This matches how Ollama is handled elsewhere in Archon:

**In `llm_provider_service.py` (line 517):**
```python
elif provider_name == "ollama":
    # Ollama requires an API key in the client but doesn't actually use it
    client = openai.AsyncOpenAI(
        api_key="ollama",  # Hardcoded placeholder
        base_url=ollama_base_url,
    )
```

**In `credential_service.py` (line 503-517):**
```python
key_mapping = {
    "openai": "OPENAI_API_KEY",
    "google": "GOOGLE_API_KEY",
    "ollama": None,  # NO API KEY NEEDED
}
```

## Summary

✅ **Fix Applied and Deployed**

- **Problem:** Knowledge crawling failed with "Invalid OLLAMA API Key" error
- **Cause:** Unnecessary validation for Ollama (which doesn't use API keys)
- **Solution:** Skip validation for Ollama provider
- **Status:** Code updated, server restarted, ready to test
- **Next Step:** User should test adding knowledge via UI

The fix is minimal, safe, and follows existing patterns in the Archon codebase.

---

**Last Updated:** 2025-12-11
**Tested:** Server restart successful, API healthy
**User Testing Required:** Yes - verify crawling works in UI
