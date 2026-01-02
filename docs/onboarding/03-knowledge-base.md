# 03 - Knowledge Base & RAG System

This document explains how Archon's knowledge base works - from document chunking to semantic search.

---

## Overview

The knowledge base pipeline transforms documents into searchable vectors:

```
┌─────────────────────────────────────────────────────────────────┐
│                  KNOWLEDGE BASE PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Document (URL/File)                                            │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────────┐                                              │
│   │   Crawling   │  Crawl4AI extracts HTML → Markdown           │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │   Chunking   │  smart_chunk_text() → 600-char chunks        │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │  Contextual  │  (Optional) LLM adds document context        │
│   │  Enhancement │                                              │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │  Embedding   │  OpenAI/Google → 1536-dim vectors            │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │   Storage    │  Supabase pgvector + tsvector                │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │ Hybrid Search│  Vector + Full-text → Ranked results         │
│   └──────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Intelligent Chunking

**File**: `python/src/server/services/storage/base_storage_service.py:39-120`

### Algorithm Overview

The `smart_chunk_text` function implements context-aware chunking that preserves semantic boundaries:

```
┌─────────────────────────────────────────────────────────────────┐
│               CHUNKING ALGORITHM DECISION TREE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Input Text (any length)                                        │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────┐                                │
│   │ Start at position 0        │                                │
│   └─────────────┬──────────────┘                                │
│                 ▼                                                │
│   ┌────────────────────────────┐                                │
│   │ Extract chunk_size (600)   │                                │
│   │ characters                 │                                │
│   └─────────────┬──────────────┘                                │
│                 ▼                                                │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ FIND BREAK POINT (priority order):                     │    │
│   │                                                        │    │
│   │  ┌──────────────────────────────────────────────────┐ │    │
│   │  │ 1. Code Block Boundary (```)                     │ │    │
│   │  │    - Preserves code integrity                    │ │    │
│   │  │    - Must be >30% into chunk                     │ │    │
│   │  └─────────────────────┬────────────────────────────┘ │    │
│   │                        │ not found                     │    │
│   │                        ▼                               │    │
│   │  ┌──────────────────────────────────────────────────┐ │    │
│   │  │ 2. Paragraph Break (\n\n)                        │ │    │
│   │  │    - Semantic boundary                           │ │    │
│   │  │    - Must be >30% into chunk                     │ │    │
│   │  └─────────────────────┬────────────────────────────┘ │    │
│   │                        │ not found                     │    │
│   │                        ▼                               │    │
│   │  ┌──────────────────────────────────────────────────┐ │    │
│   │  │ 3. Sentence Boundary (". ")                      │ │    │
│   │  │    - Logical break point                         │ │    │
│   │  │    - Must be >30% into chunk                     │ │    │
│   │  └─────────────────────┬────────────────────────────┘ │    │
│   │                        │ not found                     │    │
│   │                        ▼                               │    │
│   │  ┌──────────────────────────────────────────────────┐ │    │
│   │  │ 4. Hard Cut at chunk_size                        │ │    │
│   │  │    - Last resort only                            │ │    │
│   │  └──────────────────────────────────────────────────┘ │    │
│   └────────────────────────────────────────────────────────┘    │
│                 │                                                │
│                 ▼                                                │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ POST-PROCESS: Combine small chunks                     │    │
│   │ - If chunk < 200 chars, merge with next                │    │
│   │ - Prevents fragmentation                               │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```python
def smart_chunk_text(self, text: str, chunk_size: int = 600) -> list[str]:
    """
    Split text into chunks intelligently, preserving context.

    Args:
        text: Text to chunk
        chunk_size: Maximum chunk size (default: 600, optimized for 256-token limit)

    Returns:
        List of text chunks
    """
    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = start + chunk_size

        # If we're at the end, take what's left
        if end >= text_length:
            chunk = text[start:].strip()
            if chunk:
                chunks.append(chunk)
            break

        chunk = text[start:end]

        # Priority 1: Code block boundary
        code_block_pos = chunk.rfind("```")
        if code_block_pos != -1 and code_block_pos > chunk_size * 0.3:
            end = start + code_block_pos

        # Priority 2: Paragraph break
        elif "\n\n" in chunk:
            last_break = chunk.rfind("\n\n")
            if last_break > chunk_size * 0.3:
                end = start + last_break

        # Priority 3: Sentence break
        elif ". " in chunk:
            last_period = chunk.rfind(". ")
            if last_period > chunk_size * 0.3:
                end = start + last_period + 1

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end

    # Combine small chunks (<200 chars)
    if chunks:
        combined_chunks = []
        i = 0
        while i < len(chunks):
            current = chunks[i]
            while len(current) < 200 and i + 1 < len(chunks):
                i += 1
                current = current + "\n\n" + chunks[i]
            combined_chunks.append(current)
            i += 1
        chunks = combined_chunks

    return chunks
```

### Async Version for Large Files

```python
async def smart_chunk_text_async(
    self, text: str, chunk_size: int = 600, progress_callback=None
) -> list[str]:
    """Async version with progress reporting."""

    # For large texts (>50KB), run in thread pool
    if len(text) > 50000:
        chunks = await self.threading_service.run_cpu_intensive(
            self.smart_chunk_text, text, chunk_size
        )
    else:
        chunks = self.smart_chunk_text(text, chunk_size)

    if progress_callback:
        await progress_callback("Text chunking completed", 100)

    return chunks
```

---

## 2. Embedding Generation

**File**: `python/src/server/services/embeddings/embedding_service.py`

### Multi-Provider Architecture

Archon supports multiple embedding providers:

| Provider | Models | Default Dimensions |
|----------|--------|-------------------|
| OpenAI | text-embedding-3-small, text-embedding-3-large | 1536 |
| Google | text-embedding-004 | 768 |
| Local | Configurable | Varies |

### Dimension Support

```
┌─────────────────────────────────────────────────────────────────┐
│                   EMBEDDING DIMENSIONS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   768  ──► embedding_768  column  (Google, some local models)   │
│   1024 ──► embedding_1024 column  (Medium resolution)           │
│   1536 ──► embedding_1536 column  (OpenAI default)              │
│   3072 ──► embedding_3072 column  (OpenAI large)                │
│                                                                  │
│   Storage: Dynamic column selection based on model              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Batch Processing

```python
@dataclass
class EmbeddingBatchResult:
    """Result from batch embedding operation."""

    embeddings: list[list[float]]      # Successful embeddings
    failed_items: list[dict]           # Detailed failure info
    success_count: int
    failure_count: int
    texts_processed: list[str]         # Only successful texts

async def create_embeddings_batch(
    self,
    texts: list[str],
    progress_callback: Callable = None,
    batch_size: int = 100
) -> EmbeddingBatchResult:
    """
    Generate embeddings in batches.

    Features:
    - Rate limiting with exponential backoff
    - Graceful error handling (skip, don't corrupt)
    - Progress tracking
    - Quota exhaustion detection
    """
    embeddings = []
    failed_items = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]

        try:
            batch_embeddings = await self._embed_batch(batch)
            embeddings.extend(batch_embeddings)
        except RateLimitError as e:
            # Retry with exponential backoff
            wait_time = self._extract_wait_time(str(e))
            await asyncio.sleep(wait_time)
            # Retry batch...
        except QuotaExhaustedError:
            # Stop immediately, return partial results
            break

        if progress_callback:
            progress = int((i + len(batch)) / len(texts) * 100)
            await progress_callback(f"Embedding: {i + len(batch)}/{len(texts)}", progress)

    return EmbeddingBatchResult(
        embeddings=embeddings,
        failed_items=failed_items,
        success_count=len(embeddings),
        failure_count=len(failed_items),
        texts_processed=[t for t in texts if t not in [f['text'] for f in failed_items]]
    )
```

---

## 3. Contextual Embeddings (Optional)

**File**: `python/src/server/services/embeddings/contextual_embedding_service.py`

### Purpose

Contextual embeddings improve retrieval by situating chunks within document context. The LLM adds relevant context to each chunk before embedding.

```
┌─────────────────────────────────────────────────────────────────┐
│                  CONTEXTUAL EMBEDDING PROCESS                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Original Chunk:                                                │
│   "The `create_document` function accepts a title parameter"     │
│                                                                  │
│        │                                                         │
│        │ LLM adds context from document (first 5000 chars)       │
│        ▼                                                         │
│                                                                  │
│   Contextual Chunk:                                              │
│   "This chunk is from the DocumentAgent documentation section   │
│   describing the agent's tools for document management.         │
│   ---                                                           │
│   The `create_document` function accepts a title parameter"     │
│                                                                  │
│        │                                                         │
│        │ Better semantic understanding                           │
│        ▼                                                         │
│                                                                  │
│   Enhanced Vector Embedding                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```python
async def generate_contextual_embeddings_batch(
    self,
    full_documents: list[str],
    chunks: list[str]
) -> list[tuple[str, bool]]:
    """
    Generate contextual information for chunks.

    Args:
        full_documents: Full document text (first 5000 chars used)
        chunks: Individual chunks to contextualize

    Returns:
        List of (contextual_chunk, success) tuples
    """
    results = []

    for doc, chunk in zip(full_documents, chunks):
        context = await self._generate_context(doc[:5000], chunk)
        contextual_chunk = f"{context}\n---\n{chunk}"
        results.append((contextual_chunk, True))

    return results
```

### Configuration

Enable via credential settings:
- `USE_CONTEXTUAL_EMBEDDINGS=true`
- `CONTEXTUAL_BATCH_SIZE=10`

---

## 4. Vector Storage (Supabase + pgvector)

### Table Structure

```sql
CREATE TABLE archon_crawled_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    chunk_number INTEGER,
    content TEXT,
    metadata JSONB,

    -- Multi-dimensional vector columns
    embedding_768 VECTOR(768),
    embedding_1024 VECTOR(1024),
    embedding_1536 VECTOR(1536),
    embedding_3072 VECTOR(3072),

    -- Track which dimension was used
    embedding_dimension INTEGER,
    embedding_model TEXT,
    llm_chat_model TEXT,

    -- Full-text search (auto-generated)
    content_search_vector TSVECTOR GENERATED ALWAYS AS
        (to_tsvector('english', content)) STORED,

    -- Relationships
    source_id UUID REFERENCES archon_sources(id),
    page_id UUID,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vector similarity search index
CREATE INDEX idx_crawled_pages_embedding_1536
    ON archon_crawled_pages
    USING ivfflat (embedding_1536 vector_cosine_ops)
    WITH (lists = 100);

-- Full-text search indexes
CREATE INDEX idx_crawled_pages_content_search
    ON archon_crawled_pages
    USING GIN (content_search_vector);

-- Trigram index for fuzzy matching
CREATE INDEX idx_crawled_pages_content_trgm
    ON archon_crawled_pages
    USING GIN (content gin_trgm_ops);
```

### Batch Insert Pattern

```python
async def store_chunks_with_embeddings(
    self,
    url: str,
    chunks: list[str],
    embeddings: list[list[float]],
    source_id: str,
    page_id: str
) -> dict:
    """Store chunks with their embeddings."""

    batch_data = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        metadata = self.extract_metadata(chunk)

        batch_data.append({
            "url": url,
            "chunk_number": i,
            "content": chunk,
            "metadata": metadata,
            "embedding_1536": embedding,  # Dynamic column
            "embedding_dimension": 1536,
            "embedding_model": "text-embedding-3-small",
            "source_id": source_id,
            "page_id": page_id,
        })

    # Batch insert with retry
    result = await self.supabase_client.table("archon_crawled_pages") \
        .insert(batch_data) \
        .execute()

    return {"success": True, "chunks_stored": len(batch_data)}
```

---

## 5. Hybrid Search Strategy

**File**: `python/src/server/services/search/hybrid_search_strategy.py`

### Overview

Hybrid search combines **vector similarity** with **full-text search** for optimal retrieval:

```
┌─────────────────────────────────────────────────────────────────┐
│                     HYBRID SEARCH FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Query: "How does authentication work?"                         │
│        │                                                         │
│        ├──────────────────────┬──────────────────────┐          │
│        │                      │                      │          │
│        ▼                      ▼                      │          │
│   ┌──────────────┐    ┌──────────────┐              │          │
│   │ VECTOR SEARCH│    │  TEXT SEARCH │              │          │
│   │              │    │              │              │          │
│   │ 1. Embed     │    │ 1. Parse     │              │          │
│   │    query     │    │    query     │              │          │
│   │              │    │              │              │          │
│   │ 2. Cosine    │    │ 2. tsvector  │              │          │
│   │    distance  │    │    match     │              │          │
│   │              │    │              │              │          │
│   │ 3. Top-K     │    │ 3. ts_rank   │              │          │
│   │    results   │    │    scoring   │              │          │
│   └──────┬───────┘    └──────┬───────┘              │          │
│          │                   │                       │          │
│          └─────────┬─────────┘                       │          │
│                    │                                 │          │
│                    ▼                                 │          │
│   ┌────────────────────────────────────────────────┐│          │
│   │ MERGE & CLASSIFY                               ││          │
│   │                                                ││          │
│   │ match_type: "hybrid"  ─── Found in BOTH       ││          │
│   │ match_type: "vector"  ─── Vector only         ││          │
│   │ match_type: "keyword" ─── Text only           ││          │
│   │                                                ││          │
│   │ Final score = weighted combination            ││          │
│   └────────────────────────────────────────────────┘│          │
│                    │                                 │          │
│                    ▼                                 │          │
│   ┌────────────────────────────────────────────────┐│          │
│   │ RANKED RESULTS                                 ││          │
│   │                                                ││          │
│   │ [1] {content: "...", score: 0.92, type: hybrid}│          │
│   │ [2] {content: "...", score: 0.85, type: vector}│          │
│   │ [3] {content: "...", score: 0.78, type: keyword│          │
│   └────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### RPC Function

```sql
-- Hybrid search function (PostgreSQL)
CREATE OR REPLACE FUNCTION hybrid_search_archon_crawled_pages(
    query_embedding VECTOR(1536),
    query_text TEXT,
    match_count INTEGER DEFAULT 5,
    source_filter TEXT DEFAULT NULL,
    similarity_threshold FLOAT DEFAULT 0.05
)
RETURNS TABLE (
    id UUID,
    url TEXT,
    chunk_number INTEGER,
    content TEXT,
    metadata JSONB,
    similarity_score FLOAT,
    text_rank FLOAT,
    match_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT
            cp.id,
            1 - (cp.embedding_1536 <=> query_embedding) AS similarity
        FROM archon_crawled_pages cp
        WHERE 1 - (cp.embedding_1536 <=> query_embedding) > similarity_threshold
        ORDER BY similarity DESC
        LIMIT match_count * 2
    ),
    text_results AS (
        SELECT
            cp.id,
            ts_rank_cd(cp.content_search_vector, plainto_tsquery('english', query_text)) AS rank
        FROM archon_crawled_pages cp
        WHERE cp.content_search_vector @@ plainto_tsquery('english', query_text)
        ORDER BY rank DESC
        LIMIT match_count * 2
    )
    SELECT
        cp.id,
        cp.url,
        cp.chunk_number,
        cp.content,
        cp.metadata,
        COALESCE(v.similarity, 0.0) AS similarity_score,
        COALESCE(t.rank, 0.0) AS text_rank,
        CASE
            WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN 'hybrid'
            WHEN v.id IS NOT NULL THEN 'vector'
            ELSE 'keyword'
        END AS match_type
    FROM archon_crawled_pages cp
    LEFT JOIN vector_results v ON cp.id = v.id
    LEFT JOIN text_results t ON cp.id = t.id
    WHERE v.id IS NOT NULL OR t.id IS NOT NULL
    ORDER BY (COALESCE(v.similarity, 0) * 0.7 + COALESCE(t.rank, 0) * 0.3) DESC
    LIMIT match_count;
END;
$$;
```

---

## 6. RAG Service Orchestration

**File**: `python/src/server/services/search/rag_service.py`

### Strategy Stack

RAG service uses a composable strategy pattern:

| Strategy | Purpose | Configuration |
|----------|---------|---------------|
| Base Vector Search | Pure semantic search | Always enabled |
| Hybrid Search | Vector + full-text | `USE_HYBRID_SEARCH=true` |
| Reranking | CrossEncoder result reranking | `USE_RERANKING=true` |
| Agentic RAG | Enhanced code search | `USE_AGENTIC_RAG=true` |

### Search Flow

```python
async def search_documents(
    self,
    query: str,
    source_filter: str = None,
    match_count: int = 5
) -> list[dict]:
    """
    Search documents with configurable strategy stack.

    Returns:
        List of search results with scores and metadata
    """
    # 1. Generate query embedding
    query_embedding = await self.embedding_service.embed_query(query)

    # 2. Select search strategy
    if self.use_hybrid_search:
        results = await self.hybrid_strategy.search(
            query_embedding, query, match_count, source_filter
        )
    else:
        results = await self.base_strategy.search(
            query_embedding, match_count, source_filter
        )

    # 3. Optional reranking
    if self.use_reranking and results:
        results = await self.reranker.rerank(query, results)

    # 4. Group by page (aggregate chunk scores)
    grouped_results = self._group_by_page(results)

    return grouped_results
```

### Page Grouping

Multiple chunks from the same page are aggregated:

```python
def _group_by_page(self, results: list[dict]) -> list[dict]:
    """Group chunks by page_id and aggregate scores."""

    page_groups = {}
    for result in results:
        page_id = result.get("page_id")
        if page_id not in page_groups:
            page_groups[page_id] = {
                "url": result["url"],
                "chunks": [],
                "total_score": 0,
                "match_count": 0
            }
        page_groups[page_id]["chunks"].append(result)
        page_groups[page_id]["total_score"] += result["similarity_score"]
        page_groups[page_id]["match_count"] += 1

    # Boost score for pages with multiple matching chunks
    for page in page_groups.values():
        if page["match_count"] > 1:
            page["total_score"] *= (1 + 0.1 * page["match_count"])

    return sorted(page_groups.values(), key=lambda x: x["total_score"], reverse=True)
```

---

## Search Result Structure

```python
{
    "id": "chunk-uuid",
    "url": "https://docs.example.com/authentication",
    "chunk_number": 3,
    "content": "The authentication system uses JWT tokens...",
    "metadata": {
        "headers": "# Authentication",
        "word_count": 150,
        "has_code": true,
        "has_links": false
    },
    "similarity_score": 0.87,
    "text_rank": 0.45,
    "match_type": "hybrid",
    "embedding_dimension": 1536,
    "embedding_model": "text-embedding-3-small",
    "llm_chat_model": "gpt-4o-mini"
}
```

---

## Configuration Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `CHUNK_SIZE` | 600 | Characters per chunk |
| `EMBEDDING_MODEL` | text-embedding-3-small | OpenAI embedding model |
| `EMBEDDING_DIMENSION` | 1536 | Vector dimensions |
| `USE_HYBRID_SEARCH` | true | Enable hybrid search |
| `USE_RERANKING` | false | Enable CrossEncoder reranking |
| `USE_CONTEXTUAL_EMBEDDINGS` | false | Enable contextual enhancement |
| `SIMILARITY_THRESHOLD` | 0.05 | Minimum similarity score |
| `MATCH_COUNT` | 5 | Default results to return |

---

## Key Code References

| File | Purpose |
|------|---------|
| `python/src/server/services/storage/base_storage_service.py:39-120` | Chunking algorithm |
| `python/src/server/services/embeddings/embedding_service.py` | Multi-provider embeddings |
| `python/src/server/services/embeddings/contextual_embedding_service.py` | Contextual enhancement |
| `python/src/server/services/search/rag_service.py` | RAG orchestration |
| `python/src/server/services/search/hybrid_search_strategy.py` | Hybrid search |
| `python/src/server/services/search/base_search_strategy.py` | Base vector search |
| `migration/0.1.0/002_add_hybrid_search_tsvector.sql` | Database schema |

---

## Next Steps

- [04 - Crawling Pipeline](./04-crawling-pipeline.md) - Document ingestion strategies
- [05 - Function Reference](./05-function-reference.md) - Detailed function signatures
