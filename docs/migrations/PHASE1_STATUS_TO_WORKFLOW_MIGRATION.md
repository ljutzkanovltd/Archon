# Phase 1 Migration: Status → Workflow Stage

**Date**: 2026-01-16
**Migration Files**:
- `python/migrations/20260116_phase1_migrate_status_to_workflow_v2.sql`

## Summary

Successfully migrated all tasks from hardcoded `status` enum to dynamic `workflow_stage_id` system.

## Database Changes

### Removed
- `status` column (task_status enum)
- `task_status` enum type
- `trigger_sync_task_workflow_stage` (bidirectional sync that was preventing migration)
- `sync_task_workflow_stage()` function

### Added
- `workflow_stage_id` column (uuid NOT NULL)
- Foreign key constraint: `fk_archon_tasks_workflow_stage`

### Migration Stats
- **Total tasks migrated**: 897
- **Distribution**:
  - Backlog: 593 (66.1%)
  - Done: 290 (32.3%)
  - In Progress: 11 (1.2%)
  - Review: 3 (0.3%)

## Backend Code Changes

### Updated Files

#### `src/server/services/projects/task_service.py`
- **Removed**: `VALID_STATUSES`, `validate_status()`
- **Added**:
  - `DEFAULT_WORKFLOW_ID` constant
  - `DEFAULT_STAGES` dict (cached stage IDs)
  - `get_stage_id_by_name()` - Map stage name to UUID
  - `validate_workflow_stage()` - Validate stage ID exists
- **Updated Methods**:
  - `create_task()` - Now uses `workflow_stage_id` parameter
  - `list_tasks()` - Supports both `status` (legacy) and `workflow_stage_id` (new)
  - `get_task()` - Returns workflow stage info, adds legacy `status` field for compatibility
  - `update_task()` - Supports both `status` and `workflow_stage_id` parameters

#### `src/server/api_routes/projects_api.py`
- **Updated Models**:
  - `CreateTaskRequest` - Added `workflow_stage_id` field, deprecated `status`
- **Updated Endpoints**:
  - `POST /api/tasks` - Accepts both `status` and `workflow_stage_id`
  - `GET /api/tasks` - Added `workflow_stage_id` query parameter

## API Response Format

### Before Migration
```json
{
  "id": "task-uuid",
  "status": "todo",
  ...
}
```

### After Migration
```json
{
  "id": "task-uuid",
  "workflow_stage_id": "stage-uuid",
  "workflow_stage": {
    "id": "stage-uuid",
    "name": "Backlog",
    "stage_order": 0,
    "workflow_id": "workflow-uuid"
  },
  "status": "backlog",  // Legacy compatibility field
  ...
}
```

## Backward Compatibility

### Status Mapping
- `todo` → `backlog` (stage_order 0)
- `doing` → `in_progress` (stage_order 1)
- `review` → `review` (stage_order 2)
- `done` → `done` (stage_order 3)

### API Compatibility
- ✅ Old clients can still use `status` field in requests
- ✅ Response includes legacy `status` field mapped from workflow stage name
- ✅ `GET /api/tasks?status=todo` still works (mapped to workflow stage filter)

## Testing

### Verified Endpoints
```bash
# List tasks (works with both filters)
curl "http://localhost:8181/api/tasks?status=backlog"
curl "http://localhost:8181/api/tasks?workflow_stage_id=<uuid>"

# Create task (works with both parameters)
curl -X POST "http://localhost:8181/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"...", "title":"...", "status":"todo"}'

curl -X POST "http://localhost:8181/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"...", "title":"...", "workflow_stage_id":"..."}'

# Update task (works with both parameters)
curl -X PUT "http://localhost:8181/api/tasks/<id>" \
  -H "Content-Type: application/json" \
  -d '{"status":"doing"}'

curl -X PUT "http://localhost:8181/api/tasks/<id>" \
  -H "Content-Type: application/json" \
  -d '{"workflow_stage_id":"..."}'
```

## Known Issues

### Foreign Key Ambiguity
- **Issue**: Database has two FK constraints for same relationship:
  - `archon_tasks_workflow_stage_id_fkey` (auto-created)
  - `fk_archon_tasks_workflow_stage` (migration-created)
- **Solution**: Updated Supabase queries to use explicit FK name:
  ```python
  .select("*, workflow_stage:archon_workflow_stages!fk_archon_tasks_workflow_stage(...)")
  ```
- **Future**: Drop duplicate constraint in next migration

## Next Steps

**Phase 1.5-1.7**: Implement workflow management endpoints:
- `PUT /api/projects/{id}/workflow` - Change project workflow
- `POST /api/projects/{id}/subprojects` - Create subproject
- `GET /api/projects/{id}/hierarchy` - View project tree

**Phase 1.9**: Add stage transition validation middleware

## References
- Visual Architecture: `docs/projects/JIRA_LIKE_PM_VISUAL_ARCHITECTURE.md`
- Task Summary: `docs/projects/JIRA_LIKE_PM_TASK_SUMMARY.md`
- Workflow Seed Data: `python/migrations/seed-workflows.sql`
