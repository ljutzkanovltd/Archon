"""
Performance Metrics Service

Tracks request latencies, cache performance, and query metrics.
Provides aggregated statistics via /api/performance/stats endpoint.
"""

import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from threading import Lock
from typing import Dict, List, Optional

import numpy as np


@dataclass
class MetricPoint:
    """Single metric data point."""

    timestamp: datetime
    value: float
    metadata: Dict = field(default_factory=dict)


@dataclass
class CacheMetrics:
    """Cache performance metrics."""

    hits: int = 0
    misses: int = 0
    hit_times: List[float] = field(default_factory=list)
    miss_times: List[float] = field(default_factory=list)

    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

    @property
    def avg_hit_time(self) -> float:
        """Average time for cache hits (ms)."""
        return sum(self.hit_times) / len(self.hit_times) if self.hit_times else 0.0

    @property
    def avg_miss_time(self) -> float:
        """Average time for cache misses (ms)."""
        return sum(self.miss_times) / len(self.miss_times) if self.miss_times else 0.0


@dataclass
class EmbeddingMetrics:
    """Embedding generation metrics."""

    total_generated: int = 0
    latencies: List[float] = field(default_factory=list)
    batch_sizes: List[int] = field(default_factory=list)

    @property
    def avg_latency(self) -> float:
        """Average latency for embedding generation (ms)."""
        return sum(self.latencies) / len(self.latencies) if self.latencies else 0.0

    @property
    def batch_speedup(self) -> str:
        """Calculate batch processing speedup."""
        if not self.batch_sizes or not self.latencies:
            return "N/A"

        # Estimate single-item latency (assume ~100ms per item)
        single_item_latency = 100
        avg_batch_size = sum(self.batch_sizes) / len(self.batch_sizes)
        avg_batch_latency = self.avg_latency

        # Speedup = (single * batch_size) / batch_latency
        speedup = (single_item_latency * avg_batch_size) / avg_batch_latency if avg_batch_latency > 0 else 1.0
        return f"{speedup:.1f}x"


class PerformanceMetricsService:
    """
    Thread-safe performance metrics tracking service.

    Tracks:
    - Request latencies per endpoint (P50, P95, P99)
    - Cache hit/miss rates and timing
    - Embedding generation performance
    - Slow query detection (>1s)
    """

    def __init__(self, retention_hours: int = 1, max_points: int = 10000):
        """
        Initialize performance metrics service.

        Args:
            retention_hours: How long to retain metrics (default: 1 hour)
            max_points: Maximum data points per metric (default: 10000)
        """
        self._lock = Lock()
        self.retention_hours = retention_hours
        self.max_points = max_points

        # Endpoint latencies: {endpoint: [latency_ms, ...]}
        self._endpoint_latencies: Dict[str, deque] = defaultdict(lambda: deque(maxlen=max_points))

        # Cache metrics
        self._cache_metrics = CacheMetrics()

        # Embedding metrics
        self._embedding_metrics = EmbeddingMetrics()

        # Slow queries (>1s)
        self._slow_queries: deque = deque(maxlen=100)  # Keep last 100 slow queries

    def record_request(self, endpoint: str, latency_ms: float):
        """
        Record request latency for an endpoint.

        Args:
            endpoint: API endpoint path (e.g., "/api/knowledge/search")
            latency_ms: Request latency in milliseconds
        """
        with self._lock:
            self._endpoint_latencies[endpoint].append(latency_ms)

            # Track slow queries (>1000ms)
            if latency_ms > 1000:
                self._slow_queries.append({
                    "endpoint": endpoint,
                    "latency_ms": latency_ms,
                    "timestamp": datetime.now().isoformat(),
                })

    def record_cache_hit(self, latency_ms: float):
        """Record cache hit with timing."""
        with self._lock:
            self._cache_metrics.hits += 1
            self._cache_metrics.hit_times.append(latency_ms)
            # Keep last 1000 times
            if len(self._cache_metrics.hit_times) > 1000:
                self._cache_metrics.hit_times.pop(0)

    def record_cache_miss(self, latency_ms: float):
        """Record cache miss with timing."""
        with self._lock:
            self._cache_metrics.misses += 1
            self._cache_metrics.miss_times.append(latency_ms)
            # Keep last 1000 times
            if len(self._cache_metrics.miss_times) > 1000:
                self._cache_metrics.miss_times.pop(0)

    def record_embedding_generation(self, count: int, latency_ms: float):
        """
        Record embedding generation.

        Args:
            count: Number of embeddings generated
            latency_ms: Time taken to generate embeddings
        """
        with self._lock:
            self._embedding_metrics.total_generated += count
            self._embedding_metrics.latencies.append(latency_ms)
            self._embedding_metrics.batch_sizes.append(count)

            # Keep last 1000 records
            if len(self._embedding_metrics.latencies) > 1000:
                self._embedding_metrics.latencies.pop(0)
                self._embedding_metrics.batch_sizes.pop(0)

    def get_endpoint_stats(self, endpoint: str) -> Dict:
        """
        Get statistics for a specific endpoint.

        Returns P50, P95, P99 latencies, average, and count.
        """
        with self._lock:
            latencies = list(self._endpoint_latencies.get(endpoint, []))

        if not latencies:
            return {
                "p50": 0,
                "p95": 0,
                "p99": 0,
                "avg": 0,
                "count": 0,
            }

        return {
            "p50": int(np.percentile(latencies, 50)),
            "p95": int(np.percentile(latencies, 95)),
            "p99": int(np.percentile(latencies, 99)),
            "avg": int(np.mean(latencies)),
            "count": len(latencies),
        }

    def get_all_stats(self) -> Dict:
        """
        Get aggregated statistics for all tracked metrics.

        Returns:
            Dictionary with endpoints, cache, embeddings, and slow_queries stats
        """
        with self._lock:
            # Endpoint stats
            endpoints = {}
            for endpoint in self._endpoint_latencies.keys():
                endpoints[endpoint] = self.get_endpoint_stats(endpoint)

            # Cache stats
            cache_stats = {
                "hit_rate": round(self._cache_metrics.hit_rate, 2),
                "hits": self._cache_metrics.hits,
                "misses": self._cache_metrics.misses,
                "avg_hit_time": round(self._cache_metrics.avg_hit_time, 1),
                "avg_miss_time": round(self._cache_metrics.avg_miss_time, 1),
            }

            # Embedding stats
            embedding_stats = {
                "total_generated": self._embedding_metrics.total_generated,
                "avg_latency": round(self._embedding_metrics.avg_latency, 1),
                "batch_speedup": self._embedding_metrics.batch_speedup,
            }

            # Slow queries
            slow_queries = list(self._slow_queries)

        return {
            "endpoints": endpoints,
            "cache": cache_stats,
            "embeddings": embedding_stats,
            "slow_queries": slow_queries[-10:],  # Last 10 slow queries
        }

    def reset_stats(self):
        """Reset all statistics (useful for testing)."""
        with self._lock:
            self._endpoint_latencies.clear()
            self._cache_metrics = CacheMetrics()
            self._embedding_metrics = EmbeddingMetrics()
            self._slow_queries.clear()


# Global singleton instance
_metrics_service: Optional[PerformanceMetricsService] = None


def get_metrics_service() -> PerformanceMetricsService:
    """Get or create the global performance metrics service."""
    global _metrics_service
    if _metrics_service is None:
        _metrics_service = PerformanceMetricsService()
    return _metrics_service
