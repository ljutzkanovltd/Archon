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


