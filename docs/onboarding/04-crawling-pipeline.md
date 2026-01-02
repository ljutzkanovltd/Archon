# 04 - Crawling Pipeline

This document explains how Archon crawls, processes, and ingests documents into the knowledge base.

---

## Overview

The crawling pipeline transforms URLs into searchable knowledge:

```
┌─────────────────────────────────────────────────────────────────┐
│                   DOCUMENT INGESTION PIPELINE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   URL(s) Input                                                   │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │              CRAWLING STRATEGY SELECTION               │    │
│   │                                                        │    │
│   │  Single URL ─────────► SinglePageCrawlStrategy         │    │
│   │  Multiple URLs ──────► BatchCrawlStrategy              │    │
│   │  Follow links ───────► RecursiveCrawlStrategy          │    │
│   │  Sitemap.xml ────────► SitemapCrawlStrategy            │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │                   CRAWL4AI CRAWLER                     │    │
│   │                                                        │    │
│   │  - Headless browser rendering                          │    │
│   │  - JavaScript execution                                │    │
│   │  - HTML extraction                                     │    │
│   │  - Markdown conversion                                 │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │              DOCUMENT STORAGE OPERATIONS               │    │
│   │                                                        │    │
│   │  1. smart_chunk_text_async()  ─── 600-char chunks      │    │
│   │  2. extract_metadata()        ─── Headers, word count  │    │
│   │  3. create_embeddings_batch() ─── Vector embeddings    │    │
│   │  4. Batch insert to Supabase  ─── pgvector storage     │    │
│   │  5. Extract code examples     ─── (Optional)           │    │
│   │  6. Update source info        ─── Tags, summary        │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │                    PROGRESS TRACKING                   │    │
│   │                                                        │    │
│   │  - Real-time progress callbacks                        │    │
│   │  - Cancellation support                                │    │
│   │  - Error handling with retry                           │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Crawling Strategies

**File**: `python/src/server/services/crawling/`

### Strategy Pattern

Each crawling strategy implements a common interface:

```python
class CrawlStrategy(ABC):
    """Base class for crawling strategies."""

    @abstractmethod
    async def crawl(
        self,
        url: str | list[str],
        progress_callback: Callable = None,
        **kwargs
    ) -> CrawlResult:
        """Execute the crawl operation."""
        pass
```

### 1. SinglePageCrawlStrategy

**Purpose**: Crawl a single URL

**Use Case**: Direct URL input, specific page crawling

```python
class SinglePageCrawlStrategy(CrawlStrategy):
    """Crawl a single page."""

    async def crawl(self, url: str, progress_callback=None) -> CrawlResult:
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(
                url=url,
                bypass_cache=True,
                word_count_threshold=10,
                excluded_tags=['nav', 'footer', 'header'],
                remove_overlay_elements=True,
            )

            return CrawlResult(
                url=url,
                markdown=result.markdown,
                html=result.html,
                success=result.success,
                metadata=result.metadata
            )
```

### 2. BatchCrawlStrategy

**Purpose**: Crawl multiple URLs in parallel with controlled concurrency

**Use Case**: Documentation sites, multiple specific pages

```python
class BatchCrawlStrategy(CrawlStrategy):
    """Crawl multiple pages in parallel."""

    def __init__(self, max_concurrent: int = 5):
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def crawl(self, urls: list[str], progress_callback=None) -> list[CrawlResult]:
        results = []
        total = len(urls)

        async def crawl_one(url: str, index: int):
            async with self.semaphore:
                result = await self.single_page_strategy.crawl(url)
                if progress_callback:
                    await progress_callback(
                        f"Crawled {index + 1}/{total}: {url}",
                        int((index + 1) / total * 100)
                    )
                return result

        tasks = [crawl_one(url, i) for i, url in enumerate(urls)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        return [r for r in results if isinstance(r, CrawlResult)]
```

### 3. RecursiveCrawlStrategy

**Purpose**: Crawl a page and follow internal links up to a max depth

**Use Case**: Entire documentation sites, wikis

```python
class RecursiveCrawlStrategy(CrawlStrategy):
    """Crawl pages recursively following links."""

    def __init__(self, max_depth: int = 3, max_pages: int = 100):
        self.max_depth = max_depth
        self.max_pages = max_pages

    async def crawl(
        self,
        start_url: str,
        progress_callback=None,
        domain_constraint: bool = True
    ) -> list[CrawlResult]:
        visited = set()
        to_visit = [(start_url, 0)]  # (url, depth)
        results = []

        while to_visit and len(results) < self.max_pages:
            url, depth = to_visit.pop(0)

            if url in visited or depth > self.max_depth:
                continue

            visited.add(url)

            result = await self.single_page_strategy.crawl(url)
            results.append(result)

            # Extract and filter links
            if depth < self.max_depth:
                links = self._extract_links(result.html, url)
                if domain_constraint:
                    links = self._filter_same_domain(links, start_url)
                to_visit.extend((link, depth + 1) for link in links)

            if progress_callback:
                await progress_callback(
                    f"Crawled {len(results)} pages (depth {depth})",
                    min(int(len(results) / self.max_pages * 100), 99)
                )

        return results
```

### 4. SitemapCrawlStrategy

**Purpose**: Extract URLs from sitemap.xml and crawl them

**Use Case**: Well-structured sites with sitemaps

```python
class SitemapCrawlStrategy(CrawlStrategy):
    """Crawl pages listed in sitemap.xml."""

    async def crawl(self, sitemap_url: str, progress_callback=None) -> list[CrawlResult]:
        # Fetch and parse sitemap
        urls = await self._parse_sitemap(sitemap_url)

        if progress_callback:
            await progress_callback(f"Found {len(urls)} URLs in sitemap", 5)

        # Use batch strategy for actual crawling
        return await self.batch_strategy.crawl(urls, progress_callback)

    async def _parse_sitemap(self, sitemap_url: str) -> list[str]:
        """Parse sitemap.xml and extract URLs."""
        async with aiohttp.ClientSession() as session:
            async with session.get(sitemap_url) as response:
                xml_content = await response.text()

        # Parse XML
        root = ET.fromstring(xml_content)
        namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}

        urls = []
        for url_elem in root.findall('.//ns:url/ns:loc', namespace):
            urls.append(url_elem.text)

        return urls
```

---

## CrawlingService Orchestrator

**File**: `python/src/server/services/crawling/crawling_service.py`

The main service coordinates crawling and storage:

```python
class CrawlingService:
    """Main orchestrator for crawling operations."""

    def __init__(self):
        self.single_page_strategy = SinglePageCrawlStrategy()
        self.batch_strategy = BatchCrawlStrategy()
        self.recursive_strategy = RecursiveCrawlStrategy()
        self.sitemap_strategy = SitemapCrawlStrategy()
        self.storage_ops = DocumentStorageOperations()

    async def crawl_and_store(
        self,
        url: str | list[str],
        source_id: str,
        crawl_type: str = "single",
        progress_callback: Callable = None,
        **kwargs
    ) -> dict:
        """
        Crawl URLs and store in knowledge base.

        Args:
            url: URL(s) to crawl
            source_id: Source identifier for grouping
            crawl_type: "single", "batch", "recursive", "sitemap"
            progress_callback: Optional progress updates

        Returns:
            Summary of crawl operation
        """
        # Select strategy
        strategy = self._select_strategy(crawl_type)

        # Phase 1: Crawl
        if progress_callback:
            await progress_callback("Starting crawl...", 0)

        crawl_results = await strategy.crawl(url, progress_callback, **kwargs)

        # Phase 2: Process and store
        if progress_callback:
            await progress_callback("Processing documents...", 50)

        storage_results = await self.storage_ops.store_crawl_results(
            crawl_results,
            source_id,
            progress_callback
        )

        return {
            "pages_crawled": len(crawl_results),
            "chunks_stored": storage_results["total_chunks"],
            "success": True
        }
```

---

## Document Storage Operations

**File**: `python/src/server/services/crawling/document_storage_operations.py`

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│               DOCUMENT STORAGE PIPELINE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   CrawlResult (markdown content)                                 │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ 1. CHUNKING                                            │    │
│   │                                                        │    │
│   │    chunks = await storage_service.smart_chunk_text_async(    │
│   │        markdown_content,                               │    │
│   │        chunk_size=600                                  │    │
│   │    )                                                   │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ 2. METADATA EXTRACTION                                 │    │
│   │                                                        │    │
│   │    For each chunk:                                     │    │
│   │    - Headers (markdown ## headers)                     │    │
│   │    - Word count                                        │    │
│   │    - Character count                                   │    │
│   │    - has_code (``` detection)                          │    │
│   │    - has_links (http:// detection)                     │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ 3. CONTEXTUAL EMBEDDING (Optional)                     │    │
│   │                                                        │    │
│   │    If USE_CONTEXTUAL_EMBEDDINGS=true:                  │    │
│   │    contextual_chunks = await generate_contextual_      │    │
│   │        embeddings_batch(full_doc, chunks)              │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ 4. EMBEDDING GENERATION                                │    │
│   │                                                        │    │
│   │    result = await embedding_service.create_embeddings_ │    │
│   │        batch(chunks, progress_callback)                │    │
│   │                                                        │    │
│   │    - Batch size: 100                                   │    │
│   │    - Rate limiting with retry                          │    │
│   │    - Failed items tracked separately                   │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ 5. BATCH INSERT TO SUPABASE                            │    │
│   │                                                        │    │
│   │    batch_data = []                                     │    │
│   │    for i, (chunk, embedding) in enumerate(zip(...)):   │    │
│   │        batch_data.append({                             │    │
│   │            "url": url,                                 │    │
│   │            "chunk_number": i,                          │    │
│   │            "content": chunk,                           │    │
│   │            "metadata": metadata,                       │    │
│   │            "embedding_1536": embedding,                │    │
│   │            "source_id": source_id,                     │    │
│   │            "page_id": page_id                          │    │
│   │        })                                              │    │
│   │                                                        │    │
│   │    await supabase.table("archon_crawled_pages")        │    │
│   │        .insert(batch_data).execute()                   │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ 6. CODE EXTRACTION (Optional)                          │    │
│   │                                                        │    │
│   │    If code blocks detected:                            │    │
│   │    - Extract ``` blocks                                │    │
│   │    - Generate summary with LLM                         │    │
│   │    - Store in archon_code_examples                     │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ 7. UPDATE SOURCE INFO                                  │    │
│   │                                                        │    │
│   │    await supabase.table("archon_sources")              │    │
│   │        .update({                                       │    │
│   │            "last_crawled": now,                        │    │
│   │            "page_count": len(results),                 │    │
│   │            "chunk_count": total_chunks,                │    │
│   │            "status": "completed"                       │    │
│   │        }).eq("id", source_id).execute()                │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```python
class DocumentStorageOperations:
    """Handles document storage after crawling."""

    def __init__(self):
        self.storage_service = BaseStorageService()
        self.embedding_service = EmbeddingService()
        self.contextual_service = ContextualEmbeddingService()

    async def store_crawl_results(
        self,
        crawl_results: list[CrawlResult],
        source_id: str,
        progress_callback: Callable = None
    ) -> dict:
        """Store crawled documents in knowledge base."""

        total_chunks = 0
        pages_processed = 0

        for result in crawl_results:
            if not result.success:
                continue

            page_id = str(uuid.uuid4())

            # 1. Chunk the content
            chunks = await self.storage_service.smart_chunk_text_async(
                result.markdown,
                chunk_size=600
            )

            # 2. Extract metadata for each chunk
            chunk_metadata = [
                self.storage_service.extract_metadata(chunk)
                for chunk in chunks
            ]

            # 3. Optional: Add contextual embeddings
            if self._use_contextual_embeddings():
                chunks = await self.contextual_service.generate_contextual_embeddings_batch(
                    [result.markdown] * len(chunks),
                    chunks
                )

            # 4. Generate embeddings
            embedding_result = await self.embedding_service.create_embeddings_batch(
                chunks,
                progress_callback=self._wrap_progress(progress_callback, pages_processed, len(crawl_results))
            )

            # 5. Batch insert
            batch_data = []
            for i, (chunk, embedding, metadata) in enumerate(
                zip(embedding_result.texts_processed, embedding_result.embeddings, chunk_metadata)
            ):
                batch_data.append({
                    "url": result.url,
                    "chunk_number": i,
                    "content": chunk,
                    "metadata": metadata,
                    "embedding_1536": embedding,
                    "embedding_dimension": 1536,
                    "embedding_model": "text-embedding-3-small",
                    "source_id": source_id,
                    "page_id": page_id
                })

            await self.supabase.table("archon_crawled_pages").insert(batch_data).execute()

            total_chunks += len(batch_data)
            pages_processed += 1

            # 6. Extract code examples if present
            if any(m.get("has_code") for m in chunk_metadata):
                await self._extract_code_examples(result, source_id, page_id)

        # 7. Update source info
        await self._update_source_info(source_id, pages_processed, total_chunks)

        return {
            "total_chunks": total_chunks,
            "pages_processed": pages_processed
        }
```

---

## Code Extraction Service

**File**: `python/src/server/services/crawling/code_extraction_service.py`

### Purpose

Extracts code blocks from documents and stores them separately with LLM-generated summaries.

```python
class CodeExtractionService:
    """Extract and store code examples from documents."""

    async def extract_and_store(
        self,
        markdown: str,
        url: str,
        source_id: str,
        page_id: str
    ) -> int:
        """Extract code blocks and store with summaries."""

        # Extract code blocks using regex
        code_blocks = re.findall(r'```(\w+)?\n(.*?)```', markdown, re.DOTALL)

        stored_count = 0
        for language, code in code_blocks:
            if len(code.strip()) < 10:  # Skip tiny snippets
                continue

            # Generate summary with LLM
            summary = await self._generate_summary(code, language or "unknown")

            # Generate embedding
            embedding = await self.embedding_service.embed_query(code)

            # Store in archon_code_examples
            await self.supabase.table("archon_code_examples").insert({
                "url": url,
                "content": code.strip(),
                "summary": summary,
                "language": language or "unknown",
                "embedding_1536": embedding,
                "source_id": source_id,
                "page_id": page_id
            }).execute()

            stored_count += 1

        return stored_count

    async def _generate_summary(self, code: str, language: str) -> str:
        """Generate a summary of the code using LLM."""
        prompt = f"""Summarize this {language} code in one sentence:

```{language}
{code[:1000]}  # Limit to 1000 chars
```

Summary:"""

        response = await self.llm_client.complete(prompt)
        return response.strip()
```

---

## Progress Tracking & Cancellation

### Progress Callback Pattern

```python
async def crawl_with_progress(url: str) -> dict:
    """Example of using progress callbacks."""

    async def progress_handler(message: str, percent: int):
        print(f"[{percent}%] {message}")
        # Or send via WebSocket, SSE, etc.

    result = await crawling_service.crawl_and_store(
        url=url,
        source_id="source-123",
        crawl_type="recursive",
        progress_callback=progress_handler,
        max_depth=2,
        max_pages=50
    )

    return result
```

### Cancellation Support

```python
class CancellableCrawl:
    """Wrapper for cancellable crawl operations."""

    def __init__(self):
        self.cancelled = False
        self.progress_id = str(uuid.uuid4())

    def cancel(self):
        self.cancelled = True

    async def run(self, url: str, source_id: str):
        async def check_cancelled(msg: str, pct: int):
            if self.cancelled:
                raise CrawlCancelledException("Crawl cancelled by user")

        try:
            return await crawling_service.crawl_and_store(
                url, source_id,
                progress_callback=check_cancelled
            )
        except CrawlCancelledException:
            await self._cleanup_partial_results(source_id)
            return {"cancelled": True}
```

---

## API Endpoints

**File**: `python/src/server/api_routes/knowledge_api.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/crawl/single` | POST | Crawl single URL |
| `/api/crawl/batch` | POST | Crawl multiple URLs |
| `/api/crawl/recursive` | POST | Recursive crawl |
| `/api/crawl/sitemap` | POST | Crawl from sitemap |
| `/api/crawl/progress/{id}` | GET | Check progress |
| `/api/crawl/cancel/{id}` | POST | Cancel crawl |

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_CONCURRENT_CRAWLS` | 5 | Parallel crawl limit |
| `MAX_RECURSIVE_DEPTH` | 3 | Maximum link depth |
| `MAX_PAGES_PER_CRAWL` | 100 | Page limit per operation |
| `CRAWL_TIMEOUT` | 30 | Seconds per page |
| `EXTRACT_CODE_EXAMPLES` | true | Enable code extraction |

---

## Key Code References

| File | Purpose |
|------|---------|
| `python/src/server/services/crawling/crawling_service.py` | Main orchestrator |
| `python/src/server/services/crawling/document_storage_operations.py` | Storage pipeline |
| `python/src/server/services/crawling/code_extraction_service.py` | Code extraction |
| `python/src/server/services/crawling/strategies/` | Crawl strategies |
| `python/src/server/api_routes/knowledge_api.py` | REST endpoints |

---

## Next Steps

- [05 - Function Reference](./05-function-reference.md) - Detailed function signatures
- [03 - Knowledge Base](./03-knowledge-base.md) - How search works after crawling
