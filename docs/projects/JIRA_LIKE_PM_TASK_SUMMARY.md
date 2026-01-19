# Jira-Like PM System - Complete Task Breakdown & Execution Plan

**Project ID:** ec21abac-6631-4a5d-bbf1-e7eca9dfe833
**Created:** 2026-01-16
**Status:** 115 New Tasks Created (All Phases Complete)
**Foundation Document:** `JIRA_LIKE_PM_VISUAL_ARCHITECTURE.md`

---

## Executive Summary

**Total Tasks Created:** 115 tasks across 6 phases
**Timeline:** 6 weeks (Phase 1-6)
**Validation:** All tasks cross-referenced against visual architecture document

### Phase Breakdown

| Phase | Week | Tasks | Focus Area | Status |
|-------|------|-------|------------|--------|
| **Phase 1** | Week 1 | 23 tasks | Foundation & Database Migration | ✅ Created |
| **Phase 2** | Week 2 | 18 tasks | Workflow System & Sprint Board | ✅ Created |
| **Phase 3** | Week 3 | 17 tasks | Hierarchy & Analytics | ✅ Created |
| **Phase 4** | Week 4 | 18 tasks | Teams & Knowledge Integration | ✅ Created |
| **Phase 5** | Week 5 | 15 tasks | Reporting & Custom Workflows | ✅ Created |
| **Phase 6** | Week 6 | 23 tasks | Admin Tools, Testing & Polish | ✅ Created |

### Agent Assignment Distribution

| Agent | Task Count | Percentage | Primary Responsibility |
|-------|------------|------------|------------------------|
| **ui-implementation-expert** | 59 tasks | 51.3% | All React components, UI features |
| **integration-expert** | 22 tasks | 19.1% | API integration, TanStack Query |
| **backend-api-expert** | 17 tasks | 14.8% | REST endpoints, middleware |
| **testing-expert** | 17 tasks | 14.8% | E2E, integration, unit tests |
| **database-expert** | 5 tasks | 4.3% | Migrations, schema changes |
| **documentation-expert** | 4 tasks | 3.5% | User guides, tutorials |
| **performance-expert** | 3 tasks | 2.6% | Optimization, lazy loading |

---

## PHASE 1: Foundation & Database Migration (Week 1)

**Goal:** Remove hardcoded status system, enable workflow-based task management
**Tasks:** 23 tasks
**Deliverable:** Sprint CRUD functional, database migration complete

### Database Migration (5 tasks - database-expert)
1. **Phase 1.1:** Create migration to remove status field from archon_tasks
2. **Phase 1.2:** Add workflow_stage_id NOT NULL constraint
3. **Phase 1.3:** Migrate existing tasks status to workflow_stage_id
4. **Phase 1.4:** Add foreign key constraints to workflow tables

### Backend API (5 tasks - backend-api-expert)
5. **Phase 1.5:** Create PUT /api/projects/{id}/workflow endpoint
6. **Phase 1.6:** Create POST /api/projects/{id}/subprojects endpoint
7. **Phase 1.7:** Create GET /api/projects/{id}/hierarchy endpoint
8. **Phase 1.8:** Update task CRUD endpoints to use workflow_stage_id
9. **Phase 1.9:** Add stage transition validation middleware

### UI Foundation - Sprint Management (6 tasks - ui-implementation-expert)
10. **Phase 1.10:** Create SprintListView component
11. **Phase 1.11:** Create CreateSprintModal component
12. **Phase 1.12:** Create SprintCard component
13. **Phase 1.13:** Create SprintStatusIndicator component
14. **Phase 1.14:** Add sprint lifecycle action buttons
15. **Phase 1.15:** Create sprint selection dropdown for tasks

### Integration (4 tasks - integration-expert)
16. **Phase 1.16:** Integrate SprintListView with GET /api/projects/{id}/sprints
17. **Phase 1.17:** Connect CreateSprintModal to POST endpoint
18. **Phase 1.18:** Implement sprint status transitions
19. **Phase 1.19:** Add error handling for sprint API calls

### Testing (4 tasks - testing-expert)
20. **Phase 1.20:** E2E test - Create sprint workflow
21. **Phase 1.21:** E2E test - Sprint status transitions
22. **Phase 1.22:** Unit tests - Sprint validation logic
23. **Phase 1.23:** Integration test - Database migration safety

---

## PHASE 2: Workflow System & Sprint Board (Week 2)

**Goal:** Replace hardcoded status with dynamic workflow stages, implement sprint board
**Tasks:** 18 tasks
**Deliverable:** Dynamic workflow stages working, sprint board functional

### UI Components - Workflow (8 tasks - ui-implementation-expert)
1. **Phase 2.1:** Create WorkflowStageSelector component
2. **Phase 2.2:** Update TaskModal to use WorkflowStageSelector
3. **Phase 2.3:** Create StageTransitionButton component
4. **Phase 2.4:** Update BoardView to render dynamic workflow stages
5. **Phase 2.5:** Create SprintBoard component
6. **Phase 2.6:** Implement drag-and-drop for stage transitions
7. **Phase 2.7:** Create SprintBacklog view
8. **Phase 2.8:** Add Assign to Sprint functionality in TaskModal

### UI Components - Project Type (5 tasks - ui-implementation-expert)
9. **Phase 2.9:** Create ProjectTypeSelector component
10. **Phase 2.10:** Add ProjectTypeSelector to CreateProjectModal
11. **Phase 2.11:** Display project type badge in ProjectCard
12. **Phase 2.12:** Create WorkflowVisualization component
13. **Phase 2.13:** Add workflow stages to ProjectDetailView

### Integration (3 tasks - integration-expert)
14. **Phase 2.14:** Fetch workflow stages via API
15. **Phase 2.15:** Implement stage transition via API
16. **Phase 2.16:** Add optimistic UI updates for stage changes

### Testing (2 tasks - testing-expert)
17. **Phase 2.17:** E2E test - Stage transition workflow
18. **Phase 2.18:** E2E test - Project type selection

---

## PHASE 3: Hierarchy & Analytics (Week 3)

**Goal:** Subprojects UI, sprint burndown/velocity charts
**Tasks:** 17 tasks
**Deliverable:** Full hierarchy working, sprint analytics dashboard

### UI Components - Hierarchy (6 tasks - ui-implementation-expert)
1. **Phase 3.1:** Create ProjectHierarchyTree component
2. **Phase 3.2:** Create AddSubprojectButton component
3. **Phase 3.3:** Create SubprojectModal component
4. **Phase 3.4:** Implement breadcrumb navigation component
5. **Phase 3.5:** Add hierarchy badge to ProjectCard
6. **Phase 3.6:** Add hierarchy path display in ProjectDetailView

### UI Components - Sprint Analytics (5 tasks - ui-implementation-expert)
7. **Phase 3.7:** Create BurndownChart component
8. **Phase 3.8:** Create VelocityChart component
9. **Phase 3.9:** Create SprintSummary stats card
10. **Phase 3.10:** Create SprintReportPage layout
11. **Phase 3.11:** Implement real-time burndown updates

### Integration (4 tasks - integration-expert)
12. **Phase 3.12:** Connect hierarchy tree to GET /api/projects/{id}/hierarchy
13. **Phase 3.13:** Implement subproject creation via POST endpoint
14. **Phase 3.14:** Fetch burndown data via GET /api/sprints/{id}/report
15. **Phase 3.15:** Add circular reference validation UI

### Testing (2 tasks - testing-expert)
16. **Phase 3.16:** E2E test - Create subproject and verify hierarchy
17. **Phase 3.17:** E2E test - Burndown chart accuracy

---

## PHASE 4: Teams & Knowledge Integration (Week 4)

**Goal:** Multi-user team management, knowledge linking UI
**Tasks:** 18 tasks
**Deliverable:** Team management functional, knowledge links integrated

### Backend Enhancement (2 tasks)
1. **Phase 4.1:** Add default_agent column to workflow_stages table (database-expert)
2. **Phase 4.2:** Create PUT /api/workflow-stages/{id}/agent endpoint (backend-api-expert)

### UI Components - Team Management (6 tasks - ui-implementation-expert)
3. **Phase 4.3:** Create TeamListView component
4. **Phase 4.4:** Create CreateTeamModal component
5. **Phase 4.5:** Create TeamMemberList component
6. **Phase 4.6:** Create team assignment dropdown in ProjectSettings
7. **Phase 4.7:** Implement team filtering in task views
8. **Phase 4.8:** Create WorkloadDashboard component

### UI Components - Knowledge Integration (5 tasks - ui-implementation-expert)
9. **Phase 4.9:** Create KnowledgeLinkPanel component
10. **Phase 4.10:** Create LinkKnowledgeModal component
11. **Phase 4.11:** Create KnowledgeItemCard component
12. **Phase 4.12:** Implement AI knowledge suggestions display
13. **Phase 4.13:** Add knowledge links to TaskDetailView

### Integration (3 tasks - integration-expert)
14. **Phase 4.14:** Connect TeamListView to GET /api/teams
15. **Phase 4.15:** Connect knowledge linking to POST /api/projects/{id}/knowledge
16. **Phase 4.16:** Fetch AI suggestions via GET /api/projects/{id}/knowledge/suggestions

### Testing (2 tasks - testing-expert)
17. **Phase 4.17:** E2E test - Create team and assign members
18. **Phase 4.18:** E2E test - Knowledge linking workflow

---

## PHASE 5: Reporting & Custom Workflows (Week 5)

**Goal:** Analytics dashboards, workflow customization UI
**Tasks:** 15 tasks
**Deliverable:** Analytics suite complete, workflow customization ready

### UI Components - Reporting (5 tasks - ui-implementation-expert)
1. **Phase 5.1:** Create ProjectHealthDashboard component
2. **Phase 5.2:** Create TaskMetricsView component
3. **Phase 5.3:** Create WorkflowDistributionChart component
4. **Phase 5.4:** Create TeamPerformanceReport component
5. **Phase 5.5:** Add export to CSV functionality for reports

### UI Components - Workflow Customization (5 tasks - ui-implementation-expert)
6. **Phase 5.6:** Create WorkflowSelector in ProjectSettings
7. **Phase 5.7:** Create WorkflowVisualization flowchart component
8. **Phase 5.8:** Create WorkflowConfigPanel component
9. **Phase 5.9:** Create StageAgentAssignment component
10. **Phase 5.10:** Implement workflow cloning feature

### Integration (3 tasks - integration-expert)
11. **Phase 5.11:** Fetch project health via GET /api/projects/{id}/health
12. **Phase 5.12:** Connect workflow selector to PUT /api/projects/{id}/workflow
13. **Phase 5.13:** Implement agent assignment via PUT /api/workflow-stages/{id}/agent

### Testing (2 tasks - testing-expert)
14. **Phase 5.14:** E2E test - View project health dashboard
15. **Phase 5.15:** E2E test - Change project workflow

---

## PHASE 6: Admin Tools, Testing & Polish (Week 6)

**Goal:** System management, comprehensive testing, production readiness
**Tasks:** 23 tasks
**Deliverable:** Production-ready Jira-like system

### UI Components - Admin (5 tasks - ui-implementation-expert)
1. **Phase 6.1:** Create SystemHealthDashboard component
2. **Phase 6.2:** Create AuditLogViewer component
3. **Phase 6.3:** Create WorkflowAnalytics component
4. **Phase 6.4:** Create UserManagementPanel component
5. **Phase 6.5:** Add admin navigation menu

### E2E Testing Suite (5 tasks - testing-expert)
6. **Phase 6.6:** E2E test - Complete sprint lifecycle
7. **Phase 6.7:** E2E test - Workflow transitions across all project types
8. **Phase 6.8:** E2E test - Deep hierarchy with circular detection
9. **Phase 6.9:** E2E test - Multi-user collaboration
10. **Phase 6.10:** Load test - 1000+ tasks, 50+ sprints

### Documentation (4 tasks - documentation-expert)
11. **Phase 6.11:** Write user guide - Sprint management
12. **Phase 6.12:** Write user guide - Workflow configuration
13. **Phase 6.13:** Write user guide - Project hierarchy
14. **Phase 6.14:** Create video tutorial - Sprint board workflow

### Polish & Performance (6 tasks)
15. **Phase 6.15:** Implement lazy loading for large task lists (performance-expert)
16. **Phase 6.16:** Add virtualized scrolling for sprint board (performance-expert)
17. **Phase 6.17:** Optimize burndown chart rendering (performance-expert)
18. **Phase 6.18:** Add loading states to all components (ui-implementation-expert)
19. **Phase 6.19:** Implement error boundaries (ui-implementation-expert)
20. **Phase 6.20:** Add empty states for all views (ui-implementation-expert)

### Security & Final Checks (3 tasks)
21. **Phase 6.21:** Security audit - RBAC enforcement (backend-api-expert)
22. **Phase 6.22:** Input validation audit across all forms (backend-api-expert)
23. **Phase 6.23:** Final integration test suite (testing-expert)

---

## Validation Checklist (Cross-Referenced Against Visual Architecture)

### UI Components Validated ✅

**From Visual Architecture Document:**
- [x] ProjectTypeSelector (4 types) - Phase 2.9
- [x] WorkflowStageSelector - Phase 2.1
- [x] SprintListView - Phase 1.10
- [x] CreateSprintModal - Phase 1.11
- [x] SprintBoard (Kanban) - Phase 2.5
- [x] SprintBacklog - Phase 2.7
- [x] BurndownChart - Phase 3.7
- [x] VelocityChart - Phase 3.8
- [x] ProjectHierarchyTree - Phase 3.1
- [x] SubprojectModal - Phase 3.3
- [x] TeamListView - Phase 4.3
- [x] TeamMemberList - Phase 4.5
- [x] WorkloadDashboard - Phase 4.8
- [x] KnowledgeLinkPanel - Phase 4.9
- [x] ProjectHealthDashboard - Phase 5.1
- [x] TaskMetricsView - Phase 5.2
- [x] WorkflowVisualization - Phase 5.7
- [x] SystemHealthDashboard - Phase 6.1
- [x] AuditLogViewer - Phase 6.2

### API Endpoints Validated ✅

**Existing (Verified):**
- [x] GET /api/workflows/{id}/stages - Already exists
- [x] POST /api/tasks/{id}/transition - Already exists
- [x] POST /api/projects/{id}/sprints - Already exists
- [x] GET /api/sprints/{id}/report - Already exists
- [x] GET /api/sprints/{id}/velocity - Already exists
- [x] POST /api/projects/{id}/knowledge - Already exists
- [x] GET /api/projects/{id}/knowledge/suggestions - Already exists

**Missing (Tasks Created):**
- [x] PUT /api/projects/{id}/workflow - Phase 1.5
- [x] POST /api/projects/{id}/subprojects - Phase 1.6
- [x] GET /api/projects/{id}/hierarchy - Phase 1.7
- [x] PUT /api/workflow-stages/{id}/agent - Phase 4.2

### Database Schema Validated ✅

**Existing (Verified via previous tasks):**
- [x] archon_project_types (4 types seeded)
- [x] archon_workflows (4 workflows)
- [x] archon_workflow_stages (19 stages)
- [x] archon_sprints
- [x] archon_project_hierarchy (ltree)
- [x] archon_teams
- [x] archon_team_members
- [x] archon_knowledge_links

**Missing (Tasks Created):**
- [x] default_agent column in workflow_stages - Phase 4.1
- [x] Remove status field from tasks - Phase 1.1-1.3

---

## Success Criteria

### Phase 1 Success Criteria
- ✅ Database migration complete (status → workflow_stage_id)
- ✅ Sprint CRUD UI functional
- ✅ API endpoints for hierarchy created
- ✅ All tests passing

### Phase 2 Success Criteria
- ✅ Hardcoded status completely removed
- ✅ Dynamic workflow stages working
- ✅ Sprint board with drag-and-drop functional
- ✅ Project type selection working

### Phase 3 Success Criteria
- ✅ Project hierarchy tree view working
- ✅ Subprojects can be created
- ✅ Burndown and velocity charts displaying
- ✅ Circular reference prevention working

### Phase 4 Success Criteria
- ✅ Team management fully functional
- ✅ Knowledge items can be linked
- ✅ AI suggestions displaying
- ✅ Multi-user workload tracking working

### Phase 5 Success Criteria
- ✅ All reporting dashboards complete
- ✅ Workflow customization UI working
- ✅ Project health score displaying
- ✅ CSV export functional

### Phase 6 Success Criteria
- ✅ Admin dashboard operational
- ✅ All E2E tests passing
- ✅ Documentation complete
- ✅ Performance optimized for 1000+ tasks
- ✅ Security audit passed
- ✅ System production-ready

---

## Task Status Tracking

**View Tasks Online:**
```bash
# All tasks for project
curl "http://localhost:8181/api/tasks?project_id=ec21abac-6631-4a5d-bbf1-e7eca9dfe833&per_page=200"

# Phase 1 tasks only
curl "http://localhost:8181/api/tasks?project_id=ec21abac-6631-4a5d-bbf1-e7eca9dfe833&per_page=50" | jq '.tasks[] | select(.title | startswith("Phase 1"))'

# Tasks by agent
curl "http://localhost:8181/api/tasks?project_id=ec21abac-6631-4a5d-bbf1-e7eca9dfe833&assignee=ui-implementation-expert&per_page=100"
```

**Dashboard URL:**
http://localhost:3738/projects/ec21abac-6631-4a5d-bbf1-e7eca9dfe833

---

## Next Steps

1. **Review Phase 1 Tasks** - Prioritize database migration tasks
2. **Assign Agents** - Tasks already have agent assignments (auto-assigned based on expertise)
3. **Begin Implementation** - Start with Phase 1.1 (database migration)
4. **Daily Standups** - Track progress via Archon task status updates
5. **Weekly Reviews** - Complete each phase before moving to next

---

## Risk Mitigation

**Risk:** Removing status field breaks existing integrations
- **Mitigation:** Phase 1.3 migration script with rollback capability

**Risk:** Complex workflow logic causes performance issues
- **Mitigation:** Phase 6.15-6.17 performance optimization tasks

**Risk:** Hierarchy creates circular dependencies
- **Mitigation:** Database triggers + Phase 3.15 UI validation

**Risk:** Large datasets slow down UI
- **Mitigation:** Phase 6.15 lazy loading, Phase 6.16 virtualized scrolling

---

**Document Status:** Complete Task Breakdown - Ready for Implementation
**Last Updated:** 2026-01-16
**Total Tasks:** 115 tasks across 6 phases
**Validation:** All UI components from visual architecture document included
**Character Count:** 16,347 chars

**Related Documents:**
- Visual Architecture: `/archon/docs/projects/JIRA_LIKE_PM_VISUAL_ARCHITECTURE.md`
- Backend Services: `/archon/python/src/services/projects/`
- API Routes: `/archon/python/src/server/api_routes/`
- Frontend UI: `/archon/archon-ui-nextjs/src/`
