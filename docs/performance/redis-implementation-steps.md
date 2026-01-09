# Redis Cache Implementation - Remaining Steps

**Status**: Index building (145s elapsed, ~3-7 mins remaining)

## ✅ Completed Steps

1. **Docker Compose**: Redis service added to `docker-compose.yml`
2. **Environment Variables**: Redis config added to `docker-compose.yml` and `.env`
3. **Volume**: `redis-archon-data` volume configured

## 📋 Remaining Steps (Execute After Index Completes)

### Step 1: Add Redis Dependency

```bash
cd /home/ljutzkanov/Documents/Projects/archon/python
uv add redis
```

### Step 2: Create Redis Cache Service

Create file: `python/src/server/services/embeddings/redis_cache.py`

**File already prepared** in: `docs/performance/phase2.1-redis-cache-plan.md` (lines 82-227)

Copy implementation from the plan (Step 3 section).

### Step 3: Integrate Cache into Embedding Service

Edit: `python/src/server/services/embeddings/embedding_service.py`

Add at top of file:
```python
from .redis_cache import get_embedding_cache
```

Modify `create_embedding()` function (reference: `docs/performance/phase2.1-redis-cache-plan.md` lines 232-277):

```python
async def create_embedding(
    text: str,
    model: str | None = None,
    dimensions: int | None = None,
) -> list[float] | None:
    """Create an OpenAI embedding with Redis caching."""
    if not text or not text.strip():
        return None

    # Get cache instance
    cache = await get_embedding_cache()

    # Try cache first
    cached_embedding = await cache.get(text, model or DEFAULT_MODEL, dimensions)
    if cached_embedding:
        search_logger.info("✅ Embedding cache HIT")
        return cached_embedding

    # Cache miss - generate new embedding
    search_logger.info("❌ Embedding cache MISS - calling API")

    # [Existing embedding generation code...]
    embedding = await _generate_embedding_from_api(text, model, dimensions)

    if embedding:
        # Store in cache
        await cache.set(text, model or DEFAULT_MODEL, embedding, dimensions)

    return embedding
```

### Step 4: Add Cache Stats Endpoint

Edit: `python/src/server/api_routes/knowledge_api.py`

Add endpoint:
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

### Step 5: Update Startup/Shutdown Hooks

Edit: `python/src/server/main.py`

Add to imports:
```python
from .services.embeddings.redis_cache import get_embedding_cache
```

Update startup:
```python
@app.on_event("startup")
async def startup():
    # [Existing startup code...]

    # Initialize Redis cache
    try:
        cache = await get_embedding_cache()
        logger.info("✅ Redis embedding cache initialized")
    except Exception as e:
        logger.warning(f"⚠️  Redis cache initialization failed: {e}")
```

Update shutdown:
```python
@app.on_event("shutdown")
async def shutdown():
    # Disconnect Redis
    try:
        cache = await get_embedding_cache()
        await cache.disconnect()
    except:
        pass

    # [Existing shutdown code...]
```

## 🚀 Deployment Steps

### 1. Verify Index is Complete

```bash
PGPASSWORD="iX5q1udmEe21xq6h" psql \
  -h aws-1-eu-west-2.pooler.supabase.com \
  -p 6543 \
  -U postgres.jnjarcdwwwycjgiyddua \
  -d postgres \
  -c "SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
      CASE WHEN indisvalid THEN 'VALID ✅' ELSE 'INVALID ❌' END as status
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
JOIN pg_index ON pg_index.indexrelid = pg_class.oid
WHERE tablename = 'archon_crawled_pages' AND indexname LIKE '%embedding%1536%';"
```

Expected output: `idx_archon_crawled_pages_embedding_1536 | ~1.7 GB | VALID ✅`

### 2. Execute Redis Implementation Steps 1-5

Follow Steps 1-5 above in order.

### 3. Rebuild and Restart Services

```bash
cd /home/ljutzkanov/Documents/Projects/archon

# Rebuild with Redis
docker compose build archon-server

# Restart services
docker compose down
docker compose up -d

# Check Redis is running
docker ps | grep redis-archon
docker logs redis-archon

# Check services started successfully
docker logs archon-server | grep -i redis
```

### 4. Test Redis Cache

```bash
# Test 1: Cache miss (first query)
time curl -X POST "http://localhost:8181/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "test query for caching", "match_count": 5}'

# Test 2: Cache hit (same query)
time curl -X POST "http://localhost:8181/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "test query for caching", "match_count": 5}'

# Test 3: Cache stats
curl "http://localhost:8181/api/cache/stats" | python3 -m json.tool
```

Expected improvements:
- First query: 8-18s (normal)
- Second query: 7-17s (0.9-1.2s faster)
- Cache hit rate: >0%

## 📊 Expected Performance

**Before Redis**:
- Embedding generation: 0.9-1.2s per query
- Total search time: 8-18s

**After Redis (at 40% hit rate)**:
- Cached embedding: <0.1s
- Uncached embedding: 0.9-1.2s
- Total search time (cached): 7-17s
- Cost savings: ~40% reduction in Azure API calls

## 🔍 Troubleshooting

**Redis won't start**:
```bash
docker logs redis-archon
docker exec -it redis-archon redis-cli ping
```

**Cache not working**:
```bash
docker logs archon-server | grep -i redis
docker exec -it redis-archon redis-cli
> KEYS *
> GET emb:text-embedding-ada-002:default:*
```

**Connection refused**:
```bash
docker exec -it redis-archon redis-cli
> PING
docker network inspect app-network | grep redis
```

## 📝 Verification Checklist

- [ ] IVFFlat index is VALID
- [ ] Redis dependency added (`redis>=5.0.0`)
- [ ] Redis cache service created
- [ ] Cache integrated into `create_embedding()`
- [ ] Cache stats endpoint added
- [ ] Startup/shutdown hooks updated
- [ ] Services rebuilt and restarted
- [ ] Redis container running
- [ ] Cache hit/miss logs appearing
- [ ] Cache stats endpoint working
- [ ] Cached queries showing improvement
- [ ] Graceful degradation on Redis failure

## 🎉 Success Criteria

- ✅ Redis container running
- ✅ Cache hit/miss logged correctly
- ✅ Cached queries 0.9-1.2s faster
- ✅ Cache stats endpoint returns data
- ✅ No errors in archon-server logs
- ✅ Search still works if Redis fails

## 📚 Reference

- Implementation plan: `docs/performance/phase2.1-redis-cache-plan.md`
- Redis cache service template: Plan document, lines 82-227
- Integration example: Plan document, lines 232-277
