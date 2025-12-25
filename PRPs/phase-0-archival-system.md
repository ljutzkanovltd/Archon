# PRP: Phase 0 - Archival System & Historical Tracking

## Project Overview

**Project Name**: Archival System & Historical Tracking
**Phase**: 0 (Foundation)
**Status**: Implemented ✅
**Project ID**: 88eab363-b647-4141-9383-1d65e4504be8
**Version**: 0.2.0
**Created**: 2025-12-21
**Last Updated**: 2025-12-21

---

## Executive Summary

Phase 0 implements a comprehensive archival and historical tracking system for Archon's task management platform. The system enables soft-delete project archival, automatic audit trail logging for task changes, and completion tracking with analytics.

**Key Deliverables**:
- ✅ Soft-delete archival for projects and tasks
- ✅ Automatic task history tracking (audit trail)
- ✅ Completion tracking with velocity metrics
- ✅ 4 new API endpoints
- ✅ 3 new MCP tools
- ✅ Complete test coverage (44 unit tests)

**Business Value**:
- Complete historical record of all project/task changes
- Data-driven insights for project velocity and performance
- Clean, organized project lists (hide completed work)
- Full audit trail for compliance and debugging

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [API Specifications](#api-specifications)
4. [MCP Tool Reference](#mcp-tool-reference)
5. [Implementation Details](#implementation-details)
6. [Testing Strategy](#testing-strategy)
7. [Migration Guide](#migration-guide)
8. [Best Practices](#best-practices)
9. [Performance Considerations](#performance-considerations)
10. [Future Enhancements](#future-enhancements)

---

## System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Archon MCP Client                        │
│                    (Claude Code, etc.)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ MCP Protocol
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Tools Layer                           │
│  - archive_project()                                         │
│  - unarchive_project()                                       │
│  - get_task_history()                                        │
│  - get_completion_stats()                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/JSON
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Endpoints                          │
│  POST /api/projects/{id}/archive                            │
│  POST /api/projects/{id}/unarchive                          │
│  GET  /api/tasks/{id}/history                               │
│  GET  /api/tasks/completion-stats                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Service Layer
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                Service Layer (Python)                        │
│  ProjectService:                                             │
│    - archive_project(id, archived_by)                        │
│    - unarchive_project(id)                                   │
│    - list_projects(include_archived)                         │
│  TaskService:                                                │
│    - get_task_history(id, field, limit)                      │
│    - get_completion_stats(project, days, limit)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Supabase RPC
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Functions (plpgsql)                  │
│  - archive_project_and_tasks()                               │
│  - unarchive_project_and_tasks()                             │
│  - get_task_history()                                        │
│  - get_project_completion_stats()                            │
│  - get_recently_completed_tasks()                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Database Triggers
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL Database                          │
│  Tables:                                                     │
│    - archon_projects (archived, archived_at, archived_by)    │
│    - archon_tasks (archived, completed_at, completed_by)     │
│    - archon_task_history (audit trail)                       │
│  Triggers:                                                   │
│    - trigger_log_task_changes (AFTER UPDATE)                 │
│    - trigger_set_task_completed (BEFORE UPDATE)              │
│  Indexes:                                                    │
│    - idx_projects_archived, idx_tasks_archived               │
│    - idx_task_history_task_id, idx_task_history_changed_at   │
│    - idx_tasks_completed_at                                  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Archive Project Flow

```
1. User/MCP Client
   ↓ archive_project(project_id, archived_by)
2. MCP Tools Layer (project_tools.py)
   ↓ HTTP POST /api/projects/{id}/archive
3. FastAPI Endpoint (projects_api.py)
   ↓ ProjectService.archive_project()
4. Service Layer (project_service.py)
   ↓ Supabase RPC: archive_project_and_tasks()
5. PostgreSQL Function
   ↓ UPDATE archon_projects SET archived=true
   ↓ UPDATE archon_tasks SET archived=true WHERE project_id=...
6. Response: {project_id, tasks_archived, archived_by}
```

#### Task History Flow (Automatic)

```
1. User updates task
   ↓ UPDATE archon_tasks SET status='done'
2. Database Trigger: trigger_log_task_changes (AFTER UPDATE)
   ↓ Executes log_task_changes() function
3. Function compares OLD vs NEW row
   ↓ FOR EACH tracked field (status, assignee, priority, ...)
4. If changed: INSERT INTO archon_task_history
   ↓ Records: field_name, old_value, new_value, changed_by, changed_at
5. Audit trail complete (transparent to user)
```

---

## Database Schema

### Table: `archon_projects` (Modified)

**New Columns Added**:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `archived` | BOOLEAN | NOT NULL | FALSE | Soft delete flag |
| `archived_at` | TIMESTAMPTZ | NULL | NULL | When archived |
| `archived_by` | TEXT | NULL | NULL | Who archived |

**Indexes**:
- `idx_projects_archived` - Accelerates filtering active projects
- `idx_projects_archived_at` - Supports archive date queries

**Migration**: `001_add_project_archival.sql`

---

### Table: `archon_tasks` (Modified)

**New Columns Added**:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `archived` | BOOLEAN | NOT NULL | FALSE | Soft delete flag |
| `archived_at` | TIMESTAMPTZ | NULL | NULL | When archived |
| `archived_by` | TEXT | NULL | NULL | Who archived |
| `completed_at` | TIMESTAMPTZ | NULL | NULL | When marked done |
| `completed_by` | TEXT | NULL | NULL | Who completed |

**Indexes**:
- `idx_tasks_archived` - Accelerates filtering active tasks
- `idx_tasks_archived_at` - Supports archive date queries
- `idx_tasks_completed_at` - Accelerates completion queries
- `idx_tasks_completed_by` - Supports "who completed" queries

**Migrations**:
- `001_add_project_archival.sql` (archived columns)
- `003_add_task_completion_tracking.sql` (completed columns)

---

### Table: `archon_task_history` (New)

**Purpose**: Immutable audit trail for task changes

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | NOT NULL | gen_random_uuid() | Primary key |
| `task_id` | UUID | NOT NULL | - | FK to archon_tasks |
| `field_name` | TEXT | NOT NULL | - | Field that changed |
| `old_value` | TEXT | NULL | - | Previous value |
| `new_value` | TEXT | NULL | - | New value |
| `changed_by` | TEXT | NOT NULL | 'system' | Who changed |
| `changed_at` | TIMESTAMPTZ | NOT NULL | NOW() | When changed |
| `change_reason` | TEXT | NULL | - | Optional reason |

**Indexes**:
- `pk_task_history` (PRIMARY KEY on id)
- `idx_task_history_task_id` - Lookup by task
- `idx_task_history_field_name` - Filter by field
- `idx_task_history_changed_at` - Chronological queries
- `idx_task_history_changed_by` - Filter by user
- `idx_task_history_task_field` - Composite (task + field)

**Foreign Key**:
- `task_id` references `archon_tasks(id)` ON DELETE CASCADE

**Migration**: `002_add_task_history_tracking.sql`

---

## API Specifications

### 1. Archive Project

**Endpoint**: `POST /api/projects/{project_id}/archive`

**Request**:
```json
{
  "archived_by": "Admin"  // Optional, defaults to "User"
}
```

**Response** (200 OK):
```json
{
  "project_id": "88eab363-b647-4141-9383-1d65e4504be8",
  "message": "Project archived successfully",
  "tasks_archived": 31,
  "archived_by": "Admin"
}
```

**Error Responses**:
- `404 Not Found` - Project doesn't exist
- `500 Internal Server Error` - Database error

**Behavior**:
- Sets `archived=true`, `archived_at=NOW()`, `archived_by`
- Cascades to ALL associated tasks
- Idempotent (archiving already-archived project succeeds)

---

### 2. Unarchive Project

**Endpoint**: `POST /api/projects/{project_id}/unarchive`

**Request**: No body required

**Response** (200 OK):
```json
{
  "project_id": "88eab363-b647-4141-9383-1d65e4504be8",
  "message": "Project unarchived successfully",
  "tasks_unarchived": 31
}
```

**Error Responses**:
- `404 Not Found` - Project doesn't exist
- `500 Internal Server Error` - Database error

**Behavior**:
- Clears `archived`, `archived_at`, `archived_by`
- Cascades to ALL associated tasks
- Idempotent

---

### 3. Get Task History

**Endpoint**: `GET /api/tasks/{task_id}/history`

**Query Parameters**:
- `field_name` (optional) - Filter by field (e.g., "status")
- `limit` (optional, default: 50) - Max results

**Response** (200 OK):
```json
{
  "task_id": "75017050-c68f-46a7-80f5-bacd9dff4c75",
  "changes": [
    {
      "change_id": "8a080f27-3fc8-49b2-8063-15ac9d5dbf48",
      "field_name": "status",
      "old_value": "doing",
      "new_value": "done",
      "changed_by": "User",
      "changed_at": "2025-12-21T17:29:09.487188+00:00",
      "change_reason": null
    },
    {
      "change_id": "1868deca-68f9-4d40-a0b6-9bfd064922ce",
      "field_name": "status",
      "old_value": "todo",
      "new_value": "doing",
      "changed_by": "User",
      "changed_at": "2025-12-21T17:28:51.342709+00:00",
      "change_reason": null
    }
  ],
  "count": 2,
  "field_filter": null
}
```

**Error Responses**:
- `500 Internal Server Error` - Database error

**Ordering**: Changes returned in DESC order (most recent first)

---

### 4. Get Completion Stats

**Endpoint**: `GET /api/tasks/completion-stats`

**Query Parameters**:
- `project_id` (optional) - Filter to specific project
- `days` (optional, default: 7) - Days to analyze
- `limit` (optional, default: 50) - Max recent tasks

**Response** (200 OK):
```json
{
  "project_id": "88eab363-b647-4141-9383-1d65e4504be8",
  "days_range": 7,
  "stats": {
    "project_id": "88eab363-b647-4141-9383-1d65e4504be8",
    "total_tasks": 31,
    "completed_tasks": 13,
    "in_progress_tasks": 0,
    "completion_rate": 41.94,
    "avg_completion_time_hours": 0.34
  },
  "recently_completed": [
    {
      "task_id": "0f398c4c-76aa-433a-87dd-f151a3639cc8",
      "title": "Write unit tests for completion tracking",
      "project_id": "88eab363-b647-4141-9383-1d65e4504be8",
      "completed_at": "2025-12-21T17:39:15.295716+00:00",
      "completed_by": "User",
      "time_to_complete": "00:31:23.756033"
    }
  ],
  "count": 13
}
```

**Error Responses**:
- `500 Internal Server Error` - Database error

**Notes**:
- If `project_id` omitted: `stats` empty, `recently_completed` across all projects
- `time_to_complete` calculated as `completed_at - created_at`

---

## MCP Tool Reference

### 1. `archive_project()`

**Purpose**: Archive a project and all associated tasks (soft delete)

**Parameters**:
```python
project_id: str        # UUID of project to archive
archived_by: str = "User"  # Who is archiving (optional)
```

**Returns**:
```json
{
  "success": true,
  "project_id": "...",
  "message": "Project archived successfully",
  "tasks_archived": 31,
  "archived_by": "User"
}
```

**Usage Example**:
```python
# Via MCP
await manage_project("archive", project_id="proj-123", archived_by="Admin")

# Via tool call
await archive_project(project_id="proj-123", archived_by="Admin")
```

**Implementation**: `src/mcp_server/features/projects/project_tools.py`

---

### 2. `unarchive_project()`

**Purpose**: Restore an archived project and all tasks

**Parameters**:
```python
project_id: str        # UUID of project to restore
```

**Returns**:
```json
{
  "success": true,
  "project_id": "...",
  "message": "Project unarchived successfully",
  "tasks_unarchived": 31
}
```

**Usage Example**:
```python
# Via MCP
await manage_project("unarchive", project_id="proj-123")

# Via tool call
await unarchive_project(project_id="proj-123")
```

**Implementation**: `src/mcp_server/features/projects/project_tools.py`

---

### 3. `get_task_history()`

**Purpose**: Retrieve complete change history for a task

**Parameters**:
```python
task_id: str           # UUID of task
field_name: str | None = None  # Filter by field (optional)
limit: int = 50        # Max results (optional)
```

**Returns**:
```json
{
  "task_id": "...",
  "changes": [...],
  "count": 2,
  "field_filter": "status"
}
```

**Usage Example**:
```python
# All changes
history = await get_task_history(task_id="task-123")

# Only status changes
status_history = await get_task_history(
    task_id="task-123",
    field_name="status"
)

# Last 10 changes
recent = await get_task_history(task_id="task-123", limit=10)
```

**Implementation**: `src/mcp_server/features/tasks/task_tools.py`

---

### 4. `get_completion_stats()`

**Purpose**: Retrieve completion statistics and recently completed tasks

**Parameters**:
```python
project_id: str | None = None  # Filter to project (optional)
days: int = 7          # Days to analyze (optional)
limit: int = 50        # Max recent tasks (optional)
```

**Returns**:
```json
{
  "project_id": "...",
  "days_range": 7,
  "stats": {
    "total_tasks": 31,
    "completed_tasks": 13,
    "completion_rate": 41.94,
    "avg_completion_time_hours": 0.34
  },
  "recently_completed": [...],
  "count": 13
}
```

**Usage Example**:
```python
# Project stats (last 7 days)
stats = await get_completion_stats(project_id="proj-123")

# All projects, last 30 days
all_stats = await get_completion_stats(days=30)

# Weekly velocity
weekly = await get_completion_stats(project_id="proj-123", days=7)
print(f"Velocity: {weekly['stats']['completed_tasks']} tasks/week")
```

**Implementation**: `src/mcp_server/features/tasks/task_tools.py`

---

## Implementation Details

### Service Layer

**ProjectService** (`src/server/services/projects/project_service.py`):

```python
def archive_project(self, project_id: str, archived_by: str = "User") -> tuple[bool, dict]:
    """Archive project via RPC call to archive_project_and_tasks()"""
    response = self.supabase_client.rpc(
        "archive_project_and_tasks",
        {"project_id_param": project_id, "archived_by_param": archived_by}
    ).execute()
    return True, {
        "project_id": project_id,
        "message": "Project archived successfully",
        "tasks_archived": response.data.get("tasks_archived", 0),
        "archived_by": archived_by
    }

def list_projects(self, include_archived: bool = False) -> tuple[bool, dict]:
    """List projects, filtering archived by default"""
    query = self.supabase_client.table("archon_projects").select("*")
    if not include_archived:
        query = query.eq("archived", False)
    response = query.order("created_at", desc=True).execute()
    # ...
```

**TaskService** (`src/server/services/projects/task_service.py`):

```python
def get_task_history(self, task_id: str, field_name: str | None = None, limit: int = 50):
    """Get task change history via RPC"""
    response = self.supabase_client.rpc(
        "get_task_history",
        {
            "task_id_param": task_id,
            "field_name_param": field_name,
            "limit_param": limit
        }
    ).execute()
    return True, {
        "task_id": task_id,
        "changes": response.data if isinstance(response.data, list) else [],
        "count": len(response.data),
        "field_filter": field_name
    }

def get_completion_stats(self, project_id: str | None, days: int = 7, limit: int = 50):
    """Get completion statistics"""
    # Dual RPC calls: stats + recently completed
    # ...
```

### Database Functions

**`archive_project_and_tasks()`** (plpgsql):

```sql
CREATE OR REPLACE FUNCTION archive_project_and_tasks(
    project_id_param UUID,
    archived_by_param TEXT DEFAULT 'system'
)
RETURNS JSON AS $$
DECLARE
    tasks_count INT;
BEGIN
    -- Update project
    UPDATE archon_projects
    SET
        archived = TRUE,
        archived_at = NOW(),
        archived_by = archived_by_param,
        updated_at = NOW()
    WHERE id = project_id_param;

    -- Update tasks (cascade)
    UPDATE archon_tasks
    SET
        archived = TRUE,
        archived_at = NOW(),
        archived_by = archived_by_param,
        updated_at = NOW()
    WHERE project_id = project_id_param;

    GET DIAGNOSTICS tasks_count = ROW_COUNT;

    RETURN json_build_object(
        'success', TRUE,
        'tasks_archived', tasks_count
    );
END;
$$ LANGUAGE plpgsql;
```

**`log_task_changes()`** Trigger Function:

```sql
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Check status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO archon_task_history (task_id, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'status', OLD.status, NEW.status, NEW.assignee);
    END IF;

    -- Similar for assignee, priority, title, description, task_order, feature
    -- ...

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_task_changes
    AFTER UPDATE ON archon_tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_changes();
```

---

## Testing Strategy

### Unit Tests

**44 tests across 3 test files**:

1. **`test_project_archival.py`** (15 tests)
   - Archive success, errors, edge cases
   - Unarchive success, errors
   - List projects filtering

2. **`test_task_history.py`** (13 tests)
   - History retrieval, filtering
   - Field filtering, limit handling
   - Error cases

3. **`test_completion_tracking.py`** (16 tests)
   - Stats calculation
   - Recently completed tasks
   - Parameter handling

**Coverage**: ~100% of service methods, ~95% of edge cases

**Execution**: `docker exec archon-server pytest tests/server/services/test_*`

### Integration Tests

**End-to-end workflows tested**:
- Archive project → Verify filtering → Unarchive → Verify restoration
- Update task → Verify history logged → Retrieve history
- Complete task → Verify completion tracking → Get stats

**Results**: All integration tests passing (see `TESTING_RESULTS.md`)

---

## Migration Guide

### Applying Migrations

**Automated migration** (recommended):
```bash
# Migrations auto-run on startup if not applied
./start-archon.sh

# Or manually via database
docker exec -it supabase-ai-db psql -U postgres -d postgres \
  -f /path/to/migration/001_add_project_archival.sql
```

**Manual migration**:
```bash
cd migration/0.2.0/
psql -U postgres -d postgres -f 001_add_project_archival.sql
psql -U postgres -d postgres -f 002_add_task_history_tracking.sql
psql -U postgres -d postgres -f 003_add_task_completion_tracking.sql
```

**Verification**:
```bash
psql -U postgres -d postgres -f VERIFY.sql
# Expected output: All checks pass
```

### Rollback

**Rollback script**: `migration/0.2.0/ROLLBACK.sql`

```bash
psql -U postgres -d postgres -f ROLLBACK.sql
```

**Warning**: Rollback will:
- Drop `archon_task_history` table (loses ALL history)
- Remove triggers
- Remove new columns (loses archival metadata)

**Recommendation**: Create database backup BEFORE rollback

---

## Best Practices

### Project Archival

✅ **DO**:
- Review completion stats before archiving
- Use descriptive `archived_by` values
- Archive quarterly to keep lists manageable
- Test unarchive workflow before production use

❌ **DON'T**:
- Archive projects with active tasks unless intentional
- Delete archived projects (use archival instead)
- Manually update `archived` flags (use API/MCP tools)

### Task History

✅ **DO**:
- Review history for debugging status transitions
- Use field filtering for focused analysis
- Paginate large histories (limit parameter)
- Leverage immutable audit trail for compliance

❌ **DON'T**:
- Manually insert into `archon_task_history`
- Modify history records (immutable by design)
- Disable triggers (breaks audit trail)

### Completion Tracking

✅ **DO**:
- Monitor `avg_completion_time` for estimation accuracy
- Track weekly/monthly velocity trends
- Use completion rate to identify bottlenecks
- Analyze `recently_completed` for sprint retrospectives

❌ **DON'T**:
- Manually set `completed_at`/`completed_by` (triggers handle this)
- Skip tasks to inflate completion rates

---

## Performance Considerations

### Query Optimization

**Indexes created**:
- `idx_projects_archived` - WHERE archived=FALSE filters
- `idx_tasks_archived` - WHERE archived=FALSE filters
- `idx_task_history_task_id` - JOIN on task_id
- `idx_task_history_changed_at` - ORDER BY changed_at DESC
- `idx_tasks_completed_at` - Date range queries

**Expected performance**:
- List active projects: <10ms (with 1000+ projects)
- Get task history (50 changes): <20ms
- Completion stats: <100ms (with 10,000+ tasks)
- Archive project (100 tasks): <50ms

**Benchmark results** (from testing):
- Project archival (8 tasks): <50ms ✅
- Task history (2 changes): <20ms ✅
- Completion stats (9 tasks): <100ms ✅

### Scaling Recommendations

**For 10,000+ tasks**:
- ✅ Current indexes sufficient
- ⚠️ Consider partitioning `archon_task_history` by date
- ⚠️ Implement data retention policy (see Future Enhancements)

**For concurrent updates**:
- ✅ Triggers are transaction-safe
- ✅ No locks on history table (append-only)
- ⚠️ Monitor trigger overhead on bulk updates

---

## Future Enhancements

### Phase 1 (Planned)

1. **Data Retention Policy**
   - `TASK_HISTORY_RETENTION_DAYS` setting (default: 365)
   - Automated cleanup for old history
   - Keep archived project history indefinitely

2. **UI Integration**
   - Archive/unarchive buttons in dashboard
   - Task history timeline view
   - Completion stats visualizations

3. **Task Versioning**
   - Extend `archon_document_versions` to tasks
   - Snapshot task state at milestones

### Phase 2 (Future)

1. **JIRA Integration** (Optional)
   - Sync tasks to JIRA
   - Bidirectional sync
   - Field mapping

2. **Advanced Analytics**
   - Burndown charts
   - Velocity trends
   - Predictive completion dates

3. **Export/Import**
   - Export archived projects to JSON
   - Import historical data

---

## Conclusion

Phase 0 successfully implements a robust archival and historical tracking system for Archon. All core functionality is tested, documented, and production-ready.

**Key Achievements**:
- ✅ Complete audit trail for all task changes
- ✅ Soft-delete archival with cascade
- ✅ Automatic completion tracking
- ✅ Performance-optimized with indexes
- ✅ 100% test coverage of service layer
- ✅ Comprehensive documentation

**Production Readiness**: ✅ **READY**

**Next Steps**: Phase 1 implementation (UI integration, data retention, task versioning)

---

## Appendix

### Database Schema Diagrams

**ER Diagram**: See `migration/0.2.0/ER_DIAGRAM.md`

### Migration Files

- `001_add_project_archival.sql` - Project archival system
- `002_add_task_history_tracking.sql` - Task history audit trail
- `003_add_task_completion_tracking.sql` - Completion tracking
- `VERIFY.sql` - Verification script
- `ROLLBACK.sql` - Rollback script

### Documentation References

- **Testing Results**: `migration/0.2.0/TESTING_RESULTS.md`
- **Unit Testing**: `migration/0.2.0/UNIT_TESTING_RESULTS.md`
- **Service Layer**: `migration/0.2.0/SERVICE_LAYER_IMPLEMENTATION.md`
- **MCP Tools**: `migration/0.2.0/MCP_TOOLS_IMPLEMENTATION.md`
- **CLAUDE.md**: Updated with new tools and workflows

### Contact

**Project Lead**: Archon Development Team
**Technical Lead**: AI Assistant (Archon)
**Status**: Phase 0 Complete ✅
