#!/usr/bin/env python3
"""
Cold Start Performance Profiler

Profiles each component of RAG query execution to identify bottlenecks.

This script measures:
1. Embedding generation time
2. Database query execution time
3. Result processing time
4. Total end-to-end time

Compares against Phase 4.2 baseline (82ms P50, 89ms P95)

Usage: python scripts/profile_cold_start_performance.py

Created: 2026-01-23
Phase: Option A - Cold Start Performance Investigation
"""

import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Dict, List, Any
import aiohttp

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.server.services.search.result_cache import get_result_cache
from src.server.services.embeddings.embedding_service import create_embedding
from src.server.database import get_async_session
from sqlalchemy import text


class ColdStartProfiler:
    """Profiles cold start performance by component."""

    def __init__(self):
        self.results = []
        self.api_base = "http://localhost:8181/api"

    async def profile_component_timing(self, query: str, match_count: int = 10):
        """Profile timing for each component of query execution."""
        print(f"\n{'='*70}")
        print(f"Profiling Query: '{query}'")
        print(f"{'='*70}\n")

        timings = {
            "query": query,
            "total": 0,
            "embedding_generation": 0,
            "database_search": 0,
            "result_processing": 0,
            "cache_check": 0,
            "cache_write": 0,
        }

        # Total end-to-end timing via API
        print("1. Measuring total API latency...")
        start_total = time.time()

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_base}/rag/query",
                    json={"query": query, "match_count": match_count, "return_mode": "pages"},
                    timeout=aiohttp.ClientTimeout(total=300)
                ) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        timings["total"] = (time.time() - start_total) * 1000  # Convert to ms
                        print(f"   ✅ Total API latency: {timings['total']:.2f}ms")
                        print(f"   Results returned: {result.get('count', 0)} items")
                    else:
                        print(f"   ❌ API error: {resp.status}")
                        return None
        except asyncio.TimeoutError:
            timings["total"] = (time.time() - start_total) * 1000
            print(f"   ⚠️  API timeout after {timings['total']:.2f}ms")
            return timings
        except Exception as e:
            print(f"   ❌ API error: {e}")
            return None

        # Component-level profiling
        print("\n2. Profiling embedding generation...")

        start_embed = time.time()
        try:
            embedding = await create_embedding(query)
            timings["embedding_generation"] = (time.time() - start_embed) * 1000
            print(f"   ✅ Embedding generation: {timings['embedding_generation']:.2f}ms")
            print(f"   Embedding dimensions: {len(embedding) if embedding else 0}")
        except Exception as e:
            timings["embedding_generation"] = (time.time() - start_embed) * 1000
            print(f"   ❌ Embedding generation error: {e}")
            return timings

        # Database query profiling
        print("\n3. Profiling database search...")

        # Format embedding as PostgreSQL vector
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

        start_db = time.time()
        try:
            async with get_async_session() as session:
                # Execute HNSW search with EXPLAIN ANALYZE
                query_sql = text("""
                    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
                    SELECT
                        id,
                        url,
                        title,
                        full_content,
                        embedding <=> :embedding::vector AS distance
                    FROM archon_crawled_pages
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> :embedding::vector
                    LIMIT :limit
                """)

                result = await session.execute(
                    query_sql,
                    {"embedding": embedding_str, "limit": match_count}
                )
                explain_result = result.scalar()

                timings["database_search"] = (time.time() - start_db) * 1000
                print(f"   ✅ Database search: {timings['database_search']:.2f}ms")

                # Parse EXPLAIN ANALYZE output
                if explain_result:
                    plan = explain_result[0] if isinstance(explain_result, list) else explain_result
                    execution_time = plan.get("Execution Time", 0)
                    planning_time = plan.get("Planning Time", 0)

                    print(f"   Planning time: {planning_time:.2f}ms")
                    print(f"   Execution time: {execution_time:.2f}ms")

                    # Check if HNSW index was used
                    plan_node = plan.get("Plan", {})
                    node_type = plan_node.get("Node Type", "")
                    index_name = plan_node.get("Index Name", "")

                    if "Index" in node_type:
                        print(f"   ✅ Index used: {index_name} ({node_type})")
                    else:
                        print(f"   ⚠️  No index scan: {node_type}")

        except Exception as e:
            timings["database_search"] = (time.time() - start_db) * 1000
            print(f"   ❌ Database search error: {e}")
            import traceback
            traceback.print_exc()

        # Check cache operations
        print("\n4. Checking cache performance...")
        cache = await get_result_cache()

        start_cache_check = time.time()
        cached = await cache.get(
            query=query,
            search_type="rag_query",
            match_count=match_count,
            source_id=None,
            filter_metadata={"return_mode": "pages"}
        )
        timings["cache_check"] = (time.time() - start_cache_check) * 1000

        if cached:
            print(f"   ✅ Cache HIT: {timings['cache_check']:.2f}ms")
        else:
            print(f"   ⚠️  Cache MISS: {timings['cache_check']:.2f}ms")

        # Calculate unaccounted time
        accounted = (
            timings["embedding_generation"] +
            timings["database_search"] +
            timings["cache_check"]
        )
        timings["result_processing"] = max(0, timings["total"] - accounted)

        print(f"\n5. Time breakdown:")
        print(f"   Embedding generation: {timings['embedding_generation']:.2f}ms ({timings['embedding_generation']/timings['total']*100:.1f}%)")
        print(f"   Database search: {timings['database_search']:.2f}ms ({timings['database_search']/timings['total']*100:.1f}%)")
        print(f"   Cache check: {timings['cache_check']:.2f}ms ({timings['cache_check']/timings['total']*100:.1f}%)")
        print(f"   Result processing: {timings['result_processing']:.2f}ms ({timings['result_processing']/timings['total']*100:.1f}%)")
        print(f"   Total: {timings['total']:.2f}ms")

        return timings

    async def compare_with_baseline(self, test_queries: List[str], baseline_queries: List[str]):
        """Compare test queries with Phase 4.2 baseline queries."""
        print(f"\n{'='*70}")
        print("BASELINE COMPARISON")
        print(f"{'='*70}\n")

        print("Testing E2E test queries:")
        test_results = []
        for query in test_queries:
            result = await self.profile_component_timing(query)
            if result:
                test_results.append(result)
            await asyncio.sleep(2)  # Pause between queries

        print(f"\n{'='*70}")
        print("Testing Phase 4.2 baseline queries:")
        baseline_results = []
        for query in baseline_queries:
            result = await self.profile_component_timing(query)
            if result:
                baseline_results.append(result)
            await asyncio.sleep(2)

        # Summary comparison
        print(f"\n{'='*70}")
        print("PERFORMANCE COMPARISON SUMMARY")
        print(f"{'='*70}\n")

        if test_results:
            test_avg = sum(r["total"] for r in test_results) / len(test_results)
            test_embed_avg = sum(r["embedding_generation"] for r in test_results) / len(test_results)
            test_db_avg = sum(r["database_search"] for r in test_results) / len(test_results)

            print(f"E2E Test Queries (n={len(test_results)}):")
            print(f"  Avg Total: {test_avg:.2f}ms")
            print(f"  Avg Embedding: {test_embed_avg:.2f}ms")
            print(f"  Avg Database: {test_db_avg:.2f}ms")

        if baseline_results:
            baseline_avg = sum(r["total"] for r in baseline_results) / len(baseline_results)
            baseline_embed_avg = sum(r["embedding_generation"] for r in baseline_results) / len(baseline_results)
            baseline_db_avg = sum(r["database_search"] for r in baseline_results) / len(baseline_results)

            print(f"\nPhase 4.2 Baseline Queries (n={len(baseline_results)}):")
            print(f"  Avg Total: {baseline_avg:.2f}ms")
            print(f"  Avg Embedding: {baseline_embed_avg:.2f}ms")
            print(f"  Avg Database: {baseline_db_avg:.2f}ms")

            if test_results:
                print(f"\nDifference:")
                print(f"  Total: {test_avg - baseline_avg:+.2f}ms ({(test_avg/baseline_avg - 1)*100:+.1f}%)")
                print(f"  Embedding: {test_embed_avg - baseline_embed_avg:+.2f}ms ({(test_embed_avg/baseline_embed_avg - 1)*100:+.1f}%)")
                print(f"  Database: {test_db_avg - baseline_db_avg:+.2f}ms ({(test_db_avg/baseline_db_avg - 1)*100:+.1f}%)")

        return test_results, baseline_results

    async def check_embedding_cache_status(self):
        """Check embedding cache statistics."""
        print(f"\n{'='*70}")
        print("EMBEDDING CACHE STATUS")
        print(f"{'='*70}\n")

        try:
            # Get cache stats from API
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.api_base}/cache/stats") as resp:
                    if resp.status == 200:
                        stats = await resp.json()
                        print(f"  Embedding cache enabled: {stats.get('embedding_cache', {}).get('enabled', False)}")
                        print(f"  Cached embeddings: {stats.get('embedding_cache', {}).get('cached_embeddings', 0)}")
                        print(f"  Cache hits: {stats.get('embedding_cache', {}).get('cache_hits', 0)}")
                        print(f"  Cache misses: {stats.get('embedding_cache', {}).get('cache_misses', 0)}")
                    else:
                        print(f"  ⚠️  Could not fetch cache stats (status: {resp.status})")
        except Exception as e:
            print(f"  ⚠️  Error checking embedding cache: {e}")

    async def check_index_statistics(self):
        """Check HNSW index statistics."""
        print(f"\n{'='*70}")
        print("HNSW INDEX STATISTICS")
        print(f"{'='*70}\n")

        try:
            async with get_async_session() as session:
                # Check index size
                result = await session.execute(text("""
                    SELECT
                        schemaname,
                        tablename,
                        indexname,
                        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
                        idx_scan as index_scans,
                        idx_tup_read as tuples_read,
                        idx_tup_fetch as tuples_fetched
                    FROM pg_stat_user_indexes
                    WHERE indexname LIKE '%embedding%'
                    ORDER BY pg_relation_size(indexrelid) DESC;
                """))

                indexes = result.fetchall()

                if indexes:
                    print("HNSW Indexes found:")
                    for idx in indexes:
                        print(f"\n  Index: {idx.indexname}")
                        print(f"    Table: {idx.tablename}")
                        print(f"    Size: {idx.index_size}")
                        print(f"    Scans: {idx.index_scans}")
                        print(f"    Tuples read: {idx.tuples_read}")
                        print(f"    Tuples fetched: {idx.tuples_fetched}")
                else:
                    print("  ⚠️  No embedding indexes found!")

                # Check table statistics
                print("\nTable statistics:")
                result = await session.execute(text("""
                    SELECT
                        COUNT(*) as total_rows,
                        COUNT(*) FILTER (WHERE embedding IS NOT NULL) as rows_with_embeddings,
                        pg_size_pretty(pg_total_relation_size('archon_crawled_pages')) as total_size
                    FROM archon_crawled_pages;
                """))

                stats = result.fetchone()
                print(f"  Total rows: {stats.total_rows}")
                print(f"  Rows with embeddings: {stats.rows_with_embeddings}")
                print(f"  Table size: {stats.total_size}")

        except Exception as e:
            print(f"  ❌ Error checking index statistics: {e}")
            import traceback
            traceback.print_exc()


async def main():
    """Run cold start performance profiling."""
    print("\n" + "="*70)
    print("🔍 COLD START PERFORMANCE PROFILER")
    print("="*70)
    print("\nInvestigating 12-15s cold start latency vs 82ms baseline\n")

    profiler = ColdStartProfiler()

    try:
        # Step 1: Check system status
        await profiler.check_embedding_cache_status()
        await profiler.check_index_statistics()

        # Step 2: Clear cache for accurate cold start measurement
        print(f"\n{'='*70}")
        print("CLEARING CACHES")
        print(f"{'='*70}\n")

        cache = await get_result_cache()
        await cache.invalidate_pattern()
        print("✅ Result cache cleared")

        # Step 3: Profile E2E test queries (the slow ones)
        print(f"\n{'='*70}")
        print("PROFILING E2E TEST QUERIES (SLOW)")
        print(f"{'='*70}")

        e2e_queries = [
            "vector search optimization",
            "authentication patterns",
            "database indexing"
        ]

        # Step 4: Profile Phase 4.2 baseline queries (the fast ones)
        print(f"\n{'='*70}")
        print("PROFILING PHASE 4.2 BASELINE QUERIES (FAST)")
        print(f"{'='*70}")

        baseline_queries = [
            "authentication OAuth JWT",
            "vector search",
            "database performance"
        ]

        # Step 5: Compare
        test_results, baseline_results = await profiler.compare_with_baseline(
            e2e_queries, baseline_queries
        )

        # Step 6: Generate recommendations
        print(f"\n{'='*70}")
        print("RECOMMENDATIONS")
        print(f"{'='*70}\n")

        if test_results and baseline_results:
            test_avg = sum(r["total"] for r in test_results) / len(test_results)
            baseline_avg = sum(r["total"] for r in baseline_results) / len(baseline_results)

            if test_avg > baseline_avg * 2:
                print("⚠️  E2E test queries are significantly slower than baseline")

                # Check embedding time
                test_embed_avg = sum(r["embedding_generation"] for r in test_results) / len(test_results)
                baseline_embed_avg = sum(r["embedding_generation"] for r in baseline_results) / len(baseline_results)

                if test_embed_avg > baseline_embed_avg * 2:
                    print("   → Embedding generation is the bottleneck")
                    print("   → Consider: Pre-generate embeddings for common queries")
                    print("   → Consider: Cache embeddings more aggressively")

                # Check database time
                test_db_avg = sum(r["database_search"] for r in test_results) / len(test_results)
                baseline_db_avg = sum(r["database_search"] for r in baseline_results) / len(baseline_results)

                if test_db_avg > baseline_db_avg * 2:
                    print("   → Database search is the bottleneck")
                    print("   → Consider: Verify HNSW index parameters")
                    print("   → Consider: Analyze query plan differences")
            else:
                print("✅ E2E test queries perform similarly to baseline")

        print("\n✅ Profiling complete!")
        sys.exit(0)

    except Exception as e:
        print(f"\n❌ Error during profiling: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
