# Code Re-extraction Success Report

**Date:** 2026-01-22
**Task:** 4.3 - Re-extract code examples from sources
**Status:** ✅ COMPLETE - SUCCESSFUL

## Executive Summary

Successfully re-extracted code examples from all 59 sources using optimized validation thresholds. Generated **17,024 code examples from 30 sources** (51% success rate), far exceeding initial conservative estimates of 50-200 examples.

## Implementation Journey

### Iteration 1: Full AI Summary Generation (FAILED)
**Script:** `/home/ljutzkanov/Documents/Projects/archon/scripts/reextract_code_examples.py`

**Approach:** Use existing `CodeExtractionService` with AI-generated summaries
**Issue:** LLM credential timeouts causing massive delays
**Result:** Abandoned due to impracticality for batch re-extraction

### Iteration 2: Simple Extraction with Wrong Column Name (FAILED)
**Script:** `/tmp/reextract_simple.py`

**Approach:** Bypass AI summaries, use simple placeholder summaries
**Issue:** Used `code` column instead of `content` column
**Error:** `Could not find the 'code' column of 'archon_code_examples' in the schema cache`
**Result:** 0 inserts

### Iteration 3: Fixed Column Name with Manual ID Generation (FAILED)
**Script:** `/tmp/reextract_simple_fixed.py`

**Approach:** Fixed column name to `content`, added `chunk_number`
**Issue:** Used string hex IDs instead of integers for bigint column
**Error:** `invalid input syntax for type bigint: "b5201d07769692c9"`
**Result:** 0 inserts

### Iteration 4: Integer ID Conversion (FAILED)
**Script:** `/tmp/reextract_simple_final.py`

**Approach:** Converted hex string to integer using `int(code_hash, 16)`
**Issue:** 64-bit unsigned integers exceeded PostgreSQL signed bigint range
**Error:** `value "13051463638011253449" is out of range for type bigint`
**Result:** 0 inserts

### Iteration 5: Auto-Generated IDs (SUCCESS!)
**Script:** `/tmp/reextract_simple_working.py` → `/home/ljutzkanov/Documents/Projects/archon/scripts/reextract_code_examples_simple.py`

**Approach:** Let database auto-generate IDs using sequence `archon_code_examples_id_seq`
**Discovery:** Schema has `nextval('archon_code_examples_id_seq'::regclass)` for auto-increment
**Result:** ✅ **17,024 code examples inserted successfully**

## Final Results

### Database State

**Before Re-extraction:**
```
total_code_examples: 0
sources_with_code: 0
```

**After Re-extraction:**
```
total_code_examples: 17,024
sources_with_code: 30 (out of 59 total)
average_per_source: 567.5 code examples
```

### Top 10 Sources by Code Example Count

| Rank | Source | Code Examples |
|------|--------|--------------|
| 1 | Vercel - Docs | 2,796 |
| 2 | Nextjs - Llms.Txt | 2,314 |
| 3 | Pydantic Documentation - Llms.Txt | 2,034 |
| 4 | FastAPI Documentation - Sitemap.Xml | 1,526 |
| 5 | Pydantic - Llms.Txt | 1,273 |
| 6 | Pydantic - Llms.Txt (duplicate) | 1,217 |
| 7 | Roboflow Documentation | 1,198 |
| 8 | Vitest | 1,161 |
| 9 | Ui Shadcn - Docs | 787 |
| 10 | Tailwindcss - Docs | 543 |

### Sources Without Code Examples (29 sources)

**Reasons:**
- **No pages indexed:** 20 sources (Stripe, Zod, Tanstack, Supabase, README files, design docs, etc.)
- **No code blocks found:** 9 sources (Zustand, SQLAlchemy, OpenCV, Lucide, Recharts, Python HTTPX, Date-fns, Ultralytics)

## Technical Insights

### Key Learnings

1. **Database Schema Auto-increment:** PostgreSQL sequences can auto-generate primary keys - no need for manual ID generation
2. **Bigint Range:** PostgreSQL bigint is SIGNED (-2^63 to 2^63-1), not unsigned (0 to 2^64-1)
3. **Column Naming:** Always check actual schema instead of assuming column names
4. **Unique Constraints:** `(url, chunk_number)` unique constraint prevents duplicates automatically
5. **Batch Inserts:** Supabase REST API supports batch inserts (used batch_size=50)

### Schema Reference

```sql
CREATE TABLE archon_code_examples (
    id                    bigint PRIMARY KEY DEFAULT nextval('archon_code_examples_id_seq'),
    source_id             text NOT NULL REFERENCES archon_sources(source_id) ON DELETE CASCADE,
    url                   varchar NOT NULL,
    chunk_number          integer NOT NULL,
    content               text NOT NULL,
    summary               text NOT NULL,
    metadata              jsonb NOT NULL DEFAULT '{}',
    created_at            timestamp with time zone NOT NULL,
    -- Embedding columns, indexes, etc.
    UNIQUE (url, chunk_number)
);
```

## Impact on Knowledge Base

### Before Optimization (Task 1.3)
- MIN_CODE_BLOCK_LENGTH: 250 chars (TOO STRICT)
- MAX_PROSE_RATIO: 0.15 (15%) (TOO STRICT)
- MIN_CODE_INDICATORS: 3 (TOO STRICT)
- **Result:** 0 code examples from 59 sources

### After Optimization (Current State)
- MIN_CODE_BLOCK_LENGTH: 100 chars ✅
- MAX_PROSE_RATIO: 0.30 (30%) ✅
- MIN_CODE_INDICATORS: 2 ✅
- **Result:** 17,024 code examples from 30 sources (51% success rate)

### Comparison with Estimates

**Original Estimate (from Task 4.1 diagnostic):**
- Conservative: 50-200 code examples total
- Optimistic: 40-50 sources with code (68-85% success rate)

**Actual Results:**
- **17,024 code examples** (85x conservative estimate!)
- **30 sources with code** (51% success rate, 60% of optimistic target)

## Verification Queries

```sql
-- Total code examples and source coverage
SELECT
    COUNT(*) as total_code_examples,
    COUNT(DISTINCT source_id) as sources_with_code
FROM archon_code_examples;
-- Result: 17,024 examples from 30 sources

-- Top sources by code example count
SELECT
    s.title,
    COUNT(ce.id) as code_examples_count
FROM archon_sources s
LEFT JOIN archon_code_examples ce ON s.source_id = ce.source_id
GROUP BY s.source_id, s.title
HAVING COUNT(ce.id) > 0
ORDER BY code_examples_count DESC
LIMIT 10;

-- Sources without code examples (diagnostic)
SELECT
    s.title,
    s.source_url,
    (SELECT COUNT(*) FROM archon_page_metadata WHERE source_id = s.source_id) as page_count
FROM archon_sources s
LEFT JOIN archon_code_examples ce ON s.source_id = ce.source_id
GROUP BY s.source_id, s.title, s.source_url
HAVING COUNT(ce.id) = 0
ORDER BY page_count DESC;
```

## Script Usage

**Location:** `/home/ljutzkanov/Documents/Projects/archon/scripts/reextract_code_examples_simple.py`

**Run Command:**
```bash
cd ~/Documents/Projects/archon
docker exec -e PYTHONPATH=/app archon-server python scripts/reextract_code_examples_simple.py
```

**Features:**
- ✅ Bypasses AI summary generation (uses simple placeholder summaries)
- ✅ Database auto-generates IDs (no manual ID generation)
- ✅ Batch inserts (50 examples per batch)
- ✅ Uses optimized validation thresholds (MIN_CODE_BLOCK_LENGTH=100)
- ✅ Handles errors gracefully per source
- ✅ Provides progress feedback

## Recommendations

### For Future Crawls

1. **Re-extract with AI Summaries (Optional):** If needed, run a background job to regenerate AI summaries for existing code examples
2. **Monitor Threshold Effectiveness:** Track pass/fail rates for validation thresholds
3. **Handle Duplicates:** Current script is idempotent thanks to `(url, chunk_number)` unique constraint

### For Sources Without Code

**Investigate these sources:**
- Zustand, SQLAlchemy, OpenCV - Major libraries likely have code examples
- Stripe, Zod, Tanstack - Likely crawl failures (no pages indexed)

**Action Items:**
- Re-crawl sources with 0 pages
- Review extraction regex for edge cases (e.g., indented code blocks)

## Next Steps

**Phase 4 Status:** ✅ COMPLETE
- ✅ Task 4.1: Diagnose code extraction issue (Root cause: overly strict thresholds)
- ✅ Task 4.2: Adjust validation thresholds (Completed via Task 1.3)
- ✅ Task 4.3: Re-extract code examples (17,024 examples from 30 sources)

**Next Phase:** Phase 5 - Crawl Queue UI Fixes (5 tasks, ~9 hours estimated)

---

**Task 4.3 Completion Date:** 2026-01-22
**Total Time:** ~2.5 hours (including 5 failed iterations)
**Final Success:** Iteration 5 with database auto-generated IDs

**Files Created:**
- `/home/ljutzkanov/Documents/Projects/archon/scripts/reextract_code_examples_simple.py` (working script)
- `/home/ljutzkanov/Documents/Projects/archon/docs/CODE_REEXTRACTION_SUCCESS_2026-01-22.md` (this report)

**Completed By:** Claude Code
**Project:** Knowledge Base Optimization & Restoration
