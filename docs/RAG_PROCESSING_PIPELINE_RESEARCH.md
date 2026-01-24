# RAG Processing Pipeline: Industry Best Practices Research

**Date:** 2026-01-22
**Research Focus:** Optimal order of operations for RAG knowledge base processing pipelines
**Primary Sources:** LangChain, LlamaIndex, Haystack, Unstructured.io, AWS, NVIDIA, Microsoft Azure

---

## Executive Summary

Based on comprehensive research of industry frameworks (LangChain, LlamaIndex, Haystack, Unstructured.io) and best practices from major AI/ML providers (AWS, Azure, NVIDIA), the **standard RAG document processing pipeline** follows this sequential order:

```
1. Document Ingestion (Load & Normalize)
   ↓
2. Content Extraction & Preprocessing
   ├─ Text extraction
   ├─ Code extraction (preserve structure)
   └─ Metadata extraction (preserve hierarchy)
   ↓
3. Document Chunking
   ├─ Strategy selection (fixed-size, semantic, document-based)
   └─ Chunk size optimization (with overlap)
   ↓
4. Embedding Generation
   ├─ Per-chunk vectorization
   └─ Parallel processing (GPU acceleration)
   ↓
5. Vector Indexing & Storage
   └─ Write to vector database (pgvector, Qdrant, etc.)
```

**Critical Finding:** Code and metadata extraction **MUST occur before chunking** to preserve semantic integrity and document structure. Chunking **MUST occur before embedding generation** as embeddings operate on individual chunks.

---

## 1. Standard RAG Pipeline Order

### 1.1 Two-Phase Architecture

All major frameworks (LangChain, LlamaIndex, Haystack, Unstructured.io) follow a two-phase pattern:

#### **Phase 1: Ingestion (Offline/Batch)**
Documents → Extraction → Chunking → Embedding → Index/Store

#### **Phase 2: Retrieval (Runtime)**
User Query → Embed Query → Similarity Search → Top-K Results → LLM Generation → Response

**Source:** LangChain, Haystack, AWS RAG documentation

---

### 1.2 Detailed Processing Order

#### **Step 1: Document Ingestion**
- **Purpose:** Load raw documents from various sources
- **Operations:**
  - Load from 40+ sources (Unstructured.io standard)
  - Convert to standard format (LangChain's Document objects)
  - Normalize character encodings
  - Extract raw content (text, images, tables)

**Key Tools:**
- LangChain: `TextLoader`, `PyPDFLoader`, `WebBaseLoader`
- LlamaIndex: `SimpleFileNodeParser`, `FlatFileReader`
- Unstructured.io: Connector framework for 40+ sources

**Best Practice:** Persist loaded documents before chunking to enable experimentation with different chunking strategies without re-loading.

---

#### **Step 2: Content Extraction & Preprocessing**

**CRITICAL: This step occurs BEFORE chunking**

##### 2.1 Text Extraction
- Extract plain text from PDFs, HTML, Word docs
- Clean and normalize text (remove extra whitespace, fix encoding)
- Preserve paragraph breaks and section boundaries

##### 2.2 Code Extraction (BEFORE Chunking)
- **Industry Consensus:** Code **MUST be extracted before chunking**
- **Rationale:** "If you just took a piece of code Markdown and gave it to a recursive text chunker, you would get back broken code" (Weaviate)
- **Implementation:** Document-based chunking uses Python code classes and functions as structural boundaries
- **Frameworks:**
  - LangChain: Structure-aware splitters for code
  - LlamaIndex: Hierarchical parsing with code block detection
  - Unstructured.io: Code extraction as enrichment step

**Example (LlamaIndex):**
```python
# Recursive chunking preserves code structure
# 1. Split by class definitions
# 2. Then by function definitions
# 3. Finally by line breaks
```

##### 2.3 Metadata Extraction (BEFORE Chunking)
- **Industry Consensus:** Metadata extraction occurs during preprocessing, before or in conjunction with chunking
- **Purpose:** Preserve document hierarchy and enable contextual retrieval
- **Types of Metadata:**
  - **Structural:** Section headers, table of contents, page numbers, parent_id, category_depth
  - **Content-based:** Keywords, summaries, topics, named entities
  - **Contextual:** Source system, ingestion date, language, sensitivity level

**Key Insight:** "During preprocessing, extracting metadata attributes like parent_id and category_depth preserves the original document hierarchy, maintaining context during retrieval." (Databricks)

**Best Practice:** Preserve document structure (paragraph breaks, section titles, list items) to maintain organization and readability.

---

#### **Step 3: Document Chunking**

**CRITICAL: Chunking occurs AFTER extraction but BEFORE embedding**

##### 3.1 Why Chunking Must Happen Before Embedding
- **Dependency:** Embeddings operate on individual text segments (chunks)
- **Process Flow:** "Chunking usually occurs after document preprocessing but before embedding generation, and the chunking process directly feeds into the embedding step" (IBM)
- **Performance Impact:** "Chunking configuration has a critical impact on retrieval performance—comparable to, or greater than, the influence of the embedding model itself" (Chemistry-Aware RAG Study)

##### 3.2 Common Chunking Strategies

| Strategy | Description | Use Case | Framework Support |
|----------|-------------|----------|-------------------|
| **Fixed-size** | Split by character count with overlap | General-purpose, fast | All frameworks |
| **Semantic** | Group sentences by embedding similarity | Context-aware retrieval | LangChain, LlamaIndex |
| **Document-based** | Split by document structure (headers, code blocks) | Structured docs, code | LangChain, Unstructured.io |
| **Hierarchical** | Nested chunks (leaf → parent) | Complex documents | LlamaIndex |
| **Recursive** | Progressive splitting (class → function → line) | Code preservation | LangChain |

##### 3.3 Default Chunk Settings

| Framework | Default Chunk Size | Default Overlap |
|-----------|-------------------|-----------------|
| **LlamaIndex** | 1024 tokens | 20 tokens |
| **LangChain** | 1000 characters | 200 characters |
| **Industry Best Practice** | 200-500 tokens | 10-20% overlap |

**Hierarchical Chunking (LlamaIndex):**
- Parent chunks: 1024 characters
- Leaf chunks: 512 characters (link to parents)

**Advanced Strategy (Databricks):**
- Parent chunks: 1000-2000 tokens (for context window)
- Child chunks: 300-500 tokens (for retrieval precision)

##### 3.4 Post-Chunking Alternative (Emerging Pattern)
- **Concept:** Embed entire documents first, chunk only retrieved documents at query time
- **Benefits:** Avoid chunking documents that may never be queried, enable dynamic chunking based on query context
- **Trade-offs:** Higher initial embedding cost, more complex retrieval logic

---

#### **Step 4: Embedding Generation**

**CRITICAL: Embeddings are generated PER CHUNK after chunking**

##### 4.1 Processing Flow
```python
chunks = [chunk1, chunk2, chunk3, ...]
embeddings = []
for chunk in chunks:
    embedding = embed_model.encode(chunk)
    embeddings.append(embedding)
```

##### 4.2 Parallelization & Optimization
- **Sequential Problem:** "Embedding millions of chunks sequentially consumes significant time" (Elastic)
- **Solution:** Distribute embedding jobs across GPU-equipped nodes
- **Frameworks:**
  - Ray Clusters: Parallel ingest and query operations across multiple GPUs
  - Databricks: Parallel embedding generation with auto-scaling
  - AWS: RayData for scalable document ingestion pipelines

**Best Practices:**
- Batch processing (e.g., BATCH_SIZE = 100) for memory management
- GPU acceleration for large-scale workloads
- Caching to avoid redundant embedding generation

##### 4.3 Embedding Models

| Model | Dimensions | Use Case |
|-------|-----------|----------|
| `text-embedding-3-small` (OpenAI) | 1536 | General-purpose |
| `sentence-transformers/all-MiniLM-L6-v2` | 384 | Fast, efficient |
| `voyage-ai/voyage-2` | 1024 | High-quality retrieval |

---

#### **Step 5: Vector Indexing & Storage**

##### 5.1 Operations
- Store chunk embeddings in vector database
- Index for similarity search (cosine similarity, L2 distance)
- Preserve metadata associations (chunk → document → source)

##### 5.2 Parallel Indexing
- **Best Practice:** Build index shards in parallel, then merge or serve as distributed partitions
- **Frameworks:**
  - pgvector: Concurrent index creation with HNSW
  - Qdrant: Distributed indexing with sharding
  - Pinecone: Auto-scaling indexing infrastructure

---

## 2. Dependency Analysis

### 2.1 Sequential Dependencies (CANNOT be violated)

```
Ingestion → Extraction → Chunking → Embedding → Indexing
```

| Dependency | Rationale | Violates If Reversed |
|------------|-----------|----------------------|
| **Extraction → Chunking** | Must preserve code/structure before splitting | Code breaks across chunk boundaries |
| **Chunking → Embedding** | Embeddings operate on chunks, not full documents | Cannot embed non-existent chunks |
| **Embedding → Indexing** | Vector DB requires embeddings to index | Cannot index non-existent vectors |

### 2.2 Parallel Processing Opportunities

| Stage | Parallelizable Operations | Framework Support |
|-------|--------------------------|-------------------|
| **Extraction** | Process multiple documents concurrently | Unstructured.io, Ray |
| **Chunking** | Chunk multiple documents in parallel | All frameworks |
| **Embedding** | Embed chunks across multiple GPUs | Ray, Databricks, AWS |
| **Indexing** | Build index shards concurrently | Qdrant, Pinecone |

**Example Parallel Pipeline:**
```python
# Concurrent extraction + chunking + embedding
documents = load_documents()  # Sequential

# Parallel processing
for batch in batches(documents, batch_size=100):
    with ThreadPoolExecutor() as executor:
        extracted = executor.map(extract_content, batch)
        chunked = executor.map(chunk_document, extracted)
        embeddings = executor.map(embed_chunks, chunked)
        executor.map(index_vectors, embeddings)
```

---

## 3. Framework-Specific Implementations

### 3.1 LangChain Pipeline

```python
# 1. Load documents
from langchain.document_loaders import TextLoader
loader = TextLoader("document.txt")
documents = loader.load()

# 2. Extract & preprocess (handled by loader)
# - Text normalization
# - Metadata extraction

# 3. Chunk documents
from langchain.text_splitter import RecursiveCharacterTextSplitter
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=["\n\n", "\n", " ", ""]  # Preserve structure
)
chunks = splitter.split_documents(documents)

# 4. Generate embeddings
from langchain.embeddings import OpenAIEmbeddings
embeddings = OpenAIEmbeddings()

# 5. Index in vector store
from langchain.vectorstores import Chroma
vectorstore = Chroma.from_documents(chunks, embeddings)
```

**Key Features:**
- Structure-aware splitters (Markdown, code, JSON)
- Document loaders preserve metadata
- Integrated embedding generation

---

### 3.2 LlamaIndex Pipeline

```python
# 1. Load documents
from llama_index import SimpleDirectoryReader
documents = SimpleDirectoryReader("data/").load_data()

# 2. Extract & preprocess (automatic)
# - Text extraction
# - Metadata inheritance (parent → child nodes)

# 3. Chunk into nodes
from llama_index.node_parser import SimpleNodeParser
parser = SimpleNodeParser.from_defaults(
    chunk_size=1024,
    chunk_overlap=20
)
nodes = parser.get_nodes_from_documents(documents)

# 4. Build index (embedding + indexing combined)
from llama_index import VectorStoreIndex
index = VectorStoreIndex(nodes)
```

**Key Features:**
- Hierarchical node structure (parent-child relationships)
- Automatic metadata propagation
- Specialized parsers (HTML, code, semantic)

---

### 3.3 Haystack Pipeline

```python
from haystack import Pipeline
from haystack.components.preprocessors import DocumentCleaner, DocumentSplitter
from haystack.components.embedders import SentenceTransformersDocumentEmbedder
from haystack.components.writers import DocumentWriter

# Build pipeline
pipeline = Pipeline()

# 1. Clean documents (extraction + preprocessing)
pipeline.add_component("cleaner", DocumentCleaner())

# 2. Split into chunks
pipeline.add_component("splitter", DocumentSplitter(
    split_by="sentence",
    split_length=10,
    split_overlap=2
))

# 3. Generate embeddings
pipeline.add_component("embedder", SentenceTransformersDocumentEmbedder(
    model="sentence-transformers/all-MiniLM-L6-v2"
))

# 4. Write to vector store
pipeline.add_component("writer", DocumentWriter(document_store=document_store))

# Connect components
pipeline.connect("cleaner", "splitter")
pipeline.connect("splitter", "embedder")
pipeline.connect("embedder", "writer")
```

**Key Features:**
- DAG-based pipeline (directed acyclic graph)
- Modular components
- Batch processing for large-scale indexing

---

### 3.4 Unstructured.io Pipeline

```python
from unstructured.partition.auto import partition
from unstructured.chunking.basic import chunk_elements
from unstructured.embed.openai import OpenAIEmbeddingEncoder

# 1. Partition document (ingestion + extraction)
elements = partition(filename="document.pdf")
# Output: [Title, NarrativeText, Table, ListItem, PageBreak]

# 2. Extract metadata (automatic during partitioning)
# - Layout ML: table boundaries, header detection
# - Coordinates, page numbers, languages, SHA hashes

# 3. Chunk elements
chunks = chunk_elements(
    elements=elements,
    max_characters=500,
    new_after_n_chars=450,
    overlap=50
)

# 4. Generate embeddings
encoder = OpenAIEmbeddingEncoder(api_key="...")
embeddings = encoder.embed_documents([c.text for c in chunks])

# 5. Write to vector store
# (framework-specific)
```

**Pipeline Order (Unstructured.io):**
```
Download → Partitioning → Processing → Writing
```

**Key Features:**
- 40+ source connectors
- Advanced partitioning (detect document structure)
- Enrichment phase (VLM-based metadata extraction)

---

## 4. Code Extraction: Timing & Best Practices

### 4.1 Industry Consensus: Extract BEFORE Chunking

**Why Code Must Be Extracted First:**
1. **Prevents Breaking Code:** "If you just took a piece of code Markdown and gave it to a recursive text chunker, you would get back broken code" (Weaviate)
2. **Preserves Semantic Boundaries:** Code blocks (classes, functions) serve as natural chunking boundaries
3. **Enables Structure-Aware Chunking:** Document-based chunking uses code structure to determine chunk boundaries

### 4.2 Code Extraction Strategies

#### Strategy 1: Structure-Aware Chunking (Recommended)
```python
# LangChain RecursiveCharacterTextSplitter with code separators
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter.from_language(
    language="python",
    chunk_size=1000,
    chunk_overlap=100
)

# Splitting logic:
# 1. Try splitting by class definitions
# 2. Then by function definitions
# 3. Finally by line breaks
```

#### Strategy 2: Pre-Chunking Extraction
```python
# Extract code blocks before chunking
def extract_code_blocks(document):
    code_blocks = []
    text_blocks = []

    # Regex or parser to identify code blocks
    for block in document.split("```"):
        if is_code_block(block):
            code_blocks.append(block)
        else:
            text_blocks.append(block)

    return code_blocks, text_blocks

# Chunk code and text separately
code_chunks = chunk_with_structure(code_blocks)
text_chunks = chunk_normal(text_blocks)
```

#### Strategy 3: Hierarchical Parsing (LlamaIndex)
```python
from llama_index.node_parser import HierarchicalNodeParser

parser = HierarchicalNodeParser.from_defaults(
    chunk_sizes=[2048, 512, 128]  # Parent → Child → Grandchild
)

# Code blocks become parent nodes
# Individual functions become child nodes
# Preserves hierarchy for retrieval
```

### 4.3 Code Extraction Workflow

```
Document Ingestion
   ↓
Identify Code Blocks (regex, AST parsing)
   ↓
Extract Code Metadata (language, function names, classes)
   ↓
Structure-Aware Chunking
   ├─ Code chunks (preserve function boundaries)
   └─ Text chunks (standard chunking)
   ↓
Embed Separately (code embeddings vs. text embeddings)
   ↓
Index with Metadata (code_type: "function", language: "python")
```

### 4.4 Tools for Code Extraction

| Tool | Capability | Use Case |
|------|-----------|----------|
| **AST Parsing** | Parse Python/JS/Java code into abstract syntax tree | Precise function/class extraction |
| **Regex Patterns** | Detect code blocks in Markdown (```) | Quick extraction for multi-format docs |
| **Tree-sitter** | Multi-language syntax parsing | Language-agnostic code extraction |
| **Docling** | Specialized code extraction (in development) | Advanced metadata + code extraction |

---

## 5. Error Recovery Strategies

### 5.1 Checkpoint-Based Recovery

**Pattern:** Save intermediate results after each major stage

```python
# Checkpoint after extraction
save_checkpoint("extracted_documents", documents)

# Checkpoint after chunking
save_checkpoint("chunked_documents", chunks)

# Checkpoint after embedding
save_checkpoint("embeddings", embeddings)
```

**Benefits:**
- Restart from last successful stage on failure
- Experiment with different strategies without re-running earlier stages

### 5.2 Partial Failure Handling

**Pattern:** Continue processing remaining documents on individual failures

```python
failed_documents = []

for doc in documents:
    try:
        chunks = chunk_document(doc)
        embeddings = embed_chunks(chunks)
        index_vectors(embeddings)
    except Exception as e:
        log_error(f"Failed to process {doc.id}: {e}")
        failed_documents.append(doc.id)
        continue  # Process next document

# Retry failed documents
retry_failed_documents(failed_documents)
```

### 5.3 Validation Gates

**Pattern:** Validate output at each stage before proceeding

```python
# After extraction
assert all(doc.text is not None for doc in documents), "Some documents failed extraction"

# After chunking
assert all(len(chunk.text) > 0 for chunk in chunks), "Empty chunks detected"

# After embedding
assert all(emb.shape == (1536,) for emb in embeddings), "Invalid embedding dimensions"
```

---

## 6. Recommendations for Archon's Pipeline

### 6.1 Proposed Processing Order

```
1. Document Ingestion
   ├─ Load from filesystem (CLAUDE.md, README.md, code files)
   └─ Normalize encodings

2. Content Extraction & Preprocessing
   ├─ Extract text content
   ├─ Extract code blocks (BEFORE chunking)
   │  ├─ Detect language (Python, TypeScript, etc.)
   │  └─ Parse structure (classes, functions)
   └─ Extract metadata (BEFORE chunking)
      ├─ Document type (CLAUDE.md, README.md, code)
      ├─ Structural metadata (section headers, parent_id)
      └─ Contextual metadata (source, last_modified)

3. Document Chunking
   ├─ Strategy: Hybrid (semantic + structure-aware)
   │  ├─ Code: Chunk by function/class boundaries
   │  └─ Prose: Semantic chunking with 10-20% overlap
   ├─ Chunk size: 400-500 tokens (optimal for pgvector)
   └─ Store chunk → document → source relationships

4. Embedding Generation
   ├─ Parallel processing (batch size: 50-100 chunks)
   ├─ Model: text-embedding-3-small (1536 dimensions)
   └─ Cache embeddings to avoid regeneration

5. Vector Indexing (pgvector)
   ├─ Store embeddings in archon_crawled_pages.embedding
   ├─ Create HNSW index for fast similarity search
   └─ Preserve metadata (chunk_id, page_id, source_id)
```

### 6.2 Implementation Checklist

**Phase 1: Extraction & Preprocessing**
- [ ] Implement code block detection (regex + AST parsing)
- [ ] Extract structural metadata (section headers, parent_id)
- [ ] Persist extracted documents for experimentation

**Phase 2: Chunking**
- [ ] Implement hybrid chunking strategy (code vs. prose)
- [ ] Optimize chunk size for pgvector (400-500 tokens)
- [ ] Add chunk overlap (10-20%) for context preservation

**Phase 3: Embedding & Indexing**
- [ ] Implement batch embedding generation (parallel processing)
- [ ] Add embedding cache (avoid regeneration)
- [ ] Create pgvector HNSW index for fast retrieval

**Phase 4: Error Handling**
- [ ] Add checkpoint-based recovery
- [ ] Implement validation gates at each stage
- [ ] Log failed documents for retry

### 6.3 Key Principles to Follow

1. **Code extraction BEFORE chunking** (industry consensus)
2. **Metadata extraction BEFORE chunking** (preserve hierarchy)
3. **Chunking BEFORE embedding** (embeddings operate on chunks)
4. **Parallel processing where possible** (extraction, embedding, indexing)
5. **Checkpoint intermediate results** (enable experimentation + recovery)
6. **Validate at each stage** (catch errors early)

### 6.4 Performance Optimization

| Stage | Optimization | Expected Impact |
|-------|--------------|-----------------|
| **Extraction** | Parallel document processing | 3-5x speedup |
| **Chunking** | Batch processing (100 docs) | 2x speedup |
| **Embedding** | GPU acceleration + batching | 10x speedup |
| **Indexing** | Parallel index shard creation | 4-6x speedup |

---

## 7. Conclusion

### 7.1 Core Findings

1. **Sequential Dependencies are Non-Negotiable:**
   - Extraction → Chunking → Embedding → Indexing
   - Code and metadata extraction MUST occur before chunking

2. **Parallel Processing is Essential for Scale:**
   - Embed chunks across multiple GPUs
   - Build index shards concurrently
   - Process documents in batches

3. **Chunking Strategy is Critical:**
   - "Chunking configuration has a critical impact on retrieval performance—comparable to, or greater than, the influence of the embedding model itself"
   - Optimal: 200-500 tokens with 10-20% overlap
   - Preserve code structure (function/class boundaries)

4. **All Major Frameworks Agree on Order:**
   - LangChain, LlamaIndex, Haystack, Unstructured.io all follow the same pattern
   - Extract → Chunk → Embed → Index

### 7.2 Implementation Priority for Archon

**High Priority:**
1. Code extraction before chunking (critical for code examples)
2. Metadata extraction before chunking (preserve hierarchy)
3. Hybrid chunking strategy (code vs. prose)

**Medium Priority:**
1. Parallel embedding generation (batch processing)
2. Checkpoint-based recovery
3. Validation gates at each stage

**Low Priority (Future Optimization):**
1. GPU acceleration for embeddings
2. Distributed indexing with sharding
3. Advanced semantic chunking

---

## 8. References

### 8.1 Primary Sources

1. **LangChain Documentation:**
   - https://docs.langchain.com/oss/python/integrations/document_loaders/
   - Chunking strategies with RecursiveCharacterTextSplitter

2. **LlamaIndex Documentation:**
   - https://developers.llamaindex.ai/python/framework/optimizing/basic_strategies/
   - Hierarchical node parsing and semantic chunking

3. **Haystack Documentation:**
   - https://docs.haystack.deepset.ai/docs/pipelines
   - DAG-based pipeline architecture

4. **Unstructured.io:**
   - https://github.com/Unstructured-IO/unstructured
   - ETL pipeline: Download → Partitioning → Processing → Writing

### 8.2 Research Papers

1. **"RAGOps: Operating and Managing Retrieval-Augmented Generation Pipelines"** (arXiv 2506.03401v1)
   - Production RAG system architecture

2. **"Chunk Twice, Embed Once: A Systematic Study of Segmentation and Representation Trade-offs"** (arXiv 2506.17277v1)
   - "Chunking configuration has a critical impact on retrieval performance—comparable to, or greater than, the influence of the embedding model itself"

### 8.3 Industry Best Practices

1. **AWS:** "Build a RAG data ingestion pipeline for large-scale ML workloads"
2. **Microsoft Azure:** "Develop a RAG Solution - Chunking Phase"
3. **NVIDIA:** "Finding the Best Chunking Strategy for Accurate AI Responses"
4. **Databricks:** "The Ultimate Guide to Chunking Strategies for RAG Applications"

---

**Document Version:** 1.0
**Last Updated:** 2026-01-22
**Reviewed By:** LLMs Expert Agent
**Status:** Final Recommendations
