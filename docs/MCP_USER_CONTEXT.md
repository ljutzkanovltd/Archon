# MCP User Context Implementation - Task 117

## Summary

Added user tracking fields to MCP sessions to prepare the system for multi-user support and enable per-user usage analytics, cost allocation, and access control.

## Changes Made

### 1. Database Schema Updates

**File:** `migration/0.3.0/014_add_user_context_to_sessions.sql`

Added three new columns to `archon_mcp_sessions` table:

```sql
ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);

ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
```

**Benefits:**
- **user_id** - UUID reference for integration with Supabase Auth or custom auth systems
- **user_email** - Email for user identification and reporting
- **user_name** - Display name for UI components

### 2. New Database Views and Functions

#### `archon_mcp_user_stats` View

Aggregates usage statistics per user:

```sql
SELECT * FROM archon_mcp_user_stats;
```

Returns:
- Total sessions (active + disconnected)
- Session duration statistics
- Total requests and tokens consumed
- Total estimated cost
- First and last activity timestamps

#### Helper Functions

1. **`get_user_sessions(p_user_id, start_date, end_date)`**
   - Returns all sessions for a specific user within a date range
   - Includes request counts per session

2. **`get_user_activity_summary(p_user_id, days)`**
   - Comprehensive activity summary for a user
   - Shows most-used client type
   - Aggregates requests, tokens, and costs

### 3. Python Session Manager Updates

**File:** `python/src/server/services/mcp_session_manager.py`

Updated `create_session()` method to accept optional user context:

```python
def create_session(
    self,
    client_info: Optional[dict[str, Any]] = None,
    user_context: Optional[dict[str, Any]] = None  # ✨ New parameter
) -> str:
    """
    Args:
        user_context: Optional user identification for multi-user support
                     Expected fields: user_id, user_email, user_name
                     Example: {
                         "user_id": "uuid",
                         "user_email": "user@example.com",
                         "user_name": "John Doe"
                     }
    """
```

**Usage Example:**

```python
from src.server.services.mcp_session_manager import get_session_manager

session_manager = get_session_manager()

# Create session without user context (current behavior)
session_id = session_manager.create_session(client_info={
    "name": "Claude Code",
    "version": "1.0.0"
})

# Create session WITH user context (multi-user mode)
session_id = session_manager.create_session(
    client_info={
        "name": "Claude Code",
        "version": "1.0.0"
    },
    user_context={
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "user_email": "john.doe@example.com",
        "user_name": "John Doe"
    }
)
```

### 4. Frontend Type Updates

**File:** `archon-ui-nextjs/src/lib/types.ts`

Extended `McpClient` interface:

```typescript
export interface McpClient {
  session_id: string;
  client_type: "Claude" | "Cursor" | "Windsurf" | "Cline" | "KiRo" | "Augment" | "Gemini" | "Unknown";
  client_version?: string;
  connected_at: string;
  last_activity: string;
  status: "active" | "idle" | "disconnected";
  disconnected_at?: string;
  total_duration?: number;
  disconnect_reason?: string;
  user_id?: string;         // ✨ Added
  user_email?: string;      // ✨ Added
  user_name?: string;       // ✨ Added
}
```

### 5. Backend API Updates

**File:** `python/src/server/api_routes/mcp_api.py`

Updated `/api/mcp/clients` endpoint to return user fields:

```python
clients.append({
    "session_id": session["session_id"],
    "client_type": session["client_type"],
    # ... existing fields ...
    "user_id": session.get("user_id"),         # ✨ Added
    "user_email": session.get("user_email"),   # ✨ Added
    "user_name": session.get("user_name"),     # ✨ Added
})
```

## Use Cases

### 1. Multi-Tenant SaaS Deployments

Track usage per user account:

```sql
-- Get all sessions for a specific user
SELECT * FROM get_user_sessions('user-uuid-here');

-- Get user activity summary
SELECT * FROM get_user_activity_summary('user-uuid-here', 30);

-- View all user statistics
SELECT * FROM archon_mcp_user_stats
ORDER BY total_cost DESC;
```

### 2. Cost Allocation

Allocate LLM API costs per user or department:

```sql
-- Monthly cost report by user
SELECT
    user_email,
    user_name,
    COUNT(*) AS total_sessions,
    SUM(total_requests) AS total_requests,
    SUM(total_tokens) AS total_tokens,
    ROUND(SUM(total_cost)::NUMERIC, 2) AS total_cost_usd
FROM archon_mcp_user_stats
GROUP BY user_email, user_name
ORDER BY total_cost_usd DESC;
```

### 3. Usage Analytics

Track user engagement and adoption:

```sql
-- Top 10 most active users
SELECT
    user_email,
    user_name,
    total_sessions,
    total_requests,
    most_used_client,
    last_seen
FROM get_user_activity_summary('user-uuid', 30)
ORDER BY total_requests DESC
LIMIT 10;
```

### 4. Access Control (Future)

Prepare for Row Level Security (RLS):

```sql
-- Policy is created but disabled by default
-- Enable when ready for multi-user authentication:
ALTER TABLE archon_mcp_sessions ENABLE ROW LEVEL SECURITY;

-- Users will only see their own sessions
-- Service role still has full access
```

## Integration with Supabase Auth

To integrate with Supabase authentication:

### 1. Extract User Context from JWT

```python
from fastapi import Request, Depends
from jose import jwt

async def get_current_user(request: Request) -> dict:
    """Extract user from Supabase JWT token."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")

    if not token:
        return None

    try:
        # Decode JWT (use Supabase JWT secret)
        payload = jwt.decode(
            token,
            os.getenv("SUPABASE_JWT_SECRET"),
            algorithms=["HS256"]
        )

        return {
            "user_id": payload.get("sub"),
            "user_email": payload.get("email"),
            "user_name": payload.get("user_metadata", {}).get("full_name")
        }
    except Exception:
        return None
```

### 2. Pass User Context to Session Manager

```python
from fastapi import Depends

@app.post("/mcp/initialize")
async def initialize_mcp(
    client_info: dict,
    user: dict = Depends(get_current_user)
):
    session_manager = get_session_manager()

    session_id = session_manager.create_session(
        client_info=client_info,
        user_context=user  # Automatically includes user_id, user_email, user_name
    )

    return {"session_id": session_id}
```

### 3. Enable Row Level Security (Optional)

```sql
-- Enable RLS on archon_mcp_sessions
ALTER TABLE archon_mcp_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own sessions
-- Service role bypasses RLS and has full access
```

## Dashboard Updates

The MCP dashboard will automatically display user information when available:

1. **Client List** - Shows user email/name if present
2. **User Statistics** - New tab showing per-user analytics
3. **Cost Reports** - Filter by user for cost allocation

## Backward Compatibility

✅ **Fully backward compatible:**
- User columns are NULLable
- Existing sessions continue to work without user context
- Service role access is unchanged
- Current deployments don't require updates

## Migration Instructions

### Run Migration

```bash
cd ~/Documents/Projects/archon

# Connect to database
docker exec -it supabase-ai-db psql -U postgres -d postgres

# Run migration
\i migration/0.3.0/014_add_user_context_to_sessions.sql

# Verify columns added
\d archon_mcp_sessions

# Check new views
SELECT * FROM archon_mcp_user_stats;
```

### Rollback (if needed)

```sql
-- Drop new columns
ALTER TABLE archon_mcp_sessions
DROP COLUMN IF EXISTS user_id,
DROP COLUMN IF EXISTS user_email,
DROP COLUMN IF EXISTS user_name;

-- Drop new objects
DROP VIEW IF EXISTS archon_mcp_user_stats;
DROP FUNCTION IF EXISTS get_user_sessions;
DROP FUNCTION IF EXISTS get_user_activity_summary;
```

## Security Considerations

### 1. PII (Personally Identifiable Information)

User emails and names are stored in the database:
- ⚠️ **Compliance:** Ensure GDPR/CCPA compliance if storing EU/CA users
- ⚠️ **Retention:** Implement data retention policies
- ⚠️ **Encryption:** Database should use encryption at rest

### 2. Row Level Security

RLS policy is created but **disabled by default**:
- ✅ Safe for single-tenant deployments
- ⚠️ Enable RLS when deploying multi-tenant SaaS
- ⚠️ Test RLS policies thoroughly before production

### 3. API Access

Current API endpoints return user data:
- ⚠️ Ensure proper authentication on API routes
- ⚠️ Filter user data based on requestor's permissions
- ✅ Service role bypasses RLS for admin access

## Testing

### 1. Create Session with User Context

```python
import requests

response = requests.post("http://localhost:8181/api/mcp/initialize", json={
    "client_info": {
        "name": "Claude Code",
        "version": "1.0.0"
    },
    "user_context": {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "user_email": "test@example.com",
        "user_name": "Test User"
    }
})
```

### 2. Verify User Data in Database

```sql
SELECT
    session_id,
    client_type,
    user_email,
    user_name,
    connected_at,
    status
FROM archon_mcp_sessions
WHERE user_id IS NOT NULL
ORDER BY connected_at DESC
LIMIT 5;
```

### 3. Test User Statistics

```sql
-- Should return user stats
SELECT * FROM archon_mcp_user_stats;

-- Should return empty if no users tracked yet
-- This is expected for existing deployments
```

## Future Enhancements

Potential improvements for future iterations:

1. **User Authentication Middleware**
   - Automatic JWT extraction from headers
   - User context injection for all MCP requests

2. **User Management API**
   - List users with usage statistics
   - User activity reports
   - Cost allocation exports

3. **Dashboard Enhancements**
   - User dropdown filter in MCP dashboard
   - Per-user analytics charts
   - Cost breakdown by user/department

4. **Advanced RLS Policies**
   - Department-level access control
   - Admin users can see all sessions
   - Read-only access for finance team

5. **Usage Limits**
   - Per-user token quotas
   - Cost caps per user/department
   - Rate limiting by user_id

## Related Tasks

- **Task 113:** Session Cleanup on Client Disconnect
- **Task 116:** Update MCP Dashboard to Show Both API and MCP Activity
- **Task 117:** Add User Context to MCP Sessions (this task)

## Notes

- User context is **optional** - existing code continues to work
- User tracking is **opt-in** - requires passing `user_context` parameter
- RLS is **disabled by default** - enable when ready for multi-user
- All changes are **backward compatible** - no breaking changes

---

**Last Updated:** 2026-01-09
**Task:** 117 - Add User Context to MCP Sessions (Multi-User Prep)
**Status:** ✅ Complete (Pending Testing)
**Migration:** 014_add_user_context_to_sessions.sql
