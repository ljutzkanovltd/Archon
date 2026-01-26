# Document Embedding Service

## Overview

The `DocumentEmbeddingService` provides a complete pipeline for processing project-specific documents:

1. **Chunking** - Smart text chunking with sentence boundary preservation
2. **Embedding** - OpenAI embedding generation with batching and retry logic
3. **Storage** - Store chunks with embeddings in `archon_project_documents` table
4. **Deduplication** - Automatic content deduplication using SHA256 hashing

## Features

✅ **Smart Chunking**
- Preserves sentence boundaries (no mid-sentence splits)
- Configurable chunk size (default: 1500 characters)
- Overlap between chunks (default: 200 characters) for context preservation
- Tracks chunk metadata (position, token count, hash)

✅ **Robust Embedding Generation**
- OpenAI `text-embedding-3-small` model (1536 dimensions)
- Batch processing (up to 100 texts per API call)
- Exponential backoff on rate limits (1s, 2s, 4s)
- Automatic retry on transient failures (max 3 attempts)

✅ **Deduplication**
- SHA256 content hashing for duplicate detection
- Per-project deduplication (same content in different projects is allowed)
- Skips embedding generation for duplicate chunks (cost savings)

✅ **Multi-Dimensional Embeddings**
- Supports 384, 768, 1024, 1536, 3072 dimension embeddings
- Flexible schema allows different embedding models
- Default: 1536D (text-embedding-3-small)

## Installation

Dependencies are already included in `pyproject.toml`:

```toml
[dependency-groups]
server = [
    "openai==1.71.0",
    "tiktoken>=0.5.0",
    # ... other dependencies
]
```

Install with:
```bash
uv sync --group server
```

## Configuration

Set your OpenAI API key:

```bash
export OPENAI_API_KEY="sk-..."
```

Or pass it directly to the service:

```python
service = DocumentEmbeddingService(openai_api_key="sk-...")
```

## Usage

### Basic Initialization

```python
from src.server.services.documents.document_embedding_service import DocumentEmbeddingService

# Initialize with default settings
service = DocumentEmbeddingService()

# Or with custom settings
service = DocumentEmbeddingService(
    openai_api_key="sk-...",
    supabase_client=custom_client
)
```

### Document Chunking

```python
content = """
Your long document content here.
Multiple paragraphs and sentences.
The service will intelligently chunk this.
"""

chunks = await service.chunk_document(
    content=content,
    max_chunk_size=1500,  # Characters per chunk
    overlap=200,          # Overlap between chunks
)

# Each chunk contains:
# {
#     'chunk_number': 0,
#     'content': 'text...',
#     'content_hash': 'sha256...',
#     'start_position': 0,
#     'end_position': 1500,
#     'token_count': 450
# }
```

### Embedding Generation

```python
texts = [
    "First document chunk",
    "Second document chunk",
    "Third document chunk"
]

embeddings = await service.generate_embeddings(
    texts=texts,
    batch_size=100,      # Texts per API call
    max_retries=3        # Retry attempts on failure
)

# Returns: List[List[float]]
# Each embedding is 1536 dimensions by default
```

### Complete Workflow

The `process_document()` method handles the entire pipeline:

```python
result = await service.process_document(
    content="Your document content...",
    filename="report.pdf",
    project_id="550e8400-e29b-41d4-a716-446655440000",
    uploaded_by="user-uuid-here",
    file_type="pdf",  # pdf, markdown, text, image, code
    file_path="s3://bucket/project-123/report.pdf",
    file_size_bytes=2048576,
    mime_type="application/pdf",
    max_chunk_size=1500,
    overlap=200,
)

# Returns:
# {
#     'success': True,
#     'chunks_created': 10,
#     'chunks_stored': 8,  # After deduplication
#     'document_ids': ['uuid-1', 'uuid-2', ...],
#     'embedding_model': 'text-embedding-3-small',
#     'embedding_dimension': 1536
# }
```

### Cost Estimation

Estimate OpenAI API costs before processing:

```python
texts = ["chunk 1", "chunk 2", "chunk 3"]

cost_info = service.estimate_embedding_cost(texts)

# Returns:
# {
#     'total_tokens': 450,
#     'cost_usd': 0.000009,
#     'cost_per_1k_tokens': 0.00002
# }
```

## Database Schema

Documents are stored in `archon_project_documents` table:

```sql
CREATE TABLE archon_project_documents (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    uploaded_by UUID NOT NULL,
    filename VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100),
    chunk_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Multi-dimensional embeddings
    embedding_384 VECTOR(384),
    embedding_768 VECTOR(768),
    embedding_1024 VECTOR(1024),
    embedding_1536 VECTOR(1536),
    embedding_3072 VECTOR(3072),

    -- Provenance
    embedding_model TEXT,
    embedding_dimension INTEGER,

    -- Full-text search
    content_search_vector TSVECTOR,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Querying Documents

### Vector Similarity Search

Use the provided SQL function:

```sql
SELECT * FROM search_project_documents(
    'project-uuid',
    '[0.123, 0.456, ...]'::vector(1536),  -- Query embedding
    1536,  -- Embedding dimension
    10,    -- Match count
    NULL   -- File type filter (optional)
);
```

### Full-Text Search

```sql
SELECT filename, chunk_number, content,
       ts_rank(content_search_vector, query) AS rank
FROM archon_project_documents,
     to_tsquery('english', 'machine & learning') query
WHERE project_id = 'project-uuid'
  AND content_search_vector @@ query
ORDER BY rank DESC
LIMIT 10;
```

## Error Handling

### Rate Limiting

The service automatically handles OpenAI rate limits:

```python
# Automatically retries with exponential backoff
embeddings = await service.generate_embeddings(texts)

# 1st attempt: immediate
# 2nd attempt: after 1 second
# 3rd attempt: after 2 seconds
# 4th attempt: after 4 seconds
# Raises RateLimitError if all attempts fail
```

### Deduplication

Duplicate chunks are automatically detected and skipped:

```python
result = await service.process_document(...)

if result['chunks_stored'] == 0:
    # All chunks were duplicates
    print("Document already exists in the project")
```

### Empty Content

```python
result = await service.process_document(content="")

# Returns:
# {
#     'success': False,
#     'error': 'No chunks created from document',
#     'chunks_created': 0,
#     'chunks_stored': 0
# }
```

## Performance Optimization

### Batching

Embeddings are generated in batches of 100 (OpenAI limit):

```python
# Efficiently processes 250 texts in 3 API calls
texts = [f"Text {i}" for i in range(250)]
embeddings = await service.generate_embeddings(texts, batch_size=100)
```

### Deduplication

Content hashing avoids redundant embedding generation:

```python
# Upload same document twice - second upload is fast (no API calls)
await service.process_document(content, ...)  # Embeds all chunks
await service.process_document(content, ...)  # Skips all chunks (duplicates)
```

### Token Counting

Accurate token counting with tiktoken (no API calls):

```python
chunks = await service.chunk_document(content)
total_tokens = sum(chunk['token_count'] for chunk in chunks)
```

## Cost Management

OpenAI pricing (as of 2026-01-26):

- **text-embedding-3-small**: $0.00002 per 1K tokens

Example costs:

| Document Size | Tokens | Cost |
|---------------|--------|------|
| 1 page (~500 words) | ~650 | $0.000013 |
| 10 pages | ~6,500 | $0.00013 |
| 100 pages | ~65,000 | $0.0013 |
| 1000 pages | ~650,000 | $0.013 |

Tips for cost reduction:

1. **Deduplication** - Automatically skips duplicate content
2. **Chunking** - Only embed relevant sections
3. **Batch processing** - Efficient API usage
4. **Cost estimation** - Check costs before processing

```python
# Estimate cost before processing
chunks = await service.chunk_document(content)
texts = [chunk['content'] for chunk in chunks]
cost_info = service.estimate_embedding_cost(texts)

if cost_info['cost_usd'] > 1.0:
    print(f"Warning: Processing will cost ${cost_info['cost_usd']:.4f}")
    # Decide whether to proceed
```

## Testing

Run the test suite:

```bash
cd python
uv run pytest tests/test_document_embedding.py -v
```

Test coverage:

- ✅ Document chunking with overlap
- ✅ Sentence boundary preservation
- ✅ Embedding generation with batching
- ✅ Rate limit retry logic
- ✅ Deduplication detection
- ✅ Complete workflow (chunk → embed → store)
- ✅ Cost estimation
- ✅ Edge cases (unicode, long sentences, empty content)

## Examples

See `examples/document_embedding_example.py` for complete usage examples:

```bash
cd python
OPENAI_API_KEY="sk-..." uv run python examples/document_embedding_example.py
```

## API Reference

### `DocumentEmbeddingService`

**Constructor:**
```python
DocumentEmbeddingService(
    openai_api_key: Optional[str] = None,
    supabase_client = None
)
```

**Methods:**

- `chunk_document(content, max_chunk_size=1500, overlap=200)` → `List[Dict]`
- `generate_embeddings(texts, batch_size=100, max_retries=3)` → `List[List[float]]`
- `check_duplicate(content_hash, project_id)` → `bool`
- `process_document(...)` → `Dict[str, Any]`
- `estimate_embedding_cost(texts)` → `Dict[str, float]`

See docstrings for detailed parameter descriptions.

## Troubleshooting

### OpenAI API Key Issues

```
Error: OpenAI API key not set
Solution: export OPENAI_API_KEY="sk-..."
```

### Rate Limit Exceeded

```
Error: RateLimitError after 3 attempts
Solution: Service automatically retries. If persistent, check your OpenAI quota.
```

### Database Connection Issues

```
Error: Unable to connect to Supabase
Solution: Ensure Supabase services are running (local-ai-packaged)
```

### Embedding Dimension Mismatch

```
Error: Vector dimension mismatch
Solution: Ensure embedding_dimension matches the vector column used (1536 by default)
```

## Future Enhancements

Potential improvements:

- [ ] Support for additional embedding models (Cohere, Voyage AI)
- [ ] Async batch processing with progress callbacks
- [ ] Incremental updates (re-embed only changed chunks)
- [ ] Automatic model selection based on document type
- [ ] Hybrid search (vector + full-text)
- [ ] Reranking with cross-encoder models

## License

See main Archon license.

## Support

For issues or questions:
- Check test suite: `tests/test_document_embedding.py`
- Review examples: `examples/document_embedding_example.py`
- See main Archon documentation: `.claude/CLAUDE.md`
