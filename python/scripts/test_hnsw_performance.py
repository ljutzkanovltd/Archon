#!/usr/bin/env python3
"""
Standalone HNSW Performance Test

Measures vector search performance with HNSW index using existing embeddings.
Runs directly without pytest to avoid test mocking.

Usage: python scripts/test_hnsw_performance.py

Created: 2026-01-23
Phase: 4.2 - Performance Testing and Validation
"""

import asyncio
import os
import sys
import time
from typing import List, Dict, Any
import statistics
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from src.server.utils import get_supabase_client

# Load environment variables
env_path = Path(__file__).parent.parent / ".env"
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


def test_hnsw_vector_search():
    """Test HNSW vector search performance."""
    print("\n" + "=" * 60)
    print("HNSW VECTOR SEARCH PERFORMANCE TEST")
    print("=" * 60)

    # Get Supabase client
    supabase_client = get_supabase_client()
    metrics = PerformanceMetrics()

    # Get 20 sample embeddings
    print("\nFetching sample embeddings from database...")
    sample_response = supabase_client.table("archon_crawled_pages") \
        .select("embedding_1536") \
        .limit(20) \
        .execute()

    if not sample_response.data:
        print("❌ No embeddings found in database")
        return False

    print(f"✅ Retrieved {len(sample_response.data)} sample embeddings")

    # Test each embedding
    for i, row in enumerate(sample_response.data):
        query_embedding = row["embedding_1536"]

        # Measure vector search
        start = time.time()
        results = supabase_client.rpc(
            "match_archon_crawled_pages",
            {
                "query_embedding": query_embedding,
                "match_count": 10,
                "filter": {},
                "source_filter": None,
            },
        ).execute()
        elapsed = time.time() - start

        metrics.record_query(elapsed)

        if i == 0:
            print(f"First query returned {len(results.data)} results in {elapsed*1000:.2f}ms")

    # Generate summary
    summary = metrics.summary()

    # Print results
    print(f"\nTotal queries: {summary['total_queries']}")
    print(f"\nLatency (database query only):")
    print(f"  P50: {summary['latency']['p50_ms']}ms")
    print(f"  P95: {summary['latency']['p95_ms']}ms")
    print(f"  P99: {summary['latency']['p99_ms']}ms")
    print(f"  Avg: {summary['latency']['avg_ms']}ms")
    print(f"  Min: {summary['latency']['min_ms']}ms")
    print(f"  Max: {summary['latency']['max_ms']}ms")

    # Check performance targets
    print(f"\nPerformance Assessment:")
    if summary['latency']['p50_ms'] < 100:
        print(f"  ✅ P50 latency EXCELLENT ({summary['latency']['p50_ms']}ms < 100ms)")
    elif summary['latency']['p50_ms'] < 500:
        print(f"  ✅ P50 latency GOOD ({summary['latency']['p50_ms']}ms < 500ms)")
    else:
        print(f"  ⚠️  P50 latency SLOW ({summary['latency']['p50_ms']}ms)")

    if summary['latency']['p95_ms'] < 200:
        print(f"  ✅ P95 latency EXCELLENT ({summary['latency']['p95_ms']}ms < 200ms)")
    elif summary['latency']['p95_ms'] < 1000:
        print(f"  ✅ P95 latency GOOD ({summary['latency']['p95_ms']}ms < 1000ms)")
    else:
        print(f"  ⚠️  P95 latency SLOW ({summary['latency']['p95_ms']}ms)")

    print("=" * 60)
    return True


def test_result_scaling():
    """Test how performance scales with result count."""
    print("\n" + "=" * 60)
    print("RESULT SCALING TEST")
    print("=" * 60)

    supabase_client = get_supabase_client()

    # Get one sample embedding
    sample_response = supabase_client.table("archon_crawled_pages") \
        .select("embedding_1536") \
        .limit(1) \
        .execute()

    if not sample_response.data:
        print("❌ No embeddings found")
        return False

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
                "source_filter": None,
            },
        ).execute()
        elapsed = (time.time() - start) * 1000

        results[match_count] = {
            "latency_ms": round(elapsed, 2),
            "results_returned": len(search_results.data),
        }

    print()
    for count, data in results.items():
        print(f"match_count={count:2d}: {data['latency_ms']:6.2f}ms ({data['results_returned']} results)")

    print("=" * 60)
    return True


def main():
    """Run all performance tests."""
    print("\n🚀 Starting HNSW Performance Tests")
    print(f"Database: {os.getenv('SUPABASE_URL', 'NOT SET')}")

    success = True

    try:
        # Test 1: Vector search performance
        if not test_hnsw_vector_search():
            success = False

        # Test 2: Result scaling
        if not test_result_scaling():
            success = False

        if success:
            print("\n✅ All performance tests completed successfully!")
        else:
            print("\n⚠️  Some performance tests failed")

    except Exception as e:
        print(f"\n❌ Error running tests: {e}")
        import traceback
        traceback.print_exc()
        success = False

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
