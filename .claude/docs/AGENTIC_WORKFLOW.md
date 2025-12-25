# Agentic Workflow Guide

Complete guide for Archon's hierarchical agent system and task-driven development workflows.

**Related**: `@.claude/CLAUDE.md` (Quick reference), `@.claude/docs/BEST_PRACTICES.md` (Patterns)

---

## Complete Workflow Phases

### Phase 0: Task Discovery (ALWAYS FIRST)

```python
# Check Archon health
curl http://localhost:8051/health

# Search for existing projects
projects = find_projects(query="feature name")

# Check for existing tasks
if projects:
    project_id = projects[0]['id']
    tasks = find_tasks(
        project_id=project_id,
        filter_by="status",
        filter_value="todo"
    )
else:
    # Create new project
    project = manage_project("create",
        title="Feature Implementation",
        description="Clear project scope and goals"
    )
    project_id = project['project']['id']
```

### Phase 1: Planning (Planner Agent - Default for >2hr work)

```python
# Create planning task
planning_task = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Plan: Feature implementation strategy",
    description="""
    1. Analyze requirements and codebase patterns
    2. Research required libraries and tools
    3. Break down into validated 30min-4hr tasks
    4. Assign expert agents to each task
    5. Create dependency map and timeline
    """,
    assignee="planner",
    estimated_hours=1.5,
    status="doing"
)

# Planner agent executes:
# - Uses codebase-analyst to find patterns
# - Uses library-researcher for documentation
# - Creates task breakdown with project_id
# - Assigns expert agents based on task type
# - Validates scope (30min-4hr per task)

manage_task("update",
    task_id=planning_task['task']['id'],
    status="done"
)
```

### Phase 2: Architecture (If complex system design needed)

```python
# Architect designs system (created by planner)
arch_task = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Design: System architecture",
    description="Component design, data flow, tech stack decisions",
    assignee="architect",
    estimated_hours=2.0,
    dependencies=[planning_task['task']['id']],
    created_by_agent="planner"
)
```

### Phase 3: Research (Specialist Researchers - Parallel execution)

```python
# UX research
ux_task = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Research: Accessibility patterns",
    assignee="ux-ui-researcher",
    estimated_hours=1.0,
    dependencies=[planning_task['task']['id']],
    created_by_agent="planner"
)

# Codebase analysis (if patterns needed)
pattern_task = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Analyze: Existing implementation patterns",
    assignee="codebase-analyst",
    estimated_hours=1.5,
    dependencies=[planning_task['task']['id']],
    created_by_agent="planner"
)
```

### Phase 4: Implementation (Expert Agents - Sequential/Parallel by dependencies)

```python
# UI implementation
ui_task = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Implement: Component UI",
    assignee="ui-implementation-expert",
    estimated_hours=3.0,
    dependencies=[arch_task['task']['id'], ux_task['task']['id']],
    created_by_agent="planner"
)

# Backend API
api_task = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Implement: REST API endpoints",
    assignee="backend-api-expert",
    estimated_hours=2.5,
    dependencies=[arch_task['task']['id']],
    created_by_agent="planner"
)

# Database work
db_task = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Implement: Database schema and migrations",
    assignee="database-expert",
    estimated_hours=2.0,
    dependencies=[arch_task['task']['id']],
    created_by_agent="planner"
)
```

### Phase 5: Quality Assurance (Quality Agents)

```python
# Testing
test_task = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Test: Comprehensive test suite",
    assignee="testing-expert",
    estimated_hours=2.5,
    dependencies=[ui_task['task']['id'], api_task['task']['id']],
    created_by_agent="planner"
)

# Performance optimization
perf_task = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Optimize: Performance profiling and tuning",
    assignee="performance-expert",
    estimated_hours=1.5,
    dependencies=[test_task['task']['id']],
    created_by_agent="planner"
)

# Documentation
docs_task = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Document: Technical documentation and guides",
    assignee="documentation-expert",
    estimated_hours=1.0,
    dependencies=[test_task['task']['id']],
    created_by_agent="planner"
)
```

---

## Validation Procedures

### Pre-Creation Validation

Run before creating tasks to ensure all requirements are met:

```python
# Step 1: Verify Archon is available
curl http://localhost:8051/health
# Expected: {"status": "healthy"}

# Step 2: Verify project exists
project = find_projects(project_id="d80817df-6294-4e66-9b43-cbafb15da400")
if not project:
    raise ValueError("Project not found - create project first!")

# Step 3: Validate scope (0.5-4.0 hours)
estimated_hours = 2.5
if not (0.5 <= estimated_hours <= 4.0):
    raise ValueError(f"Scope {estimated_hours}hr exceeds limits (0.5-4.0)")

# Step 4: Validate agent exists
valid_agents = [
    "planner", "architect", "llms-expert", "computer-vision-expert",
    "codebase-analyst", "library-researcher", "ux-ui-researcher",
    "ui-implementation-expert", "backend-api-expert", "database-expert",
    "integration-expert", "testing-expert", "performance-expert",
    "documentation-expert"
]
assignee = "ui-implementation-expert"
if assignee not in valid_agents:
    raise ValueError(f"Invalid agent: {assignee}")

# Step 5: Create task (all validations passed)
task = manage_task("create",
    project_id="d80817df-6294-4e66-9b43-cbafb15da400",  # CRASH RECOVERY
    title="Implement: User profile component",
    assignee=assignee,
    estimated_hours=estimated_hours
)
```

### Post-Creation Validation

Verify task persisted correctly:

```python
# Verify task was created with project_id
created_task = find_tasks(task_id=task['task']['id'])
assert created_task['project_id'] == "d80817df-6294-4e66-9b43-cbafb15da400"
assert created_task['assignee'] == "ui-implementation-expert"
assert 0.5 <= created_task['estimated_hours'] <= 4.0

# Verify crash recovery works
all_project_tasks = find_tasks(
    project_id="d80817df-6294-4e66-9b43-cbafb15da400"
)
assert task['task']['id'] in [t['id'] for t in all_project_tasks]
print("✅ Task validation passed - crash recovery guaranteed")
```

### Planner Breakdown Validation

For complex features requiring task breakdown:

```python
# Step 1: Planner creates breakdown
planning_task = manage_task("create",
    project_id=PROJECT_ID,  # CRASH RECOVERY
    title="Plan: Feature X",
    assignee="planner",
    estimated_hours=1.5
)

# Step 2: Planner creates subtasks
subtasks = [
    {"title": "Design: Architecture", "agent": "architect", "hours": 2.0},
    {"title": "Implement: UI", "agent": "ui-implementation-expert", "hours": 3.0},
    {"title": "Test: E2E", "agent": "testing-expert", "hours": 2.0}
]

created_subtasks = []
for subtask in subtasks:
    # Validate each subtask
    assert 0.5 <= subtask["hours"] <= 4.0, f"Invalid scope: {subtask['hours']}"
    assert subtask["agent"] in valid_agents, f"Invalid agent: {subtask['agent']}"

    # Create with project_id
    task = manage_task("create",
        project_id=PROJECT_ID,  # CRASH RECOVERY
        title=subtask["title"],
        assignee=subtask["agent"],
        estimated_hours=subtask["hours"],
        created_by_agent="planner",
        dependencies=[planning_task['task']['id']]
    )
    created_subtasks.append(task)

# Step 3: Verify all subtasks have project_id
for task in created_subtasks:
    assert task['task']['project_id'] == PROJECT_ID
    assert task['task']['created_by_agent'] == "planner"
print(f"✅ Planner created {len(created_subtasks)} validated subtasks with crash recovery")
```

### Dependency Validation (Acyclic graph check)

Ensure no circular dependencies exist:

```python
def validate_dependencies(tasks):
    """Ensure no circular dependencies"""
    visited = set()
    rec_stack = set()

    def has_cycle(task_id):
        visited.add(task_id)
        rec_stack.add(task_id)

        # Get task dependencies
        task = find_tasks(task_id=task_id)
        for dep_id in task.get('dependencies', []):
            if dep_id not in visited:
                if has_cycle(dep_id):
                    return True
            elif dep_id in rec_stack:
                return True  # Cycle detected!

        rec_stack.remove(task_id)
        return False

    for task in tasks:
        if task['id'] not in visited:
            if has_cycle(task['id']):
                raise ValueError(f"Circular dependency detected in task {task['id']}")

    return True

# Example usage
all_tasks = find_tasks(project_id=PROJECT_ID)
validate_dependencies(all_tasks)
print("✅ Dependency graph is acyclic")
```

### Crash Recovery Simulation

Test recovery after connection loss:

```python
# Simulate connection loss and recovery
print("Simulating crash recovery...")

# Before crash: Create tasks
project_id = "d80817df-6294-4e66-9b43-cbafb15da400"
task1 = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Task 1",
    assignee="ui-implementation-expert",
    estimated_hours=2.0
)
task2 = manage_task("create",
    project_id=project_id,  # CRASH RECOVERY
    title="Task 2",
    assignee="backend-api-expert",
    estimated_hours=1.5,
    dependencies=[task1['task']['id']]
)

# Simulate crash (clear local state)
# ... connection lost ...

# After reconnection: Recover tasks via project_id
print("Recovering tasks after crash...")
recovered_tasks = find_tasks(project_id=project_id)

# Verify all tasks recovered
assert len(recovered_tasks) >= 2
assert any(t['title'] == "Task 1" for t in recovered_tasks)
assert any(t['title'] == "Task 2" for t in recovered_tasks)

# Verify dependencies preserved
task2_recovered = next(t for t in recovered_tasks if t['title'] == "Task 2")
assert task1['task']['id'] in task2_recovered['dependencies']

print("✅ Crash recovery successful - all tasks and dependencies restored")
```

### Scope Validation Test

Ensure scope enforcement (0.5-4.0 hours):

```python
def test_scope_validation():
    """Ensure scope is enforced (0.5-4.0 hours)"""

    # Valid scopes (should succeed)
    valid_scopes = [0.5, 1.0, 2.0, 3.5, 4.0]
    for hours in valid_scopes:
        task = manage_task("create",
            project_id=PROJECT_ID,  # CRASH RECOVERY
            title=f"Test task {hours}hr",
            assignee="ui-implementation-expert",
            estimated_hours=hours
        )
        assert task['task']['estimated_hours'] == hours
        print(f"✅ Valid scope {hours}hr accepted")

    # Invalid scopes (should fail)
    invalid_scopes = [0.0, 0.25, 4.5, 5.0, 10.0]
    for hours in invalid_scopes:
        try:
            task = manage_task("create",
                project_id=PROJECT_ID,  # CRASH RECOVERY
                title=f"Test task {hours}hr",
                assignee="ui-implementation-expert",
                estimated_hours=hours
            )
            raise AssertionError(f"❌ Invalid scope {hours}hr was accepted!")
        except ValueError:
            print(f"✅ Invalid scope {hours}hr correctly rejected")

test_scope_validation()
```

---

## Agent Collaboration Patterns

### Pattern 1: Research → Implementation

```python
# Researcher finds patterns
research_task = manage_task("create",
    project_id=PROJECT_ID,  # CRASH RECOVERY
    title="Research: Authentication patterns",
    assignee="library-researcher",
    estimated_hours=1.0
)

# Expert implements based on research
impl_task = manage_task("create",
    project_id=PROJECT_ID,  # CRASH RECOVERY
    title="Implement: JWT authentication",
    assignee="backend-api-expert",
    estimated_hours=2.5,
    dependencies=[research_task['task']['id']]
)
```

### Pattern 2: Architecture → Parallel Implementation

```python
# Architect designs system
arch_task = manage_task("create",
    project_id=PROJECT_ID,  # CRASH RECOVERY
    title="Design: Payment system",
    assignee="architect",
    estimated_hours=2.0
)

# Frontend and backend implement in parallel
frontend_task = manage_task("create",
    project_id=PROJECT_ID,  # CRASH RECOVERY
    title="Implement: Payment UI",
    assignee="ui-implementation-expert",
    estimated_hours=3.0,
    dependencies=[arch_task['task']['id']]
)

backend_task = manage_task("create",
    project_id=PROJECT_ID,  # CRASH RECOVERY
    title="Implement: Payment API",
    assignee="backend-api-expert",
    estimated_hours=3.5,
    dependencies=[arch_task['task']['id']]
)

# Integration expert connects them
integration_task = manage_task("create",
    project_id=PROJECT_ID,  # CRASH RECOVERY
    title="Integrate: Stripe payment gateway",
    assignee="integration-expert",
    estimated_hours=2.0,
    dependencies=[frontend_task['task']['id'], backend_task['task']['id']]
)
```

### Pattern 3: Implementation → Quality

```python
# Expert implements feature
impl_task = manage_task("create",
    project_id=PROJECT_ID,  # CRASH RECOVERY
    title="Implement: User dashboard",
    assignee="ui-implementation-expert",
    estimated_hours=3.5
)

# Testing expert validates
test_task = manage_task("create",
    project_id=PROJECT_ID,  # CRASH RECOVERY
    title="Test: Dashboard E2E tests",
    assignee="testing-expert",
    estimated_hours=2.0,
    dependencies=[impl_task['task']['id']]
)

# Performance expert optimizes
perf_task = manage_task("create",
    project_id=PROJECT_ID,  # CRASH RECOVERY
    title="Optimize: Dashboard performance",
    assignee="performance-expert",
    estimated_hours=1.5,
    dependencies=[test_task['task']['id']]
)

# Documentation expert documents
docs_task = manage_task("create",
    project_id=PROJECT_ID,  # CRASH RECOVERY
    title="Document: Dashboard usage guide",
    assignee="documentation-expert",
    estimated_hours=1.0,
    dependencies=[perf_task['task']['id']]
)
```

---

**Last Updated:** 2025-12-25
**Maintainer:** SportERP Team
**Character Count:** ~8,400

**Back to**: `@.claude/CLAUDE.md` (Main documentation)
**See also**: `@.claude/docs/BEST_PRACTICES.md` (Task validation, agent assignment)
