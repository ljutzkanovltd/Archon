"""
Tests for contextual embedding service enhancements.

Tests token estimation, document truncation, and logging improvements.
"""

import pytest

from src.server.services.embeddings.contextual_embedding_service import (
    estimate_tokens,
    truncate_to_token_limit,
)


class TestTokenEstimation:
    """Tests for token estimation utility."""

    def test_estimate_tokens_empty_string(self):
        """Test token estimation for empty string."""
        assert estimate_tokens("") == 0

    def test_estimate_tokens_short_text(self):
        """Test token estimation for short text."""
        # "Hello world" = 11 chars, should estimate ~2-3 tokens
        text = "Hello world"
        tokens = estimate_tokens(text)
        assert tokens == 2  # 11 // 4 = 2

    def test_estimate_tokens_medium_text(self):
        """Test token estimation for medium text (~1000 chars)."""
        text = "a" * 1000
        tokens = estimate_tokens(text)
        assert tokens == 250  # 1000 // 4 = 250

    def test_estimate_tokens_large_text(self):
        """Test token estimation for large text (~30k chars)."""
        text = "a" * 30000
        tokens = estimate_tokens(text)
        assert tokens == 7500  # 30000 // 4 = 7500

    def test_estimate_tokens_realistic_document(self):
        """Test token estimation for realistic document content."""
        # Typical documentation paragraph
        text = """
        Archon is a Model Context Protocol (MCP) server that provides
        knowledge base management, documentation indexing, and task tracking
        capabilities for the SportERP platform. It enables AI assistants like
        Claude Code to access project documentation, search code examples,
        and manage development tasks.
        """
        tokens = estimate_tokens(text)
        # Should be around 70-80 tokens (280-320 chars)
        assert 60 < tokens < 100


class TestDocumentTruncation:
    """Tests for document truncation utility."""

    def test_truncate_short_document_no_truncation(self):
        """Test that short documents are not truncated."""
        text = "Hello world"
        max_tokens = 1000
        result = truncate_to_token_limit(text, max_tokens)
        assert result == text
        assert "..." not in result

    def test_truncate_exact_limit_no_truncation(self):
        """Test document at exact token limit is not truncated."""
        text = "a" * 4000  # Exactly 1000 tokens
        max_tokens = 1000
        result = truncate_to_token_limit(text, max_tokens)
        assert result == text
        assert "..." not in result

    def test_truncate_long_document_with_ellipsis(self):
        """Test that long documents are truncated with ellipsis."""
        text = "a" * 10000  # 2500 tokens
        max_tokens = 1000
        result = truncate_to_token_limit(text, max_tokens)
        assert len(result) == 4003  # 4000 chars + "..."
        assert result.endswith("...")

    def test_truncate_preserves_content_before_limit(self):
        """Test that truncation preserves content before the limit."""
        text = "0123456789" * 1000  # 10000 chars
        max_tokens = 500  # 2000 chars
        result = truncate_to_token_limit(text, max_tokens)
        assert result[:2000] == text[:2000]
        assert result.endswith("...")

    def test_truncate_default_max_tokens(self):
        """Test truncation with default max_tokens parameter."""
        text = "a" * 30000  # 7500 tokens
        result = truncate_to_token_limit(text)  # Default: 5000 tokens
        assert len(result) == 20003  # 20000 chars + "..."
        assert result.endswith("...")

    def test_truncate_realistic_large_document(self):
        """Test truncation with realistic large documentation."""
        # Simulate a large README or documentation file
        section = "## Section\n\nThis is a section with content.\n\n" * 500  # ~22k chars
        max_tokens = 5000  # 20k chars
        result = truncate_to_token_limit(section, max_tokens)
        assert len(result) == 20003  # 20000 chars + "..."
        assert result.endswith("...")
        # Should preserve beginning of document
        assert result.startswith("## Section")


class TestIntegration:
    """Integration tests for token estimation and truncation together."""

    def test_estimate_then_truncate_consistency(self):
        """Test that estimation and truncation work together consistently."""
        text = "a" * 10000  # 2500 tokens
        max_tokens = 1000

        # Estimate before truncation
        estimated_before = estimate_tokens(text)
        assert estimated_before == 2500

        # Truncate
        truncated = truncate_to_token_limit(text, max_tokens)

        # Estimate after truncation (excluding ellipsis)
        estimated_after = estimate_tokens(truncated[:-3])  # Remove "..."
        assert estimated_after == max_tokens

    def test_realistic_contextual_embedding_scenario(self):
        """Test realistic scenario for contextual embedding."""
        # Simulate a large document (50k chars = ~12.5k tokens)
        full_document = "# Documentation\n\n" + ("Lorem ipsum dolor sit amet. " * 2000)

        # We want to use 7500 tokens max for document context
        max_doc_tokens = 7500
        truncated = truncate_to_token_limit(full_document, max_doc_tokens)

        # Verify truncation
        assert len(truncated) <= (max_doc_tokens * 4) + 3  # +3 for "..."

        # Verify estimated tokens are within limit
        estimated = estimate_tokens(truncated[:-3] if truncated.endswith("...") else truncated)
        assert estimated <= max_doc_tokens

        # Verify we preserved the beginning
        assert truncated.startswith("# Documentation")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
