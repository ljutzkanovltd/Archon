# Project Document Upload API

**Endpoint**: `POST /api/projects/{project_id}/documents/upload`

**Phase**: 6.3 - Project Document Upload Implementation

**Status**: ✅ Implemented (2026-01-23)

---

## Overview

This endpoint enables uploading document files to projects with:
- **Project scoping** - Documents can be project-private or global
- **Progress tracking** - Background processing with real-time progress
- **Knowledge base integration** - Full RAG pipeline processing
- **Code extraction** - Automatic code example detection and indexing
- **Privacy controls** - Granular visibility settings

---

## Authentication

**Required**: Yes (JWT Bearer token)

**Permission**: `document:manage`

```bash
Authorization: Bearer <jwt_token>
```

---

## Request

### Endpoint URL

```
POST http://localhost:8181/api/projects/{project_id}/documents/upload
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | UUID | Yes | Project UUID to associate document with |

### Form Data Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `file` | File | **Required** | Document file (PDF, DOCX, TXT, MD, etc.) |
| `tags` | string | `null` | Comma-separated tags or JSON array |
| `knowledge_type` | string | `"technical"` | `"technical"` or `"business"` |
| `extract_code_examples` | boolean | `true` | Extract and index code snippets |
| `is_project_private` | boolean | `true` | Keep document private to project |
| `send_to_kb` | boolean | `false` | Immediately promote to global KB |

### Privacy Behavior

| `is_project_private` | `send_to_kb` | Result |
|---------------------|--------------|---------|
| `true` | `false` | **Project-private** (default) - Only visible in project |
| `true` | `true` | **Global KB** - Immediately promoted, overrides is_project_private |
| `false` | `false` | **Global KB** - Visible to all projects |
| `false` | `true` | **Global KB** - Immediately promoted with timestamp |

---

## Response

### Success Response (202 Accepted)

```json
{
  "success": true,
  "progressId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Document upload started for project Project Title",
  "filename": "example.pdf",
  "project_id": "f8311680-58a7-45e6-badf-de55d3d9cd24"
}
```

### Error Responses

**404 Not Found** - Project doesn't exist:
```json
{
  "detail": "Project f8311680-58a7-45e6-badf-de55d3d9cd24 not found"
}
```

**401 Unauthorized** - Missing/invalid token:
```json
{
  "detail": "Invalid token: ..."
}
```

**422 Unprocessable Entity** - Invalid tags format:
```json
{
  "detail": {"error": "tags must be a JSON array of strings"}
}
```

**500 Internal Server Error** - Server error:
```json
{
  "detail": {"error": "Error message"}
}
```

---

## Progress Tracking

After receiving the `progressId`, poll the progress endpoint:

```bash
GET /api/progress/{progressId}
```

### Progress Stages

| Stage | Progress % | Description |
|-------|-----------|-------------|
| `initializing` | 0% | Starting upload |
| `processing` | 1-50% | Extracting text from document |
| `storing` | 51-90% | Processing and storing chunks |
| `storing` (project_scoping) | 90-95% | Applying project scoping |
| `completed` | 100% | Upload finished |

### Progress Response Example

```json
{
  "progress_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "upload",
  "status": "storing",
  "progress": 75,
  "log": "Storing document chunks (batch 3/5)",
  "phase": "document_storage",
  "source_id": "project_f8311680_file_example_pdf_a1b2c3d4",
  "filename": "example.pdf",
  "project_id": "f8311680-58a7-45e6-badf-de55d3d9cd24",
  "is_project_private": true,
  "send_to_kb": false
}
```

### Completion Response

```json
{
  "progress_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "upload",
  "status": "completed",
  "progress": 100,
  "log": "Document upload completed successfully for example.pdf",
  "source_id": "project_f8311680_file_example_pdf_a1b2c3d4",
  "project_id": "f8311680-58a7-45e6-badf-de55d3d9cd24",
  "filename": "example.pdf",
  "chunks_stored": 42,
  "total_word_count": 3500,
  "code_examples_extracted": 8,
  "is_project_private": true,
  "promoted_to_kb": false,
  "end_time": "2026-01-23T15:55:00.000Z",
  "duration_seconds": 12.5
}
```

---

## Curl Examples

### Example 1: Upload Private Project Document

```bash
curl -X POST "http://localhost:8181/api/projects/f8311680-58a7-45e6-badf-de55d3d9cd24/documents/upload" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "tags=api-docs,v2,backend" \
  -F "knowledge_type=technical" \
  -F "extract_code_examples=true" \
  -F "is_project_private=true" \
  -F "send_to_kb=false"
```

### Example 2: Upload and Immediately Promote to KB

```bash
curl -X POST "http://localhost:8181/api/projects/f8311680-58a7-45e6-badf-de55d3d9cd24/documents/upload" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/guide.docx" \
  -F "tags=guide,onboarding,best-practices" \
  -F "knowledge_type=business" \
  -F "extract_code_examples=false" \
  -F "is_project_private=false" \
  -F "send_to_kb=true"
```

### Example 3: Upload Markdown with Code Examples

```bash
curl -X POST "http://localhost:8181/api/projects/f8311680-58a7-45e6-badf-de55d3d9cd24/documents/upload" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/tutorial.md" \
  -F "tags=tutorial,react,hooks" \
  -F "knowledge_type=technical" \
  -F "extract_code_examples=true"
```

### Example 4: Monitor Progress

```bash
# 1. Upload document and capture progressId
RESPONSE=$(curl -s -X POST "http://localhost:8181/api/projects/PROJECT_ID/documents/upload" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@document.pdf" \
  -F "tags=test")

PROGRESS_ID=$(echo "$RESPONSE" | jq -r '.progressId')

# 2. Poll progress
while true; do
  PROGRESS=$(curl -s "http://localhost:8181/api/progress/$PROGRESS_ID")
  STATUS=$(echo "$PROGRESS" | jq -r '.status')
  PERCENT=$(echo "$PROGRESS" | jq -r '.progress')
  LOG=$(echo "$PROGRESS" | jq -r '.log')

  echo "[$STATUS] $PERCENT% - $LOG"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    echo "$PROGRESS" | jq .
    break
  fi

  sleep 2
done
```

---

## Database Changes

### Migration: `20260123_add_project_scoping_to_sources.sql`

Added columns to `archon_sources` table:

- `project_id` (UUID, nullable, FK to archon_projects)
- `is_project_private` (BOOLEAN, default: FALSE)
- `promoted_to_kb_at` (TIMESTAMPTZ, nullable)
- `promoted_by` (VARCHAR(255), nullable)

**Indexes**:
- `idx_sources_project_id` - Fast project filtering
- `idx_sources_is_private` - Privacy filtering
- `idx_sources_promoted` - Promotion history
- `idx_sources_project_privacy` - Composite project+privacy

**Constraint**:
- `check_promotion_consistency` - Ensures `promoted_to_kb_at` only set when `is_project_private = FALSE`

---

## Implementation Details

### File Processing Pipeline

1. **Validation**
   - Verify project exists
   - Parse tags (supports both comma-separated and JSON)
   - Generate unique progress ID

2. **File Reading** (CRITICAL)
   - Read file content **immediately** before background task
   - Prevents "closed file" issues
   - Store file metadata (filename, content_type, size)

3. **Progress Tracker Initialization**
   - Create tracker **before** background task
   - Register initial state
   - Enable immediate polling

4. **Background Processing**
   - Extract text using `extract_text_from_document()`
   - Generate source_id: `project_{project_id}_file_{filename}_{random}`
   - Process via `DocumentStorageService.upload_document()`
   - Apply project scoping to `archon_sources`
   - Track progress throughout

5. **Task Registry Cleanup**
   - Always clean up in `finally` block
   - Prevents memory leaks

### Source ID Format

```
project_{project_id}_file_{safe_filename}_{random_8_chars}
```

Example:
```
project_f8311680_file_api_documentation_pdf_a1b2c3d4
```

### Progress Mapping

Uses `ProgressMapper` to prevent progress from going backwards:

- **processing** (0-50%): Text extraction
- **storing** (50-100%): Document storage pipeline

---

## Testing Checklist

- [x] Endpoint created and registered
- [x] Database migration applied
- [x] Server restarts successfully
- [x] Route appears in OpenAPI docs
- [x] Authentication required (401 without token)
- [x] Project validation (404 if project doesn't exist)
- [ ] Successful upload with valid token
- [ ] Progress tracking functional
- [ ] Document stored with project_id
- [ ] Privacy flags applied correctly
- [ ] Code examples extracted
- [ ] Promotion to KB works

---

## Files Modified/Created

### Created:
1. `/python/migrations/20260123_add_project_scoping_to_sources.sql` - Database migration
2. `/docs/API_PROJECT_DOCUMENT_UPLOAD.md` - This documentation

### Modified:
1. `/python/src/server/api_routes/projects_documents.py` - Added upload endpoint and background processing

### Key Functions:
- `upload_project_document()` - Main endpoint handler
- `_perform_project_upload_with_progress()` - Background processing function

---

## Next Steps for Phase 6.3 Completion

1. **Testing with Auth** - Need valid JWT token for full integration test
2. **Frontend Integration** - Update UI to use this endpoint
3. **Progress Visualization** - Real-time upload progress in UI
4. **Error Handling UI** - Display upload errors to user
5. **Document List Integration** - Show uploaded documents in project view

---

## Known Limitations

1. **Authentication**: Requires existing auth system (no demo login available)
2. **File Size Limits**: Default FastAPI limits apply (~16MB)
3. **Concurrent Uploads**: Task registry supports multiple uploads but no rate limiting
4. **Cancellation**: Task can be cancelled but cleanup may take time

---

## Related Documentation

- Research: `/docs/KB_UPLOAD_ARCHITECTURE_RESEARCH_2026-01-23.md`
- Main CLAUDE.md: `/archon/.claude/CLAUDE.md`
- API Reference: `/archon/.claude/docs/API_REFERENCE.md`
- Project Documents Service: `/python/src/server/services/projects/document_service.py`

---

**Last Updated**: 2026-01-23
**Author**: Backend API Expert Agent
**Status**: Implementation Complete, Testing Pending Auth
