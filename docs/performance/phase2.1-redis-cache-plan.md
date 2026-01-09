# Phase 2.1: Redis Embedding Cache Implementation Plan

**Date:** 2026-01-09
**Task ID:** `2554c669-d0b8-4cae-be05-133f4f548566`
**Estimated Duration:** 3 hours
**Priority:** HIGH

---

## Executive Summary

Implement Redis caching for OpenAI embedding API calls to reduce latency and costs.

**Current State:**
- Every search query generates a new embedding (0.9-1.2s per query)
- Azure OpenAI API called for each request
- No caching layer

**Target State:**
- Cache embeddings in Redis with 7-day TTL
- Reduce cached query embedding time: 0.9-1.2s → <0.1s (90% improvement)
- Expected cache hit rate: 30-50% after initial usage
- Estimated cost savings: $50-100/month in Azure API calls

---

## Implementation Steps

### Step 1: Add Redis to Docker Compose (30 min)

**File:** `docker-compose.yml`

Add Redis service:
```yaml
services:
  redis-archon:
    image: redis:7-alpine
    container_name: redis-archon
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis-archon-data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis-archon-data:
    driver: local
```

**Environment Variables** (`.env`):
```bash
# Redis Configuration
REDIS_HOST=redis-archon
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=  # Optional, leave empty for no auth
REDIS_TTL_DAYS=7  # 7-day TTL for embeddings
```

### Step 2: Install Redis Python Client (5 min)

**File:** `python/pyproject.toml`

Add dependency:
```toml
[tool.poetry.dependencies]
redis = "^5.0.0"
```

Run: `poetry install` or `uv sync`

### Step 3: Create Redis Cache Service (45 min)

**New File:** `python/src/server/services/embeddings/redis_cache.py`

```python
"""
Redis cache service for embeddings.
"""
import hashlib
import json
import os
from typing import Optional

import redis.asyncio as redis
from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class EmbeddingCache:
    """Redis-based cache for OpenAI embeddings."""

    def __init__(self):
        self.redis_host = os.getenv("REDIS_HOST", "localhost")
        self.redis_port = int(os.getenv("REDIS_PORT", "6379"))
        self.redis_db = int(os.getenv("REDIS_DB", "0"))
        self.redis_password = os.getenv("REDIS_PASSWORD") or None
        self.ttl_days = int(os.getenv("REDIS_TTL_DAYS", "7"))
        self.ttl_seconds = self.ttl_days * 24 * 60 * 60

        self._client: Optional[redis.Redis] = None
        self._enabled = True  # Can disable via env var

    async def connect(self):
        """Connect to Redis."""
        if not self._enabled:
            logger.info("Redis cache is disabled")
            return

        try:
            self._client = await redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                db=self.redis_db,
                password=self.redis_password,
                decode_responses=False,  # We'll store binary data
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            await self._client.ping()
            logger.info(f"✅ Connected to Redis at {self.redis_host}:{self.redis_port}")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}. Cache disabled.")
            self._enabled = False
            self._client = None

    async def disconnect(self):
        """Disconnect from Redis."""
        if self._client:
            await self._client.aclose()
            logger.info("Disconnected from Redis")

    def _generate_cache_key(self, text: str, model: str, dimensions: Optional[int] = None) -> str:
        """Generate cache key from text, model, and dimensions."""
        # Hash the text for consistent key length
        text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]

        # Include model and dimensions in key
        key_parts = ["emb", model, str(dimensions or "default"), text_hash]
        return ":".join(key_parts)

    async def get(self, text: str, model: str, dimensions: Optional[int] = None) -> Optional[list[float]]:
        """Get embedding from cache."""
        if not self._enabled or not self._client:
            return None

        try:
            key = self._generate_cache_key(text, model, dimensions)
            cached = await self._client.get(key)

            if cached:
                logger.debug(f"✅ Cache HIT for key: {key[:50]}...")
                return json.loads(cached)

            logger.debug(f"❌ Cache MISS for key: {key[:50]}...")
            return None
        except Exception as e:
            logger.warning(f"Redis get error: {e}")
            return None

    async def set(self, text: str, model: str, embedding: list[float], dimensions: Optional[int] = None):
        """Store embedding in cache."""
        if not self._enabled or not self._client:
            return

        try:
            key = self._generate_cache_key(text, model, dimensions)
            value = json.dumps(embedding)

            await self._client.setex(
                key,
                self.ttl_seconds,
                value
            )
            logger.debug(f"✅ Cached embedding for key: {key[:50]}... (TTL: {self.ttl_days} days)")
        except Exception as e:
            logger.warning(f"Redis set error: {e}")

    async def get_stats(self) -> dict:
        """Get cache statistics."""
        if not self._enabled or not self._client:
            return {"enabled": False}

        try:
            info = await self._client.info("stats")
            return {
                "enabled": True,
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "hit_rate": self._calculate_hit_rate(
                    info.get("keyspace_hits", 0),
                    info.get("keyspace_misses", 0)
                ),
            }
        except Exception as e:
            logger.warning(f"Redis stats error: {e}")
            return {"enabled": True, "error": str(e)}

    def _calculate_hit_rate(self, hits: int, misses: int) -> float:
        """Calculate cache hit rate percentage."""
        total = hits + misses
        if total == 0:
            return 0.0
        return (hits / total) * 100


# Global cache instance
_embedding_cache: Optional[EmbeddingCache] = None


async def get_embedding_cache() -> EmbeddingCache:
    """Get or create the global embedding cache instance."""
    global _embedding_cache
    if _embedding_cache is None:
        _embedding_cache = EmbeddingCache()
        await _embedding_cache.connect()
    return _embedding_cache
```

### Step 4: Integrate Cache into Embedding Service (60 min)

**File:** `python/src/server/services/embeddings/embedding_service.py`

Modify the `create_embedding()` function to check cache first:

```python
from .redis_cache import get_embedding_cache

async def create_embedding(
    text: str,
    model: str | None = None,
    dimensions: int | None = None,
) -> list[float] | None:
    """
    Create an OpenAI embedding for the given text with Redis caching.

    Args:
        text: Text to create embedding for
        model: Optional override for embedding model
        dimensions: Optional override for embedding dimensions

    Returns:
        Embedding vector or None if creation fails
    """
    if not text or not text.strip():
        return None

    # Get cache instance
    cache = await get_embedding_cache()

    # Try to get from cache first
    cached_embedding = await cache.get(text, model or DEFAULT_MODEL, dimensions)
    if cached_embedding:
        search_logger.info("✅ Embedding cache HIT")
        return cached_embedding

    # Cache miss - generate new embedding
    search_logger.info("❌ Embedding cache MISS - calling API")

    # [Existing embedding generation code here...]
    embedding = await _generate_embedding_from_api(text, model, dimensions)

    if embedding:
        # Store in cache for future use
        await cache.set(text, model or DEFAULT_MODEL, embedding, dimensions)

    return embedding
```

### Step 5: Add Cache Metrics Endpoint (30 min)

**File:** `python/src/server/api_routes/knowledge_api.py`

Add new endpoint:

```python
@router.get("/cache/stats")
async def get_cache_stats():
    """Get Redis cache statistics."""
    from ..services.embeddings.redis_cache import get_embedding_cache

    cache = await get_embedding_cache()
    stats = await cache.get_stats()

    return {
        "success": True,
        "cache_stats": stats,
        "ttl_days": cache.ttl_days if cache._enabled else None,
    }
```

### Step 6: Update Startup/Shutdown Hooks (15 min)

**File:** `python/src/server/main.py`

Add Redis lifecycle management:

```python
from .services.embeddings.redis_cache import get_embedding_cache

@app.on_event("startup")
async def startup():
    # [Existing startup code...]

    # Initialize Redis cache
    try:
        cache = await get_embedding_cache()
        logger.info("✅ Redis embedding cache initialized")
    except Exception as e:
        logger.warning(f"⚠️ Redis cache initialization failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    # Disconnect Redis
    cache = await get_embedding_cache()
    await cache.disconnect()

    # [Existing shutdown code...]
```

---

## Testing Plan

### Test 1: Cache Functionality (15 min)

```bash
# Start services with Redis
docker-compose up -d

# Test cache miss (first query)
time curl -X POST "http://localhost:8181/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "test query for caching", "match_count": 5}'
# Expected: ~8-9s (normal time with embedding generation)

# Test cache hit (same query again)
time curl -X POST "http://localhost:8181/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "test query for caching", "match_count": 5}'
# Expected: ~7-8s (0.9-1.2s faster due to cached embedding)

# Check cache stats
curl "http://localhost:8181/api/cache/stats"
# Expected: hit_rate > 0%
```

### Test 2: Performance Comparison (15 min)

Run 10 queries with common search terms:
- First run: All cache misses
- Second run: All cache hits
- Compare total time reduction

Expected improvement: 9-12 seconds saved across 10 queries

---

## Acceptance Criteria

- [ ] Redis container running in docker-compose
- [ ] `redis-py` installed in Python environment
- [ ] Cache service implemented with proper error handling
- [ ] Cache integrated into `create_embedding()` function
- [ ] Cache hit/miss logged with appropriate levels
- [ ] Cache stats endpoint returns accurate metrics
- [ ] Cached queries show 0.9-1.2s improvement in embedding time
- [ ] Cache misses work identically to before (fallback to API)
- [ ] Redis connection failures don't break searches (graceful degradation)
- [ ] 7-day TTL configured correctly

---

## Expected Performance Impact

**Before Redis Cache:**
| Metric | Value |
|--------|-------|
| Embedding generation (cold) | 0.9-1.2s |
| Total search time | 8-18s |
| Azure API cost/month | ~$150-200 |

**After Redis Cache (at 40% hit rate):**
| Metric | Value |
|--------|-------|
| Embedding generation (cached) | <0.1s |
| Embedding generation (uncached) | 0.9-1.2s |
| Total search time (cached) | 7-17s |
| Total search time (uncached) | 8-18s |
| Azure API cost/month | ~$90-120 (40% reduction) |

**Compounding Benefits:**
- Popular queries benefit most (higher cache hit rate over time)
- Repeated research sessions benefit immediately
- Cost savings compound with scale

---

## Rollback Plan

If Redis causes issues:

1. Set `REDIS_ENABLED=false` in `.env`
2. Restart `archon-server` container
3. Searches fall back to direct API calls (original behavior)

No data loss - cache is ephemeral by design.

---

## Future Enhancements (Post Phase 2.1)

- **Result caching**: Cache full search results (Phase 3)
- **Cache warming**: Pre-populate cache with common queries
- **Multi-level cache**: Add in-memory LRU cache for hot queries
- **Cache analytics**: Track most cached queries, hit rate trends

---

**Plan Created:** 2026-01-09
**Ready for Implementation:** Yes
**Estimated ROI:** 0.9-1.2s improvement per cached query + cost savings
