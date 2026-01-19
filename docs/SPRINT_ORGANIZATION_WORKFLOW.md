# Sprint Organization Workflow - Quick Start Guide

**Project:** Jira-Like PM Upgrade
**Project ID:** `ec21abac-6631-4a5d-bbf1-e7eca9dfe833`
**Estimated Time:** 15-20 minutes

---

## Overview

This guide walks you through organizing the 182 tasks in the Jira-Like PM Upgrade project into 7 logical sprints for better visibility and tracking.

---

## Prerequisites

✅ **Sprint creation feature implemented** (Phase 3.1-3.7 complete)
✅ **Timeline view available** (can visualize sprints)
✅ **Archon UI running** at http://localhost:3738
✅ **Backend API running** at http://localhost:8181

---

## Step 1: Create Sprints (via UI)

### Option A: Manual Creation (Recommended for Learning)

1. **Navigate to project:**
   ```
   http://localhost:3738/projects/ec21abac-6631-4a5d-bbf1-e7eca9dfe833
   ```

2. **Create 7 sprints** using the "New Sprint" button (or keyboard shortcut `Cmd+Shift+S` / `Ctrl+Shift+S`):

   **Sprint 1: Foundation & Database**
   - **Goal:** Implement database migrations, workflow system backend, and core sprint infrastructure
   - **Start Date:** 2026-01-15
   - **End Date:** 2026-01-29
   - **Status:** Completed (all tasks done)

   **Sprint 2: Workflow System UI**
   - **Goal:** Build dynamic workflow stages, board view, project type selector, and stage transitions
   - **Start Date:** 2026-01-29
   - **End Date:** 2026-02-12
   - **Status:** Completed (all tasks done)

   **Sprint 3: Sprint Management & UX** ⭐ **CURRENT SPRINT**
   - **Goal:** Complete sprint CRUD operations, inline creation, status transitions, and E2E tests
   - **Start Date:** 2026-02-12
   - **End Date:** 2026-02-26
   - **Status:** Active

   **Sprint 4: Enhanced Views**
   - **Goal:** Build timeline view, project hierarchy, burndown charts, calendar view, and summary dashboard
   - **Start Date:** 2026-02-26
   - **End Date:** 2026-03-19
   - **Status:** Planned

   **Sprint 5: Teams & Knowledge**
   - **Goal:** Implement team management, knowledge linking, AI suggestions, and agent assignment
   - **Start Date:** 2026-03-19
   - **End Date:** 2026-04-02
   - **Status:** Planned

   **Sprint 6: Analytics & Reports**
   - **Goal:** Build project health dashboard, task metrics, workflow analytics, and reporting system
   - **Start Date:** 2026-04-02
   - **End Date:** 2026-04-16
   - **Status:** Planned

   **Sprint 7: Polish & Admin**
   - **Goal:** Admin features, performance optimization, documentation, comprehensive testing, and final polish
   - **Start Date:** 2026-04-16
   - **End Date:** 2026-04-30
   - **Status:** Planned

### Option B: Bulk Creation (via cURL script)

See `docs/SPRINT_ORGANIZATION_STRATEGY.md` for the complete cURL script. Requires authentication token.

---

## Step 2: Organize Tasks into Sprints

Once sprints are created, run the batch assignment script:

```bash
cd ~/Documents/Projects/archon
./scripts/organize-pm-sprint-tasks.sh
```

**What the script does:**
- Fetches all 182 tasks from the project
- Matches tasks to sprints based on phase prefix (Phase 1.x → Sprint 1, etc.)
- Updates `task.sprint_id` for each task
- Updates `task.feature` tag to match sprint name
- Provides summary of assignments

**Expected Output:**
```
======================================
 Sprint Organization Script
 Project: Jira-Like PM Upgrade
======================================

📋 Fetching sprints...
✅ Found 7 sprint(s)

Sprint IDs:
  Sprint 1: abc-123...
  Sprint 2: def-456...
  ...

📋 Fetching tasks...
✅ Found 182 task(s)

🔧 Assigning tasks to Sprint 1: Foundation & Database...
  ✅ Assigned 35 task(s) to Sprint 1: Foundation & Database
🔧 Assigning tasks to Sprint 2: Workflow System UI...
  ✅ Assigned 18 task(s) to Sprint 2: Workflow System UI
...

======================================
 ✅ Sprint Organization Complete!
======================================
```

---

## Step 3: Verify Organization

### Kanban View (Group by Sprint)

1. Navigate to project
2. Switch to **Kanban** view
3. **Group by:** Sprint (if available in view settings)
4. You should see sprint lanes with tasks organized under each

### Timeline View (Visual Gantt Chart)

1. Navigate to project
2. Switch to **Timeline** view (4th button in view toggle)
3. You should see:
   - Sprint 1-7 as summary rows (lanes)
   - Tasks nested under each sprint
   - Date ranges visualized
   - Backlog lane for unassigned tasks

### List View (Filter by Sprint)

1. Navigate to **Tasks** page: http://localhost:3738/tasks
2. Use **Filter** dropdown → **Sprint** → Select a sprint
3. See all tasks for that sprint

---

## Step 4: Start Active Sprint

Once organization is complete, mark Sprint 3 as active:

1. Navigate to project
2. Find Sprint 3 in sprint list or timeline
3. Click **"Start Sprint"** action
4. Sprint status changes from `planned` → `active`
5. Tasks in Sprint 3 become your current work

---

## Task Distribution Summary

| Sprint | Total Tasks | Done | Backlog | Completion % |
|--------|-------------|------|---------|--------------|
| Sprint 1: Foundation | 35 | 35 | 0 | 100% ✅ |
| Sprint 2: Workflow UI | 18 | 16 | 2 | 89% ⚡ |
| Sprint 3: Sprint UX | 15 | 12 | 3 | 80% ⚡ |
| Sprint 4: Enhanced Views | 46 | 2 | 44 | 4% |
| Sprint 5: Teams & Knowledge | 18 | 0 | 18 | 0% |
| Sprint 6: Analytics & Reports | 15 | 0 | 15 | 0% |
| Sprint 7: Polish & Admin | 23 | 0 | 23 | 0% |
| Unassigned | 12 | 3 | 9 | 25% |
| **Total** | **182** | **68** | **114** | **37%** |

---

## MCP Integration (Coming Soon)

**Status:** Sprint management is **NOT YET** available in Archon MCP tools.

**Task Created:** "Add sprint management tools to Archon MCP server" (Task ID: b5f53bd5-1d93-41bb-835a-20beb8b1dcdc)

**When Complete:**
- Claude Code can create sprints programmatically via MCP
- Use `manage_sprint` tool to create/update/delete sprints
- Use `find_sprints` tool to list sprints by project
- Use `sprint_lifecycle_actions` tool to start/complete sprints

---

## Benefits

✅ **Clear Visibility:** See sprint progress in Kanban and Timeline views
✅ **Logical Grouping:** Related features grouped together
✅ **Manageable Scope:** 15-46 tasks per sprint
✅ **Testable Milestones:** Each sprint has clear deliverables
✅ **Jira-Like Experience:** Sprint lanes, timeline visualization, burndown charts

---

## Troubleshooting

**Problem:** Script says "No sprints found"
**Solution:** Create sprints via UI first (Step 1)

**Problem:** Tasks not showing in sprint lanes
**Solution:** Refresh page, check that `task.sprint_id` is set (inspect in browser DevTools or API)

**Problem:** Timeline view not loading
**Solution:** Check browser console for errors, ensure SVAR React Gantt is installed (`npm install @svar-ui/react-gantt`)

**Problem:** Can't create sprints via UI
**Solution:** Check `CreateSprintModal` is imported and working, check browser console for errors

---

## Next Steps

1. ✅ **Create sprints** (Step 1)
2. ✅ **Run organization script** (Step 2)
3. ✅ **Verify in views** (Step 3)
4. ⏳ **Start Sprint 3** (Step 4)
5. ⏳ **Implement MCP sprint tools** (see task b5f53bd5...)
6. ⏳ **Continue with Timeline View Phase 3.8-3.11**

---

**Quick Links:**
- **Strategy Doc:** `docs/SPRINT_ORGANIZATION_STRATEGY.md`
- **Organization Script:** `scripts/organize-pm-sprint-tasks.sh`
- **Project URL:** http://localhost:3738/projects/ec21abac-6631-4a5d-bbf1-e7eca9dfe833
- **Timeline View:** http://localhost:3738/projects/ec21abac-6631-4a5d-bbf1-e7eca9dfe833 (switch to Timeline tab)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
**Estimated Completion Time:** 15-20 minutes
