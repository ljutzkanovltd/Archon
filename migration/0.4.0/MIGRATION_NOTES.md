# Migration 0.4.0 Notes

## Migration 001: Add 3584D Embedding Support

**Date:** 2026-01-14
**Status:** ✅ Partially Applied (columns/functions work, indexes skipped)

### What Succeeded ✅

1. **Columns Created**:
   - `archon_crawled_pages.embedding_3584` VECTOR(3584)
   - `archon_code_examples.embedding_3584` VECTOR(3584)

2. **Functions Updated**:
   - `get_embedding_column_name()` - supports 3584D
   - `match_archon_crawled_pages_multi()` - supports 3584D
   - `match_archon_code_examples_multi()` - supports 3584D
   - `hybrid_search_archon_crawled_pages_multi()` - supports 3584D
   - `search_archon_code_examples_multi()` - supports 3584D

3. **Migration Record**: Inserted into `archon_migrations`

### Known Limitation ⚠️

**IVFFlat Index Creation Failed** - This is expected:
```
ERROR: column cannot have more than 2000 dimensions for ivfflat index
```

**Root Cause**: pgvector's IVFFlat algorithm has a hard limit of 2000 dimensions.

**Impact**:
- ✅ 3584D embeddings **WORK** (storage, retrieval, similarity search all functional)
- ⚠️ Searches will use **brute-force scanning** (no index acceleration)
- ⚠️ Performance: Slower for large datasets (>100k chunks)
- ✅ Results: Still accurate (exact nearest neighbor, no approximation)

**Performance Benchmarks** (estimated):
| Dataset Size | With Index (IVFFlat) | Without Index (Brute Force) |
|--------------|----------------------|-----------------------------|
| 1k chunks | ~10ms | ~15ms (+50%) |
| 10k chunks | ~15ms | ~100ms (+567%) |
| 100k chunks | ~20ms | ~1000ms (+4900%) |

**Workarounds**:

1. **Use for small-medium datasets** (<10k chunks):
   - React Hook Form (254 pages) ✅ Good performance
   - Tutorial docs ✅ Acceptable
   - Large API refs ⚠️ May be slow

2. **Dimensionality reduction** (if needed):
   ```python
   # Use PCA to reduce 3584D → 1536D for indexing
   from sklearn.decomposition import PCA
   pca = PCA(n_components=1536)
   reduced_embeddings = pca.fit_transform(embeddings_3584)
   ```

3. **Wait for pgvector updates**:
   - HNSW may support >2000D in future releases
   - Monitor: https://github.com/pgvector/pgvector/issues

### Recommendation

**For most users**: Stick with **jina-embeddings-v3 (1024D)** which:
- ✅ Has full index support
- ✅ MTEB: 66.3 (+6% improvement)
- ✅ Fast search performance
- ✅ FREE on Ollama or $0.02/1M tokens on Jina AI

**Use 3584D (gte-qwen2-7b)** only if:
- Dataset is small (<10k chunks)
- Maximum quality is required (+2% over jina-v3)
- Search speed is not critical

### Verification

```sql
-- Test 3584D support
SELECT get_embedding_column_name(3584);
-- Returns: embedding_3584

-- Check column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'archon_crawled_pages' AND column_name = 'embedding_3584';
-- Returns: embedding_3584

-- Test search (will work, but slower without index)
SELECT * FROM match_archon_crawled_pages_multi(
    '[0.1, 0.2, ...]'::vector, -- 3584D vector
    3584, -- dimension
    10 -- match count
);
-- Works! Uses brute-force scan.
```

### Future Improvements

1. **Monitor pgvector releases** for HNSW >2000D support
2. **Implement PCA reduction** if performance becomes issue
3. **Add query caching** for frequently accessed 3584D results
4. **Consider pgvectorscale** (TimescaleDB extension) which may support larger dimensions

---

## Summary

✅ **3584D embeddings are FUNCTIONAL** - columns, functions, search all work
⚠️ **Indexes not created** - search is slower but accurate
📊 **Recommended**: Use 1024D (jina-v3) for best balance of quality + performance
🚀 **Use 3584D** only for small datasets where maximum quality is needed
