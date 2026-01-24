#!/usr/bin/env python3
"""
Simplified Cold Start Performance Profiler

Profiles RAG query performance using API-level timing and database analysis.
Compares E2E test queries with Phase 4.2 baseline queries.

Usage: python scripts/profile_cold_start_simple.py

Created: 2026-01-23
Phase: Option A - Cold Start Performance Investigation
"""

import asyncio
import json
import subprocess
import sys
import time
from typing import Dict, List
import aiohttp


class SimpleProfiler:
    """API-level performance profiler."""

    def __init__(self):
        self.api_base = "http://localhost:8181/api"

    async def profile_query(self, query: str, match_count: int = 10):
        """Profile a single query via API."""
        print(f"\n{'='*70}")
        print(f"Query: '{query}'")
        print(f"{'='*70}")

        start = time.time()

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_base}/rag/query",
                    json={"query": query, "match_count": match_count, "return_mode": "pages"},
                    timeout=aiohttp.ClientTimeout(total=300)
                ) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        elapsed = (time.time() - start) * 1000

                        print(f"✅ Total latency: {elapsed:.2f}ms ({elapsed/1000:.2f}s)")
                        print(f"   Results: {result.get('count', 0)} items")
                        print(f"   Success: {result.get('success', False)}")

                        return {
                            "query": query,
                            "latency_ms": elapsed,
                            "count": result.get("count", 0),
                            "success": True
                        }
                    else:
                        elapsed = (time.time() - start) * 1000
                        print(f"❌ API error: {resp.status} ({elapsed:.2f}ms)")
                        return {"query": query, "latency_ms": elapsed, "success": False}

        except asyncio.TimeoutError:
            elapsed = (time.time() - start) * 1000
            print(f"⚠️  Timeout after {elapsed:.2f}ms ({elapsed/1000:.2f}s)")
            return {"query": query, "latency_ms": elapsed, "success": False, "timeout": True}
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            print(f"❌ Error: {e} ({elapsed:.2f}ms)")
            return {"query": query, "latency_ms": elapsed, "success": False, "error": str(e)}

    def check_index_stats(self):
        """Check HNSW index statistics via psql."""
        print(f"\n{'='*70}")
        print("HNSW INDEX STATISTICS")
        print(f"{'='*70}\n")

        try:
            # Check index usage
            result = subprocess.run(
                [
                    "docker", "exec", "supabase-ai-db",
                    "psql", "-U", "postgres", "-d", "postgres",
                    "-c", """
                        SELECT
                            schemaname,
                            tablename,
                            indexname,
                            pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
                            idx_scan as scans,
                            idx_tup_read as tuples_read
                        FROM pg_stat_user_indexes
                        WHERE indexname LIKE '%embedding%'
                        ORDER BY pg_relation_size(indexrelid) DESC;
                    """
                ],
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                print(result.stdout)
            else:
                print(f"❌ Error: {result.stderr}")

            # Check table stats
            print("\nTable Statistics:")
            result = subprocess.run(
                [
                    "docker", "exec", "supabase-ai-db",
                    "psql", "-U", "postgres", "-d", "postgres",
                    "-c", """
                        SELECT
                            COUNT(*) as total_rows,
                            COUNT(*) FILTER (WHERE embedding IS NOT NULL) as rows_with_embeddings,
                            pg_size_pretty(pg_total_relation_size('archon_crawled_pages')) as total_size
                        FROM archon_crawled_pages;
                    """
                ],
                capture_output=True,
                text=True
            )

            if result.returncode == 0:
                print(result.stdout)
            else:
                print(f"❌ Error: {result.stderr}")

        except Exception as e:
            print(f"❌ Error checking index stats: {e}")

    async def run_comparison(self):
        """Compare E2E test queries with baseline queries."""
        print("\n" + "="*70)
        print("🔍 COLD START PERFORMANCE INVESTIGATION")
        print("="*70)
        print("\nComparing E2E test queries vs Phase 4.2 baseline queries\n")

        # Check index stats first
        self.check_index_stats()

        # E2E test queries (the slow ones from the test)
        print(f"\n{'='*70}")
        print("TESTING E2E QUERIES (Expected: 12-15 seconds)")
        print(f"{'='*70}")

        e2e_queries = [
            "vector search optimization",
            "authentication patterns",
            "database indexing"
        ]

        e2e_results = []
        for query in e2e_queries:
            result = await self.profile_query(query)
            if result:
                e2e_results.append(result)
            await asyncio.sleep(2)  # Pause between queries

        # Phase 4.2 baseline queries (should be fast: 82-89ms)
        print(f"\n{'='*70}")
        print("TESTING PHASE 4.2 BASELINE QUERIES (Expected: 82-89ms)")
        print(f"{'='*70}")

        baseline_queries = [
            "authentication OAuth JWT",
            "vector search",
            "database performance"
        ]

        baseline_results = []
        for query in baseline_queries:
            result = await self.profile_query(query)
            if result:
                baseline_results.append(result)
            await asyncio.sleep(2)

        # Generate comparison report
        print(f"\n{'='*70}")
        print("PERFORMANCE COMPARISON SUMMARY")
        print(f"{'='*70}\n")

        if e2e_results:
            e2e_latencies = [r["latency_ms"] for r in e2e_results if r.get("success")]
            if e2e_latencies:
                e2e_avg = sum(e2e_latencies) / len(e2e_latencies)
                e2e_min = min(e2e_latencies)
                e2e_max = max(e2e_latencies)

                print(f"E2E Test Queries (n={len(e2e_latencies)}):")
                print(f"  Average: {e2e_avg:.2f}ms ({e2e_avg/1000:.2f}s)")
                print(f"  Min: {e2e_min:.2f}ms ({e2e_min/1000:.2f}s)")
                print(f"  Max: {e2e_max:.2f}ms ({e2e_max/1000:.2f}s)")
                print(f"  Queries:")
                for r in e2e_results:
                    if r.get("success"):
                        print(f"    - {r['query'][:40]}: {r['latency_ms']:.2f}ms")

        if baseline_results:
            baseline_latencies = [r["latency_ms"] for r in baseline_results if r.get("success")]
            if baseline_latencies:
                baseline_avg = sum(baseline_latencies) / len(baseline_latencies)
                baseline_min = min(baseline_latencies)
                baseline_max = max(baseline_latencies)

                print(f"\nPhase 4.2 Baseline Queries (n={len(baseline_latencies)}):")
                print(f"  Average: {baseline_avg:.2f}ms ({baseline_avg/1000:.2f}s)")
                print(f"  Min: {baseline_min:.2f}ms ({baseline_min/1000:.2f}s)")
                print(f"  Max: {baseline_max:.2f}ms ({baseline_max/1000:.2f}s)")
                print(f"  Queries:")
                for r in baseline_results:
                    if r.get("success"):
                        print(f"    - {r['query'][:40]}: {r['latency_ms']:.2f}ms")

                if e2e_latencies:
                    print(f"\nDifference:")
                    print(f"  Average: {e2e_avg - baseline_avg:+.2f}ms ({(e2e_avg/baseline_avg - 1)*100:+.1f}%)")
                    print(f"  Slowdown: {e2e_avg/baseline_avg:.1f}x")

        # Recommendations
        print(f"\n{'='*70}")
        print("ANALYSIS & RECOMMENDATIONS")
        print(f"{'='*70}\n")

        if e2e_latencies and baseline_latencies:
            ratio = e2e_avg / baseline_avg

            if ratio > 100:
                print(f"⚠️  CRITICAL: E2E queries are {ratio:.0f}x slower than baseline!")
                print("\nPossible causes:")
                print("  1. Embedding generation is much slower for complex queries")
                print("  2. Query complexity affects search time")
                print("  3. HNSW index not warmed up properly")
                print("  4. External API latency (if using OpenAI)")

                print("\nRecommended actions:")
                print("  ✅ Enable embedding cache and verify it's working")
                print("  ✅ Use local embedding model instead of API")
                print("  ✅ Pre-warm HNSW indexes on startup")
                print("  ✅ Simplify complex queries or use query optimization")

            elif ratio > 10:
                print(f"⚠️  WARNING: E2E queries are {ratio:.1f}x slower than baseline")
                print("\nLikely cause: Embedding generation overhead")
                print("\nRecommended action: Enable embedding cache")

            elif ratio > 2:
                print(f"ℹ️  E2E queries are {ratio:.1f}x slower than baseline")
                print("\nThis is within expected range for more complex queries")

            else:
                print(f"✅ Performance is similar ({ratio:.1f}x difference)")

        print("\n✅ Profiling complete!")


async def main():
    """Run profiling."""
    profiler = SimpleProfiler()

    try:
        await profiler.run_comparison()
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
