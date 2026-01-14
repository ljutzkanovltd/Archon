"""
Base Storage Service

Provides common functionality for all document storage operations including:
- Text chunking
- Metadata extraction
- Batch processing
- Progress reporting
"""

import re
from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import Any
from urllib.parse import urlparse

import tiktoken

from ...config.logfire_config import get_logger, safe_span

logger = get_logger(__name__)


class BaseStorageService(ABC):
    """Base class for all storage services with common functionality."""

    def __init__(self, supabase_client=None):
        """Initialize with optional supabase client and threading service."""
        # Lazy import to avoid circular dependency
        if supabase_client is None:
            from ...utils import get_supabase_client

            supabase_client = get_supabase_client()
        self.supabase_client = supabase_client

        # Lazy import threading service
        from ...utils import get_utils_threading_service

        self.threading_service = get_utils_threading_service()

        # Initialize tokenizer (cached)
        self._tokenizer = None

    def _get_tokenizer(self):
        """Get or initialize the tiktoken tokenizer (cached)."""
        if self._tokenizer is None:
            try:
                self._tokenizer = tiktoken.get_encoding("cl100k_base")
            except Exception as e:
                logger.warning(f"Failed to load tiktoken encoder: {e}. Using character-based fallback.")
                self._tokenizer = False  # Sentinel value to indicate fallback mode
        return self._tokenizer

    def _count_tokens(self, text: str) -> int:
        """
        Count tokens using tiktoken (OpenAI's tokenizer).

        Args:
            text: Text to count tokens for

        Returns:
            Number of tokens (or character count / 4 as fallback)
        """
        tokenizer = self._get_tokenizer()
        if tokenizer is False:
            # Fallback: rough estimate (4 chars ≈ 1 token)
            return len(text) // 4

        try:
            return len(tokenizer.encode(text))
        except Exception as e:
            logger.warning(f"Token counting failed: {e}. Using character fallback.")
            return len(text) // 4

    def _find_code_block_boundary(
        self, text: str, position: int, direction: str = "backward", search_limit: int | None = None
    ) -> int | None:
        """
        Find nearest code block boundary (```) from position.

        Args:
            text: Text to search in
            position: Starting position
            direction: 'backward' or 'forward'
            search_limit: Maximum distance to search (None = no limit)

        Returns:
            Position of code block boundary, or None if not found
        """
        if direction == "backward":
            # Search backward from position
            start = max(0, position - search_limit) if search_limit else 0
            pos = text.rfind("```", start, position)
            if pos != -1:
                return pos
        else:  # forward
            # Search forward from position
            end = min(len(text), position + search_limit) if search_limit else len(text)
            pos = text.find("```", position, end)
            if pos != -1:
                return pos
        return None

    def smart_chunk_text(
        self,
        text: str,
        chunk_size: int = 512,
        overlap_percentage: float = 0.20,
        use_tokens: bool = True,
    ) -> list[str]:
        """
        Split text into chunks intelligently, preserving context.

        This function implements a token-aware chunking strategy that:
        1. Uses token-based chunking (default 512 tokens) instead of character-based
        2. Implements 20% overlap between chunks to preserve context
        3. Preserves code blocks (```) as complete units using bidirectional detection
        4. Prefers to break at paragraph boundaries (\\n\\n)
        5. Falls back to sentence boundaries (. ) if needed
        6. Only splits mid-content when absolutely necessary

        Args:
            text: Text to chunk
            chunk_size: Maximum chunk size in tokens (default: 512, industry standard)
                       or characters if use_tokens=False
            overlap_percentage: Percentage of overlap between chunks (default: 0.20 = 20%)
            use_tokens: Use token-based chunking (default: True). If False, uses character-based.

        Returns:
            List of text chunks with overlap
        """
        if not text or not isinstance(text, str):
            logger.warning("Invalid text provided for chunking")
            return []

        chunks = []
        start = 0
        text_length = len(text)

        # Calculate overlap size
        overlap_size = int(chunk_size * overlap_percentage)

        while start < text_length:
            # Find the approximate end position for this chunk
            if use_tokens:
                # For token-based chunking, we need to iteratively find the right character position
                # that corresponds to our target token count
                current_pos = start
                target_tokens = chunk_size
                step_size = chunk_size * 4  # Start with rough estimate (4 chars per token)

                # Binary search to find position that gives us ~chunk_size tokens
                while current_pos < text_length:
                    end_candidate = min(current_pos + step_size, text_length)
                    candidate_text = text[start:end_candidate]
                    token_count = self._count_tokens(candidate_text)

                    if token_count >= target_tokens:
                        # We have enough tokens, narrow down to exact position
                        if abs(token_count - target_tokens) <= 5:  # Within 5 tokens is good enough
                            end = end_candidate
                            break
                        # Too many tokens, reduce step size
                        step_size = step_size // 2
                        if step_size < 10:
                            end = end_candidate
                            break
                    else:
                        # Not enough tokens yet, continue forward
                        current_pos = end_candidate
                        if end_candidate >= text_length:
                            end = text_length
                            break
                else:
                    end = text_length
            else:
                # Character-based chunking (legacy mode)
                end = min(start + chunk_size, text_length)

            # If we're at the end of the text, take what's left
            if end >= text_length:
                chunk = text[start:].strip()
                if chunk:
                    chunks.append(chunk)
                break

            # Try to find a good break point
            chunk_text = text[start:end]

            # First, try to break at a code block boundary (bidirectional search)
            if "```" in chunk_text:
                # Look for code block boundaries in both directions
                backward_pos = self._find_code_block_boundary(chunk_text, len(chunk_text), "backward")
                forward_pos = self._find_code_block_boundary(text, end, "forward", chunk_size // 2)

                # Prefer backward boundary if it's in the latter half of the chunk
                if backward_pos is not None and backward_pos > len(chunk_text) * 0.5:
                    end = start + backward_pos
                # Otherwise try forward boundary if it's not too far ahead
                elif forward_pos is not None and forward_pos < end + chunk_size // 2:
                    end = forward_pos
                # If neither works well, try other break points
                elif "\n\n" in chunk_text:
                    last_break = chunk_text.rfind("\n\n")
                    if last_break > len(chunk_text) * 0.3:
                        end = start + last_break
                elif ". " in chunk_text:
                    last_period = chunk_text.rfind(". ")
                    if last_period > len(chunk_text) * 0.3:
                        end = start + last_period + 1
            # If no code block, try paragraph break
            elif "\n\n" in chunk_text:
                last_break = chunk_text.rfind("\n\n")
                if last_break > len(chunk_text) * 0.3:
                    end = start + last_break
            # If no paragraph break, try sentence break
            elif ". " in chunk_text:
                last_period = chunk_text.rfind(". ")
                if last_period > len(chunk_text) * 0.3:
                    end = start + last_period + 1

            # Extract chunk and clean it up
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            # Calculate next start position with overlap
            if use_tokens:
                # For token-based overlap, estimate character position for overlap
                overlap_chars = int((end - start) * overlap_percentage)
                next_start = max(start + 1, end - overlap_chars)
            else:
                # Character-based overlap
                next_start = max(start + 1, end - overlap_size)

            # Ensure we're making progress
            if next_start <= start:
                next_start = start + max(1, (end - start) // 2)

            start = next_start

        # Post-processing: Handle very small chunks
        if chunks:
            # Calculate minimum chunk size (in tokens or characters)
            min_chunk_size = chunk_size // 4  # 25% of target size

            combined_chunks: list[str] = []
            i = 0
            while i < len(chunks):
                current = chunks[i]
                current_size = self._count_tokens(current) if use_tokens else len(current)

                # Combine small chunks with next chunk
                while current_size < min_chunk_size and i + 1 < len(chunks):
                    i += 1
                    current = current + "\n\n" + chunks[i]
                    current_size = self._count_tokens(current) if use_tokens else len(current)

                combined_chunks.append(current)
                i += 1

            chunks = combined_chunks

        return chunks

    async def smart_chunk_text_async(
        self,
        text: str,
        chunk_size: int = 512,
        overlap_percentage: float = 0.20,
        use_tokens: bool = True,
        progress_callback: Callable | None = None,
    ) -> list[str]:
        """
        Async version of smart_chunk_text with optional progress reporting.

        Args:
            text: Text to chunk
            chunk_size: Maximum chunk size in tokens (default: 512, industry standard)
                       or characters if use_tokens=False
            overlap_percentage: Percentage of overlap between chunks (default: 0.20 = 20%)
            use_tokens: Use token-based chunking (default: True). If False, uses character-based.
            progress_callback: Optional callback for progress updates

        Returns:
            List of text chunks with overlap
        """
        with safe_span(
            "smart_chunk_text_async",
            text_length=len(text),
            chunk_size=chunk_size,
            overlap_percentage=overlap_percentage,
            use_tokens=use_tokens,
        ) as span:
            try:
                # For large texts, run chunking in thread pool
                if len(text) > 50000:  # 50KB threshold
                    chunks = await self.threading_service.run_cpu_intensive(
                        self.smart_chunk_text, text, chunk_size, overlap_percentage, use_tokens
                    )
                else:
                    chunks = self.smart_chunk_text(text, chunk_size, overlap_percentage, use_tokens)

                if progress_callback:
                    await progress_callback("Text chunking completed", 100)

                span.set_attribute("chunks_created", len(chunks))
                span.set_attribute("success", True)

                logger.info(
                    f"Successfully chunked text: original_length={len(text)}, "
                    f"chunks_created={len(chunks)}, use_tokens={use_tokens}"
                )

                return chunks

            except Exception as e:
                span.set_attribute("success", False)
                span.set_attribute("error", str(e))
                logger.error(f"Error chunking text: {e}")
                raise

    def extract_metadata(
        self, chunk: str, base_metadata: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """
        Extract metadata from a text chunk.

        Args:
            chunk: Text chunk to analyze
            base_metadata: Optional base metadata to extend

        Returns:
            Dictionary containing metadata
        """
        # Extract headers
        headers = re.findall(r"^(#+)\s+(.+)$", chunk, re.MULTILINE)
        header_str = "; ".join([f"{h[0]} {h[1]}" for h in headers]) if headers else ""

        # Extract basic stats
        metadata = {
            "headers": header_str,
            "char_count": len(chunk),
            "word_count": len(chunk.split()),
            "line_count": len(chunk.splitlines()),
            "has_code": "```" in chunk,
            "has_links": "http" in chunk or "www." in chunk,
        }

        # Merge with base metadata if provided
        if base_metadata:
            metadata.update(base_metadata)

        return metadata

    def extract_source_id(self, url: str) -> str:
        """
        Extract source ID from URL.

        Args:
            url: URL to extract source ID from

        Returns:
            Source ID (typically the domain)
        """
        try:
            parsed_url = urlparse(url)
            return parsed_url.netloc or parsed_url.path or url
        except Exception as e:
            logger.warning(f"Error parsing URL {url}: {e}")
            return url

    async def batch_process_with_progress(
        self,
        items: list[Any],
        process_func: Callable,
        batch_size: int = 20,
        progress_callback: Callable | None = None,
        description: str = "Processing",
    ) -> list[Any]:
        """
        Process items in batches with progress reporting.

        Args:
            items: Items to process
            process_func: Function to process each batch
            batch_size: Size of each batch
            progress_callback: Optional progress callback
            description: Description for progress messages

        Returns:
            List of processed results
        """
        results = []
        total_items = len(items)

        for i in range(0, total_items, batch_size):
            batch_end = min(i + batch_size, total_items)
            batch = items[i:batch_end]

            # Process batch
            batch_results = await process_func(batch)
            results.extend(batch_results)

            # Report progress
            if progress_callback:
                progress_pct = int((batch_end / total_items) * 100)
                await progress_callback(
                    f"{description}: {batch_end}/{total_items} items", progress_pct
                )

        return results

    @abstractmethod
    async def store_documents(self, documents: list[dict[str, Any]], **kwargs) -> dict[str, Any]:
        """
        Store documents in the database. Must be implemented by subclasses.

        Args:
            documents: List of documents to store
            **kwargs: Additional storage options

        Returns:
            Storage result with success status and metadata
        """
        pass

    @abstractmethod
    async def process_document(self, document: dict[str, Any], **kwargs) -> dict[str, Any]:
        """
        Process a single document. Must be implemented by subclasses.

        Args:
            document: Document to process
            **kwargs: Additional processing options

        Returns:
            Processed document with metadata
        """
        pass
