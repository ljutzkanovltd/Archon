# Migration Log - Archon Database

## Migration 003: Implement RRF (Reciprocal Rank Fusion) for Hybrid Search

**Date:** 2026-01-14
**Author:** Claude Code
**Status:** ✅ Applied Successfully
**Backup:** `/home/ljutzkanov/Documents/Projects/local-ai-packaged/backups/unified-backup-20260114-112928`

### Summary

Replaced simple COALESCE score combination in hybrid search with industry-standard RRF (Reciprocal Rank Fusion) algorithm for better search quality.

### Changes

**Functions Modified:**
1. `hybrid_search_archon_crawled_pages_multi()` - Multi-dimensional hybrid search
2. `hybrid_search_archon_crawled_pages()` - Legacy wrapper (1536D)

**Key Improvements:**
- **Before:** `COALESCE(vector_sim, text_sim, 0)` - picks first non-null score
- **After:** `1/(k + rank_vector) + 1/(k + rank_text)` - combines ranks properly (k=60)
- Generates `ROW_NUMBER()` ranks for both vector and text results
- Fetches 2x candidates for better coverage before RRF reranking
- Returns top N results ranked by combined RRF score

### Technical Details

**RRF Formula:**
```
RRF_score = 1/(60 + rank_vector) + 1/(60 + rank_text)
```

**Example:**
- Document at rank 1 in vector search: `1/(60+1) ≈ 0.016`
- Same document at rank 5 in text search: `1/(60+5) ≈ 0.015`
- Combined RRF score: `0.016 + 0.015 = 0.031`

**Benefits:**
- Documents appearing in both searches get boosted (higher RRF score)
- Rank-based (not affected by different score scales)
- More robust than weighted score combination
- Industry standard (Pinecone, Weaviate, Elasticsearch use RRF)

### Expected Impact

- **+5-10% retrieval quality improvement**
- Better ranking for documents matching both semantic and keyword queries
- More consistent scores across different embedding models

### Verification

```sql
-- Function exists and contains RRF code
SELECT proname FROM pg_proc WHERE proname LIKE 'hybrid_search%';
-- hybrid_search_archon_crawled_pages
-- hybrid_search_archon_crawled_pages_multi

-- Function source contains RRF components
SELECT prosrc FROM pg_proc WHERE proname = 'hybrid_search_archon_crawled_pages_multi';
-- Contains: ROW_NUMBER(), rrf_scores CTE, RRF formula
```

### Migration File

Location: `/home/ljutzkanov/Documents/Projects/archon/migration/0.1.0/003_implement_rrf_hybrid_search.sql`

### Rollback Procedure

If needed, restore from backup:
```bash
gunzip -c /home/ljutzkanov/Documents/Projects/local-ai-packaged/backups/unified-backup-20260114-112928/databases/postgres.sql.gz | \
  docker exec -i supabase-ai-db psql -U postgres -d postgres
```

### Next Steps

1. ✅ RRF implementation complete
2. ⏳ Phase 2: Upgrade reranking model (ms-marco → bge-reranker-v2.5-large)
3. ⏳ Phase 2: Add latest embedding models (jina-v3, gte-qwen2-7b)
4. ⏳ Phase 1A: Fix code extraction bug (extract before chunking)
5. ⏳ Phase 5: Benchmark improvements with test queries

---

## Migration History

| # | Date | Description | Status |
|---|------|-------------|--------|
| 001 | N/A | Initial schema | ✅ Applied |
| 002 | N/A | Add hybrid search tsvector | ✅ Applied |
| **003** | **2026-01-14** | **Implement RRF for hybrid search** | **✅ Applied** |
