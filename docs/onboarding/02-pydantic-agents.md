# 02 - Pydantic Agents

This document explains how PydanticAI agents are defined, configured, and orchestrated in Archon.

---

## Overview

Archon uses **PydanticAI** for type-safe agent definitions. The key patterns are:

1. **Generic Base Class**: `BaseAgent[DepsT, OutputT]` with type parameters
2. **Dependency Injection**: `ArchonDependencies` dataclass passed to tools via `RunContext`
3. **Tool Registration**: `@agent.tool` decorator for defining agent capabilities
4. **MCP Client**: HTTP communication between agents and services

---

## Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                   BaseAgent[DepsT, OutputT]              │  │
│   │  - Generic typing for type safety                        │  │
│   │  - Rate limiting with exponential backoff                │  │
│   │  - Error handling and retries                            │  │
│   │  - Logging and monitoring                                │  │
│   └────────────────────────┬─────────────────────────────────┘  │
│                            │                                     │
│              ┌─────────────┴─────────────┐                      │
│              │                           │                      │
│              ▼                           ▼                      │
│   ┌──────────────────────┐    ┌──────────────────────┐         │
│   │    DocumentAgent     │    │      RagAgent        │         │
│   │                      │    │                      │         │
│   │  Deps: Document      │    │  Deps: Rag           │         │
│   │        Dependencies  │    │        Dependencies  │         │
│   │                      │    │                      │         │
│   │  Output: Document    │    │  Output: Rag         │         │
│   │          Operation   │    │          QueryResult │         │
│   │                      │    │                      │         │
│   │  Tools: 7            │    │  Tools: 4            │         │
│   └──────────────────────┘    └──────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## BaseAgent Class

**File**: `python/src/agents/base_agent.py:141-266`

The `BaseAgent` class provides common functionality for all agents:

```python
class BaseAgent(ABC, Generic[DepsT, OutputT]):
    """
    Base class for all PydanticAI agents in the Archon system.

    Provides:
    - Error handling and retries
    - Rate limiting protection
    - Logging and monitoring
    - Standard dependency injection
    """

    def __init__(
        self,
        model: str = "openai:gpt-4o",
        name: str = None,
        retries: int = 3,
        enable_rate_limiting: bool = True,
        **agent_kwargs,
    ):
        self.model = model
        self.name = name or self.__class__.__name__
        self.retries = retries

        # Initialize rate limiting
        if self.enable_rate_limiting:
            self.rate_limiter = RateLimitHandler(max_retries=retries)

        # Initialize the PydanticAI agent
        self._agent = self._create_agent(**agent_kwargs)

    @abstractmethod
    def _create_agent(self, **kwargs) -> Agent:
        """Create and configure the PydanticAI agent."""
        pass

    async def run(self, user_prompt: str, deps: DepsT) -> OutputT:
        """Run the agent with rate limiting protection."""
        if self.rate_limiter:
            return await self.rate_limiter.execute_with_rate_limit(
                self._run_agent, user_prompt, deps
            )
        return await self._run_agent(user_prompt, deps)

    def run_stream(self, user_prompt: str, deps: DepsT):
        """Run the agent with streaming output."""
        return self._agent.run_stream(user_prompt, deps=deps)
```

### Rate Limiting

**File**: `python/src/agents/base_agent.py:43-138`

The `RateLimitHandler` implements exponential backoff for OpenAI rate limits:

```python
class RateLimitHandler:
    """Handles OpenAI rate limiting with exponential backoff."""

    def __init__(self, max_retries: int = 5, base_delay: float = 1.0):
        self.max_retries = max_retries
        self.base_delay = base_delay

    async def execute_with_rate_limit(self, func, *args, **kwargs):
        retries = 0
        while retries <= self.max_retries:
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                if "rate limit" in str(e).lower() or "429" in str(e):
                    retries += 1
                    # Exponential backoff
                    wait_time = self.base_delay * (2 ** (retries - 1))
                    await asyncio.sleep(wait_time)
                else:
                    raise
```

---

## Dependency Injection

### ArchonDependencies Base Class

**File**: `python/src/agents/base_agent.py:20-27`

```python
@dataclass
class ArchonDependencies:
    """Base dependencies for all Archon agents."""

    request_id: str | None = None
    user_id: str | None = None
    trace_id: str | None = None
```

### DocumentDependencies

**File**: `python/src/agents/document_agent.py:27-32`

```python
@dataclass
class DocumentDependencies(ArchonDependencies):
    """Dependencies for document operations."""

    project_id: str = ""  # Required
    current_document_id: str | None = None
    progress_callback: Any | None = None
```

### RagDependencies

```python
@dataclass
class RagDependencies(ArchonDependencies):
    """Dependencies for RAG operations."""

    project_id: str | None = None
    source_filter: str | None = None
    match_count: int = 5
    progress_callback: Any | None = None
```

---

## Tool Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   AGENT TOOL EXECUTION FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. User Request                                                │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────────────────────────────────────┐                  │
│   │ Agent.run(user_prompt, deps)             │                  │
│   │                                          │                  │
│   │ deps = DocumentDependencies(             │                  │
│   │     project_id="abc-123",                │                  │
│   │     user_id="user-456"                   │                  │
│   │ )                                        │                  │
│   └──────────────┬───────────────────────────┘                  │
│                  │                                               │
│   2. Rate Limiter                                                │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────────────────────────────────────┐                  │
│   │ RateLimitHandler.execute_with_rate_limit │                  │
│   │ - Retry on 429 errors                    │                  │
│   │ - Exponential backoff                    │                  │
│   └──────────────┬───────────────────────────┘                  │
│                  │                                               │
│   3. PydanticAI Agent                                            │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────────────────────────────────────┐                  │
│   │ LLM decides which tool(s) to call        │                  │
│   └──────────────┬───────────────────────────┘                  │
│                  │                                               │
│   4. Tool Execution                                              │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────────────────────────────────────┐                  │
│   │ @agent.tool                              │                  │
│   │ async def create_document(               │                  │
│   │     ctx: RunContext[DocumentDependencies],│                 │
│   │     title: str,                          │                  │
│   │     document_type: str,                  │                  │
│   │     content_description: str             │                  │
│   │ ) -> str:                                │                  │
│   │     # Access deps via ctx.deps           │                  │
│   │     project_id = ctx.deps.project_id     │                  │
│   │     user_id = ctx.deps.user_id           │                  │
│   │     ...                                  │                  │
│   └──────────────┬───────────────────────────┘                  │
│                  │                                               │
│   5. MCP Client (for cross-service calls)                        │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────────────────────────────────────┐                  │
│   │ mcp_client = await get_mcp_client()      │                  │
│   │ result = await mcp_client.manage_document│                  │
│   │     action="create",                     │                  │
│   │     project_id=project_id,               │                  │
│   │     ...                                  │                  │
│   │ )                                        │                  │
│   └──────────────┬───────────────────────────┘                  │
│                  │                                               │
│   6. Return Structured Output                                    │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────────────────────────────────────┐                  │
│   │ DocumentOperation(                       │                  │
│   │     operation_type="create",             │                  │
│   │     document_id="doc-789",               │                  │
│   │     success=True,                        │                  │
│   │     message="Document created"           │                  │
│   │ )                                        │                  │
│   └──────────────────────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## DocumentAgent

**File**: `python/src/agents/document_agent.py:52-660`

### Purpose
Conversational document management - create, update, query documents.

### Configuration

```python
class DocumentAgent(BaseAgent[DocumentDependencies, DocumentOperation]):
    def __init__(self, model: str = None, **kwargs):
        if model is None:
            model = os.getenv("DOCUMENT_AGENT_MODEL", "openai:gpt-4o")

        super().__init__(
            model=model,
            name="DocumentAgent",
            retries=3,
            enable_rate_limiting=True,
            **kwargs
        )

    def _create_agent(self, **kwargs) -> Agent:
        agent = Agent(
            model=self.model,
            deps_type=DocumentDependencies,
            result_type=DocumentOperation,
            system_prompt="You are a Document Management Assistant...",
            **kwargs,
        )
        # Register tools...
        return agent
```

### Output Model

```python
class DocumentOperation(BaseModel):
    """Structured output for document operations."""

    operation_type: str  # create, update, delete, query
    document_id: str | None
    document_type: str | None  # prd, technical_spec, etc.
    title: str | None
    changes_made: list[str]
    success: bool
    message: str
    content_preview: str | None
```

### Tools (7 Total)

| Tool | Purpose | Parameters |
|------|---------|------------|
| `list_documents` | List project documents | `ctx` |
| `get_document` | Get document by title | `ctx`, `document_title` |
| `create_document` | Create new document | `ctx`, `title`, `document_type`, `content_description` |
| `update_document` | Update document section | `ctx`, `document_title`, `section_to_update`, `new_content`, `update_description` |
| `create_feature_plan` | Generate React Flow diagram | `ctx`, `feature_name`, `feature_description`, `user_stories` |
| `create_erd` | Entity Relationship Diagram | `ctx`, `system_name`, `entity_descriptions`, `relationships_description` |
| `request_approval` | Request approval for changes | `ctx`, `document_title`, `change_summary`, `change_type` |

### Tool Example: create_document

```python
@agent.tool
async def create_document(
    ctx: RunContext[DocumentDependencies],
    title: str,
    document_type: str,
    content_description: str,
) -> str:
    """Create a new document with structured content."""
    try:
        # Send progress update if callback available
        if ctx.deps.progress_callback:
            await ctx.deps.progress_callback({
                "step": "ai_generation",
                "log": f"📝 Creating {document_type}: {title}",
            })

        # Generate blocks for the document
        blocks = self._convert_to_blocks(title, document_type, content_description)

        # Create via DocumentService
        from ..services.projects.document_service import DocumentService
        doc_service = DocumentService()
        success, result_data = doc_service.add_document(
            project_id=ctx.deps.project_id,
            document_type=document_type,
            title=title,
            content={"id": str(uuid.uuid4()), "title": title, "blocks": blocks},
            tags=[document_type, "conversational"],
            author=ctx.deps.user_id or "DocumentAgent",
        )

        if result_data.get("success", False):
            return f"Successfully created document '{title}'"
        else:
            return f"Failed to create document: {result_data.get('error')}"

    except Exception as e:
        return f"Error creating document: {str(e)}"
```

---

## RagAgent

**File**: `python/src/agents/rag_agent.py`

### Purpose
Conversational search and document retrieval using RAG.

### Output Model

```python
class RagQueryResult(BaseModel):
    """Structured output for RAG queries."""

    query_type: str  # search, explain, summarize
    original_query: str
    refined_query: str | None
    results_found: int
    sources: list[str]
    answer: str
    citations: list[dict]
    success: bool
    message: str
```

### Tools (4 Total)

| Tool | Purpose | Parameters |
|------|---------|------------|
| `search_documents` | Semantic document search | `ctx`, `query`, `source_filter` |
| `list_available_sources` | List searchable sources | `ctx` |
| `search_code_examples` | Find code snippets | `ctx`, `query`, `source_filter` |
| `refine_search_query` | Query expansion | `ctx`, `original_query`, `context` |

---

## MCP Client for Inter-Agent Communication

**File**: `python/src/agents/mcp_client.py`

Agents use the MCP client to communicate with other services:

```python
class MCPClient:
    """HTTP client for MCP server communication."""

    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.getenv("MCP_SERVER_URL", "http://localhost:8051")

    async def call_tool(self, tool_name: str, **kwargs) -> dict:
        """Call an MCP tool via HTTP."""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/rpc",
                json={
                    "method": tool_name,
                    "params": kwargs,
                    "jsonrpc": "2.0",
                    "id": str(uuid.uuid4())
                }
            ) as response:
                result = await response.json()
                return result.get("result", {})

    # Convenience methods
    async def perform_rag_query(self, query: str, **kwargs) -> dict:
        return await self.call_tool("perform_rag_query", query=query, **kwargs)

    async def manage_document(self, action: str, **kwargs) -> str:
        return await self.call_tool("manage_document", action=action, **kwargs)

    async def manage_project(self, action: str, **kwargs) -> str:
        return await self.call_tool("manage_project", action=action, **kwargs)

# Global singleton
_mcp_client: MCPClient | None = None

async def get_mcp_client() -> MCPClient:
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = MCPClient()
    return _mcp_client
```

---

## Dynamic System Prompts

Agents can add dynamic context to their system prompts using `RunContext`:

```python
def _create_agent(self, **kwargs) -> Agent:
    agent = Agent(
        model=self.model,
        deps_type=DocumentDependencies,
        result_type=DocumentOperation,
        system_prompt="Base system prompt...",
    )

    # Register dynamic system prompt
    @agent.system_prompt
    async def add_project_context(ctx: RunContext[DocumentDependencies]) -> str:
        return f"""
**Current Project Context:**
- Project ID: {ctx.deps.project_id}
- User ID: {ctx.deps.user_id or "Unknown"}
- Current Document: {ctx.deps.current_document_id or "None"}
- Timestamp: {datetime.now().isoformat()}
"""

    return agent
```

---

## Agent REST API

**File**: `python/src/agents/server.py`

The agents service exposes a REST API for running agents:

```python
# Agent Registry
AVAILABLE_AGENTS = {
    "document": DocumentAgent,
    "rag": RagAgent,
}

@app.post("/agents/run")
async def run_agent(request: AgentRequest) -> AgentResponse:
    """Run an agent and return structured result."""
    agent = app.state.agents[request.agent_type]
    deps = create_dependencies(request)
    result = await agent.run(request.prompt, deps)
    return AgentResponse(success=True, result=result)

@app.post("/agents/{agent_type}/stream")
async def stream_agent(agent_type: str, request: AgentRequest):
    """Run an agent with streaming output."""
    agent = app.state.agents[agent_type]
    deps = create_dependencies(request)

    async def generate():
        async with agent.run_stream(request.prompt, deps) as stream:
            async for chunk in stream.stream_text():
                yield f"data: {chunk}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

---

## Summary Table

| Aspect | Implementation |
|--------|----------------|
| **Base Framework** | PydanticAI with FastAPI |
| **Agent Count** | 2 primary (DocumentAgent, RagAgent) |
| **Type Safety** | Generic typing: `BaseAgent[DepsT, OutputT]` |
| **Dependency Injection** | `RunContext[DepsType]` per tool |
| **Inter-Agent Communication** | MCP client (HTTP JSON-RPC) |
| **Tool Count** | 11 tools (7 Document + 4 RAG) |
| **Rate Limiting** | Exponential backoff on OpenAI errors |
| **Streaming** | Server-Sent Events for real-time responses |
| **API Exposure** | REST endpoints on port 8052 |

---

## Key Code References

| File | Lines | Purpose |
|------|-------|---------|
| `python/src/agents/base_agent.py` | 141-266 | BaseAgent class |
| `python/src/agents/base_agent.py` | 43-138 | RateLimitHandler |
| `python/src/agents/document_agent.py` | 52-660 | DocumentAgent with 7 tools |
| `python/src/agents/rag_agent.py` | All | RagAgent with 4 tools |
| `python/src/agents/mcp_client.py` | All | MCP HTTP client |
| `python/src/agents/server.py` | All | Agent REST API |

---

## Next Steps

- [03 - Knowledge Base](./03-knowledge-base.md) - Understanding chunking, embeddings, and RAG
- [06 - Workflow Engine](./06-workflow-engine.md) - Agent work orders and workflows
