# Sprint Organization Strategy - Jira-Like PM Upgrade Project

**Project ID:** `ec21abac-6631-4a5d-bbf1-e7eca9dfe833`
**Total Tasks:** 182 tasks
**Organization Date:** 2026-01-19
**Sprint Duration:** 2-3 weeks per sprint

---

## Overview

This document outlines the sprint organization for the Jira-Like PM Upgrade project. Tasks are grouped into 7 logical sprints based on their phase prefix and functional dependencies.

---

## Sprint Structure

### Sprint 1: Foundation & Database
**Duration:** 2 weeks (Jan 15 - Jan 29, 2026)
**Goal:** Implement database migrations, workflow system backend, and core sprint infrastructure
**Status:** COMPLETED (all tasks done)

**Tasks (Phase 1.1-1.9 + Backend Infrastructure):**
- Phase 1.1-1.4: Database migrations (status→workflow_stage_id)
- Phase 1.5-1.9: API endpoints and validation
- Backend infrastructure tasks (done):
  - Create archon_sprints table migration
  - Create archon_workflows and archon_workflow_stages tables migration
  - Create archon_project_types table migration
  - Create archon_teams and archon_team_members tables migration
  - Create archon_time_logs table migration
  - Create archon_knowledge_links table migration
  - Create archon_project_hierarchy table migration
  - Install PostgreSQL ltree extension
  - Enhance archon_tasks table with sprint and workflow fields
  - Implement SprintService backend class
  - Implement WorkflowService backend class
  - Implement TeamService backend class
  - Implement ProjectHierarchyService backend class
  - Implement ReportingService
  - Implement KnowledgeLinkingService
  - Create API endpoints for sprints, workflows, reporting, knowledge linking
  - Integrate Casbin for RBAC
  - Add Casbin permission checks to API endpoints
  - Enhance MCP server with knowledge linking tools

**Feature Tag:** `Sprint 1: Foundation`

---

### Sprint 2: Workflow System UI
**Duration:** 2 weeks (Jan 29 - Feb 12, 2026)
**Goal:** Build dynamic workflow stages, board view, project type selector, and stage transitions
**Status:** COMPLETED (all tasks done)

**Tasks (Phase 2.1-2.16):**
- Phase 2.1-2.4: WorkflowStageSelector, StageTransitionButton, dynamic BoardView
- Phase 2.5-2.8: SprintBoard, SprintBacklog, sprint assignment in tasks
- Phase 2.9-2.13: ProjectTypeSelector, workflow visualization
- Phase 2.14-2.16: API integration, optimistic UI updates

**Testing (Backlog):**
- Phase 2.17: E2E test - Stage transition workflow
- Phase 2.18: E2E test - Project type selection

**Feature Tag:** `Sprint 2: Workflow UI`

---

### Sprint 3: Sprint Management & UX
**Duration:** 2 weeks (Feb 12 - Feb 26, 2026)
**Goal:** Complete sprint CRUD operations, inline creation, status transitions, and E2E tests
**Status:** MOSTLY DONE (UX complete, tests in backlog)

**Tasks (Phase 1.10-1.19, Phase 3.1-3.7):**

**Completed:**
- Phase 1.10-1.19: SprintListView, CreateSprintModal, SprintCard, status indicators, lifecycle buttons, API integration
- Phase 3.1-3.5: Inline sprint creation in SprintSelector, quick create buttons, enhanced UX, TanStack Query, E2E tests
- Phase 3.6-3.7: Timeline library research, TimelineView component structure

**Backlog (Testing):**
- Phase 1.20: E2E test - Create sprint workflow
- Phase 1.21: E2E test - Sprint status transitions
- Phase 1.22: Unit tests - Sprint validation logic
- Phase 1.23: Integration test - Database migration safety

**Feature Tag:** `Sprint 3: Sprint UX`

---

### Sprint 4: Enhanced Views (Timeline, Hierarchy, Calendar, Summary)
**Duration:** 3 weeks (Feb 26 - Mar 19, 2026)
**Goal:** Build timeline view, project hierarchy, burndown charts, calendar view, and summary dashboard
**Status:** IN PROGRESS (Timeline started, rest in backlog)

**Tasks (Phase 3.6-3.28):**

**Timeline View (Phase 3.6-3.11):**
- ✅ Phase 3.6: Research timeline libraries (DONE - SVAR React Gantt selected)
- ✅ Phase 3.7: Build TimelineView component structure (DONE)
- Phase 3.8: Integrate timeline data (sprints + tasks) - **NEXT**
- Phase 3.9: Implement drag-and-drop for sprint reassignment
- Phase 3.10: Add timeline UI polish
- Phase 3.11: Timeline testing and performance optimization

**Calendar View (Phase 3.12-3.16):**
- Phase 3.12: Research and select calendar library
- Phase 3.13: Build CalendarView component with month/week/day views
- Phase 3.14: Integrate calendar data with task APIs
- Phase 3.15: Implement calendar interactivity and actions
- Phase 3.16: Calendar view testing and accessibility

**Summary Dashboard (Phase 3.17-3.20):**
- Phase 3.17: Build SummaryView dashboard component
- Phase 3.18: Integrate analytics APIs for summary dashboard
- Phase 3.19: Add visualizations to summary dashboard
- Phase 3.20: Summary dashboard testing and performance

**Knowledge View (Phase 3.21-3.24):**
- Phase 3.21: Build KnowledgeView component for document linking
- Phase 3.22: Integrate knowledge base APIs and RAG search
- Phase 3.23: Create KnowledgeItemCard display component
- Phase 3.24: Knowledge view testing and RAG performance

**View Navigation (Phase 3.25-3.28):**
- Phase 3.25: Create ViewSwitcher component with tab navigation
- Phase 3.26: Integrate ViewSwitcher into ProjectDetailView
- Phase 3.27: Implement view persistence and deep linking
- Phase 3.28: View navigation testing and keyboard shortcuts

**Project Hierarchy (Phase 3.1-3.17 - Old numbering):**
- Phase 3.1: Create ProjectHierarchyTree component
- Phase 3.2: Create AddSubprojectButton component
- Phase 3.3: Create SubprojectModal component
- Phase 3.4: Implement breadcrumb navigation component
- Phase 3.5: Add hierarchy badge to ProjectCard
- Phase 3.6: Add hierarchy path display in ProjectDetailView
- Phase 3.7-3.9: BurndownChart, VelocityChart, SprintSummary
- Phase 3.10-3.11: SprintReportPage, real-time burndown updates
- Phase 3.12-3.15: Hierarchy API integration, validation
- Phase 3.16-3.17: E2E tests for hierarchy and burndown

**Feature Tag:** `Sprint 4: Enhanced Views`

---

### Sprint 5: Teams & Knowledge Linking
**Duration:** 2 weeks (Mar 19 - Apr 2, 2026)
**Goal:** Implement team management, knowledge linking, AI suggestions, and agent assignment
**Status:** BACKLOG

**Tasks (Phase 4.1-4.18):**
- Phase 4.1-4.2: Add default_agent column, PUT endpoint for stage agent assignment
- Phase 4.3-4.8: TeamListView, CreateTeamModal, TeamMemberList, team assignment, filtering, WorkloadDashboard
- Phase 4.9-4.13: KnowledgeLinkPanel, LinkKnowledgeModal, KnowledgeItemCard, AI suggestions display, task detail integration
- Phase 4.14-4.16: API integration for teams, knowledge linking, AI suggestions
- Phase 4.17-4.18: E2E tests for teams and knowledge linking

**Feature Tag:** `Sprint 5: Teams & Knowledge`

---

### Sprint 6: Analytics & Reports
**Duration:** 2 weeks (Apr 2 - Apr 16, 2026)
**Goal:** Build project health dashboard, task metrics, workflow analytics, and reporting system
**Status:** BACKLOG

**Tasks (Phase 5.1-5.15):**
- Phase 5.1-5.5: ProjectHealthDashboard, TaskMetricsView, WorkflowDistributionChart, TeamPerformanceReport, CSV export
- Phase 5.6-5.10: WorkflowSelector, WorkflowVisualization flowchart, WorkflowConfigPanel, StageAgentAssignment, workflow cloning
- Phase 5.11-5.13: Health API integration, workflow selector API, agent assignment API
- Phase 5.14-5.15: E2E tests for health dashboard and workflow changes

**Feature Tag:** `Sprint 6: Analytics & Reports`

---

### Sprint 7: Polish, Performance & Documentation
**Duration:** 2 weeks (Apr 16 - Apr 30, 2026)
**Goal:** Admin features, performance optimization, documentation, comprehensive testing, and final polish
**Status:** BACKLOG

**Tasks (Phase 6.1-6.23):**

**Admin Features (Phase 6.1-6.5):**
- SystemHealthDashboard, AuditLogViewer, WorkflowAnalytics, UserManagementPanel, admin navigation

**Testing (Phase 6.6-6.10):**
- E2E tests for complete sprint lifecycle, workflow transitions, deep hierarchy, multi-user collaboration, load testing

**Documentation (Phase 6.11-6.14):**
- User guides for sprint management, workflow configuration, project hierarchy
- Video tutorial for sprint board workflow

**Performance (Phase 6.15-6.20):**
- Lazy loading, virtualized scrolling, optimized burndown rendering
- Loading states, error boundaries, empty states

**Security & Final Testing (Phase 6.21-6.23):**
- Security audit, input validation audit, final integration test suite

**Feature Tag:** `Sprint 7: Polish & Admin`

---

## Task Assignment Matrix

### By Sprint

| Sprint | Total Tasks | Done | In Progress | Backlog | Completion % |
|--------|-------------|------|-------------|---------|--------------|
| Sprint 1 | 35 | 35 | 0 | 0 | 100% |
| Sprint 2 | 18 | 16 | 0 | 2 | 89% |
| Sprint 3 | 15 | 12 | 0 | 3 | 80% |
| Sprint 4 | 46 | 2 | 0 | 44 | 4% |
| Sprint 5 | 18 | 0 | 0 | 18 | 0% |
| Sprint 6 | 15 | 0 | 0 | 15 | 0% |
| Sprint 7 | 23 | 0 | 0 | 23 | 0% |
| **Unassigned** | 12 | 3 | 0 | 9 | 25% |
| **Total** | **182** | **68** | **0** | **114** | **37%** |

---

## Implementation Script

### Create Sprints (requires authentication)

```bash
#!/bin/bash
# Run this script from archon project root
# Requires: authenticated session or API token

PROJECT_ID="ec21abac-6631-4a5d-bbf1-e7eca9dfe833"
API_BASE="http://localhost:8181/api/projects/$PROJECT_ID/sprints"

# Sprint 1 (COMPLETED)
curl -X POST "$API_BASE" -H "Content-Type: application/json" -d '{
  "name": "Sprint 1: Foundation & Database",
  "goal": "Implement database migrations, workflow system backend, and core sprint infrastructure",
  "start_date": "2026-01-15",
  "end_date": "2026-01-29",
  "status": "completed"
}'

# Sprint 2 (COMPLETED)
curl -X POST "$API_BASE" -H "Content-Type: application/json" -d '{
  "name": "Sprint 2: Workflow System UI",
  "goal": "Build dynamic workflow stages, board view, project type selector, and stage transitions",
  "start_date": "2026-01-29",
  "end_date": "2026-02-12",
  "status": "completed"
}'

# Sprint 3 (ACTIVE)
curl -X POST "$API_BASE" -H "Content-Type: application/json" -d '{
  "name": "Sprint 3: Sprint Management & UX",
  "goal": "Complete sprint CRUD operations, inline creation, status transitions, and E2E tests",
  "start_date": "2026-02-12",
  "end_date": "2026-02-26",
  "status": "active"
}'

# Sprint 4 (PLANNED)
curl -X POST "$API_BASE" -H "Content-Type: application/json" -d '{
  "name": "Sprint 4: Enhanced Views",
  "goal": "Build timeline view, project hierarchy, burndown charts, calendar view, and summary dashboard",
  "start_date": "2026-02-26",
  "end_date": "2026-03-19",
  "status": "planned"
}'

# Sprint 5 (PLANNED)
curl -X POST "$API_BASE" -H "Content-Type: application/json" -d '{
  "name": "Sprint 5: Teams & Knowledge",
  "goal": "Implement team management, knowledge linking, AI suggestions, and agent assignment",
  "start_date": "2026-03-19",
  "end_date": "2026-04-02",
  "status": "planned"
}'

# Sprint 6 (PLANNED)
curl -X POST "$API_BASE" -H "Content-Type: application/json" -d '{
  "name": "Sprint 6: Analytics & Reports",
  "goal": "Build project health dashboard, task metrics, workflow analytics, and reporting system",
  "start_date": "2026-04-02",
  "end_date": "2026-04-16",
  "status": "planned"
}'

# Sprint 7 (PLANNED)
curl -X POST "$API_BASE" -H "Content-Type: application/json" -d '{
  "name": "Sprint 7: Polish & Admin",
  "goal": "Admin features, performance optimization, documentation, comprehensive testing, and final polish",
  "start_date": "2026-04-16",
  "end_date": "2026-04-30",
  "status": "planned"
}'
```

---

## MCP Integration Requirement

**User Request:** "make sure that the sprints are available in archon mcp as well, as this will be very important feature!"

**Current Status:** Sprint management is **NOT** currently available in Archon MCP tools.

**Required MCP Tools:**
1. `manage_sprint` - Create, update, delete sprints
2. `find_sprints` - List and search sprints by project
3. `get_sprint` - Get detailed sprint information
4. `sprint_actions` - Start, complete, cancel sprints

**Implementation Task Created:** See task below for adding sprint management to MCP.

---

## Next Steps

1. ✅ **Document sprint organization** (THIS FILE)
2. ⏳ **Create sprints via UI** - User can manually create sprints using CreateSprintModal
3. ⏳ **Batch assign tasks to sprints** - Script to update task.sprint_id for all 182 tasks
4. ⏳ **Implement MCP sprint tools** - Add sprint management to Archon MCP server
5. ⏳ **Update task feature tags** - Align feature field with sprint names

---

## Benefits of This Organization

**✅ Clear progression:** Each sprint builds on the previous
**✅ Logical grouping:** Related features grouped together
**✅ Manageable scope:** 15-46 tasks per sprint
**✅ Testable milestones:** Each sprint has clear deliverables
**✅ Visibility:** Can see progress in Kanban (by sprint), Timeline (by date range), and Summary views

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
**Maintained By:** Archon Development Team
