# Archon Stage-Based Project Delivery System
## Multi-Agent Orchestration Platform for Structured Software Development

**Version**: 1.0.0
**Date**: 2026-01-12
**Status**: Foundation Document
**Target Audience**: Planner Agent (primary), Developers (secondary), Project Managers (tertiary)

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Project Types Taxonomy](#2-project-types-taxonomy)
3. [Stage Frameworks](#3-stage-frameworks)
4. [Agent Assignment Matrix](#4-agent-assignment-matrix)
5. [Multi-Agent Workflow Architecture](#5-multi-agent-workflow-architecture)
6. [Integration with Existing Archon System](#6-integration-with-existing-archon-system)
7. [Task Lifecycle Documentation](#7-task-lifecycle-documentation)
8. [Quality Gates & Transition Criteria](#8-quality-gates--transition-criteria)
9. [Agent Capabilities & Constraints](#9-agent-capabilities--constraints)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Diagrams & Visualizations](#11-diagrams--visualizations)
12. [Code Examples Reference](#12-code-examples-reference)
13. [Appendices](#13-appendices)

---

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

## 2. Project Types Taxonomy

### 2.1 Overview of 8 Project Types

Archon supports 8 distinct project types, each with tailored stage frameworks, agent assignments, and quality criteria. Project type classification happens automatically via the Coordinator Agent using LLM-based analysis of user requests.

**Classification Decision Tree**:
```
User Request Analysis
    │
    ├─ Contains "prototype", "experiment", "test idea"?
    │   └─ YES → INNOVATION/CONCEPT DEVELOPMENT
    │
    ├─ Contains "build feature", "add functionality", "implement"?
    │   └─ YES → TRADITIONAL DEVELOPMENT
    │
    ├─ Contains "design", "wireframe", "UI", "UX", "interface"?
    │   └─ YES → UI/UX DESIGN
    │
    ├─ Contains "API", "endpoint", "backend", "server", "database"?
    │   └─ YES → API/BACKEND DEVELOPMENT
    │
    ├─ Contains "integrate", "connect", "third-party", "webhook"?
    │   └─ YES → INTEGRATION
    │
    ├─ Contains "research", "investigate", "explore", "proof of concept"?
    │   └─ YES → RESEARCH/PROTOTYPING
    │
    ├─ Contains "AI", "ML", "model", "training", "prediction"?
    │   └─ YES → AI/ML DEVELOPMENT
    │
    └─ Contains "full application", "complete system", "end-to-end"?
        └─ YES → FULL-STACK PRODUCT
```

### 2.2 Innovation/Concept Development Projects

**Definition**: Exploratory projects focused on validating new ideas, testing hypotheses, or creating proof-of-concepts to determine feasibility before committing to full development.

**Characteristics**:
- **High Uncertainty**: Outcomes are unpredictable, pivots expected
- **Rapid Iteration**: Fast cycles of build-test-learn
- **Minimal Production Requirements**: Focus on functionality over polish
- **Learning-Oriented**: Primary goal is knowledge acquisition
- **Disposable Code**: Prototypes may be discarded after learning

**Typical Duration**: 1-3 weeks
**Risk Level**: High (30-50% may not proceed past validation)
**Failure Rate**: 40-60% (by design - validates ideas cheaply)

**Stage Sequence**:
1. **Ideation** (2-3 days) - Problem definition and approach brainstorming
2. **Research** (3-5 days) - Library research, technical feasibility
3. **Prototype** (5-10 days) - Build minimal working version
4. **Validation** (2-4 days) - Test with users or stakeholders
5. **Decision Point** (1 day) - Pivot, persevere, or archive

**Success Criteria**:
- ✅ Hypothesis validated or invalidated with evidence
- ✅ Working prototype demonstrates core concept
- ✅ Technical feasibility proven for scale-up
- ✅ Clear decision made: proceed to development OR archive
- ✅ Learnings documented for future reference

**Example Projects**:
- Testing a new UI paradigm for data visualization
- Proof-of-concept for AI-powered recommendation engine
- Experimental integration with emerging third-party API
- Validating performance of new tech stack (e.g., Rust backend)

**Agent Assignment Priority**:
- **Primary**: planner (orchestration), library-researcher (external tools), codebase-analyst (patterns)
- **Supporting**: architect (technical decisions), llms-expert (if AI-related)
- **Restricted**: testing-expert (too early for rigorous testing), documentation-expert (premature documentation)

### 2.3 Traditional Development/Coding Projects

**Definition**: Standard software development projects with well-defined requirements, established patterns, and predictable implementation paths. These are the bread-and-butter projects of most development teams.

**Characteristics**:
- **Clear Requirements**: Specifications are known upfront
- **Established Patterns**: Uses proven technical approaches
- **Predictable Timeline**: Low uncertainty in estimates
- **Production-Ready Output**: Fully tested and documented
- **Incremental Enhancement**: Builds on existing systems

**Typical Duration**: 2-6 weeks
**Risk Level**: Low-Medium (10-20% scope changes)
**Failure Rate**: <10% (well-understood work)

**Stage Sequence**:
1. **Planning** (2-4 days) - Requirements analysis, task breakdown
2. **Design** (3-5 days) - Technical design, API contracts, data models
3. **Implementation** (1-4 weeks) - Actual coding, unit tests
4. **Testing** (3-7 days) - Integration tests, E2E tests, QA
5. **Deployment** (1-2 days) - Production release, monitoring setup

**Success Criteria**:
- ✅ All acceptance criteria met
- ✅ Code coverage >80% with passing tests
- ✅ Performance benchmarks achieved (p95 latency, throughput)
- ✅ Security audit passed (no critical vulnerabilities)
- ✅ Documentation complete (API docs, README, migration guide)

**Example Projects**:
- Add pagination to user list endpoint
- Implement password reset flow with email verification
- Create admin dashboard for content moderation
- Refactor authentication service to use JWT tokens

**Agent Assignment Priority**:
- **Primary**: backend-api-expert, ui-implementation-expert, database-expert (depending on focus)
- **Supporting**: testing-expert (throughout), architect (design phase)
- **Restricted**: None (all agents may contribute)

### 2.4 UI/UX Design Projects

**Definition**: Projects primarily focused on user interface design, user experience optimization, and visual design. May include implementation or stop at design handoff.

**Characteristics**:
- **User-Centered**: Primary focus on user needs and usability
- **Visual Design**: Aesthetics and brand alignment important
- **Iterative Refinement**: Multiple rounds of feedback and revision
- **Accessibility Mandatory**: WCAG 2.1 AA compliance required
- **Design System Consistency**: Adherence to established patterns

**Typical Duration**: 1-4 weeks
**Risk Level**: Medium (25-30% revision rate based on user feedback)
**Failure Rate**: <15% (subjective, but usability testable)

**Stage Sequence**:
1. **Research & Discovery** (3-5 days) - User research, competitive analysis
2. **Information Architecture** (2-3 days) - Sitemaps, user flows
3. **Wireframing** (3-5 days) - Low-fidelity layouts
4. **Design** (5-10 days) - High-fidelity mockups, design system
5. **Prototyping** (3-5 days) - Interactive prototypes
6. **User Testing** (3-5 days) - Usability testing, iteration
7. **Handoff** (1-2 days) - Design specs, asset export, developer collaboration

**Success Criteria**:
- ✅ SUS (System Usability Scale) score >70
- ✅ WCAG 2.1 AA compliance (automated and manual audit)
- ✅ Design system compliance >95%
- ✅ Stakeholder approval obtained
- ✅ User testing validates design decisions (n≥5 users)

**Example Projects**:
- Redesign onboarding flow to reduce drop-off
- Create mobile-responsive landing page
- Design component library for design system
- Optimize checkout flow for conversion

**Agent Assignment Priority**:
- **Primary**: ux-ui-researcher (research, testing), ui-implementation-expert (prototyping, implementation)
- **Supporting**: codebase-analyst (existing patterns), architect (component architecture)
- **Restricted**: backend-api-expert (until implementation), database-expert (not design-relevant)

### 2.5 API/Backend Development Projects

**Definition**: Server-side development projects focusing on business logic, data models, API design, and backend infrastructure.

**Characteristics**:
- **Data-Centric**: Focus on data models, persistence, integrity
- **API-First**: RESTful or GraphQL endpoints as primary deliverable
- **Performance Critical**: Latency, throughput, scalability matter
- **Security-Sensitive**: Authentication, authorization, input validation
- **Documentation Required**: OpenAPI/Swagger specs mandatory

**Typical Duration**: 2-8 weeks
**Risk Level**: Medium (20-25% technical challenges)
**Failure Rate**: 10-15% (often integration issues)

**Stage Sequence**:
1. **API Design** (3-5 days) - OpenAPI spec, endpoint design
2. **Schema Design** (2-4 days) - Database schema, migrations
3. **Implementation** (1-5 weeks) - Business logic, endpoints, tests
4. **Testing & Security** (5-10 days) - Integration tests, security audit
5. **Documentation** (2-3 days) - API docs, deployment guide
6. **Deployment** (1-2 days) - Staging/production deployment

**Success Criteria**:
- ✅ All endpoints implemented per OpenAPI spec
- ✅ Response time <100ms p95 for simple queries
- ✅ OWASP Top 10 vulnerabilities addressed
- ✅ API documentation complete (Swagger UI functional)
- ✅ Database migrations backward-compatible

**Example Projects**:
- Build RESTful API for user management
- Create GraphQL API for content delivery
- Implement webhook system for event notifications
- Design and build payment processing backend

**Agent Assignment Priority**:
- **Primary**: backend-api-expert, database-expert
- **Supporting**: architect (API design), testing-expert (test strategy), integration-expert (third-party services)
- **Restricted**: ui-implementation-expert (not backend work), ux-ui-researcher (not applicable)

### 2.6 Integration Projects

**Definition**: Projects connecting Archon or related systems to external services, third-party APIs, or internal systems via APIs, webhooks, or other integration patterns.

**Characteristics**:
- **External Dependencies**: Reliant on third-party API availability
- **Documentation-Heavy**: Must understand external API docs thoroughly
- **Error Handling Critical**: Network failures, rate limits, timeouts
- **Authentication Complex**: OAuth, API keys, JWT, webhook signatures
- **Monitoring Essential**: Health checks, retry logic, alerting

**Typical Duration**: 1-3 weeks
**Risk Level**: High (30-35% due to external API complexity)
**Failure Rate**: 15-20% (often API limitations or changes)

**Stage Sequence**:
1. **Discovery** (2-3 days) - API research, documentation review
2. **API Research** (3-5 days) - Test endpoints, authentication, rate limits
3. **Integration** (5-15 days) - Implement integration, error handling
4. **Testing** (3-5 days) - End-to-end testing, edge cases
5. **Monitoring** (1-2 days) - Health checks, alerting, logging

**Success Criteria**:
- ✅ Integration functional for all documented use cases
- ✅ Error handling covers all API error codes
- ✅ Retry logic implemented with exponential backoff
- ✅ Rate limiting respected (no 429 errors)
- ✅ Monitoring alerts configured (uptime, error rate)

**Example Projects**:
- Integrate Stripe payment processing
- Connect to SendGrid for email delivery
- Implement Slack webhook notifications
- Sync data with Salesforce CRM

**Agent Assignment Priority**:
- **Primary**: integration-expert, library-researcher
- **Supporting**: backend-api-expert (API wrapper), testing-expert (edge cases)
- **Restricted**: ui-implementation-expert (unless integration has UI component)

### 2.7 Research/Prototyping Projects

**Definition**: Investigation projects exploring new technologies, patterns, or approaches without commitment to production implementation. Similar to Innovation but more focused on learning than building.

**Characteristics**:
- **Learning-First**: Primary goal is knowledge acquisition
- **Low Code Volume**: Code is exploratory, not production-quality
- **Documentation-Heavy**: Findings must be thoroughly documented
- **Time-Boxed**: Fixed duration regardless of outcomes
- **Decision Artifact**: Produces "build vs buy vs skip" recommendation

**Typical Duration**: 1-2 weeks
**Risk Level**: Medium (findings may be inconclusive)
**Failure Rate**: N/A (all outcomes valuable)

**Stage Sequence**:
1. **Literature Review** (2-3 days) - Research existing solutions, papers
2. **Experimentation** (5-10 days) - Hands-on testing, spike implementation
3. **Analysis** (2-3 days) - Evaluate findings, trade-offs
4. **Documentation** (1-2 days) - Decision document, recommendations

**Success Criteria**:
- ✅ Research question answered with evidence
- ✅ Trade-offs clearly documented (pros/cons)
- ✅ Recommendation made (build, buy, or skip)
- ✅ Code examples archived for future reference
- ✅ Learnings shared with team

**Example Projects**:
- Evaluate GraphQL vs REST for new API
- Research real-time sync solutions (WebSockets, SSE, polling)
- Investigate state management libraries for React
- Assess AI frameworks for document processing

**Agent Assignment Priority**:
- **Primary**: library-researcher, codebase-analyst
- **Supporting**: architect (evaluation criteria), documentation-expert (write-up)
- **Restricted**: testing-expert (not testing production code), performance-expert (premature optimization)

### 2.8 AI/ML Development Projects

**Definition**: Projects involving machine learning models, AI systems, training pipelines, or intelligent automation features.

**Characteristics**:
- **Data-Centric**: Quality and quantity of data critical
- **Iterative Training**: Model performance improves over iterations
- **Non-Deterministic**: Outputs are probabilistic, not deterministic
- **Compute-Intensive**: Training requires significant resources
- **Monitoring Complex**: Model drift, performance degradation over time

**Typical Duration**: 3-12 weeks
**Risk Level**: High (35-40% model performance issues)
**Failure Rate**: 20-30% (performance targets not met)

**Stage Sequence**:
1. **Problem Definition** (3-5 days) - Use case, success metrics, feasibility
2. **Data Preparation** (1-2 weeks) - Data collection, cleaning, labeling
3. **Model Development** (2-4 weeks) - Algorithm selection, training, tuning
4. **Evaluation** (5-10 days) - Performance testing, bias audit
5. **Deployment (MLOps)** (1-2 weeks) - Model serving, API wrapper
6. **Monitoring** (Ongoing) - Drift detection, retraining triggers

**Success Criteria**:
- ✅ Model performance meets business requirements (accuracy, F1, etc.)
- ✅ Inference latency <500ms p95
- ✅ Bias/fairness audit passed
- ✅ Model interpretability validated
- ✅ Monitoring dashboard operational

**Example Projects**:
- Build semantic search using embeddings
- Create content recommendation system
- Implement image classification for document processing
- Develop chatbot using RAG architecture

**Agent Assignment Priority**:
- **Primary**: llms-expert (LLM-based AI), computer-vision-expert (image/video)
- **Supporting**: backend-api-expert (model serving), database-expert (vector storage), performance-expert (optimization)
- **Restricted**: ui-implementation-expert (unless building AI UI), ux-ui-researcher (not ML work)

### 2.9 Full-Stack Product Projects

**Definition**: Comprehensive projects spanning frontend, backend, database, and deployment. Represents complete product development from concept to production.

**Characteristics**:
- **Multi-Discipline**: Requires coordination across all specialties
- **Complex Dependencies**: Frontend depends on backend, backend on database
- **Long Duration**: Typically measured in months
- **High Coordination**: Multiple agents working in parallel
- **Production-Grade**: All layers must be deployment-ready

**Typical Duration**: 4-16 weeks
**Risk Level**: High (40-50% scope evolution)
**Failure Rate**: 15-25% (often timeline or budget overruns)

**Stage Sequence**:
1. **Discovery** (1-2 weeks) - Requirements, user research, feasibility
2. **Architecture** (1-2 weeks) - System design, tech stack, infrastructure
3. **Frontend Development** (2-6 weeks) - UI components, pages, interactions
4. **Backend Development** (2-6 weeks) - APIs, business logic, data models (parallel with frontend)
5. **Integration** (1-2 weeks) - Connect frontend to backend
6. **Testing** (1-2 weeks) - E2E tests, performance tests, security audit
7. **Deployment** (3-5 days) - Production deployment, monitoring, documentation

**Success Criteria**:
- ✅ All user stories complete and accepted
- ✅ Performance targets met (page load <2s, API <100ms)
- ✅ Security audit passed (OWASP, penetration test)
- ✅ 99.9% uptime SLA achieved in first month
- ✅ User onboarding <5 minutes (time-to-value)

**Example Projects**:
- Build complete SaaS product (e.g., project management tool)
- Create e-commerce platform with payment processing
- Develop mobile-responsive web application
- Build internal admin portal with role-based access

**Agent Assignment Priority**:
- **Primary**: ALL agents may contribute depending on phase
- **Orchestration**: planner (coordinates), architect (technical decisions), project-manager-agent (task management)
- **Implementation**: ui-implementation-expert, backend-api-expert, database-expert, integration-expert (parallel work)
- **Quality**: testing-expert, performance-expert, documentation-expert (throughout)

---

## 3. Stage Frameworks

### 3.1 Overview

Each of the 8 project types has a tailored stage framework that defines the progression from initial concept to completion. Stages provide structure, checkpoints, and clear handoffs between different types of work.

**Universal Stage Principles**:
1. **Sequential Progression**: Stages execute in order (with exceptions for parallel work)
2. **Quality Gates**: Each stage has entry and exit criteria
3. **Clear Deliverables**: Every stage produces specific outputs
4. **Time-Bounded**: Stages have estimated durations
5. **Agent-Specific**: Only certain agents allowed per stage

### 3.2 Innovation/Concept Development Framework

**Project Type**: Innovation/Concept Development
**Total Duration**: 1-3 weeks
**Stages**: 5
**Primary Goal**: Validate idea feasibility cheaply before full commitment

#### Stage 1: Ideation (2-3 days)

**Purpose**: Define problem and generate potential approaches

**Entry Criteria**:
- [ ] Problem statement drafted
- [ ] Stakeholder identified (who needs this?)
- [ ] Success metrics defined (how will we measure success?)

**Exit Criteria**:
- [ ] 3-5 concrete solution approaches identified
- [ ] Technical feasibility assessed for each approach
- [ ] Approach selected for prototyping
- [ ] Resource requirements estimated

**Deliverables**:
1. **Concept Document** (Markdown)
   - Problem statement (Why are we doing this?)
   - Current situation (What's the pain point?)
   - Proposed approaches (3-5 options with pros/cons)
   - Selected approach with rationale
   - Success criteria (measurable outcomes)
2. **Technical Feasibility Analysis**
   - Technical risks identified
   - Required technologies/libraries
   - Estimated complexity (Low/Med/High)
3. **Resource Requirements**
   - Estimated hours per role
   - Required skills/expertise
   - Budget estimate (if applicable)

**Allowed Agents**:
- ✅ planner (orchestration, approach generation)
- ✅ architect (technical feasibility)
- ✅ llms-expert (if AI-related)
- ✅ codebase-analyst (existing pattern analysis)
- ❌ ui-implementation-expert (too early)
- ❌ testing-expert (no code to test yet)

**Quality Gates**:
- **Must-Meet**: Problem statement clear and measurable (binary)
- **Should-Meet**: Multiple approaches explored (score ≥80/100)
- **Approval**: Automatic if quality score ≥70

**Example Tasks**:
```python
Task 1: Define problem statement and success metrics
  Assignee: planner
  Duration: 1.5 hours
  Output: Problem statement doc with SMART success criteria

Task 2: Generate 5 solution approaches
  Assignee: planner + architect (collaboration)
  Duration: 2 hours
  Output: List of approaches with pros/cons/feasibility

Task 3: Assess technical feasibility for each approach
  Assignee: architect
  Duration: 2 hours
  Dependencies: [Task 2]
  Output: Technical feasibility matrix

Task 4: Select approach and document rationale
  Assignee: planner
  Duration: 1 hour
  Dependencies: [Task 3]
  Output: Decision document with selected approach
```

#### Stage 2: Research (3-5 days)

**Purpose**: Investigate libraries, patterns, and technical details needed for prototype

**Entry Criteria**:
- [ ] Approach selected from Ideation stage
- [ ] Resources allocated (agent assignments, time)
- [ ] Research questions defined

**Exit Criteria**:
- [ ] All critical unknowns investigated
- [ ] Libraries/tools identified and evaluated
- [ ] Code examples found (≥80% coverage of features)
- [ ] Architecture sketch created

**Deliverables**:
1. **Research Report** (Markdown with code examples)
   - Libraries evaluated (with version numbers)
   - Comparison matrix (features, maturity, community)
   - Code examples for key functionality
   - Integration patterns identified
2. **Architecture Diagram** (ASCII or Mermaid)
   - System components
   - Data flow
   - Integration points
3. **Prototype Plan**
   - Features to include in prototype
   - Out-of-scope items
   - Timeline estimate

**Allowed Agents**:
- ✅ library-researcher (primary - external library research)
- ✅ codebase-analyst (existing patterns)
- ✅ llms-expert (AI/ML libraries if relevant)
- ✅ architect (architecture design)
- ❌ ui-implementation-expert (not yet implementing)
- ❌ backend-api-expert (not yet implementing)

**Quality Gates**:
- **Must-Meet**: All research questions answered (binary)
- **Should-Meet**: Code examples found for ≥80% of features (score)
- **Approval**: Automatic if score ≥70

**Example Tasks**:
```python
Task 1: Research dark mode implementation libraries
  Assignee: library-researcher
  Duration: 1.5 hours
  Output: Library comparison (react-dark-mode, next-themes, etc.)

Task 2: Find code examples for theme persistence
  Assignee: library-researcher
  Duration: 1 hour
  Dependencies: [Task 1]
  Output: Code examples (localStorage, cookies, database)

Task 3: Analyze existing design system for theme support
  Assignee: codebase-analyst
  Duration: 1.5 hours
  Output: Current design system analysis + gaps

Task 4: Create architecture diagram
  Assignee: architect
  Duration: 2 hours
  Dependencies: [Task 1, Task 2, Task 3]
  Output: ASCII diagram showing theme context, components, storage
```

#### Stage 3: Prototype (5-10 days)

**Purpose**: Build minimal working version to validate concept

**Entry Criteria**:
- [ ] Research findings reviewed and approved
- [ ] Architecture design approved
- [ ] Development environment ready

**Exit Criteria**:
- [ ] Core functionality working
- [ ] Prototype deployed to test environment
- [ ] Demo-able to stakeholders
- [ ] Technical debt documented

**Deliverables**:
1. **Working Prototype** (code repository)
   - Core features functional
   - Basic tests (not comprehensive)
   - README with setup instructions
2. **Demo Script**
   - User journey walkthrough
   - Key features to showcase
   - Known limitations
3. **Technical Debt Log**
   - Shortcuts taken for speed
   - Production requirements not met
   - Refactoring needed for scale

**Allowed Agents**:
- ✅ ui-implementation-expert (if frontend prototype)
- ✅ backend-api-expert (if backend prototype)
- ✅ database-expert (if data persistence needed)
- ✅ integration-expert (if external API involved)
- ✅ llms-expert (if AI/ML features)
- ⚠️ testing-expert (basic tests only, not rigorous)
- ❌ performance-expert (premature optimization)

**Quality Gates**:
- **Must-Meet**: Core user journey works end-to-end (binary)
- **Should-Meet**: Code quality acceptable (score ≥70/100)
- **Approval**: Manual review by Product Manager

**Example Tasks**:
```python
Task 1: Implement theme context provider
  Assignee: ui-implementation-expert
  Duration: 2.5 hours
  Output: React context for theme state management

Task 2: Create dark mode toggle component
  Assignee: ui-implementation-expert
  Duration: 2 hours
  Dependencies: [Task 1]
  Output: Toggle UI component with accessibility

Task 3: Implement theme persistence
  Assignee: backend-api-expert
  Duration: 1.5 hours
  Dependencies: [Task 1]
  Output: LocalStorage save/load + optional API sync

Task 4: Apply theme to core components
  Assignee: ui-implementation-expert
  Duration: 3 hours
  Dependencies: [Task 2, Task 3]
  Output: 5-10 components styled for dark mode

Task 5: Deploy prototype to staging
  Assignee: backend-api-expert
  Duration: 1 hour
  Dependencies: [Task 4]
  Output: Live prototype URL for demo
```

#### Stage 4: Validation (2-4 days)

**Purpose**: Test prototype with users/stakeholders to validate approach

**Entry Criteria**:
- [ ] Prototype functional and deployed
- [ ] Test participants recruited (≥5 users)
- [ ] Test script prepared

**Exit Criteria**:
- [ ] User testing completed (n≥5)
- [ ] Feedback collected and analyzed
- [ ] Decision criteria met (validate or invalidate)
- [ ] Pivot/persevere decision made

**Deliverables**:
1. **User Testing Report**
   - Participant demographics
   - Test methodology
   - Key findings (positive and negative)
   - Quotes and observations
2. **Validation Metrics**
   - Usability metrics (SUS score, task completion)
   - Performance metrics (load time, response time)
   - Business metrics (engagement, conversion)
3. **Decision Recommendation**
   - Proceed to production? (Yes/No/Pivot)
   - Required changes if pivoting
   - Estimated effort for production build

**Allowed Agents**:
- ✅ testing-expert (test planning, analysis)
- ✅ ux-ui-researcher (user testing, usability)
- ✅ performance-expert (performance validation)
- ❌ Implementation agents (no new features in validation)

**Quality Gates**:
- **Must-Meet**: User testing completed with ≥5 participants (binary)
- **Should-Meet**: User satisfaction ≥70% (score)
- **Approval**: Manual review by Product Owner + Tech Lead

**Example Tasks**:
```python
Task 1: Create user testing script
  Assignee: ux-ui-researcher
  Duration: 1 hour
  Output: Test script with scenarios, questions

Task 2: Conduct user testing sessions (5 users)
  Assignee: ux-ui-researcher + human expert
  Duration: 4 hours
  Dependencies: [Task 1]
  Output: Session notes, recordings

Task 3: Analyze feedback and create report
  Assignee: ux-ui-researcher
  Duration: 2 hours
  Dependencies: [Task 2]
  Output: User testing report with findings

Task 4: Measure performance metrics
  Assignee: performance-expert
  Duration: 1.5 hours
  Output: Performance report (load time, bundle size)

Task 5: Make proceed/pivot/kill recommendation
  Assignee: planner
  Duration: 1 hour
  Dependencies: [Task 3, Task 4]
  Output: Decision document with rationale
```

#### Stage 5: Decision Point (1 day)

**Purpose**: Make final decision on project direction

**Entry Criteria**:
- [ ] Validation results reviewed
- [ ] All stakeholders aligned

**Exit Criteria**:
- [ ] Decision made: Proceed | Pivot | Archive
- [ ] Next steps documented
- [ ] Learnings archived

**Deliverables**:
1. **Decision Document**
   - Final decision with rationale
   - Key learnings (what worked, what didn't)
   - Next steps if proceeding
   - Archive rationale if killing
2. **Handoff Package** (if proceeding)
   - Prototype code repository
   - Research findings
   - Architecture diagrams
   - Production requirements

**Allowed Agents**:
- ✅ planner (decision synthesis)
- ✅ documentation-expert (handoff documentation)
- ❌ Implementation agents (decision phase only)

**Quality Gates**:
- **Must-Meet**: Decision documented (binary)
- **Should-Meet**: Learnings captured (score ≥80)
- **Approval**: Executive approval

### 3.3 Traditional Development Framework

**Project Type**: Traditional Development/Coding
**Total Duration**: 2-6 weeks
**Stages**: 5
**Primary Goal**: Deliver production-ready feature with tests and docs

#### Stage 1: Planning (2-4 days)

**Entry Criteria**:
- [ ] Requirements documented
- [ ] Acceptance criteria defined
- [ ] Team capacity confirmed

**Exit Criteria**:
- [ ] User stories written (INVEST criteria)
- [ ] Sprint backlog prioritized
- [ ] Definition of Done established
- [ ] Technical approach agreed

**Deliverables**:
1. User stories with acceptance criteria
2. Task breakdown (sprint backlog)
3. Definition of Done checklist
4. Risk register

**Allowed Agents**: planner, architect, codebase-analyst

**Quality Gates**:
- Must-Meet: Acceptance criteria clear and testable
- Should-Meet: User stories follow INVEST (score ≥90)
- Approval: Automatic

#### Stage 2: Design (3-5 days)

**Entry Criteria**:
- [ ] Planning complete
- [ ] Technical approach validated

**Exit Criteria**:
- [ ] API contracts defined (OpenAPI/GraphQL schema)
- [ ] Data models designed
- [ ] Architecture diagram created
- [ ] Design review approved

**Deliverables**:
1. API specification (OpenAPI 3.0)
2. Database schema with migrations
3. Component architecture diagram
4. Design review notes

**Allowed Agents**: architect, backend-api-expert, database-expert, ui-implementation-expert

**Quality Gates**:
- Must-Meet: API contracts complete
- Should-Meet: Design review passed (score ≥85)
- Approval: Manual (Tech Lead)

#### Stage 3: Implementation (1-4 weeks)

**Entry Criteria**:
- [ ] Design approved
- [ ] Development environment ready
- [ ] Dependencies installed

**Exit Criteria**:
- [ ] All acceptance criteria met
- [ ] Unit tests written (≥80% coverage)
- [ ] Code review passed
- [ ] Linting errors = 0

**Deliverables**:
1. Implementation code (feature branch)
2. Unit tests
3. Integration tests
4. Code review approval

**Allowed Agents**: ALL implementation agents (ui, backend, database, integration)

**Quality Gates**:
- Must-Meet: All tests passing, coverage ≥80%
- Should-Meet: Code quality score ≥85
- Approval: Automatic if gates pass

#### Stage 4: Testing (3-7 days)

**Entry Criteria**:
- [ ] Implementation complete
- [ ] Unit tests passing

**Exit Criteria**:
- [ ] E2E tests passing
- [ ] Performance benchmarks met
- [ ] Security audit clean
- [ ] QA sign-off

**Deliverables**:
1. E2E test suite
2. Performance test results
3. Security audit report
4. QA sign-off document

**Allowed Agents**: testing-expert, performance-expert

**Quality Gates**:
- Must-Meet: All tests passing, no critical bugs
- Should-Meet: Performance within 10% of targets
- Approval: Manual (QA Lead)

#### Stage 5: Deployment (1-2 days)

**Entry Criteria**:
- [ ] Testing complete
- [ ] Deployment checklist ready
- [ ] Rollback plan tested

**Exit Criteria**:
- [ ] Deployed to production
- [ ] Monitoring configured
- [ ] Documentation published
- [ ] No critical issues for 48 hours

**Deliverables**:
1. Production deployment
2. Monitoring dashboard
3. Runbook documentation
4. Release notes

**Allowed Agents**: backend-api-expert, performance-expert, documentation-expert

**Quality Gates**:
- Must-Meet: Zero-downtime deployment
- Should-Meet: Error rate <0.1% in first 48hrs
- Approval: Manual (Engineering Manager)

### 3.4 UI/UX Design Framework

**Project Type**: UI/UX Design
**Total Duration**: 1-4 weeks
**Stages**: 7
**Primary Goal**: Deliver user-tested, accessible design ready for implementation

#### Stage 1: Research & Discovery (3-5 days)

**Entry Criteria**:
- [ ] Design brief received
- [ ] Research questions defined

**Exit Criteria**:
- [ ] User personas created (3-5)
- [ ] Competitive analysis complete
- [ ] User journey maps created
- [ ] Insights synthesized

**Deliverables**:
1. User personas
2. Competitive analysis report
3. User journey maps
4. Research insights document

**Allowed Agents**: ux-ui-researcher

**Quality Gates**:
- Must-Meet: Research with ≥10 participants
- Should-Meet: Insights actionable (score ≥85)
- Approval: Automatic

#### Stage 2: Information Architecture (2-3 days)

**Entry Criteria**:
- [ ] Research insights reviewed

**Exit Criteria**:
- [ ] Sitemap created
- [ ] User flows documented
- [ ] Content strategy defined
- [ ] IA review approved

**Deliverables**:
1. Sitemap
2. User flow diagrams
3. Content hierarchy
4. IA review notes

**Allowed Agents**: ux-ui-researcher, architect

**Quality Gates**:
- Must-Meet: IA complete
- Should-Meet: User flows validated (score ≥80)
- Approval: Manual (UX Lead)

#### Stage 3: Wireframing (3-5 days)

**Entry Criteria**:
- [ ] IA approved
- [ ] Key screens identified

**Exit Criteria**:
- [ ] Lo-fi wireframes complete
- [ ] Annotations added
- [ ] Stakeholder feedback addressed
- [ ] Wireframes approved

**Deliverables**:
1. Lo-fi wireframes (Figma/Sketch)
2. Annotations document
3. Stakeholder feedback log
4. Approval sign-off

**Allowed Agents**: ui-implementation-expert, ux-ui-researcher

**Quality Gates**:
- Must-Meet: All key screens wireframed
- Should-Meet: Feedback addressed (score ≥90)
- Approval: Manual (Product Manager)

#### Stage 4: Design (5-10 days)

**Entry Criteria**:
- [ ] Wireframes approved
- [ ] Design system tokens available

**Exit Criteria**:
- [ ] Hi-fi mockups complete
- [ ] Design system applied consistently
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Design review approved

**Deliverables**:
1. Hi-fi mockups (Figma/Sketch)
2. Design tokens exported
3. Accessibility audit report
4. Design review notes

**Allowed Agents**: ui-implementation-expert, ux-ui-researcher

**Quality Gates**:
- Must-Meet: WCAG 2.1 AA compliance
- Should-Meet: Design system compliance ≥95%
- Approval: Manual (Design Lead)

#### Stage 5: Prototyping (3-5 days)

**Entry Criteria**:
- [ ] Hi-fi designs approved
- [ ] Prototype scope defined

**Exit Criteria**:
- [ ] Interactive prototype functional
- [ ] Key interactions implemented
- [ ] Prototype tested internally
- [ ] Ready for user testing

**Deliverables**:
1. Interactive prototype (Figma/code)
2. Interaction specifications
3. Internal test results
4. User test plan

**Allowed Agents**: ui-implementation-expert

**Quality Gates**:
- Must-Meet: Prototype functional
- Should-Meet: Interactions smooth (score ≥85)
- Approval: Automatic

#### Stage 6: User Testing (3-5 days)

**Entry Criteria**:
- [ ] Prototype ready
- [ ] Test participants recruited (≥8)

**Exit Criteria**:
- [ ] Testing with ≥8 users complete
- [ ] SUS score ≥70
- [ ] P0/P1 issues identified
- [ ] Iteration plan created

**Deliverables**:
1. User testing report
2. SUS score calculation
3. Issues list (P0/P1/P2)
4. Iteration plan

**Allowed Agents**: ux-ui-researcher, testing-expert

**Quality Gates**:
- Must-Meet: Testing with ≥8 users
- Should-Meet: SUS score ≥70
- Approval: Manual (UX Lead)

#### Stage 7: Handoff (1-2 days)

**Entry Criteria**:
- [ ] User testing issues addressed
- [ ] Design finalized

**Exit Criteria**:
- [ ] Design tokens exported
- [ ] Developer documentation complete
- [ ] Assets prepared (SVG, PNG, icons)
- [ ] Handoff meeting held

**Deliverables**:
1. Design tokens (JSON/CSS variables)
2. Developer documentation
3. Asset package (optimized)
4. Handoff meeting notes

**Allowed Agents**: documentation-expert, ui-implementation-expert

**Quality Gates**:
- Must-Meet: All assets exported
- Should-Meet: Documentation complete (score ≥90)
- Approval: Manual (Engineering Lead)

### 3.5 API/Backend Development Framework

**Project Type**: API/Backend Development
**Total Duration**: 2-8 weeks
**Stages**: 6
**Primary Goal**: Production-ready API with docs, tests, and monitoring

#### Stage 1: API Design (3-5 days)

**Entry Criteria**:
- [ ] Requirements clear
- [ ] Use cases documented

**Exit Criteria**:
- [ ] OpenAPI 3.0 spec complete
- [ ] Authentication strategy defined
- [ ] Rate limiting designed
- [ ] API review approved

**Deliverables**:
1. OpenAPI 3.0 specification
2. Authentication design doc
3. Rate limiting strategy
4. API review notes

**Allowed Agents**: architect, backend-api-expert

**Quality Gates**:
- Must-Meet: OpenAPI spec complete
- Should-Meet: API design follows REST best practices (score ≥90)
- Approval: Manual (API Lead)

#### Stage 2: Schema Design (2-4 days)

**Entry Criteria**:
- [ ] API design approved
- [ ] Data models identified

**Exit Criteria**:
- [ ] Database schema finalized
- [ ] Migrations written
- [ ] Indexes designed
- [ ] Schema review approved

**Deliverables**:
1. Database schema (SQL)
2. Migration scripts
3. Index strategy document
4. Schema review notes

**Allowed Agents**: database-expert, backend-api-expert

**Quality Gates**:
- Must-Meet: Schema normalized, migrations backward-compatible
- Should-Meet: Index strategy optimized (score ≥85)
- Approval: Manual (Database Lead)

#### Stage 3: Implementation (1-5 weeks)

**Entry Criteria**:
- [ ] API and schema approved
- [ ] Development environment ready

**Exit Criteria**:
- [ ] All endpoints implemented
- [ ] Business logic complete
- [ ] Unit tests ≥80% coverage
- [ ] Code review passed

**Deliverables**:
1. API implementation code
2. Unit tests
3. API documentation (Swagger UI)
4. Code review approval

**Allowed Agents**: backend-api-expert, database-expert

**Quality Gates**:
- Must-Meet: All endpoints functional, tests passing
- Should-Meet: Code quality score ≥85
- Approval: Automatic

#### Stage 4: Testing & Security (5-10 days)

**Entry Criteria**:
- [ ] Implementation complete
- [ ] Unit tests passing

**Exit Criteria**:
- [ ] Integration tests passing
- [ ] Load testing complete (1000 req/s)
- [ ] OWASP Top 10 audit clean
- [ ] Security review approved

**Deliverables**:
1. Integration test suite
2. Load test results
3. Security audit report
4. Security review sign-off

**Allowed Agents**: testing-expert, backend-api-expert

**Quality Gates**:
- Must-Meet: OWASP audit clean, load tests passing
- Should-Meet: p95 latency <100ms
- Approval: Manual (Security Team)

#### Stage 5: Documentation (2-3 days)

**Entry Criteria**:
- [ ] API functional and tested

**Exit Criteria**:
- [ ] API docs published (Swagger/Redoc)
- [ ] Integration guide written
- [ ] Example code provided
- [ ] Runbook created

**Deliverables**:
1. API documentation (Swagger UI)
2. Integration guide (Markdown)
3. Code examples (Postman collection)
4. Operations runbook

**Allowed Agents**: documentation-expert, backend-api-expert

**Quality Gates**:
- Must-Meet: API docs complete
- Should-Meet: Documentation clarity (score ≥90)
- Approval: Automatic

#### Stage 6: Deployment (1-2 days)

**Entry Criteria**:
- [ ] Testing and docs complete
- [ ] Deployment checklist ready

**Exit Criteria**:
- [ ] Deployed to production
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] No critical issues for 72 hours

**Deliverables**:
1. Production deployment
2. Monitoring dashboard (error rate, latency, throughput)
3. Alert configuration
4. Deployment post-mortem

**Allowed Agents**: backend-api-expert, performance-expert

**Quality Gates**:
- Must-Meet: Deployment successful, monitoring active
- Should-Meet: Error rate <0.1%
- Approval: Manual (DevOps Lead)

---


### 3.6 Integration Projects Framework

**Project Type**: Integration
**Total Duration**: 1-3 weeks  
**Stages**: 5
**Primary Goal**: Stable, monitored integration with third-party service

#### Stages Summary:
1. **Discovery** (2-3 days) - API research, documentation review, credential setup
2. **API Research** (3-5 days) - Test endpoints, rate limits, error handling patterns
3. **Integration** (5-15 days) - Implement wrapper, retry logic, error handling
4. **Testing** (3-5 days) - E2E tests, edge cases, failure scenarios
5. **Monitoring** (1-2 days) - Health checks, alerts, logging dashboards

**Key Agents**: integration-expert, library-researcher, backend-api-expert, testing-expert

### 3.7 Research/Prototyping Framework

**Project Type**: Research/Prototyping
**Total Duration**: 1-2 weeks
**Stages**: 4
**Primary Goal**: Answer research question with documented recommendation

#### Stages Summary:
1. **Literature Review** (2-3 days) - Research papers, blog posts, existing solutions
2. **Experimentation** (5-10 days) - Hands-on testing, spike implementation
3. **Analysis** (2-3 days) - Evaluate trade-offs, create comparison matrix
4. **Documentation** (1-2 days) - Decision document, recommendations, code archiving

**Key Agents**: library-researcher, codebase-analyst, architect, documentation-expert

### 3.8 AI/ML Development Framework

**Project Type**: AI/ML Development
**Total Duration**: 3-12 weeks
**Stages**: 7
**Primary Goal**: Deployed ML model with monitoring and retraining pipeline

#### Stages Summary:
1. **Problem Definition** (3-5 days) - Use case, metrics, data availability
2. **Data Preparation** (1-2 weeks) - Collection, cleaning, labeling, EDA
3. **Model Development** (2-4 weeks) - Algorithm selection, training, tuning
4. **Evaluation** (5-10 days) - Performance testing, bias audit, interpretability
5. **Deployment (MLOps)** (1-2 weeks) - Model serving, API wrapper, versioning
6. **Monitoring** (Ongoing) - Drift detection, performance degradation alerts
7. **Iteration** (Ongoing) - Retraining triggers, model updates

**Key Agents**: llms-expert, computer-vision-expert, backend-api-expert, database-expert, performance-expert

### 3.9 Full-Stack Product Framework

**Project Type**: Full-Stack Product
**Total Duration**: 4-16 weeks
**Stages**: 7
**Primary Goal**: Complete product from frontend to deployment

#### Stages Summary:
1. **Discovery** (1-2 weeks) - Requirements, user research, business case
2. **Architecture** (1-2 weeks) - System design, tech stack selection, infrastructure
3. **Frontend Development** (2-6 weeks) - UI components, pages, state management
4. **Backend Development** (2-6 weeks) - APIs, business logic, database (parallel)
5. **Integration** (1-2 weeks) - Connect frontend to backend, E2E flows
6. **Testing** (1-2 weeks) - E2E tests, performance, security audit
7. **Deployment** (3-5 days) - Production release, monitoring, documentation

**Key Agents**: ALL agents, orchestrated by planner + project-manager-agent

---

## 4. Agent Assignment Matrix

### 4.1 Matrix Overview

The Agent Assignment Matrix defines which of the 14 specialized agents are **allowed**, **recommended**, or **restricted** for each stage of each project type. This ensures agents only work on tasks aligned with their expertise and the project phase.

**Matrix Legend**:
- ✅ **Allowed & Recommended**: Agent is optimal for this stage
- ⚠️ **Allowed but Limited**: Agent can contribute but not primary focus
- ❌ **Restricted**: Agent should NOT be assigned to this stage

### 4.2 Innovation/Concept Development - Agent Matrix

| Stage | Allowed Agents | Restricted Agents | Rationale |
|-------|----------------|-------------------|-----------|
| **Ideation** | ✅ planner, architect, llms-expert, codebase-analyst | ❌ ui-implementation-expert, backend-api-expert, testing-expert, documentation-expert | Too early for implementation; focus on ideation |
| **Research** | ✅ library-researcher, codebase-analyst, llms-expert, architect | ❌ ui-implementation-expert, backend-api-expert, database-expert | Research phase, not implementation |
| **Prototype** | ✅ ui-implementation-expert, backend-api-expert, database-expert, integration-expert, llms-expert | ⚠️ testing-expert | Rapid prototyping; basic tests only |
| **Validation** | ✅ testing-expert, ux-ui-researcher, performance-expert | ❌ Implementation experts | Validation phase, no new features |
| **Decision Point** | ✅ planner, documentation-expert | ❌ All implementation experts | Decision-making only |

### 4.3 Traditional Development - Agent Matrix

| Stage | Allowed Agents | Restricted Agents | Rationale |
|-------|----------------|-------------------|-----------|
| **Planning** | ✅ planner, architect, codebase-analyst | ❌ testing-expert, performance-expert | Planning requires strategy, not testing |
| **Design** | ✅ architect, backend-api-expert, database-expert, ui-implementation-expert | ❌ testing-expert | Design before test |
| **Implementation** | ✅ ALL implementation experts (ui, backend, database, integration) | ❌ None (all can contribute) | Core development phase |
| **Testing** | ✅ testing-expert, performance-expert | ⚠️ Implementation experts (fixes only) | Testing phase, minimal new code |
| **Deployment** | ✅ backend-api-expert, performance-expert, documentation-expert | ❌ ui-implementation-expert, database-expert | Deployment focus, not feature work |

### 4.4 UI/UX Design - Agent Matrix

| Stage | Allowed Agents | Restricted Agents | Rationale |
|-------|----------------|-------------------|-----------|
| **Research & Discovery** | ✅ ux-ui-researcher | ❌ ALL implementation experts | Pure research phase |
| **Information Architecture** | ✅ ux-ui-researcher, architect | ❌ Implementation experts | IA design, not coding |
| **Wireframing** | ✅ ui-implementation-expert, ux-ui-researcher | ❌ backend-api-expert, database-expert | Frontend focus |
| **Design** | ✅ ui-implementation-expert, ux-ui-researcher | ❌ backend-api-expert, database-expert | Visual design, not backend |
| **Prototyping** | ✅ ui-implementation-expert | ❌ backend-api-expert, database-expert | Frontend prototype |
| **User Testing** | ✅ ux-ui-researcher, testing-expert | ❌ ALL implementation experts | Testing phase |
| **Handoff** | ✅ documentation-expert, ui-implementation-expert | ❌ None | Documentation handoff |

### 4.5 API/Backend Development - Agent Matrix

| Stage | Allowed Agents | Restricted Agents | Rationale |
|-------|----------------|-------------------|-----------|
| **API Design** | ✅ architect, backend-api-expert | ❌ ui-implementation-expert, ux-ui-researcher | Backend focus |
| **Schema Design** | ✅ database-expert, backend-api-expert | ❌ ui-implementation-expert, ux-ui-researcher | Database focus |
| **Implementation** | ✅ backend-api-expert, database-expert | ❌ ui-implementation-expert, ux-ui-researcher | Backend implementation |
| **Testing & Security** | ✅ testing-expert, backend-api-expert | ❌ ui-implementation-expert | Backend testing |
| **Documentation** | ✅ documentation-expert, backend-api-expert | ❌ ui-implementation-expert | API docs |
| **Deployment** | ✅ backend-api-expert, performance-expert | ❌ ui-implementation-expert | Backend deployment |

### 4.6 Integration Projects - Agent Matrix

| Stage | Allowed Agents | Restricted Agents | Rationale |
|-------|----------------|-------------------|-----------|
| **Discovery** | ✅ integration-expert, library-researcher | ❌ ui-implementation-expert, testing-expert | Research third-party APIs |
| **API Research** | ✅ library-researcher, integration-expert | ❌ ALL implementation experts | API exploration |
| **Integration** | ✅ integration-expert, backend-api-expert | ❌ ui-implementation-expert, database-expert | Integration code |
| **Testing** | ✅ testing-expert, integration-expert | ❌ ui-implementation-expert | Integration testing |
| **Monitoring** | ✅ performance-expert, integration-expert | ❌ ui-implementation-expert | Monitoring setup |

### 4.7 Research/Prototyping - Agent Matrix

| Stage | Allowed Agents | Restricted Agents | Rationale |
|-------|----------------|-------------------|-----------|
| **Literature Review** | ✅ library-researcher, codebase-analyst | ❌ ALL implementation experts | Research phase |
| **Experimentation** | ✅ library-researcher, planner, architect | ⚠️ Implementation experts (light coding) | Exploratory work |
| **Analysis** | ✅ architect, planner | ❌ testing-expert, performance-expert | Analysis, not testing |
| **Documentation** | ✅ documentation-expert | ❌ ALL implementation experts | Documentation phase |

### 4.8 AI/ML Development - Agent Matrix

| Stage | Allowed Agents | Restricted Agents | Rationale |
|-------|----------------|-------------------|-----------|
| **Problem Definition** | ✅ llms-expert, planner, architect | ❌ ui-implementation-expert, database-expert | ML strategy |
| **Data Preparation** | ✅ llms-expert, database-expert | ❌ ui-implementation-expert, testing-expert | Data work |
| **Model Development** | ✅ llms-expert, computer-vision-expert | ❌ ui-implementation-expert, backend-api-expert | Model training |
| **Evaluation** | ✅ testing-expert, llms-expert | ❌ ui-implementation-expert | Model validation |
| **Deployment** | ✅ backend-api-expert, llms-expert, performance-expert | ❌ ui-implementation-expert | MLOps deployment |
| **Monitoring** | ✅ performance-expert, llms-expert | ❌ ui-implementation-expert | Model monitoring |

### 4.9 Full-Stack Product - Agent Matrix

| Stage | Allowed Agents | Restricted Agents | Rationale |
|-------|----------------|-------------------|-----------|
| **Discovery** | ✅ planner, ux-ui-researcher, architect | ❌ testing-expert, performance-expert | Discovery phase |
| **Architecture** | ✅ architect, ALL experts (consultation) | ❌ None | System design |
| **Frontend Dev** | ✅ ui-implementation-expert, ux-ui-researcher | ❌ database-expert | Frontend focus |
| **Backend Dev** | ✅ backend-api-expert, database-expert, integration-expert | ❌ ux-ui-researcher | Backend focus (parallel) |
| **Integration** | ✅ integration-expert, ui-implementation-expert, backend-api-expert | ❌ None | Connect layers |
| **Testing** | ✅ testing-expert, performance-expert | ⚠️ Implementation experts (fixes only) | QA phase |
| **Deployment** | ✅ backend-api-expert, performance-expert, documentation-expert | ❌ ux-ui-researcher | Deployment |

### 4.10 Agent Capabilities Reference

Complete reference for all 14 agents organized by tier.

#### Tier 1: Orchestrator

**planner**
- **Capabilities**: Complex task breakdown (>2hr projects), agent assignment, dependency management, resource allocation
- **Typical Duration**: 1-2 hours per planning session
- **LLM Access**: Claude Code direct, GPT-4 for planning
- **Allowed in ALL Stages**: Yes (entry point for complex projects)
- **Typical Tasks**: Project decomposition, approach selection, coordination

#### Tier 2: Architecture & Strategy

**architect**
- **Capabilities**: System design, tech stack decisions, API design, infrastructure planning, scalability analysis
- **Typical Duration**: 2-4 hours per design session
- **LLM Access**: Claude Code, architectural pattern databases
- **Restricted Stages**: Early ideation (before approach selected)
- **Typical Tasks**: Create architecture diagrams, design APIs, select technologies

**llms-expert**
- **Capabilities**: AI/ML integration, prompt engineering, RAG systems, LLM workflows, embeddings, fine-tuning
- **Typical Duration**: 2-3 hours per task
- **LLM Access**: Claude Code, OpenAI API, local models (Ollama)
- **Restricted Stages**: Non-AI projects (unless AI feature added)
- **Typical Tasks**: Build semantic search, implement chatbots, create RAG pipelines

**computer-vision-expert**
- **Capabilities**: Image/video processing, object detection, classification, OCR, CV model integration
- **Typical Duration**: 3-4 hours per task
- **LLM Access**: Claude Code, Hugging Face models, OpenCV
- **Restricted Stages**: Non-CV projects
- **Typical Tasks**: Implement image classification, video analysis, OCR systems

#### Tier 3: Specialist Researchers

**codebase-analyst**
- **Capabilities**: Pattern discovery, coding conventions, codebase structure analysis, refactoring opportunities
- **Typical Duration**: 1-2 hours per analysis
- **LLM Access**: Claude Code, AST parsers
- **Restricted Stages**: None (can analyze at any stage)
- **Typical Tasks**: Find existing patterns, identify conventions, suggest refactors

**library-researcher**
- **Capabilities**: External library research, documentation fetching, API analysis, integration patterns
- **Typical Duration**: 1-2 hours per library
- **LLM Access**: Claude Code, WebSearch, documentation scraping
- **Restricted Stages**: None (research always valuable)
- **Typical Tasks**: Research npm packages, compare libraries, find code examples

**ux-ui-researcher**
- **Capabilities**: UX patterns, accessibility (WCAG 2.1), design systems, usability testing, user research
- **Typical Duration**: 1-2 hours per research task
- **LLM Access**: Claude Code, design pattern databases
- **Restricted Stages**: Backend-only projects
- **Typical Tasks**: Conduct user testing, accessibility audits, design research

#### Tier 4: Implementation Experts

**ui-implementation-expert**
- **Capabilities**: React/Vue/Svelte components, design systems, responsive design, state management, animations
- **Typical Duration**: 2-4 hours per component/page
- **LLM Access**: Claude Code, Storybook
- **Restricted Stages**: Backend-only projects, early research phases
- **Typical Tasks**: Build components, implement pages, create design systems

**backend-api-expert**
- **Capabilities**: REST/GraphQL/tRPC APIs, business logic, authentication, validation, error handling
- **Typical Duration**: 2-4 hours per endpoint/feature
- **LLM Access**: Claude Code, API testing tools
- **Restricted Stages**: Frontend-only projects, UI research phases
- **Typical Tasks**: Create API endpoints, implement business logic, add authentication

**database-expert**
- **Capabilities**: Schema design, migrations, query optimization, indexing, data integrity, ORMs
- **Typical Duration**: 2-3 hours per schema/migration
- **LLM Access**: Claude Code, query analyzers
- **Restricted Stages**: Frontend-only projects, early ideation
- **Typical Tasks**: Design schemas, write migrations, optimize queries

**integration-expert**
- **Capabilities**: Third-party APIs, webhooks, OAuth flows, retry logic, service-to-service communication
- **Typical Duration**: 2-4 hours per integration
- **LLM Access**: Claude Code, Postman/API testing
- **Restricted Stages**: Non-integration projects (unless integration added)
- **Typical Tasks**: Integrate Stripe, connect APIs, implement webhooks

#### Tier 5: Quality & Documentation

**testing-expert**
- **Capabilities**: Test strategy, unit/integration/e2e tests, coverage analysis, test automation, QA
- **Typical Duration**: 2-3 hours per test suite
- **LLM Access**: Claude Code, test runners (Jest, Pytest, Playwright)
- **Restricted Stages**: Early ideation, research phases
- **Typical Tasks**: Write test suites, create test strategies, analyze coverage

**performance-expert**
- **Capabilities**: Profiling, optimization, benchmarking, resource efficiency, load testing
- **Typical Duration**: 1.5-3 hours per optimization task
- **LLM Access**: Claude Code, profilers (Lighthouse, k6)
- **Restricted Stages**: Early prototypes (premature optimization)
- **Typical Tasks**: Profile performance, optimize queries, load testing

**documentation-expert**
- **Capabilities**: Technical docs, API references, architecture diagrams, developer guides, runbooks
- **Typical Duration**: 1-2 hours per doc section
- **LLM Access**: Claude Code, Markdown, diagram tools
- **Restricted Stages**: None (docs always valuable)
- **Typical Tasks**: Write API docs, create diagrams, build runbooks

### 4.11 Agent Collaboration Patterns

**Pattern 1: Sequential Handoff**
```
Research Agent → completes library research
    ↓
Hands off to Implementation Agent
    ↓
Implementation Agent → uses research findings to build feature
```

**Pattern 2: Parallel Execution**
```
Frontend Implementation Expert ─┐
                                ├─→ Integration Expert (combines outputs)
Backend Implementation Expert ──┘
```

**Pattern 3: Iterative Refinement**
```
Implementation Agent → creates initial version
    ↓
Testing Agent → identifies issues
    ↓
Implementation Agent → fixes issues (repeat until quality gates pass)
```

**Pattern 4: Hierarchical Decomposition**
```
Planner → breaks down project
    ↓
Architect → designs system components
    ↓
Implementation Experts → build components in parallel
    ↓
Integration Expert → combines components
    ↓
Testing Expert → validates complete system
```

---


## 5. Multi-Agent Workflow Architecture

### 5.1 Complete System Flow

This section documents the complete end-to-end flow from user request to project completion, showing how all components interact.

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER REQUEST (Entry Point)                    │
│        Natural language: "Build dark mode toggle for dashboard"  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COORDINATOR AGENT                             │
│              (Intent Understanding & Classification)             │
├─────────────────────────────────────────────────────────────────┤
│ 1. Parse request using LLM (GPT-4o)                             │
│ 2. Extract intent: {                                            │
│      action: "create_project",                                  │
│      project_type: "ui_ux",                                     │
│      deliverable: "dark mode toggle",                           │
│      scope: ["dashboard", "all pages"],                         │
│      requirements: ["persist preference", "global app"]         │
│    }                                                            │
│ 3. Validate feasibility (resources, time, expertise)           │
│ 4. Ask clarifying questions if ambiguous                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 PROJECT MANAGER AGENT                            │
│           (Project Creation & Task Orchestration)                │
├─────────────────────────────────────────────────────────────────┤
│ 1. Create project with project_id (crash recovery support)      │
│ 2. Select framework: UI_UX_FRAMEWORK (7 stages)                 │
│ 3. Create stage records for project                             │
│ 4. Decompose first stage into tasks:                            │
│    Stage 1: Research & Discovery                                │
│      ├─ Task: Analyze dark mode patterns (ux-ui-researcher,1.5hr)│
│      ├─ Task: Research WCAG requirements (ux-ui-researcher, 1hr) │
│      └─ Quality Gate: Research completeness >80%                │
│ 5. Assign agents using capability matrix + LLM                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
        ┌─────────────────┐  ┌─────────────────┐
        │ ux-ui-researcher│  │ ux-ui-researcher│
        │    (Task 1)      │  │    (Task 2)      │
        └────────┬─────────┘  └────────┬─────────┘
                 │                     │
                 ▼                     ▼
        Execute via Claude Code  Execute via Claude Code
                 │                     │
                 ▼                     ▼
        Update task: "done"      Update task: "done"
                 │                     │
                 └──────────┬──────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     QUALITY GATE EVALUATION                      │
│              (Automated + Human Verification)                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Check Must-Meet Criteria: Research questions answered? ✓      │
│ 2. Calculate Should-Meet Score: 85/100                          │
│ 3. Decision: Score ≥70 → PASSED                                 │
│ 4. If manual approval required: Notify stakeholder              │
│ 5. If passed: Transition to next stage                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STAGE TRANSITION                               │
│         (Move from Research to Wireframing)                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. Mark current stage: "completed"                              │
│ 2. Create tasks for next stage (Wireframing):                   │
│    ├─ Task: Create lo-fi wireframes (ui-implementation-expert)   │
│    ├─ Task: Design component tree (architect)                   │
│    └─ Quality Gate: Stakeholder approval (manual)               │
│ 3. Activate next stage: "active"                                │
│ 4. Notify assigned agents                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                  [Repeat for all 7 stages]
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PROJECT COMPLETION                             │
│           (All stages complete, deliverable ready)               │
├─────────────────────────────────────────────────────────────────┤
│ 1. Mark project: "completed"                                    │
│ 2. Generate completion report                                   │
│ 3. Archive project artifacts                                    │
│ 4. Notify stakeholders                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Coordinator Agent - Deep Dive

**Role**: First point of contact, responsible for understanding user intent and routing to appropriate project type.

**Input**: Natural language user request
**Output**: Structured ProjectRequest object

**Algorithm**:
```python
class CoordinatorAgent:
    """Entry point agent that processes all user requests"""
    
    async def process_request(self, user_request: str) -> ProjectRequest:
        """Main processing pipeline"""
        
        # Step 1: Parse request using LLM
        intent = await self.parse_intent(user_request)
        
        # Step 2: Classify project type (1 of 8)
        project_type = await self.classify_project_type(intent)
        
        # Step 3: Extract requirements
        requirements = await self.extract_requirements(intent)
        
        # Step 4: Validate feasibility
        if not await self.validate_feasibility(requirements):
            # Ask clarifying questions
            questions = await self.generate_questions(requirements)
            return QuestionRequest(questions=questions)
        
        # Step 5: Create structured request
        return ProjectRequest(
            action="create_project",
            project_type=project_type,
            title=intent.title,
            description=intent.description,
            requirements=requirements,
            constraints=intent.constraints
        )
    
    async def parse_intent(self, user_request: str) -> Intent:
        """Use LLM to extract structured intent"""
        prompt = f"""
        Parse this user request and extract structured intent:
        
        User Request: "{user_request}"
        
        Extract:
        - Action (create, modify, query, delete)
        - Title (concise project title)
        - Description (detailed explanation)
        - Deliverable (what user wants built)
        - Scope (where it applies)
        - Requirements (functional requirements)
        - Constraints (accessibility, performance, etc.)
        
        Return JSON.
        """
        
        response = await gpt4o.complete(prompt, response_format="json")
        return Intent.parse(response)
    
    async def classify_project_type(self, intent: Intent) -> ProjectType:
        """Classify into 1 of 8 project types using few-shot learning"""
        
        # Few-shot examples
        examples = [
            {
                "request": "Build a dark mode toggle",
                "type": "ui_ux",
                "reasoning": "Focuses on UI component and user experience"
            },
            {
                "request": "Create REST API for user authentication",
                "type": "api_backend",
                "reasoning": "Backend API development"
            },
            {
                "request": "Test if we can use WebAssembly for performance",
                "type": "research",
                "reasoning": "Exploratory, proof-of-concept"
            },
            # ... more examples for all 8 types
        ]
        
        prompt = f"""
        Classify this project into exactly ONE of these types:
        1. innovation (exploratory, proof-of-concept)
        2. traditional_dev (standard feature development)
        3. ui_ux (interface design and UX)
        4. api_backend (backend APIs and logic)
        5. integration (third-party service connections)
        6. research (technology investigation)
        7. ai_ml (machine learning, AI features)
        8. fullstack_product (complete product)
        
        Intent: {intent.dict()}
        
        Examples:
        {examples}
        
        Return: {{"type": "...", "confidence": 0.95, "reasoning": "..."}}
        """
        
        response = await gpt4o.complete(prompt, response_format="json")
        return ProjectType.parse(response["type"])
```

**Example Interactions**:

```python
# Example 1: Clear request
user_request = "Build a dark mode toggle for the dashboard"
result = await coordinator.process_request(user_request)
# → ProjectRequest(
#     action="create_project",
#     project_type="ui_ux",
#     title="Dark Mode Toggle for Dashboard",
#     ...
#   )

# Example 2: Ambiguous request (requires clarification)
user_request = "Add authentication"
result = await coordinator.process_request(user_request)
# → QuestionRequest(questions=[
#     "What type of authentication? (OAuth, JWT, session-based)",
#     "Should this include user registration?",
#     "Do you need password reset functionality?"
#   ])

# Example 3: Multi-part request
user_request = "Build a complete user management system with dashboard, API, and admin panel"
result = await coordinator.process_request(user_request)
# → ProjectRequest(
#     action="create_project",
#     project_type="fullstack_product",  # Detected as full-stack
#     ...
#   )
```

### 5.3 Project Manager Agent - Deep Dive

**Role**: Orchestrates project execution from creation through completion.

**Responsibilities**:
1. Create project record with crash recovery support
2. Select appropriate stage framework
3. Create stage records
4. Decompose stages into tasks
5. Assign agents to tasks
6. Manage stage transitions
7. Track progress

**Core Algorithm**:
```python
class ProjectManagerAgent:
    """Orchestrates complete project lifecycle"""
    
    async def create_project_from_request(
        self, 
        request: ProjectRequest
    ) -> Project:
        """Create project and initial tasks"""
        
        # Step 1: Create project record
        project = await self.create_project(
            title=request.title,
            description=request.description,
            project_type=request.project_type
        )
        
        # Step 2: Select framework
        framework = self.select_framework(request.project_type)
        
        # Step 3: Create stages
        stages = await self.create_stages(project.id, framework)
        
        # Step 4: Create tasks for first stage
        first_stage = stages[0]
        tasks = await self.decompose_stage(
            stage=first_stage,
            requirements=request.requirements
        )
        
        # Step 5: Assign agents
        for task in tasks:
            agent = await self.assign_agent(task, first_stage)
            await self.update_task(task.id, assignee=agent)
        
        return project
    
    async def decompose_stage(
        self,
        stage: Stage,
        requirements: List[str]
    ) -> List[Task]:
        """Break down stage into tasks (0.5-4hr each)"""
        
        # Use planner agent for complex decomposition
        prompt = f"""
        Decompose this project stage into tasks:
        
        Stage: {stage.name}
        Project Type: {stage.project.type}
        Requirements: {requirements}
        
        Rules:
        - Each task: 0.5 to 4 hours
        - Clear deliverables
        - Logical dependencies
        - Assign to appropriate agent
        
        Return JSON array of tasks.
        """
        
        response = await gpt4o.complete(prompt, response_format="json")
        
        tasks = []
        for task_data in response["tasks"]:
            task = await self.create_task(
                project_id=stage.project_id,
                stage_id=stage.id,
                title=task_data["title"],
                description=task_data["description"],
                estimated_hours=task_data["estimated_hours"],
                dependencies=task_data.get("dependencies", [])
            )
            tasks.append(task)
        
        return tasks
    
    async def assign_agent(
        self,
        task: Task,
        stage: Stage
    ) -> str:
        """Assign appropriate agent using capability matrix + LLM"""
        
        # Step 1: Get stage-allowed agents
        allowed_agents = self.get_allowed_agents(
            project_type=stage.project.type,
            stage_name=stage.name
        )
        
        # Step 2: Use LLM to select best agent
        prompt = f"""
        Assign the best agent for this task:
        
        Task: {task.title}
        Description: {task.description}
        Stage: {stage.name}
        Allowed Agents: {allowed_agents}
        
        Agent capabilities: {self.AGENT_CAPABILITIES}
        
        Return: {{"agent": "agent-name", "rationale": "why this agent?"}}
        """
        
        response = await gpt4o.complete(prompt, response_format="json")
        return response["agent"]
    
    async def evaluate_stage_transition(
        self,
        project_id: str,
        current_stage: Stage
    ) -> TransitionResult:
        """Check if stage can transition to next"""
        
        # Step 1: Check all tasks complete
        tasks = await self.get_tasks(stage_id=current_stage.id)
        if not all(task.status == "done" for task in tasks):
            return TransitionResult(
                can_transition=False,
                reason="Not all tasks complete"
            )
        
        # Step 2: Evaluate quality gate
        gate_result = await self.evaluate_quality_gate(current_stage)
        if not gate_result.passed:
            return TransitionResult(
                can_transition=False,
                reason=f"Quality gate failed: {gate_result.failures}"
            )
        
        # Step 3: Check approval requirements
        if gate_result.requires_approval:
            if not gate_result.approved:
                return TransitionResult(
                    can_transition=False,
                    reason="Awaiting manual approval"
                )
        
        # All checks passed
        return TransitionResult(
            can_transition=True,
            next_stage=self.get_next_stage(current_stage)
        )
```

### 5.4 Specialized Agent Execution

**How Agents Execute Tasks**:

All specialized agents follow this pattern:
1. Receive task assignment from Project Manager
2. Retrieve task context (project info, dependencies, requirements)
3. Search knowledge base for similar patterns
4. Execute work via LLM (Claude Code/API)
5. Update task status and output
6. Calculate quality score

**Example: ui-implementation-expert executing task**

```python
class UIImplementationExpert(SpecializedAgent):
    """Expert in frontend UI component implementation"""
    
    name = "ui-implementation-expert"
    tier = 4  # Implementation Expert
    
    async def execute_task(self, task: Task) -> TaskResult:
        """Execute UI implementation task"""
        
        # Step 1: Get context
        project = await self.get_project(task.project_id)
        stage = await self.get_stage(task.stage_id)
        dependencies = await self.get_task_dependencies(task)
        
        # Step 2: Search knowledge base
        examples = await search_archon_knowledge_base(
            query=f"React {task.feature} component implementation",
            project_type=project.type,
            match_count=3
        )
        
        # Step 3: Build context for LLM
        context = {
            "task": task.dict(),
            "project": project.dict(),
            "stage": stage.name,
            "dependencies": [d.output for d in dependencies],
            "examples": examples,
            "design_system_tokens": await self.get_design_tokens(project),
            "constraints": [
                "Must be accessible (WCAG 2.1 AA)",
                "Must use design system",
                "Must include unit tests"
            ]
        }
        
        # Step 4: Execute via Claude Code
        result = await claude_code.execute(
            prompt=self.build_prompt(task, context),
            tools=["Read", "Write", "Edit", "Bash"],
            context=context
        )
        
        # Step 5: Run quality checks
        quality_score = await self.calculate_quality_score(result)
        
        # Step 6: Update task
        await self.update_task(
            task_id=task.id,
            status="done" if quality_score >= 70 else "review",
            output=result,
            quality_score=quality_score,
            notes=f"Implemented via Claude Code. Quality: {quality_score}/100"
        )
        
        return TaskResult(
            success=True,
            output=result,
            quality_score=quality_score
        )
    
    def build_prompt(self, task: Task, context: dict) -> str:
        """Build detailed prompt for LLM"""
        return f"""
        You are a senior frontend engineer implementing a React component.
        
        Task: {task.title}
        Description: {task.description}
        
        Project Context:
        - Type: {context['project']['type']}
        - Current Stage: {context['stage']}
        - Tech Stack: React 18, TypeScript, Tailwind CSS
        
        Requirements:
        {chr(10).join(f"- {req}" for req in task.requirements)}
        
        Constraints:
        {chr(10).join(f"- {con}" for con in context['constraints'])}
        
        Design System Tokens:
        {context['design_system_tokens']}
        
        Similar Examples:
        {chr(10).join(f"Example {i+1}: {ex.summary}" for i, ex in enumerate(context['examples']))}
        
        Dependencies (use these outputs):
        {chr(10).join(f"- {dep.title}: {dep.summary}" for dep in context['dependencies'])}
        
        Implementation Guidelines:
        1. Create component in src/components/
        2. Use TypeScript with proper types
        3. Follow design system tokens
        4. Ensure WCAG 2.1 AA compliance
        5. Include unit tests with React Testing Library
        6. Add Storybook story
        
        Deliver:
        - Component implementation (TypeScript)
        - Unit tests (>80% coverage)
        - Storybook story
        - Brief implementation notes
        """
    
    async def calculate_quality_score(self, result: dict) -> int:
        """Calculate quality score for implementation"""
        score = 0
        
        # Component exists
        if result.get("component_created"):
            score += 30
        
        # Tests exist and pass
        if result.get("tests_passing"):
            score += 30
        
        # Coverage adequate
        if result.get("coverage", 0) >= 80:
            score += 20
        
        # Accessibility compliance
        if result.get("wcag_compliant"):
            score += 10
        
        # Design system usage
        if result.get("design_system_used"):
            score += 10
        
        return score
```

### 5.5 Human-in-the-Loop Workflow

**When Humans Get Involved**:

1. **Quality Gate Failures** - Automated checks fail, human review needed
2. **Manual Approval Gates** - Critical stage transitions (e.g., Wireframes → Design)
3. **Agent Escalation** - Agent encounters blocker or high uncertainty
4. **Security/Legal** - Authentication changes, data handling, compliance

**Escalation Flow**:

```python
class HumanEscalationWorkflow:
    """Manages human-in-the-loop escalations"""
    
    async def escalate_task(
        self,
        task: Task,
        reason: EscalationReason,
        details: str
    ) -> EscalationResult:
        """Escalate task to human expert"""
        
        # Step 1: Identify appropriate human expert
        expert = await self.assign_human_expert(task, reason)
        
        # Step 2: Create escalation record
        escalation = await self.create_escalation(
            task_id=task.id,
            reason=reason,
            details=details,
            assigned_to=expert,
            created_at=datetime.utcnow()
        )
        
        # Step 3: Notify expert
        await self.notify_expert(
            expert=expert,
            escalation=escalation,
            notification_type="email",  # or Slack, SMS
            priority=reason.priority
        )
        
        # Step 4: Update task status
        await self.update_task(
            task_id=task.id,
            status="escalated",
            escalated_to_human=True,
            human_assigned=expert
        )
        
        # Step 5: Wait for human response
        # (Human reviews via dashboard, provides feedback)
        
        return EscalationResult(
            escalation_id=escalation.id,
            assigned_to=expert,
            status="awaiting_review"
        )
    
    async def assign_human_expert(
        self,
        task: Task,
        reason: EscalationReason
    ) -> str:
        """Assign appropriate human based on task domain"""
        
        # Domain-based assignment
        domain_experts = {
            "ui_ux": "senior_frontend_engineer",
            "backend": "senior_backend_engineer",
            "database": "database_administrator",
            "security": "security_engineer",
            "performance": "performance_engineer"
        }
        
        # Get task domain
        domain = self.detect_domain(task)
        
        return domain_experts.get(domain, "tech_lead")
    
    async def process_human_response(
        self,
        escalation_id: str,
        response: HumanResponse
    ) -> None:
        """Process human expert's response"""
        
        escalation = await self.get_escalation(escalation_id)
        task = await self.get_task(escalation.task_id)
        
        if response.action == "approve":
            # Human approves, continue
            await self.update_task(
                task_id=task.id,
                status="done",
                escalated_to_human=False,
                human_feedback=response.feedback
            )
        
        elif response.action == "request_changes":
            # Human requests changes, re-assign to agent
            await self.create_task(
                project_id=task.project_id,
                title=f"Address feedback: {task.title}",
                description=response.feedback,
                assignee=task.assignee,  # Same agent
                estimated_hours=1.5,
                dependencies=[task.id]
            )
        
        elif response.action == "take_over":
            # Human takes over task
            await self.update_task(
                task_id=task.id,
                status="in_progress",
                assignee="human",
                human_assigned=response.human_assignee
            )
```

**Human Dashboard UI** (simplified):

```
┌─────────────────────────────────────────────────────────────────┐
│                 ESCALATION REVIEW DASHBOARD                      │
├─────────────────────────────────────────────────────────────────┤
│ Task: Implement dark mode toggle component                      │
│ Agent: ui-implementation-expert                                  │
│ Escalation Reason: Quality score below threshold (65/100)       │
│                                                                  │
│ Agent's Work:                                                    │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ [View Code] [View Tests] [View Output]                      ││
│ │                                                              ││
│ │ Quality Issues Detected:                                     ││
│ │ - Test coverage: 65% (target: 80%)                          ││
│ │ - Accessibility: Some ARIA attributes missing               ││
│ │ - Design system: 2 components don't use design tokens       ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│ Your Actions:                                                    │
│ [ Approve anyway ]  [ Request changes ]  [ Take over task ]     │
│                                                                  │
│ Feedback (if requesting changes):                                │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Please add missing ARIA labels to toggle button and...      ││
│ │                                                              ││
│ └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---


## 6. Integration with Existing Archon System

### 6.1 Database Schema Extensions

**New Tables Required**:

```sql
-- Table 1: Project Type Classification
CREATE TABLE archon_project_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES archon_projects(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'innovation', 'traditional_dev', 'ui_ux', 'api_backend',
        'integration', 'research', 'ai_ml', 'fullstack_product'
    )),
    framework_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id)
);

-- Table 2: Project Stages
CREATE TABLE archon_project_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES archon_projects(id) ON DELETE CASCADE,
    stage_name VARCHAR(100) NOT NULL,
    stage_order INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'skipped')),
    entry_criteria_met JSONB,
    exit_criteria_met JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: Quality Gates
CREATE TABLE archon_quality_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES archon_project_stages(id) ON DELETE CASCADE,
    gate_type VARCHAR(50) NOT NULL CHECK (gate_type IN ('binary', 'scored', 'manual_approval')),
    criteria JSONB NOT NULL,
    result JSONB,
    passed BOOLEAN,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    approval_required BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(100),
    approved_at TIMESTAMPTZ,
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 4: Stage Transitions
CREATE TABLE archon_stage_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES archon_projects(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES archon_project_stages(id),
    to_stage_id UUID REFERENCES archon_project_stages(id),
    transition_type VARCHAR(50) CHECK (transition_type IN ('automatic', 'manual', 'rollback')),
    triggered_by VARCHAR(100),
    quality_gate_results JSONB,
    transition_notes TEXT,
    transitioned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced archon_tasks table
ALTER TABLE archon_tasks ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES archon_project_stages(id);
ALTER TABLE archon_tasks ADD COLUMN IF NOT EXISTS quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100);
ALTER TABLE archon_tasks ADD COLUMN IF NOT EXISTS escalated_to_human BOOLEAN DEFAULT FALSE;
ALTER TABLE archon_tasks ADD COLUMN IF NOT EXISTS human_assigned VARCHAR(100);
ALTER TABLE archon_tasks ADD COLUMN IF NOT EXISTS created_by_agent VARCHAR(100);
```

### 6.2 API Endpoints (New)

**Project Type Management**:
```python
# POST /api/v1/projects/{project_id}/classify
@router.post("/projects/{project_id}/classify")
async def classify_project(
    project_id: str,
    classification: ProjectTypeClassification
):
    """Classify project and create stage framework"""
    pass

# GET /api/v1/projects/{project_id}/type
@router.get("/projects/{project_id}/type")
async def get_project_type(project_id: str):
    """Get project type and framework info"""
    pass
```

**Stage Management**:
```python
# GET /api/v1/projects/{project_id}/stages
@router.get("/projects/{project_id}/stages")
async def get_project_stages(project_id: str):
    """Get all stages for project"""
    pass

# POST /api/v1/projects/{project_id}/stages/transition
@router.post("/projects/{project_id}/stages/transition")
async def transition_stage(
    project_id: str,
    transition: StageTransition
):
    """Transition project to next stage"""
    pass

# GET /api/v1/stages/{stage_id}/tasks
@router.get("/stages/{stage_id}/tasks")
async def get_stage_tasks(stage_id: str):
    """Get all tasks for a stage"""
    pass
```

**Quality Gates**:
```python
# POST /api/v1/stages/{stage_id}/quality-gate
@router.post("/stages/{stage_id}/quality-gate")
async def evaluate_quality_gate(
    stage_id: str,
    criteria: QualityGateCriteria
):
    """Evaluate quality gate for stage"""
    pass

# GET /api/v1/stages/{stage_id}/quality-gate
@router.get("/stages/{stage_id}/quality-gate")
async def get_quality_gate_status(stage_id: str):
    """Get current quality gate status"""
    pass
```

**Agent Assignment**:
```python
# POST /api/v1/tasks/{task_id}/assign-agent
@router.post("/tasks/{task_id}/assign-agent")
async def assign_agent_to_task(
    task_id: str,
    assignment_request: AgentAssignmentRequest
):
    """Assign optimal agent using LLM"""
    pass
```

### 6.3 MCP Tools Integration

```python
# New MCP tools for stage-based projects

@mcp.tool()
async def create_staged_project(
    title: str,
    description: str,
    project_type: Literal["innovation", "traditional_dev", "ui_ux", 
                          "api_backend", "integration", "research", 
                          "ai_ml", "fullstack_product"]
) -> dict:
    """Create new project with stage-based framework"""
    # Implementation...
    pass

@mcp.tool()
async def get_current_stage(project_id: str) -> dict:
    """Get current active stage for project"""
    pass

@mcp.tool()
async def transition_to_next_stage(
    project_id: str,
    quality_gate_override: bool = False
) -> dict:
    """Transition project to next stage with quality gate checks"""
    pass

@mcp.tool()
async def get_stage_tasks(
    project_id: str,
    stage_name: str = None
) -> dict:
    """Get tasks for specific stage or current stage"""
    pass
```

### 6.4 Backward Compatibility

**Migration Strategy for Existing Projects**:

```python
async def migrate_legacy_project_to_stages(project_id: str):
    """Migrate existing project to stage-based system"""
    
    # Step 1: Classify legacy project
    project = await get_project(project_id)
    project_type = await auto_classify_project(project)
    
    # Step 2: Create project type record
    await create_project_type(project_id, project_type)
    
    # Step 3: Infer current stage from task statuses
    tasks = await get_project_tasks(project_id)
    current_stage = infer_stage_from_tasks(tasks, project_type)
    
    # Step 4: Create stage records
    framework = STAGE_FRAMEWORKS[project_type]
    for idx, stage_name in enumerate(framework.stages):
        status = 'completed' if idx < current_stage else ('active' if idx == current_stage else 'pending')
        await create_stage(
            project_id=project_id,
            stage_name=stage_name,
            stage_order=idx,
            status=status
        )
    
    # Step 5: Link tasks to stages
    await link_tasks_to_stages(project_id, framework)
```

---

## 7. Task Lifecycle Documentation

### 7.1 Complete Lifecycle Example: "Build Dark Mode Toggle"

**User Request**: "Build a dark mode toggle for the Archon dashboard. It should persist user preference and apply to all pages."

#### Step 1: User Request → Coordinator Agent

```python
user_request = "Build a dark mode toggle for the Archon dashboard..."

# Coordinator processes request
intent = await coordinator_agent.parse_intent(user_request)
# Result:
# Intent(
#     action="create_project",
#     title="Dark Mode Toggle for Archon Dashboard",
#     deliverable="dark mode toggle component",
#     scope=["dashboard", "all pages"],
#     requirements=["persist user preference", "global application"],
#     constraints=["accessible"]
# )

project_type = await coordinator_agent.classify_project_type(intent)
# Result: "ui_ux" (85% confidence)
```

#### Step 2: Coordinator → Project Manager

```python
project_request = ProjectRequest(
    action="create_project",
    project_type="ui_ux",
    title="Dark Mode Toggle for Archon Dashboard",
    description="Implement persistent dark mode toggle affecting all dashboard pages",
    requirements=["persist user preference", "global application", "accessible"],
    constraints=["WCAG 2.1 AA compliance"]
)

# Project Manager creates project
project = await project_manager_agent.create_project_from_request(project_request)
# Result:
# Project(
#     id="550e8400-e29b-41d4-a716-446655440000",  # CRASH RECOVERY ID
#     title="Dark Mode Toggle for Archon Dashboard",
#     type="ui_ux",
#     created_at="2026-01-12T10:00:00Z"
# )
```

#### Step 3: Framework Selection & Stage Creation

```python
# Project Manager selects UI/UX framework (7 stages)
framework = UI_UX_FRAMEWORK
stages_created = [
    "Research & Discovery",
    "Information Architecture",
    "Wireframing",
    "Design",
    "Prototyping",
    "User Testing",
    "Handoff"
]

# First stage activated
current_stage = stages_created[0]  # "Research & Discovery"
```

#### Step 4: Task Breakdown for Stage 1

```python
# Project Manager decomposes "Research & Discovery" stage
tasks = await project_manager_agent.decompose_stage(
    stage=current_stage,
    requirements=project_request.requirements
)

# Tasks created:
# Task 1: Analyze dark mode patterns (ux-ui-researcher, 1.5hr)
# Task 2: Research WCAG requirements (ux-ui-researcher, 1hr)
# Task 3: Study design system for theme support (codebase-analyst, 1hr)
```

#### Step 5: Agent Assignment

```python
# For each task, assign optimal agent
for task in tasks:
    agent = await project_manager_agent.assign_agent(task, current_stage)
    # Uses LLM + capability matrix
    
# Assignments:
# Task 1 → ux-ui-researcher
# Task 2 → ux-ui-researcher
# Task 3 → codebase-analyst
```

#### Step 6: Agent Execution

```python
# ux-ui-researcher executes Task 1
task = tasks[0]
result = await ux_ui_researcher.execute_task(task)

# Agent workflow:
# 1. Search knowledge base for dark mode examples
# 2. Execute via Claude Code:
#    - Research best practices
#    - Analyze competitors (GitHub, VS Code, etc.)
#    - Document findings
# 3. Update task with output:
#    - Research report (Markdown)
#    - Pattern analysis
#    - Recommendations

await update_task(
    task_id=task.id,
    status="done",
    output=result.output,
    quality_score=92
)
```

#### Step 7: Quality Gate Evaluation

```python
# All Stage 1 tasks complete
all_tasks_done = all(t.status == "done" for t in tasks)

if all_tasks_done:
    # Evaluate quality gate
    gate_result = await evaluate_quality_gate(
        stage_id=current_stage.id,
        criteria={
            "must_meet": {
                "research_questions_answered": True,
                "findings_documented": True
            },
            "should_meet": {
                "patterns_analyzed": 0.90,  # 90% score
                "insights_actionable": 0.85  # 85% score
            }
        }
    )
    
    # Result:
    # QualityGateResult(
    #     passed=True,
    #     score=88,
    #     approval_required=False,  # Automatic approval
    #     details={...}
    # )
```

#### Step 8: Stage Transition

```python
if gate_result.passed:
    # Transition to next stage
    next_stage = "Information Architecture"
    
    await transition_stage(
        project_id=project.id,
        from_stage="Research & Discovery",
        to_stage=next_stage,
        quality_gate_results=gate_result
    )
    
    # Create tasks for IA stage
    await project_manager_agent.create_stage_tasks(next_stage)
```

#### Step 9-15: Repeat for All Stages

```
Stage 2: Information Architecture → Sitemap, user flows (2-3 days)
Stage 3: Wireframing → Lo-fi wireframes (3-5 days)
Stage 4: Design → Hi-fi mockups (5-10 days)
Stage 5: Prototyping → Interactive prototype (3-5 days)
Stage 6: User Testing → Usability tests (3-5 days)
Stage 7: Handoff → Documentation, assets (1-2 days)
```

#### Step 16: Project Completion

```python
# All stages complete
await mark_project_complete(project.id)

# Generate completion report
report = {
    "project": project.title,
    "duration": "3 weeks",
    "stages_completed": 7,
    "tasks_completed": 42,
    "quality_score_avg": 87,
    "deliverables": [
        "Research report",
        "Design mockups",
        "Interactive prototype",
        "User testing results",
        "Implementation-ready assets"
    ]
}
```

---

## 8. Quality Gates & Transition Criteria

### 8.1 Quality Gate Types

**Type 1: Binary Checks (Pass/Fail)**

```python
binary_gates = {
    "all_tests_passing": lambda: run_tests() == "all_pass",
    "linting_clean": lambda: run_linter() == 0,
    "coverage_adequate": lambda: get_coverage() >= 80,
    "security_clean": lambda: run_security_audit() == "no_critical"
}
```

**Type 2: Scored Criteria (0-100)**

```python
scored_gates = {
    "research_completeness": {
        "weight": 0.3,
        "threshold": 80,
        "calculate": lambda: calculate_research_score()
    },
    "design_system_compliance": {
        "weight": 0.4,
        "threshold": 90,
        "calculate": lambda: check_design_tokens_usage()
    },
    "user_satisfaction": {
        "weight": 0.3,
        "threshold": 70,
        "calculate": lambda: calculate_sus_score()
    }
}

total_score = sum(gate["weight"] * gate["calculate"]() for gate in scored_gates.values())
```

**Type 3: Manual Approval**

```python
manual_gates = {
    "stakeholder_signoff": {
        "required_approvers": ["product_manager", "design_lead"],
        "approval_method": "email",
        "timeout": "48 hours"
    }
}
```

### 8.2 Transition Criteria Matrix

| From Stage | To Stage | Must-Meet | Should-Meet (Threshold) | Approval |
|------------|----------|-----------|-------------------------|----------|
| Ideation | Research | Problem defined ✓ | Approaches explored (≥80) | Auto |
| Research | Prototype | Libraries identified ✓ | Code examples (≥70) | Auto |
| Prototype | Validation | Working demo ✓ | Features functional (≥80) | Manual (PM) |
| Wireframing | Design | Wireframes approved ✓ | Feedback addressed (≥90) | Manual (Designer) |
| Testing | Deployment | All tests passing ✓ | Performance (≥90) | Manual (Engineering Manager) |

---

## 9. Agent Capabilities & Constraints

This section provides detailed operational specifications for the 14-agent system, focusing on capabilities beyond basic descriptions in Section 4.10. These details are critical for agent selection algorithms, resource allocation, and failure recovery procedures.

### 9.1 Agent Capability Matrices

#### Skill Level Framework

Each agent has proficiency levels across technologies (1-10 scale):
- **Master (9-10)**: Can architect, optimize, and handle edge cases
- **Expert (7-8)**: Production-ready implementation
- **Intermediate (5-6)**: Standard implementations with guidance
- **Novice (3-4)**: Basic tasks only, requires review
- **None (0-2)**: Should not be assigned

#### Technology Proficiency by Agent

**ui-implementation-expert**:
```yaml
Frontend Frameworks:
  React: 10 (Master - hooks, suspense, server components)
  Next.js: 10 (Master - App Router, RSC, middleware)
  Vue: 8 (Expert - Composition API, Pinia)
  Svelte: 7 (Expert - stores, transitions)
  Angular: 4 (Novice - basic components only)

Styling:
  Tailwind CSS: 10 (Master - custom plugins, JIT)
  CSS-in-JS: 9 (Master - styled-components, emotion)
  SCSS/SASS: 8 (Expert)
  Vanilla CSS: 10 (Master)

State Management:
  TanStack Query: 10 (Master)
  Zustand: 9 (Master)
  Redux Toolkit: 8 (Expert)
  Context API: 10 (Master)

Accessibility:
  WCAG 2.1 AA: 9 (Master)
  ARIA attributes: 9 (Master)
  Screen reader testing: 8 (Expert)
```

**backend-api-expert**:
```yaml
Backend Frameworks:
  FastAPI: 10 (Master - async, dependencies, middleware)
  Express.js: 9 (Master)
  NestJS: 8 (Expert)
  Django: 7 (Expert - DRF, ORM)
  Flask: 8 (Expert)

API Protocols:
  REST: 10 (Master - HATEOAS, versioning)
  GraphQL: 8 (Expert - resolvers, dataloaders)
  gRPC: 6 (Intermediate)
  tRPC: 9 (Master)
  WebSockets: 8 (Expert)

Authentication:
  JWT: 10 (Master)
  OAuth 2.0: 9 (Master)
  Session-based: 10 (Master)
  API Keys: 10 (Master)
  Passkeys/WebAuthn: 6 (Intermediate)
```

**database-expert**:
```yaml
Databases:
  PostgreSQL: 10 (Master - partitioning, replication)
  MySQL: 8 (Expert)
  MongoDB: 7 (Expert)
  Redis: 9 (Master - caching, pub/sub)
  SQLite: 9 (Master)

ORMs:
  SQLAlchemy: 10 (Master - complex queries, joins)
  Prisma: 9 (Master)
  TypeORM: 8 (Expert)
  Drizzle: 7 (Expert)

Optimization:
  Query optimization: 10 (Master)
  Index design: 10 (Master)
  Sharding: 7 (Expert)
  Replication: 8 (Expert)
  Connection pooling: 9 (Master)
```

**architect**:
```yaml
System Design:
  Microservices: 9 (Master)
  Event-driven: 9 (Master)
  Serverless: 8 (Expert)
  Monoliths: 10 (Master)

Scalability:
  Horizontal scaling: 9 (Master)
  Caching strategies: 10 (Master)
  Load balancing: 9 (Master)
  CDN integration: 8 (Expert)

Cloud Platforms:
  AWS: 8 (Expert - EC2, S3, Lambda, RDS)
  Azure: 7 (Expert - VMs, Blob, Functions)
  GCP: 6 (Intermediate)
  Vercel: 9 (Master)
  Railway: 8 (Expert)
```

#### Learning Curve Estimates

**Fast Learners** (1-2 hours to proficiency):
- `planner`: Quickly adapts to new project types
- `library-researcher`: Rapidly absorbs documentation
- `codebase-analyst`: Fast pattern recognition

**Moderate Learners** (4-8 hours):
- `ui-implementation-expert`: New component libraries
- `backend-api-expert`: New framework versions
- `testing-expert`: New testing frameworks

**Slow Learners** (16-24 hours):
- `database-expert`: New database systems (different paradigms)
- `architect`: New architectural patterns
- `llms-expert`: New LLM APIs/models

### 9.2 LLM Access Patterns & Budget Allocation

#### Token Budget by Agent Tier

**Tier 1 (Orchestrator)**:
```python
planner_budget = {
    "tokens_per_session": 100_000,
    "model": "claude-3-5-sonnet-20241022",
    "fallback_model": "gpt-4o",
    "max_sessions_per_day": 10,
    "cost_per_session": "$0.75 (100K input + 20K output)"
}
```

**Tier 2 (Architecture & Strategy)**:
```python
tier2_budget = {
    "tokens_per_session": 50_000,
    "models": {
        "architect": "claude-3-5-sonnet-20241022",  # Better reasoning
        "llms-expert": "gpt-4o",  # Better code generation
        "computer-vision-expert": "gpt-4o"  # Better vision understanding
    },
    "max_sessions_per_day": 15,
    "cost_per_session": "$0.35-0.45"
}
```

**Tier 3 (Specialist Researchers)**:
```python
tier3_budget = {
    "tokens_per_session": 30_000,
    "model": "gpt-4o-mini",  # Cost-effective for research
    "fallback_model": "claude-3-5-haiku",
    "max_sessions_per_day": 30,
    "cost_per_session": "$0.05-0.10"
}
```

**Tier 4 (Implementation Experts)**:
```python
tier4_budget = {
    "tokens_per_session": 50_000,
    "model": "claude-3-5-sonnet-20241022",  # Better at coding
    "fallback_model": "gpt-4o",
    "max_sessions_per_day": 20,
    "cost_per_session": "$0.35-0.45"
}
```

**Tier 5 (Quality & Documentation)**:
```python
tier5_budget = {
    "tokens_per_session": 20_000,
    "models": {
        "testing-expert": "gpt-4o",  # Better test generation
        "documentation-expert": "claude-3-5-sonnet",  # Better writing
        "performance-expert": "claude-3-5-sonnet"  # Better analysis
    },
    "max_sessions_per_day": 25,
    "cost_per_session": "$0.15-0.25"
}
```

#### Model Selection Logic

**Decision Tree**:
```python
def select_llm_model(agent_type: str, task_complexity: str, context_size: int):
    """Select optimal LLM based on agent, task, and context"""

    # High-complexity reasoning tasks
    if task_complexity == "high" and agent_type in ["planner", "architect"]:
        return "claude-3-5-sonnet-20241022"  # Superior reasoning

    # Code generation tasks
    if task_complexity in ["medium", "high"] and agent_type in [
        "ui-implementation-expert", "backend-api-expert", "database-expert"
    ]:
        return "claude-3-5-sonnet-20241022"  # Better code quality

    # Research and documentation
    if agent_type in ["library-researcher", "codebase-analyst", "documentation-expert"]:
        if context_size > 50_000:
            return "claude-3-5-sonnet-20241022"  # 200K context window
        else:
            return "gpt-4o-mini"  # Cost-effective

    # Testing and simple tasks
    if task_complexity == "low" or agent_type in ["testing-expert"]:
        return "gpt-4o-mini"  # Sufficient capability, lower cost

    # Default fallback
    return "gpt-4o"
```

#### Fallback Strategies

**Primary Model Failure** (rate limit, timeout, error):
```python
fallback_chain = [
    "claude-3-5-sonnet-20241022",  # Primary
    "gpt-4o",                       # Fallback 1
    "gpt-4o-mini",                  # Fallback 2 (degraded capability)
    "local-llama-cpp"               # Fallback 3 (offline mode, via Ollama)
]

def execute_with_fallback(agent, task, models=fallback_chain):
    for model in models:
        try:
            result = agent.execute(task, model=model)
            log_model_usage(agent, model, "success")
            return result
        except (RateLimitError, TimeoutError) as e:
            log_model_usage(agent, model, "failed", error=e)
            continue

    # All models failed - escalate to human
    escalate_to_human(agent, task, reason="all_llms_failed")
```

#### Cost Optimization Rules

**Rule 1: Cache Common Queries**:
```python
# Use pgvector semantic caching for repeated questions
if semantic_similarity(new_query, cached_queries) > 0.95:
    return cached_response  # Save $0.35 per query
```

**Rule 2: Batch Small Tasks**:
```python
# Combine multiple small tasks into one LLM call
if sum(task.estimated_tokens for task in pending_tasks) < 10_000:
    batch_execute(pending_tasks)  # Save 70% on API calls
```

**Rule 3: Progressive Enhancement**:
```python
# Start with cheaper model, upgrade if needed
result = execute_with_model("gpt-4o-mini", task)
if result.quality_score < 70:
    result = execute_with_model("claude-3-5-sonnet", task)
```

### 9.3 Agent Constraints & Hard Limits

#### Explicit Boundaries (What Agents CANNOT Do)

**ui-implementation-expert**:
```yaml
Cannot:
  - Write backend API endpoints
  - Design database schemas
  - Write database migrations
  - Make architectural decisions (scalability, tech stack)
  - Write system integration tests (only component tests)

Can (with limitations):
  - Create mock API responses for frontend testing
  - Suggest API interface contracts (not implementation)
  - Design component-level state management (not global architecture)
```

**backend-api-expert**:
```yaml
Cannot:
  - Create frontend UI components
  - Design UX flows or user interfaces
  - Write CSS or styling code
  - Make database schema decisions (can suggest)
  - Configure infrastructure (load balancers, CDN)

Can (with limitations):
  - Suggest API response formats for frontend consumption
  - Create API documentation (OpenAPI/Swagger)
  - Write integration tests that call frontend (black-box)
```

**database-expert**:
```yaml
Cannot:
  - Implement business logic (belongs in backend)
  - Create frontend queries (only backend data access layer)
  - Make API design decisions
  - Configure application deployment

Can (with limitations):
  - Suggest indexes for query performance (based on API patterns)
  - Design caching strategies (implementation by backend-expert)
  - Write database functions/stored procedures (if approved by architect)
```

**architect**:
```yaml
Cannot:
  - Write production implementation code (only prototypes/examples)
  - Execute tasks without approval from planner
  - Override business requirements (must escalate)
  - Deploy infrastructure without approval

Can (with limitations):
  - Create proof-of-concept implementations
  - Write architectural decision records (ADRs)
  - Suggest but not enforce technology choices
```

**planner**:
```yaml
Cannot:
  - Skip required stages in framework
  - Assign agents to restricted stages
  - Create tasks >4 hours (must break down further)
  - Modify project type after classification (without re-classification)

Can (with limitations):
  - Override agent suggestions (with justification)
  - Adjust stage sequence (with architect approval)
  - Escalate to human for ambiguous situations
```

#### Resource Limits

**Execution Time Limits**:
```python
time_limits = {
    "planner": "2 hours max per planning session",
    "tier2_agents": "4 hours max per task",
    "tier3_agents": "2 hours max per research task",
    "tier4_agents": "4 hours max per implementation task",
    "tier5_agents": "3 hours max per quality task"
}

# Enforcement
@timeout(hours=time_limits[agent.tier])
def execute_agent_task(agent, task):
    return agent.execute(task)
```

**Memory Limits** (Agent container resources):
```python
memory_limits = {
    "planner": "2GB",           # LLM API calls + planning logic
    "tier2_agents": "4GB",      # Architecture diagrams, LLM calls
    "tier3_agents": "2GB",      # Research and analysis
    "tier4_agents": "4GB",      # Code generation + compilation
    "tier5_agents": "3GB"       # Testing, docs generation
}
```

**API Call Limits**:
```python
api_limits = {
    "llm_calls_per_minute": {
        "planner": 10,
        "tier2_agents": 8,
        "tier3_agents": 15,  # More queries, smaller contexts
        "tier4_agents": 10,
        "tier5_agents": 12
    },
    "external_api_calls": {
        "library-researcher": 100,  # npm, PyPI, GitHub API
        "integration-expert": 50,    # Third-party API testing
        "all_others": 20
    }
}
```

**Concurrent Task Limits**:
```python
# Maximum parallel tasks per agent type
concurrency_limits = {
    "planner": 1,                    # Only one planning session at a time
    "architect": 2,                  # Can design 2 subsystems in parallel
    "ui-implementation-expert": 5,   # Multiple components in parallel
    "backend-api-expert": 4,         # Multiple endpoints in parallel
    "database-expert": 1,            # Sequential schema changes only
    "testing-expert": 10,            # Many tests can run in parallel
    "all_others": 3
}
```

### 9.4 Edge Cases & Error Handling

#### Agent Failure Scenarios

**Scenario 1: Agent Crashes Mid-Task**

```python
class AgentCrashRecovery:
    def handle_crash(self, agent, task, crash_context):
        """Recovery procedure for agent crashes"""

        # Step 1: Save partial work
        partial_work = self.extract_partial_work(crash_context)
        if partial_work:
            self.save_to_task_artifacts(task.id, partial_work)

        # Step 2: Determine crash cause
        crash_cause = self.analyze_crash(crash_context)

        # Step 3: Recovery strategy
        if crash_cause == "timeout":
            # Break task into smaller subtasks
            subtasks = self.decompose_task(task, max_hours=2)
            return self.reassign_subtasks(subtasks, agent.type)

        elif crash_cause == "llm_failure":
            # Retry with fallback LLM
            return self.retry_with_fallback_llm(agent, task)

        elif crash_cause == "resource_limit":
            # Assign to more powerful agent tier
            return self.escalate_to_higher_tier(agent, task)

        else:
            # Unknown cause - escalate to human
            return self.escalate_to_human(task,
                reason=f"Agent {agent.type} crashed: {crash_cause}")
```

**Scenario 2: Agent Exceeds Time Limit**

```python
class TimeoutHandler:
    def handle_timeout(self, agent, task, elapsed_time):
        """Handle agent timeout (>4 hours)"""

        # Check if substantial progress was made
        progress = self.calculate_progress(task)

        if progress > 80:
            # Almost done - extend deadline by 1 hour
            return self.extend_deadline(task, hours=1)

        elif progress > 50:
            # Halfway - save work and reassign remainder
            completed_subtask = self.extract_completed_work(task)
            remaining_work = self.calculate_remaining_work(task, progress)
            return self.create_continuation_task(remaining_work, agent.type)

        else:
            # Minimal progress - task too complex or agent wrong fit
            return self.reassess_task(task, reason="minimal_progress_after_timeout")
```

**Scenario 3: Agent Produces Low-Quality Output**

```python
class QualityGateRejection:
    def handle_rejection(self, agent, task, quality_score, issues):
        """Handle quality gate rejection (score <70)"""

        if quality_score < 40:
            # Very poor quality - wrong agent or misunderstood requirements
            return self.reassign_to_different_agent(task,
                exclude=[agent.type],
                reason="Poor quality output")

        elif quality_score < 60:
            # Mediocre - retry with explicit guidance
            guidance = self.generate_improvement_guidance(issues)
            return self.retry_with_guidance(agent, task, guidance)

        else:  # 60-69
            # Close to passing - minor fixes needed
            fixes = self.generate_fix_instructions(issues)
            return self.request_incremental_fixes(agent, task, fixes)
```

#### Deadlock Detection & Resolution

**Scenario 4: Circular Task Dependencies**

```python
class DeadlockDetector:
    def detect_and_resolve(self, project_tasks):
        """Detect circular dependencies and resolve"""

        # Build dependency graph
        graph = self.build_dependency_graph(project_tasks)

        # Detect cycles using DFS
        cycles = self.find_cycles(graph)

        if cycles:
            for cycle in cycles:
                # Resolution strategies:

                # Strategy 1: Identify false dependency
                false_deps = self.find_false_dependencies(cycle)
                if false_deps:
                    self.remove_dependencies(false_deps)
                    continue

                # Strategy 2: Break into sequential steps
                if len(cycle) == 2:  # A→B, B→A
                    task_a, task_b = cycle
                    shared_work = self.identify_shared_requirements(task_a, task_b)
                    prerequisite_task = self.create_prerequisite_task(shared_work)
                    self.update_dependencies(task_a, [prerequisite_task.id])
                    self.update_dependencies(task_b, [prerequisite_task.id])
                    continue

                # Strategy 3: Escalate to planner agent
                self.escalate_to_planner(cycle,
                    reason="Complex circular dependency detected")
```

**Scenario 5: Two Agents Waiting on Each Other**

```python
class AgentCoordinationDeadlock:
    def resolve_wait_deadlock(self, agent_a, agent_b):
        """Resolve two agents waiting for each other's output"""

        # Check if both are blocked
        if agent_a.status == "waiting" and agent_b.status == "waiting":

            # Identify what each agent is waiting for
            wait_reason_a = agent_a.get_wait_reason()
            wait_reason_b = agent_b.get_wait_reason()

            # Resolution: Create intermediate task
            if wait_reason_a.requires_from(agent_b) and \
               wait_reason_b.requires_from(agent_a):

                # Example: ui-expert needs API contract,
                #          backend-expert needs UI mockups
                intermediate = self.create_sync_meeting_task(
                    agents=[agent_a, agent_b],
                    deliverable="Agreed interface contract"
                )

                # Assign to architect to mediate
                self.assign_task(intermediate, "architect")
```

#### Conflicting Agent Recommendations

**Scenario 6: Technology Stack Disagreement**

```python
class ConflictResolution:
    def resolve_tech_conflict(self, recommendations):
        """Resolve conflicting technology recommendations"""

        # Example: architect suggests MongoDB,
        #          database-expert prefers PostgreSQL

        conflicts = self.detect_conflicts(recommendations)

        for conflict in conflicts:
            agents = conflict.agents
            options = conflict.options

            # Resolution strategies (in order):

            # 1. Check project requirements (hard constraints)
            required_features = self.get_project_requirements()
            compatible = [opt for opt in options
                         if opt.supports_all(required_features)]
            if len(compatible) == 1:
                return self.select_option(compatible[0],
                    reason="Only option meeting requirements")

            # 2. Agent expertise weighting
            votes = {}
            for agent, option in zip(agents, options):
                expertise_level = agent.get_expertise_level(option)
                votes[option] = votes.get(option, 0) + expertise_level

            winner = max(votes, key=votes.get)
            if votes[winner] > sum(votes.values()) * 0.6:  # Clear winner
                return self.select_option(winner,
                    reason=f"Expert consensus (60%+ vote)")

            # 3. Cost-benefit analysis
            analysis = self.perform_cost_benefit(options)
            if analysis.has_clear_winner():
                return self.select_option(analysis.winner,
                    reason="Cost-benefit analysis")

            # 4. Escalate to human decision
            return self.request_human_decision(
                conflict=conflict,
                analysis=analysis,
                expert_opinions={agent: agent.get_justification(option)
                                for agent, option in zip(agents, options)}
            )
```

### 9.5 Agent Coordination Patterns

#### Sequential Execution Rules

**Pattern 1: Research → Implementation**

```python
sequential_patterns = {
    "research_before_implementation": {
        "sequence": [
            ("codebase-analyst", "Find existing patterns"),
            ("library-researcher", "Identify external libraries"),
            ("ui-implementation-expert", "Implement component")
        ],
        "rationale": "Implementation informed by research prevents rework",
        "enforcement": "Hard dependency - implementation blocked until research complete"
    }
}
```

**Pattern 2: Schema → Backend → Frontend**

```python
sequential_patterns["data_layer_first"] = {
    "sequence": [
        ("database-expert", "Design schema + migrations"),
        ("backend-api-expert", "Implement endpoints using schema"),
        ("ui-implementation-expert", "Build UI consuming endpoints")
    ],
    "rationale": "Data model drives API design drives UI",
    "enforcement": "Hard dependency chain"
}
```

**Pattern 3: Architecture → All Implementation**

```python
sequential_patterns["architecture_gates_implementation"] = {
    "sequence": [
        ("architect", "Design system architecture"),
        [  # Parallel after architecture approved
            ("ui-implementation-expert", "Build frontend"),
            ("backend-api-expert", "Build backend"),
            ("database-expert", "Implement database")
        ]
    ],
    "rationale": "Unified architecture prevents integration issues",
    "enforcement": "Architecture must be approved before implementation begins"
}
```

#### Parallel Execution Rules

**Pattern 1: Independent Components**

```python
parallel_patterns = {
    "independent_components": {
        "parallel_agents": [
            ("ui-implementation-expert", "Build login component"),
            ("ui-implementation-expert", "Build dashboard component"),
            ("ui-implementation-expert", "Build settings component")
        ],
        "requirements": "Components share no state or dependencies",
        "coordination": "None required - fully independent"
    }
}
```

**Pattern 2: Frontend + Backend (Contract-First)**

```python
parallel_patterns["frontend_backend_parallel"] = {
    "prerequisites": [
        ("architect", "Define API contract (OpenAPI spec)")
    ],
    "parallel_agents": [
        ("ui-implementation-expert", "Build UI using mock API"),
        ("backend-api-expert", "Implement API matching contract")
    ],
    "coordination": "Weekly sync to validate contract assumptions",
    "integration_point": "Integration testing stage"
}
```

**Pattern 3: Quality & Documentation**

```python
parallel_patterns["quality_docs_parallel"] = {
    "prerequisites": [
        ("*-implementation-expert", "Complete implementation")
    ],
    "parallel_agents": [
        ("testing-expert", "Write tests"),
        ("documentation-expert", "Write docs"),
        ("performance-expert", "Profile and optimize")
    ],
    "rationale": "Quality work can happen independently",
    "coordination": "None - merge all artifacts at stage end"
}
```

#### Inter-Agent Communication Protocol

**Communication Channels**:

```python
class AgentCommunication:
    """How agents communicate with each other"""

    # Method 1: Task Artifacts (Asynchronous)
    def share_via_artifacts(self, from_agent, to_agent, artifact_type, content):
        """
        Primary communication method - write to shared task artifacts

        Examples:
        - architect writes: architecture_decision_record.md
        - backend-api-expert reads ADR, writes: api_specification.yaml
        - ui-implementation-expert reads API spec, writes: component_tree.md
        """
        artifact = TaskArtifact(
            task_id=self.current_task.id,
            created_by=from_agent.id,
            artifact_type=artifact_type,
            content=content,
            metadata={"intended_for": to_agent.id}
        )
        self.task_artifacts.save(artifact)
        self.notify_agent(to_agent, f"New artifact: {artifact_type}")

    # Method 2: Design Documents (Structured)
    def share_via_design_docs(self, agent, doc_type, content):
        """
        Formal design documents stored in Archon knowledge base

        Examples:
        - architect: system_design.md, api_contracts.yaml
        - database-expert: schema_design.md, migration_plan.md
        - ui-implementation-expert: component_hierarchy.md
        """
        doc = self.knowledge_base.create_document(
            project_id=self.project.id,
            document_type=doc_type,
            author=agent.id,
            content=content
        )
        return doc.id

    # Method 3: Structured JSON Messages (Synchronous)
    def send_message(self, from_agent, to_agent, message_type, payload):
        """
        Real-time coordination messages

        Examples:
        - database-expert → backend-api-expert: "Schema migration complete"
        - backend-api-expert → ui-implementation-expert: "API endpoint deployed"
        """
        message = {
            "from": from_agent.id,
            "to": to_agent.id,
            "type": message_type,
            "payload": payload,
            "timestamp": datetime.now()
        }
        self.message_queue.publish(message)

        # If recipient is currently executing, deliver immediately
        if to_agent.status == "executing":
            to_agent.receive_message(message)
```

**Communication Examples**:

```python
# Example 1: Architecture to Implementation
architect.share_via_artifacts(
    to_agent="backend-api-expert",
    artifact_type="api_design",
    content={
        "endpoints": [
            {"path": "/api/users", "method": "GET", "auth": "JWT"},
            {"path": "/api/users/{id}", "method": "PUT", "auth": "JWT"}
        ],
        "rate_limits": {"authenticated": "1000/hour"},
        "response_format": "JSON:API v1.1"
    }
)

# Example 2: Backend to Frontend
backend_expert.share_via_design_docs(
    doc_type="api_specification",
    content=openapi_spec  # OpenAPI 3.1 YAML
)

# Example 3: Real-time coordination
database_expert.send_message(
    to_agent="backend-api-expert",
    message_type="migration_complete",
    payload={
        "new_tables": ["user_profiles", "audit_logs"],
        "modified_columns": ["users.email (now unique)"],
        "breaking_changes": False
    }
)
```

#### Dependency Resolution Algorithm

```python
class DependencyResolver:
    def resolve_task_order(self, tasks):
        """
        Topological sort with agent coordination rules
        """
        # Build dependency graph
        graph = {}
        for task in tasks:
            graph[task.id] = {
                "task": task,
                "depends_on": task.dependencies,
                "agent": task.assignee
            }

        # Apply coordination rules
        self.apply_sequential_rules(graph)
        self.apply_parallel_opportunities(graph)

        # Topological sort
        sorted_tasks = self.topological_sort(graph)

        # Identify parallel batches
        execution_plan = []
        while sorted_tasks:
            # Find all tasks with no dependencies
            ready = [t for t in sorted_tasks if not t.depends_on]

            # Group by agent coordination rules
            parallel_batch = self.group_for_parallel_execution(ready)
            execution_plan.append(parallel_batch)

            # Remove from sorted list
            for task in ready:
                sorted_tasks.remove(task)
                # Update dependencies
                for remaining_task in sorted_tasks:
                    if task.id in remaining_task.depends_on:
                        remaining_task.depends_on.remove(task.id)

        return execution_plan
```

### 9.6 Human-Agent Collaboration Patterns

#### Escalation Triggers

**Automatic Escalation Conditions**:

```python
escalation_rules = {
    "quality_threshold": {
        "trigger": "quality_score < 60 after 3 agent attempts",
        "escalate_to": "human_reviewer",
        "urgency": "high",
        "explanation": "Multiple agents failed to meet quality standards"
    },

    "conflicting_recommendations": {
        "trigger": "2+ agents disagree on critical decision",
        "escalate_to": "technical_lead",
        "urgency": "medium",
        "explanation": "Expert opinions diverge - human judgment needed"
    },

    "security_concern": {
        "trigger": "security_audit_score < 80",
        "escalate_to": "security_team",
        "urgency": "critical",
        "explanation": "Security issue detected - mandatory human review"
    },

    "scope_creep": {
        "trigger": "estimated_hours > original_estimate * 1.5",
        "escalate_to": "project_manager",
        "urgency": "medium",
        "explanation": "Task growing beyond scope - replan required"
    },

    "user_request": {
        "trigger": "user explicitly requests review",
        "escalate_to": "designated_reviewer",
        "urgency": "as_specified",
        "explanation": "User-initiated review"
    }
}
```

#### Human Review Interface

**Code Review for Non-Technical Users**:

```python
class NonTechnicalCodeReview:
    def generate_review_summary(self, agent_output):
        """
        Transform technical output into plain-English summary
        for non-technical stakeholders
        """
        return {
            "what_changed": self.summarize_changes_plain_english(agent_output),
            "why_matters": self.explain_business_impact(agent_output),
            "quality_indicators": {
                "tests_passing": "✅ All 47 tests passing",
                "security": "🔒 No vulnerabilities found",
                "performance": "⚡ Loads in 1.2s (target: <2s)",
                "accessibility": "♿ WCAG 2.1 AA compliant",
                "code_quality": "⭐⭐⭐⭐ (4/5 stars)"
            },
            "visual_preview": self.generate_ascii_mockup(agent_output),
            "recommendation": {
                "action": "approve",  # or "request_changes"
                "confidence": 0.92,
                "reasoning": "High-quality implementation, meets all requirements"
            }
        }
```

**Approval Workflows**:

```python
approval_workflows = {
    "minor_change": {
        "approvers": ["any_team_member"],
        "timeout": "24 hours",
        "auto_approve_if_timeout": True,
        "examples": ["UI color change", "copy text edit", "dependency update"]
    },

    "feature_implementation": {
        "approvers": ["product_manager", "tech_lead"],
        "require_all": False,  # Any one approver sufficient
        "timeout": "48 hours",
        "auto_approve_if_timeout": False,
        "examples": ["New feature", "API endpoint", "database schema"]
    },

    "critical_change": {
        "approvers": ["tech_lead", "security_lead", "product_manager"],
        "require_all": True,  # All must approve
        "timeout": "72 hours",
        "auto_approve_if_timeout": False,
        "examples": ["Authentication system", "payment processing", "data migration"]
    }
}
```

#### Handoff Procedures

**Agent-to-Human Handoff**:

```python
class AgentToHumanHandoff:
    def prepare_handoff(self, agent, task, completion_percentage):
        """
        Prepare task handoff when agent completes 80% but needs human finish
        """
        handoff_package = {
            "completed_work": {
                "artifacts": self.get_task_artifacts(task.id),
                "code_changes": self.get_git_diff(task.id),
                "tests_written": self.get_test_coverage(task.id),
                "documentation": self.get_docs(task.id)
            },

            "remaining_work": {
                "tasks": [
                    "Review error handling for edge case X",
                    "Optimize query for large datasets (>10K records)",
                    "Add telemetry/logging for production monitoring"
                ],
                "estimated_time": "2-3 hours",
                "required_expertise": "Senior backend engineer"
            },

            "agent_notes": {
                "challenges_encountered": agent.get_challenges(),
                "decisions_made": agent.get_decision_log(),
                "suggestions": agent.get_suggestions_for_human()
            },

            "context": {
                "project_stage": task.stage.name,
                "dependencies": self.get_dependent_tasks(task.id),
                "deadline": task.deadline
            }
        }

        return self.create_handoff_ticket(handoff_package)
```

**Human-to-Agent Handoff**:

```python
class HumanToAgentHandoff:
    def receive_human_guidance(self, agent, task, guidance):
        """
        Receive guidance from human and resume agent execution
        """
        # Parse human guidance into structured format
        structured_guidance = self.parse_guidance(guidance)

        # Update task context
        task.add_context("human_guidance", structured_guidance)

        # Resume agent with enhanced context
        agent.resume_execution(
            task=task,
            additional_context=structured_guidance,
            retry_count=task.retry_count + 1
        )
```

#### Collaborative Workflows

**Pattern: Agent Drafts, Human Polishes**

```python
collaborative_patterns = {
    "agent_draft_human_polish": {
        "workflow": [
            ("agent", "Generate 80% implementation"),
            ("human", "Review and polish remaining 20%"),
            ("agent", "Apply polish to similar patterns across codebase")
        ],
        "best_for": ["UI copy", "documentation", "error messages"],
        "time_saved": "70% (vs full human implementation)"
    },

    "human_guides_agent_executes": {
        "workflow": [
            ("human", "Provide high-level requirements and constraints"),
            ("agent", "Generate detailed implementation plan"),
            ("human", "Approve plan or provide corrections"),
            ("agent", "Execute approved plan"),
            ("human", "Final review and approval")
        ],
        "best_for": ["Complex features", "architectural changes"],
        "time_saved": "50% (vs full human implementation)"
    }
}
```

---

## 10. Implementation Roadmap

### Phase 1: Database Schema & Core Models (Weeks 1-2)

**Deliverables**:
- New database tables (4 tables)
- Enhanced archon_tasks table
- Migration scripts
- Model classes (Python)

**Tasks**:
```python
Week 1:
- Create archon_project_types table
- Create archon_project_stages table
- Create archon_quality_gates table
- Create archon_stage_transitions table

Week 2:
- Add new columns to archon_tasks
- Implement ProjectType model
- Implement Stage model
- Implement QualityGate model
- Write migration scripts
- Test migrations
```

### Phase 2: LLM Agent Assignment (Weeks 3-4)

**Deliverables**:
- Agent assignment service
- LLM integration (GPT-4o)
- Capability matrix configuration
- API endpoints

**Tasks**:
```python
Week 3:
- Implement classify_project_type() using GPT-4o
- Create agent capability matrix (JSON)
- Implement select_agent() algorithm
- Add LLM access layer

Week 4:
- Implement semantic caching (pgvector)
- Create API endpoints for agent assignment
- Add MCP tool: assign_agent_to_task
- Write unit tests (>80% coverage)
```

### Phase 3: Stage Workflow Engine (Weeks 5-6)

**Deliverables**:
- Stage transition logic
- Quality gate evaluation system
- Rollback procedures
- Stage management API

**Tasks**:
```python
Week 5:
- Implement transition_stage() function
- Create quality gate evaluation framework
- Add automated check runners (tests, linting, coverage)
- Implement binary gates

Week 6:
- Implement scored gates
- Implement manual approval workflow
- Add rollback procedures
- Test complete stage lifecycle
```

### Phase 4: UI Implementation (Weeks 7-8)

**Deliverables**:
- Dashboard components
- Stage visualization
- Quality gate interface
- Human approval UI

**Tasks**:
```python
Week 7:
- Create StageVisualization component (React)
- Create QualityGateDashboard component
- Add stage transition UI
- Implement progress tracking

Week 8:
- Create HumanApprovalInterface component
- Add real-time updates (WebSocket)
- Polish UI/UX
- Write Storybook stories
```

### Phase 5: Testing & Refinement (Weeks 9-10)

**Deliverables**:
- Integration tests
- E2E tests
- Performance optimization
- Production deployment

**Tasks**:
```python
Week 9:
- Write integration tests
- Write E2E tests (Playwright)
- Performance profiling
- Optimize database queries

Week 10:
- Security audit
- Load testing
- Production deployment
- Monitor and iterate
```

---

## 11. Diagrams & Visualizations

*All diagrams are included inline throughout the document in ASCII format for easy rendering in Markdown.*

---

## 12. Code Examples Reference

*All code examples are embedded inline in relevant sections with complete implementations.*

---

## 13. Appendices

### Appendix A: Glossary

- **Agent**: Specialized AI component that executes specific types of tasks
- **Coordinator Agent**: Entry point agent that understands user intent
- **Project Manager Agent**: Orchestrates project execution and task assignment
- **Stage**: Phase of project with specific entry/exit criteria
- **Quality Gate**: Checkpoint that must pass before stage transition
- **Project Type**: Classification of project (1 of 8 types)
- **LLM**: Large Language Model (GPT-4o, Claude, etc.)
- **MCP**: Model Context Protocol
- **Crash Recovery**: Ability to resume work after failure using project_id

### Appendix B: Quick Reference Tables

**Project Type → Duration**

| Project Type | Typical Duration |
|--------------|------------------|
| Innovation | 1-3 weeks |
| Traditional Dev | 2-6 weeks |
| UI/UX Design | 1-4 weeks |
| API/Backend | 2-8 weeks |
| Integration | 1-3 weeks |
| Research | 1-2 weeks |
| AI/ML | 3-12 weeks |
| Full-Stack Product | 4-16 weeks |

**Agent → Tier → Duration**

| Agent | Tier | Typical Duration |
|-------|------|------------------|
| planner | 1 | 1-2 hours |
| architect | 2 | 2-4 hours |
| llms-expert | 2 | 2-3 hours |
| computer-vision-expert | 2 | 3-4 hours |
| codebase-analyst | 3 | 1-2 hours |
| library-researcher | 3 | 1-2 hours |
| ux-ui-researcher | 3 | 1-2 hours |
| ui-implementation-expert | 4 | 2-4 hours |
| backend-api-expert | 4 | 2-4 hours |
| database-expert | 4 | 2-3 hours |
| integration-expert | 4 | 2-4 hours |
| testing-expert | 5 | 2-3 hours |
| performance-expert | 5 | 1.5-3 hours |
| documentation-expert | 5 | 1-2 hours |

### Appendix C: Validation Checklist

**Before Using This System**:
- [ ] Archon MCP server running (port 8051)
- [ ] Archon Backend API running (port 8181)
- [ ] Supabase database accessible
- [ ] Database migrations applied
- [ ] LLM API keys configured (OpenAI, Anthropic)
- [ ] Agent capability matrix loaded
- [ ] Stage frameworks configured

**For Each New Project**:
- [ ] User request clear and unambiguous
- [ ] Project type classified correctly
- [ ] Framework selected matches project needs
- [ ] All stages have entry/exit criteria
- [ ] Quality gates defined for each stage
- [ ] Agents assigned based on capability matrix
- [ ] project_id generated for crash recovery

**For Each Task**:
- [ ] Estimated hours: 0.5 - 4.0
- [ ] Includes project_id (CRITICAL)
- [ ] Clear title and description
- [ ] Agent assignment appropriate
- [ ] Dependencies logical
- [ ] Quality criteria defined

### Appendix D: Troubleshooting

**Problem**: Stage won't transition
**Solution**: Check quality gate results, verify all tasks complete

**Problem**: Agent assignment failing
**Solution**: Verify agent capability matrix, check stage restrictions

**Problem**: Tasks orphaned after crash
**Solution**: Use project_id to find all related tasks

**Problem**: Quality gate always failing
**Solution**: Review criteria thresholds, may be too strict

---

## Document Summary

**Document**: Archon Stage-Based Project Delivery System
**Version**: 1.0.0
**Total Sections**: 13
**Total Pages**: ~80 (estimated)
**Purpose**: Foundation document for planner agent to create structured tasks

**Key Achievements**:
✅ Defined 8 project types with complete characteristics
✅ Created tailored stage frameworks for each type
✅ Established agent assignment matrix (14 agents)
✅ Documented complete multi-agent workflow
✅ Provided integration guide for existing Archon system
✅ Detailed task lifecycle with concrete examples
✅ Defined quality gates and transition criteria
✅ Created 10-week implementation roadmap

**Next Steps**:
1. Review and validate with stakeholders
2. Begin Phase 1 implementation (database schema)
3. Test with pilot project (Traditional Dev type recommended)
4. Iterate based on feedback
5. Roll out remaining project types

---

**End of Document**

**Maintainers**: SportERP Development Team
**Last Updated**: 2026-01-12
**Contact**: For questions about this system, consult Archon knowledge base or file an issue

---
