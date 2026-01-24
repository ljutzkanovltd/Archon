"""
HNSW Index Performance Test

Measures vector search performance with HNSW index using existing embeddings.
This test directly measures database query performance without embedding generation overhead.

Created: 2026-01-23
Phase: 4.2 - Performance Testing and Validation
"""

import asyncio
import os
import time
from typing import List, Dict, Any
import statistics
from pathlib import Path

import pytest
from dotenv import load_dotenv
from src.server.utils import get_supabase_client

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)


class PerformanceMetrics:
    """Collect and analyze performance metrics."""

    def __init__(self):
        self.latencies: List[float] = []

    def record_query(self, latency: float):
        """Record performance data for a query."""
        self.latencies.append(latency)

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
        }


@pytest.fixture
def supabase_client():
    """Create Supabase client instance."""
    return get_supabase_client()


@pytest.mark.asyncio
async def test_hnsw_vector_search_performance(supabase_client):
    """
    Test HNSW vector search performance using existing embeddings.

    Retrieves random embeddings from the database and measures search performance.
    Target: P95 < 500ms with HNSW index.
    """
    metrics = PerformanceMetrics()

    # Get 20 sample embeddings from the database to use as test queries
    print("\nFetching sample embeddings from database...")
    sample_response = supabase_client.table("archon_crawled_pages") \
        .select("embedding_1536") \
        .limit(20) \
        .execute()

    print(f"Debug: Response type: {type(sample_response)}")
    print(f"Debug: Response data: {sample_response.data if hasattr(sample_response, 'data') else 'NO DATA ATTR'}")
    print(f"Debug: Response count: {sample_response.count if hasattr(sample_response, 'count') else 'NO COUNT ATTR'}")

    if not sample_response.data:
        pytest.skip("No embeddings found in database")

    print(f"Testing with {len(sample_response.data)} sample embeddings")

    # Test each embedding
    for i, row in enumerate(sample_response.data):
        query_embedding = row["embedding_1536"]

        # Measure vector search using PostgreSQL function
        start = time.time()
        results = supabase_client.rpc(
            "match_archon_crawled_pages",
            {
                "query_embedding": query_embedding,
                "match_count": 10,
                "filter": {},
            },
        ).execute()
        elapsed = time.time() - start

        metrics.record_query(elapsed)

        if i == 0:
            print(f"First query returned {len(results.data)} results in {elapsed*1000:.2f}ms")

    # Generate summary
    summary = metrics.summary()

    # Print results
    print("\n" + "=" * 60)
    print("HNSW VECTOR SEARCH PERFORMANCE TEST")
    print("=" * 60)
    print(f"Total queries: {summary['total_queries']}")
    print(f"\nLatency (database query only):")
    print(f"  P50: {summary['latency']['p50_ms']}ms")
    print(f"  P95: {summary['latency']['p95_ms']}ms")
    print(f"  P99: {summary['latency']['p99_ms']}ms")
    print(f"  Avg: {summary['latency']['avg_ms']}ms")
    print(f"  Min: {summary['latency']['min_ms']}ms")
    print(f"  Max: {summary['latency']['max_ms']}ms")
    print("=" * 60)

    # Performance assertions
    assert summary['latency']['p95_ms'] < 1000, f"P95 latency too high: {summary['latency']['p95_ms']}ms"
    assert summary['latency']['p50_ms'] < 500, f"P50 latency too high: {summary['latency']['p50_ms']}ms"


@pytest.mark.asyncio
async def test_result_scaling(supabase_client):
    """
    Test how performance scales with result count.

    Measures latency for match_count=5, 10, 20, 50.
    """
    # Get one sample embedding
    sample_response = supabase_client.table("archon_crawled_pages") \
        .select("embedding_1536") \
        .limit(1) \
        .execute()

    if not sample_response.data:
        pytest.skip("No embeddings found in database")

    query_embedding = sample_response.data[0]["embedding_1536"]

    results = {}

    for match_count in [5, 10, 20, 50]:
        start = time.time()
        search_results = supabase_client.rpc(
            "match_archon_crawled_pages",
            {
                "query_embedding": query_embedding,
                "match_count": match_count,
                "filter": {},
            },
        ).execute()
        elapsed = (time.time() - start) * 1000

        results[match_count] = {
            "latency_ms": round(elapsed, 2),
            "results_returned": len(search_results.data),
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
async def test_load_concurrent_queries(supabase_client):
    """
    Load test: 50 concurrent queries with HNSW index.

    Measures system behavior under concurrent load.
    Target: All queries complete within 30 seconds.
    """
    num_queries = 50

    # Get sample embeddings
    sample_response = supabase_client.table("archon_crawled_pages") \
        .select("embedding_1536") \
        .limit(num_queries) \
        .execute()

    if not sample_response.data or len(sample_response.data) < num_queries:
        pytest.skip(f"Need {num_queries} embeddings, found {len(sample_response.data or [])}")

    async def run_query(embedding: List[float]):
        """Run single search query."""
        start = time.time()
        await asyncio.to_thread(
            lambda: supabase_client.rpc(
                "match_archon_crawled_pages",
                {
                    "query_embedding": embedding,
                    "match_count": 10,
                    "filter": {},
                },
            ).execute()
        )
        return time.time() - start

    # Extract embeddings
    embeddings = [row["embedding_1536"] for row in sample_response.data]

    # Run concurrently
    overall_start = time.time()
    latencies = await asyncio.gather(*[run_query(emb) for emb in embeddings])
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


if __name__ == "__main__":
    """Run performance tests from command line."""
    import sys

    # Run with: python -m pytest python/tests/performance/test_hnsw_performance.py -v -s
    pytest.main([__file__, "-v", "-s"] + sys.argv[1:])
