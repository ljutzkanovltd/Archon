# Phase 1 Validation Guide

## 🎯 What You Asked: "How can I see the changes?"

**Your concern was valid!** The Phase 1 code was implemented but **migrations weren't applied** to the database, so you couldn't see any changes in action.

---

## 📁 What Actually Exists (Proof of Implementation)

### 1. Database Migrations (10 files) ✅

**Location:** `/home/ljutzkanov/Documents/Projects/archon/migration/0.5.0/`

```bash
001_create_archon_project_types.sql       (3.4KB)
002_create_workflows_tables.sql           (7.9KB)
003_create_archon_sprints.sql             (2.2KB)
004_create_archon_time_logs.sql           (2.0KB)
005_enhance_archon_tasks.sql              (6.0KB)
006_enable_ltree_extension.sql            (3.2KB)
007_create_project_hierarchy.sql          (5.5KB)
008_create_teams.sql                      (2.7KB)
009_create_knowledge_links.sql            (4.3KB) ✅ APPLIED
010_create_knowledge_similarity_search.sql (3.6KB) ✅ APPLIED
```

**Status:** Migrations 009-010 applied, **001-008 NOT applied yet**

### 2. Backend Services (6 files) ✅

**Location:** `/home/ljutzkanov/Documents/Projects/archon/python/src/server/services/`

```bash
services/projects/workflow_service.py           (12KB, ~400 lines)
services/projects/sprint_service.py             (16KB, ~500 lines)
services/projects/team_service.py               (12KB, ~380 lines)
services/projects/project_hierarchy_service.py  (15KB, ~450 lines)
services/knowledge_linking_service.py           (18KB, ~550 lines)
services/reporting_service.py                   (18KB, ~550 lines)
```

**Plus:** `services/casbin_service.py` for RBAC

### 3. API Routes (6 files) ✅

**Location:** `/home/ljutzkanov/Documents/Projects/archon/python/src/server/api_routes/`

```bash
api_routes/workflows.py         (11KB, 4 endpoints)
api_routes/sprints.py           (17KB, 7 endpoints)
api_routes/knowledge_links.py   (16KB, 4 endpoints)
api_routes/reports.py           (12KB, 5 endpoints)
```

**Total:** 20+ new API endpoints

### 4. MCP Tools (Enhanced) ✅

**Location:** `/home/ljutzkanov/Documents/Projects/archon/python/src/mcp_server/mcp_server.py`

New tools added:
- `link_knowledge()` - Link docs/code to projects/tasks
- `suggest_knowledge()` - AI-powered suggestions
- `get_linked_knowledge()` - Retrieve links

---

## 🚀 Step-by-Step Validation Process

### STEP 1: Apply Migrations (Required First!)

```bash
cd /home/ljutzkanov/Documents/Projects/archon/python

# Run the migration script
./apply_phase1_migrations.sh
```

**What this does:**
- Applies migrations 001-008 to Supabase database
- Creates 8 new tables (sprints, workflows, teams, hierarchy, etc.)
- Enables ltree extension for hierarchical queries
- Enhances archon_tasks table with sprint/workflow fields
- Records migrations in archon_migrations table

**Expected Output:**
```
✅ Migration applied successfully
📝 Recorded in archon_migrations
...
✅ All Phase 1 migrations applied!
✅ Phase 1 database setup complete!
```

---

### STEP 2: Validate Implementation

```bash
# Run comprehensive validation
./validate_phase1.sh
```

**What this checks:**
1. **Database Validation:**
   - All 9 new tables exist
   - ltree extension installed
   - archon_tasks enhanced columns present

2. **Service File Validation:**
   - All 6 service files exist
   - Line counts verify real implementation

3. **API Route Validation:**
   - All 6 API route files exist
   - Endpoint counts extracted

4. **Live API Testing:**
   - Backend running on port 8181
   - OpenAPI docs accessible
   - Phase 1 endpoints registered

5. **MCP Tool Validation:**
   - Knowledge linking tools present

**Expected Output:**
```
✅ PASSED: 35
❌ FAILED: 0
Success Rate: 100.0%
🎉 All Phase 1 validations passed!
```

---

### STEP 3: Test Features Interactively

```bash
# Run interactive feature demo
./test_phase1_features.sh
```

**What this demonstrates:**
1. **Sprint Creation** - Create a 2-week sprint
2. **Workflow Querying** - List available workflows and stages
3. **Task Assignment** - Assign task to sprint
4. **AI Knowledge Suggestions** - Get relevant docs/code
5. **Sprint Reporting** - Generate velocity/burndown reports
6. **Project Health** - Get health indicators

---

## 🔍 Manual Verification Commands

### Check Database Tables

```bash
# List all Phase 1 tables
docker exec supabase-ai-db psql -U postgres -d postgres -c "
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
      'archon_project_types', 'archon_workflows', 'archon_workflow_stages',
      'archon_sprints', 'archon_time_logs', 'archon_project_hierarchy',
      'archon_teams', 'archon_team_members', 'archon_knowledge_links'
  )
ORDER BY table_name;
"
```

### Check Specific Table Schema

```bash
# View sprint table structure
docker exec supabase-ai-db psql -U postgres -d postgres -c "\d archon_sprints"
```

### Test API Endpoint Directly

```bash
# Health check
curl http://localhost:8181/health

# List sprints (replace with actual project ID)
curl http://localhost:8181/api/projects/{project_id}/sprints

# Get OpenAPI documentation
curl http://localhost:8181/openapi.json | jq '.paths | keys' | grep -E "(sprint|workflow|knowledge|report)"
```

### View API Documentation UI

```bash
# Open in browser
http://localhost:8181/docs

# Look for new sections:
# - sprints (tag)
# - workflows (tag)
# - knowledge-links (tag)
# - reports (tag)
```

---

## 📊 Verification Checklist

Use this to manually verify Phase 1 implementation:

### Database Layer ✅
- [ ] `archon_project_types` table exists
- [ ] `archon_workflows` table exists
- [ ] `archon_workflow_stages` table exists
- [ ] `archon_sprints` table exists (with status, velocity columns)
- [ ] `archon_time_logs` table exists
- [ ] `archon_project_hierarchy` table exists
- [ ] `archon_teams` table exists
- [ ] `archon_team_members` table exists (with role column)
- [ ] `archon_knowledge_links` table exists (with relevance_score)
- [ ] `ltree` extension enabled
- [ ] `archon_tasks.sprint_id` column exists
- [ ] `archon_tasks.workflow_stage_id` column exists
- [ ] `archon_tasks.story_points` column exists

### Service Layer ✅
- [ ] `WorkflowService` class exists with 4+ methods
- [ ] `SprintService` class exists with 7+ methods
- [ ] `TeamService` class exists with 6+ methods
- [ ] `ProjectHierarchyService` class exists with 6+ methods
- [ ] `KnowledgeLinkingService` class exists with AI suggestions
- [ ] `ReportingService` class exists with metrics methods
- [ ] `CasbinService` class exists for RBAC

### API Layer ✅
- [ ] `/api/workflows/*` endpoints (4 endpoints)
- [ ] `/api/sprints/*` endpoints (7 endpoints)
- [ ] `/api/projects/{id}/knowledge/*` endpoints (4 endpoints)
- [ ] `/api/reports/*` endpoints (5 endpoints)
- [ ] OpenAPI docs include all Phase 1 endpoints
- [ ] Casbin permission checks on protected endpoints

### MCP Layer ✅
- [ ] `link_knowledge` tool in MCP server
- [ ] `suggest_knowledge` tool in MCP server
- [ ] `get_linked_knowledge` tool in MCP server

---

## 🐛 Troubleshooting

### "Table does not exist" errors

**Problem:** API returns errors like `relation "archon_sprints" does not exist`

**Solution:** Migrations not applied yet. Run:
```bash
./apply_phase1_migrations.sh
```

### "Backend not running"

**Problem:** Cannot access http://localhost:8181

**Solution:** Start Archon backend:
```bash
cd /home/ljutzkanov/Documents/Projects/archon
./start-archon.sh
```

### "404 Not Found" on Phase 1 endpoints

**Problem:** Endpoints like `/api/sprints` return 404

**Solution:** Check if routes are registered in `main.py`:
```bash
grep -n "sprints" src/server/main.py
grep -n "workflows" src/server/main.py
grep -n "knowledge_links" src/server/main.py
grep -n "reports" src/server/main.py
```

If missing, add to `main.py`:
```python
from .api_routes import sprints, workflows, knowledge_links, reports

app.include_router(sprints.router)
app.include_router(workflows.router)
app.include_router(knowledge_links.router)
app.include_router(reports.router)
```

### "Migration already applied" but tables missing

**Problem:** archon_migrations shows migration as applied but table doesn't exist

**Solution:** Migration might have failed silently. Check migration content:
```bash
cat /home/ljutzkanov/Documents/Projects/archon/migration/0.5.0/003_create_archon_sprints.sql
```

Then apply manually:
```bash
docker exec -i supabase-ai-db psql -U postgres -d postgres < migration/0.5.0/003_create_archon_sprints.sql
```

---

## 🎯 Expected Results After Validation

After running all validation steps, you should be able to:

### Via API:
1. **Create sprints** for projects with start/end dates
2. **List workflows** and their ordered stages
3. **Transition tasks** through workflow stages
4. **Assign tasks** to sprints
5. **Get AI suggestions** for relevant docs/code
6. **Generate reports** (burndown, velocity, health)
7. **Manage teams** with member roles
8. **Create project hierarchies** with parent-child relationships

### Via Database:
1. Query sprint velocity: `SELECT name, velocity FROM archon_sprints WHERE project_id = '...'`
2. View task workflow: `SELECT title, workflow_stage_id FROM archon_tasks WHERE sprint_id = '...'`
3. Check team membership: `SELECT user_id, role FROM archon_team_members WHERE team_id = '...'`
4. View knowledge links: `SELECT * FROM archon_knowledge_links WHERE source_type = 'project'`

### Via UI (OpenAPI Docs):
1. Browse all endpoints at http://localhost:8181/docs
2. Test sprint creation via "Try it out" button
3. See request/response schemas
4. View authentication requirements

### Via MCP:
1. Call `suggest_knowledge` from Claude Code
2. Link documentation to tasks
3. Query linked knowledge items

---

## 📈 Success Metrics

**Phase 1 is fully validated when:**

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Database Tables | 9 new tables | `./validate_phase1.sh` |
| Service Files | 7 files | Check file existence + line counts |
| API Endpoints | 20+ endpoints | OpenAPI spec at `/openapi.json` |
| MCP Tools | 3 new tools | Check MCP server file |
| Migrations Applied | 10/10 applied | Query `archon_migrations` table |
| API Response Time | <500ms | Test sprint creation endpoint |
| Test Suite Pass | 100% | Run `./validate_phase1.sh` |

---

## 🚀 Next Steps After Validation

1. **Create sample data:**
   - Create a test project
   - Add 2-3 sprints
   - Create tasks and assign to sprints
   - Link knowledge items

2. **Performance testing:**
   - Create 100 tasks
   - Test report generation speed
   - Verify AI suggestion latency (<500ms)

3. **Frontend integration:**
   - Test sprint board UI
   - Verify Kanban view with workflow stages
   - Display burndown charts

4. **Production deployment:**
   - Apply migrations to staging
   - Run full test suite
   - Monitor logs for errors

---

## 📞 Support

**If validation fails:**

1. Check logs:
   ```bash
   docker logs archon-mcp-server
   docker logs archon-api
   ```

2. Review migration errors:
   ```bash
   docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT * FROM archon_migrations ORDER BY applied_at DESC LIMIT 5;"
   ```

3. Test individual endpoint:
   ```bash
   curl -v http://localhost:8181/api/sprints
   ```

4. Check database connectivity:
   ```bash
   docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT 1;"
   ```

---

**Generated:** 2026-01-15
**Version:** 1.0
**Validation Scripts:** 3 scripts in `/python` directory
