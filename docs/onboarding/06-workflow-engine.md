# 06 - Workflow Engine

This document explains the Agent Work Orders system - a 6-step sequential workflow for automated development.

---

## Overview

The workflow engine enables automated, multi-step development workflows executed by specialized agents:

```
┌─────────────────────────────────────────────────────────────────┐
│               AGENT WORK ORDERS SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   User Request: "Add dark mode to the dashboard"                 │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │              WORK ORDER CREATED                        │    │
│   │  work_order_id: "wo-abc-123"                           │    │
│   │  status: "pending"                                     │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │           SANDBOX ISOLATION (Git Worktree)             │    │
│   │  /tmp/archon-sandboxes/wo-abc-123/                     │    │
│   │  └── project-repo/  (isolated copy)                    │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │           6-STEP SEQUENTIAL WORKFLOW                   │    │
│   │                                                        │    │
│   │  Step 1: CREATE-BRANCH ──► BranchCreator agent        │    │
│   │  Step 2: PLANNING ───────► Planner agent              │    │
│   │  Step 3: EXECUTE ────────► Implementor agent          │    │
│   │  Step 4: COMMIT ─────────► Committer agent            │    │
│   │  Step 5: CREATE-PR ──────► PrCreator agent            │    │
│   │  Step 6: REVIEW ─────────► Reviewer agent             │    │
│   │                                                        │    │
│   │  ┌─────────────────────────────────────────────────┐  │    │
│   │  │ SHARED CONTEXT DICT                             │  │    │
│   │  │ Each step reads from and writes to context      │  │    │
│   │  └─────────────────────────────────────────────────┘  │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │              SSE PROGRESS STREAMING                    │    │
│   │  Real-time updates to client                           │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6-Step Workflow Pipeline

**File**: `python/src/agent_work_orders/workflow_engine/operations.py`

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW STEPS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ STEP 1: CREATE-BRANCH                                  │    │
│   │                                                        │    │
│   │ Agent: BranchCreator                                   │    │
│   │ Command: create-branch.md                              │    │
│   │                                                        │    │
│   │ Input:                                                 │    │
│   │   - user_request                                       │    │
│   │   - github_issue_number (optional)                     │    │
│   │                                                        │    │
│   │ Output:                                                │    │
│   │   - branch_name (e.g., "feature/dark-mode")           │    │
│   │   → Stored in context["create-branch"]                 │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ STEP 2: PLANNING                                       │    │
│   │                                                        │    │
│   │ Agent: Planner                                         │    │
│   │ Command: planning.md                                   │    │
│   │                                                        │    │
│   │ Input:                                                 │    │
│   │   - user_request                                       │    │
│   │   - github_issue_number                                │    │
│   │   - context (from previous steps)                      │    │
│   │                                                        │    │
│   │ Output:                                                │    │
│   │   - plan_file (detailed implementation plan)          │    │
│   │   → Stored in context["planning"]                      │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ STEP 3: EXECUTE                                        │    │
│   │                                                        │    │
│   │ Agent: Implementor                                     │    │
│   │ Command: execute.md                                    │    │
│   │                                                        │    │
│   │ Input:                                                 │    │
│   │   - context.get("planning") ← From step 2             │    │
│   │                                                        │    │
│   │ Output:                                                │    │
│   │   - implementation_summary                             │    │
│   │   - Modified files in sandbox                          │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ STEP 4: COMMIT                                         │    │
│   │                                                        │    │
│   │ Agent: Committer                                       │    │
│   │ Command: commit.md                                     │    │
│   │                                                        │    │
│   │ Input:                                                 │    │
│   │   - Modified files from step 3                         │    │
│   │                                                        │    │
│   │ Output:                                                │    │
│   │   - commit_info (SHA, message)                         │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ STEP 5: CREATE-PR                                      │    │
│   │                                                        │    │
│   │ Agent: PrCreator                                       │    │
│   │ Command: create-pr.md                                  │    │
│   │                                                        │    │
│   │ Input:                                                 │    │
│   │   - context["create-branch"] ← From step 1            │    │
│   │   - context["planning"] ← From step 2                 │    │
│   │                                                        │    │
│   │ Output:                                                │    │
│   │   - pr_url                                             │    │
│   │   → Stored in context["github_pull_request_url"]       │    │
│   └────────────────────────────────────────────────────────┘    │
│        │                                                         │
│        ▼                                                         │
│   ┌────────────────────────────────────────────────────────┐    │
│   │ STEP 6: REVIEW                                         │    │
│   │                                                        │    │
│   │ Agent: Reviewer                                        │    │
│   │ Command: prp-review.md                                 │    │
│   │                                                        │    │
│   │ Input:                                                 │    │
│   │   - context.get("planning") ← From step 2             │    │
│   │   - PR diff                                            │    │
│   │                                                        │    │
│   │ Output:                                                │    │
│   │   - review_output (approval/changes requested)         │    │
│   └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Names

**File**: `python/src/agent_work_orders/workflow_engine/agent_names.py`

```python
# Agent name constants
BRANCH_CREATOR = "BranchCreator"
PLANNER = "Planner"
IMPLEMENTOR = "Implementor"
COMMITTER = "Committer"
PR_CREATOR = "PrCreator"
REVIEWER = "Reviewer"

# Step to agent mapping
STEP_AGENTS = {
    "create-branch": BRANCH_CREATOR,
    "planning": PLANNER,
    "execute": IMPLEMENTOR,
    "commit": COMMITTER,
    "create-pr": PR_CREATOR,
    "review": REVIEWER,
}
```

---

## Context Passing

The workflow uses a shared context dictionary for inter-step communication:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT DICTIONARY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   context = {                                                    │
│                                                                  │
│       # Initial inputs                                           │
│       "user_request": "Add dark mode to dashboard",              │
│       "github_issue_number": "123",                              │
│       "work_order_id": "wo-abc-123",                             │
│                                                                  │
│       # Step 1 output                                            │
│       "create-branch": "feature/dark-mode-123",                  │
│                                                                  │
│       # Step 2 output                                            │
│       "planning": """                                            │
│           # Dark Mode Implementation Plan                        │
│                                                                  │
│           ## Overview                                            │
│           Add dark mode theme toggle...                          │
│                                                                  │
│           ## Tasks                                               │
│           1. Create ThemeContext                                 │
│           2. Add toggle component                                │
│           3. Update CSS variables                                │
│       """,                                                       │
│                                                                  │
│       # Step 5 output                                            │
│       "github_pull_request_url": "https://github.com/org/repo/pull/456"│
│                                                                  │
│   }                                                              │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ ACCESS PATTERN                                          │   │
│   │                                                         │   │
│   │ # Read from previous step                               │   │
│   │ plan = context.get("planning")                          │   │
│   │                                                         │   │
│   │ # Write output for future steps                         │   │
│   │ context[command_name] = result.output                   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflow Orchestrator

**File**: `python/src/agent_work_orders/workflow_engine/orchestrator.py`

```python
class WorkflowOrchestrator:
    """Orchestrates the 6-step workflow execution."""

    def __init__(self):
        self.agent_executor = AgentExecutor()
        self.command_loader = CommandLoader()
        self.sandbox_manager = SandboxManager()

    async def execute_workflow(
        self,
        work_order_id: str,
        user_request: str,
        github_issue_number: str = None,
        progress_callback: Callable = None
    ) -> WorkflowResult:
        """
        Execute the complete 6-step workflow.

        Features:
        - Sequential step execution
        - Context passing between steps
        - Progress tracking
        - Error handling with step history
        - Sandbox isolation
        """
        # Initialize context
        context = {
            "user_request": user_request,
            "github_issue_number": github_issue_number,
            "work_order_id": work_order_id,
        }

        # Create isolated sandbox
        sandbox = await self.sandbox_manager.create_sandbox(work_order_id)

        step_history = []
        start_time = time.time()

        try:
            # Execute each step sequentially
            for step_num, (command_name, command_func) in enumerate(WORKFLOW_STEPS.items()):

                step_start = time.time()

                # Update progress
                if progress_callback:
                    await progress_callback({
                        "step": step_num + 1,
                        "total_steps": 6,
                        "command": command_name,
                        "status": "running",
                        "elapsed": time.time() - start_time
                    })

                # Execute step
                result = await command_func(
                    executor=self.agent_executor,
                    command_loader=self.command_loader,
                    work_order_id=work_order_id,
                    working_dir=sandbox.working_dir,
                    context=context,
                )

                # Store output in context for next steps
                context[command_name] = result.output

                # Record step history
                step_history.append({
                    "step": command_name,
                    "status": "completed",
                    "duration": time.time() - step_start,
                    "output_preview": result.output[:200] if result.output else None
                })

            return WorkflowResult(
                success=True,
                context=context,
                step_history=step_history,
                total_duration=time.time() - start_time
            )

        except Exception as e:
            # Record failure in history
            step_history.append({
                "step": command_name,
                "status": "failed",
                "error": str(e)
            })

            return WorkflowResult(
                success=False,
                error=str(e),
                step_history=step_history,
                failed_at_step=command_name
            )

        finally:
            # Cleanup sandbox
            await self.sandbox_manager.cleanup(work_order_id)
```

---

## Sandbox Isolation

**File**: `python/src/agent_work_orders/sandbox_manager/`

Each workflow executes in an isolated git worktree:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SANDBOX ISOLATION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Main Repository                                                │
│   /home/user/project/                                            │
│        │                                                         │
│        │ git worktree add                                        │
│        ▼                                                         │
│   Sandbox Worktree                                               │
│   /tmp/archon-sandboxes/                                         │
│   └── wo-abc-123/                                                │
│       └── project/                                               │
│           ├── .git  (linked to main repo)                        │
│           ├── src/                                               │
│           └── ...                                                │
│                                                                  │
│   Benefits:                                                      │
│   - Isolated file system                                         │
│   - Separate git branch                                          │
│   - No impact on main repo during execution                      │
│   - Easy cleanup                                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```python
class SandboxManager:
    """Manages isolated git worktrees for workflow execution."""

    def __init__(self, sandbox_base: str = "/tmp/archon-sandboxes"):
        self.sandbox_base = sandbox_base

    async def create_sandbox(
        self,
        work_order_id: str,
        repo_url: str = None,
        branch: str = "main"
    ) -> Sandbox:
        """Create an isolated sandbox for workflow execution."""

        sandbox_dir = os.path.join(self.sandbox_base, work_order_id)
        os.makedirs(sandbox_dir, exist_ok=True)

        if repo_url:
            # Clone repository
            await self._run_git(f"clone {repo_url} project", cwd=sandbox_dir)
            working_dir = os.path.join(sandbox_dir, "project")
        else:
            # Create worktree from existing repo
            await self._run_git(
                f"worktree add {sandbox_dir}/project -b workflow/{work_order_id}",
                cwd=self.main_repo_dir
            )
            working_dir = os.path.join(sandbox_dir, "project")

        return Sandbox(
            id=work_order_id,
            working_dir=working_dir,
            created_at=datetime.now()
        )

    async def cleanup(self, work_order_id: str):
        """Remove sandbox and clean up worktree."""
        sandbox_dir = os.path.join(self.sandbox_base, work_order_id)

        # Remove worktree reference
        await self._run_git(
            f"worktree remove {sandbox_dir}/project --force",
            cwd=self.main_repo_dir
        )

        # Delete sandbox directory
        shutil.rmtree(sandbox_dir, ignore_errors=True)
```

---

## Progress Streaming (SSE)

**File**: `python/src/agent_work_orders/api/routes.py`

Real-time progress updates via Server-Sent Events:

```python
@router.post("/work-orders/{work_order_id}/execute")
async def execute_work_order(
    work_order_id: str,
    request: ExecuteRequest
) -> StreamingResponse:
    """Execute workflow with SSE progress streaming."""

    async def generate_events():
        async def progress_callback(update: dict):
            # Format as SSE event
            data = json.dumps(update)
            yield f"data: {data}\n\n"

        # Execute workflow
        result = await orchestrator.execute_workflow(
            work_order_id=work_order_id,
            user_request=request.user_request,
            progress_callback=progress_callback
        )

        # Send final result
        yield f"data: {json.dumps({'type': 'complete', 'result': result.dict()})}\n\n"

    return StreamingResponse(
        generate_events(),
        media_type="text/event-stream"
    )
```

### SSE Event Format

```json
// Progress update
{
    "type": "progress",
    "step": 2,
    "total_steps": 6,
    "command": "planning",
    "status": "running",
    "elapsed": 45.2,
    "message": "Analyzing codebase..."
}

// Step completion
{
    "type": "step_complete",
    "step": 2,
    "command": "planning",
    "duration": 32.5,
    "output_preview": "# Dark Mode Implementation Plan..."
}

// Workflow complete
{
    "type": "complete",
    "success": true,
    "total_duration": 245.8,
    "pr_url": "https://github.com/org/repo/pull/456"
}
```

---

## Error Handling

### Step Failure Recovery

```python
@dataclass
class StepHistory:
    step: str
    status: str  # "completed", "failed", "skipped"
    duration: float | None
    output_preview: str | None
    error: str | None

@dataclass
class WorkflowResult:
    success: bool
    context: dict | None
    step_history: list[StepHistory]
    total_duration: float
    failed_at_step: str | None
    error: str | None

# On failure:
# - Step history is preserved up to failure point
# - Sandbox is cleaned up
# - Error details are returned
# - Partial context is available for debugging
```

---

## API Endpoints

**File**: `python/src/agent_work_orders/api/routes.py`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/work-orders` | POST | Create new work order |
| `/work-orders/{id}` | GET | Get work order status |
| `/work-orders/{id}/execute` | POST | Execute workflow (SSE) |
| `/work-orders/{id}/cancel` | POST | Cancel running workflow |
| `/work-orders/{id}/logs` | GET | Get execution logs |

---

## Directory Structure

```
python/src/agent_work_orders/
├── main.py                      # Entry point, FastAPI app
├── api/
│   └── routes.py                # REST endpoints
├── workflow_engine/
│   ├── orchestrator.py          # Main workflow executor
│   ├── operations.py            # Step definitions
│   └── agent_names.py           # Agent name constants
├── command_loader/
│   └── loader.py                # Load command templates
├── agent_executor/
│   └── executor.py              # Agent execution wrapper
├── sandbox_manager/
│   └── manager.py               # Git worktree isolation
├── github_integration/
│   └── github_service.py        # GitHub API operations
├── state_manager/
│   └── state.py                 # Workflow state persistence
└── database/
    └── models.py                # Database models
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `AGENT_WORK_ORDERS_PORT` | 8053 | Service port |
| `SANDBOX_BASE_DIR` | /tmp/archon-sandboxes | Sandbox location |
| `WORKFLOW_TIMEOUT` | 3600 | Max workflow duration (seconds) |
| `STEP_TIMEOUT` | 600 | Max step duration (seconds) |
| `GITHUB_TOKEN` | - | GitHub API token for PRs |

---

## Key Code References

| File | Purpose |
|------|---------|
| `python/src/agent_work_orders/main.py` | Entry point |
| `python/src/agent_work_orders/workflow_engine/orchestrator.py` | Main orchestrator |
| `python/src/agent_work_orders/workflow_engine/operations.py` | Step definitions |
| `python/src/agent_work_orders/workflow_engine/agent_names.py` | Agent constants |
| `python/src/agent_work_orders/sandbox_manager/manager.py` | Sandbox isolation |
| `python/src/agent_work_orders/api/routes.py` | REST API |

---

## Summary

The Agent Work Orders system provides:

1. **6-Step Sequential Workflow** - Structured development pipeline
2. **Specialized Agents** - Each step has a dedicated agent
3. **Context Passing** - Shared state between steps
4. **Sandbox Isolation** - Safe execution in git worktrees
5. **SSE Progress** - Real-time updates to clients
6. **Error Handling** - Step history preserved on failure

---

## Next Steps

- [02 - Pydantic Agents](./02-pydantic-agents.md) - How agents are implemented
- [01 - Architecture Overview](./01-architecture-overview.md) - System architecture
