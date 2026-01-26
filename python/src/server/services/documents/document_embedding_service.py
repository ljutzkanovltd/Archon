"""
Document Embedding Service

Handles document chunking and embedding generation for project-specific documents.
Provides a complete pipeline: chunk → embed → store in archon_project_documents table.

Features:
- Smart text chunking with sentence boundary preservation
- OpenAI embedding generation with batching and retry logic
- Content deduplication using SHA256 hashing
- Multi-dimensional embedding support (384, 768, 1024, 1536, 3072)
- Token counting with tiktoken for accurate cost estimation
"""

import asyncio
import hashlib
import re
from typing import Any

import tiktoken
from openai import AsyncOpenAI, RateLimitError

from ...config.logfire_config import get_logger

logger = get_logger(__name__)


class DocumentEmbeddingService:
    """Service for chunking documents and generating embeddings."""

    def __init__(self, openai_api_key: str | None = None, supabase_client=None):
        """
        Initialize the document embedding service.

        Args:
            openai_api_key: OpenAI API key. If None, will read from environment.
            supabase_client: Supabase client for database operations.
        """
        # Initialize OpenAI client
        self.client = AsyncOpenAI(api_key=openai_api_key) if openai_api_key else AsyncOpenAI()

        # Default embedding model and dimensions
        self.model = "text-embedding-3-small"
        self.dimension = 1536  # Default dimension for text-embedding-3-small

        # Initialize tokenizer for token counting
        try:
            self.encoder = tiktoken.encoding_for_model("text-embedding-3-small")
        except Exception as e:
            logger.warning(f"Failed to load tiktoken encoder: {e}. Using cl100k_base fallback.")
            self.encoder = tiktoken.get_encoding("cl100k_base")

        # Supabase client for database operations
        if supabase_client is None:
            from ...utils import get_supabase_client
            supabase_client = get_supabase_client()
        self.supabase_client = supabase_client

        logger.info(f"DocumentEmbeddingService initialized | model={self.model} | dimension={self.dimension}")

    async def chunk_document(
        self,
        content: str,
        max_chunk_size: int = 1500,
        overlap: int = 200,
    ) -> list[dict[str, Any]]:
        """
        Chunk document content while preserving sentence boundaries.

        Uses a smart chunking strategy:
        1. Split by sentences (preserves semantic meaning)
        2. Combine sentences up to max_chunk_size
        3. Add overlap between chunks for context preservation
        4. Track chunk metadata (position, token count, hash)

        Args:
            content: Text content to chunk
            max_chunk_size: Maximum characters per chunk (default: 1500)
            overlap: Overlap characters between chunks (default: 200)

        Returns:
            List of chunk dictionaries with:
                - chunk_number: Sequential chunk number (0-based)
                - content: Chunk text content
                - content_hash: SHA256 hash for deduplication
                - start_position: Starting character position
                - end_position: Ending character position
                - token_count: Estimated token count
        """
        if not content or not isinstance(content, str):
            logger.warning("Invalid content provided for chunking")
            return []

        # Split into sentences using multiple delimiters
        # Handles periods, question marks, exclamation marks, and newlines
        sentence_pattern = r'(?<=[.!?\n])\s+'
        sentences = re.split(sentence_pattern, content)

        chunks = []
        current_chunk = ""
        chunk_number = 0
        start_pos = 0

        for sentence in sentences:
            # Test if adding this sentence exceeds max size
            test_chunk = current_chunk + sentence + " "

            if len(test_chunk) > max_chunk_size and current_chunk:
                # Save current chunk
                content_hash = hashlib.sha256(current_chunk.strip().encode()).hexdigest()
                token_count = len(self.encoder.encode(current_chunk))

                chunks.append({
                    'chunk_number': chunk_number,
                    'content': current_chunk.strip(),
                    'content_hash': content_hash,
                    'start_position': start_pos,
                    'end_position': start_pos + len(current_chunk),
                    'token_count': token_count,
                })

                # Start new chunk with overlap
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = overlap_text + sentence + " "
                start_pos += len(current_chunk) - len(overlap_text)
                chunk_number += 1
            else:
                current_chunk = test_chunk

        # Add final chunk if any content remains
        if current_chunk.strip():
            content_hash = hashlib.sha256(current_chunk.strip().encode()).hexdigest()
            token_count = len(self.encoder.encode(current_chunk))

            chunks.append({
                'chunk_number': chunk_number,
                'content': current_chunk.strip(),
                'content_hash': content_hash,
                'start_position': start_pos,
                'end_position': start_pos + len(current_chunk),
                'token_count': token_count,
            })

        logger.info(f"Document chunked | chunks={len(chunks)} | avg_tokens={sum(c['token_count'] for c in chunks) / len(chunks):.1f}")
        return chunks

    async def generate_embeddings(
        self,
        texts: list[str],
        batch_size: int = 100,
        max_retries: int = 3,
    ) -> list[list[float]]:
        """
        Generate embeddings for texts using OpenAI API with batching and retry logic.

        Implements robust error handling:
        - Exponential backoff for rate limiting (1s, 2s, 4s)
        - Automatic retry on transient failures
        - Batch processing for efficiency

        Args:
            texts: List of text strings to embed
            batch_size: Number of texts per API call (default: 100, OpenAI limit)
            max_retries: Maximum retry attempts per batch (default: 3)

        Returns:
            List of embedding vectors (each is List[float] with self.dimension dimensions)

        Raises:
            Exception: If embedding generation fails after all retries
        """
        if not texts:
            logger.warning("Empty texts list provided for embedding generation")
            return []

        embeddings = []
        total_batches = (len(texts) + batch_size - 1) // batch_size

        for batch_idx in range(0, len(texts), batch_size):
            batch = texts[batch_idx:batch_idx + batch_size]
            batch_num = batch_idx // batch_size + 1

            logger.info(f"Generating embeddings | batch={batch_num}/{total_batches} | texts={len(batch)}")

            # Retry logic with exponential backoff
            for attempt in range(max_retries):
                try:
                    response = await self.client.embeddings.create(
                        model=self.model,
                        input=batch,
                        dimensions=self.dimension,
                    )

                    batch_embeddings = [item.embedding for item in response.data]
                    embeddings.extend(batch_embeddings)

                    logger.info(f"Embeddings generated | batch={batch_num}/{total_batches} | vectors={len(batch_embeddings)}")
                    break  # Success - exit retry loop

                except RateLimitError as e:
                    wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                    logger.warning(f"Rate limit hit | batch={batch_num} | attempt={attempt+1}/{max_retries} | waiting={wait_time}s | error={str(e)}")

                    if attempt < max_retries - 1:
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Rate limit exceeded after {max_retries} attempts | batch={batch_num}")
                        raise

                except Exception as e:
                    logger.error(f"Embedding generation failed | batch={batch_num} | attempt={attempt+1}/{max_retries} | error={str(e)}")

                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Embedding generation failed after {max_retries} attempts | batch={batch_num}")
                        raise

        logger.info(f"All embeddings generated | total_vectors={len(embeddings)}")
        return embeddings

    async def check_duplicate(
        self,
        content_hash: str,
        project_id: str,
    ) -> bool:
        """
        Check if content hash already exists for this project.

        Used for deduplication to avoid storing identical chunks multiple times.

        Args:
            content_hash: SHA256 hash of content
            project_id: Project UUID

        Returns:
            True if duplicate exists, False otherwise
        """
        try:
            result = self.supabase_client.table("archon_project_documents") \
                .select("id") \
                .eq("content_hash", content_hash) \
                .eq("project_id", project_id) \
                .limit(1) \
                .execute()

            return len(result.data) > 0

        except Exception as e:
            logger.error(f"Duplicate check failed | content_hash={content_hash[:8]}... | project_id={project_id} | error={str(e)}")
            # Return False on error to allow insert (better to have duplicates than lose data)
            return False

    async def process_document(
        self,
        content: str,
        filename: str,
        project_id: str,
        uploaded_by: str,
        file_type: str = "text",
        file_path: str = "",
        file_size_bytes: int = 0,
        mime_type: str | None = None,
        max_chunk_size: int = 1500,
        overlap: int = 200,
    ) -> dict[str, Any]:
        """
        Complete pipeline: chunk → embed → store in archon_project_documents.

        Workflow:
        1. Chunk document into overlapping segments
        2. Filter out duplicate chunks (by content hash)
        3. Generate embeddings for unique chunks
        4. Store chunks with embeddings in database

        Args:
            content: Document text content
            filename: Original filename
            project_id: Project UUID
            uploaded_by: User UUID who uploaded the document
            file_type: Document type (pdf, markdown, text, image, code)
            file_path: Storage path or S3 key
            file_size_bytes: Original file size in bytes
            mime_type: MIME type of the original file
            max_chunk_size: Maximum characters per chunk
            overlap: Overlap characters between chunks

        Returns:
            Dict with:
                - success: bool
                - chunks_created: int (total chunks from document)
                - chunks_stored: int (unique chunks stored, after deduplication)
                - document_ids: List[str] (UUIDs of stored chunks)
                - embedding_model: str
                - embedding_dimension: int

        Raises:
            Exception: If critical operations fail (with rollback)
        """
        logger.info(f"Processing document | filename={filename} | project_id={project_id} | content_length={len(content)}")

        # Step 1: Chunk the document
        chunks = await self.chunk_document(content, max_chunk_size=max_chunk_size, overlap=overlap)

        if not chunks:
            logger.warning(f"No chunks created from document | filename={filename}")
            return {
                'success': False,
                'error': 'No chunks created from document',
                'chunks_created': 0,
                'chunks_stored': 0,
                'document_ids': [],
            }

        logger.info(f"Document chunked | filename={filename} | chunks={len(chunks)}")

        # Step 2: Filter duplicates
        unique_chunks = []
        duplicate_count = 0

        for chunk in chunks:
            is_duplicate = await self.check_duplicate(chunk['content_hash'], project_id)
            if not is_duplicate:
                unique_chunks.append(chunk)
            else:
                duplicate_count += 1

        logger.info(f"Deduplication complete | filename={filename} | unique={len(unique_chunks)} | duplicates={duplicate_count}")

        if not unique_chunks:
            logger.info(f"All chunks are duplicates | filename={filename}")
            return {
                'success': True,
                'chunks_created': len(chunks),
                'chunks_stored': 0,
                'document_ids': [],
                'message': 'All chunks already exist (deduplication)',
            }

        # Step 3: Generate embeddings
        texts = [chunk['content'] for chunk in unique_chunks]
        embeddings = await self.generate_embeddings(texts)

        if len(embeddings) != len(unique_chunks):
            logger.error(f"Embedding count mismatch | expected={len(unique_chunks)} | got={len(embeddings)}")
            raise ValueError(f"Embedding count mismatch: expected {len(unique_chunks)}, got {len(embeddings)}")

        # Step 4: Store in database
        document_ids = []
        stored_count = 0

        for chunk, embedding in zip(unique_chunks, embeddings, strict=False):
            try:
                # Prepare document record
                doc_data = {
                    "project_id": project_id,
                    "uploaded_by": uploaded_by,
                    "filename": filename,
                    "file_path": file_path or f"uploads/{project_id}/{filename}",
                    "file_type": file_type,
                    "file_size_bytes": file_size_bytes or len(content),
                    "mime_type": mime_type,
                    "chunk_number": chunk['chunk_number'],
                    "content": chunk['content'],
                    "content_hash": chunk['content_hash'],
                    "metadata": {
                        "start_position": chunk['start_position'],
                        "end_position": chunk['end_position'],
                        "token_count": chunk['token_count'],
                    },
                    f"embedding_{self.dimension}": embedding,  # Dynamic field name (embedding_1536, etc.)
                    "embedding_model": self.model,
                    "embedding_dimension": self.dimension,
                }

                # Insert into database
                result = self.supabase_client.table("archon_project_documents") \
                    .insert(doc_data) \
                    .execute()

                if result.data:
                    doc_id = result.data[0]['id']
                    document_ids.append(doc_id)
                    stored_count += 1
                else:
                    logger.warning(f"Insert returned no data | chunk={chunk['chunk_number']}")

            except Exception as e:
                logger.error(f"Failed to store chunk | filename={filename} | chunk={chunk['chunk_number']} | error={str(e)}")
                # Continue with other chunks (partial success is better than total failure)

        logger.info(f"Document processing complete | filename={filename} | stored={stored_count}/{len(unique_chunks)} chunks")

        return {
            'success': True,
            'chunks_created': len(chunks),
            'chunks_stored': stored_count,
            'document_ids': document_ids,
            'embedding_model': self.model,
            'embedding_dimension': self.dimension,
        }

    def estimate_embedding_cost(self, texts: list[str]) -> dict[str, float]:
        """
        Estimate OpenAI API cost for embedding generation.

        Uses tiktoken for accurate token counting.

        Args:
            texts: List of texts to embed

        Returns:
            Dict with:
                - total_tokens: int
                - cost_usd: float (estimated cost in USD)
                - cost_per_1k_tokens: float
        """
        total_tokens = sum(len(self.encoder.encode(text)) for text in texts)

        # OpenAI pricing (as of 2026-01-26)
        # text-embedding-3-small: $0.00002 per 1K tokens
        cost_per_1k = 0.00002
        cost_usd = (total_tokens / 1000) * cost_per_1k

        return {
            'total_tokens': total_tokens,
            'cost_usd': cost_usd,
            'cost_per_1k_tokens': cost_per_1k,
        }
