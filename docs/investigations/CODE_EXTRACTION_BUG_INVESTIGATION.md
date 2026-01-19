# Code Extraction Bug Investigation

**Date**: 2026-01-16
**Project**: Archon Knowledge Base (ID: 289417ad-52c1-4a80-be03-e653b273caba)
**Status**: IN PROGRESS
**Severity**: CRITICAL

## Problem Statement

Sources are being crawled successfully and pages are stored in the database, but **zero code examples are being extracted** across all sources.

- **Pages in Database**: 10,807 total
- **Code Examples in Database**: 0 total
- **Affected Sources**: All 59 sources, including high-value sources like:
  - Supabase - Llms.Txt: 5,900 pages, 0 code examples
  - Ui Shadcn - Docs: 2,639 pages, 0 code examples
  - Nextjs - Llms.Txt: 1,711 pages, 0 code examples

## Investigation Summary

### Database Verification

```sql
-- Query 1: Confirmed pages exist but no code examples
SELECT
  s.source_id,
  s.title,
  COUNT(p.id) as page_count,
  (SELECT COUNT(*) FROM archon_code_examples WHERE source_id = s.source_id) as code_count
FROM archon_sources s
LEFT JOIN archon_crawled_pages p ON p.source_id = s.source_id
GROUP BY s.source_id, s.title
HAVING COUNT(p.id) > 0
ORDER BY page_count DESC
LIMIT 10;

-- Result: Top 7 sources have 10,790 pages total, 0 code examples
```

```sql
-- Query 2: Checked code extraction config
SELECT source_id, title, code_extraction_config
FROM archon_sources
WHERE source_id IN ('47d0203a7b9d285a', 'bf102fe8a697ed7c', '2acbe9e28c4ba0b9');

-- Result: All have empty config: {}
```

### Code Flow Analysis

#### 1. **Request Flow - VERIFIED ✅**

**File**: `python/src/server/api_routes/knowledge_api.py`

```python
# Line 1112 - Parameter is passed through correctly
request_dict = {
    "url": str(request.url),
    "extract_code_examples": request.extract_code_examples,  # ✅ Passed
    # ...
}
```

**KnowledgeItemRequest** (lines 70-85):
```python
class KnowledgeItemRequest(BaseModel):
    extract_code_examples: bool = True  # ✅ Defaults to True
```

#### 2. **Crawling Service - VERIFIED ✅**

**File**: `python/src/server/services/crawling/crawling_service.py`

```python
# Lines 695-707 - Condition and trigger logic
actual_chunks_stored = storage_results.get("chunks_stored", 0)
if storage_results["chunk_count"] > 0 and actual_chunks_stored == 0:
    raise ValueError("Failed to store documents")  # Would fail if 0

# Line 707 - Code extraction condition
if request.get("extract_code_examples", True) and actual_chunks_stored > 0:
    code_examples_count = await self.doc_storage_ops.extract_and_store_code_examples(
        # ... parameters
    )
```

**Key Finding**: Since we have 10,807 pages in database, `actual_chunks_stored` should be > 0.

#### 3. **Error Handling - POTENTIAL ISSUE ⚠️**

**File**: `python/src/server/services/crawling/crawling_service.py`

```python
# Lines 764-768 - Catches RuntimeError silently
except RuntimeError as e:
    logger.error("Code extraction failed, continuing crawl without code examples", exc_info=True)
    safe_logfire_error(f"Code extraction failed | error={e}")
    code_examples_count = 0
```

**Problem**: Errors may be caught but not properly logged or visible in recent logs.

#### 4. **Code Extraction Service - 3-PHASE PROCESS**

**File**: `python/src/server/services/crawling/code_extraction_service.py`

```python
# Lines 170-292 - Extract and store code examples
async def extract_and_store_code_examples(...):
    # Phase 1: Extract code blocks (0-20%)
    all_code_blocks = await self._extract_code_blocks_from_documents(...)

    if not all_code_blocks:
        safe_logfire_info("No code examples found in any crawled documents")
        return 0  # ⚠️ Early return if no code found

    # Phase 2: Generate summaries (20-90%)
    summary_results = await self._generate_code_summaries(...)

    # Phase 3: Store in database (90-100%)
    return await self._store_code_examples(...)
```

### Timeline Analysis

**Code Extraction Feature Added**: September 2025 (commits 6abb883, 94aed6b)

**Sources Created**:
- 2026-01-02: Nextjs - Llms.Txt
- 2026-01-07: Supabase - Llms.Txt
- 2026-01-14: Ui Shadcn - Docs

**Conclusion**: Feature existed when sources were crawled. This is NOT a timing issue.

### Log Analysis

```bash
# No crawl logs found in recent backend logs
docker logs archon-backend 2>&1 | grep -i "crawl"
# Result: Empty

# No code extraction logs found
docker logs archon-backend 2>&1 | grep -i "code extraction"
# Result: Empty
```

**Finding**: No recent crawl activity in logs, suggesting sources were crawled before current container started.

## Root Cause Hypotheses (Ranked by Likelihood)

### 1. **Phase 1 Failure: No Code Blocks Found** (Most Likely - 60%)

**Hypothesis**: The code extraction regex/parsing logic in `_extract_code_blocks_from_documents` is failing to detect code blocks in the document content format.

**Evidence**:
- Early return at line 181: `if not all_code_blocks: return 0`
- No logs indicating Phase 2 or Phase 3 execution
- LLMs.txt format may not match expected patterns

**Next Steps**:
- Test extraction on sample pages from Supabase/Nextjs sources
- Check if markdown code fences are present in page content
- Verify HTML code block parsing logic

### 2. **Phase 2 Failure: LLM Summary Generation** (Possible - 25%)

**Hypothesis**: LLM provider API calls are failing during summary generation, causing silent failures.

**Evidence**:
- Lines 738-753 show provider configuration with fallback to "openai"
- No API key validation before code extraction phase
- RuntimeError catch may hide provider errors

**Next Steps**:
- Check if OpenAI API key is configured
- Verify provider credentials in credential service
- Add diagnostic logging to summary generation

### 3. **Phase 3 Failure: Database Storage** (Less Likely - 10%)

**Hypothesis**: Embedding generation or database insert is failing during storage phase.

**Evidence**:
- Embedding provider lookup with try/catch (lines 746-753)
- May fail silently if embedding generation fails

**Next Steps**:
- Test embedding generation independently
- Check database constraints on archon_code_examples table

### 4. **Configuration Issue: Feature Disabled** (Unlikely - 5%)

**Hypothesis**: Some global configuration or setting is disabling code extraction.

**Evidence**:
- `code_extraction_config` in archon_sources is empty `{}`
- May indicate feature not fully configured

**Next Steps**:
- Check archon_settings table for code extraction settings
- Verify feature flags

## Diagnostic Test Plan

### Test 1: Manual Code Extraction on Sample Pages

Create a test script to extract code from 10 pages of Supabase source:

**Script Location**: `/tmp/test_code_extraction.py` (see below)

**Expected Output**:
- If Phase 1 fails: "No code examples found in any crawled documents"
- If Phase 2 fails: RuntimeError during summary generation
- If Phase 3 fails: RuntimeError during database storage

### Test 2: Check Page Content Format

```sql
SELECT
    id,
    url,
    LEFT(content, 200) as content_preview,
    LENGTH(content) as content_length
FROM archon_crawled_pages
WHERE source_id = '47d0203a7b9d285a'
LIMIT 5;
```

**Goal**: Verify if content contains code blocks in expected format.

### Test 3: Check Credential Configuration

```bash
docker exec supabase-ai-db psql -U postgres -d postgres -c "
SELECT key, value, category
FROM archon_settings
WHERE category IN ('llm', 'embedding', 'code_extraction');"
```

**Goal**: Verify provider credentials are configured.

## Related Files

### Core Files Analyzed
1. `/home/ljutzkanov/Documents/Projects/archon/python/src/server/services/crawling/crawling_service.py` (lines 705-778)
2. `/home/ljutzkanov/Documents/Projects/archon/python/src/server/services/crawling/code_extraction_service.py` (lines 170-292)
3. `/home/ljutzkanov/Documents/Projects/archon/python/src/server/api_routes/knowledge_api.py` (lines 1001-1157)
4. `/home/ljutzkanov/Documents/Projects/archon/python/src/server/services/crawling/document_storage_operations.py` (lines 250-290)

### Database Tables
- `archon_sources` - Source metadata, code_extraction_config
- `archon_crawled_pages` - 10,807 pages stored
- `archon_code_examples` - 0 examples (the problem)
- `archon_settings` - Configuration settings

## Action Items

### Immediate (Before Next Session)
- [ ] Run diagnostic Test 1 - manual code extraction test
- [ ] Run diagnostic Test 2 - check page content format
- [ ] Run diagnostic Test 3 - verify credentials

### Short-term (This Week)
- [ ] Add comprehensive logging to all 3 phases of code extraction
- [ ] Create `/api/debug/code-extraction` endpoint for diagnostics
- [ ] Add unit tests for code block extraction regex
- [ ] Implement retry logic with better error messages

### Medium-term (Next Sprint)
- [ ] Implement code extraction health check dashboard
- [ ] Add monitoring for extraction success rate
- [ ] Create manual re-extraction endpoint for existing sources

## Related Tasks

**Archon Task ID**: `06b835e0-19e1-4ba7-80fe-31304d796805`
**Status**: DOING
**Assignee**: backend-api-expert
**Title**: Fix critical code extraction bug - 0 examples despite 10,807 pages

**Project Dashboard**: http://localhost:3738/projects/289417ad-52c1-4a80-be03-e653b273caba

## Diagnostic Test Script

**Location**: `/tmp/test_code_extraction.py`

```python
#!/usr/bin/env python3
"""
Diagnostic script to test code extraction on existing sources.
This will help identify why code extraction is returning 0 results.
"""
import asyncio
import sys

sys.path.insert(0, '/home/ljutzkanov/Documents/Projects/archon/python')

from src.server.services.crawling.code_extraction_service import CodeExtractionService
from src.server.utils.supabase_client import get_supabase_client


async def test_code_extraction():
    """Test code extraction on a source with known pages."""
    source_id = "47d0203a7b9d285a"  # Supabase - 5900 pages

    print(f"Testing code extraction for source: {source_id}")
    print("=" * 60)

    supabase_client = get_supabase_client()

    # Fetch first 10 pages
    response = supabase_client.table("archon_crawled_pages")\
        .select("*")\
        .eq("source_id", source_id)\
        .limit(10)\
        .execute()

    pages = response.data
    print(f"✓ Found {len(pages)} pages to test")

    if not pages:
        print("✗ No pages found!")
        return

    # Prepare crawl_results format
    crawl_results = []
    url_to_full_document = {}

    for page in pages:
        url = page.get('url', f"page_{page['id']}")
        content = page.get('content', '')
        metadata = page.get('metadata', {})

        crawl_results.append({
            'url': url,
            'content': content,
            'metadata': metadata
        })
        url_to_full_document[url] = content

    print(f"✓ Prepared {len(crawl_results)} documents for extraction")

    # Progress callback
    async def progress_callback(data: dict):
        progress = data.get('progress', data.get('percentage', 0))
        status = data.get('status', 'processing')
        log = data.get('log', '')
        print(f"  [{progress:3.0f}%] {status}: {log}")

    # Test extraction
    print("\n🔍 Starting code extraction test...")
    print("-" * 60)

    code_service = CodeExtractionService(supabase_client)

    try:
        code_count = await code_service.extract_and_store_code_examples(
            crawl_results=crawl_results,
            url_to_full_document=url_to_full_document,
            source_id=source_id,
            progress_callback=progress_callback,
            cancellation_check=None,
            provider="openai",
            embedding_provider=None
        )

        print("-" * 60)
        print(f"\n✓ Code extraction completed!")
        print(f"✓ Extracted {code_count} code examples")

        if code_count == 0:
            print("\n⚠️  WARNING: 0 code examples extracted!")
            print("   This confirms Phase 1 extraction is finding no code.")

    except Exception as e:
        print("-" * 60)
        print(f"\n✗ Code extraction failed!")
        print(f"✗ Error: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"\nTraceback:\n{traceback.format_exc()}")


if __name__ == "__main__":
    asyncio.run(test_code_extraction())
```

**Usage**:
```bash
cd /home/ljutzkanov/Documents/Projects/archon/python
python /tmp/test_code_extraction.py
```

## References

- **Archon MCP Task Management**: `find_tasks(task_id="06b835e0-19e1-4ba7-80fe-31304d796805")`
- **Git Commits**: 6abb883, 94aed6b, 52cb47e (code extraction feature history)
- **Related Investigation**: Issue #248 - LLM provider service integration

---

**Next Steps**: Run diagnostic tests and update this document with findings.
