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

