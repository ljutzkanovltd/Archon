"""
Document Embedding Service Example

Demonstrates how to use the DocumentEmbeddingService to:
1. Chunk documents with sentence boundary preservation
2. Generate embeddings using OpenAI API
3. Store documents with embeddings in archon_project_documents table
4. Handle deduplication automatically

Usage:
    python examples/document_embedding_example.py
"""

import asyncio
import os
from uuid import uuid4

from src.server.services.documents.document_embedding_service import DocumentEmbeddingService


async def main():
    """Example usage of DocumentEmbeddingService."""

    # Initialize service
    # Requires OPENAI_API_KEY environment variable
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        print("❌ OPENAI_API_KEY not set. Please set it in your environment.")
        return

    service = DocumentEmbeddingService(openai_api_key=openai_api_key)

    print("✅ DocumentEmbeddingService initialized")
    print(f"   Model: {service.model}")
    print(f"   Dimension: {service.dimension}\n")

    # Example 1: Basic document chunking
    print("=" * 60)
    print("Example 1: Document Chunking")
    print("=" * 60)

    sample_content = """
    This is a sample document about machine learning.
    Machine learning is a subset of artificial intelligence.
    It enables computers to learn from data without being explicitly programmed.

    There are three main types of machine learning:
    1. Supervised learning - learning from labeled data
    2. Unsupervised learning - finding patterns in unlabeled data
    3. Reinforcement learning - learning through trial and error

    Deep learning is a specialized form of machine learning.
    It uses neural networks with many layers to learn complex patterns.
    Deep learning has achieved remarkable results in image recognition, natural language processing, and game playing.
    """ * 5  # Repeat to create a longer document

    chunks = await service.chunk_document(
        content=sample_content,
        max_chunk_size=1500,  # Characters
        overlap=200,  # Characters
    )

    print(f"✅ Chunked document into {len(chunks)} chunks\n")
    for i, chunk in enumerate(chunks[:3]):  # Show first 3 chunks
        print(f"Chunk {i}:")
        print(f"  Content length: {len(chunk['content'])} chars")
        print(f"  Token count: {chunk['token_count']}")
        print(f"  Hash: {chunk['content_hash'][:16]}...")
        print(f"  Position: {chunk['start_position']}-{chunk['end_position']}")
        print(f"  Preview: {chunk['content'][:100]}...")
        print()

    # Example 2: Embedding generation
    print("=" * 60)
    print("Example 2: Embedding Generation")
    print("=" * 60)

    sample_texts = [
        "Machine learning is a subset of AI",
        "Deep learning uses neural networks",
        "Supervised learning requires labeled data"
    ]

    print(f"Generating embeddings for {len(sample_texts)} texts...")
    embeddings = await service.generate_embeddings(sample_texts)

    print(f"✅ Generated {len(embeddings)} embeddings")
    print(f"   Dimension: {len(embeddings[0])}")
    print(f"   Sample embedding (first 5 values): {embeddings[0][:5]}\n")

    # Example 3: Cost estimation
    print("=" * 60)
    print("Example 3: Cost Estimation")
    print("=" * 60)

    cost_info = service.estimate_embedding_cost(sample_texts)

    print(f"✅ Cost estimation:")
    print(f"   Total tokens: {cost_info['total_tokens']}")
    print(f"   Estimated cost: ${cost_info['cost_usd']:.6f}")
    print(f"   Cost per 1K tokens: ${cost_info['cost_per_1k_tokens']:.6f}\n")

    # Example 4: Complete workflow (chunking + embedding + storage)
    print("=" * 60)
    print("Example 4: Complete Workflow")
    print("=" * 60)

    # Note: This requires a valid project_id and user_id in your database
    # Uncomment and modify the following code to test with real data:

    print("⚠️  Complete workflow example (commented out):")
    print("    - Requires valid project_id and uploaded_by user_id")
    print("    - Requires Supabase connection")
    print("    - Will create entries in archon_project_documents table\n")

    # Uncomment to run with real data:
    """
    result = await service.process_document(
        content=sample_content,
        filename="machine_learning_guide.txt",
        project_id="your-project-uuid-here",
        uploaded_by="your-user-uuid-here",
        file_type="text",
        file_path="uploads/ml_guide.txt",
        file_size_bytes=len(sample_content.encode('utf-8')),
        mime_type="text/plain",
    )

    print(f"✅ Document processed successfully:")
    print(f"   Chunks created: {result['chunks_created']}")
    print(f"   Chunks stored: {result['chunks_stored']}")
    print(f"   Document IDs: {len(result['document_ids'])}")
    print(f"   Embedding model: {result['embedding_model']}")
    print(f"   Embedding dimension: {result['embedding_dimension']}")
    """

    print("\n" + "=" * 60)
    print("✅ All examples completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
