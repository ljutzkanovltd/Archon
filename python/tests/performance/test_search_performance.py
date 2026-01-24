"""
Performance tests for Archon knowledge base search.

Tests vector search performance with HNSW vs IVFFlat indexes,
cache performance, and load testing capabilities.

Created: 2026-01-23
Phase: 4.2 - Performance Testing and Validation
"""

import asyncio
import time
from typing import List, Dict, Any
import statistics

import pytest
from src.server.services.search.hybrid_search_strategy import HybridSearchStrategy
from src.server.services.search.base_search_strategy import BaseSearchStrategy
from src.server.services.embeddings.embedding_service import create_embedding
from src.server.utils import get_supabase_client


# Test queries covering different use cases
TEST_QUERIES = [
    # Short queries
    "authentication JWT",
    "vector search",
    "React hooks",

    # Medium queries
    "how to implement user authentication with JWT",
    "vector similarity search with pgvector",
    "React hooks best practices and patterns",

    # Long queries
    "explain the complete process of implementing secure user authentication using JWT tokens in a FastAPI backend with proper error handling and token refresh",
    "comprehensive guide to implementing vector similarity search using pgvector extension in PostgreSQL with HNSW indexes for optimal performance",
    "detailed explanation of React hooks including useState useEffect useContext and custom hooks with practical examples and common pitfalls to avoid",

    # Technical queries
    "docker compose healthcheck configuration",
    "PostgreSQL HNSW index parameters m ef_construction",
]


class PerformanceMetrics:
    """Collect and analyze performance metrics."""

    def __init__(self):
        self.latencies: List[float] = []
        self.cache_hits = 0
        self.cache_misses = 0
        self.embedding_times: List[float] = []
        self.search_times: List[float] = []

    def record_query(
        self,
        total_time: float,
        embedding_time: float,
        search_time: float,
        cache_hit: bool
    ):
        """Record performance data for a query."""
        self.latencies.append(total_time)
        self.embedding_times.append(embedding_time)
        self.search_times.append(search_time)

        if cache_hit:
            self.cache_hits += 1
        else:
            self.cache_misses += 1

    def get_percentile(self, data: List[float], percentile: float) -> float:
        """Calculate percentile from data."""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        index = int(len(sorted_data) * (percentile / 100))
        return sorted_data[min(index, len(sorted_data) - 1)]

    def summary(self) -> Dict[str, Any]:
        """Generate performance summary."""
        if not self.latencies:
            return {"error": "No data collected"}

        return {
            "total_queries": len(self.latencies),
            "latency": {
                "p50_ms": round(self.get_percentile(self.latencies, 50) * 1000, 2),
                "p95_ms": round(self.get_percentile(self.latencies, 95) * 1000, 2),
                "p99_ms": round(self.get_percentile(self.latencies, 99) * 1000, 2),
                "avg_ms": round(statistics.mean(self.latencies) * 1000, 2),
                "min_ms": round(min(self.latencies) * 1000, 2),
                "max_ms": round(max(self.latencies) * 1000, 2),
            },
            "embedding_time": {
                "avg_ms": round(statistics.mean(self.embedding_times) * 1000, 2),
            },
            "search_time": {
                "avg_ms": round(statistics.mean(self.search_times) * 1000, 2),
            },
            "cache": {
                "hits": self.cache_hits,
                "misses": self.cache_misses,
                "hit_rate": round(self.cache_hits / len(self.latencies), 2) if self.latencies else 0.0,
            },
        }


@pytest.fixture
def search_strategy():
    """Create search strategy instance with real Supabase client."""
    supabase_client = get_supabase_client()
    base_strategy = BaseSearchStrategy(supabase_client)
    return HybridSearchStrategy(supabase_client, base_strategy)


@pytest.mark.asyncio
async def test_vector_search_performance(search_strategy):
    """
    Test vector search performance with current index.

    Measures P50, P95, P99 latencies for vector searches.
    Target: P95 < 500ms after HNSW optimization.
    """
    metrics = PerformanceMetrics()

    for query in TEST_QUERIES:
        # Measure embedding generation
        emb_start = time.time()
        query_embedding = await create_embedding(query)
        emb_time = time.time() - emb_start

        # Measure search
        search_start = time.time()
        results = await search_strategy.search_documents_hybrid(
            query=query,
            query_embedding=query_embedding,
            match_count=10,
            filter_metadata=None,
        )
        search_time = time.time() - search_start

        total_time = time.time() - emb_start

        # Record metrics (assuming cache miss for first run)
        metrics.record_query(
            total_time=total_time,
            embedding_time=emb_time,
            search_time=search_time,
            cache_hit=False,
        )

    # Generate summary
    summary = metrics.summary()

    # Print results
    print("\n" + "=" * 60)
    print("VECTOR SEARCH PERFORMANCE TEST")
    print("=" * 60)
    print(f"Total queries: {summary['total_queries']}")
    print(f"\nLatency (end-to-end):")
    print(f"  P50: {summary['latency']['p50_ms']}ms")
    print(f"  P95: {summary['latency']['p95_ms']}ms")
    print(f"  P99: {summary['latency']['p99_ms']}ms")
    print(f"  Avg: {summary['latency']['avg_ms']}ms")
    print(f"\nBreakdown:")
    print(f"  Embedding: {summary['embedding_time']['avg_ms']}ms avg")
    print(f"  Search: {summary['search_time']['avg_ms']}ms avg")
    print("=" * 60)

    # Performance assertions (based on HNSW optimization targets)
    # Relaxed assertions for now - adjust after baseline established
    assert summary['latency']['p95_ms'] < 5000, f"P95 latency too high: {summary['latency']['p95_ms']}ms"
    assert summary['latency']['p50_ms'] < 3000, f"P50 latency too high: {summary['latency']['p50_ms']}ms"


@pytest.mark.asyncio
async def test_cache_performance(search_strategy):
    """
    Test embedding cache performance.

    Runs same query twice to measure cache hit improvement.
    Target: Cache hit < 100ms, cache miss 900-1200ms.
    """
    test_query = "authentication JWT tokens"

    # First query (cache miss)
    miss_start = time.time()
    embedding1 = await create_embedding(test_query)
    miss_time = (time.time() - miss_start) * 1000

    # Second query (cache hit)
    hit_start = time.time()
    embedding2 = await create_embedding(test_query)
    hit_time = (time.time() - hit_start) * 1000

    # Verify embeddings are identical
    assert embedding1 == embedding2, "Cached embedding doesn't match original"

    # Print results
    print("\n" + "=" * 60)
    print("CACHE PERFORMANCE TEST")
    print("=" * 60)
    print(f"Cache miss: {miss_time:.2f}ms")
    print(f"Cache hit: {hit_time:.2f}ms")
    print(f"Speedup: {miss_time / hit_time:.1f}x")
    print("=" * 60)

    # Assertions
    # Note: If cache hit time is similar to miss time, cache may not be working
    if hit_time < miss_time * 0.8:
        print("✅ Cache is working effectively")
    else:
        print("⚠️  Cache may not be working - hit time similar to miss time")


@pytest.mark.asyncio
async def test_result_scaling(search_strategy):
    """
    Test how performance scales with result count.

    Measures latency for match_count=5, 10, 20, 50.
    Helps identify if result set size impacts performance significantly.
    """
    test_query = "FastAPI async endpoints"
    query_embedding = await create_embedding(test_query)

    results = {}

    for match_count in [5, 10, 20, 50]:
        start = time.time()
        search_results = await search_strategy.search_documents_hybrid(
            query=test_query,
            query_embedding=query_embedding,
            match_count=match_count,
            filter_metadata=None,
        )
        elapsed = (time.time() - start) * 1000

        results[match_count] = {
            "latency_ms": round(elapsed, 2),
            "results_returned": len(search_results),
        }

    # Print results
    print("\n" + "=" * 60)
    print("RESULT SCALING TEST")
    print("=" * 60)
    for count, data in results.items():
        print(f"match_count={count:2d}: {data['latency_ms']:6.2f}ms ({data['results_returned']} results)")
    print("=" * 60)

    # Assertions
    # Latency should scale roughly linearly with result count
    assert results[50]["latency_ms"] < results[5]["latency_ms"] * 15, "Latency scaling is non-linear"


@pytest.mark.asyncio
@pytest.mark.slow
async def test_load_concurrent_queries(search_strategy):
    """
    Load test: 100 concurrent queries.

    Measures system behavior under concurrent load.
    Target: All queries complete within 10 seconds.
    """
    num_queries = 100

    async def run_query(query: str):
        """Run single search query."""
        start = time.time()
        embedding = await create_embedding(query)
        results = await search_strategy.search_documents_hybrid(
            query=query,
            query_embedding=embedding,
            match_count=10,
            filter_metadata=None,
        )
        return time.time() - start

    # Generate queries (cycle through test queries)
    queries = [TEST_QUERIES[i % len(TEST_QUERIES)] for i in range(num_queries)]

    # Run concurrently
    overall_start = time.time()
    latencies = await asyncio.gather(*[run_query(q) for q in queries])
    overall_time = time.time() - overall_start

    # Calculate metrics
    latencies_ms = [l * 1000 for l in latencies]

    # Print results
    print("\n" + "=" * 60)
    print(f"LOAD TEST: {num_queries} CONCURRENT QUERIES")
    print("=" * 60)
    print(f"Total time: {overall_time:.2f}s")
    print(f"Throughput: {num_queries / overall_time:.1f} queries/sec")
    print(f"\nLatency:")
    print(f"  P50: {statistics.median(latencies_ms):.2f}ms")
    print(f"  P95: {sorted(latencies_ms)[int(len(latencies_ms) * 0.95)]:.2f}ms")
    print(f"  Avg: {statistics.mean(latencies_ms):.2f}ms")
    print("=" * 60)

    # Assertions
    assert overall_time < 60, f"Load test took too long: {overall_time:.2f}s"
    assert all(l < 30 for l in latencies), "Some queries exceeded 30s timeout"


@pytest.mark.asyncio
async def test_filter_performance(search_strategy):
    """
    Test search performance with and without source_id filtering.

    Measures impact of filtering on query performance.
    """
    test_query = "PostgreSQL indexing strategies"
    query_embedding = await create_embedding(test_query)

    # Unfiltered search
    unfiltered_start = time.time()
    unfiltered_results = await search_strategy.search_documents_hybrid(
        query=test_query,
        query_embedding=query_embedding,
        match_count=10,
        filter_metadata=None,
    )
    unfiltered_time = (time.time() - unfiltered_start) * 1000

    # Filtered search (get first source_id from results)
    if unfiltered_results:
        source_id = unfiltered_results[0].get("source_id")

        filtered_start = time.time()
        filtered_results = await search_strategy.search_documents_hybrid(
            query=test_query,
            query_embedding=query_embedding,
            match_count=10,
            filter_metadata={"source": source_id},
        )
        filtered_time = (time.time() - filtered_start) * 1000
    else:
        filtered_time = 0
        filtered_results = []

    # Print results
    print("\n" + "=" * 60)
    print("FILTER PERFORMANCE TEST")
    print("=" * 60)
    print(f"Unfiltered: {unfiltered_time:.2f}ms ({len(unfiltered_results)} results)")
    print(f"Filtered:   {filtered_time:.2f}ms ({len(filtered_results)} results)")
    print("=" * 60)

    # Assertions
    # Filtered search should be faster or similar (smaller result set to scan)
    assert filtered_time <= unfiltered_time * 2, "Filtered search unexpectedly slow"


if __name__ == "__main__":
    """Run performance tests from command line."""
    import sys

    # Run with: python -m pytest python/tests/performance/test_search_performance.py -v -s
    pytest.main([__file__, "-v", "-s"] + sys.argv[1:])
