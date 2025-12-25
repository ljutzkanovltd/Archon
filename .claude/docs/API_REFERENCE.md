# API Reference - Archon Knowledge Base

Complete API documentation for Archon REST API and MCP endpoints.

---

## Base URLs

- **Backend API**: http://localhost:8181
- **MCP Server**: http://localhost:8051
- **Dashboard UI**: http://localhost:3737

---

## Knowledge Base API

### Search Documents

Search indexed documentation using text queries.

**Endpoint**: `GET /api/v1/docs/search`

**Query Parameters**:
- `q` (required): Search query string
- `project` (optional): Filter by project name
- `limit` (optional): Maximum results (default: 10)

**Example**:
```bash
curl "http://localhost:8181/api/v1/docs/search?q=authentication&project=frontend&limit=5"
```

**Response**:
```json
{
  "results": [
    {
      "id": "doc-123",
      "title": "Authentication Patterns",
      "content": "...",
      "project": "frontend",
      "score": 0.95
    }
  ],
  "total": 42,
  "page": 1
}
```

### Get Document

Retrieve a specific document by ID.

**Endpoint**: `GET /api/v1/docs/{doc_id}`

**Path Parameters**:
- `doc_id` (required): Document UUID

**Example**:
```bash
curl "http://localhost:8181/api/v1/docs/doc-123"
```

**Response**:
```json
{
  "id": "doc-123",
  "title": "Authentication Patterns",
  "content": "Full document content...",
  "metadata": {
    "project": "frontend",
    "created_at": "2025-12-16T10:00:00Z",
    "updated_at": "2025-12-16T15:30:00Z"
  }
}
```

### List Documents

List all documents, optionally filtered by project.

**Endpoint**: `GET /api/v1/docs`

**Query Parameters**:
- `project` (optional): Filter by project name
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (default: 10)

**Example**:
```bash
curl "http://localhost:8181/api/v1/docs?project=sporterp-api&page=1&per_page=20"
```

### Index Document

Add a document to the knowledge base.

**Endpoint**: `POST /api/v1/docs/index`

**Request Body**:
```json
{
  "path": "/path/to/doc.md",
  "content": "Document content here...",
  "metadata": {
    "project": "archon",
    "category": "documentation",
    "tags": ["setup", "guide"]
  }
}
```

**Example**:
```bash
curl -X POST "http://localhost:8181/api/v1/docs/index" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/docs/SETUP.md",
    "content": "# Setup Guide\n\nInstall dependencies...",
    "metadata": {"project": "archon", "tags": ["setup"]}
  }'
```

**Response**:
```json
{
  "id": "doc-456",
  "message": "Document indexed successfully"
}
```

---

## Task API

### Create Task

Create a new task in the task management system.

**Endpoint**: `POST /api/v1/tasks`

**Request Body**:
```json
{
  "project": "sporterp-frontend",
  "title": "Implement feature",
  "description": "Detailed task description...",
  "priority": "high",
  "tags": ["frontend", "feature"],
  "assigned_to": "developer@example.com"
}
```

**Example**:
```bash
curl -X POST "http://localhost:8181/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "project": "sporterp-frontend",
    "title": "Implement user profile page",
    "description": "Create user profile page with edit functionality",
    "priority": "high"
  }'
```

**Response**:
```json
{
  "id": "task-789",
  "project": "sporterp-frontend",
  "title": "Implement user profile page",
  "status": "todo",
  "created_at": "2025-12-16T16:00:00Z"
}
```

### List Tasks

Retrieve tasks, optionally filtered by status or project.

**Endpoint**: `GET /api/v1/tasks`

**Query Parameters**:
- `status` (optional): Filter by status (todo, in_progress, done, blocked)
- `project` (optional): Filter by project name
- `assigned_to` (optional): Filter by assignee
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (default: 10)

**Example**:
```bash
curl "http://localhost:8181/api/v1/tasks?status=todo&project=sporterp-api"
```

**Response**:
```json
{
  "tasks": [
    {
      "id": "task-789",
      "title": "Implement order endpoint",
      "status": "todo",
      "priority": "high",
      "project": "sporterp-api"
    }
  ],
  "total": 15,
  "page": 1
}
```

### Get Task

Retrieve a specific task by ID.

**Endpoint**: `GET /api/v1/tasks/{task_id}`

**Path Parameters**:
- `task_id` (required): Task UUID

**Example**:
```bash
curl "http://localhost:8181/api/v1/tasks/task-789"
```

### Update Task

Update an existing task.

**Endpoint**: `PUT /api/v1/tasks/{task_id}`

**Request Body** (partial update supported):
```json
{
  "status": "in_progress",
  "assigned_to": "developer@example.com"
}
```

**Example**:
```bash
curl -X PUT "http://localhost:8181/api/v1/tasks/task-789" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

### Delete Task

Delete a task.

**Endpoint**: `DELETE /api/v1/tasks/{task_id}`

**Example**:
```bash
curl -X DELETE "http://localhost:8181/api/v1/tasks/task-789"
```

**Response**:
```json
{
  "message": "Task deleted successfully"
}
```

---

## MCP Endpoint

The MCP (Model Context Protocol) endpoint enables AI assistants to interact with Archon's knowledge base.

### MCP Request Format

**Endpoint**: `POST http://localhost:8051/mcp`

**Request Headers**:
- `Content-Type: application/json`

**Request Body** (JSON-RPC 2.0):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "search_docs",
  "params": {
    "query": "authentication"
  }
}
```

### Supported MCP Methods

#### search_docs

Search documentation using text or semantic search.

**Parameters**:
- `query` (required): Search query string
- `project` (optional): Filter by project
- `limit` (optional): Maximum results

**Example**:
```bash
curl -X POST "http://localhost:8051/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "search_docs",
    "params": {
      "query": "authentication",
      "limit": 5
    }
  }'
```

#### get_doc

Retrieve a specific document.

**Parameters**:
- `path` (required): Document path or ID

**Example**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "get_doc",
  "params": {
    "path": "/docs/SETUP.md"
  }
}
```

#### list_docs

List available documents.

**Parameters**:
- `filter` (optional): Filter criteria
- `project` (optional): Filter by project

**Example**:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "list_docs",
  "params": {
    "project": "archon"
  }
}
```

#### get_code_examples

Find code examples by topic.

**Parameters**:
- `topic` (required): Topic or technology (e.g., "FastAPI JWT")
- `language` (optional): Programming language filter

**Example**:
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "get_code_examples",
  "params": {
    "topic": "FastAPI JWT",
    "language": "python"
  }
}
```

---

## Backup API

### Get Backup Status

Retrieve current backup status for monitoring.

**Endpoint**: `GET /api/backup/status`

**Example**:
```bash
curl "http://localhost:8181/api/backup/status"
```

**Response**:
```json
{
  "source": "archon",
  "latest_backup": "2025-12-16T02:00:00Z",
  "age_hours": 14.5,
  "size_bytes": 471859200,
  "size_human": "450.0 MB",
  "count": 8,
  "max_retention": 10,
  "health": "healthy",
  "health_message": "Backup is fresh (14.5h old)"
}
```

### List Backups

List all available backup files.

**Endpoint**: `GET /api/backup/list`

**Example**:
```bash
curl "http://localhost:8181/api/backup/list"
```

### Check Backup Health

Quick boolean health check.

**Endpoint**: `GET /api/backup/health`

**Example**:
```bash
curl "http://localhost:8181/api/backup/health"
```

**Response**:
```json
{
  "healthy": true
}
```

---

## Error Responses

All API endpoints return standard error responses:

**Format**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameter",
    "details": {
      "field": "limit",
      "reason": "Must be between 1 and 100"
    }
  }
}
```

**HTTP Status Codes**:
- `200 OK`: Successful request
- `201 Created`: Resource created
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Rate Limiting

**Limits**:
- Anonymous requests: 60 requests/hour
- Authenticated requests: 600 requests/hour
- Burst limit: 10 requests/second

**Headers**:
- `X-RateLimit-Limit`: Total request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp for limit reset

---

## Authentication

**Service Key Authentication** (for admin operations):

```bash
curl "http://localhost:8181/api/v1/tasks" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"
```

**API Key Authentication** (for programmatic access):

```bash
curl "http://localhost:8181/api/v1/docs/search?q=auth" \
  -H "X-API-Key: YOUR_API_KEY"
```

---

## Task Structure Reference

Complete field reference for the Task data model (enhanced for agentic workflows).

### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | Auto | Unique task identifier |
| `project_id` | string (UUID) | **Yes** | Project UUID (REQUIRED for crash recovery) |
| `title` | string | **Yes** | Task title (verb + noun format) |
| `description` | string | **Yes** | Detailed description with acceptance criteria |
| `status` | enum | **Yes** | Task status: `todo`, `doing`, `review`, `done` |
| `priority` | enum | No | Priority level: `low`, `medium`, `high`, `urgent` |

### Agentic Workflow Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `task_type` | string | No | Task classification: `Planning`, `Architecture`, `Research`, `Implementation`, `Testing`, `Documentation`, `Optimization` |
| `assignee` | string | No | Agent name (e.g., `planner`, `ui-implementation-expert`, `backend-api-expert`) |
| `created_by_agent` | string | No | Which agent created this task (typically `planner`) |
| `estimated_hours` | float | No | Estimated effort (0.5-4.0 hours, ENFORCED) |
| `actual_hours` | float | No | Actual time spent (auto-tracked on completion) |

### Dependency Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dependencies` | array[UUID] | No | List of task IDs that must complete first |
| `parent_task_id` | UUID | No | Parent task in hierarchy |
| `validation_status` | enum | No | Validation state: `pending`, `approved`, `rejected` |

### Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tags` | array[string] | No | Tags for categorization |
| `feature` | string | No | Feature label for grouping |
| `task_order` | integer | No | Priority ranking (0-100, higher = more priority) |
| `due_date` | datetime | No | Task due date (ISO 8601) |
| `metadata` | object | No | Additional custom metadata |

### Timestamp Fields

| Field | Type | Description |
|-------|------|-------------|
| `created_at` | datetime | Task creation timestamp |
| `updated_at` | datetime | Last update timestamp |
| `completed_at` | datetime | Completion timestamp (null if not done) |
| `completed_by` | string | Who completed the task (auto-set on status=done) |

---

## Detailed Task Operations

### Create Task with Agentic Fields

**Endpoint**: `POST /api/v1/tasks`

**Full Example**:
```bash
curl -X POST "http://localhost:8181/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "d80817df-6294-4e66-9b43-cbafb15da400",
    "title": "Implement: User authentication API",
    "description": "Create JWT-based auth endpoints with refresh token support. Acceptance: Login/logout/refresh endpoints, token validation middleware, 80% test coverage.",
    "task_type": "Implementation",
    "assignee": "backend-api-expert",
    "estimated_hours": 3.5,
    "priority": "high",
    "tags": ["backend", "auth", "api"],
    "dependencies": [],
    "metadata": {
      "tech_stack": ["FastAPI", "JWT", "Pydantic"]
    }
  }'
```

**Response**:
```json
{
  "id": "abc-123",
  "project_id": "d80817df-6294-4e66-9b43-cbafb15da400",
  "title": "Implement: User authentication API",
  "status": "todo",
  "assignee": "backend-api-expert",
  "estimated_hours": 3.5,
  "created_at": "2025-12-25T10:00:00Z",
  "updated_at": "2025-12-25T10:00:00Z"
}
```

### Update Task (Status Progression)

**Example: Move task through workflow**:
```bash
# Start work (todo → doing)
curl -X PUT "http://localhost:8181/api/v1/tasks/abc-123" \
  -H "Content-Type: application/json" \
  -d '{"status": "doing"}'

# Submit for review (doing → review)
curl -X PUT "http://localhost:8181/api/v1/tasks/abc-123" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "review",
    "actual_hours": 3.2
  }'

# Complete task (review → done)
curl -X PUT "http://localhost:8181/api/v1/tasks/abc-123" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "done",
    "completed_by": "developer@example.com"
  }'
```

### List Tasks with Filters

**Filter by multiple criteria**:
```bash
# Tasks for project in "doing" status
curl "http://localhost:8181/api/v1/tasks?project_id=d80817df&status=doing"

# Tasks assigned to specific agent
curl "http://localhost:8181/api/v1/tasks?assignee=ui-implementation-expert"

# Tasks with dependencies (advanced query)
curl "http://localhost:8181/api/v1/tasks?has_dependencies=true"

# Search by keyword
curl "http://localhost:8181/api/v1/tasks?query=authentication"
```

### Task Dependencies Example

**Creating dependent tasks**:
```bash
# Step 1: Create parent task (architecture)
curl -X POST "http://localhost:8181/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "d80817df-6294-4e66-9b43-cbafb15da400",
    "title": "Design: System architecture",
    "assignee": "architect",
    "estimated_hours": 2.0
  }'
# Response: {"id": "arch-task-id", ...}

# Step 2: Create dependent task (implementation waits for architecture)
curl -X POST "http://localhost:8181/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "d80817df-6294-4e66-9b43-cbafb15da400",
    "title": "Implement: API endpoints",
    "assignee": "backend-api-expert",
    "estimated_hours": 3.5,
    "dependencies": ["arch-task-id"]
  }'
```

---

## Task History API

Retrieve change history for audit trails and analytics.

**Endpoint**: `GET /api/tasks/{task_id}/history`

**Query Parameters**:
- `field_name` (optional): Filter by field (e.g., `status`, `assignee`, `priority`)
- `limit` (optional): Maximum results (default: 50)

**Example**:
```bash
# All changes
curl "http://localhost:8181/api/tasks/abc-123/history"

# Only status changes
curl "http://localhost:8181/api/tasks/abc-123/history?field_name=status"

# Last 10 changes
curl "http://localhost:8181/api/tasks/abc-123/history?limit=10"
```

**Response**:
```json
{
  "task_id": "abc-123",
  "changes": [
    {
      "change_id": "uuid-1",
      "field_name": "status",
      "old_value": "doing",
      "new_value": "done",
      "changed_by": "developer@example.com",
      "changed_at": "2025-12-25T17:29:09Z",
      "change_reason": null
    },
    {
      "change_id": "uuid-2",
      "field_name": "assignee",
      "old_value": null,
      "new_value": "backend-api-expert",
      "changed_by": "planner",
      "changed_at": "2025-12-25T10:00:00Z",
      "change_reason": "Assigned by planner agent"
    }
  ],
  "count": 2
}
```

**Tracked Fields**: `status`, `assignee`, `priority`, `title`, `description`, `task_order`, `feature`

---

## Completion Statistics API

Get project completion metrics and velocity tracking.

**Endpoint**: `GET /api/tasks/completion-stats`

**Query Parameters**:
- `project_id` (optional): Filter by project UUID
- `days` (optional): Lookback period in days (default: 7)
- `limit` (optional): Max recently completed tasks to return (default: 50)

**Examples**:
```bash
# Project-specific stats (last 7 days)
curl "http://localhost:8181/api/tasks/completion-stats?project_id=d80817df-6294"

# All projects (last 30 days)
curl "http://localhost:8181/api/tasks/completion-stats?days=30"

# Weekly velocity tracking
curl "http://localhost:8181/api/tasks/completion-stats?project_id=d80817df-6294&days=7&limit=100"
```

**Response**:
```json
{
  "stats": {
    "total_tasks": 31,
    "completed_tasks": 9,
    "in_progress_tasks": 5,
    "completion_rate": 29.03,
    "avg_completion_time_hours": 2.8
  },
  "recently_completed": [
    {
      "id": "task-1",
      "title": "Implement auth endpoint",
      "completed_at": "2025-12-24T15:00:00Z",
      "actual_hours": 3.2,
      "estimated_hours": 3.5
    },
    {
      "id": "task-2",
      "title": "Write unit tests",
      "completed_at": "2025-12-23T18:30:00Z",
      "actual_hours": 1.8,
      "estimated_hours": 2.0
    }
  ],
  "project_id": "d80817df-6294-4e66-9b43-cbafb15da400",
  "period_days": 7
}
```

**Use Cases**:
- Sprint velocity calculation
- Capacity planning
- Estimation accuracy tracking
- Team performance metrics

---

## Project Archival API

Soft-delete projects and associated tasks for lifecycle management.

### Archive Project

**Endpoint**: `POST /api/projects/{project_id}/archive`

**Request Body**:
```json
{
  "archived_by": "admin@example.com"
}
```

**Example**:
```bash
curl -X POST "http://localhost:8181/api/projects/d80817df-6294/archive" \
  -H "Content-Type: application/json" \
  -d '{"archived_by": "admin@example.com"}'
```

**Response**:
```json
{
  "project_id": "d80817df-6294-4e66-9b43-cbafb15da400",
  "archived": true,
  "archived_at": "2025-12-25T12:00:00Z",
  "archived_by": "admin@example.com",
  "tasks_archived": 15,
  "message": "Project and all associated tasks archived successfully"
}
```

**Effects**:
- Project hidden from default listings (require `include_archived=true` to see)
- All associated tasks automatically archived (cascading)
- History preserved indefinitely
- Can be restored via unarchive endpoint

### Unarchive Project

**Endpoint**: `POST /api/projects/{project_id}/unarchive`

**Example**:
```bash
curl -X POST "http://localhost:8181/api/projects/d80817df-6294/unarchive"
```

**Response**:
```json
{
  "project_id": "d80817df-6294-4e66-9b43-cbafb15da400",
  "archived": false,
  "unarchived_at": "2025-12-25T14:00:00Z",
  "tasks_restored": 15,
  "message": "Project and all associated tasks restored successfully"
}
```

### List Projects (with archival filtering)

**Endpoint**: `GET /api/projects`

**Query Parameters**:
- `include_archived` (optional): Include archived projects (default: false)

**Examples**:
```bash
# Active projects only (default)
curl "http://localhost:8181/api/projects"

# All projects (including archived)
curl "http://localhost:8181/api/projects?include_archived=true"
```

**Response** (with archival info):
```json
{
  "projects": [
    {
      "id": "d80817df-6294-4e66-9b43-cbafb15da400",
      "title": "Auth System Refactor",
      "archived": false,
      "created_at": "2025-11-01T00:00:00Z"
    },
    {
      "id": "old-project-id",
      "title": "Legacy Feature",
      "archived": true,
      "archived_at": "2025-10-15T12:00:00Z",
      "archived_by": "admin@example.com"
    }
  ],
  "total": 2,
  "active": 1,
  "archived": 1
}
```

---

**Related Documentation**:
- Main CLAUDE.md: `@.claude/CLAUDE.md`
- Agentic Workflow: `@.claude/docs/AGENTIC_WORKFLOW.md`
- MCP Integration: Main CLAUDE.md, MCP Integration section
- Task Management: Main CLAUDE.md, Task Management section
- Best Practices: `@.claude/docs/BEST_PRACTICES.md`
