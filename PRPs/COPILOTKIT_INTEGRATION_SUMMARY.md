# CopilotKit Integration Summary
**Date:** 2026-01-28
**Status:** ✅ Research Complete - Ready for Planning

---

## Executive Decision

**Recommendation:** ✅ **Implement CopilotKit + Custom MCP Integration**

### Why CopilotKit is Ideal for Archon

1. **Native MCP Support** - Built-in MCP client capabilities align with existing Archon architecture
2. **Production-Ready** - 28k+ GitHub stars, battle-tested with enterprise deployments
3. **RAG-First Design** - Proven patterns for vector search and knowledge base integration
4. **Multi-Tenant Capable** - Support for user context filtering via `useCopilotReadable`
5. **React Integration** - Perfect fit for Next.js dashboard (`archon-ui-nextjs`)
6. **Flexible Architecture** - Can use agentless (direct MCP) or agent-based (CopilotRuntime) approaches

---

## Key Research Findings

### 1. CopilotKit Architecture

**Frontend (React):**
- `<CopilotKit>` provider wraps app
- `useCopilotReadable` - Exposes user context to agent
- `useCopilotAction` - Defines callable actions
- `useAgent` - Programmatic control (v1.50+)
- Pre-built UI components: `CopilotChat`, `CopilotSidebar`, `CopilotPopup`

**Backend (Node.js):**
- `CopilotRuntime` - Core orchestrator
- LLM adapters (OpenAI, Anthropic, Groq, Google, LangChain)
- Action execution engine
- Agent integration (LangGraph, CrewAI, Remote Python, **MCP**)

### 2. AG-UI Protocol

**What is it?**
- Open, lightweight protocol for agent-to-UI communication
- Event-based JSON streaming over HTTP/SSE
- Created by CopilotKit team, now ecosystem-wide standard

**Event Types:**
- `TEXT_MESSAGE_CONTENT` - Streaming responses
- `TOOL_CALL_START/END` - Tool execution lifecycle
- `STATE_DELTA` - Incremental UI updates
- `RUN_ERROR/FINISHED` - Lifecycle signals

**Relationship to MCP:**
- AG-UI sits **above** MCP in the stack
- AG-UI = User ↔ Agent
- MCP = Agent ↔ Tools/Context
- CopilotKit bridges AG-UI → MCP

### 3. Knowledge Base Integration Patterns

**Pattern A: Direct MCP Integration (Recommended)**
```
CopilotKit Frontend → CopilotRuntime (Node.js) → Archon MCP (Python) → Supabase + pgvector
```

**Benefits:**
- Leverages existing Archon MCP server
- No duplication of vector search logic
- User permissions enforced at database level (RLS)
- Minimal changes to Archon backend

**Pattern B: Embedded Vector DB (Alternative)**
```
CopilotKit Frontend → CopilotRuntime → Pinecone/Qdrant → Direct embedding generation
```

**Benefits:**
- Lower latency (no MCP hop)
- More control over embeddings
- Simpler architecture

**Verdict:** Use Pattern A to maximize reuse of Archon infrastructure.

### 4. Multi-Tenant Context & Permissions

**Challenge:** CopilotKit doesn't enforce permissions natively.

**Solution: Three-Tier Filtering**

**Tier 1: Frontend Context (`useCopilotReadable`)**
- Expose user ID, role, accessible project IDs
- Current project context
- User preferences

**Tier 2: Backend Middleware Validation**
- Extract JWT from Authorization header
- Verify user identity and permissions
- Attach user context to request
- Validate scope parameters

**Tier 3: Database-Level Filtering**
- Supabase Row-Level Security (RLS) policies
- Pinecone namespace isolation + metadata filters
- pgvector queries with permission checks

**Known Issues:**
- Custom context properties beyond `authorization` not passed to agents (workaround: encode in `authorization` field)
- `useCopilotReadable` context sometimes not accessible by agent (workaround: include in action descriptions)

---

## Recommended Architecture for Archon

```
┌──────────────────────────────────────────────────────────┐
│             Archon Dashboard (Next.js)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │  <CopilotKit runtimeUrl="/api/copilot">            │  │
│  │    <AgentContextProvider>                          │  │
│  │      - useCopilotReadable (user context)          │  │
│  │      <ArchonKnowledgeActions>                      │  │
│  │        - useCopilotAction (search KB)             │  │
│  │        - useCopilotAction (read page)             │  │
│  │        - useCopilotAction (code examples)         │  │
│  │      </ArchonKnowledgeActions>                     │  │
│  │      <CopilotSidebar />                            │  │
│  │    </AgentContextProvider>                         │  │
│  │  </CopilotKit>                                     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                            |
                            | HTTP POST + JWT
                            v
┌──────────────────────────────────────────────────────────┐
│       /api/copilot Route (Next.js API Route)             │
│  ┌────────────────────────────────────────────────────┐  │
│  │  1. JWT Validation Middleware                      │  │
│  │  2. Extract User Context                           │  │
│  │  3. CopilotRuntime with User-Scoped Actions        │  │
│  │     - SearchArchonKnowledge                        │  │
│  │     - ReadFullPage                                 │  │
│  │     - SearchCodeExamples                           │  │
│  │     - FindProjects                                 │  │
│  │     - FindTasks                                    │  │
│  │  4. OpenAI/Anthropic Adapter                       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                            |
                            | MCP JSON-RPC
                            v
┌──────────────────────────────────────────────────────────┐
│           Archon MCP Server (Python FastAPI)             │
│  - rag_search_knowledge_base                             │
│  - rag_read_full_page                                    │
│  - rag_search_code_examples                              │
│  - find_projects (with user filter)                      │
│  - find_tasks (with project filter)                      │
└──────────────────────────────────────────────────────────┘
                            |
                            v
┌──────────────────────────────────────────────────────────┐
│       Supabase (PostgreSQL + pgvector + RLS)             │
│  - Row-Level Security for multi-tenant isolation        │
│  - Vector similarity search                             │
│  - User/project membership tables                       │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Proof of Concept (1-2 weeks)
**Goal:** Validate CopilotKit + Archon MCP integration

**Tasks:**
1. Install CopilotKit in `archon-ui-nextjs`
   ```bash
   npm install @copilotkit/react-core @copilotkit/react-ui
   ```

2. Create `AgentContextProvider` component
   - Wrap dashboard with `<CopilotKit>`
   - Implement `useCopilotReadable` for user context

3. Implement single action: `SearchArchonKnowledge`
   - Frontend: `useCopilotAction` hook
   - Backend: `/api/copilot` route with `CopilotRuntime`
   - MCP: Call existing `rag_search_knowledge_base` tool

4. Test basic workflow:
   - User asks: "Find documentation about task management"
   - Agent calls `SearchArchonKnowledge`
   - Results displayed in chat

**Success Criteria:**
- ✅ Agent can search Archon knowledge base
- ✅ Results respect user permissions
- ✅ UI renders search results correctly

### Phase 2: Full Integration (2-3 weeks)
**Goal:** Complete CopilotKit feature set

**Tasks:**
1. Implement all MCP tool wrappers:
   - `ReadFullPage`
   - `SearchCodeExamples`
   - `FindProjects`
   - `FindTasks`
   - `ManageTask`

2. Authentication & Authorization:
   - JWT validation middleware
   - User context extraction
   - Project membership verification
   - Scope validation (global/project/user)

3. Database Security:
   - Enable RLS policies in Supabase
   - Add permission checks to queries
   - Audit logging for access attempts

4. UI Components:
   - Custom rendering for tool calls
   - Knowledge base result cards
   - Code example syntax highlighting
   - Task management widgets

**Success Criteria:**
- ✅ Full MCP feature parity in CopilotKit
- ✅ Multi-tenant isolation enforced
- ✅ Audit logs capture all actions

### Phase 3: Production Hardening (1-2 weeks)
**Goal:** Security and performance optimization

**Tasks:**
1. Rate limiting (20 requests/minute per user)
2. Input sanitization (prevent injection)
3. Output filtering (redact sensitive data)
4. Error handling (graceful failures)
5. Performance optimization:
   - Response caching
   - Batch requests
   - Lazy loading
6. Security review and penetration testing

**Success Criteria:**
- ✅ Passes security audit
- ✅ <500ms average response time
- ✅ Zero production incidents

### Phase 4: Advanced Features (Ongoing)
**Optional enhancements:**
- Multi-agent orchestration (planner + specialists)
- Human-in-the-loop workflows (approval gates)
- Generative UI (agent-controlled dashboards)
- Thread persistence (conversation history)
- Analytics dashboard (usage insights)

---

## Key Code Snippets

### 1. Frontend: Agent Context Provider

```tsx
// lib/contexts/AgentContextProvider.tsx
import { useCopilotReadable } from '@copilotkit/react-core';

export function AgentContextProvider({ children }) {
  const user = useCurrentUser();
  const projects = useAccessibleProjects();

  useCopilotReadable({
    description: "Current user context with permissions",
    value: {
      userId: user.id,
      email: user.email,
      role: user.role,
      accessibleProjectIds: projects.map(p => p.id)
    }
  });

  return children;
}
```

### 2. Frontend: Knowledge Base Action

```tsx
// components/copilot/KnowledgeBaseActions.tsx
import { useCopilotAction } from '@copilotkit/react-core';

export function KnowledgeBaseActions() {
  useCopilotAction({
    name: "SearchArchonKnowledge",
    description: "Search Archon knowledge base with user scope",
    parameters: [
      { name: "query", type: "string", required: true },
      { name: "scope", type: "string", enum: ["global", "project", "user"] }
    ],
    handler: async ({ query, scope = "project" }) => {
      const response = await fetch('/api/copilot/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, scope })
      });
      return await response.json();
    },
    render: ({ status, result }) => {
      if (status === 'executing') return <Spinner />;
      return <KnowledgeResults results={result.articles} />;
    }
  });

  return null;
}
```

### 3. Backend: CopilotRuntime with Archon MCP

```typescript
// app/api/copilot/route.ts
import { CopilotRuntime } from '@copilotkit/runtime';
import { OpenAIAdapter } from '@copilotkit/runtime-openai';

export async function POST(req: NextRequest) {
  // Authenticate
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const decoded = verifyJWT(token);

  // Get user context
  const userContext = await getUserContext(decoded.userId);

  // Create runtime
  const runtime = new CopilotRuntime({
    actions: () => [
      {
        name: 'SearchArchonKnowledge',
        handler: async ({ query, scope }) => {
          // Validate scope
          if (scope === 'project' && !userContext.currentProjectId) {
            throw new Error('No active project');
          }

          // Call Archon MCP
          const results = await archonMCP.rag_search_knowledge_base({
            query,
            source_id: scope === 'project' ? userContext.currentProjectId : null,
            match_count: 5
          });

          // Filter by permissions
          return results.filter(doc => hasAccess(userContext, doc));
        }
      }
    ]
  });

  // Process with OpenAI
  const adapter = new OpenAIAdapter({ model: "gpt-4" });
  const response = await runtime.process({
    messages: await req.json(),
    serviceAdapter: adapter
  });

  return Response.json(response);
}
```

### 4. Archon MCP Client Wrapper

```typescript
// lib/archon-mcp-client.ts
export function createArchonMCPClient() {
  return {
    async rag_search_knowledge_base({ query, source_id, match_count }) {
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
            arguments: { query, source_id, match_count, return_mode: 'pages' }
          }
        })
      });

      const data = await response.json();
      return JSON.parse(data.result.content[0].text).results;
    }
  };
}
```

---

## Security Checklist

**Must Implement:**
- [x] JWT validation on every request
- [x] User context extraction from authenticated token
- [x] Project membership verification
- [x] Database-level Row-Level Security (RLS)
- [x] Input sanitization (prevent SQL injection)
- [x] Output filtering (remove sensitive data)
- [x] Rate limiting (20 req/min per user)
- [x] Audit logging (all access attempts)
- [x] HTTPS only in production
- [x] Content Security Policy (CSP) headers

**Common Vulnerabilities to Avoid:**
- ❌ Trusting frontend-provided user IDs
- ❌ Returning unfiltered RAG results
- ❌ Logging JWT tokens
- ❌ String interpolation in SQL queries
- ❌ Missing rate limits
- ❌ Exposing internal error details

---

## Alternative: Agentless MCP Integration

**For simpler use cases without heavy orchestration:**

```tsx
import { useCopilotChat } from '@copilotkit/react-core';

function DirectMCPIntegration() {
  const { setMcpServers } = useCopilotChat();

  useEffect(() => {
    setMcpServers([{
      endpoint: 'http://localhost:8051/mcp',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'X-User-Context': JSON.stringify(userContext)
      }
    }]);
  }, [userToken]);

  return <CopilotChat />;
}
```

**Pros:**
- Simpler (no CopilotRuntime middleware)
- Direct MCP tool access
- Less code

**Cons:**
- Less control over authorization
- Harder to implement custom validation
- No middleware hooks

**Verdict:** Use CopilotRuntime approach for production (better security control).

---

## References

**Key Documentation:**
1. CopilotKit: https://docs.copilotkit.ai/
2. AG-UI Protocol: https://www.copilotkit.ai/ag-ui
3. RAG Integration Guide: https://www.copilotkit.ai/blog/build-your-own-knowledge-based-rag-copilot
4. MCP Integration: https://www.copilotkit.ai/blog/add-an-mcp-client-to-any-react-app-in-under-30-minutes
5. Demo Banking (Auth Example): https://github.com/CopilotKit/demo-banking

**Complete Research:** `/home/ljutzkanov/Documents/Projects/archon/PRPs/ai_docs/COPILOTKIT_AGUI_INTEGRATION_RESEARCH.md`

---

## Next Steps

1. **Review Research Document** - Complete technical deep-dive in `ai_docs/COPILOTKIT_AGUI_INTEGRATION_RESEARCH.md`
2. **Create Planning Task** - Use Archon task management to track Phase 1 POC
3. **Assign to Planner** - Planner agent will break down into implementation tasks
4. **Start POC** - UI expert implements basic CopilotKit integration

**Estimated Effort:**
- Phase 1 (POC): 1-2 weeks
- Phase 2 (Full): 2-3 weeks
- Phase 3 (Hardening): 1-2 weeks
- **Total:** 4-7 weeks for production-ready implementation

**Risk Assessment:** 🟢 Low - Well-documented patterns, mature framework, aligns with existing architecture

---

**Status:** ✅ Research Complete
**Next Phase:** Create planning task with planner agent
**Agent:** library-researcher
**Date:** 2026-01-28
