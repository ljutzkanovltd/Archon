# MCP Dashboard Updates - Task 116

## Summary

Updated the MCP dashboard to display session disconnect tracking information, including duration and disconnect reasons.

## Changes Made

### 1. Frontend Type Updates

**File:** `archon-ui-nextjs/src/lib/types.ts`

Updated `McpClient` interface to include disconnect tracking fields:

```typescript
export interface McpClient {
  session_id: string;
  client_type: "Claude" | "Cursor" | "Windsurf" | "Cline" | "KiRo" | "Augment" | "Gemini" | "Unknown";
  client_version?: string;              // ✨ Added
  connected_at: string;
  last_activity: string;
  status: "active" | "idle" | "disconnected";  // ✨ Updated to include "disconnected"
  disconnected_at?: string;             // ✨ Added
  total_duration?: number;              // ✨ Added (session duration in seconds)
  disconnect_reason?: string;           // ✨ Added (client_disconnect, timeout, server_shutdown, error:<type>)
}
```

### 2. Backend API Updates

**File:** `python/src/server/api_routes/mcp_api.py`

#### Updated `/api/mcp/clients` Endpoint

Extended the response to include disconnect tracking fields:

```python
clients.append({
    "session_id": session["session_id"],
    "client_type": session["client_type"],
    "client_version": session.get("client_version"),
    "connected_at": session["connected_at"],
    "last_activity": session["last_activity"],
    "status": session["status"],
    "disconnected_at": session.get("disconnected_at"),      # ✨ Added
    "total_duration": session.get("total_duration"),        # ✨ Added
    "disconnect_reason": session.get("disconnect_reason"),  # ✨ Added
})
```

#### Added New `/api/mcp/sessions/disconnected` Endpoint

Created new endpoint to retrieve disconnected sessions with statistics:

**Query Parameters:**
- `days` (default: 7, max: 30) - Number of days to look back
- `limit` (default: 50, max: 200) - Maximum sessions to return

**Response Structure:**
```json
{
  "sessions": [
    {
      "session_id": "uuid",
      "client_type": "Claude Code",
      "client_version": "1.0.0",
      "connected_at": "2025-01-09T10:00:00Z",
      "disconnected_at": "2025-01-09T11:30:00Z",
      "total_duration": 5400,
      "disconnect_reason": "client_disconnect",
      "status": "disconnected",
      "total_requests": 42
    }
  ],
  "statistics": {
    "total_disconnected": 10,
    "disconnect_reasons": {
      "client_disconnect": 5,
      "timeout": 2,
      "server_shutdown": 3
    },
    "avg_duration_seconds": 3600.5,
    "max_duration_seconds": 7200,
    "min_duration_seconds": 1800
  },
  "period": {
    "start": "2025-01-02T10:00:00Z",
    "end": "2025-01-09T10:00:00Z",
    "days": 7
  }
}
```

## Dashboard Integration

### Existing Components (No Changes Required)

The dashboard already has comprehensive components that will automatically display the new data:

1. **McpClientList** - Displays connected clients
   - Will now show `client_version` if available
   - Can filter by status including "disconnected"

2. **SessionTimeline** - Shows session activity over time
   - Will automatically display disconnect information

3. **McpAnalytics** - Analytics and charts
   - Can now show disconnect reason breakdown

4. **UsageStatsCard** - Usage statistics
   - Will include session duration stats

### Smart Polling

The dashboard uses TanStack Query with smart polling:
- **10 seconds** when page is visible
- **30 seconds** when page is hidden
- Automatic refetch on window focus

## Database Schema

The following fields are now tracked in `archon_mcp_sessions` table:

| Field | Type | Description |
|-------|------|-------------|
| `disconnected_at` | TIMESTAMPTZ | When session ended (NULL for active) |
| `total_duration` | INTEGER | Session duration in seconds |
| `disconnect_reason` | VARCHAR(100) | Reason for disconnect |

**Disconnect Reasons:**
- `client_disconnect` - Normal client disconnection
- `timeout` - Session expired due to inactivity
- `server_shutdown` - Server gracefully shut down
- `error:<ErrorType>` - Error-triggered disconnection

## Testing

### Verify Backend Endpoints (Once Archon is Running)

```bash
# Test active clients endpoint (includes new fields)
curl -s http://localhost:8181/api/mcp/clients | jq

# Test disconnected sessions endpoint
curl -s "http://localhost:8181/api/mcp/sessions/disconnected?days=7" | jq

# Test specific session details
curl -s "http://localhost:8181/api/mcp/sessions/{session_id}" | jq
```

### Verify Dashboard

1. Start Archon services
2. Open dashboard: `http://localhost:3737/mcp`
3. Check that connected clients show version info
4. Navigate to session history to see disconnect information
5. Verify analytics show disconnect reason breakdown

## Benefits

1. **Session Monitoring** - Track how long clients stay connected
2. **Disconnect Analysis** - Understand why clients disconnect (timeout vs. graceful vs. error)
3. **Performance Insights** - Identify patterns in session duration
4. **Debugging** - Quickly diagnose connection issues by disconnect reason
5. **Historical Data** - View session history for the past 30 days

## Related Tasks

- **Task 113:** Session Cleanup on Client Disconnect (implemented `close_session()`)
- **Task 116:** Update MCP Dashboard (this task)
- **Migration 013:** Added database fields for disconnect tracking

## Future Enhancements

Potential improvements for future iterations:

1. **Real-time Disconnect Alerts** - Notify when sessions disconnect unexpectedly
2. **Session Duration Charts** - Visualize session length distribution
3. **Disconnect Reason Trends** - Track disconnect reasons over time
4. **Client Comparison** - Compare session patterns across different IDEs
5. **Session Replay** - View all requests made during a session

## API Documentation

### GET `/api/mcp/clients`

Retrieve connected MCP clients (active, idle, or disconnected).

**Query Parameters:**
- `status_filter` (optional): "active", "idle", "all"

**Response:** See TypeScript interface above

### GET `/api/mcp/sessions/disconnected`

Retrieve recently disconnected sessions with statistics.

**Query Parameters:**
- `days` (1-30, default: 7): Lookback period
- `limit` (1-200, default: 50): Max sessions

**Response:** JSON with sessions array and statistics object

## Notes

- All existing dashboard components are compatible with the new fields
- TypeScript type safety ensures correct usage across the frontend
- Backend endpoints return consistent data structures
- Smart polling minimizes unnecessary API calls
- Database indexes support efficient queries on disconnect_reason

---

**Last Updated:** 2025-01-09
**Task:** 116 - Update MCP Dashboard to Show Both API and MCP Activity
**Status:** ✅ Complete (Pending Testing)
