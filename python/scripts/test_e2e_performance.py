#!/usr/bin/env python3
"""
End-to-End Performance Validation Suite

Tests combined HNSW + Result Caching performance to validate that all
optimizations work together as expected.

Test Scenarios:
1. Cold start (cache MISS) - Validates HNSW performance
2. Warm cache (cache HIT) - Validates caching effectiveness
3. Mixed workload - Validates realistic usage patterns
4. Cache invalidation - Validates cache refresh behavior

Usage: python scripts/test_e2e_performance.py

Created: 2026-01-23
Phase: Option 1 - End-to-End Performance Validation
"""

import asyncio
import json
import statistics
import sys
import time
from pathlib import Path
from typing import Dict, List, Any
import aiohttp

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.server.services.search.result_cache import get_result_cache


class PerformanceValidator:
    """Validates end-to-end performance of search system."""

    def __init__(self):
        self.results = {
            "cold_start_rag": [],
            "warm_cache_rag": [],
            "cold_start_code": [],
            "warm_cache_code": [],
            "cold_start_content": [],
            "warm_cache_content": [],
            "mixed_workload": [],
            "cache_stats": {},
        }
        self.api_base = "http://localhost:8181/api"

    def record_latency(self, scenario: str, latency: float):
        """Record latency measurement."""
        if scenario not in self.results:
            self.results[scenario] = []
        self.results[scenario].append(latency)

    def get_percentile(self, data: List[float], percentile: float) -> float:
        """Calculate percentile."""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        index = int(len(sorted_data) * (percentile / 100))
        return sorted_data[min(index, len(sorted_data) - 1)]

    def calculate_speedup(self, cold: float, warm: float) -> float:
        """Calculate speedup factor."""
        if warm == 0:
            return 0.0
        return cold / warm

    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report."""
        report = {
            "test_date": time.strftime("%Y-%m-%d %H:%M:%S"),
            "scenarios": {},
            "cache_effectiveness": {},
            "recommendations": [],
        }

        # Analyze each scenario
        for scenario, latencies in self.results.items():
            if scenario == "cache_stats" or not latencies:
                continue

            report["scenarios"][scenario] = {
                "total_queries": len(latencies),
                "p50_ms": round(self.get_percentile(latencies, 50) * 1000, 2),
                "p95_ms": round(self.get_percentile(latencies, 95) * 1000, 2),
                "p99_ms": round(self.get_percentile(latencies, 99) * 1000, 2),
                "avg_ms": round(statistics.mean(latencies) * 1000, 2),
                "min_ms": round(min(latencies) * 1000, 2),
                "max_ms": round(max(latencies) * 1000, 2),
            }

        # Calculate cache effectiveness for each endpoint
        endpoints = ["rag", "code", "content"]
        for endpoint in endpoints:
            cold_key = f"cold_start_{endpoint}"
            warm_key = f"warm_cache_{endpoint}"

            if cold_key in report["scenarios"] and warm_key in report["scenarios"]:
                cold = report["scenarios"][cold_key]["p50_ms"]
                warm = report["scenarios"][warm_key]["p50_ms"]
                speedup = self.calculate_speedup(cold, warm)

                report["cache_effectiveness"][endpoint] = {
                    "cold_start_p50": cold,
                    "warm_cache_p50": warm,
                    "speedup": f"{speedup:.1f}x",
                    "latency_reduction": f"{((cold - warm) / cold * 100):.1f}%",
                }

        # Add cache stats
        if "cache_stats" in self.results:
            report["cache_stats"] = self.results["cache_stats"]

        # Generate recommendations
        report["recommendations"] = self.generate_recommendations(report)

        return report

    def generate_recommendations(self, report: Dict[str, Any]) -> List[str]:
        """Generate performance recommendations."""
        recommendations = []

        # Check cold start performance across endpoints
        for scenario, data in report["scenarios"].items():
            if "cold_start" in scenario:
                p95 = data["p95_ms"]
                endpoint = scenario.replace("cold_start_", "")
                if p95 > 1000:
                    recommendations.append(
                        f"⚠️  {endpoint.upper()} cold start P95 ({p95}ms) exceeds 1000ms. "
                        "Check HNSW index or embedding generation."
                    )
                elif p95 < 200:
                    recommendations.append(
                        f"✅ {endpoint.upper()} cold start P95 ({p95}ms) is excellent (<200ms)."
                    )

        # Check warm cache performance
        for scenario, data in report["scenarios"].items():
            if "warm_cache" in scenario:
                p95 = data["p95_ms"]
                endpoint = scenario.replace("warm_cache_", "")
                if p95 > 50:
                    recommendations.append(
                        f"⚠️  {endpoint.upper()} warm cache P95 ({p95}ms) exceeds 50ms. "
                        "Check Redis latency."
                    )
                elif p95 < 20:
                    recommendations.append(
                        f"✅ {endpoint.upper()} warm cache P95 ({p95}ms) is excellent (<20ms)."
                    )

        # Check cache effectiveness
        for endpoint, eff in report.get("cache_effectiveness", {}).items():
            speedup_str = eff["speedup"]
            speedup = float(speedup_str.replace("x", ""))
            if speedup < 10:
                recommendations.append(
                    f"⚠️  {endpoint.upper()} cache speedup ({speedup_str}) is lower than expected (target: >10x). "
                    "Check if cache is being populated properly."
                )
            elif speedup > 50:
                recommendations.append(
                    f"✅ {endpoint.upper()} cache speedup ({speedup_str}) exceeds expectations (>50x)."
                )

        # Check cache hit rate
        if "cache_stats" in report:
            hit_rate = report["cache_stats"].get("hit_rate", 0)
            if hit_rate < 30:
                recommendations.append(
                    f"ℹ️  Cache hit rate ({hit_rate:.1f}%) - This is expected after clearing cache. "
                    "Monitor in production for 30-50% hit rate."
                )
            elif hit_rate > 50:
                recommendations.append(
                    f"✅ Cache hit rate ({hit_rate:.1f}%) is excellent (>50%)."
                )

        return recommendations


async def test_rag_endpoint(validator: PerformanceValidator, session: aiohttp.ClientSession):
    """Test RAG query endpoint."""
    print("\n" + "=" * 70)
    print("TEST 1: RAG QUERY ENDPOINT (/api/rag/query)")
    print("=" * 70)

    # Clear cache for cold start
    print("\nClearing cache...")
    cache = await get_result_cache()
    await cache.invalidate_pattern(search_type="rag_query")
    print("✅ Cache cleared for rag_query\n")

    test_queries = [
        "vector search optimization",
        "authentication patterns",
        "database indexing",
        "API design best practices",
        "error handling strategies",
    ]

    # Cold start (cache MISS)
    print("Cold Start (Cache MISS):")
    for i, query in enumerate(test_queries, 1):
        start = time.time()

        async with session.post(
            f"{validator.api_base}/rag/query",
            json={"query": query, "match_count": 5, "return_mode": "pages"},
        ) as resp:
            if resp.status == 200:
                _ = await resp.json()
                elapsed = time.time() - start
                validator.record_latency("cold_start_rag", elapsed)
                print(f"  Query {i}: {elapsed * 1000:6.2f}ms | {query[:40]}")
            else:
                print(f"  ❌ Query {i} failed: {resp.status}")

    # Warm cache (cache HIT) - repeat same queries
    print("\nWarm Cache (Cache HIT):")
    for i, query in enumerate(test_queries, 1):
        start = time.time()

        async with session.post(
            f"{validator.api_base}/rag/query",
            json={"query": query, "match_count": 5, "return_mode": "pages"},
        ) as resp:
            if resp.status == 200:
                _ = await resp.json()
                elapsed = time.time() - start
                validator.record_latency("warm_cache_rag", elapsed)
                print(f"  Query {i}: {elapsed * 1000:6.2f}ms | {query[:40]}")
            else:
                print(f"  ❌ Query {i} failed: {resp.status}")


async def test_code_examples_endpoint(validator: PerformanceValidator, session: aiohttp.ClientSession):
    """Test code examples endpoint."""
    print("\n" + "=" * 70)
    print("TEST 2: CODE EXAMPLES ENDPOINT (/api/rag/code-examples)")
    print("=" * 70)

    # Clear cache for cold start
    print("\nClearing cache...")
    cache = await get_result_cache()
    await cache.invalidate_pattern(search_type="code_examples")
    print("✅ Cache cleared for code_examples\n")

    test_queries = [
        "React hooks",
        "FastAPI routes",
        "PostgreSQL queries",
        "async functions",
        "error handling",
    ]

    # Cold start
    print("Cold Start (Cache MISS):")
    for i, query in enumerate(test_queries, 1):
        start = time.time()

        async with session.post(
            f"{validator.api_base}/rag/code-examples",
            json={"query": query, "match_count": 5},
        ) as resp:
            if resp.status == 200:
                _ = await resp.json()
                elapsed = time.time() - start
                validator.record_latency("cold_start_code", elapsed)
                print(f"  Query {i}: {elapsed * 1000:6.2f}ms | {query[:40]}")
            else:
                print(f"  ❌ Query {i} failed: {resp.status}")

    # Warm cache
    print("\nWarm Cache (Cache HIT):")
    for i, query in enumerate(test_queries, 1):
        start = time.time()

        async with session.post(
            f"{validator.api_base}/rag/code-examples",
            json={"query": query, "match_count": 5},
        ) as resp:
            if resp.status == 200:
                _ = await resp.json()
                elapsed = time.time() - start
                validator.record_latency("warm_cache_code", elapsed)
                print(f"  Query {i}: {elapsed * 1000:6.2f}ms | {query[:40]}")
            else:
                print(f"  ❌ Query {i} failed: {resp.status}")


async def test_content_search_endpoint(validator: PerformanceValidator, session: aiohttp.ClientSession):
    """Test content search endpoint."""
    print("\n" + "=" * 70)
    print("TEST 3: CONTENT SEARCH ENDPOINT (/api/knowledge/search)")
    print("=" * 70)

    # Clear cache for cold start
    print("\nClearing cache...")
    cache = await get_result_cache()
    await cache.invalidate_pattern(search_type="content_search")
    print("✅ Cache cleared for content_search\n")

    test_queries = [
        "performance optimization",
        "security best practices",
        "testing strategies",
        "deployment process",
        "monitoring tools",
    ]

    # Cold start
    print("Cold Start (Cache MISS):")
    for i, query in enumerate(test_queries, 1):
        start = time.time()

        async with session.post(
            f"{validator.api_base}/knowledge/search",
            json={"query": query, "match_count": 5, "page": 1, "per_page": 10},
        ) as resp:
            if resp.status == 200:
                _ = await resp.json()
                elapsed = time.time() - start
                validator.record_latency("cold_start_content", elapsed)
                print(f"  Query {i}: {elapsed * 1000:6.2f}ms | {query[:40]}")
            else:
                print(f"  ❌ Query {i} failed: {resp.status}")

    # Warm cache
    print("\nWarm Cache (Cache HIT):")
    for i, query in enumerate(test_queries, 1):
        start = time.time()

        async with session.post(
            f"{validator.api_base}/knowledge/search",
            json={"query": query, "match_count": 5, "page": 1, "per_page": 10},
        ) as resp:
            if resp.status == 200:
                _ = await resp.json()
                elapsed = time.time() - start
                validator.record_latency("warm_cache_content", elapsed)
                print(f"  Query {i}: {elapsed * 1000:6.2f}ms | {query[:40]}")
            else:
                print(f"  ❌ Query {i} failed: {resp.status}")


async def get_cache_statistics():
    """Get comprehensive cache statistics."""
    print("\n" + "=" * 70)
    print("CACHE STATISTICS")
    print("=" * 70)

    cache = await get_result_cache()
    stats = await cache.get_stats()

    print("\nResult Cache:")
    print(f"  Enabled: {stats.get('enabled')}")
    print(f"  Cached Results: {stats.get('cached_results', 0)}")
    print(f"  TTL: {stats.get('ttl_hours')}h")
    print(f"  Keyspace Hits: {stats.get('keyspace_hits', 0)}")
    print(f"  Keyspace Misses: {stats.get('keyspace_misses', 0)}")
    print(f"  Hit Rate: {stats.get('hit_rate', 0):.1f}%")

    return stats


def print_performance_report(report: Dict[str, Any]):
    """Print comprehensive performance report."""
    print("\n" + "=" * 70)
    print("PERFORMANCE VALIDATION REPORT")
    print("=" * 70)
    print(f"\nTest Date: {report['test_date']}")

    # Print scenario results
    print("\n" + "-" * 70)
    print("SCENARIO RESULTS")
    print("-" * 70)

    for scenario, data in sorted(report["scenarios"].items()):
        scenario_name = scenario.replace("_", " ").title()
        print(f"\n{scenario_name}:")
        print(f"  Total Queries: {data['total_queries']}")
        print(f"  P50: {data['p50_ms']}ms")
        print(f"  P95: {data['p95_ms']}ms")
        print(f"  P99: {data['p99_ms']}ms")
        print(f"  Avg: {data['avg_ms']}ms")
        print(f"  Min: {data['min_ms']}ms")
        print(f"  Max: {data['max_ms']}ms")

    # Print cache effectiveness
    if "cache_effectiveness" in report:
        print("\n" + "-" * 70)
        print("CACHE EFFECTIVENESS BY ENDPOINT")
        print("-" * 70)
        for endpoint, eff in sorted(report["cache_effectiveness"].items()):
            print(f"\n{endpoint.upper()}:")
            print(f"  Cold Start P50: {eff['cold_start_p50']}ms")
            print(f"  Warm Cache P50: {eff['warm_cache_p50']}ms")
            print(f"  Speedup: {eff['speedup']}")
            print(f"  Latency Reduction: {eff['latency_reduction']}")

    # Print cache stats
    if "cache_stats" in report:
        print("\n" + "-" * 70)
        print("CACHE STATISTICS")
        print("-" * 70)
        stats = report["cache_stats"]
        print(f"\n  Cached Results: {stats.get('cached_results', 0)}")
        print(f"  Hit Rate: {stats.get('hit_rate', 0):.1f}%")
        print(f"  TTL: {stats.get('ttl_hours')}h")

    # Print recommendations
    print("\n" + "-" * 70)
    print("RECOMMENDATIONS")
    print("-" * 70)
    if report["recommendations"]:
        for rec in report["recommendations"]:
            print(f"\n  {rec}")
    else:
        print("\n  ✅ All performance metrics meet targets!")

    print("\n" + "=" * 70)


async def main():
    """Run all performance validation tests."""
    print("\n" + "=" * 70)
    print("🚀 END-TO-END PERFORMANCE VALIDATION SUITE")
    print("=" * 70)
    print("\nValidating combined HNSW + Result Caching performance\n")

    try:
        validator = PerformanceValidator()

        async with aiohttp.ClientSession() as session:
            # Test all 3 endpoints
            await test_rag_endpoint(validator, session)
            await test_code_examples_endpoint(validator, session)
            await test_content_search_endpoint(validator, session)

        # Get cache statistics
        cache_stats = await get_cache_statistics()
        validator.results["cache_stats"] = cache_stats

        # Generate and print report
        report = validator.generate_report()
        print_performance_report(report)

        print("\n✅ All performance validation tests completed successfully!")
        sys.exit(0)

    except Exception as e:
        print(f"\n❌ Error running performance tests: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
