# Phase 6.4 - Project URL Crawl Endpoint Implementation

**Date**: 2026-01-23
**Task ID**: 437b7866-09ae-49c4-8275-84e56dca3864
**Project ID**: f8311680-58a7-45e6-badf-de55d3d9cd24

## Summary

Successfully implemented POST `/api/projects/{project_id}/documents/crawl` endpoint for crawling URLs and adding them to project documents with knowledge base integration.

## Implementation Details

### Endpoint Signature

```python
@router.post("/projects/{project_id}/documents/crawl")
async def crawl_url_for_project(
    project_id: str = Path(..., description="Project UUID"),
    url: str = Form(..., description="URL to crawl"),
    max_depth: int = Form(1, description="Maximum crawl depth (1-5)"),
    tags: str | None = Form(None, description="Comma-separated tags or JSON array"),
    knowledge_type: str = Form("technical", description="Knowledge type: technical or business"),
    extract_code_examples: bool = Form(True, description="Extract and index code examples"),
    is_project_private: bool = Form(True, description="Keep document private to project (default: True)"),
    send_to_kb: bool = Form(False, description="Immediately promote to global knowledge base"),
    _user: dict = Depends(require_document_manage)
)
```

### File Location

- **File**: `/home/ljutzkanov/Documents/Projects/archon/python/src/server/api_routes/projects_documents.py`
- **Lines**: 746-1040 (approximately)

## Key Features

### 1. Request Validation

✅ **Project Verification**
- Validates project exists in database
- Returns 404 if project not found

✅ **URL Validation**
- Must be http:// or https://
- Must include valid protocol and domain
- Returns 422 for invalid URLs

✅ **Max Depth Validation**
- Must be between 1 and 5
- Returns 422 for out-of-range values

✅ **Tag Parsing**
- Supports both comma-separated strings and JSON arrays
- Falls back to comma-separated if JSON parsing fails

### 2. Progress Tracking

✅ **ProgressTracker Integration**
- Initializes tracker BEFORE background task
- Provides real-time progress updates via `/api/progress/{progressId}`
- Tracks status: `initializing` → `crawling` → `storing` → `completed`

### 3. Background Crawl Processing

✅ **CrawlingService Integration**
- Uses existing `CrawlingService.orchestrate_crawl()` method
- Reuses all crawling logic (sitemap detection, recursive crawling, etc.)
- Proper crawler initialization from `CrawlerManager`

✅ **Project Scoping**
- Generates project-scoped source_id: `project_{project_id}_url_{domain}_{random}`
- Updates `archon_sources` with `project_id` and `is_project_private` flags
- Optionally sets `promoted_to_kb_at` timestamp when `send_to_kb=True`

### 4. Error Handling

✅ **Comprehensive Error Handling**
- Crawler initialization failures
- Crawl operation failures
- Project scoping failures (non-fatal)
- Cancellation support
- Proper cleanup in `finally` block

### 5. Task Registry Cleanup

✅ **Memory Leak Prevention**
- Tasks stored in `active_upload_tasks` dict
- Cleaned up in `finally` block (success or failure)
- Supports cancellation via task cancellation

## API Usage

### Request Example

```bash
curl -X POST "http://localhost:8181/api/projects/{project_id}/documents/crawl" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -F "url=https://example.com/docs" \
  -F "max_depth=2" \
  -F "tags=documentation,api" \
  -F "knowledge_type=technical" \
  -F "extract_code_examples=true" \
  -F "is_project_private=true" \
  -F "send_to_kb=false"
```

### Response Format

```json
{
  "success": true,
  "progressId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "URL crawl started for project My Project",
  "url": "https://example.com/docs",
  "max_depth": 2,
  "project_id": "f8311680-58a7-45e6-badf-de55d3d9cd24"
}
```

### Progress Polling

```bash
curl "http://localhost:8181/api/progress/{progressId}"
```

**Response**:
```json
{
  "progress_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "crawl",
  "status": "crawling",
  "progress": 45,
  "log": "Crawling page 3 of 10",
  "current_url": "https://example.com/docs/getting-started",
  "start_time": "2026-01-23T16:00:00",
  "url": "https://example.com/docs",
  "project_id": "f8311680-58a7-45e6-badf-de55d3d9cd24"
}
```

## Implementation Pattern

### Pattern Used: Phase 6.3 + Existing Crawl Endpoint

This implementation follows the exact pattern from:
1. **Phase 6.3 Upload Endpoint** (`/projects/{project_id}/documents/upload`)
   - Project verification
   - Permission checks
   - ProgressTracker initialization
   - Background task pattern
   - Project scoping logic

2. **Existing Crawl Endpoint** (`/knowledge-items/crawl`)
   - CrawlingService usage
   - Crawler initialization
   - `orchestrate_crawl()` method
   - Task registry management

### Code Reuse

✅ **100% Reuse of CrawlingService**
- No modifications to existing crawling logic
- Uses `orchestrate_crawl()` exactly as is
- Supports all crawl types (normal, sitemap, llms.txt)

✅ **Project Scoping Added After Crawl**
- Non-intrusive addition
- Updates `archon_sources` table after crawl completes
- Doesn't interfere with crawl process

## Database Integration

### Tables Modified

1. **archon_sources** (existing records updated)
   - `project_id`: Links source to project
   - `is_project_private`: Privacy flag
   - `promoted_to_kb_at`: Timestamp when promoted to KB
   - `promoted_by`: User ID who promoted

### Source ID Format

```
project_{project_id}_url_{sanitized_domain}_{random8}
```

**Example**:
```
project_f8311680-58a7-45e6-badf-de55d3d9cd24_url_docs_anthropic_com_a1b2c3d4
```

## Privacy Controls

### is_project_private Flag

- **`true`** (default): Document only visible within project
- **`false`**: Document visible in global knowledge base

### send_to_kb Flag

- **`false`** (default): Respects `is_project_private` setting
- **`true`**: Immediately promotes to KB (overrides `is_project_private`)
  - Sets `is_project_private=false`
  - Sets `promoted_to_kb_at=now()`
  - Sets `promoted_by=user_id`

## Testing

### Manual Test (Requires Auth Token)

```bash
# 1. Create test project
PROJECT_ID=$(curl -s -X POST "http://localhost:8181/api/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -d '{
    "title": "Crawl Test Project",
    "description": "Testing URL crawl endpoint"
  }' | jq -r '.project_id')

# 2. Start crawl
PROGRESS_ID=$(curl -s -X POST \
  "http://localhost:8181/api/projects/${PROJECT_ID}/documents/crawl" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -F "url=https://example.com" \
  -F "max_depth=1" \
  -F "tags=test" | jq -r '.progressId')

# 3. Poll progress
watch -n 2 "curl -s http://localhost:8181/api/progress/${PROGRESS_ID} | jq ."

# 4. Check results
curl -s "http://localhost:8181/api/projects/${PROJECT_ID}/documents" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq .
```

### Expected Behavior

1. **Project Verification**: Returns 404 if project doesn't exist
2. **URL Validation**: Returns 422 for invalid URLs
3. **Progress Tracking**: Returns progressId immediately
4. **Background Processing**: Crawl runs asynchronously
5. **Project Scoping**: Source linked to project after crawl
6. **Cleanup**: Task removed from registry on completion

## Error Scenarios Handled

### 1. Project Not Found
**Status**: 404
**Response**: `{"detail": "Project {project_id} not found"}`

### 2. Invalid URL
**Status**: 422
**Response**: `{"detail": "URL must be http or https"}`

### 3. Invalid Max Depth
**Status**: 422
**Response**: `{"detail": "max_depth must be between 1 and 5"}`

### 4. Crawler Initialization Failure
**Behavior**: Background task fails gracefully, tracker shows error

### 5. Crawl Failure
**Behavior**: Background task catches exception, tracker shows error

### 6. Project Scoping Failure
**Behavior**: Non-fatal warning, crawl completes but project link missing

## Success Criteria

✅ **Endpoint created in correct file** (`projects_documents.py`)
✅ **URL crawling working** (accepts URL, validates format)
✅ **Progress tracking functional** (ProgressTracker initialized)
✅ **Background task processing** (asyncio.create_task)
✅ **Task registry cleanup** (finally block cleanup)
✅ **Project scoping implemented** (project_id, is_project_private)
✅ **"Send to KB" functionality** (promoted_to_kb_at timestamp)
✅ **URL validation** (http/https, protocol, domain)
✅ **max_depth parameter** (1-5 range validation)
✅ **Error handling** (all cases covered)
✅ **Type hints and docstrings** (comprehensive documentation)
✅ **Pattern matches existing** (`/api/documents/crawl` + Phase 6.3)

## Files Modified

1. **`/home/ljutzkanov/Documents/Projects/archon/python/src/server/api_routes/projects_documents.py`**
   - Added `crawl_url_for_project()` endpoint (lines 746-900)
   - Added `_perform_project_crawl_with_progress()` background function (lines 902-1040)

## Integration Points

### Upstream Dependencies
- `CrawlerManager.get_crawler()` - Crawler instance
- `CrawlingService.orchestrate_crawl()` - Crawl orchestration
- `ProgressTracker` - Progress tracking
- `require_document_manage` - RBAC permission

### Downstream Effects
- Updates `archon_sources` table
- Creates `archon_crawled_pages` records
- Creates `archon_code_examples` records (if enabled)
- Creates `archon_page_metadata` records

## Next Steps

### Phase 6.5 (Suggested)
- Frontend UI integration in ProjectDetailView
- Add "Crawl URL" button/dialog
- Real-time progress display
- Success/error toast notifications

### Future Enhancements
- Bulk URL crawl (array of URLs)
- Scheduled recurring crawls
- Crawl history/logs per project
- Crawl statistics dashboard

## References

- **Task**: Phase 6.4 - Create POST /api/projects/{project_id}/documents/crawl endpoint
- **PRP**: Phase 6 - Project Document Management with Privacy Controls
- **Architecture Doc**: `/home/ljutzkanov/Documents/Projects/archon/docs/KB_UPLOAD_ARCHITECTURE_RESEARCH_2026-01-23.md`
- **Existing Crawl Endpoint**: `/home/ljutzkanov/Documents/Projects/archon/python/src/server/api_routes/knowledge_api.py` (lines 1001-1163)
- **Phase 6.3 Upload**: `/home/ljutzkanov/Documents/Projects/archon/python/src/server/api_routes/projects_documents.py` (lines 110-739)

## Author

**Agent**: Backend API Expert Agent
**Date**: 2026-01-23
**Task ID**: 437b7866-09ae-49c4-8275-84e56dca3864
