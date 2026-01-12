## 1. Platform Overview

### 1.1 Executive Summary

Archon's Stage-Based Project Delivery System is a revolutionary multi-agent orchestration platform that transforms how software development projects are planned, executed, and delivered. By combining intelligent project type classification, stage-based workflows, and LLM-powered agent assignment, the system enables automated task breakdown from initial user request to final implementation.

**Key Capabilities**:
- **8 Project Type Classifications**: Automatic detection and framework selection
- **14 Specialized Agents**: Tier-based hierarchy from orchestration to implementation
- **Stage-Based Workflows**: Structured progression with quality gates
- **LLM-Powered Intelligence**: GPT-4o, Claude 3.5 Sonnet for agent assignment and execution
- **Human-in-the-Loop**: Seamless escalation for verification and expert intervention
- **Crash Recovery**: Project-ID based persistence for reliability

**Vision**: Enable non-technical users to manage AI-driven projects through natural conversation with a Coordinator Agent, while preserving full developer control via MCP and direct agent access.

### 1.2 Platform Ecosystem Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    ARCHON STAGE-BASED PROJECT DELIVERY SYSTEM                       │
│                  Multi-Agent Orchestration for Software Development                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              END USER INTERFACE                                     │
│                     (Natural Language Request via Chat/MCP)                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Request Examples:                                                                  │
│  • "Build a dark mode toggle for the dashboard"                                    │
│  • "Create a REST API for user authentication with JWT"                            │
│  • "Design a mobile-responsive landing page"                                       │
│  • "Integrate Stripe payment processing"                                           │
│                                                                                     │
└────────────────────────────────────┬────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           COORDINATOR AGENT (Entry Point)                           │
│                        Intent Understanding & Classification                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Responsibilities:                                                                  │
│  • Parse natural language request using LLM (GPT-4o/Claude)                        │
│  • Extract: project type, scope, requirements, constraints                         │
│  • Classify into 1 of 8 project types                                              │
│  • Validate feasibility and resource availability                                  │
│  • Ask clarifying questions if ambiguous                                           │
│                                                                                     │
│  Output: Structured ProjectRequest object                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ {                                                                             │ │
│  │   "action": "create_project",                                                 │ │
│  │   "project_type": "ui_ux",                                                    │ │
│  │   "deliverable": "dark mode toggle",                                          │ │
│  │   "scope": "dashboard, all pages",                                            │ │
│  │   "requirements": ["persist preference", "global application"],               │ │
│  │   "constraints": ["accessible", "WCAG 2.1 AA compliant"]                      │ │
│  │ }                                                                             │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       PROJECT MANAGER AGENT (Orchestrator)                          │
│                  Task Breakdown & Agent Assignment Engine                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Responsibilities:                                                                  │
│  • Select appropriate stage framework (based on project type)                      │
│  • Create project record with project_id (crash recovery)                         │
│  • Break down project into stages                                                 │
│  • Decompose each stage into tasks (0.5-4 hour granularity)                       │
│  • Assign specialized agents to tasks using capability matrix                     │
│  • Manage dependencies and execution order                                        │
│  • Track progress and stage transitions                                           │
│                                                                                     │
│  Stage Framework Selection:                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ if project_type == "ui_ux":                                                   │ │
│  │     framework = UI_UX_FRAMEWORK                                               │ │
│  │     stages = ["Research", "Wireframing", "Design",                            │ │
│  │               "Prototyping", "User Testing"]                                  │ │
│  │                                                                               │ │
│  │ elif project_type == "innovation":                                            │ │
│  │     framework = INNOVATION_FRAMEWORK                                          │ │
│  │     stages = ["Ideation", "Research", "Prototype",                            │ │
│  │               "Validation", "Decision Point"]                                 │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│  Task Creation Output:                                                             │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ Stage 1: Research (2-3 days)                                                  │ │
│  │   ├─ Task 1: Analyze dark mode patterns (ux-ui-researcher, 1.5hr)            │ │
│  │   ├─ Task 2: Research accessibility requirements (ux-ui-researcher, 1hr)     │ │
│  │   └─ Quality Gate: Research completeness > 80%                               │ │
│  │                                                                               │ │
│  │ Stage 2: Wireframing (2-3 days)                                               │ │
│  │   ├─ Task 3: Create lo-fi wireframes (ui-implementation-expert, 2hr)         │ │
│  │   ├─ Task 4: Design component tree (architect, 1.5hr)                        │ │
│  │   └─ Quality Gate: Stakeholder approval (manual)                             │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────────────────┘
                                     │
                        ┌────────────┴────────────┐
                        ▼                         ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│   SPECIALIZED AGENT POOL         │  │   SPECIALIZED AGENT POOL         │
│   (14 Agents, Tier 1-5)          │  │   (Parallel Execution)           │
├──────────────────────────────────┤  ├──────────────────────────────────┤
│                                  │  │                                  │
│ TIER 1: Orchestrator             │  │ TIER 4: Implementation Experts   │
│ • planner                        │  │ • ui-implementation-expert       │
│                                  │  │ • backend-api-expert             │
│ TIER 2: Architecture & Strategy  │  │ • database-expert                │
│ • architect                      │  │ • integration-expert             │
│ • llms-expert                    │  │                                  │
│ • computer-vision-expert         │  │ TIER 5: Quality & Documentation  │
│                                  │  │ • testing-expert                 │
│ TIER 3: Specialist Researchers   │  │ • performance-expert             │
│ • codebase-analyst               │  │ • documentation-expert           │
│ • library-researcher             │  │                                  │
│ • ux-ui-researcher               │  │                                  │
│                                  │  │                                  │
│ Each agent has:                  │  │ Each agent accesses:             │
│ • Defined capabilities           │  │ • Claude Code (direct)           │
│ • Stage restrictions             │  │ • GPT-4o API                     │
│ • Task duration targets          │  │ • Local models (Ollama)          │
│ • LLM access methods             │  │ • Archon knowledge base (RAG)    │
└────────────┬─────────────────────┘  └─────────────────┬────────────────┘
             │                                          │
             └──────────────────┬───────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                      TASK EXECUTION & LLM INTEGRATION                               │
│                    (Agent executes via Claude Code/API)                             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Execution Pattern:                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ # Agent receives task from project manager                                    │ │
│  │ task = find_tasks(task_id="abc-123")                                          │ │
│  │                                                                               │ │
│  │ # Agent accesses LLM via Claude Code                                          │ │
│  │ response = claude_code.execute(                                               │ │
│  │     prompt=f"Implement {task.title}\nContext: {task.description}",           │ │
│  │     context=search_archon_knowledge_base(task.feature)                        │ │
│  │ )                                                                             │ │
│  │                                                                               │ │
│  │ # Agent writes code/documentation                                             │ │
│  │ result = implement_solution(response)                                         │ │
│  │                                                                               │ │
│  │ # Agent updates task status                                                   │ │
│  │ manage_task("update", task_id="abc-123",                                      │ │
│  │             status="done", output=result)                                     │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                  QUALITY GATES & HUMAN VERIFICATION                                 │
│                 (Automated Checks + Manual Approval)                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Quality Gate Types:                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. AUTOMATED BINARY CHECKS (Pass/Fail)                                        │ │
│  │    • All tests passing                                                        │ │
│  │    • Linting errors = 0                                                       │ │
│  │    • Code coverage > 80%                                                      │ │
│  │    • Security vulnerabilities = 0                                             │ │
│  │                                                                               │ │
│  │ 2. SCORED CRITERIA (0-100 with threshold)                                     │ │
│  │    • Research completeness: 80% minimum                                       │ │
│  │    • Design system compliance: 90% minimum                                    │ │
│  │    • User satisfaction: 85% minimum                                           │ │
│  │    • Performance benchmarks: 90% of targets                                   │ │
│  │                                                                               │ │
│  │ 3. MANUAL APPROVAL GATES (Human Review Required)                              │ │
│  │    • Stakeholder sign-off on wireframes                                       │ │
│  │    • Security review for authentication changes                               │ │
│  │    • Legal approval for data handling                                         │ │
│  │    • Production deployment approval                                           │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│  Human Escalation Workflow:                                                         │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ Agent completes task                                                          │ │
│  │     ↓                                                                         │ │
│  │ Quality gate runs automated checks                                            │ │
│  │     ↓                                                                         │ │
│  │ Score < threshold? → YES → Escalate to Human Expert                           │ │
│  │     │                           ↓                                             │ │
│  │     NO                    Notification sent                                   │ │
│  │     ↓                           ↓                                             │ │
│  │ Proceed to next stage      Human reviews                                      │ │
│  │                                 ↓                                             │ │
│  │                         Approves OR Rejects                                   │ │
│  │                                 ↓                                             │ │
│  │                         Agent addresses feedback                              │ │
│  │                         OR human takes over                                   │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         STAGE TRANSITION & PROGRESS TRACKING                        │
│                      (Automated/Manual Based on Gate Type)                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Transition Logic:                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ if all_tasks_complete(current_stage) AND quality_gate_passed(current_stage):  │ │
│  │     if gate.approval_type == "automatic":                                     │ │
│  │         transition_stage(project_id, to_stage=next_stage)                     │ │
│  │     elif gate.approval_type == "manual":                                      │ │
│  │         request_human_approval(project_id, current_stage, next_stage)         │ │
│  │         # Wait for approval...                                                │ │
│  │         if approved:                                                          │ │
│  │             transition_stage(project_id, to_stage=next_stage)                 │ │
│  │         else:                                                                 │ │
│  │             rollback_or_fix(project_id, feedback)                             │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│  Progress Visualization:                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │ Project: Dark Mode Toggle                                                     │ │
│  │ Type: UI/UX Design                                                            │ │
│  │                                                                               │ │
│  │ [✓] Research ──────► [✓] Wireframing ──────► [⚙] Design ──────► [ ] Prototype│ │
│  │                                                                               │ │
│  │ Current Stage: Design (Day 2 of 3-5)                                          │ │
│  │ Tasks Complete: 5/7                                                           │ │
│  │ Next Gate: Design system compliance > 90%                                     │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────────────────┘
                                     │
                                     ▼
                             PROJECT COMPLETION
                     (All stages complete, deliverable ready)
```

### 1.3 Technology Stack Alignment

**Backend Infrastructure**
- **Language**: Python 3.12+
- **Framework**: FastAPI 0.109.0+ (async/await, high performance)
- **Database**: Supabase (PostgreSQL 15+ with pgvector extension)
- **ORM**: SQLAlchemy 2.0+ (for database models and migrations)
- **Agent Framework**: PydanticAI (type-safe agent definitions)

**LLM Integration**
- **Primary LLM**: GPT-4o (OpenAI) for agent assignment and classification
- **Secondary LLM**: Claude 3.5 Sonnet (Anthropic) for complex reasoning
- **Local Models**: Ollama (Llama 3.1, Qwen) for privacy-sensitive operations
- **Embeddings**: text-embedding-3-small (OpenAI) for semantic search
- **Vector Search**: pgvector (cosine similarity, HNSW index)

**Agent Execution Environment**
- **Primary**: Claude Code (direct tool invocation for agents)
- **API Access**: OpenAI API, Anthropic API (for programmatic LLM calls)
- **Orchestration**: LangGraph (for complex multi-agent workflows)
- **Caching**: Redis (for LLM response caching, session management)

**Frontend Dashboard**
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (fast HMR, optimized production builds)
- **State Management**: TanStack Query v5 (server state caching)
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 4+

**Development Tools**
- **Testing**: Pytest (backend), Vitest (frontend), Playwright (E2E)
- **Linting**: Ruff (Python), ESLint (TypeScript)
- **Formatting**: Ruff (Python), Prettier (TypeScript)
- **Type Checking**: MyPy (Python), TypeScript compiler
- **Monitoring**: Langfuse (LLM observability), Logfire (application logs)

### 1.4 Core Architecture Components

#### 1.4.1 Coordinator Agent (Entry Point)

**Role**: First point of contact for all user requests, responsible for understanding intent and classifying projects.

**Capabilities**:
```python
class CoordinatorAgent:
    """Entry point agent that processes user requests"""

    def understand_intent(self, user_request: str) -> ProjectIntent:
        """Parse natural language request using LLM"""
        # Uses GPT-4o to extract structured intent
        pass

    def classify_project_type(self, intent: ProjectIntent) -> ProjectType:
        """Classify into 1 of 8 project types"""
        # Uses few-shot learning with project type examples
        pass

    def validate_feasibility(self, intent: ProjectIntent) -> ValidationResult:
        """Check if project is feasible with available resources"""
        pass

    def ask_clarifying_questions(self, ambiguities: List[str]) -> List[Answer]:
        """Request additional information from user"""
        pass
```

**Example Interaction**:
```
User: "Build a dark mode toggle for the dashboard"

Coordinator Agent Analysis:
  ├─ Action: create_project
  ├─ Project Type: ui_ux (detected from "dark mode toggle")
  ├─ Deliverable: Dark mode toggle component
  ├─ Scope: Dashboard (all pages)
  ├─ Requirements: [persist user preference, global application]
  └─ Constraints: [accessible, WCAG 2.1 AA compliant]

Output: ProjectRequest object → passed to Project Manager Agent
```

#### 1.4.2 Project Manager Agent (Orchestrator)

**Role**: Receives structured project request from Coordinator, creates project, breaks down into stages and tasks, assigns agents.

**Capabilities**:
```python
class ProjectManagerAgent:
    """Orchestrates project execution from start to finish"""

    def create_project(self, request: ProjectRequest) -> Project:
        """Create project record with crash recovery support"""
        # Generates project_id for all subsequent tasks
        pass

    def select_framework(self, project_type: ProjectType) -> StageFramework:
        """Select appropriate stage framework"""
        # Maps project type to framework (8 frameworks available)
        pass

    def create_stages(self, project: Project, framework: StageFramework) -> List[Stage]:
        """Create stage records for project"""
        pass

    def decompose_stage(self, stage: Stage, requirements: List[str]) -> List[Task]:
        """Break down stage into tasks (0.5-4 hour granularity)"""
        # Uses planner agent or LLM for intelligent decomposition
        pass

    def assign_agent(self, task: Task, stage: Stage) -> str:
        """Assign specialized agent to task"""
        # Uses capability matrix and stage restrictions
        pass
```

**Example Task Breakdown**:
```python
# Project: Dark Mode Toggle (UI/UX type)
# Framework: UI_UX_FRAMEWORK (5 stages)

Stage 1: Research (2-3 days)
  ├─ Task 1: Analyze existing dark mode patterns
  │   ├─ Assignee: ux-ui-researcher
  │   ├─ Estimated: 1.5 hours
  │   └─ Dependencies: []
  │
  ├─ Task 2: Research accessibility requirements (WCAG 2.1)
  │   ├─ Assignee: ux-ui-researcher
  │   ├─ Estimated: 1.0 hours
  │   └─ Dependencies: [Task 1]
  │
  └─ Quality Gate: Research completeness > 80%

Stage 2: Wireframing (2-3 days)
  ├─ Task 3: Create lo-fi wireframes for toggle UI
  │   ├─ Assignee: ui-implementation-expert
  │   ├─ Estimated: 2.0 hours
  │   └─ Dependencies: [Task 2]
  │
  ├─ Task 4: Design component tree and state management
  │   ├─ Assignee: architect
  │   ├─ Estimated: 1.5 hours
  │   └─ Dependencies: [Task 3]
  │
  └─ Quality Gate: Stakeholder approval (manual)

[Continues through all 5 stages...]
```

#### 1.4.3 Specialized Agent Pool (14 Agents)

**Tier Structure**:
- **Tier 1**: Orchestrator (1 agent) - planner
- **Tier 2**: Architecture & Strategy (3 agents) - architect, llms-expert, computer-vision-expert
- **Tier 3**: Specialist Researchers (3 agents) - codebase-analyst, library-researcher, ux-ui-researcher
- **Tier 4**: Implementation Experts (4 agents) - ui-implementation-expert, backend-api-expert, database-expert, integration-expert
- **Tier 5**: Quality & Documentation (3 agents) - testing-expert, performance-expert, documentation-expert

**Agent Execution Pattern**:
```python
# Example: ui-implementation-expert executing task

class UIImplementationExpert(SpecializedAgent):
    """Expert in frontend UI component implementation"""

    async def execute_task(self, task: Task) -> TaskResult:
        """Execute task using Claude Code"""

        # 1. Retrieve task context
        context = await self.get_task_context(task)

        # 2. Search knowledge base for similar patterns
        examples = await search_archon_knowledge_base(
            query=f"React component {task.feature}",
            match_count=3
        )

        # 3. Execute via Claude Code (direct LLM access)
        response = await claude_code.execute(
            prompt=f"""
            Implement {task.title}

            Requirements:
            {task.description}

            Similar examples:
            {examples}

            Constraints:
            - Must be accessible (WCAG 2.1 AA)
            - Must use design system tokens
            - Must include unit tests
            """,
            tools=["Read", "Write", "Edit", "Bash"],
            context=context
        )

        # 4. Update task status
        await self.update_task(
            task_id=task.id,
            status="done",
            output=response,
            quality_score=await self.calculate_quality(response)
        )

        return TaskResult(success=True, output=response)
```

---

