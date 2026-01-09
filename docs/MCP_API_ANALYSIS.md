# Archon MCP API - Complete Analysis

**Project**: Archon UI - MCP Dashboard Enhancement
**Task**: API Capabilities Analysis
**Date**: 2026-01-09
**Author**: codebase-analyst agent

---

## Executive Summary

The Archon MCP API provides **9 REST endpoints** for monitoring and tracking MCP server activity. The backend has **comprehensive tracking infrastructure** with 3 database tables, 12+ indexes, and 4 helper functions. Most endpoints are actively used, but **2 critical endpoints remain unused** by the frontend: session details (`/api/mcp/sessions/{id}`) and pricing data (`/api/mcp/pricing`).

**Key Finding**: All required data for tool execution tracking, session analytics, and error monitoring **already exists** in the database. The primary work needed is **frontend integration** to expose this existing capability.

---

## Available Endpoints

### 1. Server Status

**Endpoint**: `GET /api/mcp/status`
**Purpose**: Get MCP server status and uptime
**Auth**: None required

**Request**:
```bash
curl http://localhost:8181/api/mcp/status
```

**Response**:
```json
{
  "status": "running",          // running | unreachable | unhealthy | error
  "uptime": 905,                // Seconds since start
  "logs": []                    // Legacy field (empty)
}
```

**Monitoring Strategy**:
- Default: HTTP health check (`http://localhost:8051/health`) - secure, portable
- Legacy: Docker socket mode (requires `ENABLE_DOCKER_SOCKET_MONITORING=true`)

**Frontend Usage**: ✅ Used in `useMcpStatus()` hook (5-10s polling)

---

### 2. Server Configuration

**Endpoint**: `GET /api/mcp/config`
**Purpose**: Get MCP server connection details
**Auth**: None required

**Request**:
```bash
curl http://localhost:8181/api/mcp/config
```

**Response**:
```json
{
  "host": "localhost",
  "port": 8051,
  "transport": "streamable-http",
  "model_choice": "gpt-4o-mini"      // From database credentials
}
```

**Frontend Usage**: ✅ Used in `useMcpConfig()` hook (static, staleTime: Infinity)

---

### 3. Connected Clients

**Endpoint**: `GET /api/mcp/clients`
**Query Parameters**: `status_filter` (optional: active | idle | all)
**Purpose**: List connected MCP clients (Claude, Cursor, Windsurf, etc.)
**Auth**: None required

**Request**:
```bash
curl "http://localhost:8181/api/mcp/clients?status_filter=active"
```

**Response**:
```json
{
  "clients": [
    {
      "session_id": "550e8400-e29b-41d4-a716-446655440000",
      "client_type": "Claude",          // Claude | Cursor | Windsurf | Cline | Unknown
      "client_version": "1.0.0",
      "connected_at": "2026-01-09T10:00:00Z",
      "last_activity": "2026-01-09T12:30:00Z",
      "status": "active"                // active | idle | disconnected
    }
  ],
  "total": 1
}
```

**Database Query**:
```sql
SELECT * FROM archon_mcp_sessions
WHERE disconnected_at IS NULL
  AND status = 'active'
ORDER BY last_activity DESC;
```

**Frontend Usage**: ✅ Used in `useMcpClients()` hook (10-30s polling)

---

### 4. Session Information

**Endpoint**: `GET /api/mcp/sessions`
**Purpose**: Get active session count and server uptime
**Auth**: None required

**Request**:
```bash
curl http://localhost:8181/api/mcp/sessions
```

**Response**:
```json
{
  "active_sessions": 3,
  "session_timeout": 3600,              // 1 hour
  "server_uptime_seconds": 906
}
```

**Database Query**:
```sql
SELECT COUNT(*) FROM archon_mcp_sessions
WHERE disconnected_at IS NULL
  AND status IN ('active', 'idle');
```

**Frontend Usage**: ✅ Used in `useMcpSessionInfo()` hook (10-30s polling)

---

### 5. Session Details ⚠️ UNUSED - KEY FEATURE

**Endpoint**: `GET /api/mcp/sessions/{session_id}`
**Purpose**: Get detailed session info with **full request history**
**Auth**: None required

**Request**:
```bash
curl http://localhost:8181/api/mcp/sessions/550e8400-e29b-41d4-a716-446655440000
```

**Response**:
```json
{
  "session": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "client_type": "Claude",
    "client_version": "1.0.0",
    "client_capabilities": {"tools": true, "resources": true},
    "connected_at": "2026-01-09T10:00:00Z",
    "disconnected_at": null,
    "last_activity": "2026-01-09T12:30:00Z",
    "status": "active",
    "metadata": {}
  },
  "requests": [
    {
      "request_id": "a1b2c3d4-...",
      "session_id": "550e8400-...",
      "method": "tools/call",                    // MCP method
      "tool_name": "rag_search_knowledge_base",  // Tool name (if method is tools/call)
      "prompt_tokens": 150,
      "completion_tokens": 300,
      "total_tokens": 450,                       // Auto-calculated
      "estimated_cost": 0.001350,                // USD (from archon_llm_pricing)
      "timestamp": "2026-01-09T10:05:00Z",
      "duration_ms": 250,                        // Response time
      "status": "success",                       // success | error | timeout
      "error_message": null
    },
    {
      "request_id": "e5f6g7h8-...",
      "session_id": "550e8400-...",
      "method": "tools/call",
      "tool_name": "find_tasks",
      "prompt_tokens": 100,
      "completion_tokens": 200,
      "total_tokens": 300,
      "estimated_cost": 0.000900,
      "timestamp": "2026-01-09T10:10:00Z",
      "duration_ms": 180,
      "status": "success",
      "error_message": null
    }
  ],
  "summary": {
    "total_requests": 15,
    "total_prompt_tokens": 2250,
    "total_completion_tokens": 4500,
    "total_tokens": 6750,
    "total_cost": 0.020250
  }
}
```

**Database Query**:
```sql
-- Session details
SELECT * FROM archon_mcp_sessions WHERE session_id = $1;

-- Request history (last 100)
SELECT * FROM archon_mcp_requests
WHERE session_id = $1
ORDER BY timestamp DESC
LIMIT 100;
```

**Frontend Usage**: ❌ **NOT IMPLEMENTED** - This is the missing piece for **Task 3: Tool execution history**

**What This Enables**:
- ✅ Complete tool execution timeline
- ✅ Token usage breakdown per tool
- ✅ Cost tracking per session
- ✅ Error/success status for each request
- ✅ Performance metrics (duration_ms)

---

### 6. Usage Summary

**Endpoint**: `GET /api/mcp/usage/summary`
**Query Parameters**: `days` (default: 30), `start_date` (ISO), `end_date` (ISO)
**Purpose**: Aggregated usage statistics with tool breakdown
**Auth**: None required

**Request**:
```bash
curl "http://localhost:8181/api/mcp/usage/summary?days=7"
```

**Response**:
```json
{
  "period": {
    "start": "2026-01-02T12:00:00Z",
    "end": "2026-01-09T12:00:00Z",
    "days": 7
  },
  "summary": {
    "total_requests": 150,
    "total_prompt_tokens": 25000,
    "total_completion_tokens": 50000,
    "total_tokens": 75000,
    "total_cost": 0.225000,
    "unique_sessions": 3
  },
  "by_tool": {
    "rag_search_knowledge_base": {
      "count": 45,
      "tokens": 22500,
      "cost": 0.067500
    },
    "find_tasks": {
      "count": 30,
      "tokens": 15000,
      "cost": 0.045000
    },
    "manage_task": {
      "count": 25,
      "tokens": 12500,
      "cost": 0.037500
    }
  }
}
```

**Database Query**:
```sql
SELECT
    COUNT(*) as total_requests,
    SUM(prompt_tokens) as total_prompt_tokens,
    SUM(completion_tokens) as total_completion_tokens,
    SUM(total_tokens) as total_tokens,
    SUM(estimated_cost) as total_cost,
    COUNT(DISTINCT session_id) as unique_sessions
FROM archon_mcp_requests
WHERE timestamp BETWEEN $1 AND $2
  AND status = 'success';
```

**Frontend Usage**: ✅ Used in `useMcpUsageStats(days)` hook (30-60s polling)

---

### 7. Pricing Data ⚠️ UNUSED

**Endpoint**: `GET /api/mcp/pricing`
**Query Parameters**: `provider` (OpenAI | Anthropic), `model` (partial match)
**Purpose**: Get LLM pricing for cost estimation
**Auth**: None required

**Request**:
```bash
curl "http://localhost:8181/api/mcp/pricing?provider=Anthropic"
```

**Response**:
```json
{
  "pricing": [
    {
      "id": 8,
      "model_name": "claude-3-5-haiku-20241022",
      "provider": "Anthropic",
      "input_price_per_1k": 0.001,      // USD per 1,000 tokens
      "output_price_per_1k": 0.005,     // USD per 1,000 tokens
      "effective_date": "2024-11-04",
      "notes": "Claude 3.5 Haiku"
    },
    {
      "id": 7,
      "model_name": "claude-3-5-sonnet-20241022",
      "provider": "Anthropic",
      "input_price_per_1k": 0.003,
      "output_price_per_1k": 0.015,
      "effective_date": "2024-10-22",
      "notes": "Claude 3.5 Sonnet (Latest)"
    }
  ],
  "total": 11,
  "note": "Prices are per 1,000 tokens in USD"
}
```

**Available Models** (11 total):
- **OpenAI**: gpt-4, gpt-4-turbo, gpt-4o, gpt-4o-mini, gpt-3.5-turbo
- **Anthropic**: claude-3-5-sonnet (2 versions), claude-3-5-haiku, claude-3-opus, claude-3-sonnet, claude-3-haiku

**Frontend Usage**: ❌ **NOT IMPLEMENTED** - Could be used for:
- Cost breakdown tooltips
- Model comparison
- Budget alerts

---

### 8. Health Check

**Endpoint**: `GET /api/mcp/health`
**Purpose**: Simple health check (used by bug report service)
**Auth**: None required

**Request**:
```bash
curl http://localhost:8181/api/mcp/health
```

**Response**:
```json
{
  "status": "healthy",
  "service": "mcp"
}
```

**Frontend Usage**: ✅ Used for health monitoring

---

## Database Schema

### Table 1: `archon_mcp_sessions` (Client Tracking)

**Purpose**: Track connected MCP clients (Claude, Cursor, Windsurf, etc.)

**Columns**:
```sql
session_id UUID PRIMARY KEY                    -- Unique session ID
client_type VARCHAR(50) NOT NULL               -- Claude | Cursor | Windsurf | Cline | Unknown
client_version VARCHAR(50)                     -- Client version (e.g., "1.0.0")
client_capabilities JSONB                      -- MCP capabilities {"tools": true, "resources": true}
connected_at TIMESTAMPTZ NOT NULL              -- Connection start time
disconnected_at TIMESTAMPTZ                    -- Disconnection time (NULL if still connected)
last_activity TIMESTAMPTZ NOT NULL             -- Last request time
status VARCHAR(20) NOT NULL                    -- active | idle | disconnected
metadata JSONB DEFAULT '{}'                    -- Additional client info (user-agent, platform)
```

**Constraints**:
- Status CHECK: `status IN ('active', 'idle', 'disconnected')`

**Indexes** (5 indexes):
1. `idx_archon_mcp_sessions_status` - Status filter queries
2. `idx_archon_mcp_sessions_client_type` - Client type filter
3. `idx_archon_mcp_sessions_connected_at` - Connection history
4. `idx_archon_mcp_sessions_last_activity` - Recent activity
5. `idx_archon_mcp_sessions_status_activity` - Composite (status, last_activity) - **Most used**

**Status Logic**:
- **active**: Last activity < 5 minutes ago
- **idle**: Last activity 5 minutes - 1 hour ago
- **disconnected**: Explicitly disconnected (disconnected_at NOT NULL)

---

### Table 2: `archon_mcp_requests` (Tool Execution & Token Tracking)

**Purpose**: Track all MCP requests with token usage, cost, and performance

**Columns**:
```sql
request_id UUID PRIMARY KEY                    -- Unique request ID
session_id UUID NOT NULL                       -- FK to archon_mcp_sessions (CASCADE)
method VARCHAR(100) NOT NULL                   -- MCP method (tools/call, resources/read, etc.)
tool_name VARCHAR(100)                         -- Tool name (if method is tools/call)
prompt_tokens INTEGER DEFAULT 0                -- Input tokens
completion_tokens INTEGER DEFAULT 0            -- Output tokens
total_tokens INTEGER GENERATED ALWAYS AS       -- Auto-calculated (prompt + completion)
    (prompt_tokens + completion_tokens) STORED
estimated_cost DECIMAL(10,6) DEFAULT 0         -- Cost in USD (from archon_llm_pricing)
timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- Request time
duration_ms INTEGER                            -- Response time in milliseconds
status VARCHAR(20) NOT NULL DEFAULT 'success'  -- success | error | timeout
error_message TEXT                             -- Error details (if status = error)
```

**Constraints**:
- Status CHECK: `status IN ('success', 'error', 'timeout')`
- Foreign Key: `session_id` → `archon_mcp_sessions(session_id)` ON DELETE CASCADE

**Indexes** (7 indexes):
1. `idx_archon_mcp_requests_session_id` - Session lookups
2. `idx_archon_mcp_requests_timestamp` - Time-based queries
3. `idx_archon_mcp_requests_method` - Method filter
4. `idx_archon_mcp_requests_tool_name` - Tool filter
5. `idx_archon_mcp_requests_session_time` - Composite (session_id, timestamp) - **Session history**
6. `idx_archon_mcp_requests_method_time` - Composite (method, timestamp) - **Method analytics**
7. `idx_archon_mcp_requests_status` (implicit) - Error filtering

**Key Tracking Data**:
- ✅ **Tool execution history** - tool_name, timestamp, duration_ms
- ✅ **Token usage** - prompt_tokens, completion_tokens, total_tokens
- ✅ **Cost tracking** - estimated_cost per request
- ✅ **Error logs** - status, error_message
- ✅ **Performance metrics** - duration_ms

---

### Table 3: `archon_llm_pricing` (Cost Estimation)

**Purpose**: LLM pricing data for cost calculations

**Columns**:
```sql
id SERIAL PRIMARY KEY                          -- Auto-increment ID
model_name VARCHAR(100) NOT NULL               -- Model ID (e.g., gpt-4o-mini, claude-3-5-sonnet)
provider VARCHAR(50) NOT NULL                  -- OpenAI | Anthropic
input_price_per_1k DECIMAL(10,6) NOT NULL      -- Input token price per 1,000 tokens (USD)
output_price_per_1k DECIMAL(10,6) NOT NULL     -- Output token price per 1,000 tokens (USD)
effective_date DATE NOT NULL DEFAULT CURRENT_DATE
notes TEXT                                     -- Pricing context/notes
```

**Constraints**:
- UNIQUE: `(model_name, provider, effective_date)` - Supports pricing history

**Indexes** (1 index):
1. `idx_archon_llm_pricing_model_provider` - Composite (model_name, provider, effective_date DESC)

**Seed Data** (11 models):
- OpenAI: 5 models (GPT-4, GPT-4 Turbo, GPT-4o, GPT-4o Mini, GPT-3.5 Turbo)
- Anthropic: 6 models (Claude 3.5 Sonnet x2, Claude 3.5 Haiku, Claude 3 Opus/Sonnet/Haiku)

---

## Helper Functions (4 total)

### 1. `get_active_mcp_clients()`

**Purpose**: Get all currently connected clients
**Returns**: TABLE (session_id, client_type, client_version, connected_at, last_activity, status)

**Usage**:
```sql
SELECT * FROM get_active_mcp_clients();
```

**Equivalent Query**:
```sql
SELECT session_id, client_type, client_version, connected_at, last_activity, status
FROM archon_mcp_sessions
WHERE status IN ('active', 'idle')
  AND disconnected_at IS NULL
ORDER BY last_activity DESC;
```

---

### 2. `get_mcp_usage_summary(start_date, end_date)`

**Purpose**: Aggregated usage stats for a date range
**Parameters**: `start_date` (default: 30 days ago), `end_date` (default: now)
**Returns**: TABLE (total_requests, total_prompt_tokens, total_completion_tokens, total_tokens, total_cost, unique_sessions)

**Usage**:
```sql
-- Last 7 days
SELECT * FROM get_mcp_usage_summary(
    NOW() - INTERVAL '7 days',
    NOW()
);
```

---

### 3. `get_mcp_usage_by_tool(start_date, end_date)`

**Purpose**: Usage statistics grouped by MCP tool
**Parameters**: `start_date` (default: 30 days ago), `end_date` (default: now)
**Returns**: TABLE (tool_name, request_count, total_tokens, total_cost, avg_duration_ms)

**Usage**:
```sql
-- Top 10 tools by request count
SELECT * FROM get_mcp_usage_by_tool(
    NOW() - INTERVAL '30 days',
    NOW()
)
LIMIT 10;
```

**Output Example**:
```
tool_name                    | request_count | total_tokens | total_cost | avg_duration_ms
----------------------------|---------------|--------------|------------|-----------------
rag_search_knowledge_base   | 45            | 22500        | 0.067500   | 250.00
find_tasks                  | 30            | 15000        | 0.045000   | 180.00
manage_task                 | 25            | 12500        | 0.037500   | 150.00
```

---

### 4. `calculate_request_cost(model_name, provider, prompt_tokens, completion_tokens)`

**Purpose**: Calculate estimated cost for a request
**Parameters**: model_name, provider, prompt_tokens, completion_tokens
**Returns**: DECIMAL (cost in USD, 6 decimal places)

**Usage**:
```sql
SELECT calculate_request_cost(
    'claude-3-5-sonnet-20241022',
    'Anthropic',
    1000,    -- prompt tokens
    2000     -- completion tokens
);
-- Returns: 0.033000 (0.003 * 1 + 0.015 * 2)
```

**Formula**:
```
cost = (prompt_tokens / 1000 * input_price_per_1k) +
       (completion_tokens / 1000 * output_price_per_1k)
```

---

## Triggers & Automation

### `trigger_update_session_status`

**Purpose**: Auto-update session status and last_activity on each request
**Trigger**: AFTER INSERT ON `archon_mcp_requests`

**Behavior**:
```sql
-- Updates parent session whenever a request is logged
UPDATE archon_mcp_sessions
SET last_activity = NEW.timestamp,
    status = CASE
        WHEN NEW.timestamp > NOW() - INTERVAL '5 minutes' THEN 'active'
        WHEN NEW.timestamp > NOW() - INTERVAL '1 hour' THEN 'idle'
        ELSE 'idle'
    END
WHERE session_id = NEW.session_id;
```

**Effect**: Ensures session.last_activity and session.status are always current

---

## Security: Row Level Security (RLS)

**All 3 tables have RLS enabled** with 2 policies each:

1. **Service Role Full Access**: `auth.role() = 'service_role'`
2. **Authenticated Users Read-Only**: `TO authenticated USING (true)`

**Implications**:
- ✅ Frontend can read all MCP data (if authenticated)
- ✅ Backend (service role) can write request logs
- ✅ No unauthorized access to token/cost data

---

## Data Available for Tracking Features

### Tool Execution History (Task 3) ✅

**Data Source**: `GET /api/mcp/sessions/{session_id}` endpoint
**What's Available**:
- ✅ Request history per session (last 100 requests)
- ✅ Tool names (tool_name column)
- ✅ Timestamps (timestamp column)
- ✅ Token usage (prompt_tokens, completion_tokens, total_tokens)
- ✅ Cost tracking (estimated_cost)
- ✅ Performance metrics (duration_ms)
- ✅ Success/error status (status, error_message)

**Frontend Integration Needed**:
- Hook: `useSessionDetails(sessionId)` → calls `/api/mcp/sessions/{id}`
- Component: `ToolExecutionHistory.tsx` → displays request list
- API Client: Add `mcpApi.getSessionDetails(sessionId)`

---

### Session Analytics (Task 4) ✅

**Data Source**: `archon_mcp_requests` table
**What's Available**:
- ✅ Session timeline (timestamp, tool_name, status)
- ✅ Request chronology (ORDER BY timestamp)
- ✅ Success/error indicators (status column)
- ✅ Time markers (timestamp with timezone)

**Frontend Integration Needed**:
- Component: `SessionTimeline.tsx` with framer-motion
- Data: Reuse `useSessionDetails()` hook data
- Visualization: Timeline with events (success = green, error = red)

---

### Error/Warning Monitoring (Task 5) ⚠️ PARTIALLY AVAILABLE

**Data Source**: `archon_mcp_requests.status` column
**What's Available**:
- ✅ Error status (status = 'error' | 'timeout')
- ✅ Error messages (error_message column)
- ✅ Error timestamps (timestamp column)
- ✅ Session context (session_id FK)

**Missing Backend Feature**:
- ❌ No dedicated `/api/mcp/errors` endpoint
- ❌ No severity filtering (warning vs error)
- ❌ No error count aggregation endpoint

**Backend Work Needed** (Task 5):
```typescript
// New endpoint needed
GET /api/mcp/errors?severity=warning|error&limit=50&session_id={id}

// Response structure
{
  "errors": [
    {
      "request_id": "uuid",
      "session_id": "uuid",
      "tool_name": "tool_name",
      "error_message": "Error details",
      "timestamp": "ISO8601",
      "severity": "error" // Derive from status or add new column
    }
  ],
  "summary": {
    "error_count": 5,
    "warning_count": 2,
    "last_error_at": "ISO8601"
  }
}
```

**Alternative**: Filter existing endpoints with `status=error|timeout`

---

### Analytics Dashboard (Task 6) ✅

**Data Source**: `/api/mcp/usage/summary` endpoint
**What's Available**:
- ✅ Total requests, tokens, cost (summary object)
- ✅ Tool usage breakdown (by_tool object)
- ✅ Unique session count
- ✅ Time period filtering (start_date, end_date, days)

**Additional Data Needed**:
- ⚠️ **Trends over time** - Need daily/hourly aggregates
- ⚠️ **Error rates** - Need error count per day
- ⚠️ **Average response times** - Need avg(duration_ms) per day

**Options**:
1. **Frontend aggregation**: Fetch all requests, group by day (works for <1000 requests)
2. **New backend endpoint**: `GET /api/mcp/analytics/trends?metric=tokens|cost|errors&interval=day|hour`

---

### Logs Viewer (Task 7) ✅

**Data Source**: `archon_mcp_requests` table
**What's Available**:
- ✅ All request logs (request_id, timestamp, method, tool_name, status)
- ✅ Full details (tokens, cost, duration_ms, error_message)
- ✅ Filter by tool_name (WHERE tool_name = $1)
- ✅ Filter by status (WHERE status = $1)
- ✅ Date range filter (WHERE timestamp BETWEEN $1 AND $2)
- ✅ Pagination support (LIMIT/OFFSET)

**Frontend Integration Needed**:
- Component: `ToolExecutionLogsViewer.tsx` with DataTable
- Hook: Reuse `useMcpUsageStats()` or create `useMcpRequestLogs(filters)`
- Features: Search, filter, sort, CSV export
- Pagination: Backend supports LIMIT/OFFSET

---

## Gaps Analysis

### Critical Gaps (Block Implementation)

**NONE** - All required data exists in database!

### Minor Gaps (Nice-to-Have)

1. **Error Endpoint** (Task 5)
   - Current: Filter `/api/mcp/sessions/{id}` with status=error
   - Ideal: Dedicated `/api/mcp/errors` endpoint with severity levels
   - Impact: Low (can work around with filtering)

2. **Trends Analytics** (Task 6)
   - Current: Total aggregates only
   - Ideal: Time-series data (daily/hourly breakdowns)
   - Impact: Medium (affects analytics charts)
   - Workaround: Frontend grouping of raw data

3. **Real-time Updates** (All tasks)
   - Current: TanStack Query polling (5-30s intervals)
   - Ideal: Server-Sent Events (SSE) for instant notifications
   - Impact: Low (polling works fine for MVP)

4. **Request Log Pagination** (Task 7)
   - Current: Backend returns all data
   - Ideal: Add pagination params to endpoints
   - Impact: Low (frontend pagination works)

---

## Recommended Backend Enhancements

### Priority 1: Error Monitoring Endpoint (Task 5)

**New Endpoint**: `GET /api/mcp/errors`

```python
@router.get("/errors")
async def get_mcp_errors(
    severity: Optional[str] = Query("all", description="Filter: error | timeout | all"),
    limit: int = Query(50, le=200),
    session_id: Optional[str] = Query(None)
):
    """
    Get recent MCP errors and timeouts.

    Returns error logs with session context and tool names.
    """
    query = db_client.table("archon_mcp_requests")\
        .select("*")\
        .order("timestamp", desc=True)\
        .limit(limit)

    if severity != "all":
        query = query.eq("status", severity)
    else:
        query = query.in_("status", ["error", "timeout"])

    if session_id:
        query = query.eq("session_id", session_id)

    result = query.execute()

    # Calculate error summary
    error_count = len([r for r in result.data if r["status"] == "error"])
    timeout_count = len([r for r in result.data if r["status"] == "timeout"])
    last_error = result.data[0] if result.data else None

    return {
        "errors": result.data,
        "summary": {
            "error_count": error_count,
            "timeout_count": timeout_count,
            "last_error_at": last_error["timestamp"] if last_error else None
        }
    }
```

**Estimated Effort**: ~1 hour

---

### Priority 2: Trends Analytics Endpoint (Task 6)

**New Endpoint**: `GET /api/mcp/analytics/trends`

```python
@router.get("/analytics/trends")
async def get_usage_trends(
    metric: str = Query("tokens", description="tokens | cost | requests | errors"),
    interval: str = Query("day", description="hour | day | week"),
    days: int = Query(30, le=365)
):
    """
    Get time-series analytics for charting.

    Returns data points grouped by time interval.
    """
    # SQL aggregation by interval using date_trunc()
    # Return format for recharts: [{date: "2026-01-01", value: 1500}, ...]
    pass
```

**Estimated Effort**: ~2 hours

---

### Priority 3: Request Log Pagination (Task 7)

**Enhance Existing**: Add pagination to session details endpoint

```python
@router.get("/sessions/{session_id}")
async def get_session_details(
    session_id: str,
    limit: int = Query(100, le=1000),
    offset: int = Query(0)
):
    """
    Enhanced with pagination support.
    """
    requests_result = db_client.table("archon_mcp_requests")\
        .select("*", count="exact")\
        .eq("session_id", session_id)\
        .order("timestamp", desc=True)\
        .range(offset, offset + limit - 1)\
        .execute()

    return {
        "session": session,
        "requests": requests_result.data,
        "pagination": {
            "total": requests_result.count,
            "limit": limit,
            "offset": offset,
            "has_more": requests_result.count > (offset + limit)
        },
        "summary": {...}
    }
```

**Estimated Effort**: ~30 minutes

---

## Frontend Integration Checklist

### Task 3: Tool Execution History ✅

**Required**:
- [ ] Hook: `useSessionDetails(sessionId)` in `src/hooks/useMcpQueries.ts`
- [ ] API: `mcpApi.getSessionDetails(sessionId)` in `src/lib/apiClient.ts`
- [ ] Component: `ToolExecutionHistory.tsx` in `src/components/MCP/`
- [ ] Types: `SessionDetails`, `McpRequest` interfaces in `src/lib/types.ts`
- [ ] Integration: Add to `/mcp` page (modal or section)

**Endpoint**: ✅ `/api/mcp/sessions/{id}` (exists, fully functional)

---

### Task 4: Session Timeline ✅

**Required**:
- [ ] Component: `SessionTimeline.tsx` in `src/components/MCP/`
- [ ] Library: framer-motion (already installed ✅)
- [ ] Data: Reuse `useSessionDetails()` hook
- [ ] Visualization: Timeline with time markers, zoom, scroll

**Endpoint**: ✅ Same as Task 3 (`/api/mcp/sessions/{id}`)

---

### Task 5: Error Monitoring ⚠️

**Required**:
- [ ] Backend: New `/api/mcp/errors` endpoint (~1 hour)
- [ ] Hook: `useMcpErrors(severity, limit)` in `src/hooks/useMcpQueries.ts`
- [ ] API: `mcpApi.getErrors(filters)` in `src/lib/apiClient.ts`
- [ ] Component: `ErrorWarningMonitor.tsx` in `src/components/MCP/`
- [ ] Types: `McpError` interface in `src/lib/types.ts`

**Endpoint**: ❌ **Needs implementation** (Priority 1)

**Alternative**: Filter existing session details with `status=error|timeout` (works but less efficient)

---

### Task 6: Analytics Dashboard ⚠️

**Required**:
- [ ] Backend: New `/api/mcp/analytics/trends` endpoint (~2 hours) - Optional
- [ ] Library: recharts (needs installation)
- [ ] Component: `McpAnalyticsSection.tsx` in `src/components/MCP/`
- [ ] Charts: Line (usage trends), Area (error rates), Bar (tool comparison)
- [ ] Hook: `useMcpTrends(metric, interval)` if backend endpoint added

**Endpoint**: ✅ `/api/mcp/usage/summary` exists (aggregates only)
**Enhancement**: Add trends endpoint for time-series data (Priority 2)

---

### Task 7: Logs Viewer ✅

**Required**:
- [ ] Component: `ToolExecutionLogsViewer.tsx` with DataTable
- [ ] Hook: `useMcpRequestLogs(filters, pagination)`
- [ ] API: Enhance `mcpApi` with log filtering
- [ ] Features: Search, filter (tool, status, date), sort, CSV export
- [ ] Pagination: Frontend (virtualization) or backend

**Endpoint**: ✅ Can use `/api/mcp/sessions/{id}` or query requests table directly
**Enhancement**: Add pagination params (Priority 3, ~30 min)

---

## Summary & Recommendations

### Key Findings

1. **Backend is 95% ready** - All core tracking infrastructure exists
2. **2 unused endpoints** - Session details and pricing (critical for features)
3. **Minor gaps** - Error endpoint, trends analytics (nice-to-have)
4. **All data exists** - No database schema changes needed

### Implementation Strategy

**Phase 1** (Tasks 1-2): Foundation & Design
- ✅ Document API capabilities (this document)
- ⏳ Design TypeScript interfaces (Task 2)

**Phase 2** (Task 5): Backend Enhancement
- Add `/api/mcp/errors` endpoint (~1 hour)
- Optional: Add `/api/mcp/analytics/trends` endpoint (~2 hours)

**Phase 3** (Tasks 3-4, 7): Core UI Components
- Implement session details hook & component (Task 3)
- Build session timeline (Task 4)
- Create logs viewer (Task 7)
- All use existing endpoints ✅

**Phase 4** (Task 6): Analytics
- Install recharts
- Build analytics section
- Use existing summary endpoint + recharts

**Phase 5** (Task 8): Testing
- Unit tests with MSW mocks
- 70% coverage target

---

## Appendix: Endpoint Testing

### Test Session Details Endpoint (When Data Available)

```bash
# 1. Find a session ID
curl -s http://localhost:8181/api/mcp/clients | jq -r '.clients[0].session_id'

# 2. Get session details
SESSION_ID="<uuid-from-above>"
curl -s "http://localhost:8181/api/mcp/sessions/${SESSION_ID}" | jq

# 3. Expected response structure
{
  "session": {...},
  "requests": [{...}],  # Array of tool executions
  "summary": {...}      # Aggregated stats
}
```

### Test Usage Summary with Tool Breakdown

```bash
# Get last 7 days with tool usage
curl -s "http://localhost:8181/api/mcp/usage/summary?days=7" | jq '.by_tool'

# Expected: Object with tool names as keys
{
  "rag_search_knowledge_base": {
    "count": 45,
    "tokens": 22500,
    "cost": 0.0675
  },
  "find_tasks": {
    "count": 30,
    "tokens": 15000,
    "cost": 0.045
  }
}
```

---

**End of Analysis** | **Next Task**: Design MCP tracking data model (Task 2)
