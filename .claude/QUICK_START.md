# Archon Quick Start (30 seconds)

## 🚨 CRITICAL RULES (Top 5)

1. **❌ NO TodoWrite** → Use `mcp__archon__manage_task()` instead
2. **✅ CHECK Archon First**: `curl localhost:8051/health` (must be running)
3. **✅ ALWAYS include project_id** in tasks (crash recovery requirement)
4. **✅ Complex work (>2hr)?** → Create planner task FIRST
5. **✅ Dangerous operation?** → Backup FIRST, approval REQUIRED

## First Task Template (Copy-Paste)

```python
# Step 1: Check Archon is running
curl localhost:8051/health  # Must return {"status":"healthy"}

# Step 2: Find or create project
projects = find_projects(query="feature name")
if not projects:
    project = manage_project("create",
        title="Feature: Name",
        description="Clear scope and goals"
    )
    project_id = project['project']['id']
else:
    project_id = projects[0]['id']

# Step 3a: Simple work (<2hr, known solution) - Direct task
task = manage_task("create",
    project_id=project_id,  # ← CRASH RECOVERY
    title="Implement user profile page",
    description="Add profile page with avatar and bio",
    assignee="ui-implementation-expert",  # See agent list
    estimated_hours=1.5,
    status="doing"
)

# Step 3b: Complex work (>2hr, unknown scope) - Planner task
planning_task = manage_task("create",
    project_id=project_id,  # ← CRASH RECOVERY
    title="Plan: User profile system implementation",
    description="Analyze codebase, research libraries, create task breakdown",
    assignee="planner",  # Planner creates validated subtasks
    estimated_hours=1.5,
    status="doing"
)
```

## Agent Quick Selection

- **planner** - Complex work (>2hr), unknown requirements
- **architect** - System design, tech decisions
- **ui-implementation-expert** - Frontend UI components
- **backend-api-expert** - Backend APIs, business logic
- **database-expert** - Schema, migrations, queries
- **testing-expert** - Test strategy, coverage

**Full agent list & decision tree**: `.claude/CLAUDE.md` → Agent Quick Reference

## Common Operations

```python
# List tasks
tasks = find_tasks(project_id="<uuid>")
tasks = find_tasks(filter_by="status", filter_value="todo")

# Update task status
manage_task("update", task_id="<uuid>", status="doing")
manage_task("update", task_id="<uuid>", status="done")

# Get task history
history = get_task_history(task_id="<uuid>")

# Archive completed project
archive_project(project_id="<uuid>", archived_by="User")
```

## Enforcement

**Hooks protect you from:**
- ❌ TodoWrite usage (BLOCKED by hook)
- ⚠️  Tasks without project_id (WARNING + ask)
- ⚠️  Dangerous operations without backup (BLOCKED)

**See violations?** → `.claude/CLAUDE.md` → Violation Recovery Procedures

---

**Full Documentation**: `.claude/CLAUDE.md` (27k chars, comprehensive guide)
**Detailed References**: `.claude/docs/` (12 files, deep dives)
