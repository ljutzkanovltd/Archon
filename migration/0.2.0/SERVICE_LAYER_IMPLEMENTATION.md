# Service Layer Implementation - Phase 0

## Overview

Service layer implementation complete for Phase 0 database enhancements. All API endpoints are now functional and ready for testing.

## Files Modified

### 1. ProjectService (`src/server/services/projects/project_service.py`)

**New Methods:**

```python
def archive_project(self, project_id: str, archived_by: str = "User") -> tuple[bool, dict[str, Any]]
```
- Calls PostgreSQL function `archive_project_and_tasks()`
- Archives project and cascades to all tasks
- Returns count of tasks archived
- **Lines**: 388-433

```python
def unarchive_project(self, project_id: str) -> tuple[bool, dict[str, Any]]
```
- Calls PostgreSQL function `unarchive_project_and_tasks()`
- Restores archived project and all tasks
- Returns count of tasks unarchived
- **Lines**: 435-478

**Modified Methods:**

```python
def list_projects(self, include_content: bool = True, include_archived: bool = False) -> tuple[bool, dict[str, Any]]
```
- Added `include_archived` parameter (default: False)
- Filters out archived projects by default
- Uses `.eq("archived", False)` query filter
- **Lines**: 76-148

### 2. TaskService (`src/server/services/projects/task_service.py`)

**New Methods:**

```python
def get_task_history(
    self,
    task_id: str,
    field_name: str | None = None,
    limit: int = 50
) -> tuple[bool, dict[str, Any]]
```
- Calls PostgreSQL function `get_task_history()`
- Retrieves all changes for a task
- Supports filtering by field_name
- Returns chronological list ordered by changed_at DESC
- **Lines**: 528-576

```python
def get_completion_stats(
    self,
    project_id: str | None = None,
    days: int = 7,
    limit: int = 50
) -> tuple[bool, dict[str, Any]]
```
- Calls `get_project_completion_stats()` for aggregate metrics
- Calls `get_recently_completed_tasks()` for task list
- Returns stats (completion rate, avg time) and recently completed tasks
- **Lines**: 578-635

### 3. API Routes (`src/server/api_routes/projects_api.py`)

**New Endpoints:**

#### POST /api/projects/{project_id}/archive
```python
@router.post("/projects/{project_id}/archive")
async def archive_project(project_id: str, request: ArchiveProjectRequest)
```
- Request body: `{archived_by: string}` (default: "User")
- Returns: `{project_id, message, tasks_archived, archived_by}`
- Status codes: 200 (success), 404 (not found), 500 (error)
- **Lines**: 1285-1321

#### POST /api/projects/{project_id}/unarchive
```python
@router.post("/projects/{project_id}/unarchive")
async def unarchive_project(project_id: str)
```
- No request body required
- Returns: `{project_id, message, tasks_unarchived}`
- Status codes: 200 (success), 404 (not found), 500 (error)
- **Lines**: 1324-1359

#### GET /api/tasks/{task_id}/history
```python
@router.get("/tasks/{task_id}/history")
async def get_task_history(
    task_id: str,
    field_name: str | None = None,
    limit: int = 50
)
```
- Query params: `field_name` (optional), `limit` (default: 50)
- Returns: `{task_id, changes: [...], count, field_filter}`
- Status codes: 200 (success), 500 (error)
- **Lines**: 1362-1401

#### GET /api/tasks/completion-stats
```python
@router.get("/tasks/completion-stats")
async def get_completion_stats(
    project_id: str | None = None,
    days: int = 7,
    limit: int = 50
)
```
- Query params: `project_id` (optional), `days` (default: 7), `limit` (default: 50)
- Returns: `{project_id, days_range, stats: {...}, recently_completed: [...], count}`
- Status codes: 200 (success), 500 (error)
- **Lines**: 1404-1447

## Response Formats

### Archive Project Response
```json
{
  "project_id": "88eab363-b647-4141-9383-1d65e4504be8",
  "message": "Project archived successfully",
  "tasks_archived": 31,
  "archived_by": "User"
}
```

### Unarchive Project Response
```json
{
  "project_id": "88eab363-b647-4141-9383-1d65e4504be8",
  "message": "Project unarchived successfully",
  "tasks_unarchived": 31
}
```

### Task History Response
```json
{
  "task_id": "2ad5ee0a-091e-4548-8215-77fee56d4514",
  "changes": [
    {
      "change_id": "uuid-1",
      "field_name": "status",
      "old_value": "review",
      "new_value": "done",
      "changed_by": "Archon",
      "changed_at": "2025-12-21T17:18:35.813846+00:00",
      "change_reason": null
    }
  ],
  "count": 1,
  "field_filter": null
}
```

### Completion Stats Response
```json
{
  "project_id": "88eab363-b647-4141-9383-1d65e4504be8",
  "days_range": 7,
  "stats": {
    "project_id": "88eab363-b647-4141-9383-1d65e4504be8",
    "total_tasks": 39,
    "completed_tasks": 3,
    "in_progress_tasks": 0,
    "completion_rate": 7.69,
    "avg_completion_time_hours": 0.12
  },
  "recently_completed": [
    {
      "task_id": "2ad5ee0a-091e-4548-8215-77fee56d4514",
      "title": "Design database schema for project archival system",
      "project_id": "88eab363-b647-4141-9383-1d65e4504be8",
      "completed_at": "2025-12-21T17:18:35.813846+00:00",
      "completed_by": "Archon",
      "time_to_complete": "00:05:20"
    }
  ],
  "count": 1
}
```

## Testing Commands

### Using curl

```bash
# Archive a project
curl -X POST http://localhost:8181/api/projects/88eab363-b647-4141-9383-1d65e4504be8/archive \
  -H "Content-Type: application/json" \
  -d '{"archived_by": "TestUser"}'

# Unarchive a project
curl -X POST http://localhost:8181/api/projects/88eab363-b647-4141-9383-1d65e4504be8/unarchive

# Get task history
curl "http://localhost:8181/api/tasks/2ad5ee0a-091e-4548-8215-77fee56d4514/history"

# Get task history for specific field
curl "http://localhost:8181/api/tasks/2ad5ee0a-091e-4548-8215-77fee56d4514/history?field_name=status&limit=10"

# Get completion stats (all projects, last 7 days)
curl "http://localhost:8181/api/tasks/completion-stats"

# Get completion stats for specific project
curl "http://localhost:8181/api/tasks/completion-stats?project_id=88eab363-b647-4141-9383-1d65e4504be8"

# Get completion stats for last 30 days
curl "http://localhost:8181/api/tasks/completion-stats?days=30&limit=100"
```

### Using MCP Tools (via Claude Code)

```python
# Archive a project
await manage_project("archive", project_id="88eab363-b647-4141-9383-1d65e4504be8", archived_by="Claude")

# Unarchive a project
await manage_project("unarchive", project_id="88eab363-b647-4141-9383-1d65e4504be8")

# Get task history
await get_task_history(task_id="2ad5ee0a-091e-4548-8215-77fee56d4514")

# Get task history for status changes only
await get_task_history(task_id="2ad5ee0a-091e-4548-8215-77fee56d4514", field_name="status")

# Get completion stats
await get_completion_stats(project_id="88eab363-b647-4141-9383-1d65e4504be8", days=7)
```

## Implementation Notes

### Database Function Calls

All service methods use Supabase RPC to call PostgreSQL functions:

```python
# Archive project
response = self.supabase_client.rpc(
    "archive_project_and_tasks",
    {"project_id_param": project_id, "archived_by_param": archived_by}
).execute()

# Get task history
response = self.supabase_client.rpc(
    "get_task_history",
    {
        "task_id_param": task_id,
        "field_name_param": field_name,
        "limit_param": limit
    }
).execute()

# Get completion stats
response = self.supabase_client.rpc(
    "get_project_completion_stats",
    {"project_id_param": project_id}
).execute()
```

### Error Handling

All endpoints follow consistent error handling pattern:
1. Service layer returns `(success, result)` tuple
2. API layer checks success and raises HTTPException with appropriate status code
3. All operations logged with logfire for observability
4. 404 for "not found" errors, 500 for other errors

### Backward Compatibility

- `list_projects()` defaults to `include_archived=False` to maintain backward compatibility
- Existing API endpoints unchanged
- New fields (`archived`, `completed_at`, `completed_by`) added without breaking existing responses

## Next Steps

✅ **Service Layer Implementation: COMPLETE**

**Next**: Code review and testing

1. **Unit Tests** (see testing tasks in Archon project)
2. **Integration Tests** (end-to-end workflow testing)
3. **Performance Tests** (query optimization for historical data)
4. **Code Review** (final review before deployment)

## Summary

All service layer components are now implemented:

✅ ProjectService - archive/unarchive methods
✅ TaskService - history and completion stats methods
✅ API Routes - 4 new endpoints
✅ MCP Tools - connected to API endpoints
✅ Database Functions - already tested and working

The complete Phase 0 stack is ready for testing:

```
MCP Tools (project_tools.py, task_tools.py)
    ↓
API Endpoints (projects_api.py)
    ↓
Service Layer (project_service.py, task_service.py)
    ↓
PostgreSQL Functions (migrations 001, 002, 003)
    ↓
Database Tables (archon_projects, archon_tasks, archon_task_history)
```
