"""
Result Cache Service

Caches complete search results to reduce database load and improve response times.
Follows the same pattern as embedding_cache.py for consistency.

Cache Strategy:
- Key: SHA256(query + filters + match_count)
- TTL: 1 hour (configurable)
- Invalidation: On source refresh
- Storage: Redis

Created: 2026-01-23
Phase: 3.1 - Result Caching Implementation
"""

import hashlib
import json
import os
import time
from typing import Optional, Any, Dict, List

import redis.asyncio as redis
from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class ResultCache:
    """Redis-based cache for search results."""

    def __init__(self):
        self.redis_host = os.getenv("REDIS_HOST", "localhost")
        self.redis_port = int(os.getenv("REDIS_PORT", "6379"))
        self.redis_db = int(os.getenv("REDIS_DB", "0"))
        self.redis_password = os.getenv("REDIS_PASSWORD") or None

        # Result cache has shorter TTL than embeddings (1 hour vs 7 days)
        # Results can become stale if sources are refreshed
        self.ttl_hours = int(os.getenv("RESULT_CACHE_TTL_HOURS", "1"))
        self.ttl_seconds = self.ttl_hours * 60 * 60

        self._client: Optional[redis.Redis] = None
        self._enabled = os.getenv("RESULT_CACHE_ENABLED", "true").lower() == "true"

    async def connect(self):
        """Connect to Redis."""
        if not self._enabled:
            logger.info("Result cache is disabled")
            return

        try:
            self._client = await redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                db=self.redis_db,
                password=self.redis_password,
                decode_responses=False,  # Store binary data
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            await self._client.ping()
            logger.info(
                f"✅ Result cache connected to Redis at {self.redis_host}:{self.redis_port} "
                f"(TTL: {self.ttl_hours}h)"
            )
        except Exception as e:
            logger.warning(f"Failed to connect to Redis for result cache: {e}. Cache disabled.")
            self._enabled = False
            self._client = None

    async def disconnect(self):
        """Disconnect from Redis."""
        if self._client:
            await self._client.aclose()
            logger.info("Result cache disconnected from Redis")

    def _generate_cache_key(
        self,
        query: str,
        search_type: str,
        match_count: int,
        source_id: Optional[str] = None,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Generate cache key from query parameters.

        Args:
            query: Search query text
            search_type: Type of search (rag_query, code_examples, content_search)
            match_count: Number of results requested
            source_id: Optional source filter
            filter_metadata: Optional additional filters

        Returns:
            Cache key string
        """
        # Build a deterministic string from all parameters
        params = {
            "query": query,
            "type": search_type,
            "count": match_count,
            "source": source_id or "",
            "filters": json.dumps(filter_metadata or {}, sort_keys=True),
        }

        # Create consistent key string
        key_string = json.dumps(params, sort_keys=True)

        # Hash for consistent key length
        key_hash = hashlib.sha256(key_string.encode('utf-8')).hexdigest()[:16]

        # Format: result:{type}:{hash}
        return f"result:{search_type}:{key_hash}"

    async def get(
        self,
        query: str,
        search_type: str,
        match_count: int,
        source_id: Optional[str] = None,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get cached search results.

        Returns:
            Cached results or None if not found/expired
        """
        if not self._enabled or not self._client:
            return None

        start_time = time.time()
        try:
            key = self._generate_cache_key(query, search_type, match_count, source_id, filter_metadata)
            cached = await self._client.get(key)

            latency_ms = (time.time() - start_time) * 1000

            if cached:
                logger.debug(
                    f"✅ Result cache HIT | type={search_type} | key={key[:30]}... | "
                    f"latency={latency_ms:.1f}ms"
                )
                # Record cache hit timing
                try:
                    from ..performance_metrics import get_metrics_service
                    metrics = get_metrics_service()
                    metrics.record_cache_hit(latency_ms)
                except Exception:
                    pass  # Don't fail cache operations due to metrics errors

                return json.loads(cached)

            logger.debug(
                f"❌ Result cache MISS | type={search_type} | key={key[:30]}... | "
                f"latency={latency_ms:.1f}ms"
            )
            # Record cache miss timing
            try:
                from ..performance_metrics import get_metrics_service
                metrics = get_metrics_service()
                metrics.record_cache_miss(latency_ms)
            except Exception:
                pass

            return None

        except Exception as e:
            logger.warning(f"Result cache get error: {e}")
            return None

    async def set(
        self,
        query: str,
        search_type: str,
        match_count: int,
        results: List[Dict[str, Any]],
        source_id: Optional[str] = None,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ):
        """
        Store search results in cache.

        Args:
            query: Search query text
            search_type: Type of search
            match_count: Number of results
            results: Search results to cache
            source_id: Optional source filter
            filter_metadata: Optional additional filters
        """
        if not self._enabled or not self._client:
            return

        try:
            key = self._generate_cache_key(query, search_type, match_count, source_id, filter_metadata)
            value = json.dumps(results)

            await self._client.setex(
                key,
                self.ttl_seconds,
                value
            )

            logger.debug(
                f"✅ Result cached | type={search_type} | key={key[:30]}... | "
                f"results={len(results)} | TTL={self.ttl_hours}h"
            )

        except Exception as e:
            logger.warning(f"Result cache set error: {e}")

    async def invalidate_source(self, source_id: str):
        """
        Invalidate all cached results for a specific source.

        Called when a source is refreshed to ensure users get updated results.
        Uses pattern matching to find and delete all relevant cache keys.

        Args:
            source_id: Source ID to invalidate
        """
        if not self._enabled or not self._client:
            return

        try:
            # Find all result cache keys (pattern: result:*:*)
            pattern = "result:*:*"
            deleted_count = 0

            # Scan for matching keys
            async for key in self._client.scan_iter(match=pattern, count=100):
                # Get the cached value to check if it contains this source_id
                try:
                    cached = await self._client.get(key)
                    if cached:
                        results = json.loads(cached)
                        # Check if any result references this source
                        if any(r.get("source_id") == source_id for r in results if isinstance(r, dict)):
                            await self._client.delete(key)
                            deleted_count += 1
                except Exception as e:
                    logger.warning(f"Error checking cache key {key}: {e}")
                    continue

            if deleted_count > 0:
                logger.info(f"✅ Invalidated {deleted_count} cached results for source={source_id}")

        except Exception as e:
            logger.warning(f"Result cache invalidation error for source={source_id}: {e}")

    async def invalidate_pattern(self, search_type: Optional[str] = None):
        """
        Invalidate cached results by pattern.

        Args:
            search_type: If provided, only invalidate this search type.
                        If None, invalidate all result caches.
        """
        if not self._enabled or not self._client:
            return

        try:
            if search_type:
                pattern = f"result:{search_type}:*"
            else:
                pattern = "result:*:*"

            deleted_count = 0
            async for key in self._client.scan_iter(match=pattern, count=100):
                await self._client.delete(key)
                deleted_count += 1

            logger.info(
                f"✅ Invalidated {deleted_count} cached results | "
                f"pattern={pattern}"
            )

        except Exception as e:
            logger.warning(f"Result cache pattern invalidation error: {e}")

    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        if not self._enabled or not self._client:
            return {"enabled": False}

        try:
            # Count result cache keys
            result_count = 0
            async for _ in self._client.scan_iter(match="result:*:*", count=100):
                result_count += 1

            # Get Redis stats
            info = await self._client.info("stats")

            return {
                "enabled": True,
                "cached_results": result_count,
                "ttl_hours": self.ttl_hours,
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "hit_rate": self._calculate_hit_rate(
                    info.get("keyspace_hits", 0),
                    info.get("keyspace_misses", 0)
                ),
            }
        except Exception as e:
            logger.warning(f"Result cache stats error: {e}")
            return {"enabled": True, "error": str(e)}

    def _calculate_hit_rate(self, hits: int, misses: int) -> float:
        """Calculate cache hit rate percentage."""
        total = hits + misses
        if total == 0:
            return 0.0
        return (hits / total) * 100


# Global cache instance (singleton pattern)
_result_cache: Optional[ResultCache] = None


async def get_result_cache() -> ResultCache:
    """Get or create the global result cache instance."""
    global _result_cache
    if _result_cache is None:
        _result_cache = ResultCache()
        await _result_cache.connect()
    return _result_cache
