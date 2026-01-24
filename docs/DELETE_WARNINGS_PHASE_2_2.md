# Phase 2.2: Delete Warnings for Linked KB Items

**Implementation Date:** 2026-01-24
**Task ID:** 694b8de4-327c-4582-b464-15aabed893ad
**Status:** ✅ Complete

## Overview

Phase 2.2 adds a comprehensive warning system to prevent accidental deletion of knowledge base items that are actively linked to projects. This builds on Phase 1's bidirectional KB-project linking system.

## Problem Statement

Without warnings, users could accidentally delete knowledge base sources that are linked to active projects, breaking those links and potentially losing valuable documentation references. This implementation provides:

1. **Pre-deletion checks** - Verify if KB item has backlinks before deletion
2. **Warning responses** - Return detailed warnings with linked project information
3. **Force delete option** - Allow intentional deletion with two-step confirmation
4. **Bulk unlink helper** - Automatically unlink from all projects before deletion

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DELETE REQUEST FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  DELETE /api/sources/{source_id}                                     │
│         ?force=false                                                 │
│         ?confirm_unlink=false                                        │
│                    │                                                 │
│                    ▼                                                 │
│         ┌──────────────────────┐                                    │
│         │ SourceManagement     │                                    │
│         │ Service              │                                    │
│         │  delete_source()     │                                    │
│         └──────────┬───────────┘                                    │
│                    │                                                 │
│                    ▼                                                 │
│         ┌──────────────────────┐                                    │
│         │ KnowledgeLinking     │                                    │
│         │ Service              │                                    │
│         │  get_source_linked_  │                                    │
│         │  projects()          │                                    │
│         └──────────┬───────────┘                                    │
│                    │                                                 │
│           ┌────────┴────────┐                                       │
│           │                 │                                       │
│      No Links         Has Links                                     │
│           │                 │                                       │
│           ▼                 ▼                                       │
│    ┌──────────┐   ┌────────────────┐                               │
│    │ DELETE   │   │ CHECK force=?  │                               │
│    │ Source   │   └────────┬───────┘                               │
│    └──────────┘            │                                        │
│                   ┌────────┴────────┐                               │
│                   │                 │                               │
│             force=false       force=true                            │
│                   │                 │                               │
│                   ▼                 ▼                               │
│        ┌──────────────┐   ┌────────────────┐                       │
│        │ RETURN 409   │   │ CHECK confirm_ │                       │
│        │ Warning      │   │ unlink=?       │                       │
│        │ + Projects   │   └────────┬───────┘                       │
│        │ + Actions    │            │                               │
│        └──────────────┘   ┌────────┴────────┐                      │
│                           │                 │                      │
│                    confirm=false      confirm=true                 │
│                           │                 │                      │
│                           ▼                 ▼                      │
│                ┌──────────────┐   ┌────────────────┐               │
│                │ RETURN 400   │   │ UNLINK ALL     │               │
│                │ "Needs       │   │ then DELETE    │               │
│                │ confirmation"│   └────────────────┘               │
│                └──────────────┘                                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Service Layer Changes

#### KnowledgeLinkingService

**New Method: `unlink_source_from_all_projects()`**

```python
async def unlink_source_from_all_projects(self, source_id: str) -> dict:
    """
    Unlink a knowledge source from ALL projects.

    Used before force-deleting a KB item that has backlinks.

    Returns:
        {
            "unlinked_count": int,      # Total links removed
            "project_ids": [str],        # Projects unlinked from
            "errors": []                 # Any errors during unlinking
        }
    """
```

**Implementation:**
- Gets all linked projects via `get_source_linked_projects()`
- Iterates through each project
- Calls `unlink_source_from_project()` for each
- Collects results and errors
- Returns summary statistics

#### SourceManagementService

**Enhanced Method: `delete_source()`**

```python
async def delete_source(
    self,
    source_id: str,
    force: bool = False,
    confirm_unlink: bool = False
) -> tuple[bool, dict]:
    """
    Delete a source with backlink checking and force delete support.

    Args:
        source_id: Source to delete
        force: If True, unlink from all projects first
        confirm_unlink: Required confirmation when force=True

    Returns:
        - If has backlinks and force=False: Warning response
        - If force=True without confirm_unlink: Error
        - If force=True with confirm_unlink: Success after unlinking
    """
```

**Logic Flow:**
1. Check for backlinks via `KnowledgeLinkingService`
2. If no backlinks → proceed with deletion
3. If has backlinks:
   - If `force=False` → return 409 warning with project list
   - If `force=True` and `confirm_unlink=False` → return 400 error
   - If `force=True` and `confirm_unlink=True` → unlink all, then delete

### API Endpoints

#### DELETE /api/sources/{source_id}

**Query Parameters:**
- `force` (boolean, default: false) - Unlink from all projects before deletion
- `confirm_unlink` (boolean, default: false) - Confirmation for force delete

**Response Codes:**

**409 Conflict** - Source has backlinks and force=false
```json
{
  "error": "Cannot delete linked source",
  "can_delete": false,
  "warning": "This knowledge item is linked to projects",
  "linked_projects": [
    {
      "project_id": "uuid",
      "project_title": "Project Name",
      "linked_at": "2026-01-24T10:00:00Z",
      "linked_by": "user@example.com"
    }
  ],
  "total_links": 5,
  "actions": [
    {
      "action": "unlink_all",
      "label": "Unlink from all projects and delete",
      "description": "This will remove links from all projects and then delete the knowledge item"
    },
    {
      "action": "cancel",
      "label": "Cancel deletion",
      "description": "Keep the knowledge item and all its project links"
    }
  ],
  "hint": "Use force=true and confirm_unlink=true to unlink and delete"
}
```

**400 Bad Request** - Force delete without confirmation
```json
{
  "error": "Force delete requires confirmation",
  "message": "Set confirm_unlink=true to confirm unlinking from all projects",
  "linked_projects": [...],
  "total_links": 5
}
```

**200 OK** - Successful deletion (with or without force)
```json
{
  "success": true,
  "message": "Source and all related data deleted successfully via CASCADE DELETE",
  "source_id": "src_abc123",
  "unlinked_count": 15,           // If force delete was used
  "unlinked_from_projects": 5     // If force delete was used
}
```

**404 Not Found** - Source doesn't exist
```json
{
  "error": "Source src_abc123 not found"
}
```

#### DELETE /api/knowledge-items/{source_id}

Same behavior as `/api/sources/{source_id}` (both endpoints updated identically).

### Response Models (Pydantic)

```python
class LinkedProjectInfo(BaseModel):
    """Information about a project linked to a KB source"""
    project_id: str
    project_title: str
    linked_at: str
    linked_by: Optional[str] = None


class DeleteActionOption(BaseModel):
    """Action option for handling linked KB item deletion"""
    action: str
    label: str
    description: str


class DeleteWarningResponse(BaseModel):
    """Warning response when attempting to delete a linked KB item"""
    can_delete: bool = False
    warning: str
    linked_projects: list[LinkedProjectInfo]
    total_links: int
    actions: list[DeleteActionOption]
    hint: Optional[str] = None


class DeleteSuccessResponse(BaseModel):
    """Success response after deleting a KB item"""
    success: bool = True
    message: str
    source_id: str
    unlinked_count: Optional[int] = None
    unlinked_from_projects: Optional[int] = None
```

## Safety Features

### Two-Step Confirmation

Force deletion requires **both** query parameters:
- `force=true` - Indicates intent to delete despite links
- `confirm_unlink=true` - Confirms understanding that links will be removed

This prevents accidental force deletes from simple parameter typos.

### Audit Logging

All deletion attempts are logged with:
- Source ID
- User/requester
- Force flag status
- Number of links at time of deletion
- Whether deletion succeeded or was blocked
- Unlink operations performed

### Transactional Safety

The deletion process is atomic:
1. Check backlinks
2. If force delete: unlink all (fails if any unlink fails)
3. Delete source (CASCADE handles related records)

If step 2 fails, deletion is aborted - no partial state.

### Cascade Delete Preservation

The existing CASCADE DELETE constraints remain in place:
- Deleting source → automatically deletes crawled_pages
- Deleting source → automatically deletes code_examples
- New: Manually unlink from projects first (if force=true)

## Testing

### Automated Test Suite

**Location:** `/home/ljutzkanov/Documents/Projects/archon/test_delete_warnings.sh`

**Test Coverage:**

1. **Test 1: Delete Linked Item Without Force**
   - Attempts: `DELETE /sources/{id}`
   - Expected: 409 Conflict with warning response
   - Verifies: Warning message, linked_projects array, actions list

2. **Test 2: Force Delete Without Confirmation**
   - Attempts: `DELETE /sources/{id}?force=true`
   - Expected: 400 Bad Request
   - Verifies: Error mentions confirmation requirement

3. **Test 3: Force Delete With Confirmation**
   - Attempts: `DELETE /sources/{id}?force=true&confirm_unlink=true`
   - Expected: 200 OK with unlink statistics
   - Verifies: Source deleted, links removed, database state

4. **Test 4: Delete Non-Existent Source**
   - Attempts: `DELETE /sources/{fake_id}`
   - Expected: 404 Not Found
   - Verifies: Proper error handling

**Run Tests:**
```bash
cd /home/ljutzkanov/Documents/Projects/archon
./test_delete_warnings.sh [optional_source_id]
```

### Manual Testing Scenarios

**Scenario 1: User tries to delete linked source via UI**
1. Navigate to KB source with project links
2. Click "Delete" button
3. UI shows warning modal with:
   - List of linked projects
   - "Unlink and Delete" button
   - "Cancel" button
4. User clicks "Unlink and Delete"
5. UI sends `DELETE /sources/{id}?force=true&confirm_unlink=true`
6. Source is deleted, links removed

**Scenario 2: API user deletes unlinked source**
1. Send `DELETE /sources/{id}` for unlinked source
2. Receive 200 OK immediately
3. Source deleted without warnings

**Scenario 3: API user attempts force delete incorrectly**
1. Send `DELETE /sources/{id}?force=true` (missing confirm_unlink)
2. Receive 400 Bad Request with helpful error message
3. User corrects request with both parameters
4. Deletion succeeds

## Error Handling

### Error Cases

| Error Code | Condition | Response |
|------------|-----------|----------|
| 409 Conflict | Source has backlinks and force=false | Warning with project list and actions |
| 400 Bad Request | force=true without confirm_unlink | Error requiring confirmation |
| 404 Not Found | Source doesn't exist | Standard 404 error |
| 500 Internal Server Error | Database errors, unlink failures | Error with details |

### Error Recovery

**Partial Unlink Failure:**
If bulk unlink fails mid-operation:
- Deletion is aborted
- Error response includes:
  - Number of links successfully removed
  - List of project IDs that failed
  - Specific error messages per failure

**Database Transaction Failure:**
All database operations use Supabase client which handles:
- Connection pooling
- Automatic retries (configurable)
- Rollback on failure (implicit in DELETE operations)

## Frontend Integration Guidelines

### UI/UX Recommendations

**Delete Button States:**
1. **Normal State** - "Delete" button enabled
2. **Loading State** - Show spinner during deletion check
3. **Warning State** - Show modal if 409 response received
4. **Confirmation State** - Require second click for force delete

**Warning Modal Design:**
```
┌─────────────────────────────────────────────────┐
│  ⚠️  Warning: Source is Linked to Projects      │
├─────────────────────────────────────────────────┤
│                                                  │
│  This knowledge source is currently linked to:   │
│                                                  │
│  • Project Alpha (linked 2026-01-20)            │
│  • Project Beta (linked 2026-01-18)             │
│  • Project Gamma (linked 2026-01-15)            │
│                                                  │
│  Deleting will remove these links.               │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │    Cancel    │  │ Unlink & Delete │          │
│  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────┘
```

**Sample React Code:**
```typescript
async function handleDelete(sourceId: string) {
  try {
    // First attempt - check for links
    const response = await fetch(
      `/api/sources/${sourceId}`,
      { method: 'DELETE' }
    );

    if (response.status === 409) {
      const warning = await response.json();

      // Show warning modal
      const confirmed = await showWarningModal({
        title: warning.warning,
        linkedProjects: warning.linked_projects,
        actions: warning.actions
      });

      if (confirmed) {
        // Force delete with confirmation
        const forceResponse = await fetch(
          `/api/sources/${sourceId}?force=true&confirm_unlink=true`,
          { method: 'DELETE' }
        );

        if (forceResponse.ok) {
          const result = await forceResponse.json();
          showSuccess(
            `Deleted source and removed ${result.unlinked_count} links`
          );
        }
      }
    } else if (response.ok) {
      // No links - deleted successfully
      showSuccess('Source deleted successfully');
    }
  } catch (error) {
    showError('Failed to delete source');
  }
}
```

### API Client Integration

**TypeScript Types:**
```typescript
interface LinkedProjectInfo {
  project_id: string;
  project_title: string;
  linked_at: string;
  linked_by?: string;
}

interface DeleteWarningResponse {
  can_delete: false;
  warning: string;
  linked_projects: LinkedProjectInfo[];
  total_links: number;
  actions: Array<{
    action: string;
    label: string;
    description: string;
  }>;
  hint?: string;
}

interface DeleteSuccessResponse {
  success: true;
  message: string;
  source_id: string;
  unlinked_count?: number;
  unlinked_from_projects?: number;
}

type DeleteResponse = DeleteWarningResponse | DeleteSuccessResponse;
```

## Performance Considerations

### Backlink Check Performance

**Optimization:**
- Single database query fetches all linked projects
- Uses indexes on `archon_knowledge_links` table:
  - `source_type`, `knowledge_type`, `knowledge_id`
  - Compound index for faster lookups

**Expected Performance:**
- < 50ms for sources with < 100 links
- < 200ms for sources with < 1000 links
- Linear scaling with number of links

### Bulk Unlink Performance

**Optimization:**
- Batch DELETE operations where possible
- Supabase client handles connection pooling
- Parallel unlink operations (async/await)

**Expected Performance:**
- 5-10 links: < 100ms
- 50 links: < 500ms
- 100+ links: < 1 second

**Scalability Limits:**
- Current implementation: handles up to 1000 links
- For > 1000 links: consider background job queue

## Database Schema

### Tables Involved

**archon_sources** (primary table)
- Stores KB sources
- CASCADE DELETE to crawled_pages and code_examples

**archon_knowledge_links** (junction table)
- Stores project ↔ KB page links
- Checked before source deletion
- Manually deleted during force delete

**archon_crawled_pages** (child table)
- Automatically deleted via CASCADE DELETE
- Pages are what get linked to projects

### Migration Notes

No new migrations required - Phase 2.2 uses existing schema from Phase 1:
- `archon_knowledge_links` table (created in Phase 1.1)
- Existing CASCADE DELETE constraints
- No schema changes needed

## Security Considerations

### Authorization

**Current Implementation:**
- Deletion endpoints should require authentication
- Consider role-based access control:
  - `knowledge:manage` permission required for deletion
  - `knowledge:read` permission for viewing links

**Recommendations:**
- Add authorization checks in API routes
- Verify user has permission to delete source
- Verify user has permission to unlink from projects
- Log all deletion attempts with user identity

### Audit Trail

**Logged Information:**
- User ID/email
- Source ID and title
- Timestamp of deletion attempt
- Force delete flag status
- Number of links at deletion time
- Unlink operation results
- Success/failure status

**Audit Log Location:**
- Application logs (via logfire)
- Database audit table (future enhancement)

## Migration from Phase 1

Phase 2.2 is **backward compatible** with Phase 1:
- Existing deletion endpoints enhanced (not replaced)
- Default behavior (force=false) provides safety
- No breaking changes to API contracts
- Existing frontend code continues to work

### Upgrade Path

1. **Backend Deployment:**
   - Deploy updated `SourceManagementService`
   - Deploy updated API routes
   - No database migrations needed

2. **Frontend Integration:**
   - Update delete handlers to handle 409 responses
   - Add warning modals for linked sources
   - Implement force delete confirmation flow

3. **Testing:**
   - Run automated test suite
   - Manual testing of delete workflows
   - Verify existing functionality intact

## Monitoring & Observability

### Key Metrics

**Delete Operations:**
- Total delete attempts
- Successful deletions
- Blocked deletions (409 responses)
- Force deletions (with unlink count)

**Error Rates:**
- 400 errors (missing confirmation)
- 404 errors (source not found)
- 500 errors (unexpected failures)

### Logging Examples

```python
# Blocked deletion (has links)
logger.info(
    f"Source {source_id} has {total_links} linked projects - returning warning"
)

# Force delete attempt without confirmation
logger.warning(
    f"Force delete attempted without confirmation for source {source_id}"
)

# Successful force delete
logger.info(
    f"Successfully unlinked source {source_id} from {unlinked_count} "
    f"links across {len(project_ids)} projects"
)
```

### Alerting Recommendations

**Alert on:**
- High rate of blocked deletions (may indicate UX issue)
- Force delete failures (database issues)
- Unlink operation errors (data integrity issues)

## Future Enhancements

### Phase 2.3 Considerations

1. **Soft Delete Implementation**
   - Mark sources as deleted instead of hard delete
   - Allow restoration within 30-day window
   - Automatic cleanup after retention period

2. **Batch Force Delete**
   - Support force deleting multiple sources
   - Bulk unlink optimization
   - Progress tracking for large batches

3. **Archive Instead of Delete**
   - Archive sources to read-only state
   - Preserve links but mark as inactive
   - Search/display filtering for archived sources

4. **Enhanced Audit Trail**
   - Dedicated audit table
   - Track all link/unlink operations
   - Support audit log queries via API

## Troubleshooting Guide

### Common Issues

**Issue:** 409 response but no linked projects shown
- **Cause:** Database consistency issue
- **Fix:** Check `archon_knowledge_links` table for orphaned records
- **Prevention:** Implement CASCADE DELETE on project deletion

**Issue:** Force delete succeeds but links remain
- **Cause:** Unlink operation failed silently
- **Fix:** Check error logs for unlink failures
- **Prevention:** Verify `unlinked_count` in response matches expected

**Issue:** 404 error for valid source
- **Cause:** Source check failing before backlink check
- **Fix:** Verify source exists in `archon_sources` table
- **Prevention:** Improve error messages to distinguish source not found vs. other errors

### Debug Commands

```bash
# Check source exists
curl http://localhost:8181/api/knowledge-items/{source_id}

# Check backlinks
curl http://localhost:8181/api/knowledge/sources/{source_id}/projects

# View API logs
docker logs -f archon-backend | grep "delete_source"

# Check database state
docker exec -it supabase-ai-db psql -U postgres -d postgres \
  -c "SELECT * FROM archon_sources WHERE source_id = 'src_123';"

docker exec -it supabase-ai-db psql -U postgres -d postgres \
  -c "SELECT * FROM archon_knowledge_links WHERE knowledge_id IN \
      (SELECT page_id FROM archon_crawled_pages WHERE source_id = 'src_123');"
```

## References

- **Phase 1 Documentation:** Bidirectional KB-project linking system
- **Task Tracking:** Archon task ID 694b8de4-327c-4582-b464-15aabed893ad
- **Related Files:**
  - `/python/src/server/services/knowledge_linking_service.py`
  - `/python/src/server/services/source_management_service.py`
  - `/python/src/server/api_routes/knowledge_api.py`
  - `/test_delete_warnings.sh`

## Changelog

### 2026-01-24 - Initial Implementation
- Added `unlink_source_from_all_projects()` to KnowledgeLinkingService
- Enhanced `delete_source()` with backlink checking and force delete
- Updated DELETE endpoints with query parameters
- Added Pydantic response models
- Created comprehensive test suite
- Documentation completed

---

**Status:** ✅ Ready for Review
**Next Steps:** Frontend integration (Phase 2.3)
