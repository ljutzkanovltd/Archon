# Archon Developer Onboarding

Welcome to the Archon project! This documentation will help you understand how Archon works, from its microservices architecture to the AI agents that power it.

## What is Archon?

Archon is a **knowledge base and task management system** with MCP (Model Context Protocol) integration for AI assistants. It provides:

- **Knowledge Base Management** - Document crawling, chunking, embedding, and semantic search
- **RAG (Retrieval-Augmented Generation)** - Intelligent document retrieval for AI assistants
- **Task Management** - Project and task tracking with agent assignment
- **PydanticAI Agents** - Type-safe agents for document management and search
- **Workflow Engine** - Automated 6-step development workflows

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       ARCHON ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│   │   Frontend   │◄────►│    Server    │◄────►│  MCP Server  │  │
│   │   (React)    │      │   (FastAPI)  │      │  (JSON-RPC)  │  │
│   │   :3737      │      │    :8181     │      │    :8051     │  │
│   └──────────────┘      └──────┬───────┘      └──────────────┘  │
│                                │                                 │
│              ┌─────────────────┼─────────────────┐              │
│              │                 │                 │              │
│              ▼                 ▼                 ▼              │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│   │    Agents    │   │  Work Orders │   │   Supabase   │       │
│   │  (PydanticAI)│   │  (Workflow)  │   │  (pgvector)  │       │
│   │    :8052     │   │    :8053     │   │   Database   │       │
│   └──────────────┘   └──────────────┘   └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3737 | React dashboard UI |
| Server API | 8181 | Core business logic, REST API |
| MCP Server | 8051 | Model Context Protocol for AI clients |
| Agents | 8052 | PydanticAI agent hosting (optional) |
| Work Orders | 8053 | Workflow execution engine (optional) |

---

## Documentation Index

### Core Concepts

| Document | Description |
|----------|-------------|
| [01 - Architecture Overview](./01-architecture-overview.md) | Microservices architecture, ports, database schema |
| [02 - Pydantic Agents](./02-pydantic-agents.md) | Agent orchestration, tools, dependency injection |
| [03 - Knowledge Base](./03-knowledge-base.md) | Chunking, embeddings, RAG, hybrid search |

### Pipelines & Workflows

| Document | Description |
|----------|-------------|
| [04 - Crawling Pipeline](./04-crawling-pipeline.md) | Document ingestion, crawling strategies |
| [05 - Function Reference](./05-function-reference.md) | Key functions with signatures and locations |
| [06 - Workflow Engine](./06-workflow-engine.md) | 6-step sequential agent workflow |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.12+
- Supabase instance (local-ai-packaged or cloud)
- Node.js 18+ (for frontend)

### Start Services

```bash
# Start all Archon services
./start-archon.sh

# Check health
curl http://localhost:8181/health   # API Server
curl http://localhost:8051/health   # MCP Server
```

### Key Environment Variables

```bash
DATABASE_URI=postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres
SUPABASE_URL=http://host.docker.internal:18000
SUPABASE_SERVICE_KEY=eyJh...
SERVER_PORT=8181
MCP_PORT=8051
```

---

## Key Concepts at a Glance

### 1. PydanticAI Agents

Archon uses **PydanticAI** for type-safe agent definitions:

```python
class DocumentAgent(BaseAgent[DocumentDependencies, DocumentOperation]):
    """Agent for document management with 7 tools."""

class RagAgent(BaseAgent[RagDependencies, RagQueryResult]):
    """Agent for RAG-based search with 4 tools."""
```

### 2. Knowledge Base Pipeline

```
URL → Crawl → Markdown → Chunk (600 chars) → Embed → Store (pgvector)
```

### 3. Hybrid Search

Combines **vector similarity** (pgvector) with **full-text search** (tsvector) for optimal retrieval.

### 4. Agent Work Orders

6-step automated workflow:
1. CREATE-BRANCH
2. PLANNING
3. EXECUTE
4. COMMIT
5. CREATE-PR
6. REVIEW

---

## Project Structure

```
Archon/
├── python/
│   └── src/
│       ├── server/           # Main API server (:8181)
│       │   ├── api_routes/   # REST endpoints
│       │   └── services/     # Business logic
│       │       ├── crawling/     # Document crawling
│       │       ├── embeddings/   # Vector embeddings
│       │       ├── search/       # RAG & hybrid search
│       │       └── storage/      # Chunking & storage
│       ├── mcp_server/       # MCP server (:8051)
│       ├── agents/           # PydanticAI agents (:8052)
│       └── agent_work_orders/# Workflow engine (:8053)
├── react-ui/                 # Frontend dashboard (:3737)
└── docs/
    └── onboarding/           # This documentation
```

---

## Next Steps

1. **Start with [Architecture Overview](./01-architecture-overview.md)** to understand the system components
2. **Read [Pydantic Agents](./02-pydantic-agents.md)** to learn how agents work
3. **Explore [Knowledge Base](./03-knowledge-base.md)** to understand the RAG pipeline
4. **Check [Function Reference](./05-function-reference.md)** for implementation details

---

## Need Help?

- **Main CLAUDE.md**: `/home/ljutzkanov/Archon/.claude/CLAUDE.md`
- **Project README**: `/home/ljutzkanov/Archon/README.md`
- **API Reference**: Check the `/api_routes/` directory for endpoint documentation
