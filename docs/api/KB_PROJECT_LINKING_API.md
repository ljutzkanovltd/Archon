# KB-Project Bidirectional Linking API Documentation

**Implementation Date:** 2026-01-24
**Phase:** 1.2-1.4
**Task IDs:** f20bbac5, 9dab761d, b98142a1

---

## Overview

This API enables bidirectional linking between Knowledge Base (KB) sources and Projects. Users can:

1. **View backlinks** - See which projects link to a KB source
2. **Link/Unlink** - Manually connect KB sources to projects (reverse direction)
3. **Enhanced AI Suggestions** - Filter suggestions by link status

---

## Endpoints

### 1. Get Source Backlinks (Phase 1.2)

**Endpoint:** `GET /api/knowledge/sources/{source_id}/projects`

**Description:** Returns all projects that link to a specific KB source.

**Authentication:** Required (any authenticated user)

**Path Parameters:**
- `source_id` (string, required) - ID of the knowledge source from `archon_sources` table

**Response:**
```json
{
  "success": true,
  "source_id": "abc123xyz",
  "linked_projects": [
    {
      "project_id": "d80817df-6294-4e66-9b43-cbafb15da400",
      "project_title": "User Authentication System",
      "linked_at": "2026-01-24T10:30:00Z",
      "linked_by": "user@example.com"
    }
  ],
  "total_links": 1
}
```

**Edge Cases:**
- Source exists but has no pages: Returns empty `linked_projects` array
- Source has pages but no links: Returns empty `linked_projects` array
- Source doesn't exist: 404 error

**Example:**
```bash
curl -X GET http://localhost:8181/api/knowledge/sources/abc123xyz/projects \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 2. Link Source to Project (Phase 1.3)

**Endpoint:** `POST /api/projects/{project_id}/knowledge/sources/{source_id}/link`

**Description:** Manually link ALL pages from a KB source to a project.

**Authentication:** Required (`knowledge:manage` permission)

**Path Parameters:**
- `project_id` (UUID, required) - Project to link to
- `source_id` (string, required) - KB source to link from

**Request Body:**
```json
{
  "linked_by": "User"  // Optional, defaults to "User"
}
```

**Response:**
```json
{
  "success": true,
  "links_created": 42,
  "source": {
    "source_id": "abc123xyz",
    "source_url": "https://docs.example.com",
    "source_display_name": "Example Docs",
    "title": "Example Documentation",
    "total_word_count": 50000,
    "metadata": {...}
  }
}
```

**Error Responses:**

| Code | Condition | Response |
|------|-----------|----------|
| 404 | Project not found | `{"error": "Project {id} not found"}` |
| 404 | Source not found | `{"error": "Knowledge source {id} not found"}` |
| 404 | Source has no pages | `{"error": "Source {id} has no indexed pages"}` |
| 409 | All links already exist | `{"error": "All pages from source already linked"}` |

**Example:**
```bash
curl -X POST http://localhost:8181/api/projects/d80817df-6294-4e66-9b43-cbafb15da400/knowledge/sources/abc123xyz/link \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"linked_by": "admin@example.com"}'
```

**Behavior:**
- Creates links for **all pages** in the source (bulk operation)
- Skips pages that are already linked (no duplicates)
- Returns count of **newly created** links only

---

### 3. Unlink Source from Project (Phase 1.3)

**Endpoint:** `DELETE /api/projects/{project_id}/knowledge/sources/{source_id}/link`

**Description:** Remove ALL links between a KB source and a project.

**Authentication:** Required (`knowledge:manage` permission)

**Path Parameters:**
- `project_id` (UUID, required) - Project to unlink from
- `source_id` (string, required) - KB source to unlink

**Response:**
```json
{
  "success": true,
  "links_removed": 42,
  "message": "Links removed successfully"
}
```

**Error Responses:**

| Code | Condition | Response |
|------|-----------|----------|
| 404 | Project not found | `{"error": "Project {id} not found"}` |
| 404 | Source not found | `{"error": "Knowledge source {id} not found"}` |
| 404 | Source has no pages | `{"error": "Source {id} has no indexed pages"}` |
| 404 | No links exist | `{"error": "No links found between source and project"}` |

**Example:**
```bash
curl -X DELETE http://localhost:8181/api/projects/d80817df-6294-4e66-9b43-cbafb15da400/knowledge/sources/abc123xyz/link \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Behavior:**
- Deletes **all links** for pages in this source (bulk operation)
- Returns count of deleted links
- Returns 404 if no links exist (not 200 with count 0)

---

### 4. Enhanced AI Suggestions (Phase 1.4)

**Endpoint:** `GET /api/projects/{project_id}/knowledge/suggestions`

**Description:** Get AI-powered knowledge suggestions with optional link status filtering.

**Authentication:** Required (`knowledge:read` permission)

**Path Parameters:**
- `project_id` (UUID, required) - Project to get suggestions for

**Query Parameters:**
- `limit` (integer, optional, default: 5, max: 20) - Number of suggestions
- `include_linked` (boolean, optional, default: false) - Include already-linked items

**Response (include_linked=false):**
```json
{
  "success": true,
  "suggestions": [
    {
      "knowledge_id": "page-uuid-123",
      "knowledge_type": "rag_page",
      "title": "JWT Authentication Guide",
      "url": "https://docs.example.com/auth/jwt",
      "relevance_score": 0.89,
      "content_preview": "JSON Web Tokens (JWT) are an open standard...",
      "source_id": "abc123xyz",
      "is_linked": false  // NEW FIELD
    }
  ],
  "count": 1,
  "cached": false
}
```

**Response (include_linked=true):**
```json
{
  "success": true,
  "suggestions": [
    {
      "knowledge_id": "page-uuid-456",
      "knowledge_type": "rag_page",
      "title": "OAuth 2.0 Implementation",
      "url": "https://docs.example.com/auth/oauth",
      "relevance_score": 0.92,
      "content_preview": "OAuth 2.0 is the industry-standard protocol...",
      "source_id": "abc123xyz",
      "is_linked": true,  // NEW FIELD
      "linked_at": "2026-01-24T10:30:00Z"  // NEW FIELD (if linked)
    },
    {
      "knowledge_id": "page-uuid-789",
      "knowledge_type": "code_example",
      "title": "FastAPI JWT Middleware",
      "language": "python",
      "relevance_score": 0.85,
      "content_preview": "from fastapi import Depends...",
      "source_id": "def456uvw",
      "is_linked": false
    }
  ],
  "count": 2,
  "cached": false
}
```

**Example (exclude linked):**
```bash
curl -X GET "http://localhost:8181/api/projects/d80817df-6294-4e66-9b43-cbafb15da400/knowledge/suggestions?limit=5&include_linked=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example (include linked):**
```bash
curl -X GET "http://localhost:8181/api/projects/d80817df-6294-4e66-9b43-cbafb15da400/knowledge/suggestions?limit=10&include_linked=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Behavior:**
- `include_linked=false` (default): Returns only **unlinked** items (existing behavior)
- `include_linked=true`: Returns **all** items with `is_linked` flag
- Cache key includes `include_linked` parameter (1-hour TTL)
- All items include `is_linked` boolean field
- Linked items include `linked_at` timestamp

**Use Cases:**
- `include_linked=false`: "Show me new knowledge to link" (discovery)
- `include_linked=true`: "Show me all relevant knowledge, mark what's linked" (audit)

---

### 5. Enhanced Task Suggestions (Phase 1.4)

**Endpoint:** `GET /api/tasks/{task_id}/knowledge/suggestions`

**Description:** Same as project suggestions, but for tasks.

**Authentication:** Required (`knowledge:read` permission)

**Path Parameters:**
- `task_id` (UUID, required) - Task to get suggestions for

**Query Parameters:**
- `project_id` (UUID, required) - Project ID for permission check
- `limit` (integer, optional, default: 5, max: 20)
- `include_linked` (boolean, optional, default: false)

**Response:** Same format as project suggestions (see above)

**Example:**
```bash
curl -X GET "http://localhost:8181/api/tasks/task-uuid-123/knowledge/suggestions?project_id=project-uuid&limit=5&include_linked=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Database Schema

### archon_sources Table

Stores global KB sources (documentation sites).

| Column | Type | Description |
|--------|------|-------------|
| `source_id` | TEXT (PK) | Unique hash identifier (16-char SHA256) |
| `source_url` | TEXT | Original URL that was crawled |
| `source_display_name` | TEXT | Human-readable name for UI |
| `title` | TEXT | Descriptive title |
| `total_word_count` | INTEGER | Total words across all pages |
| `metadata` | JSONB | Additional metadata (knowledge_type, tags) |
| `created_at` | TIMESTAMPTZ | When source was added |
| `updated_at` | TIMESTAMPTZ | Last update time |

### archon_crawled_pages Table

Stores individual pages from KB sources.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL (PK) | Auto-increment ID |
| `page_id` | UUID | Unique page identifier (used for linking) |
| `source_id` | TEXT (FK) | References archon_sources.source_id |
| `url` | VARCHAR | Page URL |
| `section_title` | TEXT | Page title |
| `content` | TEXT | Page content |
| `embedding` | vector(1536) | OpenAI embedding for semantic search |
| ... | ... | Other metadata fields |

### archon_knowledge_links Table

Stores links between projects/tasks/sprints and knowledge items.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Link ID |
| `source_type` | VARCHAR(50) | 'project', 'task', or 'sprint' |
| `source_id` | UUID | Project/task/sprint ID |
| `knowledge_type` | VARCHAR(50) | 'document', 'code_example', or 'rag_page' |
| `knowledge_id` | UUID | Page/code example ID |
| `relevance_score` | DECIMAL(3,2) | AI-suggested relevance (0.00-1.00) |
| `created_by` | VARCHAR(255) | User or "ai-suggestion" |
| `created_at` | TIMESTAMPTZ | When link was created |

**Unique Constraint:** `(source_type, source_id, knowledge_type, knowledge_id)`

**Indexes:**
- `idx_archon_knowledge_links_source` on `(source_type, source_id)`
- `idx_archon_knowledge_links_knowledge` on `(knowledge_type, knowledge_id)`

---

## Implementation Details

### Service Layer

**File:** `/home/ljutzkanov/Documents/Projects/archon/python/src/server/services/knowledge_linking_service.py`

**New Methods:**
1. `get_source_linked_projects(source_id)` - Get backlinks
2. `link_source_to_project(project_id, source_id, linked_by)` - Bulk link
3. `unlink_source_from_project(project_id, source_id)` - Bulk unlink
4. `suggest_knowledge(..., include_linked)` - Enhanced suggestions

### API Routes

**File:** `/home/ljutzkanov/Documents/Projects/archon/python/src/server/api_routes/knowledge_links.py`

**New Endpoints:**
- `GET /api/knowledge/sources/{source_id}/projects`
- `POST /api/projects/{project_id}/knowledge/sources/{source_id}/link`
- `DELETE /api/projects/{project_id}/knowledge/sources/{source_id}/link`

**Enhanced Endpoints:**
- `GET /api/projects/{project_id}/knowledge/suggestions` (added `include_linked` param)
- `GET /api/tasks/{task_id}/knowledge/suggestions` (added `include_linked` param)

---

## Error Handling

### Standard Error Response Format

```json
{
  "detail": "Error message here"
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | Success | Successful GET/DELETE |
| 201 | Created | Successful POST (links created) |
| 400 | Bad Request | Invalid knowledge_type, limit > 20 |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Project/source/links not found |
| 409 | Conflict | Duplicate links (all already exist) |
| 500 | Internal Error | Database/server errors |

---

## Testing

### Test Script

**File:** `/home/ljutzkanov/Documents/Projects/archon/test_kb_linking_endpoints.sh`

**Usage:**
```bash
# 1. Edit script to set your PROJECT_ID, SOURCE_ID, KNOWLEDGE_ID
# 2. Make executable (chmod +x test_kb_linking_endpoints.sh)
# 3. Run tests
./test_kb_linking_endpoints.sh
```

### Manual Testing with curl

**Prerequisites:**
1. Archon backend running on `http://localhost:8181`
2. Valid authentication token
3. Existing project ID
4. Existing source ID from `archon_sources` table

**Get a source_id:**
```bash
# Query Supabase to find a source
curl -X POST http://localhost:18000/rest/v1/archon_sources \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"select": "source_id,source_display_name,title"}'
```

**Full Test Workflow:**
```bash
PROJECT_ID="your-project-uuid"
SOURCE_ID="your-source-id"

# 1. Get backlinks (should be empty initially)
curl http://localhost:8181/api/knowledge/sources/$SOURCE_ID/projects

# 2. Link source to project
curl -X POST http://localhost:8181/api/projects/$PROJECT_ID/knowledge/sources/$SOURCE_ID/link \
  -H "Content-Type: application/json" \
  -d '{"linked_by": "TestUser"}'

# 3. Get backlinks again (should show 1 project)
curl http://localhost:8181/api/knowledge/sources/$SOURCE_ID/projects

# 4. Get suggestions (exclude linked)
curl "http://localhost:8181/api/projects/$PROJECT_ID/knowledge/suggestions?include_linked=false&limit=5"

# 5. Get suggestions (include linked) - should show is_linked: true
curl "http://localhost:8181/api/projects/$PROJECT_ID/knowledge/suggestions?include_linked=true&limit=10"

# 6. Unlink source from project
curl -X DELETE http://localhost:8181/api/projects/$PROJECT_ID/knowledge/sources/$SOURCE_ID/link

# 7. Verify unlink (should be empty again)
curl http://localhost:8181/api/knowledge/sources/$SOURCE_ID/projects
```

---

## Performance Considerations

### Caching

- AI suggestions are cached for **1 hour** per `(source_type, source_id, limit, include_linked)` key
- Cache invalidation: Automatic after TTL, no manual invalidation on link changes
- Cache key includes `include_linked` to avoid stale results

### Batch Operations

- `link_source_to_project()`: Bulk inserts all pages in a source (single DB call)
- `unlink_source_from_project()`: Bulk deletes all links (single DB call)
- No pagination needed for typical source sizes (< 1000 pages)

### Database Indexes

- `idx_archon_knowledge_links_source` - Fast lookup of links for a project
- `idx_archon_knowledge_links_knowledge` - Fast reverse lookup (backlinks)
- `idx_archon_sources_title` - Fast source title search

---

## UX Integration Guide

### UI Components to Update

Based on UX research findings:

1. **Project Knowledge Tab** - Add "Link from Global KB" button
2. **KB Source Detail Page** - Show "Linked Projects" section (backlinks)
3. **AI Suggestions Panel** - Add toggle for "Show already linked items"
4. **Link Status Badges** - Visual indicators (✅ Linked, 💡 Suggested)

### Workflow Examples

**Scenario 1: User finds useful docs and wants to link to project**
1. User navigates to KB Source detail page
2. User sees "Link to Project" button
3. User selects project from dropdown
4. API: `POST /api/projects/{id}/knowledge/sources/{source_id}/link`
5. UI shows success toast: "Linked 42 pages to Project X"

**Scenario 2: User wants to see what projects use a KB source**
1. User navigates to KB Source detail page
2. API: `GET /api/knowledge/sources/{source_id}/projects`
3. UI shows "Linked Projects" section with cards for each project

**Scenario 3: User wants to audit project knowledge links**
1. User opens Project Knowledge tab
2. User toggles "Show already linked items" ON
3. API: `GET /api/projects/{id}/knowledge/suggestions?include_linked=true`
4. UI shows suggestions with ✅ badge for linked items

---

## Troubleshooting

### Common Issues

**Issue:** "Source {id} has no indexed pages"
- **Cause:** Source exists in `archon_sources` but no pages crawled yet
- **Fix:** Wait for crawl to complete, or check crawl status

**Issue:** "All pages from source already linked"
- **Cause:** Attempting to link source that's already fully linked
- **Fix:** Expected behavior, not an error (409 Conflict response)

**Issue:** Cache shows stale results after linking
- **Cause:** 1-hour cache TTL doesn't invalidate on link changes
- **Fix:** Wait 1 hour, or clear cache manually (restart server)

**Issue:** `is_linked` always false even when linked
- **Cause:** Cached results from before linking
- **Fix:** Use `include_linked=true` for live results (not cached)

---

## Future Enhancements

Based on UX research recommendations:

1. **Link Types** - Support different relationship types (blocks, duplicates, supersedes)
2. **Bulk Linking UI** - Multi-select sources to link at once
3. **Auto-Linking** - Suggest linking when KB matches project keywords
4. **Graph Visualization** - Visual graph of project ↔ knowledge relationships
5. **Link Strength Tuning** - Adjustable AI relevance threshold
6. **Partial Source Linking** - Link individual pages, not entire source

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-24 | Initial implementation (Phase 1.2-1.4) |

---

**Maintainer:** Backend API Expert Agent
**Related Tasks:** f20bbac5, 9dab761d, b98142a1
**UX Research:** `/home/ljutzkanov/Documents/Projects/archon/docs/research/KB_PROJECT_LINKING_UX_RESEARCH.md`
