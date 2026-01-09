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
