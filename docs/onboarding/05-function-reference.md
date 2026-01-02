# 05 - Function Reference

This document provides a quick reference to key functions in Archon, organized by category.

---

## 1. Chunking Functions

**File**: `python/src/server/services/storage/base_storage_service.py`

### smart_chunk_text

```python
def smart_chunk_text(
    self,
    text: str,
    chunk_size: int = 600
) -> list[str]:
    """
    Split text into chunks intelligently, preserving context.

    Break hierarchy:
    1. Code blocks (```)
    2. Paragraph breaks (\\n\\n)
    3. Sentence breaks (". ")
    4. Hard cut (last resort)

    Post-processing: Combines chunks <200 chars.

    Args:
        text: Text to chunk
        chunk_size: Maximum chunk size (default: 600)

    Returns:
        List of text chunks
    """
```

**Location**: Lines 39-120

---

### smart_chunk_text_async

```python
async def smart_chunk_text_async(
    self,
    text: str,
    chunk_size: int = 600,
    progress_callback: Callable | None = None
) -> list[str]:
    """
    Async version with progress reporting.

    For texts >50KB, runs in thread pool.

    Args:
        text: Text to chunk
        chunk_size: Maximum chunk size (default: 600)
        progress_callback: Optional callback(message, percent)

    Returns:
        List of text chunks
    """
```

**Location**: Lines 122-164

---

### extract_metadata

```python
def extract_metadata(
    self,
    chunk: str,
    base_metadata: dict[str, Any] | None = None
) -> dict[str, Any]:
    """
    Extract metadata from a text chunk.

    Returns:
        {
            "headers": str,        # Markdown headers found
            "char_count": int,
            "word_count": int,
            "line_count": int,
            "has_code": bool,      # Contains ```
            "has_links": bool      # Contains http:// or www.
        }
    """
```

**Location**: Lines 166-197

---

## 2. Embedding Functions

**File**: `python/src/server/services/embeddings/embedding_service.py`

### create_embeddings_batch

```python
async def create_embeddings_batch(
    self,
    texts: list[str],
    progress_callback: Callable | None = None,
    batch_size: int = 100
) -> EmbeddingBatchResult:
    """
    Generate embeddings in batches with rate limiting.

    Features:
    - Multi-provider support (OpenAI, Google, local)
    - Rate limiting with exponential backoff
    - Failed items tracked separately

    Args:
        texts: Texts to embed
        progress_callback: Optional callback(message, percent)
        batch_size: Texts per batch (default: 100)

    Returns:
        EmbeddingBatchResult:
            embeddings: list[list[float]]
            failed_items: list[dict]
            success_count: int
            failure_count: int
            texts_processed: list[str]
    """
```

---

### embed_query

```python
async def embed_query(
    self,
    query: str
) -> list[float]:
    """
    Embed a single query string.

    Args:
        query: Text to embed

    Returns:
        Vector embedding (1536 dimensions by default)
    """
```

---

**File**: `python/src/server/services/embeddings/contextual_embedding_service.py`

### generate_contextual_embeddings_batch

```python
async def generate_contextual_embeddings_batch(
    self,
    full_documents: list[str],
    chunks: list[str]
) -> list[tuple[str, bool]]:
    """
    Add document context to chunks before embedding.

    Uses first 5000 chars of document as context.
    Output format: "{context}\\n---\\n{chunk}"

    Args:
        full_documents: Full document texts
        chunks: Individual chunks to contextualize

    Returns:
        List of (contextual_chunk, success) tuples
    """
```

---

## 3. Search Functions

**File**: `python/src/server/services/search/rag_service.py`

### search_documents

```python
async def search_documents(
    self,
    query: str,
    source_filter: str | None = None,
    match_count: int = 5
) -> list[dict]:
    """
    Search documents using configurable strategy stack.

    Strategies (configurable):
    - Base vector search (always)
    - Hybrid search (vector + full-text)
    - Reranking (CrossEncoder)

    Args:
        query: Search query
        source_filter: Optional source ID filter
        match_count: Number of results (default: 5)

    Returns:
        List of results:
        [
            {
                "id": str,
                "url": str,
                "chunk_number": int,
                "content": str,
                "metadata": dict,
                "similarity_score": float,
                "match_type": "hybrid" | "vector" | "keyword"
            }
        ]
    """
```

---

### search_code_examples

```python
async def search_code_examples(
    self,
    query: str,
    source_filter: str | None = None,
    match_count: int = 5
) -> list[dict]:
    """
    Search code examples specifically.

    Searches archon_code_examples table.

    Args:
        query: Code search query
        source_filter: Optional source ID filter
        match_count: Number of results

    Returns:
        List of code examples with summaries
    """
```

---

**File**: `python/src/server/services/search/hybrid_search_strategy.py`

### hybrid_search (RPC)

```sql
-- PostgreSQL function called via Supabase RPC
hybrid_search_archon_crawled_pages(
    query_embedding VECTOR(1536),
    query_text TEXT,
    match_count INTEGER DEFAULT 5,
    source_filter TEXT DEFAULT NULL,
    similarity_threshold FLOAT DEFAULT 0.05
) -> TABLE (
    id UUID,
    url TEXT,
    chunk_number INTEGER,
    content TEXT,
    metadata JSONB,
    similarity_score FLOAT,
    text_rank FLOAT,
    match_type TEXT  -- 'hybrid', 'vector', or 'keyword'
)
```

---

## 4. Agent Functions

**File**: `python/src/agents/base_agent.py`

### BaseAgent.run

```python
async def run(
    self,
    user_prompt: str,
    deps: DepsT
) -> OutputT:
    """
    Run the agent with rate limiting protection.

    Features:
    - Automatic rate limit retry
    - 2-minute timeout
    - Structured output

    Args:
        user_prompt: The user's input
        deps: Dependencies (project_id, user_id, etc.)

    Returns:
        Structured output (DocumentOperation or RagQueryResult)
    """
```

**Location**: Lines 188-206

---

### BaseAgent.run_stream

```python
def run_stream(
    self,
    user_prompt: str,
    deps: DepsT
) -> AsyncContextManager:
    """
    Run the agent with streaming output.

    Usage:
        async with agent.run_stream(prompt, deps) as stream:
            async for chunk in stream.stream_text():
                print(chunk)

    Note: Rate limiting not supported for streaming.
    """
```

**Location**: Lines 226-241

---

### RateLimitHandler.execute_with_rate_limit

```python
async def execute_with_rate_limit(
    self,
    func: Callable,
    *args,
    progress_callback: Callable | None = None,
    **kwargs
) -> Any:
    """
    Execute function with rate limiting protection.

    Features:
    - Exponential backoff (base_delay * 2^(retry-1))
    - Extract wait time from OpenAI error messages
    - Max 5 retries by default

    Args:
        func: Async function to execute
        *args: Function arguments
        progress_callback: Optional callback for retry updates
        **kwargs: Function keyword arguments

    Raises:
        Exception: After max retries exceeded
    """
```

**Location**: Lines 52-125

---

## 5. Agent Tool Functions

**File**: `python/src/agents/document_agent.py`

### DocumentAgent Tools

| Tool | Signature | Purpose |
|------|-----------|---------|
| `list_documents` | `(ctx: RunContext[DocumentDependencies]) -> str` | List all project documents |
| `get_document` | `(ctx, document_title: str) -> str` | Get document by title |
| `create_document` | `(ctx, title: str, document_type: str, content_description: str) -> str` | Create new document |
| `update_document` | `(ctx, document_title: str, section_to_update: str, new_content: str, update_description: str) -> str` | Update document section |
| `create_feature_plan` | `(ctx, feature_name: str, feature_description: str, user_stories: str) -> str` | Generate React Flow diagram |
| `create_erd` | `(ctx, system_name: str, entity_descriptions: str, relationships_description: str) -> str` | Create ERD with SQL schema |
| `request_approval` | `(ctx, document_title: str, change_summary: str, change_type: str) -> str` | Request approval for changes |

---

**File**: `python/src/agents/rag_agent.py`

### RagAgent Tools

| Tool | Signature | Purpose |
|------|-----------|---------|
| `search_documents` | `(ctx: RunContext[RagDependencies], query: str, source_filter: str = None) -> str` | Semantic search |
| `list_available_sources` | `(ctx) -> str` | List searchable sources |
| `search_code_examples` | `(ctx, query: str, source_filter: str = None) -> str` | Find code snippets |
| `refine_search_query` | `(ctx, original_query: str, context: str) -> str` | Query expansion |

---

## 6. MCP Client Functions

**File**: `python/src/agents/mcp_client.py`

### MCPClient.call_tool

```python
async def call_tool(
    self,
    tool_name: str,
    **kwargs
) -> dict:
    """
    Call an MCP tool via HTTP JSON-RPC.

    Args:
        tool_name: Name of MCP tool
        **kwargs: Tool parameters

    Returns:
        Tool result as dict
    """
```

---

### Convenience Methods

```python
async def perform_rag_query(query: str, **kwargs) -> dict
async def search_code_examples(query: str, **kwargs) -> dict
async def manage_document(action: str, **kwargs) -> str
async def manage_project(action: str, **kwargs) -> str
async def manage_task(action: str, **kwargs) -> str
```

---

## 7. Crawling Functions

**File**: `python/src/server/services/crawling/crawling_service.py`

### CrawlingService.crawl_and_store

```python
async def crawl_and_store(
    self,
    url: str | list[str],
    source_id: str,
    crawl_type: str = "single",
    progress_callback: Callable | None = None,
    **kwargs
) -> dict:
    """
    Crawl URLs and store in knowledge base.

    Args:
        url: URL(s) to crawl
        source_id: Source identifier
        crawl_type: "single", "batch", "recursive", "sitemap"
        progress_callback: Optional callback(message, percent)
        **kwargs: Strategy-specific options

    Returns:
        {
            "pages_crawled": int,
            "chunks_stored": int,
            "success": bool
        }
    """
```

---

**File**: `python/src/server/services/crawling/document_storage_operations.py`

### DocumentStorageOperations.store_crawl_results

```python
async def store_crawl_results(
    self,
    crawl_results: list[CrawlResult],
    source_id: str,
    progress_callback: Callable | None = None
) -> dict:
    """
    Process and store crawled documents.

    Pipeline:
    1. Chunk content
    2. Extract metadata
    3. Generate embeddings
    4. Batch insert
    5. Extract code examples

    Returns:
        {
            "total_chunks": int,
            "pages_processed": int
        }
    """
```

---

## 8. Workflow Functions

**File**: `python/src/agent_work_orders/workflow_engine/orchestrator.py`

### WorkflowOrchestrator.execute_workflow

```python
async def execute_workflow(
    self,
    work_order_id: str,
    user_request: str,
    github_issue_number: str | None = None,
    progress_callback: Callable | None = None
) -> WorkflowResult:
    """
    Execute 6-step agent workflow.

    Steps:
    1. CREATE-BRANCH
    2. PLANNING
    3. EXECUTE
    4. COMMIT
    5. CREATE-PR
    6. REVIEW

    Args:
        work_order_id: Unique workflow ID
        user_request: User's implementation request
        github_issue_number: Optional linked issue
        progress_callback: SSE progress updates

    Returns:
        WorkflowResult with step history
    """
```

---

## Quick Lookup Table

| Category | Function | File |
|----------|----------|------|
| **Chunking** | `smart_chunk_text` | `base_storage_service.py:39` |
| **Chunking** | `smart_chunk_text_async` | `base_storage_service.py:122` |
| **Chunking** | `extract_metadata` | `base_storage_service.py:166` |
| **Embedding** | `create_embeddings_batch` | `embedding_service.py` |
| **Embedding** | `embed_query` | `embedding_service.py` |
| **Embedding** | `generate_contextual_embeddings_batch` | `contextual_embedding_service.py` |
| **Search** | `search_documents` | `rag_service.py` |
| **Search** | `search_code_examples` | `rag_service.py` |
| **Search** | `hybrid_search_archon_crawled_pages` | RPC function |
| **Agent** | `BaseAgent.run` | `base_agent.py:188` |
| **Agent** | `BaseAgent.run_stream` | `base_agent.py:226` |
| **Agent** | `RateLimitHandler.execute_with_rate_limit` | `base_agent.py:52` |
| **MCP** | `MCPClient.call_tool` | `mcp_client.py` |
| **Crawl** | `CrawlingService.crawl_and_store` | `crawling_service.py` |
| **Crawl** | `DocumentStorageOperations.store_crawl_results` | `document_storage_operations.py` |
| **Workflow** | `WorkflowOrchestrator.execute_workflow` | `orchestrator.py` |

---

## Next Steps

- [06 - Workflow Engine](./06-workflow-engine.md) - Agent work orders deep dive
- [02 - Pydantic Agents](./02-pydantic-agents.md) - Agent implementation details
