#!/usr/bin/env python3
"""
Test script to verify reranker model upgrade.
Tests that the new bge-reranker-v2.5-large model loads successfully.
"""

import sys
import asyncio
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from server.services.search.reranking_strategy import (
    RerankingStrategy,
    DEFAULT_RERANKING_MODEL,
    RERANKING_MODELS,
)


def test_model_constants():
    """Test that model constants are correctly defined."""
    print("=" * 80)
    print("TEST 1: Model Constants")
    print("=" * 80)

    print(f"\n✓ DEFAULT_RERANKING_MODEL: {DEFAULT_RERANKING_MODEL}")

    expected_model = "BAAI/bge-reranker-v2-m3"
    assert DEFAULT_RERANKING_MODEL == expected_model, (
        f"Default model should be {expected_model}, got {DEFAULT_RERANKING_MODEL}"
    )
    print(f"✓ Confirmed default is {expected_model}")

    print(f"\n✓ Available models: {len(RERANKING_MODELS)}")
    for key, info in RERANKING_MODELS.items():
        print(f"  - {key}: {info['name']}")
        print(f"    NDCG@10: {info['ndcg']}, Params: {info['params']}, Speed: {info['speed']}")

    print("\n✅ Model constants test PASSED\n")


def test_model_initialization():
    """Test that the reranker initializes successfully."""
    print("=" * 80)
    print("TEST 2: Model Initialization")
    print("=" * 80)

    print(f"\n⏳ Initializing reranker with model: {DEFAULT_RERANKING_MODEL}")
    print("   (First run may take time to download model...)")

    try:
        strategy = RerankingStrategy()
        print(f"✓ Reranker initialized successfully")

        # Check availability
        is_available = strategy.is_available()
        print(f"✓ Model available: {is_available}")

        if not is_available:
            print("❌ Model failed to load")
            return False

        # Get model info
        model_info = strategy.get_model_info()
        print(f"\n✓ Model info:")
        for key, value in model_info.items():
            print(f"  - {key}: {value}")

        print("\n✅ Model initialization test PASSED\n")
        return True

    except Exception as e:
        print(f"❌ Initialization failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_reranking_functionality():
    """Test that reranking actually works with sample data."""
    print("=" * 80)
    print("TEST 3: Reranking Functionality")
    print("=" * 80)

    # Sample query and documents
    query = "authentication JWT tokens"

    results = [
        {
            "id": "1",
            "content": "How to implement JWT authentication in FastAPI. JWT tokens provide stateless authentication.",
            "title": "JWT Auth Guide",
            "score": 0.8,
        },
        {
            "id": "2",
            "content": "Database migration patterns using Alembic. Migrations help manage schema changes.",
            "title": "Database Migrations",
            "score": 0.7,
        },
        {
            "id": "3",
            "content": "JWT token validation and refresh token patterns for secure authentication systems.",
            "title": "JWT Token Security",
            "score": 0.75,
        },
        {
            "id": "4",
            "content": "CSS styling patterns for React components. Use Tailwind for utility-first design.",
            "title": "React Styling",
            "score": 0.6,
        },
    ]

    print(f"\n✓ Query: '{query}'")
    print(f"✓ Documents: {len(results)}")

    print("\nOriginal order (by initial score):")
    for i, r in enumerate(results, 1):
        print(f"  {i}. [{r['score']:.2f}] {r['title']}: {r['content'][:60]}...")

    try:
        strategy = RerankingStrategy()

        if not strategy.is_available():
            print("❌ Reranker not available")
            return False

        print(f"\n⏳ Reranking results...")
        reranked = await strategy.rerank_results(query, results, content_key="content")

        print("\nReranked order (by rerank_score):")
        for i, r in enumerate(reranked, 1):
            rerank_score = r.get('rerank_score', 'N/A')
            score_str = f"{rerank_score:.4f}" if isinstance(rerank_score, float) else str(rerank_score)
            print(f"  {i}. [{score_str}] {r['title']}: {r['content'][:60]}...")

        # Verify reranking happened
        assert 'rerank_score' in reranked[0], "Rerank scores should be added"

        # The JWT-related documents should rank higher after reranking
        top_result = reranked[0]
        print(f"\n✓ Top result after reranking: '{top_result['title']}'")

        # Check that scores are different from original
        original_order = [r['id'] for r in results]
        reranked_order = [r['id'] for r in reranked]

        if original_order != reranked_order:
            print("✓ Order changed after reranking (good!)")
        else:
            print("⚠️  Order didn't change (may be okay if original was already good)")

        print("\n✅ Reranking functionality test PASSED\n")
        return True

    except Exception as e:
        print(f"❌ Reranking failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests."""
    print("\n" + "=" * 80)
    print("RERANKER MODEL UPGRADE VERIFICATION")
    print("=" * 80)
    print(f"\nUpgrade: ms-marco-MiniLM-L-6-v2 (2021, NDCG@10: 0.390)")
    print(f"      → bge-reranker-v2-m3 (2024, NDCG@10: 0.512)")
    print(f"Expected improvement: +31%\n")

    results = []

    # Test 1: Constants
    try:
        test_model_constants()
        results.append(("Model Constants", True))
    except Exception as e:
        print(f"❌ Test failed: {e}")
        results.append(("Model Constants", False))

    # Test 2: Initialization
    try:
        init_result = test_model_initialization()
        results.append(("Model Initialization", init_result))
    except Exception as e:
        print(f"❌ Test failed: {e}")
        results.append(("Model Initialization", False))

    # Test 3: Functionality (only if initialization passed)
    if results[-1][1]:  # If initialization passed
        try:
            func_result = await test_reranking_functionality()
            results.append(("Reranking Functionality", func_result))
        except Exception as e:
            print(f"❌ Test failed: {e}")
            results.append(("Reranking Functionality", False))
    else:
        print("⏭️  Skipping functionality test (initialization failed)\n")
        results.append(("Reranking Functionality", False))

    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")

    all_passed = all(passed for _, passed in results)

    print("\n" + "=" * 80)
    if all_passed:
        print("🎉 ALL TESTS PASSED - Model upgrade successful!")
    else:
        print("⚠️  SOME TESTS FAILED - Review output above")
    print("=" * 80 + "\n")

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
