# Content Search Performance Optimization Plan

**Date:** 2026-01-09
**Current State:** 2.4-12.6s per search (2-6x over 2s threshold)
**Target:** <2s per search (95th percentile)
**Database:** 222,058 crawled pages across 45 sources

---

## Executive Summary

**Root Cause Analysis:**
1. **Azure OpenAI Embedding API Latency** (Estimated 2-4s)
   - Every query makes a fresh API call to Azure
   - No caching of query embeddings
   - Network latency + Azure processing time
   
2. **PostgreSQL Query Performance** (Estimated 1-3s)
   - Vector search on 222k rows without optimal indexes
   - Full-text search + vector search run separately then joined
   - Source filtering returns 0 results (bug)
   - Short queries fail (bug)

3. **Missing Optimizations**
   - No query embedding cache (Redis/LRU)
   - No pre-warmed frequent queries
   - No async batch processing
   - No result caching

**Optimization Strategy:** 3-phase approach targeting 80% performance improvement

---

## Phase 1: Quick Wins (Immediate - 1-2 days)
**Target:** Reduce average search time to 2-3s (50% improvement)

### 1.1 Add Performance Logging with Timing Breakdown
**File:** `python/src/server/api_routes/knowledge_api.py`
**Priority:** CRITICAL (for measuring other improvements)

**Changes:**
```python
# Line 1850, add detailed timing
search_start = time.time()

# After embedding creation (line 1857)
embedding_time = time.time() - search_start
logger.info(f"📊 Embedding generation: {embedding_time:.3f}s")

# After hybrid search (line 1871)
db_search_start = time.time()
results = await rag_service.hybrid_strategy.search_documents_hybrid(...)
db_search_time = time.time() - db_search_start
logger.info(f"📊 DB search time: {db_search_time:.3f}s")

# Total (line 1878)
total_time = time.time() - search_start
logger.info(
    f"📊 Total: {total_time:.3f}s | Embedding: {embedding_time:.3f}s "
    f"({embedding_time/total_time*100:.1f}%) | DB: {db_search_time:.3f}s "
    f"({db_search_time/total_time*100:.1f}%)"
)
```

**Expected Impact:** No performance change, enables targeted optimization

---

### 1.2 Fix Source Filtering Bug
**File:** `python/src/server/api_routes/knowledge_api.py`
**Priority:** HIGH (blocking for production)

**Root Cause:** Need to verify source_id exists in database

**Investigation Steps:**
```sql
-- Check if source_id exists
SELECT COUNT(*), source_id 
FROM archon_crawled_pages 
WHERE source_id = 'e78dce57d572c115'
GROUP BY source_id;

-- Check if embeddings exist for this source
SELECT COUNT(*), source_id
FROM archon_crawled_pages
WHERE source_id = 'e78dce57d572c115' 
    AND embedding_1536 IS NOT NULL
GROUP BY source_id;
```

**Potential Fix:** Add debug logging in `hybrid_search_strategy.py`:
```python
# Line 54-55
filter_json = filter_metadata or {}
source_filter = filter_json.pop("source", None) if "source" in filter_json else None

# Add debug logging
logger.info(f"🔍 Source filter: {source_filter} | Filter metadata: {filter_json}")
```

**Expected Impact:** Fix blocking issue, enable source-filtered searches

---

### 1.3 Handle Short Queries Gracefully
**File:** `python/src/server/api_routes/knowledge_api.py`
**Priority:** MEDIUM

**Changes:**
```python
# Line 1806, add validation after search_knowledge_content() definition
@router.post("/knowledge/search", response_model=ContentSearchResponse)
async def search_knowledge_content(request: ContentSearchRequest):
    # Add query length validation
    if len(request.query.split()) < 2:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Query too short",
                "message": "Please provide at least 2 words for better search results. "
                          "Single-word queries may not produce reliable matches due to "
                          "embedding model limitations.",
                "suggestion": f"Try searching for: '{request.query} documentation' or "
                             f"'{request.query} tutorial'"
            }
        )
    
    # Rest of function...
```

**Expected Impact:** Better UX, prevents slow failing searches

---

## Phase 2: Performance Optimizations (Short-term - 3-5 days)
**Target:** Reduce average search time to <2s (80% improvement from baseline)

### 2.1 Implement Query Embedding Cache (Redis)
**Files:** 
- `python/src/server/services/embeddings/embedding_service.py`
- New file: `python/src/server/services/cache/embedding_cache.py`

**Priority:** CRITICAL (biggest performance impact)

**Architecture:**
```python
# embedding_cache.py
import hashlib
import redis
import json
from typing import Optional

class EmbeddingCache:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.Redis.from_url(redis_url, decode_responses=False)
        self.ttl = 3600  # 1 hour TTL
    
    def _cache_key(self, text: str, provider: str) -> str:
        """Generate cache key from text hash"""
        text_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
        return f"embed:{provider}:{text_hash}"
    
    async def get(self, text: str, provider: str) -> Optional[list[float]]:
        """Get cached embedding"""
        key = self._cache_key(text, provider)
        cached = self.redis.get(key)
        if cached:
            return json.loads(cached)
        return None
    
    async def set(self, text: str, provider: str, embedding: list[float]):
        """Cache embedding with TTL"""
        key = self._cache_key(text, provider)
        self.redis.setex(key, self.ttl, json.dumps(embedding))
    
    async def get_stats(self) -> dict:
        """Get cache statistics"""
        keys = self.redis.keys("embed:*")
        return {
            "total_cached": len(keys),
            "memory_used": self.redis.info("memory")["used_memory_human"]
        }

# Modify create_embedding() in embedding_service.py
embedding_cache = EmbeddingCache()

async def create_embedding(text: str, provider: str | None = None) -> list[float]:
    # Check cache first
    cached = await embedding_cache.get(text, provider or "azure")
    if cached:
        logger.debug(f"✅ Cache HIT for query: {text[:50]}")
        return cached
    
    logger.debug(f"❌ Cache MISS for query: {text[:50]}")
    
    # Generate embedding (existing code)
    embedding = await _generate_embedding(text, provider)
    
    # Cache result
    await embedding_cache.set(text, provider or "azure", embedding)
    
    return embedding
```

**Infrastructure Requirements:**
- Add Redis to docker-compose.yml:
```yaml
services:
  redis-archon:
    image: redis:7-alpine
    container_name: redis-archon
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    networks:
      - app-network

volumes:
  redis-data:
```

**Expected Impact:** 
- **Cache HIT:** 50-100ms (95% faster)
- **Cache MISS:** Same as current (2-4s)
- **Hit Rate (estimated):** 30-50% for common queries
- **Overall improvement:** 1.5-2s reduction on average

---

### 2.2 Add pgvector HNSW Index for Faster Vector Search
**File:** New migration `migration/0.3.0/003_optimize_vector_search.sql`
**Priority:** HIGH

**Changes:**
```sql
-- Create HNSW index for faster approximate nearest neighbor search
-- HNSW (Hierarchical Navigable Small World) is faster than IVFFlat for high-recall searches

-- Drop existing indexes if present (to avoid conflicts)
DROP INDEX IF EXISTS idx_archon_crawled_pages_embedding_1536;

-- Create HNSW index (requires pgvector 0.5.0+)
CREATE INDEX idx_archon_crawled_pages_embedding_1536_hnsw 
ON archon_crawled_pages 
USING hnsw (embedding_1536 vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create composite index for source_id filtering
CREATE INDEX idx_archon_crawled_pages_source_embedding 
ON archon_crawled_pages (source_id, embedding_1536)
WHERE embedding_1536 IS NOT NULL;

-- Analyze table for query planner
ANALYZE archon_crawled_pages;

-- Add index for text search performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_archon_crawled_pages_source_tsvector
ON archon_crawled_pages (source_id, content_search_vector);

-- Comment
COMMENT ON INDEX idx_archon_crawled_pages_embedding_1536_hnsw IS 
'HNSW index for fast approximate nearest neighbor vector search. 
Parameters: m=16 (graph connectivity), ef_construction=64 (build quality)';
```

**HNSW Parameters Tuning:**
- `m = 16` (default: 16) - Number of bi-directional links per element
  - Higher = better recall, slower build, more memory
  - Recommended: 16-32 for production
- `ef_construction = 64` (default: 64) - Size of dynamic candidate list during index build
  - Higher = better quality index, slower build
  - Recommended: 64-200 for production

**Expected Impact:**
- Vector search: 1-3s → 100-500ms (50-80% faster)
- Memory overhead: ~20% increase (acceptable for 222k rows)
- Build time: 5-10 minutes (one-time cost)

**Verification:**
```sql
-- Check index usage with EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT id, url, 1 - (embedding_1536 <=> $1) AS similarity
FROM archon_crawled_pages
WHERE embedding_1536 IS NOT NULL
ORDER BY embedding_1536 <=> $1
LIMIT 10;

-- Should show: "Index Scan using idx_archon_crawled_pages_embedding_1536_hnsw"
```

---

### 2.3 Optimize Hybrid Search PostgreSQL Function
**File:** New migration `migration/0.3.0/004_optimize_hybrid_search.sql`
**Priority:** MEDIUM

**Current Issue:** FULL OUTER JOIN on potentially large result sets is slow

**Optimization:** Use UNION ALL + window functions for RRF ranking

**Changes:**
```sql
-- Optimized hybrid search with RRF (Reciprocal Rank Fusion)
CREATE OR REPLACE FUNCTION hybrid_search_archon_crawled_pages(
    query_embedding vector(1536),
    query_text TEXT,
    match_count INT DEFAULT 10,
    filter JSONB DEFAULT '{}'::jsonb,
    source_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    url VARCHAR,
    chunk_number INTEGER,
    content TEXT,
    metadata JSONB,
    source_id TEXT,
    similarity FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Use RRF (Reciprocal Rank Fusion) for hybrid ranking
    -- Formula: score = 1 / (rank + 60) for each search type
    RETURN QUERY
    WITH vector_results AS (
        SELECT 
            cp.id,
            cp.url,
            cp.chunk_number,
            cp.content,
            cp.metadata,
            cp.source_id,
            1 - (cp.embedding_1536 <=> query_embedding) AS vector_sim,
            ROW_NUMBER() OVER (ORDER BY cp.embedding_1536 <=> query_embedding) AS vector_rank
        FROM archon_crawled_pages cp
        WHERE cp.metadata @> filter
            AND (source_filter IS NULL OR cp.source_id = source_filter)
            AND cp.embedding_1536 IS NOT NULL
        ORDER BY cp.embedding_1536 <=> query_embedding
        LIMIT match_count * 2  -- Fetch 2x for better RRF results
    ),
    text_results AS (
        SELECT 
            cp.id,
            cp.url,
            cp.chunk_number,
            cp.content,
            cp.metadata,
            cp.source_id,
            ts_rank_cd(cp.content_search_vector, plainto_tsquery('english', query_text)) AS text_sim,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(cp.content_search_vector, plainto_tsquery('english', query_text)) DESC) AS text_rank
        FROM archon_crawled_pages cp
        WHERE cp.metadata @> filter
            AND (source_filter IS NULL OR cp.source_id = source_filter)
            AND cp.content_search_vector @@ plainto_tsquery('english', query_text)
        ORDER BY text_sim DESC
        LIMIT match_count * 2  -- Fetch 2x for better RRF results
    ),
    rrf_scores AS (
        -- Reciprocal Rank Fusion
        SELECT 
            COALESCE(v.id, t.id) AS id,
            COALESCE(v.url, t.url) AS url,
            COALESCE(v.chunk_number, t.chunk_number) AS chunk_number,
            COALESCE(v.content, t.content) AS content,
            COALESCE(v.metadata, t.metadata) AS metadata,
            COALESCE(v.source_id, t.source_id) AS source_id,
            -- RRF score calculation (k=60 is standard)
            (COALESCE(1.0 / (v.vector_rank + 60), 0) + COALESCE(1.0 / (t.text_rank + 60), 0)) AS rrf_score,
            -- Original similarities for debugging
            v.vector_sim,
            t.text_sim,
            CASE 
                WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN 'hybrid'
                WHEN v.id IS NOT NULL THEN 'vector'
                ELSE 'keyword'
            END AS match_type
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT 
        rrf.id,
        rrf.url,
        rrf.chunk_number,
        rrf.content,
        rrf.metadata,
        rrf.source_id,
        -- Return vector similarity if available, otherwise text similarity, otherwise RRF score
        COALESCE(rrf.vector_sim, rrf.text_sim, rrf.rrf_score)::float8 AS similarity,
        rrf.match_type
    FROM rrf_scores rrf
    ORDER BY rrf.rrf_score DESC
    LIMIT match_count;
END;
$$;
```

**Expected Impact:**
- Hybrid search: 1-2s → 500ms-1s (25-50% faster)
- Better ranking quality (RRF is proven effective)

---

## Phase 3: Advanced Optimizations (Medium-term - 1-2 weeks)
**Target:** Further reduce to <1s for 50% of queries

### 3.1 Implement Result Caching (Redis)
**Priority:** MEDIUM

**Architecture:**
```python
# result_cache.py
class SearchResultCache:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = redis.Redis.from_url(redis_url)
        self.ttl = 300  # 5 minutes
    
    def _cache_key(self, query: str, filters: dict, match_count: int) -> str:
        key_data = f"{query}|{json.dumps(filters, sort_keys=True)}|{match_count}"
        return f"search_result:{hashlib.sha256(key_data.encode()).hexdigest()[:16]}"
    
    async def get(self, query: str, filters: dict, match_count: int) -> Optional[list]:
        key = self._cache_key(query, filters, match_count)
        cached = self.redis.get(key)
        if cached:
            return json.loads(cached)
        return None
    
    async def set(self, query: str, filters: dict, match_count: int, results: list):
        key = self._cache_key(query, filters, match_count)
        self.redis.setex(key, self.ttl, json.dumps(results))
```

**Expected Impact:**
- Cached searches: <100ms (90% faster)
- Hit rate: 10-20% (for repeated searches)

---

### 3.2 Add Async Batch Embedding Generation
**Priority:** LOW (only helps with multiple concurrent searches)

**Changes:** Modify embedding service to batch multiple queries:
```python
# For future MCP server with multiple concurrent requests
async def create_embeddings_concurrent(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for multiple texts in parallel"""
    tasks = [create_embedding(text) for text in texts]
    return await asyncio.gather(*tasks)
```

**Expected Impact:** 
- Batch of 10 queries: 40s → 5s (8x faster)
- Only useful for bulk operations

---

### 3.3 Implement Query Prewarming
**Priority:** LOW

**Architecture:**
- Background job that pre-generates embeddings for common queries
- Load from access logs or analytics
- Cache top 100 queries at system startup

**Expected Impact:**
- Top queries: Always cached, <100ms
- Improves cold start performance

---

## Phase 4: Monitoring & Validation (Ongoing)

### 4.1 Add Performance Dashboard
**Tools:** Grafana + Prometheus or Logfire

**Metrics to Track:**
- P50, P95, P99 search latency
- Cache hit rates (embedding cache, result cache)
- Embedding API latency distribution
- PostgreSQL query duration histogram
- Error rates by error type

### 4.2 Add Query Performance Logging
**File:** `python/src/server/api_routes/knowledge_api.py`

**Changes:**
```python
# After search completes, log to structured log
performance_log = {
    "query": request.query[:50],
    "total_time_ms": round(total_time * 1000, 2),
    "embedding_time_ms": round(embedding_time * 1000, 2),
    "db_search_time_ms": round(db_search_time * 1000, 2),
    "results_count": len(results),
    "cache_hit": cached_embedding is not None,
    "match_types": match_type_distribution,
    "source_filter": request.source_id
}

logger.info("search_performance", extra=performance_log)
```

---

## Implementation Roadmap

### Sprint 1 (Days 1-2): Quick Wins
- [ ] Day 1 AM: Add performance logging (Task 1.1) 
- [ ] Day 1 PM: Investigate & fix source filtering (Task 1.2)
- [ ] Day 2 AM: Add short query validation (Task 1.3)
- [ ] Day 2 PM: Re-run tests, measure baseline

**Expected Result:** Identify bottleneck, fix 2 bugs, establish metrics

---

### Sprint 2 (Days 3-5): Core Optimizations
- [ ] Day 3: Setup Redis, implement embedding cache (Task 2.1)
- [ ] Day 4: Create HNSW indexes, test performance (Task 2.2)
- [ ] Day 5: Optimize hybrid search function (Task 2.3)

**Expected Result:** 80% performance improvement (2.4-12.6s → <2s)

---

### Sprint 3 (Days 6-10): Advanced Features
- [ ] Days 6-7: Implement result caching (Task 3.1)
- [ ] Days 8-9: Add batch embedding support (Task 3.2)
- [ ] Day 10: Query prewarming system (Task 3.3)

**Expected Result:** 90% of queries <1s

---

### Ongoing: Monitoring
- [ ] Setup Grafana dashboards
- [ ] Configure alerting (P95 > 2s)
- [ ] Weekly performance reviews

---

## Success Metrics

### Performance Targets (After Phase 2)
| Metric | Current | Target | Stretch Goal |
|--------|---------|--------|--------------|
| P50 latency | 5.5s | <1.5s | <1s |
| P95 latency | 8.1s | <2.5s | <2s |
| P99 latency | 12.6s | <4s | <3s |
| Cache hit rate | 0% | 30% | 50% |
| Embedding API calls | 100% | <70% | <50% |

### Quality Metrics
- [ ] Source filtering returns correct results
- [ ] Short queries fail gracefully with helpful message
- [ ] Search relevance maintained (no degradation)
- [ ] No regressions in existing functionality

---

## Risk Assessment

### High Risk
- **HNSW index build time** - May lock table for 5-10 minutes
  - **Mitigation:** Run during low-traffic window, test on staging first
- **Redis dependency** - New failure point
  - **Mitigation:** Graceful degradation (cache miss = generate embedding)

### Medium Risk
- **Cache invalidation complexity** - Stale results if docs updated
  - **Mitigation:** Short TTL (5-10 min), manual cache clear endpoint
- **Memory usage increase** - HNSW index + Redis
  - **Mitigation:** Monitor, set Redis maxmemory limits

### Low Risk
- **Query embedding cache poisoning** - Bad embeddings cached
  - **Mitigation:** Validate embeddings before caching, add cache clear endpoint

---

## Cost-Benefit Analysis

### Development Time Investment
- Phase 1 (Quick Wins): 2 days
- Phase 2 (Core Optimizations): 3 days
- Phase 3 (Advanced): 5 days
- **Total:** ~10 days

### Performance Gains
- **Embedding Cache:** 50-70% reduction in Azure API calls → ~$50-100/month savings
- **HNSW Index:** 50-80% faster vector search
- **Result Cache:** 10-20% of searches served from cache
- **Overall:** 80% improvement (5.5s → 1.1s average)

### User Experience Impact
- **Before:** 5.5s avg search = poor UX, users frustrated
- **After:** 1.1s avg search = acceptable UX, production-ready
- **Retention:** Faster search = more usage = more value

---

## Appendix: Testing Plan

### Performance Testing
```bash
#!/bin/bash
# performance-test.sh

echo "=== BASELINE TEST (Before Optimizations) ==="
for i in {1..10}; do
  start=$(date +%s%3N)
  curl -s -X POST "http://localhost:8181/api/knowledge/search" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"test query $i\", \"match_count\": 10}" > /dev/null
  end=$(date +%s%3N)
  duration=$((end - start))
  echo "Query $i: ${duration}ms"
done

echo ""
echo "=== CACHE HIT TEST (After Redis Implementation) ==="
# Run same query twice
QUERY='{"query": "pydantic validation", "match_count": 5}'
start1=$(date +%s%3N)
curl -s -X POST "http://localhost:8181/api/knowledge/search" \
  -H "Content-Type: application/json" -d "$QUERY" > /dev/null
end1=$(date +%s%3N)
duration1=$((end1 - start1))

start2=$(date +%s%3N)
curl -s -X POST "http://localhost:8181/api/knowledge/search" \
  -H "Content-Type: application/json" -d "$QUERY" > /dev/null
end2=$(date +%s%3N)
duration2=$((end2 - start2))

echo "First call (cache miss): ${duration1}ms"
echo "Second call (cache hit): ${duration2}ms"
echo "Improvement: $((100 - duration2 * 100 / duration1))%"
```

### Validation Tests
```bash
# Test source filtering works
curl -X POST "http://localhost:8181/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication", "source_id": "e78dce57d572c115", "match_count": 5}' | \
  jq '.total, .results[].source_id'

# Should return: 5, "e78dce57d572c115", "e78dce57d572c115", ...

# Test short query validation
curl -X POST "http://localhost:8181/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "API", "match_count": 3}' | \
  jq '.detail.error'

# Should return: "Query too short"
```

---

**End of Optimization Plan**
**Next Steps:** Review with team, prioritize tasks, begin Phase 1
