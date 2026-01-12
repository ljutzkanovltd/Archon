# Archon System Architecture

**Document Version**: 1.0
**Last Updated**: 2026-01-12
**Purpose**: Comprehensive system architecture for Archon platform
**Audience**: Developers, architects, DevOps engineers

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Services](#core-services)
3. [Network Architecture](#network-architecture)
4. [Data Flow](#data-flow)
5. [REST API Architecture](#rest-api-architecture)
6. [MCP Protocol Architecture](#mcp-protocol-architecture)
7. [Frontend Architecture](#frontend-architecture)
8. [Database Schema](#database-schema)
9. [Deployment Scenarios](#deployment-scenarios)
10. [Integration Points](#integration-points)
11. [Security Architecture](#security-architecture)
12. [Performance Considerations](#performance-considerations)

---

## System Overview

Archon is a **knowledge base and task management platform** designed to enhance AI coding assistants through the Model Context Protocol (MCP). It provides:

- **Knowledge Base Management**: Web crawling, document indexing, semantic search
- **Task Management**: Project tracking, task lifecycle, agent assignments
- **MCP Server**: Protocol interface for AI coding assistants (Claude Code, Cursor, Windsurf, etc.)
- **Dashboard UI**: Web interface for visualization and management

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        C1[AI Coding Assistants<br/>Claude Code, Cursor, etc.]
        C2[Web Browser<br/>Dashboard UI]
        C3[REST API Clients<br/>Scripts, Automation]
    end

    subgraph "Archon Platform"
        subgraph "Service Layer"
            MCP[MCP Server<br/>Port 8051<br/>FastMCP + Python]
            API[Backend API<br/>Port 8181<br/>FastAPI + Python]
            UI_React[Dashboard UI (React)<br/>Port 3737<br/>Vite + React]
            UI_Next[Dashboard UI (Next.js)<br/>Port 3738<br/>Next.js 15.5.9]
        end

        subgraph "Data Layer"
            Redis[Redis Cache<br/>Port 6379]
            DB[(Supabase PostgreSQL<br/>+ pgvector<br/>Port 5432)]
        end
    end

    subgraph "External Services"
        LLM[LLM Providers<br/>OpenAI, Gemini, Ollama]
        Supabase[Supabase Stack<br/>Kong Gateway<br/>Auth Service]
    end

    C1 -->|MCP Protocol<br/>JSON-RPC 2.0| MCP
    C2 -->|HTTP/REST| UI_React
    C2 -->|HTTP/REST| UI_Next
    C3 -->|HTTP/REST| API

    MCP -->|Session Tracking| API
    UI_React -->|API Calls| API
    UI_Next -->|API Proxy| API

    MCP -->|Direct Connection| DB
    API -->|PostgREST API| Supabase
    API -->|Direct asyncpg| DB

    API -->|Cache| Redis
    API -->|Embeddings<br/>RAG| LLM

    style MCP fill:#e1f5ff
    style API fill:#e1f5ff
    style UI_React fill:#fff9e6
    style UI_Next fill:#fff9e6
    style DB fill:#e8f5e9
```

### Design Principles

1. **Microservices Architecture**: Each service has a single responsibility
2. **API-First Design**: Backend exposes RESTful APIs for all operations
3. **Protocol-Driven Integration**: MCP protocol for AI assistant integration
4. **Separation of Concerns**: Clear boundaries between protocol, business logic, and presentation
5. **Scalability**: Stateless services with shared data layer
6. **Extensibility**: Pluggable LLM providers, RAG strategies, and frontends

---

## Core Services

### 1. MCP Server (Port 8051)

**Technology**: FastMCP + Python 3.12+ + FastAPI
**Purpose**: Model Context Protocol server for AI coding assistants
**Protocol**: JSON-RPC 2.0 over HTTP with Server-Sent Events (SSE)

**Key Responsibilities**:
- Expose 19 MCP tools for AI assistants
- Handle MCP protocol session management
- Track tool execution metrics
- Provide knowledge base search capabilities
- Enable task and project management via MCP

**Tools Provided**:
```python
# Health & Session
- health_check()
- heartbeat()
- session_info()

# Knowledge Base
- rag_get_available_sources()
- rag_search_knowledge_base(query, source_id, match_count)
- rag_search_code_examples(query, source_id, match_count)
- rag_list_pages_for_source(source_id, section)
- rag_read_full_page(page_id, url)

# Project Management
- find_projects(project_id, query, page, per_page)
- manage_project(action, project_id, title, description, github_repo)
- get_project_features(project_id)

# Task Management
- find_tasks(query, task_id, filter_by, filter_value, project_id)
- manage_task(action, task_id, project_id, title, description, status, assignee, ...)
- get_task_history(task_id, field_name, limit)
- get_completion_stats(project_id, days, limit)
- get_task_versions(task_id, field_name, limit)

# Document Management
- find_documents(project_id, document_id, query, document_type)
- manage_document(action, project_id, document_id, title, document_type, content)
- find_versions(project_id, field_name, version_number)
- manage_version(action, project_id, field_name, version_number, content, change_summary)
```

**Session Management**:
- **FastMCP Protocol Sessions**: Managed automatically by FastMCP framework
- **Archon Analytics Sessions**: Created lazily on first tool call for tracking
- See [MCP Session Architecture](../MCP_SESSION_ARCHITECTURE.md) for details

---

### 2. Backend API (Port 8181)

**Technology**: FastAPI + Python 3.12+ + SQLAlchemy
**Purpose**: RESTful API for web UI and external integrations
**Architecture**: Layered architecture with routes, services, and data access

**Key Endpoints**:
```
# Health & Configuration
GET  /health                           # Service health check
GET  /api/credentials/{key}            # Get credential
POST /api/credentials/{key}            # Set credential

# Knowledge Base
GET  /api/sources                      # List knowledge sources
POST /api/sources                      # Create knowledge source
GET  /api/sources/{id}/pages           # List pages for source
POST /api/crawl                        # Start web crawl
GET  /api/crawl/status                 # Get crawl status

# Projects
GET  /api/projects                     # List projects
POST /api/projects                     # Create project
GET  /api/projects/{id}                # Get project details
PUT  /api/projects/{id}                # Update project
POST /api/projects/{id}/archive        # Archive project

# Tasks
GET  /api/tasks                        # List tasks
POST /api/tasks                        # Create task
GET  /api/tasks/{id}                   # Get task details
PUT  /api/tasks/{id}                   # Update task
GET  /api/tasks/{id}/history           # Get task history
GET  /api/tasks/completion-stats       # Get completion stats

# MCP Analytics
GET  /api/mcp/sessions                 # List MCP sessions
GET  /api/mcp/sessions/health          # Session health metrics
GET  /api/mcp/requests                 # List tool execution requests
GET  /api/mcp/analytics                # MCP analytics dashboard
GET  /api/mcp/errors/aggregate         # Error aggregation
GET  /api/mcp/errors/rate              # Error rate metrics
GET  /api/mcp/alerts                   # System alerts

# Backup
GET  /api/backup/status                # Backup status
POST /api/backup/manual                # Trigger manual backup
```

**Data Access Patterns**:
- **PostgREST API**: Primary method via Supabase client (auto-generated REST from PostgreSQL schema)
- **Direct asyncpg**: For new tables not in PostgREST cache (e.g., `archon_mcp_error_logs`)
- **Redis Cache**: For frequently accessed settings and credentials

---

### 3. Dashboard UI - React (Port 3737)

**Technology**: React 18 + Vite + TanStack Query + Tailwind CSS
**Purpose**: Primary web interface for Archon management
**State Management**: Zustand + TanStack Query

**Key Features**:
- **Knowledge Base Management**: Source list, page viewer, crawl interface
- **Project Dashboard**: Project list, task board, Kanban view
- **MCP Dashboard**: Session tracking, tool execution timeline, performance metrics
- **Settings**: Credential management, LLM configuration, RAG strategy

**Component Architecture**:
```
src/
├── components/
│   ├── Knowledge/        # Knowledge base UI
│   ├── Projects/         # Project management UI
│   ├── Tasks/            # Task management UI
│   ├── MCP/              # MCP monitoring UI
│   │   ├── McpStatusBar.tsx
│   │   ├── SessionHealthMetrics.tsx
│   │   ├── ToolExecutionTimeline.tsx
│   │   ├── SlowQueryDashboard.tsx
│   │   └── UnifiedActivityView.tsx
│   └── Settings/         # Configuration UI
├── pages/
│   ├── KnowledgeBasePage.tsx
│   ├── ProjectsPage.tsx
│   ├── McpDashboardPage.tsx
│   └── SettingsPage.tsx
├── services/
│   └── api.ts            # API client
└── stores/
    └── store.ts          # Zustand state management
```

**Data Fetching**:
- TanStack Query for caching, polling, and optimistic updates
- Real-time updates via polling (5-10 second intervals)
- Optimistic UI updates for better UX

---

### 4. Dashboard UI - Next.js (Port 3738)

**Technology**: Next.js 15.5.9 + React 18 + App Router + TanStack Query
**Purpose**: Alternative frontend with SSR capabilities and enhanced performance
**Deployment**: Docker (production) + Local dev (hybrid mode)

**Key Advantages**:
- **Hot Reload**: Instant UI updates during development (vs Docker rebuild)
- **SSR**: Server-side rendering for faster initial page loads
- **App Router**: Next.js 13+ architecture with server components
- **API Proxy**: Automatic CORS handling via Next.js rewrites

**Configuration** (`next.config.ts`):
```typescript
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8181/api/:path*', // Proxy to Backend API
      },
    ];
  },
  reactStrictMode: true,
};
```

**Pages**:
- `/` - Dashboard home
- `/mcp` - MCP session dashboard
- `/mcp/tools` - Tool execution deep dive
- `/knowledge` - Knowledge base management
- `/projects` - Project management
- `/tasks` - Task management

---

### 5. Redis Cache (Port 6379)

**Technology**: Redis 7.x
**Purpose**: High-performance caching layer

**Cached Data**:
- API credentials (encrypted)
- Settings (user preferences, LLM configuration)
- RAG strategy configuration
- Session metadata (fast lookups)

**TTL Strategy**:
- Credentials: 1 hour (refreshed on access)
- Settings: 5 minutes
- Session metadata: 5 minutes

---

### 6. Supabase Stack

**Components**:
- **PostgreSQL 15+**: Primary database with pgvector extension
- **Kong Gateway** (Port 8000): API gateway with PostgREST
- **Auth Service**: Authentication and authorization (future use)
- **PgBouncer** (Port 6543): Connection pooling

**Database Structure**:
```sql
-- Archon tables in shared "postgres" database
archon_settings
archon_sources
archon_crawled_pages
archon_code_examples
archon_page_metadata
archon_projects
archon_tasks
archon_project_sources
archon_document_versions
archon_migrations
archon_prompts
archon_mcp_sessions
archon_mcp_requests
archon_mcp_error_logs
archon_mcp_alerts
```

**See**: [Database Schema](#database-schema) for detailed schema

---

## Network Architecture

### Docker Networks

Archon requires **THREE Docker networks** for full connectivity:

```
┌─────────────────────────────────────────────────────────┐
│  1. localai_default (external)                          │
│     - Supabase PostgreSQL (supabase-ai-db:5432)         │
│     - Required for direct database access               │
│     - Created by local-ai-packaged                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  2. sporterp-ai-unified (external)                      │
│     - Cross-project communication                       │
│     - Integration with SportERP services                │
│     - Optional but recommended                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  3. app-network (internal)                              │
│     - Internal Archon service communication             │
│     - archon-server ↔ archon-mcp ↔ archon-ui          │
│     - Created by docker-compose.yml                     │
└─────────────────────────────────────────────────────────┘
```

### Network Diagram

```mermaid
graph TB
    subgraph "localai_default Network"
        DB[(supabase-ai-db<br/>PostgreSQL + pgvector<br/>172.18.0.20:5432)]
        Kong[supabase-ai-kong<br/>Gateway<br/>172.18.0.32:8000]
        Pooler[supabase-ai-pooler<br/>PgBouncer<br/>172.18.0.31:6543]
    end

    subgraph "sporterp-ai-unified Network"
        ArchonServer[archon-server<br/>FastAPI<br/>172.19.0.6:8181]
        SportERP[sporterp-apps<br/>Next.js + Odoo]
    end

    subgraph "app-network Network"
        ArchonMCP[archon-mcp<br/>MCP Server<br/>Port 8051]
        ArchonUI[archon-ui<br/>React Dashboard<br/>Port 3737]
        Redis[redis-archon<br/>Port 6379]
    end

    ArchonServer -->|Direct asyncpg| DB
    ArchonServer -->|PostgREST API| Kong
    ArchonMCP -->|Direct asyncpg| DB
    ArchonServer -->|Cache| Redis
    ArchonServer <-->|Internal API| ArchonMCP
    ArchonUI -->|REST API| ArchonServer

    SportERP -.->|Optional Integration| ArchonServer

    style DB fill:#e8f5e9
    style ArchonServer fill:#e1f5ff
    style ArchonMCP fill:#e1f5ff
    style ArchonUI fill:#fff9e6
```

**Connection Strings**:
```bash
# Direct PostgreSQL (asyncpg)
DATABASE_URI=postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres

# PostgREST API (Supabase client)
SUPABASE_URL=http://host.docker.internal:18000
SUPABASE_SERVICE_KEY=eyJh...JWT_token...
```

**See**: [Network Architecture & Database Connection](./NETWORK_ARCHITECTURE_AND_DATABASE_CONNECTION.md) for troubleshooting

---

## Data Flow

### 1. Knowledge Base Ingestion

```mermaid
sequenceDiagram
    participant User
    participant UI as Dashboard UI
    participant API as Backend API
    participant LLM as LLM Provider
    participant DB as PostgreSQL

    User->>UI: Initiate web crawl
    UI->>API: POST /api/crawl<br/>{url, source_id}
    API->>API: Start background task
    API-->>UI: {job_id, status: "running"}
    UI->>UI: Poll job status

    loop Crawl Pages
        API->>API: Fetch page content
        API->>LLM: Generate embeddings
        LLM-->>API: Vector embeddings
        API->>DB: INSERT archon_crawled_pages<br/>INSERT archon_page_metadata
    end

    API->>DB: UPDATE archon_sources<br/>status = "completed"
    UI->>API: GET /api/crawl/status
    API-->>UI: {status: "completed", pages: 42}
    UI->>User: Display completion
```

**Key Steps**:
1. User initiates crawl via UI
2. Backend API creates async job
3. Background worker fetches pages
4. LLM generates embeddings for semantic search
5. Pages and metadata stored in PostgreSQL
6. pgvector index enables semantic search

---

### 2. Semantic Search (RAG)

```mermaid
sequenceDiagram
    participant Client as AI Assistant<br/>(Claude Code)
    participant MCP as MCP Server
    participant API as Backend API
    participant LLM as LLM Provider
    participant DB as PostgreSQL

    Client->>MCP: tools/call<br/>rag_search_knowledge_base
    MCP->>LLM: Generate query embedding
    LLM-->>MCP: Query vector [0.234, -0.123, ...]

    MCP->>DB: SELECT * FROM archon_crawled_pages<br/>ORDER BY embedding <=> query_vector<br/>LIMIT 5
    DB-->>MCP: Top 5 matching pages

    alt Reranking Enabled
        MCP->>LLM: Rerank results
        LLM-->>MCP: Reordered results
    end

    MCP->>DB: Track request in archon_mcp_requests
    MCP-->>Client: Return search results
```

**RAG Strategy**:
- **Vector Search**: pgvector cosine similarity (`<=>` operator)
- **Hybrid Search**: Vector + full-text search (BM25)
- **Reranking**: Optional LLM-based reranking of top results
- **Configurable**: Strategy selection via settings

---

### 3. Task Management

```mermaid
sequenceDiagram
    participant User as User/Agent
    participant UI as Dashboard UI
    participant API as Backend API
    participant DB as PostgreSQL

    User->>UI: Create task
    UI->>API: POST /api/tasks<br/>{project_id, title, status: "todo"}
    API->>DB: INSERT archon_tasks
    API->>DB: INSERT archon_task_history<br/>(field: "created")
    DB-->>API: Task created
    API-->>UI: {task_id, status: "todo"}
    UI->>User: Show confirmation

    User->>UI: Update task status
    UI->>API: PUT /api/tasks/{id}<br/>{status: "doing"}
    API->>DB: UPDATE archon_tasks<br/>status = "doing"
    API->>DB: INSERT archon_task_history<br/>(field: "status", old: "todo", new: "doing")
    DB-->>API: Task updated
    API-->>UI: {task_id, status: "doing"}
    UI->>User: Show updated task
```

**Task Lifecycle**:
```
todo → doing → review → done
```

**History Tracking**:
- Every field change recorded in `archon_task_history`
- Audit trail for accountability
- Enables undo/redo (future feature)

---

### 4. MCP Tool Execution

```mermaid
sequenceDiagram
    participant Client as AI Assistant
    participant MCP as MCP Server
    participant API as Backend API
    participant DB as PostgreSQL

    Client->>MCP: Initialize (first request)
    MCP->>MCP: FastMCP creates protocol session
    MCP-->>Client: {session_id: "abc123"}

    Client->>MCP: tools/call health_check<br/>(X-MCP-Session-Id: abc123)

    activate MCP
    MCP->>MCP: @track_tool_execution decorator
    MCP->>MCP: get_or_create_session()<br/>(lazy creation)
    MCP->>DB: INSERT archon_mcp_sessions<br/>(archon_session_id: "def456")

    MCP->>MCP: Execute health_check() tool

    MCP->>DB: INSERT archon_mcp_requests<br/>(session_id: "def456"<br/>tool_name: "health_check"<br/>duration_ms: 45.2)
    deactivate MCP

    MCP-->>Client: Tool result

    Client->>MCP: tools/call find_tasks<br/>(X-MCP-Session-Id: abc123)
    activate MCP
    MCP->>MCP: @track_tool_execution decorator
    MCP->>MCP: context.archon_session_id = "def456"<br/>(reuse existing)
    MCP->>MCP: Execute find_tasks() tool
    MCP->>DB: INSERT archon_mcp_requests<br/>(session_id: "def456"<br/>tool_name: "find_tasks")
    deactivate MCP
    MCP-->>Client: Task results
```

**Session Management**:
- **FastMCP Protocol Session**: Created automatically by FastMCP on first request
- **Archon Analytics Session**: Created lazily on first tool call by `@track_tool_execution` decorator
- **Context-Based Mapping**: `context.archon_session_id` stored in FastMCP lifespan context
- **Session Reuse**: Subsequent tool calls use same Archon session ID from context

**See**: [MCP Session Architecture](../MCP_SESSION_ARCHITECTURE.md) for complete lifecycle

---

## REST API Architecture

### Request/Response Flow

```mermaid
sequenceDiagram
    participant Client
    participant FastAPI
    participant Service
    participant Supabase
    participant DB

    Client->>FastAPI: GET /api/projects?per_page=50
    FastAPI->>FastAPI: Validate request
    FastAPI->>FastAPI: Check authentication (future)

    FastAPI->>Service: ProjectService.list_projects(per_page=50)
    Service->>Supabase: Supabase client query
    Supabase->>DB: PostgREST API call
    DB-->>Supabase: Query result
    Supabase-->>Service: Parsed data
    Service->>Service: Transform data
    Service-->>FastAPI: Pydantic model

    FastAPI->>FastAPI: Serialize response
    FastAPI-->>Client: JSON response
```

### Layered Architecture

```
┌─────────────────────────────────────────────┐
│         API Routes (/api_routes/)           │
│   - Request validation (Pydantic models)    │
│   - Response formatting                     │
│   - Error handling                          │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│      Business Logic (/services/)            │
│   - Domain logic                            │
│   - Orchestration                           │
│   - Data transformation                     │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│       Data Access Layer                     │
│   - Supabase client (PostgREST)             │
│   - Direct asyncpg (for new tables)         │
│   - Redis cache                             │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│       External Services                     │
│   - PostgreSQL (Supabase)                   │
│   - Redis                                   │
│   - LLM APIs                                │
└─────────────────────────────────────────────┘
```

### Error Handling

**HTTP Status Codes**:
- `200 OK`: Successful request
- `201 Created`: Resource created
- `400 Bad Request`: Invalid input
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

**Error Response Format**:
```json
{
  "detail": "Task not found",
  "error_code": "TASK_NOT_FOUND",
  "request_id": "req-123abc",
  "timestamp": "2026-01-12T10:30:00Z"
}
```

---

## MCP Protocol Architecture

### JSON-RPC 2.0 Protocol

**Initialize Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "init-1",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "Claude Code",
      "version": "1.0.0"
    }
  }
}
```

**Initialize Response**:
```json
{
  "jsonrpc": "2.0",
  "id": "init-1",
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "archon-mcp-server",
      "version": "1.0.0"
    }
  }
}
```

**Tool Call Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "tool-1",
  "method": "tools/call",
  "params": {
    "name": "rag_search_knowledge_base",
    "arguments": {
      "query": "FastAPI authentication",
      "match_count": 5
    }
  }
}
```

**Tool Call Response**:
```json
{
  "jsonrpc": "2.0",
  "id": "tool-1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\": true, \"results\": [...]}"
      }
    ],
    "isError": false
  }
}
```

### Session Lifecycle

```
┌─ Server Startup ──────────────────────────┐
│  1. FastMCP.run() initializes             │
│  2. NO Archon sessions created            │
│  3. Server ready to accept connections    │
└───────────────────────────────────────────┘
              ↓
┌─ First Request ───────────────────────────┐
│  1. Client connects (no session ID)       │
│  2. FastMCP creates protocol session      │
│  3. Returns session ID to client          │
└───────────────────────────────────────────┘
              ↓
┌─ First Tool Call ─────────────────────────┐
│  1. @track_tool_execution decorator       │
│  2. get_or_create_session() called        │
│  3. Archon session created in database    │
│  4. context.archon_session_id stored      │
│  5. Tool executes normally                │
│  6. Request tracked in database           │
└───────────────────────────────────────────┘
              ↓
┌─ Subsequent Tool Calls ───────────────────┐
│  1. Decorator reads context.archon_id     │
│  2. Reuses existing session ID            │
│  3. Tool executes normally                │
│  4. Request tracked with same session ID  │
└───────────────────────────────────────────┘
              ↓
┌─ Session Timeout ─────────────────────────┐
│  1. 300 seconds (5 min) of inactivity     │
│  2. Background cleanup job runs           │
│  3. Session status → "disconnected"       │
│  4. Total duration calculated             │
└───────────────────────────────────────────┘
```

**Session Timeout Settings**:
- **Timeout**: 300 seconds (5 minutes)
- **Cleanup Frequency**: Every 60 seconds (1 minute)
- **Heartbeat**: `heartbeat()` MCP tool extends session

**See**: [MCP Session Architecture](../MCP_SESSION_ARCHITECTURE.md)

---

## Frontend Architecture

### React UI (Port 3737)

**State Management**:
- **Zustand**: Global state (user preferences, credentials)
- **TanStack Query**: Server state (caching, polling, optimistic updates)
- **Local State**: Component-specific state (form inputs, UI toggles)

**Data Fetching Pattern**:
```typescript
// TanStack Query hook for data fetching
const { data: projects, isLoading, refetch } = useQuery({
  queryKey: ['projects'],
  queryFn: async () => {
    const response = await fetch('http://localhost:8181/api/projects');
    return response.json();
  },
  refetchInterval: 10000, // Poll every 10 seconds
});

// Optimistic update on mutation
const createProjectMutation = useMutation({
  mutationFn: async (newProject) => {
    const response = await fetch('http://localhost:8181/api/projects', {
      method: 'POST',
      body: JSON.stringify(newProject),
    });
    return response.json();
  },
  onMutate: async (newProject) => {
    // Cancel ongoing queries
    await queryClient.cancelQueries({ queryKey: ['projects'] });

    // Snapshot previous value
    const previousProjects = queryClient.getQueryData(['projects']);

    // Optimistically update
    queryClient.setQueryData(['projects'], (old) => [...old, newProject]);

    return { previousProjects };
  },
  onError: (err, newProject, context) => {
    // Rollback on error
    queryClient.setQueryData(['projects'], context.previousProjects);
  },
  onSettled: () => {
    // Always refetch after mutation
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  },
});
```

### Next.js UI (Port 3738)

**App Router Structure**:
```
archon-ui-nextjs/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home page (/)
│   │   ├── mcp/
│   │   │   ├── page.tsx         # MCP dashboard (/mcp)
│   │   │   └── tools/
│   │   │       └── page.tsx     # Tool analysis (/mcp/tools)
│   │   ├── knowledge/
│   │   │   └── page.tsx         # Knowledge base (/knowledge)
│   │   └── projects/
│   │       └── page.tsx         # Projects (/projects)
│   ├── components/
│   │   ├── MCP/                 # MCP monitoring components
│   │   ├── Knowledge/           # Knowledge base components
│   │   └── Projects/            # Project management components
│   └── lib/
│       └── api.ts               # API client
└── next.config.ts               # Next.js configuration
```

**API Proxy** (`next.config.ts`):
```typescript
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8181/api/:path*', // Proxy to Backend API
      },
    ];
  },
};
```

**Benefits**:
- **No CORS Issues**: Proxy handles cross-origin requests
- **SSR**: Server-side rendering for faster initial loads
- **Streaming**: React Server Components for incremental rendering
- **Automatic Code Splitting**: Per-route bundles

---

## Database Schema

### Core Tables

**Knowledge Base**:
```sql
-- Sources (websites, PDFs, documents)
archon_sources (
  id UUID PRIMARY KEY,
  title VARCHAR,
  url VARCHAR,
  source_type VARCHAR,
  status VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Crawled pages with embeddings
archon_crawled_pages (
  id UUID PRIMARY KEY,
  source_id UUID REFERENCES archon_sources,
  url VARCHAR,
  title VARCHAR,
  content TEXT,
  embedding VECTOR(1536),  -- pgvector
  created_at TIMESTAMP
)

-- Code examples with embeddings
archon_code_examples (
  id UUID PRIMARY KEY,
  source_id UUID REFERENCES archon_sources,
  code TEXT,
  language VARCHAR,
  summary TEXT,
  embedding VECTOR(1536),  -- pgvector
  created_at TIMESTAMP
)
```

**Project & Task Management**:
```sql
-- Projects
archon_projects (
  id UUID PRIMARY KEY,
  title VARCHAR NOT NULL,
  description TEXT,
  github_repo VARCHAR,
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP,
  archived_by VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Tasks
archon_tasks (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES archon_projects,
  title VARCHAR NOT NULL,
  description TEXT,
  status VARCHAR DEFAULT 'todo',  -- todo, doing, review, done
  priority VARCHAR DEFAULT 'medium',  -- low, medium, high
  assignee VARCHAR,  -- Agent name or "User"
  task_type VARCHAR,  -- research, implementation, testing, documentation
  estimated_hours DECIMAL,
  actual_hours DECIMAL,
  task_order INTEGER,
  feature VARCHAR,  -- Feature grouping
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP
)

-- Task history (audit trail)
archon_task_history (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES archon_tasks,
  field_name VARCHAR,
  old_value TEXT,
  new_value TEXT,
  changed_by VARCHAR,
  changed_at TIMESTAMP
)
```

**MCP Analytics**:
```sql
-- MCP sessions
archon_mcp_sessions (
  session_id UUID PRIMARY KEY,
  client_type VARCHAR,
  client_version VARCHAR,
  status VARCHAR,  -- active, disconnected
  connected_at TIMESTAMP,
  last_activity TIMESTAMP,
  disconnected_at TIMESTAMP,
  disconnect_reason VARCHAR,
  total_duration_ms INTEGER
)

-- MCP tool execution requests
archon_mcp_requests (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES archon_mcp_sessions,
  method VARCHAR,  -- tools/call, resources/read, etc.
  tool_name VARCHAR,
  request_params JSONB,
  response_data JSONB,
  status VARCHAR,  -- success, error, timeout
  error_message TEXT,
  timestamp TIMESTAMP,
  duration_ms DECIMAL,
  token_count INTEGER
)

-- Error logs
archon_mcp_error_logs (
  error_id UUID PRIMARY KEY,
  session_id UUID REFERENCES archon_mcp_sessions,
  tool_name VARCHAR,
  error_type VARCHAR,  -- network, database, mcp_protocol, tool_execution, other
  severity VARCHAR,  -- low, medium, high, critical
  error_message TEXT,
  stack_trace TEXT,
  timestamp TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE
)
```

### Indexes

**Performance Optimization**:
```sql
-- pgvector indexes for semantic search
CREATE INDEX idx_crawled_pages_embedding
  ON archon_crawled_pages
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_code_examples_embedding
  ON archon_code_examples
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Task queries
CREATE INDEX idx_tasks_project_id ON archon_tasks(project_id);
CREATE INDEX idx_tasks_status ON archon_tasks(status);
CREATE INDEX idx_tasks_assignee ON archon_tasks(assignee);

-- MCP analytics
CREATE INDEX idx_mcp_requests_session_id ON archon_mcp_requests(session_id);
CREATE INDEX idx_mcp_requests_timestamp ON archon_mcp_requests(timestamp);
CREATE INDEX idx_mcp_requests_tool_name ON archon_mcp_requests(tool_name);
```

---

## Deployment Scenarios

### 1. Development (Local)

```
┌─────────────────────────────────────────┐
│  Local Machine                          │
├─────────────────────────────────────────┤
│  Docker Desktop                         │
│  ├─ Supabase (local-ai-packaged)       │
│  ├─ Archon Services (docker-compose)   │
│  └─ Redis                               │
├─────────────────────────────────────────┤
│  Node.js (local - optional)             │
│  └─ Next.js dev server (port 3738)     │
└─────────────────────────────────────────┘
```

**Start Commands**:
```bash
# 1. Start Supabase (prerequisite)
cd ~/Documents/Projects/local-ai-packaged
python start_services.py --profile gpu-amd --amd-backend llamacpp-vulkan

# 2. Start Archon
cd ~/Documents/Projects/archon
./start-archon.sh

# 3. (Optional) Start Next.js locally for fast hot-reload
./scripts/dev-nextjs-local.sh
```

**Access**:
- React UI: http://localhost:3737
- Next.js UI: http://localhost:3738
- Backend API: http://localhost:8181
- MCP Server: http://localhost:8051

---

### 2. Production (Cloud)

```
┌─────────────────────────────────────────┐
│  Supabase Cloud                         │
│  ├─ PostgreSQL (managed)                │
│  ├─ Kong Gateway                        │
│  └─ Auth Service                        │
└─────────────────────────────────────────┘
              ↓ HTTPS
┌─────────────────────────────────────────┐
│  Docker Host (VPS/Cloud VM)             │
├─────────────────────────────────────────┤
│  Docker Compose                         │
│  ├─ archon-server (8181)                │
│  ├─ archon-mcp (8051)                   │
│  ├─ archon-ui (3737/3738)               │
│  └─ redis-archon (6379)                 │
├─────────────────────────────────────────┤
│  Nginx Reverse Proxy                    │
│  ├─ SSL/TLS termination                 │
│  ├─ Rate limiting                       │
│  └─ Load balancing (future)             │
└─────────────────────────────────────────┘
              ↓ HTTPS
┌─────────────────────────────────────────┐
│  CDN (Cloudflare)                       │
│  ├─ DDoS protection                     │
│  ├─ Caching                             │
│  └─ Global distribution                 │
└─────────────────────────────────────────┘
```

**Environment Configuration**:
```bash
# .env (production)
DATABASE_URI=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_KEY=eyJh...LONG_JWT_TOKEN...
ENVIRONMENT=production
LOG_LEVEL=warning
```

**Deployment Steps**:
1. Build Docker images: `docker compose build`
2. Push to registry: `docker push archon-server:latest`
3. Deploy to cloud VM: `docker compose up -d`
4. Configure Nginx reverse proxy
5. Set up SSL certificates (Let's Encrypt)
6. Configure CDN (optional)

---

### 3. Hybrid (Development Frontend + Cloud Backend)

```
┌─────────────────────────────────────────┐
│  Local Machine                          │
├─────────────────────────────────────────┤
│  Next.js Dev Server (port 3738)         │
│  └─ Hot reload enabled                  │
└─────────────────────────────────────────┘
              ↓ HTTPS
┌─────────────────────────────────────────┐
│  Cloud Backend                          │
│  ├─ archon-server (API)                 │
│  ├─ archon-mcp (MCP)                    │
│  ├─ Supabase (Database)                 │
│  └─ Redis (Cache)                       │
└─────────────────────────────────────────┘
```

**Use Case**: Frontend development with production backend/database

**Configuration** (`archon-ui-nextjs/next.config.ts`):
```typescript
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://archon.example.com/api/:path*', // Cloud API
      },
    ];
  },
};
```

---

## Integration Points

### 1. AI Coding Assistants (MCP Protocol)

**Supported Clients**:
- Claude Code (recommended)
- Cursor
- Windsurf
- Cline (VSCode extension)

**Configuration Example** (Claude Code):
```json
{
  "mcpServers": {
    "archon": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "http://localhost:8051/mcp",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json, text/event-stream",
        "-d", "@-"
      ],
      "env": {
        "MCP_SERVER_NAME": "archon-mcp-server"
      }
    }
  }
}
```

**See**: [MCP Client Setup Guide](../MCP_CLIENT_SETUP.md)

---

### 2. LLM Providers

**Supported Providers**:
- OpenAI (GPT-4, GPT-3.5)
- Gemini (Pro, Flash)
- Ollama (local models)

**Configuration** (via Dashboard UI):
```typescript
// Settings > Credentials
{
  "OPENAI_API_KEY": "sk-proj-...",
  "OPENAI_EMBEDDING_MODEL": "text-embedding-3-small",
  "GEMINI_API_KEY": "AIzaSy...",
  "OLLAMA_HOST": "http://localhost:11434"
}
```

**Embedding Models**:
- OpenAI: `text-embedding-3-small` (1536 dimensions)
- Ollama: `nomic-embed-text` (768 dimensions)

---

### 3. External Services

**Supabase**:
- PostgREST API for data access
- Auth service for authentication (future)
- Storage for file uploads (future)

**Redis**:
- Credential caching (encrypted)
- Settings caching
- Session metadata

**LLM APIs**:
- Embedding generation
- Reranking (optional)
- Content summarization

---

## Security Architecture

### Authentication & Authorization

**Current State** (v1.0):
- **No authentication**: Open access for single-user deployment
- **Trust model**: Assumes trusted local network

**Future** (Multi-User):
- **JWT-based authentication**: Bearer tokens
- **Role-based access control** (RBAC):
  - Admin: Full access
  - User: Read/write own projects
  - Viewer: Read-only access
- **API key authentication** for MCP clients

### Data Security

**Encryption**:
- **At Rest**: PostgreSQL encryption (Supabase managed)
- **In Transit**: HTTPS for production deployments
- **Credentials**: Encrypted in Redis cache

**API Keys**:
- **Storage**: Encrypted in Redis + Supabase settings
- **Rotation**: Manual (future: automatic rotation)
- **Exposure Prevention**: Never logged or returned in API responses

### Network Security

**Production Recommendations**:
- **Firewall**: Only expose ports 443 (HTTPS)
- **Rate Limiting**: Nginx or Cloudflare
- **DDoS Protection**: Cloudflare
- **VPN**: For MCP server access (alternative to public exposure)

---

## Performance Considerations

### Bottlenecks

1. **pgvector Search**: O(n) for exhaustive search, O(√n) with IVFFlat index
2. **Embedding Generation**: ~100ms per query (OpenAI API)
3. **Database Queries**: ~10-50ms with proper indexes
4. **Redis Cache**: ~1-2ms for hits

### Optimization Strategies

**Caching**:
- **Redis**: Credentials, settings (5 min TTL)
- **TanStack Query**: API responses (10s polling)
- **Browser Cache**: Static assets (1 year)

**Database**:
- **Indexes**: All foreign keys, search fields
- **Connection Pooling**: PgBouncer (6543)
- **Query Optimization**: Use `EXPLAIN ANALYZE`

**Frontend**:
- **Code Splitting**: Per-route bundles (Next.js automatic)
- **Lazy Loading**: Components loaded on demand
- **Image Optimization**: Next.js Image component

### Scalability

**Current Limits** (Single Server):
- **MCP Sessions**: ~1000 concurrent sessions
- **API Requests**: ~100 req/s
- **Database**: ~10,000 tasks, ~100,000 pages

**Horizontal Scaling** (Future):
- **Load Balancer**: Nginx or AWS ALB
- **Multiple Backend Instances**: Stateless design enables scaling
- **Database Read Replicas**: Supabase supports replicas
- **Redis Cluster**: For distributed caching

---

## Monitoring & Observability

### Health Checks

**Endpoints**:
```bash
# Backend API
curl http://localhost:8181/health
# {"status":"healthy","service":"archon-api"}

# MCP Server
curl http://localhost:8051/health
# {"status":"healthy","service":"archon-mcp"}
```

### Metrics

**MCP Analytics Dashboard** (http://localhost:3738/mcp):
- **Session Health**: Active sessions, connection duration
- **Tool Execution**: Request rate, duration, error rate
- **Performance**: P50/P95/P99 latencies, slow queries (>2s)

**Database Queries**:
```sql
-- Session count
SELECT COUNT(*) FROM archon_mcp_sessions WHERE status = 'active';

-- Average request duration
SELECT AVG(duration_ms) FROM archon_mcp_requests WHERE status = 'success';

-- Error rate
SELECT
  COUNT(*) FILTER (WHERE status = 'error') * 100.0 / COUNT(*) AS error_rate_percent
FROM archon_mcp_requests
WHERE timestamp > NOW() - INTERVAL '1 hour';
```

### Logging

**Log Levels**:
- **DEBUG**: Detailed tracing (development)
- **INFO**: Normal operations (production)
- **WARNING**: Recoverable issues
- **ERROR**: Failures requiring attention
- **CRITICAL**: System-wide failures

**Log Aggregation** (Future):
- **Loki**: Log aggregation
- **Grafana**: Visualization
- **Prometheus**: Metrics collection

---

## Troubleshooting Guide

### Common Issues

**1. Services Not Starting**
```bash
# Check inotify limit (Linux)
sysctl fs.inotify.max_user_watches
# Should be 524288

# Fix if needed
sudo sysctl fs.inotify.max_user_watches=524288
sudo sysctl -p
```

**2. Database Connection Failures**
```bash
# Verify networks exist
docker network ls | grep -E "localai_default|sporterp-ai-unified"

# Check Supabase is running
docker ps | grep supabase-ai-db

# Test connection
docker exec -it supabase-ai-db psql -U postgres -c "SELECT 1"
```

**3. MCP Sessions Not Created**
```bash
# Check MCP logs
docker logs archon-mcp-server 2>&1 | grep -i "session"

# Verify database tracking
docker exec supabase-ai-db psql -U postgres -d postgres \
  -c "SELECT * FROM archon_mcp_sessions ORDER BY connected_at DESC LIMIT 5;"
```

**See**: [Troubleshooting & Startup Fixes](../operations/TROUBLESHOOTING_STARTUP_FIXES.md)

---

## Documentation Index

### Architecture Documentation
- [MCP Session Architecture](../MCP_SESSION_ARCHITECTURE.md) - Detailed session lifecycle
- [Network Architecture & Database Connection](./NETWORK_ARCHITECTURE_AND_DATABASE_CONNECTION.md) - Network troubleshooting
- [Database Migration 2025-12](./DATABASE_MIGRATION_2025-12.md) - Migration history

### Setup & Configuration
- [MCP Client Setup Guide](../MCP_CLIENT_SETUP.md) - Configure AI coding assistants
- [Testing MCP Session Tracking](../TESTING_MCP_SESSION_TRACKING.md) - Manual testing guide

### Operations
- [Backups](../operations/BACKUPS.md) - Backup procedures
- [Disaster Recovery](../operations/DISASTER_RECOVERY.md) - Recovery workflows
- [Troubleshooting](../operations/TROUBLESHOOTING_STARTUP_FIXES.md) - Common issues

### Claude Integration
- [.claude/CLAUDE.md](../../.claude/CLAUDE.md) - AI assistant guidance
- [.claude/docs/API_REFERENCE.md](../../.claude/docs/API_REFERENCE.md) - Complete API docs
- [.claude/docs/AGENTIC_WORKFLOW.md](../../.claude/docs/AGENTIC_WORKFLOW.md) - Agent workflow phases

---

## Glossary

| Term | Definition |
|------|------------|
| **MCP** | Model Context Protocol - Standard protocol for AI assistant integration |
| **FastMCP** | Framework for building MCP servers in Python |
| **pgvector** | PostgreSQL extension for vector similarity search |
| **RAG** | Retrieval-Augmented Generation - LLM technique using external knowledge |
| **PostgREST** | Auto-generated REST API from PostgreSQL schema (Supabase feature) |
| **Lazy Creation** | Creating resources only when first needed, not at startup |
| **Supabase** | Open-source Firebase alternative with PostgreSQL backend |
| **TanStack Query** | React library for server state management (formerly React Query) |
| **IVFFlat** | Inverted File Index for approximate nearest neighbor search (pgvector) |

---

**Document Version**: 1.0
**Created By**: documentation-expert agent
**Date**: 2026-01-12
**Status**: Active

**Related Documents**:
- [MCP Session Architecture](../MCP_SESSION_ARCHITECTURE.md)
- [Network Architecture](./NETWORK_ARCHITECTURE_AND_DATABASE_CONNECTION.md)
- [API Reference](../../.claude/docs/API_REFERENCE.md)
