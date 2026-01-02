# Archon Features and Usage Guide

**Version**: 1.0.0
**Last Updated**: 2025-12-10
**Audience**: All Archon users

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Core Features](#core-features)
   - [Knowledge Base Management](#knowledge-base-management)
   - [RAG Search](#rag-search)
   - [Project & Task Management](#project--task-management)
   - [MCP Integration](#mcp-integration)
4. [LLM Configuration](#llm-configuration)
5. [Advanced Features](#advanced-features)
6. [API Access](#api-access)
7. [Troubleshooting](#troubleshooting)

---

## Overview

**Archon** is an AI-powered knowledge management system designed for developers, teams, and organizations. It combines:

- **Semantic Search**: Vector-based document retrieval with RAG (Retrieval-Augmented Generation)
- **Code Intelligence**: Automatic code example extraction and indexing
- **Project Management**: Optional task and project tracking
- **MCP Integration**: Model Context Protocol for IDE integration (Cursor, Claude Code, Windsurf)
- **Flexible LLM Support**: OpenAI, Ollama, Google Gemini, and more

### Key Benefits

- **Privacy-Focused**: Self-hosted, all data stays on your infrastructure
- **Cost-Effective**: Support for local models via Ollama (no API costs)
- **Developer-Friendly**: MCP tools for seamless IDE integration
- **Extensible**: Plugin architecture for custom workflows

---

## Quick Start

### Access Archon

1. **Web UI**: http://localhost:3737
2. **API**: http://localhost:8181
3. **MCP Server**: Port 8051 (for IDE integration)

### First Steps

1. **Configure LLM Provider** (Settings → LLM Provider)
   - Choose provider: OpenAI, Ollama, or Google
   - Enter API key (if required)
   - Test connection

2. **Add Knowledge Sources**:
   - **Web Crawling**: Enter URL and crawl depth
   - **Document Upload**: Upload PDF, TXT, MD files

3. **Search Your Knowledge**:
   - Use semantic search bar
   - Filter by source
   - View relevant results

---

## Core Features

### Knowledge Base Management

#### Web Crawling

**Purpose**: Automatically index documentation websites, blogs, and online resources

**How to Use**:
1. Navigate to **Knowledge Base** page
2. Click **"Add Source"** → **"Crawl Website"**
3. Enter Configuration:
   - **URL**: Starting URL (e.g., `https://docs.example.com`)
   - **Display Name**: Human-readable name
   - **Max Depth**: How many links deep to crawl (1-5)
   - **Max Pages**: Maximum pages to crawl (10-1000)
4. Click **"Start Crawl"**
5. Monitor progress in **"Active Operations"**

**Features**:
- **Smart Link Discovery**: Automatically finds relevant documentation links
- **Content Extraction**: Removes navigation, ads, and extracts main content
- **Code Detection**: Identifies and indexes code blocks
- **Batch Processing**: Efficient parallel crawling
- **Progress Tracking**: Real-time status updates

**Best Practices**:
- Start with `max_depth=2` for large sites
- Use specific URLs (e.g., `/docs/` instead of homepage)
- Check robots.txt compliance
- Monitor crawl progress before adding more sources

**Example Sources**:
```
Name: "PydanticAI Docs"
URL: https://ai.pydantic.dev/
Max Depth: 3
Max Pages: 100
```

#### Document Upload

**Purpose**: Add local files (PDFs, markdown, text documents) to knowledge base

**How to Use**:
1. **Knowledge Base** → **"Add Source"** → **"Upload Document"**
2. Drag & drop or select files
3. Choose document type: `documentation`, `code`, `reference`, `general`
4. Add tags (optional)
5. Click **"Upload"**

**Supported Formats**:
- PDF (.pdf)
- Markdown (.md, .markdown)
- Text (.txt)
- Code files (.py, .js, .ts, .go, etc.)

**Processing**:
- Automatic chunking (smart paragraph/section detection)
- Embedding generation
- Code extraction (if applicable)
- Metadata indexing

#### Document Management

**View Sources**:
- List all indexed sources
- See total word count, page count
- View crawl status and metadata

**Delete Sources**:
- Remove individual sources
- Batch delete by selection
- Automatically removes all associated documents and embeddings

---

### RAG Search

#### Semantic Search

**Purpose**: Find relevant information using natural language queries

**How to Use**:
1. Enter query in search bar (e.g., "How to configure authentication?")
2. View ranked results
3. Click result to see full page content

**Features**:
- **Vector Similarity**: Finds semantically similar content
- **Hybrid Search** (optional): Combines vector + keyword search
- **Reranking** (optional): Improves result relevance using cross-encoder
- **Contextual Embeddings** (optional): Enhanced embeddings with surrounding context

**Search Modes**:
- **Pages Mode** (default): Returns full pages with metadata
- **Chunks Mode**: Returns raw text chunks

**Configuration** (Settings → RAG Strategy):
```
USE_HYBRID_SEARCH: true
USE_RERANKING: true
USE_CONTEXTUAL_EMBEDDINGS: false (slow but more accurate)
```

#### Code Search

**Purpose**: Search specifically for code examples

**How to Use**:
1. Navigate to **"Code Examples"** tab
2. Enter code-related query (e.g., "React useState hook")
3. View extracted code snippets with summaries

**Features**:
- **Automatic Extraction**: Identifies code blocks during crawling
- **Language Detection**: Categorizes by programming language
- **Contextual Summaries**: AI-generated explanations
- **Syntax Highlighting**: Pretty display in UI

**Filter by Language**:
- Python, JavaScript, TypeScript, Go, Rust, etc.
- Filter by code size, complexity

---

### Project & Task Management

**Note**: This feature is optional and can be disabled in Settings.

#### Projects

**Purpose**: Organize work into projects with tasks, documents, and versions

**How to Use**:
1. Navigate to **"Projects"**
2. Click **"New Project"**
3. Enter:
   - Project Name
   - Description
   - GitHub Repository (optional)
4. Click **"Create"**

**Features**:
- Task tracking (todo, doing, review, done)
- Document management (specs, designs, notes)
- Version history
- Project-specific knowledge sources

#### Tasks

**Purpose**: Track work items within projects

**Workflow**:
```
todo → doing → review → done
```

**How to Use**:
1. Select project
2. Click **"New Task"**
3. Enter:
   - Task title
   - Description
   - Assignee (User, Archon, AI Agent)
   - Feature (optional label)
4. Click **"Create"**

**Features**:
- **Drag & Drop**: Move tasks between columns
- **Task Counts**: See progress at a glance
- **Filtering**: Filter by status, assignee, feature
- **Archon Assignment**: Assign tasks to AI for automated work

#### Documents

**Purpose**: Store project-specific documentation

**Document Types**:
- **Spec**: Technical specifications
- **Design**: Design documents
- **Note**: Meeting notes, ideas
- **PRP**: Project Requirements & Planning
- **API**: API documentation
- **Guide**: How-to guides

**How to Use**:
1. Select project → **"Documents"** tab
2. Click **"New Document"**
3. Choose document type
4. Write content (Markdown supported)
5. Save

**Features**:
- Version history (automatic snapshots)
- Restore previous versions
- Tags for organization
- Full-text search

---

### MCP Integration

**Purpose**: Expose Archon tools to AI IDEs (Cursor, Claude Code, Windsurf)

#### Available MCP Tools

**Knowledge Base Tools**:
- `archon:rag_search_knowledge_base` - Semantic search
- `archon:rag_search_code_examples` - Code-specific search
- `archon:rag_get_available_sources` - List knowledge sources
- `archon:rag_list_pages_for_source` - Browse documentation structure
- `archon:rag_read_full_page` - Retrieve full page content

**Project Management Tools**:
- `archon:find_projects` - Search and list projects
- `archon:manage_project` - Create, update, delete projects
- `archon:find_tasks` - Search and filter tasks
- `archon:manage_task` - CRUD operations on tasks
- `archon:find_documents` - Search project documents
- `archon:manage_document` - Manage documentation

**Version Control Tools**:
- `archon:find_versions` - View version history
- `archon:manage_version` - Create or restore versions

#### IDE Configuration

**Cursor / Claude Code / Windsurf**:
1. Add to MCP settings (e.g., `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "archon": {
      "url": "http://localhost:8051",
      "transport": "sse"
    }
  }
}
```
2. Restart IDE
3. Use natural language to trigger tools:
   - "Search Archon for React hooks documentation"
   - "Create a new task in project X"
   - "Find code examples for authentication"

**MCP Page**:
- Access via **"MCP"** tab in Archon UI
- Test tools interactively
- View tool schemas and parameters

---

## LLM Configuration

### Supported Providers

1. **OpenAI** (Default)
   - Models: GPT-4o, GPT-4 Turbo
   - Embeddings: text-embedding-3-small
   - Requirements: API key

2. **Ollama** (Self-Hosted)
   - Models: Llama 3.2, Mistral, Qwen
   - Embeddings: nomic-embed-text
   - Requirements: Ollama server

3. **Google Gemini**
   - Models: Gemini 1.5 Pro
   - Embeddings: text-embedding-004
   - Requirements: Google API key

4. **OpenRouter, Anthropic, Grok**
   - Community models, Claude, Grok
   - Requirements: Provider API keys

### Configuration

**Via Settings UI**:
1. Navigate to **Settings** → **LLM Provider**
2. Select provider
3. Enter API key (if required)
4. Configure base URL (for Ollama)
5. Choose models (chat & embedding)
6. Test connection

**Detailed Guide**: See [LLM Configuration Guide](LLM_CONFIGURATION_GUIDE.md)

**Ollama Quick Start**: See [Ollama Quick Start](OLLAMA_QUICKSTART.md)

---

## Advanced Features

### Contextual Embeddings

**Purpose**: Enhance embedding quality by including surrounding context

**How it Works**:
- Before: "This function returns the user"
- After: "In UserService class, this function returns the user object with profile data"

**Configuration**:
```sql
UPDATE archon_settings SET value = 'true' WHERE key = 'USE_CONTEXTUAL_EMBEDDINGS';
UPDATE archon_settings SET value = '3' WHERE key = 'CONTEXTUAL_EMBEDDINGS_MAX_WORKERS';
```

**Trade-off**: Slower processing, higher quality results

---

### Hybrid Search

**Purpose**: Combine vector similarity with keyword matching

**Benefits**:
- Better recall (finds more relevant results)
- Handles exact term matches
- Complementary to vector search

**Configuration**:
```sql
UPDATE archon_settings SET value = 'true' WHERE key = 'USE_HYBRID_SEARCH';
```

---

### Reranking

**Purpose**: Improve result ordering using cross-encoder model

**How it Works**:
1. Initial retrieval: Top 50 results via vector search
2. Reranking: Cross-encoder scores query-result pairs
3. Final results: Top 10 reranked results

**Configuration**:
```sql
UPDATE archon_settings SET value = 'true' WHERE key = 'USE_RERANKING';
```

**Model**: Uses fast reranking model (configurable)

---

### Code Extraction

**Purpose**: Automatically identify and index code examples

**Features**:
- **Smart Detection**: Finds code blocks in documentation
- **Language Identification**: Python, JavaScript, Go, etc.
- **Context Preservation**: Includes surrounding explanation
- **Filtering**: Removes diagrams (Mermaid, PlantUML)
- **Summaries**: AI-generated explanations

**Configuration**:
```sql
UPDATE archon_settings SET value = 'true' WHERE key = 'USE_AGENTIC_RAG';
UPDATE archon_settings SET value = '250' WHERE key = 'MIN_CODE_BLOCK_LENGTH';
UPDATE archon_settings SET value = '5000' WHERE key = 'MAX_CODE_BLOCK_LENGTH';
```

---

## API Access

### REST API

**Base URL**: http://localhost:8181/api

**Endpoints**:
```
POST   /api/knowledge/search          # Semantic search
POST   /api/knowledge/crawl            # Start web crawl
POST   /api/knowledge/upload           # Upload document
GET    /api/knowledge/sources          # List sources
DELETE /api/knowledge/sources/{id}    # Delete source

GET    /api/projects                   # List projects
POST   /api/projects                   # Create project
GET    /api/tasks                      # List tasks
POST   /api/tasks                      # Create task

GET    /api/progress/active            # Active operations
```

**Documentation**: http://localhost:8181/docs (Swagger UI)

### MCP Tools

Access via IDE or programmatically:

```python
# Example: Search knowledge base via MCP
from archon_mcp_client import ArchonMCP

async with ArchonMCP("http://localhost:8051") as mcp:
    results = await mcp.call_tool(
        "rag_search_knowledge_base",
        {
            "query": "authentication patterns",
            "match_count": 5
        }
    )
```

---

## Troubleshooting

### Common Issues

#### "Knowledge source not found"

**Solution**: Verify source exists in Sources list

#### "Embedding generation failed"

**Solutions**:
1. Check LLM provider configuration
2. Verify API key is valid
3. Check embedding model is correct
4. Review logs: `docker-compose logs archon-server`

#### "Slow search performance"

**Solutions**:
1. Disable contextual embeddings (if enabled)
2. Reduce search result count
3. Optimize database (VACUUM)
4. Check system resources

#### "MCP tools not available in IDE"

**Solutions**:
1. Verify MCP server running: `curl http://localhost:8051/health`
2. Check IDE MCP configuration
3. Restart IDE
4. View MCP logs: `docker-compose logs archon-mcp`

---

## Best Practices

### Knowledge Base

1. **Organize Sources**: Use descriptive names and tags
2. **Start Small**: Crawl specific documentation sections
3. **Monitor Progress**: Check active operations before adding more
4. **Regular Cleanup**: Delete outdated sources

### Search

1. **Natural Language**: Use descriptive queries (not keywords)
2. **Be Specific**: Include context in queries
3. **Use Filters**: Filter by source or language
4. **Iterate**: Refine queries based on results

### Project Management

1. **Break Down Tasks**: Keep tasks small and focused
2. **Use Features**: Group related tasks with feature labels
3. **Document Decisions**: Store important decisions in documents
4. **Version Control**: Use version history for major changes

### Performance

1. **Batch Operations**: Upload multiple documents at once
2. **Optimize Settings**: Tune RAG strategy for your use case
3. **Monitor Resources**: Check CPU/memory usage
4. **Cache Clearing**: Clear provider cache if settings don't update

---

## Additional Resources

### Documentation

- **LLM Configuration**: [LLM_CONFIGURATION_GUIDE.md](LLM_CONFIGURATION_GUIDE.md)
- **Ollama Setup**: [OLLAMA_QUICKSTART.md](OLLAMA_QUICKSTART.md)
- **Azure OpenAI**: [AZURE_OPENAI_IMPLEMENTATION.md](AZURE_OPENAI_IMPLEMENTATION.md)
- **Architecture**: [ARCHITECTURE.md](../PRPs/ai_docs/ARCHITECTURE.md)
- **Data Fetching**: [DATA_FETCHING_ARCHITECTURE.md](../PRPs/ai_docs/DATA_FETCHING_ARCHITECTURE.md)

### External Resources

- **GitHub Repository**: https://github.com/ljutzkanovltd/Archon
- **PydanticAI**: https://ai.pydantic.dev/
- **Ollama**: https://ollama.ai/
- **MCP Specification**: https://modelcontextprotocol.io/

---

## Support

**Health Check**: http://localhost:8181/health

**Logs**:
```bash
docker-compose logs -f archon-server   # Backend logs
docker-compose logs -f archon-mcp      # MCP logs
docker-compose logs -f archon-ui       # Frontend logs
```

**Database**:
```bash
docker exec -it supabase-ai-db psql -U postgres -d postgres
```

**Issues**: https://github.com/ljutzkanovltd/Archon/issues

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-10
**For**: Archon v1.0+
