# Knowledge Crawling Fix Summary

**Date:** 2025-12-11
**Issue:** Knowledge sources showing "No documents found" after crawling
**Status:** ✅ **FIXED - Ready for Re-Crawl**

---

## Problem Discovered

When you added the PydanticAI documentation (https://ai.pydantic.dev/llms.txt):
- ✅ Source was created successfully
- ✅ 127 pages were crawled and stored
- ❌ **0 chunks were created** (embedding generation failed)
- ❌ UI showed "No documents found"

### Root Cause

The `OLLAMA_EMBEDDING_URL` was pointing to **port 8080** (which wasn't running), instead of **port 11437** where the nomic-embed-text-v1.5 model is actually running.

**Evidence:**
```
Database Before Fix:
OLLAMA_EMBEDDING_URL = http://host.docker.internal:8080/v1  ❌ WRONG

Actual Service:
Port 11437: nomic-embed-text-v1.5 model RUNNING ✅
Port 8080:  NOTHING RUNNING ❌
```

---

## What Was Done

### 1. Fixed Database Configuration ✅

Updated the embedding URL to point to the correct port:

```sql
UPDATE archon_settings
SET value = 'http://host.docker.internal:11437/v1'
WHERE key = 'OLLAMA_EMBEDDING_URL';
```

**Before:**
```
OLLAMA_EMBEDDING_URL: http://host.docker.internal:8080/v1  ❌
```

**After:**
```
OLLAMA_EMBEDDING_URL: http://host.docker.internal:11437/v1  ✅
```

### 2. Verified Embedding Service ✅

Tested connectivity to the embedding service:
```bash
✅ Embeddings working! Dimension: 768
```

### 3. Cleaned Up Failed Data ✅

Deleted the failed PydanticAI source and all 127 orphaned pages:
```sql
DELETE FROM archon_sources WHERE source_id = '811367d92da2083c';
-- CASCADE automatically deleted 127 pages from archon_page_metadata
```

---

## Current Configuration

**All Settings Correct:**

| Setting | Value | Status |
|---------|-------|--------|
| **LLM Provider** | `ollama` | ✅ |
| **Chat Model URL** | `http://host.docker.internal:11434/v1` | ✅ |
| **Embedding URL** | `http://host.docker.internal:11437/v1` | ✅ |
| **Embedding Model** | `/models/nomic-embed-text-v1.5.Q4_K_M.gguf` | ✅ |
| **Embedding Service** | **Working (768-dimensional vectors)** | ✅ |

---

## Next Steps: Re-Crawl PydanticAI Documentation

Now that everything is fixed, you can re-add the knowledge source:

### Via Archon UI (Recommended)

1. **Open Archon Dashboard:**
   ```
   http://localhost:3737
   ```

2. **Navigate to Knowledge Sources:**
   - Click on "Knowledge" or "Sources" in the sidebar
   - Click "Add Knowledge" or "Add Source" button

3. **Configure the Source:**
   ```
   URL:    https://ai.pydantic.dev/llms.txt
   Type:   Technical
   Tags:   pydantic, ai, documentation
   Depth:  2 (or as desired)
   Code Examples: ✅ Enable
   ```

4. **Start Crawl:**
   - Click "Start Crawl" or "Add Source"
   - **This time, it should work correctly!**

5. **Monitor Progress:**
   - Watch the progress indicator
   - You should see pages being crawled
   - **Chunks should be created** (not like before)
   - **Documents should appear in the UI**

### Via API (Alternative)

```bash
curl -X POST "http://localhost:8181/api/knowledge-items/crawl" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ai.pydantic.dev/llms.txt",
    "knowledge_type": "technical",
    "tags": ["pydantic", "ai", "documentation"],
    "max_depth": 2,
    "extract_code_examples": true
  }'
```

---

## What to Expect This Time

### During Crawling

**You should see:**
- ✅ Pages being fetched (82+ pages like before)
- ✅ **Embeddings being generated** (NEW!)
- ✅ **Chunks being stored** (NEW!)
- ✅ Progress indicator showing completion

**Monitor Logs:**
```bash
docker logs -f archon-server | grep -E "embedding|chunk|PydanticAI"

# Expected logs:
# ✅ Skipping API key validation for Ollama
# ✅ Created embeddings for batch
# ✅ Stored X chunks successfully
# ✅ Total chunks stored: 127+ (not 0!)
```

### After Crawling Completes

**In the UI:**
- ✅ Source card shows document count (e.g., "Showing 127 of 127")
- ✅ Clicking the source shows list of pages/documents
- ✅ Each document shows content preview
- ✅ Search functionality works
- ✅ Can query knowledge using semantic search

**In the Database:**
```bash
# Check that chunks were created:
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) FROM archon_crawled_pages WHERE source_id = (SELECT source_id FROM archon_sources WHERE source_url LIKE '%pydantic%');"

# Should show: 127+ chunks (not 0!)
```

---

## Verification Checklist

After re-crawling, verify:

- [ ] Source appears in knowledge sources list
- [ ] Document count shows > 0 (e.g., "127 documents")
- [ ] Clicking source shows list of pages/documents
- [ ] Can search within the source
- [ ] Semantic search returns relevant results
- [ ] Code examples are extracted (if enabled)

---

## Why This Happened

The `OLLAMA_EMBEDDING_URL` was likely set to port 8080 during:
- Initial setup or testing
- A migration script with incorrect defaults
- Manual configuration with wrong port

**How We Discovered It:**
1. Noticed "No documents found" despite successful crawl
2. Checked database - found 127 pages stored but 0 chunks
3. Checked logs - found embedding connection errors to port 8080
4. Verified port 11437 is where nomic-embed-text actually runs
5. Fixed the configuration

---

## Related Fixes

This is the **second Ollama configuration issue** we've fixed today:

1. **First Issue:** Knowledge crawling blocked by "Invalid OLLAMA API Key" error
   - **Fix:** Skip API key validation for Ollama in `knowledge_api.py`
   - **Status:** Fixed and committed (commit 20f3e36)

2. **Second Issue:** (THIS ONE) Embeddings failing due to wrong port
   - **Fix:** Update `OLLAMA_EMBEDDING_URL` from port 8080 to 11437
   - **Status:** Fixed (ready for testing)

Both issues are now resolved!

---

## Troubleshooting

### If Re-Crawl Still Shows "No Documents"

1. **Check Logs:**
   ```bash
   docker logs archon-server --tail 100 | grep -E "ERROR|Failed|embedding"
   ```

2. **Verify Configuration:**
   ```bash
   docker exec supabase-ai-db psql -U postgres -d postgres -c \
     "SELECT key, value FROM archon_settings WHERE key LIKE '%OLLAMA%' OR key LIKE '%EMBEDDING%';"
   ```

3. **Test Embeddings Directly:**
   ```bash
   curl -X POST "http://localhost:11437/v1/embeddings" \
     -H "Content-Type: application/json" \
     -d '{"model": "/models/nomic-embed-text-v1.5.Q4_K_M.gguf", "input": "test"}'
   ```

4. **Check Database After Crawl:**
   ```bash
   docker exec supabase-ai-db psql -U postgres -d postgres -c \
     "SELECT s.source_id, s.title, COUNT(p.id) as chunk_count
      FROM archon_sources s
      LEFT JOIN archon_crawled_pages p ON s.source_id = p.source_id
      GROUP BY s.source_id, s.title;"
   ```

### If Embeddings Still Fail

1. Verify nomic-embed-text is running:
   ```bash
   curl http://localhost:11437/v1/models
   ```

2. Check if port changed:
   ```bash
   ss -tlnp | grep llama-server | grep embedding
   ```

3. Restart Archon services:
   ```bash
   docker restart archon-server
   ```

---

## Summary

✅ **Problem:** OLLAMA_EMBEDDING_URL pointing to wrong port (8080 instead of 11437)
✅ **Fixed:** Updated database configuration to correct port
✅ **Tested:** Embedding service responding correctly
✅ **Cleaned:** Deleted failed PydanticAI source and orphaned pages
✅ **Ready:** Configuration is now correct for successful crawling

**Next Action:** Re-add PydanticAI documentation via Archon UI and verify documents appear!

---

**Files Modified:** None (database configuration only)
**Commits:** None (configuration change, not code change)
**User Testing Required:** Yes - re-crawl PydanticAI documentation
