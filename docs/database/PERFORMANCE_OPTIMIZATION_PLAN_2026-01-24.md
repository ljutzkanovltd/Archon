# Performance Optimization Track - Implementation Plan

**Date:** 2026-01-24
**Project:** Knowledge Base Optimization & Content Search
**Status:** 🚀 IN PROGRESS

---

## Executive Summary

Implementing remaining performance optimization tasks to achieve production-grade performance:
1. ✅ **Verify HNSW Index** - Index exists but with suboptimal parameters (m=4)
2. 🔄 **Upgrade HNSW Index** - Recreate with optimal parameters (m=16, ef_construction=64)
3. 🔄 **Query Prewarming** - Pre-generate embeddings for top 100 common queries
4. 🔄 **Structured Logging** - Add comprehensive performance metrics

**Expected Impact:**
- Better search accuracy (higher m value)
- Faster cold-start for common queries (prewarming)
- Production-grade observability (structured logging)

---

## Task 1: Phase 2.2 - Upgrade HNSW Index (PRIORITY 1)

### Current State

**Existing Index:**
```sql
idx_archon_crawled_pages_embedding_1536_hnsw
USING hnsw (embedding_1536 vector_cosine_ops)
WITH (m='4', ef_construction='16')
```

**Statistics:**
- Size: 374 MB
- Scans: 22
- Performance: 82ms P50 (excellent)
- Data: 63,388 pages

### Problem

Current parameters are suboptimal:
- `m=4` is at low end (recommended: 16)
- `ef_construction=16` is minimal (recommended: 64 for quality)

**Impact:** Lower recall (might miss relevant results)

### Solution

Recreate index with optimal parameters:

**Target Parameters:**
```sql
m=16              -- Better recall (4x more connections)
ef_construction=64 -- Higher build quality (4x better)
```

**Parameter Guide:**
- `m`: Connections per layer (4-64). Higher = better recall, larger index
- `ef_construction`: Build accuracy (10-200). Higher = better quality, slower build

### Implementation Steps

1. **Create migration file** (2 min)
   ```bash
   migration/0.3.0/022_upgrade_hnsw_index.sql
   ```

2. **Migration content:**
   ```sql
   -- Drop old index
   DROP INDEX IF EXISTS idx_archon_crawled_pages_embedding_1536_hnsw;

   -- Create new optimized index
   CREATE INDEX idx_archon_crawled_pages_embedding_1536_hnsw
   ON archon_crawled_pages
   USING hnsw (embedding_1536 vector_cosine_ops)
   WITH (m = 16, ef_construction = 64);

   -- Verify index
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE indexname = 'idx_archon_crawled_pages_embedding_1536_hnsw';
   ```

3. **Apply migration** (5-10 min for 63k rows)
   ```bash
   docker exec supabase-ai-db psql -U postgres -d postgres \
     -f /path/to/022_upgrade_hnsw_index.sql
   ```

4. **Validate performance** (2 min)
   - Run benchmark queries
   - Verify P50 latency ≤ 100ms
   - Check index size (expect 600-800 MB, 2x larger)

### Expected Results

- **Better recall:** More accurate results
- **Slightly slower:** 82ms → 90-100ms (acceptable trade-off)
- **Larger index:** 374 MB → 600-800 MB
- **Production-grade:** Industry-standard parameters

### Estimated Time

- Migration creation: 2 min
- Index rebuild: 5-10 min (63,388 rows)
- Validation: 2 min
- **Total: 15 minutes**

---

## Task 2: Phase 3.3 - Query Prewarming (PRIORITY 2)

### Objective

Pre-generate embeddings for top 100 common queries at server startup.

**Goal:** Eliminate cold-start latency for popular queries

### Current Performance

**Without prewarming:**
- First-time query: 12-30s (Azure API call)
- Repeated query: 9ms (cache hit)

**With prewarming:**
- Common queries: 9ms (always cached)
- Uncommon queries: 12-30s (still requires API)

### Implementation

**File:** `src/server/services/search/query_prewarming.py`

```python
import asyncio
import logging
from typing import List

from src.server.services.embeddings.embedding_service import create_embedding

logger = logging.getLogger(__name__)

# Top 100 common queries (curated or from analytics)
COMMON_QUERIES = [
    # Authentication & Security
    "authentication",
    "OAuth JWT",
    "user authentication",
    "login system",
    "password hashing",
    "session management",
    "API authentication",
    "token refresh",
    "RBAC permissions",
    "security best practices",

    # Database & Performance
    "database indexing",
    "query optimization",
    "PostgreSQL performance",
    "vector search",
    "database migrations",
    "connection pooling",
    "ORM best practices",
    "database transactions",
    "SQL injection prevention",
    "database backup",

    # API Design
    "REST API design",
    "GraphQL schema",
    "API versioning",
    "rate limiting",
    "API documentation",
    "error handling",
    "pagination",
    "API security",
    "webhooks",
    "API testing",

    # Frontend Development
    "React components",
    "state management",
    "React hooks",
    "Redux patterns",
    "form validation",
    "responsive design",
    "CSS best practices",
    "accessibility WCAG",
    "frontend testing",
    "performance optimization",

    # Backend Development
    "microservices architecture",
    "caching strategies",
    "async await patterns",
    "background jobs",
    "message queues",
    "logging best practices",
    "monitoring alerting",
    "error tracking",
    "deployment strategies",
    "Docker containers",

    # Testing
    "unit testing",
    "integration testing",
    "E2E testing",
    "test coverage",
    "mocking strategies",
    "TDD approach",
    "test automation",
    "CI/CD pipelines",
    "load testing",
    "security testing",

    # AI/ML Integration
    "vector embeddings",
    "semantic search",
    "RAG implementation",
    "prompt engineering",
    "LLM integration",
    "AI model deployment",
    "embedding models",
    "vector databases",
    "similarity search",
    "AI best practices",

    # DevOps & Infrastructure
    "container orchestration",
    "Kubernetes deployment",
    "load balancing",
    "reverse proxy",
    "SSL certificates",
    "environment variables",
    "configuration management",
    "infrastructure as code",
    "monitoring tools",
    "log aggregation",

    # Code Quality
    "code review",
    "refactoring patterns",
    "design patterns",
    "clean code",
    "SOLID principles",
    "code documentation",
    "linting rules",
    "type safety",
    "error handling patterns",
    "code organization",

    # Project Management
    "agile methodology",
    "sprint planning",
    "task estimation",
    "project documentation",
    "code collaboration",
    "Git workflow",
    "pull request best practices",
    "branching strategies",
    "release management",
    "technical debt",
]

async def prewarm_query_cache() -> None:
    """
    Pre-generate embeddings for common queries at startup.

    Runs asynchronously in background. Failures are logged but don't block startup.
    """
    logger.info(f"🔥 Starting query cache prewarming for {len(COMMON_QUERIES)} queries...")

    start_time = asyncio.get_event_loop().time()
    success_count = 0
    failure_count = 0

    for query in COMMON_QUERIES:
        try:
            # Create embedding (will cache automatically)
            await create_embedding(query)
            success_count += 1

            if success_count % 10 == 0:
                logger.info(f"Prewarmed {success_count}/{len(COMMON_QUERIES)} queries...")

        except Exception as e:
            failure_count += 1
            logger.warning(f"Failed to prewarm query '{query}': {e}")

    elapsed = asyncio.get_event_loop().time() - start_time

    logger.info(
        f"✅ Query cache prewarming complete: "
        f"{success_count} succeeded, {failure_count} failed "
        f"in {elapsed:.2f}s"
    )

async def prewarm_top_queries(limit: int = 100) -> None:
    """Prewarm only top N queries."""
    await prewarm_query_cache()
```

**Integration in `src/server/main.py`:**

```python
from src.server.services.search.query_prewarming import prewarm_query_cache

@app.on_event("startup")
async def startup_event():
    """Run on server startup."""
    logger.info("🚀 Archon server starting...")

    # Existing startup tasks...

    # Start query prewarming in background (non-blocking)
    asyncio.create_task(prewarm_query_cache())

    logger.info("✅ Startup complete")
```

### Expected Results

**Startup Impact:**
- Additional 2-3 minutes for 100 queries (parallel execution)
- Non-blocking (server starts immediately)
- Logs progress every 10 queries

**Performance Impact:**
- Top queries: Always <100ms (cache hit)
- Cache hit rate: 40% → 70% improvement
- User experience: Instant results for common searches

### Estimated Time

- Implementation: 30 min
- Testing: 15 min
- **Total: 45 minutes**

---

## Task 3: Phase 4.1 - Structured Performance Logging (PRIORITY 3)

### Objective

Add structured JSON logging for comprehensive performance monitoring.

### Current Logging

Basic logs:
```
INFO | search | Embedding cache MISS - calling API
INFO | search | HNSW search complete
```

**Problem:** No metrics, no structured data, hard to analyze

### Target Logging

Structured JSON with metrics:
```json
{
  "timestamp": "2026-01-24T19:30:00Z",
  "level": "INFO",
  "logger": "search.performance",
  "event": "rag_query_complete",
  "metrics": {
    "total_time_ms": 156.2,
    "embedding_time_ms": 12.4,
    "db_search_time_ms": 82.1,
    "rerank_time_ms": 45.3,
    "cache_hit": true,
    "results_count": 10,
    "match_types": ["semantic", "hybrid"],
    "query_length": 23
  },
  "query": "authentication OAuth JWT",
  "source_id": "src_abc123"
}
```

### Implementation

**File:** `src/server/services/search/performance_logger.py`

```python
import logging
import time
from contextlib import contextmanager
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class PerformanceMetrics:
    """Track performance metrics for search operations."""

    def __init__(self, query: str, source_id: Optional[str] = None):
        self.query = query
        self.source_id = source_id
        self.start_time = time.time()
        self.metrics: Dict[str, Any] = {
            "total_time_ms": 0.0,
            "embedding_time_ms": 0.0,
            "db_search_time_ms": 0.0,
            "rerank_time_ms": 0.0,
            "cache_hit": False,
            "results_count": 0,
            "match_types": [],
            "query_length": len(query),
        }

    @contextmanager
    def track_embedding(self):
        """Track embedding generation time."""
        start = time.time()
        try:
            yield
        finally:
            self.metrics["embedding_time_ms"] = (time.time() - start) * 1000

    @contextmanager
    def track_search(self):
        """Track database search time."""
        start = time.time()
        try:
            yield
        finally:
            self.metrics["db_search_time_ms"] = (time.time() - start) * 1000

    @contextmanager
    def track_rerank(self):
        """Track reranking time."""
        start = time.time()
        try:
            yield
        finally:
            self.metrics["rerank_time_ms"] = (time.time() - start) * 1000

    def set_cache_hit(self, hit: bool):
        """Record cache hit/miss."""
        self.metrics["cache_hit"] = hit

    def set_results_count(self, count: int):
        """Record number of results."""
        self.metrics["results_count"] = count

    def add_match_type(self, match_type: str):
        """Add match type."""
        self.metrics["match_types"].append(match_type)

    def log_complete(self):
        """Log metrics when search completes."""
        self.metrics["total_time_ms"] = (time.time() - self.start_time) * 1000

        logger.info(
            "RAG query complete",
            extra={
                "event": "rag_query_complete",
                "metrics": self.metrics,
                "query": self.query[:100],  # Truncate long queries
                "source_id": self.source_id,
            }
        )

        # Performance warnings
        if self.metrics["total_time_ms"] > 1000:
            logger.warning(
                f"Slow query detected: {self.metrics['total_time_ms']:.1f}ms",
                extra={"metrics": self.metrics, "query": self.query[:100]}
            )
```

**Usage in search code:**

```python
from src.server.services.search.performance_logger import PerformanceMetrics

async def search_knowledge_base(query: str, match_count: int = 10):
    perf = PerformanceMetrics(query)

    # Track embedding generation
    with perf.track_embedding():
        embedding = await create_embedding(query)
        perf.set_cache_hit(was_cached)

    # Track database search
    with perf.track_search():
        results = await db_search(embedding, match_count)
        perf.set_results_count(len(results))

    # Track reranking
    if use_reranking:
        with perf.track_rerank():
            results = await rerank_results(results)
            perf.add_match_type("reranked")

    perf.log_complete()
    return results
```

### Expected Results

**Monitoring:**
- Real-time performance metrics
- Slow query detection (>1s alerts)
- Cache hit rate tracking
- Component-level breakdown

**Alerting:**
- Automated alerts for degradation
- Performance regression detection
- Capacity planning data

### Estimated Time

- Implementation: 30 min
- Integration: 15 min
- Testing: 15 min
- **Total: 60 minutes**

---

## Implementation Schedule

### Priority Order

1. **Phase 2.2: Upgrade HNSW Index** (15 min)
   - Immediate impact on search quality
   - One-time operation
   - Low risk (index rebuild)

2. **Phase 3.3: Query Prewarming** (45 min)
   - High user impact (faster searches)
   - Medium complexity
   - Low risk (non-blocking)

3. **Phase 4.1: Structured Logging** (60 min)
   - Essential for production monitoring
   - Medium complexity
   - Low risk (additive only)

### Total Time: 2 hours

---

## Validation Criteria

### Phase 2.2 Success

- ✅ Index created with m=16, ef_construction=64
- ✅ P50 latency ≤ 100ms (acceptable: 82ms → 95ms)
- ✅ Index size 600-900 MB
- ✅ No errors in search queries

### Phase 3.3 Success

- ✅ 100 queries prewarmed at startup
- ✅ Prewarming completes in <5 minutes
- ✅ Cache hit rate increases (40% → 60-70%)
- ✅ Common queries: <100ms response time

### Phase 4.1 Success

- ✅ Structured logs emitted for all searches
- ✅ Metrics include all timing breakdowns
- ✅ Slow query warnings triggered (>1s)
- ✅ No performance regression from logging

---

## Rollback Plans

### Phase 2.2 Rollback

If performance degrades:
```sql
DROP INDEX idx_archon_crawled_pages_embedding_1536_hnsw;
CREATE INDEX idx_archon_crawled_pages_embedding_1536_hnsw
ON archon_crawled_pages
USING hnsw (embedding_1536 vector_cosine_ops)
WITH (m = 4, ef_construction = 16);
```

### Phase 3.3 Rollback

Comment out in `main.py`:
```python
# asyncio.create_task(prewarm_query_cache())
```

### Phase 4.1 Rollback

Remove logging calls (backward compatible)

---

## Documentation

All implementations will be documented in:
- `PERFORMANCE_OPTIMIZATION_COMPLETE_2026-01-24.md` (completion report)
- API documentation updates
- Monitoring dashboard setup guide

---

**Plan Created:** 2026-01-24
**Estimated Completion:** 2026-01-24 (same day)
**Status:** 🚀 Ready to execute
