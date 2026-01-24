#!/usr/bin/env python3
"""
Test Result Cache Implementation

Tests the result cache service directly without requiring embeddings or API calls.

Usage: python scripts/test_result_cache.py

Created: 2026-01-23
Phase: 3.1 - Result Caching Implementation - Testing
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.server.services.search.result_cache import get_result_cache


async def test_cache_operations():
    """Test basic cache operations."""
    print("\n" + "=" * 60)
    print("RESULT CACHE OPERATIONS TEST")
    print("=" * 60)

    # Get cache instance
    print("\n1. Getting result cache instance...")
    cache = await get_result_cache()
    print(f"✅ Cache instance created")

    # Test cache MISS (first query)
    print("\n2. Testing cache MISS (first query)...")
    query = "test vector search performance"
    search_type = "rag_query"
    match_count = 10

    cached = await cache.get(
        query=query,
        search_type=search_type,
        match_count=match_count,
        source_id=None,
        filter_metadata=None
    )

    if cached is None:
        print("✅ Cache MISS (expected for first query)")
    else:
        print(f"❌ Unexpected cache HIT: {cached}")
        return False

    # Test cache SET
    print("\n3. Storing test results in cache...")
    test_results = [
        {"id": "1", "content": "test result 1", "similarity": 0.95},
        {"id": "2", "content": "test result 2", "similarity": 0.90},
        {"id": "3", "content": "test result 3", "similarity": 0.85},
    ]

    await cache.set(
        query=query,
        search_type=search_type,
        match_count=match_count,
        results=test_results,
        source_id=None,
        filter_metadata=None
    )
    print("✅ Results stored in cache")

    # Test cache HIT (second query with same parameters)
    print("\n4. Testing cache HIT (same query again)...")
    cached = await cache.get(
        query=query,
        search_type=search_type,
        match_count=match_count,
        source_id=None,
        filter_metadata=None
    )

    if cached is not None:
        print(f"✅ Cache HIT! Retrieved {len(cached)} results")
        if cached == test_results:
            print("✅ Cached results match original data")
        else:
            print(f"❌ Cached results don't match: {cached}")
            return False
    else:
        print("❌ Expected cache HIT but got MISS")
        return False

    # Test different search types create different cache keys
    print("\n5. Testing cache key differentiation by search_type...")
    cached_different_type = await cache.get(
        query=query,  # Same query
        search_type="code_examples",  # Different type
        match_count=match_count,
        source_id=None,
        filter_metadata=None
    )

    if cached_different_type is None:
        print("✅ Cache MISS for different search_type (correct)")
    else:
        print(f"❌ Unexpected cache HIT for different search_type")
        return False

    # Test cache stats
    print("\n6. Getting cache statistics...")
    stats = await cache.get_stats()
    print(f"Cache enabled: {stats.get('enabled')}")
    print(f"Cached results: {stats.get('cached_results', 0)}")
    print(f"TTL: {stats.get('ttl_hours')}h")

    if stats.get("cached_results", 0) > 0:
        print("✅ Cache statistics show cached entries")
    else:
        print("⚠️  No cached results reported (may need to wait for Redis sync)")

    # Test cache invalidation by pattern
    print("\n7. Testing cache invalidation by pattern...")
    await cache.invalidate_pattern(search_type="rag_query")
    print("✅ Invalidated rag_query pattern")

    # Verify cache is empty after invalidation
    cached_after_invalidation = await cache.get(
        query=query,
        search_type=search_type,
        match_count=match_count,
        source_id=None,
        filter_metadata=None
    )

    if cached_after_invalidation is None:
        print("✅ Cache MISS after invalidation (correct)")
    else:
        print(f"❌ Unexpected cache HIT after invalidation")
        return False

    print("\n" + "=" * 60)
    print("✅ ALL RESULT CACHE TESTS PASSED")
    print("=" * 60)
    return True


async def test_source_invalidation():
    """Test source-specific cache invalidation."""
    print("\n" + "=" * 60)
    print("SOURCE INVALIDATION TEST")
    print("=" * 60)

    cache = await get_result_cache()

    # Store results for multiple sources
    print("\n1. Storing results for source_1...")
    await cache.set(
        query="test query",
        search_type="rag_query",
        match_count=5,
        results=[{"source_id": "source_1", "content": "data"}],
        source_id="source_1",
        filter_metadata=None
    )

    print("2. Storing results for source_2...")
    await cache.set(
        query="test query 2",
        search_type="rag_query",
        match_count=5,
        results=[{"source_id": "source_2", "content": "data"}],
        source_id="source_2",
        filter_metadata=None
    )

    # Invalidate source_1
    print("\n3. Invalidating source_1...")
    await cache.invalidate_source("source_1")
    print("✅ Source invalidation completed")

    # Verify source_1 is invalidated
    cached_source_1 = await cache.get(
        query="test query",
        search_type="rag_query",
        match_count=5,
        source_id="source_1",
        filter_metadata=None
    )

    # Verify source_2 is still cached
    cached_source_2 = await cache.get(
        query="test query 2",
        search_type="rag_query",
        match_count=5,
        source_id="source_2",
        filter_metadata=None
    )

    if cached_source_1 is None and cached_source_2 is not None:
        print("✅ Source-specific invalidation works correctly")
        print("   - source_1: invalidated (MISS)")
        print("   - source_2: still cached (HIT)")
    else:
        print("❌ Source-specific invalidation failed")
        print(f"   - source_1: {cached_source_1}")
        print(f"   - source_2: {cached_source_2}")
        return False

    print("\n" + "=" * 60)
    print("✅ SOURCE INVALIDATION TEST PASSED")
    print("=" * 60)
    return True


async def main():
    """Run all tests."""
    print("\n🚀 Starting Result Cache Tests")

    try:
        # Test 1: Basic cache operations
        if not await test_cache_operations():
            print("\n❌ Basic cache operations test failed")
            sys.exit(1)

        # Test 2: Source-specific invalidation
        if not await test_source_invalidation():
            print("\n❌ Source invalidation test failed")
            sys.exit(1)

        print("\n✅ All result cache tests passed successfully!")
        sys.exit(0)

    except Exception as e:
        print(f"\n❌ Error running tests: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
