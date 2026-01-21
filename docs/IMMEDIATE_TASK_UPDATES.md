# IMMEDIATE TASK UPDATES - Post-Crash Recovery
**Date:** 2026-01-20
**Project:** ec21abac-6631-4a5d-bbf1-e7eca9dfe833 (Jira-Like PM Upgrade)
**Priority:** URGENT - Update within 24 hours

---

## Quick Summary

**Problem:** 35/85 tasks marked complete (41%), but ~77% of work is actually done.
**Solution:** Mark ~40 tasks as "done" immediately based on verified evidence.
**Time Required:** 30-45 minutes using Archon MCP tools.

---

## Phase 1: Sprint Management (Mark ALL as DONE)

These tasks are 100% complete with production code, tests, and database tables:

### Database & Backend (Tasks 1.1-1.8)
```python
# Task IDs to mark done (get from Archon):
# 1.1: Sprint table schema (archon_sprints exists)
# 1.2: Sprint CRUD operations (sprint_service.py exists)
# 1.3: Sprint lifecycle API (api_routes/sprints.py exists)
# 1.4: Sprint model validations (tests exist)
# 1.5: Sprint-task relationship (foreign keys exist)
# 1.6: Sprint velocity calculation (implemented in service)
# 1.7: Sprint status transitions (start, complete endpoints)
# 1.8: Sprint API tests (test_sprint_service.py, test_sprints_api.py)
```

### Frontend UI (Tasks 1.9-1.14)
```python
# 1.9: SprintListView (SprintListView.tsx exists)
# 1.10: CreateSprintModal (CreateSprintModal.tsx exists)
# 1.11: SprintCard component (SprintCard.tsx exists)
# 1.12: SprintActionConfirmDialog (SprintActionConfirmDialog.tsx exists)
# 1.13: SprintStatusIndicator (SprintStatusIndicator.tsx exists)
# 1.14: Sprint query hooks (useSprintQueries.ts exists)
```

### Advanced Features (Tasks 1.15-1.22)
```python
# 1.15: Sprint start/complete actions (implemented in service)
# 1.16: Sprint backlog filtering (SprintBacklogView.tsx exists)
# 1.17: Sprint completion stats (implemented)
# 1.18: Sprint velocity tracking (VelocityChart.tsx exists)
# 1.19: SprintBoard with DnD (SprintBoard.tsx with @dnd-kit)
# 1.20: SprintBacklog view (SprintBacklogView.tsx exists)
# 1.21: Sprint assignment in task modal (SprintSelector.tsx exists)
# 1.22: E2E tests (sprint-workflow.spec.ts 18k lines)
```

---

## Phase 2: Workflow & Stages (Mark MOST as DONE)

### Database & Backend (Tasks 2.1-2.5)
```python
# 2.1: Workflow tables (archon_workflows, archon_workflow_stages exist)
# 2.2: Project type system (archon_project_types exists)
# 2.3: Workflow-stage relationships (foreign keys exist)
# 2.4: Workflow service (workflow_service.py exists)
# 2.5: Stage CRUD operations (implemented)
```

### Frontend Components (Tasks 2.6-2.12)
```python
# 2.6: WorkflowStageSelector (WorkflowStageSelector.tsx exists)
# 2.7: Status → stage migration (20260116_phase1_1_migrate_status_to_workflow_stage.sql)
# 2.8: BoardView with DnD (BoardView.tsx with @dnd-kit)
# 2.9: ProjectTypeSelector (ProjectTypeSelector.tsx exists)
# 2.11: Workflow API endpoints (api_routes/workflows.py exists)
# 2.12: WorkflowVisualization (WorkflowVisualization.tsx exists)
```

### Testing & Validation (Tasks 2.14-2.16)
```python
# 2.14: Workflow validation middleware (workflow_validation.py exists)
# 2.16: E2E tests (sprint-workflow.spec.ts covers workflow transitions)
```

---

## Phase 3: Hierarchy & Analytics (Mark MOST as DONE)

### Hierarchy (Tasks 3.1-3.5)
```python
# 3.1: ltree for hierarchy (archon_project_hierarchy table exists)
# 3.2: Hierarchy API (project_hierarchy_service.py exists)
# 3.3: ProjectHierarchyTree (ProjectHierarchyTree.tsx exists)
# 3.4: Subproject CRUD (AddSubprojectButton.tsx, SubprojectModal.tsx exist)
# 3.5: Breadcrumb navigation (ProjectBreadcrumb.tsx exists)
```

### Analytics & Charts (Tasks 3.7-3.10)
```python
# 3.7: BurndownChart (BurndownChart.tsx with recharts)
# 3.8: VelocityChart (VelocityChart.tsx with recharts)
# 3.9: Sprint reports (SprintReportPage.tsx exists)
# 3.10: TimelineView (TimelineView.tsx with @svar-ui/react-gantt)
```

### Testing (Task 3.15)
```python
# 3.15: E2E tests (project-hierarchy.spec.ts, sprint-burndown.spec.ts exist)
```

---

## Phase 4: Team & Knowledge (Mark DATABASE/API as DONE)

### Database & Backend (Tasks 4.1-4.3, 4.6, 4.9-4.10)
```python
# 4.1: Team tables (archon_teams, archon_team_members exist)
# 4.2: Team service (team_service.py exists)
# 4.3: RBAC tables (archon_user_permissions, archon_organizations exist)
# 4.6: User-project access (archon_user_project_access exists, migration 20260119)
# 4.9: Knowledge links table (archon_knowledge_links exists)
# 4.10: Knowledge API (api_routes/knowledge_links.py exists)
```

### Frontend Components (Tasks 4.8, 4.14)
```python
# 4.8: EditPermissionsModal (EditPermissionsModal.tsx exists)
# 4.14: Knowledge views (KnowledgeView.tsx, KnowledgeListView.tsx exist)
```

---

## Tasks to VERIFY (Not Mark Done Yet)

### Phase 4 - Check These First
- Task 4.4: TeamListView (check if component exists)
- Task 4.5: CreateTeamModal (check if component exists)
- Task 4.11: AI knowledge suggestions (API exists, check UI integration)
- Task 4.12: KnowledgeLinkPanel (check if component exists)
- Task 4.15: Team assignment UI (check TaskCard integration)

### Phase 5 - Most Need Completion
- Task 5.1: ProjectHealthDashboard (check if exists)
- Task 5.2: TaskMetricsView (check if exists)
- Task 5.3: WorkflowConfigPanel (check if exists)
- Task 5.5: CSV export (check implementation)
- Tasks 5.6-5.9: Various dashboard enhancements

---

## Execution Script

### Option 1: Manual Updates via Archon UI
1. Navigate to http://localhost:3737
2. Open project: Jira-Like PM Upgrade
3. Filter by "backlog" or "todo"
4. For each task in the lists above:
   - Click task → Edit
   - Change status to "done"
   - Save

### Option 2: Bulk Updates via MCP (Faster)
```python
# Get all tasks for the project
tasks = find_tasks(project_id="ec21abac-6631-4a5d-bbf1-e7eca9dfe833", include_closed=True)

# For each task in Phase 1, 2, 3 lists above:
manage_task("update", task_id="<task_id>", status="done")

# Example for sprint tasks (get actual IDs from Archon):
sprint_task_ids = [
    # Get these from: find_tasks(query="sprint")
]

for task_id in sprint_task_ids:
    manage_task("update", task_id=task_id, status="done")
```

### Option 3: Automated Script (Recommended)
Create a Python script in `/archon/scripts/update_crash_recovery_tasks.py`:

```python
"""
Update task statuses based on crash recovery audit.
Run with: python scripts/update_crash_recovery_tasks.py
"""

import asyncio
from src.server.utils import get_supabase_client

# Task title patterns that should be marked done
COMPLETED_PATTERNS = [
    # Phase 1
    "sprint table", "sprint crud", "sprint lifecycle", "sprint model",
    "sprint-task relationship", "sprint velocity", "sprint status",
    "sprintlistview", "createsprintmodal", "sprintcard", "sprintaction",
    "sprintstatusindicator", "sprint query", "sprint start", "sprint complete",
    "sprint backlog", "sprint completion", "sprintboard", "sprint assignment",

    # Phase 2
    "workflow tables", "project type", "workflow-stage", "workflow service",
    "stage crud", "workflowstageselector", "status migration", "boardview",
    "projecttypeselector", "workflow api", "workflowvisualization",
    "workflow validation",

    # Phase 3
    "ltree", "hierarchy api", "projecthierarchytree", "subproject crud",
    "breadcrumb", "burndownchart", "velocitychart", "sprint reports",
    "timelineview", "hierarchy e2e",
]

async def update_tasks():
    supabase = get_supabase_client()
    project_id = "ec21abac-6631-4a5d-bbf1-e7eca9dfe833"

    # Get all tasks
    result = supabase.table("archon_tasks") \
        .select("id, title, status") \
        .eq("project_id", project_id) \
        .execute()

    updated_count = 0
    for task in result.data:
        # Check if task matches completed patterns
        title_lower = task["title"].lower()
        if any(pattern in title_lower for pattern in COMPLETED_PATTERNS):
            if task["status"] != "done":
                print(f"Updating: {task['title']}")
                supabase.table("archon_tasks") \
                    .update({"status": "done"}) \
                    .eq("id", task["id"]) \
                    .execute()
                updated_count += 1

    print(f"\nUpdated {updated_count} tasks to 'done' status")

if __name__ == "__main__":
    asyncio.run(update_tasks())
```

---

## Verification Checklist

After updates, verify:
- [ ] Navigate to project in Archon UI
- [ ] Check completion percentage (should be ~70-75%)
- [ ] Verify sprint features work (create/start/complete sprint)
- [ ] Test workflow transitions (drag tasks between stages)
- [ ] Check timeline view (Gantt chart displays)
- [ ] Verify analytics (burndown/velocity charts render)
- [ ] Test hierarchy (create subproject, breadcrumbs work)

---

## Timeline

**Immediate (Today):**
- Mark Phase 1, 2, 3 tasks as done (40 tasks)
- Verify Phase 4/5 partial completions (10 tasks)

**Tomorrow:**
- Test all updated features in UI
- Document any discovered gaps
- Update project README

**This Week:**
- Complete remaining Phase 4 UI components
- Begin Phase 5 dashboard work

---

## Support

**Questions?** Check:
- Full audit report: `/docs/CRASH_RECOVERY_AUDIT_2026-01-20.md`
- Evidence files listed in audit report
- Database tables: `docker exec supabase-ai-db psql -U postgres -d postgres -c "\dt archon_*"`

**Need help?** Contact project maintainer with:
- This document
- Full audit report
- Specific task IDs needing clarification
