# CopilotKit Integration - Implementation Plan
**Project ID:** c3207262-98a6-4cd3-b9c3-33d66b34216c
**Planning Completed:** 2026-01-28
**Planner Agent:** planner
**Status:** ✅ Planning Complete - Ready for Implementation

---

## Executive Summary

**Objective:** Integrate CopilotKit AI chat interface into Archon dashboard for natural language knowledge base queries.

**Architecture:**
```
User → CopilotKit UI → CopilotRuntime (Next.js) → Archon MCP (Python) → Supabase + pgvector
```

**Key Features:**
- AI-powered chat interface for knowledge base queries
- Natural language search: "Show me all FastAPI authentication patterns"
- Multi-tenant security with JWT + RLS policies
- Real-time code example search with syntax highlighting
- Project and task management via conversational interface

**Estimated Effort:** 34.5 hours across 17 tasks (5 phases)

---

## Project Separation of Concerns

**Dedicated Project:** CopilotKit AI Chat Integration (separate from "Three-Tier Knowledge Base" project)

**Why Separation:**
- Clean architectural boundaries
- Independent deployment and testing
- Easier rollback if needed
- Clear ownership and responsibility
- Simplified dependency management

---

## Implementation Phases

### Phase 1: Foundation & Setup (4 tasks, ~8 hours)

**Objective:** Install dependencies, create MCP client wrapper, setup API infrastructure

| Task | Assignee | Hours | Description |
|------|----------|-------|-------------|
| **P1.1** | ui-implementation-expert | 0.5 | Install @copilotkit/react-core, @copilotkit/react-ui, @copilotkit/runtime |
| **P1.2** | integration-expert | 2.5 | Create lib/archon-mcp-client.ts wrapper for JSON-RPC 2.0 protocol |
| **P1.3** | backend-api-expert | 2.0 | Create JWT validation middleware (middleware/jwt-validation.ts) |
| **P1.4** | backend-api-expert | 3.0 | Implement /api/copilot route with CopilotRuntime orchestrator |

**Deliverables:**
- ✅ CopilotKit packages installed and configured
- ✅ MCP client wrapper with all tool methods
- ✅ JWT middleware for authentication
- ✅ Basic /api/copilot route infrastructure

**Critical Path:** P1.1 → P1.2 → P1.4 (JWT middleware can be parallel)

---

### Phase 2: User Context & Security (3 tasks, ~5.5 hours)

**Objective:** Implement three-tier security (frontend context + backend validation + database RLS)

| Task | Assignee | Hours | Description |
|------|----------|-------|-------------|
| **P2.1** | ui-implementation-expert | 2.0 | Create AgentContextProvider with useCopilotReadable for user context |
| **P2.2** | backend-api-expert | 2.0 | Implement services/user-context.ts for permission extraction |
| **P2.3** | backend-api-expert | 1.5 | Add utils/verify-project-access.ts for project membership checks |

**Deliverables:**
- ✅ Frontend exposes user ID, role, accessible projects
- ✅ Backend extracts permissions from JWT
- ✅ Project membership verified for all scope-filtered actions

**Security Model:**
1. **Tier 1 (Frontend):** useCopilotReadable exposes user context
2. **Tier 2 (Backend):** JWT validation + permission extraction
3. **Tier 3 (Database):** Supabase RLS policies enforce isolation

---

### Phase 3: Core MCP Actions (4 tasks, ~8 hours)

**Objective:** Implement CopilotActions for all major MCP tools

| Task | Assignee | Hours | Description |
|------|----------|-------|-------------|
| **P3.1** | integration-expert | 2.5 | SearchArchonKnowledge action (rag_search_knowledge_base) |
| **P3.2** | integration-expert | 1.5 | ReadFullPage action (rag_read_full_page) |
| **P3.3** | integration-expert | 2.0 | SearchCodeExamples action (rag_search_code_examples) |
| **P3.4** | integration-expert | 2.0 | FindProjects/FindTasks actions (find_projects, find_tasks) |

**Deliverables:**
- ✅ 5 CopilotActions mapping to MCP tools
- ✅ Permission filtering on all results
- ✅ Custom rendering for each action type

**Action Mapping:**
- `SearchArchonKnowledge` → `rag_search_knowledge_base(query, scope, match_count)`
- `ReadFullPage` → `rag_read_full_page(page_id)` or `rag_read_full_page(url)`
- `SearchCodeExamples` → `rag_search_code_examples(query, source_id, match_count)`
- `FindProjects` → `find_projects(query)`
- `FindTasks` → `find_tasks(project_id, filter_by, filter_value)`

---

### Phase 4: UI Components & UX (4 tasks, ~7.5 hours)

**Objective:** Integrate CopilotKit UI, create custom renderers, add polish

| Task | Assignee | Hours | Description |
|------|----------|-------|-------------|
| **P4.1** | ui-implementation-expert | 2.0 | Integrate CopilotSidebar into dashboard layout |
| **P4.2** | ui-implementation-expert | 2.5 | Create custom result renderers for knowledge items |
| **P4.3** | ui-implementation-expert | 1.5 | Add code syntax highlighting (react-syntax-highlighter) |
| **P4.4** | ui-implementation-expert | 1.5 | Implement error handling and loading states |

**Deliverables:**
- ✅ CopilotSidebar accessible from all pages
- ✅ Custom cards for search results, pages, code, projects, tasks
- ✅ Code blocks with syntax highlighting + copy button
- ✅ Error boundaries and loading skeletons

**UI Components:**
- `components/copilot/CopilotSidebar.tsx` - Main chat interface
- `components/copilot/renderers/KnowledgeResultCard.tsx` - Search results
- `components/copilot/renderers/CodeExampleCard.tsx` - Code examples
- `components/copilot/renderers/ProjectTaskCard.tsx` - Projects/tasks

---

### Phase 5: Testing & Documentation (2 tasks, ~5.5 hours)

**Objective:** Create tests and comprehensive documentation

| Task | Assignee | Hours | Description |
|------|----------|-------|-------------|
| **P5.1** | testing-expert | 3.0 | Create integration tests for CopilotKit flow (Vitest + Playwright) |
| **P5.2** | documentation-expert | 2.5 | Document architecture, usage guide, troubleshooting |

**Deliverables:**
- ✅ Integration tests for search, permissions, error handling
- ✅ E2E tests for full user workflow
- ✅ Architecture diagram and developer guide
- ✅ User guide with examples and screenshots

**Test Coverage:**
- User asks question → SearchArchonKnowledge called → Results filtered
- JWT validation rejects invalid tokens
- MCP client handles errors gracefully (timeout, connection, 404)
- Results respect scope permissions (global/project/user)

---

## Architectural Decisions

### 1. CopilotRuntime Approach (vs Agentless MCP)

**Decision:** Use CopilotRuntime middleware in /api/copilot route

**Rationale:**
- ✅ Better security control (JWT validation, permission filtering)
- ✅ Middleware hooks for logging and monitoring
- ✅ Custom action validation
- ❌ Slightly more complex than direct MCP integration

**Alternative (Rejected):** Direct MCP connection from frontend
- ✅ Simpler code
- ❌ Less control over authorization
- ❌ Harder to implement custom validation

### 2. Pattern A: Direct MCP Integration

**Decision:** Call existing Archon MCP server (localhost:8051)

**Rationale:**
- ✅ Leverages existing infrastructure (no duplication)
- ✅ User permissions enforced at database level (RLS)
- ✅ Minimal changes to Archon backend
- ❌ Additional MCP hop (negligible latency: ~10-20ms)

**Alternative (Rejected):** Embed vector DB in Next.js
- ✅ Lower latency
- ❌ Duplicate vector search logic
- ❌ More complex deployment

### 3. Three-Tier Security Model

**Decision:** Frontend context + Backend validation + Database RLS

**Rationale:**
- ✅ Defense in depth (3 layers of security)
- ✅ Prevents privilege escalation
- ✅ Aligns with existing Archon RLS policies
- ❌ Slightly more code (acceptable tradeoff)

---

## Dependencies & Prerequisites

**Required Before Starting:**
- [x] Archon MCP server running (localhost:8051)
- [x] Archon Backend API running (localhost:8181)
- [x] Supabase database with RLS policies
- [x] JWT authentication system in archon-ui-nextjs
- [x] User context hooks (useCurrentUser, useAccessibleProjects)

**External Dependencies:**
- `@copilotkit/react-core` - Core CopilotKit framework
- `@copilotkit/react-ui` - Pre-built UI components
- `@copilotkit/runtime` - Backend runtime orchestrator
- OpenAI API key or Anthropic API key (for LLM)

---

## Technical Specifications

### MCP Client Wrapper (P1.2)

**File:** `lib/archon-mcp-client.ts`

**Methods:**
```typescript
export interface ArchonMCPClient {
  rag_search_knowledge_base(params: {
    query: string;
    source_id?: string;
    match_count?: number;
    return_mode?: 'pages' | 'chunks';
  }): Promise<SearchResult[]>;

  rag_read_full_page(params: {
    page_id?: string;
    url?: string;
  }): Promise<PageContent>;

  rag_search_code_examples(params: {
    query: string;
    source_id?: string;
    match_count?: number;
  }): Promise<CodeExample[]>;

  find_projects(params: {
    query?: string;
    project_id?: string;
  }): Promise<Project[]>;

  find_tasks(params: {
    task_id?: string;
    project_id?: string;
    filter_by?: string;
    filter_value?: string;
  }): Promise<Task[]>;
}
```

**Protocol:** JSON-RPC 2.0 over HTTP
**Headers:** `Content-Type: application/json`, `Accept: application/json, text/event-stream`

### JWT Middleware (P1.3)

**File:** `middleware/jwt-validation.ts`

```typescript
export async function validateJWT(token: string): Promise<UserContext> {
  // Verify JWT signature
  // Extract claims: userId, email, role
  // Query database for project memberships
  // Return UserContext object
}

export interface UserContext {
  userId: string;
  email: string;
  role: 'owner' | 'member' | 'viewer';
  accessibleProjectIds: string[];
  currentProjectId?: string;
}
```

### CopilotAction Example (P3.1)

**File:** `components/copilot/actions/SearchKnowledgeAction.tsx`

```tsx
export function SearchKnowledgeAction() {
  const { user } = useCurrentUser();

  useCopilotAction({
    name: "SearchArchonKnowledge",
    description: "Search Archon knowledge base with user scope filtering",
    parameters: [
      { name: "query", type: "string", required: true, description: "Search query" },
      { name: "scope", type: "string", enum: ["global", "project", "user"], description: "Search scope" },
      { name: "match_count", type: "number", description: "Number of results (default: 5)" }
    ],
    handler: async ({ query, scope = "project", match_count = 5 }) => {
      // Call /api/copilot/search with JWT
      const response = await fetch('/api/copilot/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, scope, match_count })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      return await response.json();
    },
    render: ({ status, result }) => {
      if (status === 'executing') {
        return <SearchLoadingSkeleton />;
      }

      if (status === 'complete') {
        return <KnowledgeResults results={result.results} />;
      }

      return null;
    }
  });

  return null;
}
```

---

## Success Criteria

**Phase 1 Complete:**
- [ ] CopilotKit packages installed without conflicts
- [ ] MCP client successfully calls localhost:8051/mcp
- [ ] JWT middleware validates tokens and extracts user context
- [ ] /api/copilot route responds with 200 OK

**Phase 2 Complete:**
- [ ] AgentContextProvider exposes user ID, role, project IDs
- [ ] Backend extracts permissions from JWT correctly
- [ ] Project membership verified before returning results
- [ ] Unauthorized requests return 401/403

**Phase 3 Complete:**
- [ ] All 5 CopilotActions implemented and functional
- [ ] Search results filtered by user permissions
- [ ] Code examples displayed with syntax highlighting
- [ ] Projects/tasks linked to existing pages

**Phase 4 Complete:**
- [ ] CopilotSidebar accessible from dashboard
- [ ] Custom renderers for all result types
- [ ] Error handling shows user-friendly messages
- [ ] Loading states during action execution

**Phase 5 Complete:**
- [ ] Integration tests pass (>80% coverage)
- [ ] E2E tests pass for full workflow
- [ ] Documentation complete with examples
- [ ] User guide includes troubleshooting section

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **CopilotKit version incompatibility** | Medium | Pin exact versions, test with Next.js 15.5.6 |
| **MCP protocol changes** | Low | Use JSON-RPC 2.0 standard, test thoroughly |
| **Permission bypass** | High | Three-tier security, comprehensive tests |
| **Performance degradation** | Medium | Cache results, optimize queries, monitor latency |
| **LLM API costs** | Medium | Rate limiting (20 req/min), cost monitoring |

**Overall Risk:** 🟢 Low-Medium - Well-documented framework, proven patterns, existing infrastructure

---

## Performance Targets

**Latency:**
- Search query → Response: < 2 seconds (p95)
- MCP round-trip: < 100ms
- Total chat interaction: < 3 seconds

**Scalability:**
- Support 50 concurrent users
- 1000 queries per day
- Rate limit: 20 requests/minute per user

**Reliability:**
- 99.9% uptime
- Graceful degradation on MCP failures
- Error recovery within 5 seconds

---

## Deployment Strategy

**Phase 1-2 (Foundation):** Deploy to development environment
- Validate MCP connectivity
- Test JWT authentication
- Verify user context extraction

**Phase 3 (Actions):** Gradual rollout
- Deploy SearchArchonKnowledge first (most critical)
- Monitor usage and errors
- Add remaining actions incrementally

**Phase 4 (UI):** Soft launch
- Enable for internal team only
- Gather feedback
- Iterate on UX

**Phase 5 (Production):** Full rollout
- Enable for all users
- Monitor metrics (usage, latency, errors)
- Document common issues

---

## Monitoring & Observability

**Metrics to Track:**
- Action execution count (by type)
- Average response time
- Error rate (by error type)
- User adoption rate
- MCP tool usage distribution

**Logging:**
- All CopilotAction calls (user, query, scope, timestamp)
- Permission denials (audit trail)
- MCP errors and timeouts
- JWT validation failures

**Alerts:**
- Error rate > 5%
- Average latency > 3 seconds
- MCP connection failures
- Unusual access patterns (potential security issues)

---

## Next Steps

**Immediate Action:** Start Phase 1 (Foundation & Setup)

**Recommended Sequence:**
1. **P1.1:** Install CopilotKit dependencies (ui-implementation-expert)
2. **P1.2 + P1.3:** Parallel development (integration-expert + backend-api-expert)
3. **P1.4:** Implement /api/copilot route (backend-api-expert)
4. **P2.1-P2.3:** Complete security layer
5. **P3.1:** Implement first action (SearchArchonKnowledge) for POC
6. **Test POC:** Validate end-to-end flow before continuing
7. **P3.2-P4.4:** Complete remaining actions and UI
8. **P5.1-P5.2:** Testing and documentation

**First Milestone (POC):** Complete P1.1-P1.4, P2.1-P2.3, P3.1 (~13 hours)
- Validates architecture
- Proves concept works
- Identifies blockers early

---

## Reference Documentation

**External Resources:**
1. CopilotKit Docs: https://docs.copilotkit.ai/
2. AG-UI Protocol: https://www.copilotkit.ai/ag-ui
3. RAG Integration Guide: https://www.copilotkit.ai/blog/build-your-own-knowledge-based-rag-copilot
4. MCP Integration: https://www.copilotkit.ai/blog/add-an-mcp-client-to-any-react-app-in-under-30-minutes
5. Demo Banking (Auth Example): https://github.com/CopilotKit/demo-banking

**Internal Resources:**
1. Research Document: `/home/ljutzkanov/Documents/Projects/archon/PRPs/COPILOTKIT_INTEGRATION_SUMMARY.md`
2. Deep Dive: `/home/ljutzkanov/Documents/Projects/archon/PRPs/ai_docs/COPILOTKIT_AGUI_INTEGRATION_RESEARCH.md`
3. Archon MCP Docs: `/home/ljutzkanov/Documents/Projects/archon/.claude/docs/MCP_SESSION_ARCHITECTURE.md`
4. Three-Tier KB Docs: `/home/ljutzkanov/Documents/Projects/archon/.claude/docs/BEST_PRACTICES.md`

---

**Planning Status:** ✅ Complete
**Planning Agent:** planner
**Planning Hours:** 1.5 actual
**Next Phase:** Phase 1 Implementation
**Estimated Total Effort:** 34.5 hours (17 tasks)

**Ready to Begin:** ✅ All prerequisites met, tasks validated, agents assigned
