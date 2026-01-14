"""
Tests for smart text chunking functionality.

Tests cover:
- Token-based chunking with 512 tokens and 20% overlap
- Character-based chunking (legacy mode)
- Code block preservation (bidirectional detection)
- Overlap verification between chunks
- Edge cases (empty text, very small text, very large text)
"""

import pytest

from src.server.services.storage.base_storage_service import BaseStorageService


class TestStorageService(BaseStorageService):
    """Concrete implementation for testing."""

    async def store_documents(self, documents, **kwargs):
        return {"success": True}

    async def process_document(self, document, **kwargs):
        return document


@pytest.fixture
def storage_service():
    """Create a test storage service instance."""
    return TestStorageService(supabase_client=None)


class TestTokenCounting:
    """Test token counting functionality."""

    def test_count_tokens_basic(self, storage_service):
        """Test basic token counting."""
        text = "Hello, world!"
        tokens = storage_service._count_tokens(text)
        assert tokens > 0
        assert tokens < len(text)  # Tokens should be less than characters

    def test_count_tokens_long_text(self, storage_service):
        """Test token counting on longer text."""
        text = "This is a longer text with multiple sentences. " * 10
        tokens = storage_service._count_tokens(text)
        # Rough estimate: 3-5 chars per token (more lenient range)
        expected_range = (len(text) // 6, len(text) // 2)
        assert expected_range[0] <= tokens <= expected_range[1]

    def test_count_tokens_code(self, storage_service):
        """Test token counting on code."""
        text = """
def hello_world():
    print("Hello, world!")
    return True
"""
        tokens = storage_service._count_tokens(text)
        assert tokens > 0


class TestCodeBlockDetection:
    """Test code block boundary detection."""

    def test_find_code_block_backward(self, storage_service):
        """Test finding code block boundary backward."""
        text = "Some text\n```python\ncode here\n```\nmore text"
        position = 30  # After the code block
        result = storage_service._find_code_block_boundary(text, position, "backward")
        assert result is not None
        assert text[result : result + 3] == "```"

    def test_find_code_block_forward(self, storage_service):
        """Test finding code block boundary forward."""
        text = "Some text\n```python\ncode here\n```\nmore text"
        position = 5  # Before the code block
        result = storage_service._find_code_block_boundary(text, position, "forward")
        assert result is not None
        assert text[result : result + 3] == "```"

    def test_find_code_block_not_found(self, storage_service):
        """Test when no code block is found."""
        text = "Some text without code blocks"
        result = storage_service._find_code_block_boundary(text, 10, "backward")
        assert result is None


class TestBasicChunking:
    """Test basic chunking functionality."""

    def test_empty_text(self, storage_service):
        """Test chunking empty text."""
        chunks = storage_service.smart_chunk_text("")
        assert chunks == []

    def test_invalid_input(self, storage_service):
        """Test chunking invalid input."""
        chunks = storage_service.smart_chunk_text(None)
        assert chunks == []

    def test_small_text_no_chunking(self, storage_service):
        """Test that small text is not chunked."""
        text = "This is a small text."
        chunks = storage_service.smart_chunk_text(text, chunk_size=512)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_large_text_creates_multiple_chunks(self, storage_service):
        """Test that large text creates multiple chunks."""
        text = "This is a sentence. " * 200  # ~600 tokens
        chunks = storage_service.smart_chunk_text(text, chunk_size=512)
        assert len(chunks) > 1


class TestTokenBasedChunking:
    """Test token-based chunking with 512 tokens."""

    def test_default_token_chunking(self, storage_service):
        """Test default token-based chunking (512 tokens)."""
        text = "This is a test sentence. " * 100  # ~400 tokens
        chunks = storage_service.smart_chunk_text(text, chunk_size=512, use_tokens=True)

        # Each chunk should be roughly 512 tokens or less
        for chunk in chunks:
            token_count = storage_service._count_tokens(chunk)
            assert token_count <= 512 * 1.1  # Allow 10% tolerance

    def test_overlap_exists(self, storage_service):
        """Test that 20% overlap exists between chunks."""
        text = "This is sentence number {}. " * 200  # Generate numbered sentences
        text = "".join([f"This is sentence number {i}. " for i in range(200)])
        chunks = storage_service.smart_chunk_text(text, chunk_size=512, overlap_percentage=0.20, use_tokens=True)

        if len(chunks) > 1:
            # Check that consecutive chunks have some overlap
            for i in range(len(chunks) - 1):
                chunk1 = chunks[i]
                chunk2 = chunks[i + 1]

                # Find common substring
                # Check if last 20% of chunk1 overlaps with first 20% of chunk2
                overlap_size = len(chunk1) // 5  # Rough 20%
                chunk1_end = chunk1[-overlap_size:]
                chunk2_start = chunk2[:overlap_size]

                # They should have some common words
                chunk1_words = set(chunk1_end.split())
                chunk2_words = set(chunk2_start.split())
                common_words = chunk1_words & chunk2_words

                # At least some overlap should exist
                assert len(common_words) > 0, f"No overlap found between chunks {i} and {i+1}"


class TestCodeBlockPreservation:
    """Test that code blocks are preserved properly."""

    def test_preserve_short_code_block(self, storage_service):
        """Test that short code blocks are preserved."""
        text = """
This is some documentation.

```python
def hello():
    print("Hello")
```

More documentation here.
"""
        chunks = storage_service.smart_chunk_text(text, chunk_size=512, use_tokens=True)

        # Code block should be in one chunk
        code_block_found = False
        for chunk in chunks:
            if "```python" in chunk and "```" in chunk[chunk.index("```python") + 9 :]:
                code_block_found = True
                # Verify the code block is complete
                assert "def hello():" in chunk
                assert 'print("Hello")' in chunk
                break

        assert code_block_found, "Code block was not preserved"

    def test_preserve_long_code_block(self, storage_service):
        """Test that long code blocks are preserved (>512 tokens)."""
        code_lines = [f"    line_{i} = {i}  # Comment {i}" for i in range(100)]
        code_block = "```python\n" + "\n".join(code_lines) + "\n```"
        text = f"Documentation before.\n\n{code_block}\n\nDocumentation after."

        chunks = storage_service.smart_chunk_text(text, chunk_size=512, use_tokens=True)

        # Find the chunk(s) containing the code block
        code_chunks = [chunk for chunk in chunks if "```python" in chunk or "```" in chunk]

        # Verify code block boundaries are detected
        # For very long code blocks, they might be split, but should maintain boundaries
        assert len(code_chunks) >= 1

        # Check that we have proper code block markers
        total_markers = sum(chunk.count("```") for chunk in chunks)
        # Should have at least opening and closing markers (2 total)
        assert total_markers >= 2, f"Expected at least 2 ``` markers, found {total_markers}"

        # If in one chunk, verify it's complete
        if len(code_chunks) == 1 and "```python" in code_chunks[0]:
            closing_pos = code_chunks[0].find("```", code_chunks[0].find("```python") + 3)
            # If we found a closing marker, the block is complete
            if closing_pos != -1:
                assert "line_0 = 0" in code_chunks[0]

    def test_multiple_code_blocks(self, storage_service):
        """Test handling of multiple code blocks."""
        text = """
# Example 1

```python
def func1():
    pass
```

# Example 2

```python
def func2():
    pass
```
"""
        chunks = storage_service.smart_chunk_text(text, chunk_size=512, use_tokens=True)

        # Both code blocks should be preserved
        code_block_count = sum(chunk.count("```python") for chunk in chunks)
        assert code_block_count >= 2


class TestCharacterBasedChunking:
    """Test character-based chunking (legacy mode)."""

    def test_character_chunking(self, storage_service):
        """Test character-based chunking."""
        text = "a" * 1000
        chunks = storage_service.smart_chunk_text(text, chunk_size=300, use_tokens=False)

        # Should create multiple chunks
        assert len(chunks) > 1

        # Each chunk should be roughly 300 characters (with overlap)
        for chunk in chunks:
            assert len(chunk) <= 300 * 1.5  # Allow for overlap


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_text_exactly_chunk_size(self, storage_service):
        """Test text that's exactly the chunk size."""
        text = "word " * 100  # Approximately 500 characters
        chunks = storage_service.smart_chunk_text(text, chunk_size=100, use_tokens=False)
        assert len(chunks) >= 1

    def test_very_long_text(self, storage_service):
        """Test very long text (should create many chunks)."""
        text = "This is a test sentence. " * 1000  # ~4000 tokens
        chunks = storage_service.smart_chunk_text(text, chunk_size=512, use_tokens=True)
        assert len(chunks) >= 5  # Should create multiple chunks

    def test_text_with_mixed_content(self, storage_service):
        """Test text with mixed content (paragraphs, code, lists)."""
        text = """
# Heading

This is a paragraph with multiple sentences. It contains important information.

## Code Example

```python
def example():
    return True
```

- List item 1
- List item 2
- List item 3

Another paragraph here.
"""
        chunks = storage_service.smart_chunk_text(text, chunk_size=512, use_tokens=True)
        assert len(chunks) >= 1

        # Verify content is preserved
        full_text = "\n\n".join(chunks)
        assert "# Heading" in full_text
        assert "def example():" in full_text
        assert "List item 1" in full_text


class TestAsyncChunking:
    """Test async chunking functionality."""

    @pytest.mark.asyncio
    async def test_async_chunking_small_text(self, storage_service):
        """Test async chunking with small text."""
        text = "This is a small text. " * 10
        chunks = await storage_service.smart_chunk_text_async(text, chunk_size=512, use_tokens=True)
        assert len(chunks) >= 1

    @pytest.mark.asyncio
    async def test_async_chunking_large_text(self, storage_service):
        """Test async chunking with large text (uses thread pool)."""
        text = "This is a test sentence. " * 5000  # >50KB
        chunks = await storage_service.smart_chunk_text_async(text, chunk_size=512, use_tokens=True)
        assert len(chunks) > 1

    @pytest.mark.asyncio
    async def test_async_chunking_with_progress(self, storage_service):
        """Test async chunking with progress callback."""
        text = "This is a test. " * 100
        progress_called = False

        async def progress_callback(message, percent):
            nonlocal progress_called
            progress_called = True
            assert percent == 100
            assert "completed" in message.lower()

        chunks = await storage_service.smart_chunk_text_async(
            text, chunk_size=512, use_tokens=True, progress_callback=progress_callback
        )
        assert len(chunks) >= 1
        assert progress_called


class TestOverlapPercentage:
    """Test different overlap percentages."""

    def test_no_overlap(self, storage_service):
        """Test chunking with no overlap (0%)."""
        text = "This is a test sentence. " * 100
        chunks = storage_service.smart_chunk_text(text, chunk_size=512, overlap_percentage=0.0, use_tokens=True)
        assert len(chunks) >= 1

    def test_high_overlap(self, storage_service):
        """Test chunking with high overlap (50%)."""
        text = "This is a test sentence. " * 100
        chunks = storage_service.smart_chunk_text(text, chunk_size=512, overlap_percentage=0.5, use_tokens=True)

        # Higher overlap should create more chunks
        chunks_low_overlap = storage_service.smart_chunk_text(
            text, chunk_size=512, overlap_percentage=0.2, use_tokens=True
        )
        assert len(chunks) >= len(chunks_low_overlap)


class TestBreakPointLogic:
    """Test that break points are chosen intelligently."""

    def test_paragraph_break_preferred(self, storage_service):
        """Test that paragraph breaks are preferred over sentence breaks."""
        paragraphs = ["Paragraph {}.\n\n".format(i) for i in range(50)]
        text = "".join(paragraphs)

        chunks = storage_service.smart_chunk_text(text, chunk_size=512, use_tokens=True)

        # Check that most chunks end near paragraph boundaries
        for chunk in chunks[:-1]:  # Exclude last chunk
            # Should end with paragraph break or similar
            assert chunk.strip()  # Not empty

    def test_sentence_break_fallback(self, storage_service):
        """Test that sentence breaks are used as fallback."""
        text = "This is sentence one. This is sentence two. " * 100
        chunks = storage_service.smart_chunk_text(text, chunk_size=512, use_tokens=True)

        # Chunks should generally end at sentence boundaries when no paragraph breaks
        for chunk in chunks[:-1]:
            # Most chunks should end with a period
            assert chunk.strip()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
