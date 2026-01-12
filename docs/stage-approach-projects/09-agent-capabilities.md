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

