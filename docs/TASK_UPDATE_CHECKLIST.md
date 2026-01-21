# TASK UPDATE CHECKLIST
**Project:** Jira-Like PM Upgrade (ec21abac-6631-4a5d-bbf1-e7eca9dfe833)
**Date:** 2026-01-20
**Estimated Time:** 30-45 minutes

---

## ✅ Pre-Update Verification

Before marking tasks as done, verify Archon is running:

```bash
# Check Archon services
curl http://localhost:8051/health   # MCP server
curl http://localhost:8181/health   # Backend API

# Access dashboard
# Navigate to: http://localhost:3737
```

- [ ] Archon MCP server is running (port 8051)
- [ ] Archon backend API is running (port 8181)
- [ ] Archon dashboard accessible (port 3737)
- [ ] Database is accessible (Supabase)

---

## 📋 Phase 1: Sprint Management (23 Tasks → 20 Done)

### Mark as DONE (High Confidence)

**Backend Tasks:**
- [ ] 1.1: Sprint table schema (`archon_sprints` exists)
- [ ] 1.2: Sprint CRUD operations (`sprint_service.py`)
- [ ] 1.3: Sprint lifecycle API (`api_routes/sprints.py`)
- [ ] 1.4: Sprint model validations (tests exist)
- [ ] 1.5: Sprint-task relationship (FK exists)
- [ ] 1.6: Sprint velocity calculation (implemented)
- [ ] 1.7: Sprint status transitions (endpoints exist)
- [ ] 1.8: Sprint API tests (`test_sprint_service.py`)

**Frontend Tasks:**
- [ ] 1.9: SprintListView (`SprintListView.tsx`)
- [ ] 1.10: CreateSprintModal (`CreateSprintModal.tsx`)
- [ ] 1.11: SprintCard (`SprintCard.tsx`)
- [ ] 1.12: SprintActionConfirmDialog (`SprintActionConfirmDialog.tsx`)
- [ ] 1.13: SprintStatusIndicator (`SprintStatusIndicator.tsx`)
- [ ] 1.14: Sprint query hooks (`useSprintQueries.ts`)

**Advanced Features:**
- [ ] 1.15: Sprint start/complete actions (service methods)
- [ ] 1.16: Sprint backlog filtering (`SprintBacklogView.tsx`)
- [ ] 1.17: Sprint completion stats (implemented)
- [ ] 1.18: Sprint velocity tracking (`VelocityChart.tsx`)
- [ ] 1.19: SprintBoard with DnD (`SprintBoard.tsx` + @dnd-kit)
- [ ] 1.20: SprintBacklog view (`SprintBacklogView.tsx`)
- [ ] 1.21: Sprint assignment in modal (`SprintSelector.tsx`)
- [ ] 1.22: E2E tests (`sprint-workflow.spec.ts` 18k lines)

**Phase 1 Summary:** □ 20/23 tasks marked done (87%)

---

## 📋 Phase 2: Workflow & Stages (18 Tasks → 14 Done)

### Mark as DONE (High Confidence)

**Backend Tasks:**
- [ ] 2.1: Workflow tables (`archon_workflows`, `archon_workflow_stages`)
- [ ] 2.2: Project type system (`archon_project_types`)
- [ ] 2.3: Workflow-stage relationships (FKs exist)
- [ ] 2.4: Workflow service (`workflow_service.py`)
- [ ] 2.5: Stage CRUD operations (implemented)

**Migration Tasks:**
- [ ] 2.7: Status → stage migration (`20260116_phase1_1_migrate_status_to_workflow_stage.sql`)

**Frontend Tasks:**
- [ ] 2.6: WorkflowStageSelector (`WorkflowStageSelector.tsx`)
- [ ] 2.8: BoardView with DnD (`BoardView.tsx` + @dnd-kit)
- [ ] 2.9: ProjectTypeSelector (`ProjectTypeSelector.tsx`)
- [ ] 2.11: Workflow API endpoints (`api_routes/workflows.py`)
- [ ] 2.12: WorkflowVisualization (`WorkflowVisualization.tsx`)

**Testing Tasks:**
- [ ] 2.14: Workflow validation (`workflow_validation.py`)
- [ ] 2.16: E2E tests (`sprint-workflow.spec.ts` includes workflow)

**Phase 2 Summary:** □ 14/18 tasks marked done (78%)

---

## 📋 Phase 3: Hierarchy & Analytics (17 Tasks → 11 Done)

### Mark as DONE (High Confidence)

**Hierarchy Tasks:**
- [ ] 3.1: ltree for hierarchy (`archon_project_hierarchy` table)
- [ ] 3.2: Hierarchy API (`project_hierarchy_service.py`)
- [ ] 3.3: ProjectHierarchyTree (`ProjectHierarchyTree.tsx`)
- [ ] 3.4: Subproject CRUD (`AddSubprojectButton.tsx`, `SubprojectModal.tsx`)
- [ ] 3.5: Breadcrumb navigation (`ProjectBreadcrumb.tsx`)

**Analytics Tasks:**
- [ ] 3.7: BurndownChart (`BurndownChart.tsx` + recharts)
- [ ] 3.8: VelocityChart (`VelocityChart.tsx` + recharts)
- [ ] 3.9: Sprint reports (`SprintReportPage.tsx`)
- [ ] 3.10: TimelineView (`TimelineView.tsx` + @svar-ui/react-gantt)

**Testing Tasks:**
- [ ] 3.15: Hierarchy E2E tests (`project-hierarchy.spec.ts`)
- [ ] 3.16: Analytics E2E tests (`sprint-burndown.spec.ts`)

**Phase 3 Summary:** □ 11/17 tasks marked done (65%)

---

## 📋 Phase 4: Team & Knowledge (18 Tasks → 8 Done)

### Mark as DONE (High Confidence)

**Backend Tasks:**
- [ ] 4.1: Team tables (`archon_teams`, `archon_team_members`)
- [ ] 4.2: Team service (`team_service.py`)
- [ ] 4.3: RBAC tables (`archon_user_permissions`, `archon_organizations`)
- [ ] 4.6: User-project access (`archon_user_project_access`, migration 20260119)
- [ ] 4.9: Knowledge links table (`archon_knowledge_links`)
- [ ] 4.10: Knowledge API (`api_routes/knowledge_links.py`)

**Frontend Tasks:**
- [ ] 4.8: EditPermissionsModal (`EditPermissionsModal.tsx`)
- [ ] 4.14: Knowledge views (`KnowledgeView.tsx`, `KnowledgeListView.tsx`)

### Verify First (Medium Confidence)

**These need visual confirmation before marking done:**
- [ ] 4.4: TeamListView (check if component exists in `/features/users/` or `/features/teams/`)
- [ ] 4.5: CreateTeamModal (check if component exists)
- [ ] 4.11: AI knowledge suggestions (API exists, check UI integration)
- [ ] 4.12: KnowledgeLinkPanel (check if component exists in `/features/knowledge/`)
- [ ] 4.15: Team assignment UI (check if integrated in TaskCard)

**Phase 4 Summary:** □ 8/18 tasks marked done initially (44%), verify 5 more

---

## 📋 Phase 5: Advanced Reporting (9 Tasks → 2 Done)

### Verify First (Low/Medium Confidence)

**Most Phase 5 tasks need verification:**
- [ ] 5.1: ProjectHealthDashboard (search for component)
- [ ] 5.2: TaskMetricsView (search for component)
- [ ] 5.3: WorkflowConfigPanel (search for component)
- [ ] 5.4: Custom report builder (likely missing)
- [ ] 5.5: CSV export (check for export functionality)
- [ ] 5.6-5.9: Various enhancements (need review)

**Known Complete:**
- [ ] 5.x: MCP analytics (`McpAnalytics.tsx`, multiple dashboard components exist)

**Phase 5 Summary:** □ 2/9 tasks marked done (22%), most need completion

---

## 🎯 Overall Progress Tracker

### Before Update
```
Phase 1: [████░░░░░░] 35%  →  Target: [███████████] 87%
Phase 2: [████░░░░░░] 40%  →  Target: [█████████░] 78%
Phase 3: [███░░░░░░░] 35%  →  Target: [████████░░] 65%
Phase 4: [██░░░░░░░░] 25%  →  Target: [█████░░░░░] 44%
Phase 5: [█░░░░░░░░░] 15%  →  Target: [██░░░░░░░░] 22%
------------------------------------------------------
TOTAL:   [███░░░░░░░] 41%  →  Target: [███████░░░] 59%
```

### After Verification (Estimated)
```
Phase 1: [███████████] 87%  →  Stretch: [█████████░] 95%
Phase 2: [█████████░] 78%   →  Stretch: [█████████░] 90%
Phase 3: [████████░░] 65%   →  Stretch: [████████░░] 85%
Phase 4: [█████░░░░░] 44%   →  Stretch: [███████░░░] 75%
Phase 5: [██░░░░░░░░] 22%   →  Stretch: [████░░░░░░] 40%
------------------------------------------------------
TOTAL:   [███████░░░] 59%   →  Stretch: [███████░░░] 77%
```

---

## 🛠️ Execution Methods

### Method 1: Manual UI Updates (Safest)
```
Time: 30-45 minutes
Steps:
1. Open http://localhost:3737
2. Navigate to Projects → Jira-Like PM Upgrade
3. Click on each task in checklist above
4. Change status from "todo/backlog" to "done"
5. Save each task
6. Check off item in this checklist
```

### Method 2: MCP Bulk Updates (Faster)
```python
# Get task list
tasks = find_tasks(
    project_id="ec21abac-6631-4a5d-bbf1-e7eca9dfe833",
    include_closed=True
)

# For each task marked above, update:
manage_task("update", task_id="<task_id>", status="done")
```

### Method 3: Database Script (Most Efficient)
```bash
# Use the automated script (if created)
cd /home/ljutzkanov/Documents/Projects/archon
python scripts/update_crash_recovery_tasks.py

# Or use psql directly (advanced users only)
docker exec -it supabase-ai-db psql -U postgres -d postgres
```

---

## ✅ Post-Update Verification

After marking tasks as done:

### Quick Smoke Tests
```bash
# Test sprint features
1. Navigate to project in UI
2. Click "Sprints" tab
3. Create new sprint → Should work
4. Start sprint → Should work
5. View sprint board → Drag-and-drop should work

# Test workflow features
6. Open BoardView
7. Drag task between stages → Should work
8. View WorkflowVisualization → Should display stages

# Test analytics
9. View BurndownChart → Should render with data
10. View VelocityChart → Should render with data
11. View Timeline (Gantt) → Should show sprints/tasks

# Test hierarchy
12. Create subproject → Should work
13. View breadcrumbs → Should show path
14. View ProjectHierarchyTree → Should show structure
```

### Final Checks
- [ ] Project completion % updated (should be ~59-77%)
- [ ] All Phase 1 features work in UI
- [ ] All Phase 2 features work in UI
- [ ] All Phase 3 features work in UI
- [ ] Phase 4 features verified (teams, knowledge)
- [ ] Phase 5 features documented for completion

---

## 📊 Expected Outcome

### Before
```
✅ Tasks marked done: 35/85 (41%)
❌ Actual implementation: ~65/85 (77%)
⚠️ Gap: 30 tasks (36 percentage points)
```

### After Initial Update
```
✅ Tasks marked done: 50-55/85 (59-65%)
✅ Verified implementation: ~65/85 (77%)
⚠️ Remaining gap: ~15 tasks (Phase 4-5)
```

### After Full Verification (Stretch Goal)
```
✅ Tasks marked done: 65-70/85 (77-82%)
✅ Verified implementation: ~65/85 (77%)
✅ Gap closed: <5 tasks
🎯 Accuracy: 95%+
```

---

## 🚨 Common Issues & Solutions

### Issue: Task IDs not found
**Solution:** Use task titles/descriptions to search in Archon UI

### Issue: Status update fails
**Solution:** Check user permissions, verify project ID is correct

### Issue: Can't verify component exists
**Solution:** Use `find` command:
```bash
find /home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs/src \
  -name "*TeamList*" -o -name "*CreateTeam*"
```

### Issue: Unsure if task is complete
**Solution:** Check evidence in CRASH_RECOVERY_AUDIT_2026-01-20.md

---

## 📞 Support

**Questions?**
- Full evidence: `/docs/CRASH_RECOVERY_AUDIT_2026-01-20.md`
- Action plan: `/docs/IMMEDIATE_TASK_UPDATES.md`
- Visual summary: `/docs/CRASH_RECOVERY_VISUAL_SUMMARY.md`

**Need help with specific task?**
- Search codebase for component name
- Check database for table existence
- Review migration files for schema changes
- Test feature in UI

---

## ⏱️ Time Tracking

**Session Start:** ________________ (Date/Time)

**Phases Completed:**
- Phase 1 update: ________ min (target: 10 min)
- Phase 2 update: ________ min (target: 8 min)
- Phase 3 update: ________ min (target: 7 min)
- Phase 4 update: ________ min (target: 5 min)
- Phase 5 review: ________ min (target: 5 min)
- Verification: ________ min (target: 10 min)

**Total Time:** ________ min (target: 30-45 min)

**Session End:** ________________ (Date/Time)

---

**NEXT STEPS AFTER COMPLETION:**
1. Update project README with implemented features
2. Share update with team/stakeholders
3. Plan Phase 4/5 completion sprints
4. Document any discovered gaps
5. Celebrate 77% completion! 🎉

---

*Checklist created: 2026-01-20*
*Last updated: 2026-01-20*
*Maintainer: Project Lead*
