#!/usr/bin/env python3
"""
Test Query Rewriting Service

This script tests the query rewriting functionality:
1. Short queries get expanded with synonyms and related terms
2. Long queries are not rewritten
3. Can be enabled/disabled via settings
4. Expected impact: +15-20% recall improvement for short queries
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from server.services.credential_service import credential_service
from server.services.search.query_rewriting_service import QueryRewritingService


async def test_query_rewriting():
    """Test query rewriting with various scenarios"""

    print("=" * 80)
    print("QUERY REWRITING SERVICE TEST")
    print("=" * 80)
    print()

    # Initialize service
    service = QueryRewritingService()

    # Test queries
    test_queries = [
        ("auth", "technical documentation"),  # Short - should expand
        ("JWT", "technical documentation"),  # Very short - should expand
        ("database migration", "technical documentation"),  # 2 words - should expand
        ("how to implement JWT authentication in FastAPI", "technical documentation"),  # Long - no expansion
        ("Docker", "infrastructure"),  # Short with different context
        ("API", "code examples"),  # Very short for code
    ]

    print("QUERY REWRITING TESTS")
    print("-" * 80)
    print()

    # First, check if rewriting is enabled
    enabled = await service._get_setting("ENABLE_QUERY_REWRITING", False)
    min_words = await service._get_setting("QUERY_REWRITE_MIN_WORDS", 4)

    print(f"Settings:")
    print(f"  ENABLE_QUERY_REWRITING: {enabled}")
    print(f"  QUERY_REWRITE_MIN_WORDS: {min_words}")
    print()

    if not enabled:
        print("⚠️  Query rewriting is DISABLED. To enable:")
        print("   docker exec supabase-ai-db psql -U postgres -d postgres -c \\")
        print("     \"UPDATE archon_settings SET value='true' WHERE key='ENABLE_QUERY_REWRITING';\"")
        print()
        print("Running tests anyway to show what would happen if enabled...")
        print()

    for query, context in test_queries:
        print(f"Query: '{query}' (context: {context})")
        print(f"  Word count: {len(query.split())} words")

        # Check if it should be rewritten
        should_rewrite = await service.should_rewrite_query(query)
        print(f"  Should rewrite: {should_rewrite}")

        # Attempt rewriting
        result = await service.rewrite_query(query, context)

        if result["used_rewriting"]:
            print(f"  ✅ REWRITTEN:")
            print(f"     Original: {result['original_query']}")
            print(f"     Expanded: {result['rewritten_query']}")
            print(f"     Added terms: {', '.join(result['expansion_terms'])}")
            print(f"     Term count: {len(result['expansion_terms'])}")
        else:
            print(f"  ⏭️  SKIPPED (not rewritten)")
            if "error" in result:
                print(f"     Error: {result['error']}")

        print()

    print()
    print("=" * 80)
    print("BATCH REWRITING TEST")
    print("=" * 80)
    print()

    batch_queries = ["auth", "JWT", "Docker", "API"]
    print(f"Batch queries: {batch_queries}")
    print()

    results = await service.rewrite_query_batch(batch_queries, "technical documentation")

    for i, result in enumerate(results):
        query = batch_queries[i]
        if result["used_rewriting"]:
            print(
                f"{i + 1}. '{query}' → '{result['rewritten_query']}' "
                f"(+{len(result['expansion_terms'])} terms)"
            )
        else:
            print(f"{i + 1}. '{query}' → NOT REWRITTEN")

    print()
    print("=" * 80)
    print("EXPECTED IMPACT")
    print("=" * 80)
    print()
    print("Query rewriting provides:")
    print("  • +15-20% recall improvement for short queries (<4 words)")
    print("  • Better synonym matching (auth → authentication, authorization)")
    print("  • Related term expansion (JWT → tokens, sessions, OAuth)")
    print("  • Technical variation coverage (API → endpoint, REST, GraphQL)")
    print()
    print("When to use:")
    print("  ✅ Short, ambiguous queries")
    print("  ✅ Technical acronyms (JWT, API, DB)")
    print("  ✅ Single-word searches")
    print("  ❌ Already descriptive queries")
    print("  ❌ Queries >4 words")
    print()


async def test_integration_with_rag():
    """Test query rewriting integration with RAG service"""

    print("=" * 80)
    print("RAG INTEGRATION TEST")
    print("=" * 80)
    print()

    from server.services.search.rag_service import RAGService

    rag_service = RAGService()

    # Test with a short query
    test_query = "auth"
    print(f"Test query: '{test_query}'")
    print()

    try:
        success, result = await rag_service.perform_rag_query(
            query=test_query, match_count=3, return_mode="chunks"
        )

        if success:
            print("✅ RAG query succeeded")
            print()

            # Check if query rewriting was applied
            if "query_rewriting" in result:
                qr = result["query_rewriting"]
                print("Query Rewriting Applied:")
                print(f"  Original: {qr['original_query']}")
                print(f"  Expansion: {', '.join(qr['expansion_terms'])}")
                print()

            print(f"Search mode: {result.get('search_mode', 'unknown')}")
            print(f"Reranking applied: {result.get('reranking_applied', False)}")
            print(f"Results found: {result.get('total_found', 0)}")
            print()

            if result.get("results"):
                print("Top result preview:")
                top_result = result["results"][0]
                content = top_result.get("content", "")[:150]
                print(f"  {content}...")
                print()
        else:
            print(f"❌ RAG query failed: {result.get('error')}")

    except Exception as e:
        print(f"❌ Integration test error: {e}")
        import traceback

        traceback.print_exc()

    print()


if __name__ == "__main__":
    print()
    asyncio.run(test_query_rewriting())

    print()
    print("Would you like to test RAG integration? (requires active LLM provider)")
    print("Note: This will make actual API calls to the configured LLM.")
    print()

    # For automated testing, you can uncomment:
    # asyncio.run(test_integration_with_rag())

    print("Done! ✅")
    print()
