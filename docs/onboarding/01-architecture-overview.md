# 01 - Architecture Overview

This document covers Archon's microservices architecture, service responsibilities, and database schema.

---

## Microservices Architecture

Archon is built as a **true microservices system** with HTTP-only communication between services. Each service is independently deployable and has clear responsibilities.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ARCHON MICROSERVICES ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   EXTERNAL CLIENTS                                                           │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  Claude Code  │  Cursor  │  VS Code  │  Custom AI Clients            │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                              │                                               │
│                              │ MCP Protocol (JSON-RPC 2.0)                   │
│                              ▼                                               │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                     MCP SERVER (Port 8051)                           │  │
│   │  - Lightweight HTTP wrapper for MCP protocol                         │  │
│   │  - No direct database access                                         │  │
│   │  - Routes requests to API Server                                     │  │
│   │  - Container size: ~150MB                                            │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                              │                                               │
│                              │ HTTP REST                                     │
│                              ▼                                               │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                     API SERVER (Port 8181)                           │  │
│   │  - Core business logic and REST APIs                                 │  │
│   │  - Web crawling and document processing                              │  │
│   │  - Knowledge base management                                         │  │
│   │  - All ML/AI operations                                              │  │
│   │  - Socket.IO for real-time updates                                   │  │
│   └────┬─────────────────────────────────────────────────────────────────┘  │
│        │                                                                     │
│        │ HTTP                                                                │
│        ├─────────────────────┬─────────────────────┐                        │
│        ▼                     ▼                     ▼                        │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐             │
│   │   AGENTS     │    │ WORK ORDERS  │    │    SUPABASE      │             │
│   │  (Port 8052) │    │ (Port 8053)  │    │   (PostgreSQL)   │             │
│   │              │    │              │    │                  │             │
│   │ DocumentAgent│    │ 6-step       │    │ - pgvector       │             │
│   │ RagAgent     │    │ workflow     │    │ - 11 tables      │             │
│   │              │    │ execution    │    │ - Full-text      │             │
│   └──────────────┘    └──────────────┘    └──────────────────┘             │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                     FRONTEND UI (Port 3737, 3738)                          │  │
│   │  - React dashboard                                                   │  │
│   │  - TanStack Query for data fetching                                  │  │
│   │  - Project and task management                                       │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Details

### 1. MCP Server (Port 8051)

**Purpose**: Lightweight HTTP wrapper for the Model Context Protocol

**Entry Point**: `python/src/mcp_server/mcp_server.py`

**Key Features**:
- JSON-RPC 2.0 protocol implementation
- No direct database access (uses HTTP to Server)
- Session management
- Health checks

**MCP Tools Available**:

| Module | Tools |
|--------|-------|
| RAG | `perform_rag_query`, `search_documents`, `get_available_sources`, `search_code_examples` |
| Projects | `manage_project`, `manage_task`, `find_projects`, `find_tasks` |
| Documents | `manage_document` |

```
python/src/mcp_server/
├── mcp_server.py          # Entry point, MCP setup
└── features/
    ├── rag/               # RAG tools
    ├── projects/          # Project tools
    ├── tasks/             # Task tools
    └── documents/         # Document tools
```

---

### 2. API Server (Port 8181)

**Purpose**: Core business logic and REST APIs

**Entry Point**: `python/src/server/main.py`

**Key Features**:
- FastAPI-based REST API
- Web crawling and document processing
- Knowledge base operations
- Embedding generation
- RAG search

**Directory Structure**:

```
python/src/server/
├── main.py                    # Entry point, FastAPI app
├── config/
│   ├── config.py              # Configuration loading
│   ├── logfire_config.py      # Logging setup
│   ├── providers.py           # LLM provider configs
│   └── service_discovery.py   # Service URL discovery
├── api_routes/                # 13 REST routers
│   ├── agent_chat_api.py      # Agent interactions
│   ├── knowledge_api.py       # RAG operations
│   ├── projects_api.py        # Project/task management
│   ├── mcp_api.py             # MCP configuration
│   ├── settings_api.py        # Settings/credentials
│   └── ...
└── services/                  # Business logic
    ├── crawling/              # Web crawling strategies
    ├── embeddings/            # Vector embeddings
    ├── search/                # RAG & hybrid search
    ├── storage/               # Document storage
    └── projects/              # Document service
```

---

### 3. Agents Service (Port 8052)

**Purpose**: PydanticAI agent hosting

**Entry Point**: `python/src/agents/server.py`

**Key Features**:
- REST API for running agents
- Streaming endpoint for real-time responses
- No direct database access (uses MCP client)

**Agents Available**:

| Agent | Purpose |
|-------|---------|
| `DocumentAgent` | Document creation, updates, feature plans, ERDs |
| `RagAgent` | Document search, code examples, query refinement |

```
python/src/agents/
├── server.py              # Entry point, FastAPI app
├── base_agent.py          # Base class with generics
├── document_agent.py      # Document management
├── rag_agent.py           # RAG search
└── mcp_client.py          # HTTP client for MCP
```

---

### 4. Work Orders Service (Port 8053)

**Purpose**: Workflow execution engine for Claude Code CLI

**Entry Point**: `python/src/agent_work_orders/main.py`

**Key Features**:
- 6-step sequential workflow
- SSE streaming updates
- Sandbox isolation (git worktree)
- GitHub integration

```
python/src/agent_work_orders/
├── main.py                     # Entry point
├── api/
│   └── routes.py               # Work order endpoints
├── workflow_engine/
│   ├── orchestrator.py         # Workflow execution
│   ├── operations.py           # Step definitions
│   └── agent_names.py          # Agent constants
├── sandbox_manager/            # Git worktree isolation
├── github_integration/         # GitHub operations
└── state_manager/              # State management
```

---

## Communication Patterns

### Service Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   SERVICE COMMUNICATION FLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   AI Client (Claude Code, Cursor)                                │
│        │                                                         │
│        │ MCP Protocol (JSON-RPC 2.0)                             │
│        ▼                                                         │
│   ┌────────────────────┐                                        │
│   │    MCP Server      │                                        │
│   │    Port 8051       │                                        │
│   └─────────┬──────────┘                                        │
│             │ HTTP REST                                          │
│             ▼                                                    │
│   ┌────────────────────┐                                        │
│   │    API Server      │                                        │
│   │    Port 8181       │                                        │
│   └─────────┬──────────┘                                        │
│             │                                                    │
│     ┌───────┼───────────────────┐                               │
│     │       │                   │                               │
│     ▼       ▼                   ▼                               │
│  Agents   Work Orders      Supabase                             │
│  :8052    :8053            Database                             │
│     │       │                                                    │
│     │       │                                                    │
│     └───────┴───► MCP Client ───► MCP Server (loop back)        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Pattern**: Services are **loosely coupled** with HTTP-only communication.

---

## Docker Network Topology

Archon requires **three Docker networks**:

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOCKER NETWORK TOPOLOGY                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │               localai_default (external)                │   │
│   │   Required for Supabase database access                 │   │
│   │   - supabase-ai-db:5432                                 │   │
│   │   - Kong API Gateway                                    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              sporterp-ai-unified (external)             │   │
│   │   For SportERP integration                              │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  app-network (internal)                 │   │
│   │   For Archon internal services                          │   │
│   │   - archon-server                                       │   │
│   │   - archon-mcp-server                                   │   │
│   │   - archon-agents                                       │   │
│   │   - archon-work-orders                                  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

Archon uses **PostgreSQL with pgvector** extension, hosted in Supabase.

### Tables (11 Total)

| Table | Purpose |
|-------|---------|
| `archon_settings` | Global settings |
| `archon_sources` | Document sources (URLs, types) |
| `archon_crawled_pages` | Crawled page content + embeddings |
| `archon_code_examples` | Extracted code samples |
| `archon_page_metadata` | Page metadata |
| `archon_projects` | Project records |
| `archon_tasks` | Task records |
| `archon_project_sources` | Project-source mapping |
| `archon_document_versions` | Document version history |
| `archon_migrations` | Migration tracking |
| `archon_prompts` | Stored prompts |

### Key Table: `archon_crawled_pages`

```sql
CREATE TABLE archon_crawled_pages (
    id UUID PRIMARY KEY,
    url TEXT NOT NULL,
    chunk_number INTEGER,
    content TEXT,
    metadata JSONB,

    -- Vector columns (multi-dimensional support)
    embedding_768 VECTOR(768),
    embedding_1024 VECTOR(1024),
    embedding_1536 VECTOR(1536),
    embedding_3072 VECTOR(3072),

    -- Full-text search (auto-generated)
    content_search_vector TSVECTOR GENERATED ALWAYS AS
        (to_tsvector('english', content)) STORED,

    source_id UUID REFERENCES archon_sources(id),
    page_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for search
CREATE INDEX idx_crawled_pages_embedding ON archon_crawled_pages
    USING ivfflat (embedding_1536 vector_cosine_ops);
CREATE INDEX idx_crawled_pages_content_search ON archon_crawled_pages
    USING GIN (content_search_vector);
```

### Entity Relationship

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE RELATIONSHIPS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   archon_sources                                                 │
│        │                                                         │
│        │ 1:N                                                     │
│        ▼                                                         │
│   archon_crawled_pages ◄────────┐                               │
│        │                        │                                │
│        │ 1:1                    │ 1:N                            │
│        ▼                        │                                │
│   archon_page_metadata    archon_code_examples                   │
│                                                                  │
│                                                                  │
│   archon_projects                                                │
│        │                                                         │
│        │ 1:N                                                     │
│        ├─────────────────────┐                                  │
│        ▼                     ▼                                  │
│   archon_tasks        archon_project_sources                     │
│                              │                                   │
│                              │ N:1                               │
│                              ▼                                   │
│                        archon_sources                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URI=postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres
SUPABASE_URL=http://host.docker.internal:18000
SUPABASE_SERVICE_KEY=eyJh...

# Ports
ARCHON_SERVER_PORT=8181
ARCHON_MCP_PORT=8051
ARCHON_AGENTS_PORT=8052
AGENT_WORK_ORDERS_PORT=8053

# AI Models
OPENAI_API_KEY=sk-...
DOCUMENT_AGENT_MODEL=openai:gpt-4o
RAG_AGENT_MODEL=openai:gpt-4o-mini

# Logging
LOGFIRE_ENABLED=false
LOG_LEVEL=info
```

### Dependency Groups (pyproject.toml)

| Group | Purpose |
|-------|---------|
| `server` | Main API (FastAPI, crawl4ai, Supabase) |
| `mcp` | MCP server (MCP protocol, minimal) |
| `agents` | PydanticAI agents (Pydantic, structlog) |
| `agent-work-orders` | Workflow engine (SSE, work orders) |
| `dev` | Testing, linting (mypy, pytest, ruff) |
| `all` | Everything for local testing |

---

## Key Code References

| File | Line | Purpose |
|------|------|---------|
| `python/src/server/main.py` | 1-50 | Server entry point, FastAPI app |
| `python/src/mcp_server/mcp_server.py` | 1-100 | MCP server setup |
| `python/src/agents/server.py` | 1-80 | Agent service entry point |
| `python/src/agent_work_orders/main.py` | 1-60 | Work orders entry point |

---

## Next Steps

- [02 - Pydantic Agents](./02-pydantic-agents.md) - Deep dive into agent orchestration
- [03 - Knowledge Base](./03-knowledge-base.md) - Understanding the RAG pipeline
