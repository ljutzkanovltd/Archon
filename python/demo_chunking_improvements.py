"""
Demonstration of improved chunking capabilities.

This script shows:
1. Comparison between old (600 chars, no overlap) and new (512 tokens, 20% overlap)
2. Code block preservation improvements
3. Token counting accuracy
"""

from unittest.mock import MagicMock

from src.server.services.storage.base_storage_service import BaseStorageService


class DemoStorageService(BaseStorageService):
    """Demo implementation for testing."""

    def __init__(self):
        """Initialize without Supabase for demo purposes."""
        # Create mock supabase client
        mock_client = MagicMock()
        super().__init__(supabase_client=mock_client)

    async def store_documents(self, documents, **kwargs):
        return {"success": True}

    async def process_document(self, document, **kwargs):
        return document


def demo_basic_chunking():
    """Demonstrate basic token-based chunking."""
    print("\n" + "=" * 80)
    print("DEMO 1: Basic Token-Based Chunking (512 tokens, 20% overlap)")
    print("=" * 80)

    service = DemoStorageService()
    text = """
Artificial Intelligence (AI) has revolutionized the way we approach problem-solving
and data analysis. Machine learning, a subset of AI, enables computers to learn from
data without being explicitly programmed. Deep learning, in turn, is a subset of
machine learning that uses neural networks with multiple layers.

The applications of AI are vast and growing. From natural language processing that
powers chatbots and translation services, to computer vision that enables facial
recognition and autonomous vehicles, AI is transforming industries worldwide.

However, with great power comes great responsibility. Ethical considerations in AI
development are crucial. Issues like bias in training data, privacy concerns, and
the potential for job displacement require careful attention from developers,
policymakers, and society at large.
""" * 2  # Repeat to ensure multiple chunks

    print(f"\nOriginal text length: {len(text)} characters")
    print(f"Estimated tokens: {service._count_tokens(text)} tokens")

    # New method: 512 tokens with 20% overlap
    chunks_new = service.smart_chunk_text(text, chunk_size=512, overlap_percentage=0.20, use_tokens=True)

    print(f"\nNew method (512 tokens, 20% overlap):")
    print(f"  Chunks created: {len(chunks_new)}")

    for i, chunk in enumerate(chunks_new):
        tokens = service._count_tokens(chunk)
        print(f"  Chunk {i + 1}: {len(chunk)} chars, ~{tokens} tokens")

        # Show overlap between consecutive chunks
        if i > 0:
            prev_chunk = chunks_new[i - 1]
            # Find common words
            prev_words = set(prev_chunk.split()[-20:])  # Last 20 words of previous
            curr_words = set(chunk.split()[:20])  # First 20 words of current
            overlap_words = prev_words & curr_words
            print(f"    Overlap with previous: {len(overlap_words)} common words")


def demo_code_block_preservation():
    """Demonstrate improved code block preservation."""
    print("\n" + "=" * 80)
    print("DEMO 2: Code Block Preservation (Bidirectional Detection)")
    print("=" * 80)

    service = DemoStorageService()

    text = """
# Python Function Example

Here's a simple function that demonstrates recursion:

```python
def fibonacci(n):
    '''Calculate the nth Fibonacci number.'''
    if n <= 1:
        return n
    else:
        return fibonacci(n-1) + fibonacci(n-2)

# Example usage
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")
```

This implementation is simple but not efficient for large values of n due to
repeated calculations. A more efficient approach would use memoization or
dynamic programming.

## Optimized Version

```python
def fibonacci_optimized(n, memo={}):
    '''Optimized Fibonacci with memoization.'''
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fibonacci_optimized(n-1, memo) + fibonacci_optimized(n-2, memo)
    return memo[n]
```

The optimized version runs in O(n) time instead of O(2^n).
"""

    chunks = service.smart_chunk_text(text, chunk_size=512, use_tokens=True)

    print(f"\nChunks created: {len(chunks)}")

    for i, chunk in enumerate(chunks):
        code_blocks = chunk.count("```")
        print(f"\nChunk {i + 1}:")
        print(f"  Size: {len(chunk)} chars, ~{service._count_tokens(chunk)} tokens")
        print(f"  Code block markers: {code_blocks}")

        if "```python" in chunk:
            # Check if code block is complete
            opening = chunk.find("```python")
            closing = chunk.find("```", opening + 3)
            if closing != -1:
                print(f"  ✓ Complete code block preserved")
            else:
                print(f"  ⚠ Code block may be split")


def demo_overlap_comparison():
    """Compare chunks with and without overlap."""
    print("\n" + "=" * 80)
    print("DEMO 3: Overlap Comparison (0% vs 20% overlap)")
    print("=" * 80)

    service = DemoStorageService()
    text = "This is sentence number {}. " * 100
    text = "".join([f"This is sentence number {i}. " for i in range(100)])

    # No overlap
    chunks_no_overlap = service.smart_chunk_text(text, chunk_size=512, overlap_percentage=0.0, use_tokens=True)

    # 20% overlap
    chunks_with_overlap = service.smart_chunk_text(text, chunk_size=512, overlap_percentage=0.20, use_tokens=True)

    print(f"\nNo overlap (0%):")
    print(f"  Chunks: {len(chunks_no_overlap)}")

    print(f"\nWith overlap (20%):")
    print(f"  Chunks: {len(chunks_with_overlap)}")

    # Show overlap benefit
    if len(chunks_with_overlap) > 1:
        chunk1 = chunks_with_overlap[0]
        chunk2 = chunks_with_overlap[1]

        # Find where overlap starts
        last_20_words_c1 = chunk1.split()[-20:]
        first_20_words_c2 = chunk2.split()[:20]

        common = set(last_20_words_c1) & set(first_20_words_c2)

        print(f"\nOverlap example (Chunk 1 → Chunk 2):")
        print(f"  Common words: {len(common)}")
        print(f"  This ensures context is preserved across chunk boundaries!")


def demo_token_vs_character():
    """Compare token-based vs character-based chunking."""
    print("\n" + "=" * 80)
    print("DEMO 4: Token-Based vs Character-Based Chunking")
    print("=" * 80)

    service = DemoStorageService()
    text = """
Machine learning algorithms can be broadly categorized into supervised learning,
unsupervised learning, and reinforcement learning. Supervised learning uses labeled
data to train models, while unsupervised learning finds patterns in unlabeled data.
Reinforcement learning learns through trial and error, receiving rewards or penalties.
""" * 3

    print(f"\nOriginal text: {len(text)} characters, ~{service._count_tokens(text)} tokens")

    # Token-based (new default)
    chunks_tokens = service.smart_chunk_text(text, chunk_size=512, use_tokens=True)

    # Character-based (legacy)
    chunks_chars = service.smart_chunk_text(text, chunk_size=512, use_tokens=False)

    print(f"\nToken-based chunking (512 tokens):")
    print(f"  Chunks: {len(chunks_tokens)}")
    for i, chunk in enumerate(chunks_tokens):
        print(f"  Chunk {i + 1}: {len(chunk)} chars, ~{service._count_tokens(chunk)} tokens")

    print(f"\nCharacter-based chunking (512 chars):")
    print(f"  Chunks: {len(chunks_chars)}")
    for i, chunk in enumerate(chunks_chars):
        print(f"  Chunk {i + 1}: {len(chunk)} chars, ~{service._count_tokens(chunk)} tokens")

    print(
        "\n→ Token-based chunking provides more consistent semantic units, "
        "especially for different languages and special characters."
    )


if __name__ == "__main__":
    print("\n" + "🚀" * 40)
    print("ARCHON CHUNKING IMPROVEMENTS DEMONSTRATION")
    print("🚀" * 40)

    demo_basic_chunking()
    demo_code_block_preservation()
    demo_overlap_comparison()
    demo_token_vs_character()

    print("\n" + "=" * 80)
    print("SUMMARY OF IMPROVEMENTS")
    print("=" * 80)
    print("""
✓ Token-based chunking (512 tokens) - industry standard
✓ 20% overlap between chunks - preserves context
✓ Bidirectional code block detection - better preservation
✓ Configurable overlap percentage (0-50%)
✓ Backward compatible (character-based mode available)
✓ Handles edge cases (empty text, very small/large text)
✓ Async support with progress callbacks
✓ Thread pool for large texts (>50KB)

Expected Impact:
- Better chunk quality for retrieval (semantic consistency)
- Improved context preservation at boundaries
- More reliable code block handling
- Fewer fragmented code examples in search results
""")
    print("=" * 80 + "\n")
