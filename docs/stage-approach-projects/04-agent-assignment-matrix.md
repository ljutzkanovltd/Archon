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


