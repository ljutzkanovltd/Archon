# CopilotKit & AG-UI Integration Research
**Research Date:** 2026-01-28
**Target:** Agent-Aware Knowledge Base Access for Archon
**Version:** CopilotKit v1.50+ (Latest as of January 2026)

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [CopilotKit Architecture](#copilotkit-architecture)
3. [AG-UI Protocol](#ag-ui-protocol)
4. [Knowledge Base Integration Patterns](#knowledge-base-integration-patterns)
5. [Multi-Tenant Context & Permissions](#multi-tenant-context--permissions)
6. [Implementation Recommendations](#implementation-recommendations)
7. [Code Examples](#code-examples)
8. [Security Considerations](#security-considerations)
9. [References](#references)

---

## Executive Summary

### What is CopilotKit?

CopilotKit is an **open-source agentic application framework** (MIT license, 28.2k+ GitHub stars) that provides:
- React UI components and headless APIs for AI copilots
- Backend runtime (`CopilotRuntime`) for LLM orchestration
- Agent integration protocols (AG-UI, MCP, A2A)
- Production-ready infrastructure with built-in security

**Key Capabilities:**
- ✅ Generative UI (agent-driven interfaces)
- ✅ Bidirectional state synchronization
- ✅ RAG/Knowledge base integration
- ✅ Multi-agent orchestration
- ✅ Human-in-the-loop workflows

### What is AG-UI?

**AG-UI (Agentic UI)** is an open, lightweight protocol that defines the bridge between backend AI agents and frontend UIs.

**Protocol Characteristics:**
- Event-based JSON streaming over HTTP/SSE
- Standardized message format (TEXT_MESSAGE_CONTENT, TOOL_CALL, STATE_DELTA, etc.)
- Transport-agnostic (HTTP+SSE default, WebSocket support)
- Framework-agnostic (works with LangGraph, CrewAI, PydanticAI, etc.)

**Relationship:** CopilotKit was the original creator of AG-UI and provides first-party React/Angular clients.

### Research Verdict for Archon

**Recommended Architecture:** ✅ CopilotKit + Custom MCP Integration

**Why:**
1. **Native MCP Support** - CopilotKit has built-in MCP client capabilities
2. **RAG-Ready** - Proven patterns for vector search integration
3. **Multi-Tenant Capable** - Support for user context via `useCopilotReadable`
4. **Production-Ready** - Battle-tested with 28k+ stars, enterprise deployments
5. **Archon Alignment** - Complements existing MCP server architecture

---

## CopilotKit Architecture

### Core Components

#### 1. Frontend Layer (React-based)

```
┌─────────────────────────────────────────┐
│         CopilotKit Provider             │
│  ┌───────────────────────────────────┐  │
│  │  UI Components                    │  │
│  │  - CopilotChat                    │  │
│  │  - CopilotPopup                   │  │
│  │  - CopilotSidebar                 │  │
│  │  - Headless (custom UI)           │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  React Hooks                      │  │
│  │  - useCopilotChat                 │  │
│  │  - useCopilotReadable             │  │
│  │  - useFrontendTool                │  │
│  │  - useAgent                       │  │
│  │  - useCoAgent                     │  │
│  │  - useRenderToolCall              │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

#### 2. Backend Layer (Node.js/Python)

```
┌─────────────────────────────────────────┐
│         CopilotRuntime                  │
│  ┌───────────────────────────────────┐  │
│  │  LLM Adapters                     │  │
│  │  - OpenAIAdapter                  │  │
│  │  - AnthropicAdapter               │  │
│  │  - GroqAdapter                    │  │
│  │  - GoogleGenerativeAIAdapter      │  │
│  │  - LangChainAdapter               │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Agent Integration                │  │
│  │  - LangGraph                      │  │
│  │  - CrewAI                         │  │
│  │  - Remote Python Endpoints        │  │
│  │  - MCP Servers                    │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Action Execution Engine          │  │
│  │  - Frontend Tools                 │  │
│  │  - Backend Actions                │  │
│  │  - Tool Call Rendering            │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Key React Hooks

#### `useCopilotReadable`
**Purpose:** Provide application state/context to the agent without function calls

```tsx
import { useCopilotReadable } from '@copilotkit/react-core';

function UserContext() {
  const user = useCurrentUser();

  useCopilotReadable({
    description: "Current user context with permissions",
    value: {
      userId: user.id,
      role: user.role,
      departments: user.departments,
      accessibleProjects: user.accessibleProjects
    }
  });

  return null; // Context provider, no UI
}
```

**Use Cases:**
- User authentication state
- Accessible resource IDs (projects, documents)
- User preferences/settings
- Current application state

#### `useCopilotAction`
**Purpose:** Define callable actions for the agent

```tsx
useCopilotAction({
  name: "FetchKnowledgebaseArticles",
  description: "Search knowledge base for user-accessible content",
  parameters: [
    {
      name: "query",
      type: "string",
      description: "Search query",
      required: true
    }
  ],
  handler: async ({ query }) => {
    // Backend execution with user context
    return await searchKnowledgeBase(query);
  },
  render: "Searching knowledge base..."
});
```

#### `useAgent` (v1.50+)
**Purpose:** Programmatic control over agent lifecycle

```tsx
const agent = useAgent({
  name: "KnowledgeAssistant",
  initialState: { scope: "user" }
});

// Access messages, state, execution
agent.messages // Chat history
agent.state    // Shared state
agent.run()    // Execute agent
```

### Backend Runtime Setup

```typescript
import { CopilotRuntime } from '@copilotkit/runtime';
import { OpenAIAdapter } from '@copilotkit/runtime-openai';

const runtime = new CopilotRuntime({
  actions: () => [
    {
      name: 'SearchArchonKB',
      description: 'Search Archon knowledge base with user scope',
      handler: async ({ query, userId, scope }) => {
        // Access user context from request
        const userContext = req.headers['x-user-context'];

        // Filter RAG results by user permissions
        const results = await archonMCP.search({
          query,
          source_id: scope === 'global' ? null : userContext.projectId,
          filter: (doc) => doc.permissions.includes(userId)
        });

        return { articles: results };
      }
    }
  ]
});

// Connect to LLM
const serviceAdapter = new OpenAIAdapter({ model: "gpt-4" });

// Handle requests
app.post('/copilot', async (req, res) => {
  const response = await runtime.process({
    messages: req.body.messages,
    serviceAdapter
  });

  res.json(response);
});
```

---

## AG-UI Protocol

### Protocol Specification

**AG-UI** standardizes agent-to-UI communication through typed JSON events.

#### Transport Layer

```
┌─────────────┐         HTTP POST           ┌──────────────┐
│   Frontend  │  ────────────────────────>   │    Backend   │
│   (React)   │                              │    Agent     │
│             │  <────────────────────────   │              │
└─────────────┘    SSE Event Stream         └──────────────┘
```

**Default:** HTTP + Server-Sent Events (SSE)
**Alternatives:** WebSocket, Binary streams

#### Event Types

| Event Type | Purpose | Example Use Case |
|------------|---------|------------------|
| `TEXT_MESSAGE_CONTENT` | Streaming text tokens | Agent responses |
| `TOOL_CALL_START` | Tool invocation start | "Searching KB..." |
| `TOOL_CALL_END` | Tool completion | Results returned |
| `STATE_DELTA` | Incremental state patches | Update UI elements |
| `RUN_ERROR` | Error notifications | Graceful failure |
| `RUN_FINISHED` | Completion signal | Agent done |
| `SESSION_*` | Session management | Pause/resume/cancel |

#### Event Structure

```json
{
  "type": "TOOL_CALL_START",
  "timestamp": "2026-01-28T10:30:00Z",
  "data": {
    "tool_name": "SearchArchonKB",
    "args": {
      "query": "authentication patterns",
      "scope": "project"
    }
  }
}
```

```json
{
  "type": "STATE_DELTA",
  "timestamp": "2026-01-28T10:30:05Z",
  "data": {
    "searchResults": [
      {
        "url": "https://...",
        "title": "JWT Authentication Guide",
        "similarity": 0.89
      }
    ]
  }
}
```

### Security Model

**Built-in Security:**
- ✅ CORS support
- ✅ Authentication token passing
- ✅ Audit logging capabilities
- ✅ Self-hosted friendly (data ownership)

**Enterprise Readiness:**
- Works through standard infrastructure (firewalls, proxies, CDNs)
- Stateless protocol (no persistent WebSocket connections required)
- Compatible with load balancers

### Protocol Layering

```
┌──────────────────────────────────────┐
│      User Interface Layer            │  <-- AG-UI
├──────────────────────────────────────┤
│      Agent Coordination Layer        │  <-- A2A (Agent-to-Agent)
├──────────────────────────────────────┤
│      Tool/Context Layer              │  <-- MCP (Model Context Protocol)
└──────────────────────────────────────┘
```

**Key Insight:** AG-UI sits **above** MCP. CopilotKit can connect to MCP servers via AG-UI bridge.

---

## Knowledge Base Integration Patterns

### Pattern 1: Direct RAG Integration (Recommended for Archon)

**Architecture:**
```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  CopilotKit │ --> │  CopilotRuntime │ --> │   Archon MCP │
│   Frontend  │     │    + Actions    │     │    Server    │
└─────────────┘     └─────────────────┘     └──────────────┘
                              |
                              v
                    ┌─────────────────┐
                    │ Supabase + pgvector │
                    └─────────────────┘
```

**Implementation:**

```typescript
// 1. Frontend: Define knowledge base action
useCopilotAction({
  name: "SearchArchonKnowledge",
  description: "Search Archon knowledge base with user scope filtering",
  parameters: [
    {
      name: "query",
      type: "string",
      description: "Natural language search query",
      required: true
    },
    {
      name: "scope",
      type: "string",
      enum: ["global", "project", "user"],
      description: "Search scope",
      required: false
    }
  ],
  handler: async ({ query, scope = "project" }) => {
    // This calls backend API
    const response = await fetch('/api/copilot/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}` // Pass user token
      },
      body: JSON.stringify({ query, scope })
    });

    return await response.json();
  },
  render: ({ status, args, result }) => {
    if (status === 'executing') {
      return <div>Searching knowledge base for: {args.query}</div>;
    }
    return <KnowledgeResults results={result.articles} />;
  }
});

// 2. Backend: Handle search with Archon MCP
import { CopilotRuntime } from '@copilotkit/runtime';

const runtime = new CopilotRuntime({
  actions: () => [
    {
      name: 'SearchArchonKnowledge',
      handler: async ({ query, scope }, { userId, projectIds }) => {
        // Extract user context from request middleware
        const userContext = await getUserContext(userId);

        // Call Archon MCP with scope filtering
        let source_id = null;
        if (scope === 'project' && projectIds.length > 0) {
          source_id = projectIds[0]; // Filter to current project
        }

        const results = await archonMCP.rag_search_knowledge_base({
          query,
          source_id,
          match_count: 5,
          return_mode: "pages"
        });

        // Filter results by user permissions
        const accessibleResults = results.filter(doc =>
          hasAccess(userContext, doc)
        );

        return { articles: accessibleResults };
      }
    }
  ]
});
```

### Pattern 2: Vector Database Integration (Pinecone Example)

**Full Implementation from CopilotKit Docs:**

```typescript
// 1. Initialize Pinecone
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

const initializePinecone = async () => {
  const indexName = 'knowledge-base';
  const model = 'multilingual-e5-large';

  // Create index if doesn't exist
  const indexList = await pinecone.listIndexes();
  if (!indexList.indexes?.some(index => index.name === indexName)) {
    await pinecone.createIndex({
      name: indexName,
      dimension: 1024,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
  }

  return pinecone.index(indexName);
};

// 2. Index documents with user scope
const indexDocuments = async (documents) => {
  const index = await initializePinecone();

  // Generate embeddings
  const embeddings = await pinecone.inference.embed(
    'multilingual-e5-large',
    documents.map(d => d.content),
    { inputType: 'passage', truncate: 'END' }
  );

  // Prepare records with metadata (including user permissions)
  const records = documents.map((doc, i) => ({
    id: doc.id,
    values: embeddings[i]?.values ?? [],
    metadata: {
      text: doc.content,
      userId: doc.userId,
      projectId: doc.projectId,
      permissions: doc.permissions, // ['user:123', 'project:456']
      scope: doc.scope // 'global', 'project', 'user'
    }
  }));

  // Upsert to namespace (use projectId as namespace for isolation)
  await index.namespace(doc.projectId || 'global').upsert(records);
};

// 3. Query with scope filtering
const searchKnowledgeBase = async (query, userContext) => {
  const index = await initializePinecone();

  // Generate query embedding
  const queryEmbedding = await pinecone.inference.embed(
    'multilingual-e5-large',
    [query],
    { inputType: 'query' }
  );

  // Search in user's project namespace
  const namespace = userContext.projectId || 'global';
  const queryResponse = await index.namespace(namespace).query({
    topK: 5,
    vector: queryEmbedding[0]?.values || [],
    includeValues: false,
    includeMetadata: true,
    filter: {
      // Pinecone metadata filtering for permissions
      permissions: { $in: [
        `user:${userContext.userId}`,
        `project:${userContext.projectId}`,
        'public'
      ]}
    }
  });

  return queryResponse.matches || [];
};

// 4. CopilotKit action
useCopilotAction({
  name: "FetchKnowledgebaseArticles",
  description: "Search user-accessible knowledge base articles",
  parameters: [
    {
      name: "query",
      type: "string",
      description: "Search query",
      required: true
    }
  ],
  handler: async ({ query }) => {
    const userContext = getCurrentUserContext(); // From React context
    const results = await searchKnowledgeBase(query, userContext);
    return { articles: results };
  },
  render: "Searching your knowledge base..."
});
```

### Pattern 3: MCP Server Integration

**CopilotKit → MCP Bridge:**

```typescript
// 1. Configure MCP server in CopilotKit
import { useCopilotChat } from '@copilotkit/react-core';

function MCPIntegration() {
  const { setMcpServers } = useCopilotChat();

  useEffect(() => {
    setMcpServers([
      {
        endpoint: 'http://localhost:8051/mcp', // Archon MCP
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'X-User-Context': JSON.stringify({
            userId: user.id,
            projectIds: user.accessibleProjects
          })
        }
      }
    ]);
  }, [userToken, user]);

  return null;
}

// 2. MCP server exposes tools automatically
// CopilotKit discovers and calls them via AG-UI protocol
```

**Archon MCP Tools Available:**
- `rag_search_knowledge_base` - Semantic search with source filtering
- `rag_read_full_page` - Retrieve complete document
- `find_projects` - List accessible projects
- `find_tasks` - Search tasks with filters
- `manage_task` - Create/update tasks

---

## Multi-Tenant Context & Permissions

### Challenge: User Scope Filtering

CopilotKit **does not enforce multi-tenant permissions natively**. You must implement:

1. **Frontend Context Filtering** - Only pass accessible data via `useCopilotReadable`
2. **Backend Validation** - Verify user permissions before RAG queries
3. **Database-Level Filtering** - Use metadata filters in vector searches

### Solution: Three-Tier Filtering

#### Tier 1: Frontend Context (useCopilotReadable)

```tsx
import { useCopilotReadable } from '@copilotkit/react-core';

function UserContextProvider({ user, projects }) {
  // Only expose user-accessible data to agent
  useCopilotReadable({
    description: "User's accessible projects and permissions",
    value: {
      userId: user.id,
      role: user.role,
      accessibleProjects: projects.map(p => p.id),
      permissions: user.permissions
    }
  });

  // Expose current project context
  useCopilotReadable({
    description: "Current active project",
    value: {
      projectId: currentProject.id,
      projectName: currentProject.title,
      userRole: currentProject.userRole // 'owner', 'member', 'viewer'
    }
  });

  return <CopilotKit>{children}</CopilotKit>;
}
```

#### Tier 2: Backend Middleware Validation

```typescript
// Middleware to extract and validate user context
app.use('/api/copilot', async (req, res, next) => {
  try {
    // Extract JWT from Authorization header
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user permissions from database
    const user = await db.users.findOne({ id: decoded.userId });
    const projects = await db.projects.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } }
        ]
      }
    });

    // Attach to request for action handlers
    req.userContext = {
      userId: user.id,
      role: user.role,
      projectIds: projects.map(p => p.id),
      permissions: user.permissions
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// CopilotRuntime with middleware
const runtime = new CopilotRuntime({
  actions: (request) => {
    const { userContext } = request;

    return [
      {
        name: 'SearchKnowledgeBase',
        handler: async ({ query, scope }) => {
          // Validate scope against user context
          if (scope === 'project' && !userContext.projectIds.includes(currentProjectId)) {
            throw new Error('Access denied to project');
          }

          // Filter RAG results
          const results = await searchWithScope(query, userContext);
          return { articles: results };
        }
      }
    ];
  }
});
```

#### Tier 3: Database-Level Filtering

**For Archon (Supabase + pgvector):**

```sql
-- Row-Level Security (RLS) policies
CREATE POLICY "Users can read own documents"
ON archon_crawled_pages
FOR SELECT
USING (
  -- Global scope
  scope = 'global'
  OR
  -- User scope
  (scope = 'user' AND user_id = auth.uid())
  OR
  -- Project scope (check membership)
  (scope = 'project' AND EXISTS (
    SELECT 1 FROM archon_project_members
    WHERE project_id = archon_crawled_pages.project_id
    AND user_id = auth.uid()
  ))
);

-- Vector search with RLS
SELECT
  url,
  section_title,
  content,
  1 - (embedding <=> query_embedding) as similarity
FROM archon_crawled_pages
WHERE
  -- RLS policy automatically filters
  1 - (embedding <=> query_embedding) > 0.7
ORDER BY embedding <=> query_embedding
LIMIT 5;
```

**For Pinecone:**

```typescript
// Namespace isolation (one namespace per project)
const index = pinecone.index('knowledge-base');
const projectNamespace = index.namespace(userContext.projectId);

// Metadata filtering for fine-grained permissions
const results = await projectNamespace.query({
  vector: queryEmbedding,
  topK: 5,
  filter: {
    permissions: {
      $in: [
        `user:${userContext.userId}`,
        `role:${userContext.role}`,
        'public'
      ]
    },
    scope: { $in: ['global', 'project'] }
  }
});
```

### Known Issues & Workarounds

#### Issue 1: Custom Context Properties Not Passed to Agent
**Problem:** Only `options.properties.authorization` works, custom properties like `options.properties.tenantId` are ignored.

**Workaround:**
```typescript
// Use authorization property for custom context
runtime.middleware({
  onBeforeRequest: async (req, options) => {
    // Encode custom context in authorization property
    options.properties.authorization = JSON.stringify({
      token: req.headers.authorization,
      tenantId: req.headers['x-tenant-id'],
      userId: req.user.id,
      projectIds: req.user.projectIds
    });
  }
});

// Decode in action handler
actions: (request) => {
  const context = JSON.parse(request.properties.authorization);
  // Use context.tenantId, context.userId, etc.
}
```

#### Issue 2: Context Data Not Accessible by Agent
**Problem:** GitHub issue #2528 - `useCopilotReadable` context missing in agent

**Workaround:**
```typescript
// Explicitly pass context through action parameters
useCopilotAction({
  name: "SearchKB",
  // Include context in description (LLM sees this)
  description: `Search knowledge base. User context: ${JSON.stringify(userContext)}`,
  handler: async ({ query }) => {
    // Access global user context separately
    const context = useUserContext();
    return await search(query, context);
  }
});
```

---

## Implementation Recommendations

### Recommended Architecture for Archon

```
┌──────────────────────────────────────────────────────────┐
│                   Archon UI (Next.js)                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │          CopilotKit Frontend Integration           │  │
│  │  - <CopilotKit publicApiKey="...">                │  │
│  │  - useCopilotReadable (user context)              │  │
│  │  - useCopilotAction (MCP tool wrappers)           │  │
│  │  - CopilotChat / CopilotSidebar                   │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                            |
                            v (HTTP + JWT)
┌──────────────────────────────────────────────────────────┐
│             CopilotRuntime (Node.js Middleware)          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  - JWT Validation Middleware                       │  │
│  │  - User Context Extraction                         │  │
│  │  - Permission Checking                             │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  CopilotRuntime Actions (Proxy to Archon MCP)     │  │
│  │  - SearchArchonKnowledge                           │  │
│  │  - ReadFullPage                                    │  │
│  │  - FindProjects                                    │  │
│  │  - FindTasks                                       │  │
│  │  - ManageTask                                      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                            |
                            v (MCP JSON-RPC)
┌──────────────────────────────────────────────────────────┐
│              Archon MCP Server (Python)                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Existing MCP Tools                                │  │
│  │  - rag_search_knowledge_base                       │  │
│  │  - rag_read_full_page                              │  │
│  │  - find_projects (with user filter)                │  │
│  │  - find_tasks (with project filter)                │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                            |
                            v
┌──────────────────────────────────────────────────────────┐
│          Supabase (PostgreSQL + pgvector + RLS)          │
│  - Row-Level Security for multi-tenant isolation        │
│  - pgvector for semantic search                         │
│  - User/project membership tables                       │
└──────────────────────────────────────────────────────────┘
```

### Implementation Steps

#### Step 1: Install CopilotKit

```bash
cd /home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs
npm install @copilotkit/react-core @copilotkit/react-ui
```

#### Step 2: Wrap App with CopilotKit Provider

```tsx
// app/layout.tsx
import { CopilotKit } from '@copilotkit/react-core';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <CopilotKit
          runtimeUrl="/api/copilot" // Backend endpoint
          showDevConsole={process.env.NODE_ENV === 'development'}
        >
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
```

#### Step 3: Create AgentContextService

```typescript
// lib/services/AgentContextService.ts
import { useCopilotReadable } from '@copilotkit/react-core';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAccessibleProjects } from '@/hooks/useAccessibleProjects';

export function AgentContextProvider({ children }) {
  const user = useCurrentUser();
  const projects = useAccessibleProjects();
  const currentProject = useCurrentProject();

  // Expose user context to agent
  useCopilotReadable({
    description: "Current user authentication and permissions",
    value: {
      userId: user.id,
      email: user.email,
      role: user.role,
      accessibleProjectIds: projects.map(p => p.id)
    }
  });

  // Expose current project context
  useCopilotReadable({
    description: "Active project workspace",
    value: {
      projectId: currentProject?.id,
      projectTitle: currentProject?.title,
      userRole: currentProject?.userRole // owner/member/viewer
    }
  });

  return children;
}
```

#### Step 4: Define MCP Tool Wrappers

```typescript
// components/copilot/ArchonKnowledgeActions.tsx
import { useCopilotAction } from '@copilotkit/react-core';

export function ArchonKnowledgeActions() {
  // Search knowledge base
  useCopilotAction({
    name: "SearchArchonKnowledge",
    description: "Search Archon knowledge base for documentation, code examples, and project information. Respects user's project scope.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Natural language search query",
        required: true
      },
      {
        name: "scope",
        type: "string",
        enum: ["global", "project", "user"],
        description: "Search scope: global (all public docs), project (current project), user (personal docs)",
        required: false
      }
    ],
    handler: async ({ query, scope = "project" }) => {
      const response = await fetch('/api/copilot/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ query, scope })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      return await response.json();
    },
    render: ({ status, args, result }) => {
      if (status === 'executing') {
        return (
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            <span>Searching knowledge base for: {args.query}</span>
          </div>
        );
      }

      if (result?.articles) {
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Found {result.articles.length} results</h4>
            {result.articles.map((article, idx) => (
              <div key={idx} className="border p-2 rounded">
                <a href={article.url} className="text-blue-600 hover:underline">
                  {article.title}
                </a>
                <p className="text-sm text-gray-600">{article.preview}</p>
              </div>
            ))}
          </div>
        );
      }

      return null;
    }
  });

  // Read full page
  useCopilotAction({
    name: "ReadFullPage",
    description: "Retrieve complete content of a knowledge base page",
    parameters: [
      {
        name: "pageId",
        type: "string",
        description: "Page UUID from search results",
        required: false
      },
      {
        name: "url",
        type: "string",
        description: "Page URL",
        required: false
      }
    ],
    handler: async ({ pageId, url }) => {
      const response = await fetch('/api/copilot/page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ pageId, url })
      });

      return await response.json();
    }
  });

  // Search code examples
  useCopilotAction({
    name: "SearchCodeExamples",
    description: "Find code examples in the knowledge base",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Technology or pattern to search (e.g., 'React hooks', 'FastAPI middleware')",
        required: true
      }
    ],
    handler: async ({ query }) => {
      const response = await fetch('/api/copilot/code-examples', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ query })
      });

      return await response.json();
    }
  });

  return null; // No UI, just actions
}
```

#### Step 5: Create Backend API Route

```typescript
// app/api/copilot/route.ts
import { CopilotRuntime } from '@copilotkit/runtime';
import { OpenAIAdapter } from '@copilotkit/runtime-openai';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

// Initialize Archon MCP client
const archonMCP = createArchonMCPClient({
  endpoint: 'http://localhost:8051/mcp'
});

export async function POST(req: NextRequest) {
  try {
    // Extract and validate JWT
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    const userId = decoded.userId;

    // Fetch user context from database
    const userContext = await getUserContext(userId);

    // Create runtime with user-scoped actions
    const runtime = new CopilotRuntime({
      actions: () => [
        {
          name: 'SearchArchonKnowledge',
          handler: async ({ query, scope }) => {
            // Validate scope
            if (scope === 'project' && !userContext.currentProjectId) {
              throw new Error('No active project selected');
            }

            // Call Archon MCP
            const results = await archonMCP.rag_search_knowledge_base({
              query,
              source_id: scope === 'project' ? userContext.currentProjectId : null,
              match_count: 5,
              return_mode: "pages"
            });

            // Filter by user permissions
            const accessibleResults = results.filter(doc =>
              hasAccessToDoc(userContext, doc)
            );

            return { articles: accessibleResults };
          }
        },
        {
          name: 'ReadFullPage',
          handler: async ({ pageId, url }) => {
            const page = await archonMCP.rag_read_full_page({ page_id: pageId, url });

            // Verify user has access
            if (!hasAccessToDoc(userContext, page)) {
              throw new Error('Access denied to page');
            }

            return page;
          }
        },
        {
          name: 'SearchCodeExamples',
          handler: async ({ query }) => {
            return await archonMCP.rag_search_code_examples({
              query,
              source_id: userContext.currentProjectId,
              match_count: 5
            });
          }
        }
      ]
    });

    // Process request with OpenAI
    const serviceAdapter = new OpenAIAdapter({
      model: "gpt-4",
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await runtime.process({
      messages: await req.json(),
      serviceAdapter
    });

    return Response.json(response);
  } catch (error) {
    console.error('CopilotRuntime error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Helper functions
async function getUserContext(userId: string) {
  const user = await db.users.findUnique({
    where: { id: userId },
    include: { projectMemberships: true }
  });

  return {
    userId: user.id,
    role: user.role,
    currentProjectId: user.currentProjectId,
    projectIds: user.projectMemberships.map(m => m.projectId),
    permissions: user.permissions
  };
}

function hasAccessToDoc(userContext, doc) {
  // Global scope - always accessible
  if (doc.scope === 'global') return true;

  // User scope - must be owner
  if (doc.scope === 'user') {
    return doc.userId === userContext.userId;
  }

  // Project scope - must be member
  if (doc.scope === 'project') {
    return userContext.projectIds.includes(doc.projectId);
  }

  return false;
}
```

#### Step 6: Add UI Component

```tsx
// components/copilot/KnowledgeAssistant.tsx
import { CopilotSidebar } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';

export function KnowledgeAssistant() {
  return (
    <CopilotSidebar
      title="Archon Knowledge Assistant"
      instructions="You are an AI assistant with access to the Archon knowledge base. Help users find documentation, code examples, and project information. Always respect user permissions and project scope."
      defaultOpen={false}
      icons={{
        openIcon: <SearchIcon />,
        closeIcon: <CloseIcon />
      }}
    >
      <div className="space-y-4">
        <h3 className="font-semibold">Available Actions:</h3>
        <ul className="text-sm space-y-1">
          <li>🔍 Search knowledge base</li>
          <li>📄 Read full documentation pages</li>
          <li>💻 Find code examples</li>
          <li>📋 List accessible projects</li>
          <li>✅ Search and manage tasks</li>
        </ul>
      </div>
    </CopilotSidebar>
  );
}
```

#### Step 7: Integrate into Dashboard

```tsx
// app/dashboard/layout.tsx
import { AgentContextProvider } from '@/lib/services/AgentContextService';
import { ArchonKnowledgeActions } from '@/components/copilot/ArchonKnowledgeActions';
import { KnowledgeAssistant } from '@/components/copilot/KnowledgeAssistant';

export default function DashboardLayout({ children }) {
  return (
    <AgentContextProvider>
      <ArchonKnowledgeActions />

      <div className="flex h-screen">
        <Sidebar />

        <main className="flex-1">
          {children}
        </main>

        <KnowledgeAssistant />
      </div>
    </AgentContextProvider>
  );
}
```

### Alternative: Agentless MCP Integration

**For simpler use cases without heavy agent orchestration:**

```tsx
// Direct MCP connection
import { useCopilotChat } from '@copilotkit/react-core';

function MCPDirectIntegration() {
  const { setMcpServers } = useCopilotChat();

  useEffect(() => {
    // Point directly to Archon MCP server
    setMcpServers([
      {
        endpoint: 'http://localhost:8051/mcp',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'X-User-Context': JSON.stringify({
            userId: user.id,
            projectIds: user.projectIds
          })
        }
      }
    ]);
  }, [userToken, user]);

  return <CopilotChat />;
}
```

**Pros:**
- Simpler architecture (no CopilotRuntime middleware)
- Direct MCP tool access
- Less code to maintain

**Cons:**
- Less control over tool execution
- Harder to implement custom authorization logic
- No middleware for request validation

---

## Code Examples

### Complete RAG Integration Example

```typescript
// 1. Frontend component with knowledge base search
import { useCopilotAction } from '@copilotkit/react-core';
import { CopilotChat } from '@copilotkit/react-ui';

export function KnowledgeBaseCopilot() {
  const user = useCurrentUser();
  const currentProject = useCurrentProject();

  // Define search action
  useCopilotAction({
    name: "SearchKnowledgeBase",
    description: `Search Archon knowledge base. User ${user.email} has access to ${currentProject?.title || 'no active project'}.`,
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Natural language search query",
        required: true
      },
      {
        name: "scope",
        type: "string",
        enum: ["global", "project", "user"],
        description: "Search scope",
        required: false
      }
    ],
    handler: async ({ query, scope = "project" }) => {
      try {
        const response = await fetch('/api/knowledge/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          },
          body: JSON.stringify({
            query,
            scope,
            projectId: currentProject?.id
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return {
          articles: data.results,
          count: data.total,
          scope: data.scope
        };
      } catch (error) {
        console.error('Knowledge base search failed:', error);
        return {
          error: error.message,
          articles: []
        };
      }
    },
    render: ({ status, args, result }) => {
      if (status === 'executing') {
        return (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        );
      }

      if (result?.error) {
        return (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800">Error: {result.error}</p>
          </div>
        );
      }

      if (result?.articles && result.articles.length > 0) {
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">
                Found {result.count} results
              </h4>
              <span className="text-sm text-gray-500">
                Scope: {result.scope}
              </span>
            </div>

            <div className="space-y-2">
              {result.articles.map((article, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition"
                >
                  <a
                    href={article.url}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {article.title}
                  </a>

                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {article.preview}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>📄 {article.word_count} words</span>
                    <span>🎯 {(article.similarity * 100).toFixed(1)}% match</span>
                    {article.source && (
                      <span>📁 {article.source}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800">No results found for "{args.query}"</p>
        </div>
      );
    }
  });

  return (
    <div className="h-full">
      <CopilotChat
        instructions={`You are the Archon Knowledge Assistant. You have access to search the knowledge base for user ${user.email}.

Available scopes:
- global: All public documentation
- project: Current project (${currentProject?.title || 'none selected'})
- user: Personal documents

When searching, consider the user's context and suggest relevant scope.`}
        labels={{
          title: "Archon Knowledge Base",
          initial: "Hi! I can help you search the knowledge base. What would you like to know?"
        }}
      />
    </div>
  );
}

// 2. Backend API route (Next.js App Router)
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { createArchonMCPClient } from '@/lib/mcp';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyJWT(token);
    const { query, scope, projectId } = await req.json();

    // Fetch user context
    const user = await db.users.findUnique({
      where: { id: decoded.userId },
      include: {
        projectMemberships: {
          include: { project: true }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Validate project access
    if (scope === 'project') {
      const hasAccess = user.projectMemberships.some(
        m => m.projectId === projectId
      );

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to project' },
          { status: 403 }
        );
      }
    }

    // Call Archon MCP
    const archonMCP = createArchonMCPClient();
    const results = await archonMCP.rag_search_knowledge_base({
      query,
      source_id: scope === 'project' ? projectId : null,
      match_count: 5,
      return_mode: 'pages'
    });

    // Filter results by user permissions (additional layer)
    const accessibleResults = results.filter(doc => {
      if (doc.scope === 'global') return true;
      if (doc.scope === 'user') return doc.userId === user.id;
      if (doc.scope === 'project') {
        return user.projectMemberships.some(m => m.projectId === doc.projectId);
      }
      return false;
    });

    return NextResponse.json({
      results: accessibleResults,
      total: accessibleResults.length,
      scope,
      query
    });
  } catch (error) {
    console.error('Knowledge base search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 3. Archon MCP client wrapper
export function createArchonMCPClient() {
  return {
    async rag_search_knowledge_base({ query, source_id, match_count, return_mode }) {
      const response = await fetch('http://localhost:8051/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: crypto.randomUUID(),
          method: 'tools/call',
          params: {
            name: 'rag_search_knowledge_base',
            arguments: {
              query,
              source_id,
              match_count,
              return_mode
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`MCP call failed: ${response.statusText}`);
      }

      const data = await response.json();
      return JSON.parse(data.result.content[0].text).results;
    },

    async rag_read_full_page({ page_id, url }) {
      const response = await fetch('http://localhost:8051/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: crypto.randomUUID(),
          method: 'tools/call',
          params: {
            name: 'rag_read_full_page',
            arguments: { page_id, url }
          }
        })
      });

      const data = await response.json();
      return JSON.parse(data.result.content[0].text).page;
    }
  };
}
```

### User Context Management Example

```typescript
// lib/contexts/CopilotUserContext.tsx
import { createContext, useContext, ReactNode } from 'react';
import { useCopilotReadable } from '@copilotkit/react-core';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';

interface CopilotUserContextValue {
  userId: string;
  email: string;
  role: string;
  accessibleProjects: string[];
  currentProjectId: string | null;
}

const CopilotUserContext = createContext<CopilotUserContextValue | null>(null);

export function CopilotUserProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  // Fetch user's accessible projects
  const { data: projects } = useQuery({
    queryKey: ['accessible-projects', session?.user?.id],
    queryFn: async () => {
      const response = await fetch('/api/projects/accessible');
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: !!session?.user?.id
  });

  const contextValue: CopilotUserContextValue = {
    userId: session?.user?.id || '',
    email: session?.user?.email || '',
    role: session?.user?.role || 'user',
    accessibleProjects: projects?.map((p: any) => p.id) || [],
    currentProjectId: projects?.[0]?.id || null
  };

  // Expose to CopilotKit agent
  useCopilotReadable({
    description: "Current authenticated user with permissions",
    value: {
      userId: contextValue.userId,
      email: contextValue.email,
      role: contextValue.role,
      accessibleProjectIds: contextValue.accessibleProjects
    }
  });

  // Expose current project context
  useCopilotReadable({
    description: "Active project workspace",
    value: {
      projectId: contextValue.currentProjectId,
      hasActiveProject: !!contextValue.currentProjectId
    }
  });

  return (
    <CopilotUserContext.Provider value={contextValue}>
      {children}
    </CopilotUserContext.Provider>
  );
}

export function useCopilotUser() {
  const context = useContext(CopilotUserContext);
  if (!context) {
    throw new Error('useCopilotUser must be used within CopilotUserProvider');
  }
  return context;
}
```

---

## Security Considerations

### Authentication Flow

```
┌─────────────┐     1. User Login     ┌──────────────┐
│   Browser   │ ───────────────────>  │   Auth API   │
└─────────────┘                       └──────────────┘
       │                                      │
       │  2. JWT Token                        │
       │ <────────────────────────────────────┘
       │
       │  3. Store Token (httpOnly cookie or localStorage)
       │
       │  4. CopilotKit Request + JWT
       v
┌─────────────┐                       ┌──────────────┐
│   Copilot   │ ───────────────────>  │  Copilot API │
│    Chat     │     Authorization:    │  (/api/...)  │
└─────────────┘     Bearer <token>    └──────────────┘
                                              │
                                              │ 5. Verify JWT
                                              │ 6. Extract User Context
                                              │
                                              v
                                      ┌──────────────┐
                                      │  Archon MCP  │
                                      │   + Filter   │
                                      └──────────────┘
```

### Security Checklist

#### ✅ Must Implement

1. **JWT Validation**
   - Verify signature on every request
   - Check expiration timestamps
   - Validate issuer/audience claims
   - Use short-lived tokens (15-60 minutes)
   - Implement refresh token rotation

2. **User Context Validation**
   - Never trust frontend-provided user IDs
   - Extract user context from authenticated JWT
   - Validate project membership in database
   - Check role-based permissions

3. **Input Sanitization**
   - Sanitize all user queries for SQL injection
   - Escape special characters in search terms
   - Validate scope enums ('global', 'project', 'user')
   - Rate limit search requests (10-20 per minute)

4. **Output Filtering**
   - Filter RAG results by user permissions (database-level)
   - Remove sensitive metadata before returning
   - Redact PII/secrets in document content
   - Audit log all access attempts

5. **Database-Level Security**
   - Enable Row-Level Security (RLS) in Supabase
   - Use prepared statements (prevent SQL injection)
   - Encrypt sensitive fields at rest
   - Regular security audits

#### ⚠️ Common Vulnerabilities

1. **Privilege Escalation**
   ```typescript
   // ❌ WRONG - Trusts frontend scope parameter
   async function search(query, scope, projectId) {
     return await db.query(query, projectId); // No validation!
   }

   // ✅ CORRECT - Validates user access
   async function search(query, scope, projectId, userId) {
     const hasAccess = await verifyProjectAccess(userId, projectId);
     if (!hasAccess) throw new Error('Access denied');
     return await db.query(query, projectId);
   }
   ```

2. **Data Leakage**
   ```typescript
   // ❌ WRONG - Returns all results without filtering
   const results = await archonMCP.search(query);
   return results; // May include docs user can't access!

   // ✅ CORRECT - Filters by user permissions
   const results = await archonMCP.search(query);
   return results.filter(doc => hasAccess(user, doc));
   ```

3. **Token Exposure**
   ```typescript
   // ❌ WRONG - Logs sensitive tokens
   console.log('User token:', req.headers.authorization);

   // ✅ CORRECT - Logs non-sensitive info
   console.log('User authenticated:', userId);
   ```

4. **Injection Attacks**
   ```typescript
   // ❌ WRONG - String interpolation in queries
   const query = `SELECT * FROM docs WHERE content LIKE '%${userInput}%'`;

   // ✅ CORRECT - Parameterized queries
   const query = 'SELECT * FROM docs WHERE content LIKE $1';
   db.query(query, [`%${userInput}%`]);
   ```

### Rate Limiting

```typescript
// middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

export const copilotRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit per user, not per IP
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = jwt.decode(token);
    return decoded?.userId || req.ip;
  }
});

// Apply to Copilot routes
app.use('/api/copilot', copilotRateLimit);
```

### Audit Logging

```typescript
// middleware/audit.ts
export async function auditLog(req: NextRequest, action: string, details: any) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const user = token ? jwt.decode(token) : null;

  await db.auditLogs.create({
    data: {
      userId: user?.userId,
      action, // 'SEARCH_KB', 'READ_PAGE', 'ACCESS_DENIED'
      resource: details.resource, // 'knowledge_base', 'project', 'task'
      resourceId: details.resourceId,
      ipAddress: req.headers.get('x-forwarded-for') || req.ip,
      userAgent: req.headers.get('user-agent'),
      timestamp: new Date(),
      success: details.success,
      errorMessage: details.error
    }
  });
}

// Usage in API route
export async function POST(req: NextRequest) {
  try {
    const { query, scope } = await req.json();
    const results = await searchKnowledgeBase(query, scope, user);

    await auditLog(req, 'SEARCH_KB', {
      resource: 'knowledge_base',
      resourceId: null,
      success: true
    });

    return NextResponse.json(results);
  } catch (error) {
    await auditLog(req, 'SEARCH_KB', {
      resource: 'knowledge_base',
      success: false,
      error: error.message
    });

    throw error;
  }
}
```

### Content Security Policy (CSP)

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      connect-src 'self' http://localhost:8051 http://localhost:8181;
      font-src 'self';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim()
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};
```

---

## References

### Official Documentation

1. **CopilotKit**
   - Main Docs: https://docs.copilotkit.ai/
   - GitHub: https://github.com/CopilotKit/CopilotKit
   - API Reference: https://docs.copilotkit.ai/reference
   - RAG Guide: https://www.copilotkit.ai/blog/build-your-own-knowledge-based-rag-copilot

2. **AG-UI Protocol**
   - Protocol Spec: https://www.copilotkit.ai/ag-ui
   - Blog Post: https://www.copilotkit.ai/blog/ag-ui-protocol-bridging-agents-to-any-front-end
   - GitHub: https://github.com/ag-ui-protocol/ag-ui

3. **MCP Integration**
   - MCP + CopilotKit: https://www.copilotkit.ai/blog/add-an-mcp-client-to-any-react-app-in-under-30-minutes
   - Demo Repo: https://github.com/CopilotKit/copilotkit-mcp-demo

### Related Technologies

4. **Vector Databases**
   - Pinecone: https://docs.pinecone.io/
   - pgvector: https://github.com/pgvector/pgvector
   - Supabase Vector: https://supabase.com/docs/guides/ai

5. **AI Frameworks**
   - LangGraph: https://langchain-ai.github.io/langgraph/
   - PydanticAI: https://docs.pydantic.dev/
   - CrewAI: https://docs.crewai.com/

### Example Projects

6. **CopilotKit Examples**
   - Demo Banking (Auth): https://github.com/CopilotKit/demo-banking
   - RAG E-commerce: https://www.copilotkit.ai/blog/building-a-rag-powered-e-commerce-platform-langgraph-mongodb-copilotkit
   - MongoDB RAG: https://www.copilotkit.ai/blog/build-a-rag-copilot-with-mongodb-vector-search-and-copilotkit

### GitHub Issues (Known Limitations)

7. **CopilotKit Issues**
   - Custom Context Properties: https://github.com/CopilotKit/CopilotKit/issues/2119
   - Context Not Passed to Agent: https://github.com/CopilotKit/CopilotKit/issues/2528
   - Per-Request Agent Factory: https://github.com/CopilotKit/CopilotKit/issues/2941
   - Session ID from Backend: https://github.com/CopilotKit/CopilotKit/issues/2841

---

## Next Steps for Archon Integration

### Phase 1: Proof of Concept (1-2 weeks)
- [ ] Install CopilotKit in `archon-ui-nextjs`
- [ ] Create `AgentContextProvider` with `useCopilotReadable`
- [ ] Implement single action: `SearchArchonKnowledge`
- [ ] Test with existing Archon MCP server
- [ ] Document findings and performance

### Phase 2: Full Integration (2-3 weeks)
- [ ] Implement all MCP tool wrappers as CopilotKit actions
- [ ] Add JWT authentication middleware
- [ ] Implement user context validation
- [ ] Add database-level RLS policies
- [ ] Create custom UI rendering for tool calls

### Phase 3: Production Hardening (1-2 weeks)
- [ ] Add rate limiting
- [ ] Implement audit logging
- [ ] Security review and penetration testing
- [ ] Performance optimization (caching, batching)
- [ ] Documentation for users

### Phase 4: Advanced Features (Ongoing)
- [ ] Multi-agent orchestration (planner + specialists)
- [ ] Human-in-the-loop workflows
- [ ] Generative UI for dynamic dashboards
- [ ] Thread persistence and conversation history
- [ ] Analytics and usage insights

---

**Document Version:** 1.0
**Last Updated:** 2026-01-28
**Maintained By:** Library Research Agent
**Status:** ✅ Complete - Ready for Implementation
