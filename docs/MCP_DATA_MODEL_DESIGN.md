# Archon MCP Tracking Data Model - Design Document

**Project**: Archon UI - MCP Dashboard Enhancement
**Task**: Design MCP tracking data model
**Date**: 2026-01-09
**Author**: architect agent
**References**: MCP_API_ANALYSIS.md, existing types.ts

---

## Executive Summary

This document defines the TypeScript interfaces, component state patterns, and data flow architecture for the new MCP tracking features. The design extends existing MCP types (`McpClient`, `McpServerStatus`, etc.) with **5 new interface groups** to support tool execution tracking, session analytics, error monitoring, analytics dashboards, and logs viewing.

**Key Design Principles**:
1. **Extend, don't replace** - Build on existing `McpClient`, `McpSessionInfo` types
2. **TanStack Query patterns** - Follow existing query key factory and polling patterns
3. **Type safety** - Mirror backend response structures exactly
4. **Reusability** - Shared interfaces for session details, requests, errors
5. **Performance** - Optimistic updates, pagination, virtualization support

---

## Table of Contents

1. [Existing MCP Types](#existing-mcp-types-baseline)
2. [New Interface Groups](#new-interface-groups)
3. [Session Details & Requests](#1-session-details--request-tracking)
4. [Error Monitoring](#2-error-monitoring)
5. [Analytics](#3-analytics-dashboard)
6. [Logs Viewer](#4-logs-viewer)
7. [Component State Patterns](#component-state-patterns)
8. [Data Flow Architecture](#data-flow-architecture)
9. [Query Key Factory Extensions](#query-key-factory-extensions)
10. [Integration Examples](#integration-examples)

---

## Existing MCP Types (Baseline)

**Current types in `src/lib/types.ts`**:

```typescript
// Already exists - Server status
export interface McpServerStatus {
  status: "running" | "starting" | "stopped" | "stopping";
  uptime: number | null;
  logs: string[];
}

// Already exists - Server config
export interface McpServerConfig {
  transport: string;
  host: string;
  port: number;
  model?: string;
}

// Already exists - Connected client
export interface McpClient {
  session_id: string;
  client_type: "Claude" | "Cursor" | "Windsurf" | "Cline" | "KiRo" | "Augment" | "Gemini" | "Unknown";
  connected_at: string;
  last_activity: string;
  status: "active" | "idle";
}

// Already exists - Session info aggregate
export interface McpSessionInfo {
  active_sessions: number;
  session_timeout: number;
  server_uptime_seconds?: number;
  clients?: McpClient[];
}

// Already exists (inline type in apiClient.ts) - Usage summary
// **NEEDS EXTRACTION** to types.ts
interface McpUsageSummary {
  period: { start: string; end: string; days: number };
  summary: {
    total_requests: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    total_cost: number;
    unique_sessions: number;
  };
  by_tool: Record<string, { count: number; tokens: number; cost: number }>;
}
```

**Status**: ✅ Working, actively used
**Action**: Extract `McpUsageSummary` from inline type to `types.ts`

---

## New Interface Groups

### Overview

| Group | Purpose | Task | Interfaces |
|-------|---------|------|------------|
| **Session Details** | Tool execution history | Task 3, 4 | `McpSessionDetails`, `McpRequest` |
| **Error Monitoring** | Error/warning tracking | Task 5 | `McpError`, `McpErrorSummary` |
| **Analytics** | Time-series charts | Task 6 | `McpAnalyticsTrend`, `McpToolAnalytics` |
| **Logs Viewer** | Filterable request logs | Task 7 | `McpRequestLog`, `McpRequestFilters`, `McpPagination` |
| **Shared** | Common patterns | All | `McpRequestStatus`, `McpToolUsage` |

---

## 1. Session Details & Request Tracking

### Purpose
Support **Task 3** (Tool execution history) and **Task 4** (Session timeline)

### API Endpoint
`GET /api/mcp/sessions/{session_id}` - Already exists ✅

### TypeScript Interfaces

```typescript
/**
 * Request status enum - shared across all request-related types
 */
export type McpRequestStatus = "success" | "error" | "timeout";

/**
 * Individual MCP request (tool call) with token usage and performance
 *
 * Maps to: archon_mcp_requests table
 * Used by: ToolExecutionHistory, SessionTimeline, LogsViewer
 */
export interface McpRequest {
  request_id: string;
  session_id: string;
  method: string;                      // MCP method (tools/call, resources/read, etc.)
  tool_name: string | null;            // Tool name if method is tools/call
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;                // Auto-calculated in database
  estimated_cost: number;              // USD
  timestamp: string;                   // ISO 8601
  duration_ms: number | null;          // Response time
  status: McpRequestStatus;
  error_message: string | null;
}

/**
 * Request usage summary for a session
 *
 * Calculated aggregate of all requests in a session
 */
export interface McpRequestSummary {
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost: number;                  // USD, 6 decimal places
}

/**
 * Extended session details with full request history
 *
 * API Response: GET /api/mcp/sessions/{session_id}
 * Used by: ToolExecutionHistory, SessionTimeline
 */
export interface McpSessionDetails {
  session: McpSessionMetadata;
  requests: McpRequest[];              // Last 100 requests by default
  summary: McpRequestSummary;
  pagination?: {                       // Future: if backend adds pagination
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

/**
 * Detailed session metadata (extends McpClient)
 *
 * Maps to: archon_mcp_sessions table
 */
export interface McpSessionMetadata {
  session_id: string;
  client_type: string;
  client_version: string | null;
  client_capabilities: Record<string, any> | null;  // JSONB from database
  connected_at: string;                // ISO 8601
  disconnected_at: string | null;      // NULL if still connected
  last_activity: string;               // ISO 8601
  status: "active" | "idle" | "disconnected";
  metadata: Record<string, any>;       // JSONB - user-agent, platform, etc.
}
```

### Component State Shape

**For `ToolExecutionHistory.tsx`**:

```typescript
interface ToolExecutionHistoryProps {
  sessionId: string;
}

interface ToolExecutionHistoryState {
  // Data from useSessionDetails() hook
  session: McpSessionMetadata | null;
  requests: McpRequest[];
  summary: McpRequestSummary | null;

  // UI state
  isLoading: boolean;
  error: Error | null;

  // Filters
  filters: {
    toolName: string | null;           // Filter by tool
    status: McpRequestStatus | null;   // Filter by success/error
  };

  // Selection
  selectedRequest: McpRequest | null;  // For detail modal
}
```

**For `SessionTimeline.tsx`**:

```typescript
interface SessionTimelineProps {
  sessionId: string;
  height?: number;                     // Timeline height (default: 400px)
}

interface SessionTimelineState {
  // Data from useSessionDetails() hook
  requests: McpRequest[];

  // Timeline state
  timeRange: {
    start: Date;
    end: Date;
  };
  zoomLevel: number;                   // 1.0 = fit all, >1 = zoomed in
  selectedTimestamp: string | null;    // Highlighted event
}
```

---

## 2. Error Monitoring

### Purpose
Support **Task 5** (Real-time error/warning monitoring)

### API Endpoint
⚠️ **NEW ENDPOINT NEEDED**: `GET /api/mcp/errors`

**Alternative**: Filter existing `/api/mcp/sessions/{id}` with `status=error|timeout`

### TypeScript Interfaces

```typescript
/**
 * Error severity levels (future enhancement)
 *
 * Current: Derive from status (error = high, timeout = medium)
 * Future: Add severity column to archon_mcp_requests
 */
export type McpErrorSeverity = "error" | "warning" | "timeout";

/**
 * Individual error/warning entry
 *
 * Subset of McpRequest focused on failures
 * Used by: ErrorWarningMonitor component
 */
export interface McpError {
  request_id: string;
  session_id: string;
  tool_name: string | null;
  error_message: string;
  timestamp: string;                   // ISO 8601
  severity: McpErrorSeverity;          // Derived from status
  duration_ms: number | null;

  // Context for debugging
  method: string;
  session_client_type?: string;        // Optional: join with session data
}

/**
 * Error summary statistics
 *
 * API Response: GET /api/mcp/errors
 * Used by: Error monitoring badge, error count display
 */
export interface McpErrorSummary {
  error_count: number;
  timeout_count: number;
  last_error_at: string | null;        // ISO 8601
  error_rate_percent: number;          // Calculated: errors / total_requests * 100
}

/**
 * Error monitoring response
 *
 * API Response: GET /api/mcp/errors?severity=error&limit=50
 */
export interface McpErrorResponse {
  errors: McpError[];
  summary: McpErrorSummary;
  total: number;                       // Total errors in time period
}
```

### Component State Shape

**For `ErrorWarningMonitor.tsx`**:

```typescript
interface ErrorWarningMonitorProps {
  sessionId?: string;                  // Optional: filter by session
  autoRefresh?: boolean;               // Enable real-time polling (default: true)
}

interface ErrorWarningMonitorState {
  // Data from useMcpErrors() hook
  errors: McpError[];
  summary: McpErrorSummary | null;

  // UI state
  isLoading: boolean;
  error: Error | null;

  // Filters
  filters: {
    severity: McpErrorSeverity | "all"; // Filter by severity
    sessionId: string | null;          // Filter by session
    limit: number;                     // Max errors to show (default: 50)
  };

  // Selection
  selectedError: McpError | null;      // For error detail modal
}
```

---

## 3. Analytics Dashboard

### Purpose
Support **Task 6** (Analytics dashboard with charts)

### API Endpoints
- **Existing**: `GET /api/mcp/usage/summary` - Total aggregates ✅
- **NEW** (optional): `GET /api/mcp/analytics/trends` - Time-series data

### TypeScript Interfaces

```typescript
/**
 * Tool usage statistics (existing, from usage summary)
 *
 * Used by: Tool comparison chart, top tools widget
 */
export interface McpToolUsage {
  count: number;
  tokens: number;
  cost: number;                        // USD
}

/**
 * Single data point for time-series charts
 *
 * API Response: GET /api/mcp/analytics/trends (if implemented)
 * Used by: LineChart, AreaChart for trends
 */
export interface McpAnalyticsDataPoint {
  timestamp: string;                   // ISO 8601 (day/hour)
  value: number;                       // Metric value (tokens, cost, requests, errors)
  label?: string;                      // Human-readable label ("Jan 9", "10:00 AM")
}

/**
 * Time-series trend data for a metric
 *
 * Used by: Trends charts (tokens over time, cost over time, etc.)
 */
export interface McpAnalyticsTrend {
  metric: "tokens" | "cost" | "requests" | "errors";
  interval: "hour" | "day" | "week";
  data_points: McpAnalyticsDataPoint[];
  summary: {
    total: number;
    average: number;
    min: number;
    max: number;
    change_percent: number;            // % change vs. previous period
  };
}

/**
 * Tool-specific analytics for comparison
 *
 * Used by: Tool comparison charts, tool efficiency analysis
 */
export interface McpToolAnalytics {
  tool_name: string;
  usage: McpToolUsage;
  avg_duration_ms: number;
  success_rate_percent: number;        // success / (success + error) * 100
  error_count: number;
  trend: "up" | "down" | "stable";     // Compared to previous period
}

/**
 * Complete analytics dashboard data
 *
 * Combines multiple data sources for dashboard view
 * Used by: McpAnalyticsSection component
 */
export interface McpAnalyticsDashboard {
  period: {
    start: string;
    end: string;
    days: number;
  };

  // Overall metrics
  summary: {
    total_requests: number;
    total_tokens: number;
    total_cost: number;
    unique_sessions: number;
    avg_request_duration_ms: number;
    error_rate_percent: number;
  };

  // Time-series data (if backend endpoint exists, else null)
  trends: {
    tokens?: McpAnalyticsTrend;
    cost?: McpAnalyticsTrend;
    requests?: McpAnalyticsTrend;
    errors?: McpAnalyticsTrend;
  };

  // Tool breakdown
  tools: McpToolAnalytics[];

  // Comparison with previous period
  comparison: {
    requests_change_percent: number;
    cost_change_percent: number;
    error_rate_change: number;         // Absolute change (not percent)
  };
}
```

### Component State Shape

**For `McpAnalyticsSection.tsx`**:

```typescript
interface McpAnalyticsSectionProps {
  days?: number;                       // Time period (default: 30)
}

interface McpAnalyticsSectionState {
  // Data from useMcpAnalytics() hook
  dashboard: McpAnalyticsDashboard | null;

  // UI state
  isLoading: boolean;
  error: Error | null;

  // User selections
  selectedPeriod: 7 | 30 | 90;         // Days
  selectedMetric: "tokens" | "cost" | "requests" | "errors";
  selectedChart: "trend" | "comparison" | "breakdown";

  // Chart interaction
  hoveredDataPoint: McpAnalyticsDataPoint | null;
}
```

---

## 4. Logs Viewer

### Purpose
Support **Task 7** (Logs viewer with filters and export)

### API Endpoint
**Existing**: `GET /api/mcp/sessions/{session_id}` - Returns requests array ✅
**Alternative**: Query `archon_mcp_requests` table with filters

### TypeScript Interfaces

```typescript
/**
 * Request log entry (simplified view of McpRequest)
 *
 * Used by: Logs viewer table, log export
 */
export interface McpRequestLog {
  request_id: string;
  session_id: string;
  timestamp: string;                   // ISO 8601
  client_type: string;
  method: string;
  tool_name: string | null;
  status: McpRequestStatus;
  duration_ms: number | null;
  total_tokens: number;
  estimated_cost: number;
  error_message: string | null;
}

/**
 * Filter options for logs viewer
 *
 * Used by: LogsViewer filters UI
 */
export interface McpRequestFilters {
  // Tool filter
  toolName: string | null;             // Exact match or null = all

  // Status filter
  status: McpRequestStatus | "all";    // success | error | timeout | all

  // Date range
  dateRange: {
    start: string | null;              // ISO 8601
    end: string | null;                // ISO 8601
  };

  // Session filter
  sessionId: string | null;            // Filter by specific session

  // Method filter (optional)
  method: string | null;               // tools/call, resources/read, etc.

  // Search query (optional)
  search: string | null;               // Free-text search in tool_name, error_message
}

/**
 * Pagination metadata
 *
 * Used by: Logs viewer pagination controls
 */
export interface McpPagination {
  total: number;                       // Total items
  page: number;                        // Current page (1-indexed)
  per_page: number;                    // Items per page
  total_pages: number;                 // Calculated: ceil(total / per_page)
  has_prev: boolean;
  has_next: boolean;
}

/**
 * Logs viewer response with pagination
 *
 * API Response: GET /api/mcp/logs?filters...&page=1&per_page=50
 * OR: Frontend pagination of session details
 */
export interface McpLogsResponse {
  logs: McpRequestLog[];
  pagination: McpPagination;
  filters: McpRequestFilters;          // Echo back applied filters
}

/**
 * Export format options
 *
 * Used by: Export functionality
 */
export type McpLogExportFormat = "csv" | "json" | "excel";

/**
 * Sort configuration
 *
 * Used by: DataTable sorting
 */
export interface McpLogSort {
  field: keyof McpRequestLog;
  direction: "asc" | "desc";
}
```

### Component State Shape

**For `ToolExecutionLogsViewer.tsx`**:

```typescript
interface ToolExecutionLogsViewerProps {
  sessionId?: string;                  // Optional: filter by session
}

interface ToolExecutionLogsViewerState {
  // Data from useMcpRequestLogs() hook
  logs: McpRequestLog[];
  pagination: McpPagination | null;

  // UI state
  isLoading: boolean;
  error: Error | null;

  // Filters
  filters: McpRequestFilters;

  // Sorting
  sort: McpLogSort;

  // Selection
  selectedLogs: string[];              // Array of request_ids for multi-select

  // Export state
  isExporting: boolean;
  exportFormat: McpLogExportFormat;
}
```

---

## Component State Patterns

### Shared Patterns Across All Components

**1. TanStack Query State Management**

All components use TanStack Query hooks instead of local state for data fetching:

```typescript
// ❌ DON'T: Local state for server data
const [data, setData] = useState(null);
const [isLoading, setIsLoading] = useState(false);

// ✅ DO: TanStack Query hooks
const { data, isLoading, error, refetch } = useSessionDetails(sessionId);
```

**2. UI State Separation**

Separate server state (TanStack Query) from UI state (React state/Zustand):

```typescript
// Server state (TanStack Query)
const { data: session } = useSessionDetails(sessionId);

// UI state (React useState)
const [filters, setFilters] = useState<Filters>({...});
const [selectedItem, setSelectedItem] = useState<Item | null>(null);
```

**3. Filter State Management**

Use controlled components with filter state:

```typescript
const [filters, setFilters] = useState<McpRequestFilters>({
  toolName: null,
  status: "all",
  dateRange: { start: null, end: null },
  sessionId: null,
  method: null,
  search: null,
});

// Update filters
const updateFilter = (key: keyof McpRequestFilters, value: any) => {
  setFilters((prev) => ({ ...prev, [key]: value }));
};

// Apply filters to data (client-side)
const filteredData = useMemo(() => {
  return data.filter((item) => {
    if (filters.toolName && item.tool_name !== filters.toolName) return false;
    if (filters.status !== "all" && item.status !== filters.status) return false;
    // ... more filters
    return true;
  });
}, [data, filters]);
```

**4. Pagination State**

For large datasets (logs viewer):

```typescript
const [pagination, setPagination] = useState({
  page: 1,
  per_page: 50,
});

// Client-side pagination
const paginatedData = useMemo(() => {
  const start = (pagination.page - 1) * pagination.per_page;
  const end = start + pagination.per_page;
  return filteredData.slice(start, end);
}, [filteredData, pagination]);
```

---

## Data Flow Architecture

### Overview

```
┌─────────────────┐
│  MCP Server     │  Port 8051 (tracking logs to database)
│  (FastAPI)      │
└────────┬────────┘
         │ Logs requests
         ↓
┌─────────────────┐
│  PostgreSQL     │  archon_mcp_sessions, archon_mcp_requests
│  (Supabase)     │
└────────┬────────┘
         │ REST API
         ↓
┌─────────────────┐
│  Backend API    │  Port 8181 (endpoints)
│  (FastAPI)      │
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────┐
│  TanStack Query │  Polling (5-60s intervals)
│  + Query Cache  │
└────────┬────────┘
         │ React hooks
         ↓
┌─────────────────┐
│  React          │  Components (Tool History, Timeline, Analytics, etc.)
│  Components     │
└─────────────────┘
```

### Polling Strategy

**Smart Polling** (visibility-aware):

| Hook | Visible | Hidden | Purpose |
|------|---------|--------|---------|
| `useSessionDetails()` | 10s | 30s | Moderate freshness |
| `useMcpErrors()` | 10s | 60s | Error monitoring |
| `useMcpAnalytics()` | 30s | 60s | Low priority |
| `useMcpRequestLogs()` | 15s | 60s | Log viewer |

### Error Handling

**TanStack Query Error Boundaries**:

```typescript
export function useSessionDetails(sessionId: string) {
  return useQuery({
    queryKey: mcpKeys.sessionDetails(sessionId),
    queryFn: async () => {
      try {
        return await mcpApi.getSessionDetails(sessionId);
      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error("Session not found");
        }
        throw new Error("Failed to fetch session details");
      }
    },
    // Retry 3 times with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
```

### Real-time Updates Strategy

**Phase 1 (MVP)**: Polling with TanStack Query
**Phase 2 (Future)**: Server-Sent Events (SSE)

```typescript
// Future SSE implementation (not in MVP)
export function useMcpErrorsSSE() {
  const [errors, setErrors] = useState<McpError[]>([]);

  useEffect(() => {
    const eventSource = new EventSource("/api/mcp/errors/stream");

    eventSource.addEventListener("error", (event) => {
      const newError = JSON.parse(event.data);
      setErrors((prev) => [newError, ...prev].slice(0, 50));
    });

    return () => eventSource.close();
  }, []);

  return errors;
}
```

---

## Query Key Factory Extensions

### Extend Existing `mcpKeys` in `useMcpQueries.ts`

```typescript
// Existing keys
export const mcpKeys = {
  all: ["mcp"] as const,
  status: () => [...mcpKeys.all, "status"] as const,
  config: () => [...mcpKeys.all, "config"] as const,
  sessions: () => [...mcpKeys.all, "sessions"] as const,
  clients: () => [...mcpKeys.all, "clients"] as const,
  health: () => [...mcpKeys.all, "health"] as const,
  usage: (params?: { days?: number }) => [...mcpKeys.all, "usage", params] as const,

  // NEW: Session details
  sessionDetails: (sessionId: string) =>
    [...mcpKeys.all, "session", sessionId] as const,

  // NEW: Errors
  errors: (filters?: { severity?: string; limit?: number; sessionId?: string }) =>
    [...mcpKeys.all, "errors", filters] as const,

  // NEW: Analytics
  analytics: (params?: { days?: number; metric?: string }) =>
    [...mcpKeys.all, "analytics", params] as const,

  // NEW: Request logs
  requestLogs: (filters?: McpRequestFilters, pagination?: { page: number; per_page: number }) =>
    [...mcpKeys.all, "logs", filters, pagination] as const,
};
```

### Cache Invalidation Strategy

```typescript
// Invalidate session details when new request logged
queryClient.invalidateQueries({ queryKey: mcpKeys.sessionDetails(sessionId) });

// Invalidate errors when status changes
queryClient.invalidateQueries({ queryKey: mcpKeys.errors() });

// Invalidate analytics when new data available
queryClient.invalidateQueries({ queryKey: mcpKeys.analytics() });
```

---

## Integration Examples

### Example 1: Fetching Session Details

**Hook Usage**:

```typescript
// In ToolExecutionHistory.tsx
function ToolExecutionHistory({ sessionId }: { sessionId: string }) {
  const {
    data: sessionDetails,
    isLoading,
    error,
    refetch,
  } = useSessionDetails(sessionId);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!sessionDetails) return <EmptyState type="no_data" />;

  return (
    <div>
      <SessionMetadataCard session={sessionDetails.session} />
      <RequestsTable requests={sessionDetails.requests} />
      <SummaryStats summary={sessionDetails.summary} />
    </div>
  );
}
```

**Hook Implementation**:

```typescript
// In src/hooks/useMcpQueries.ts
export function useSessionDetails(sessionId: string) {
  return useQuery({
    queryKey: mcpKeys.sessionDetails(sessionId),
    queryFn: async () => {
      const data = await mcpApi.getSessionDetails(sessionId);
      return data as McpSessionDetails;
    },
    refetchInterval: (query) => {
      return typeof document !== "undefined" && document.hidden ? 30000 : 10000;
    },
    staleTime: 5000,
    enabled: !!sessionId, // Only fetch if sessionId provided
  });
}
```

### Example 2: Filtering Errors

**Component Usage**:

```typescript
// In ErrorWarningMonitor.tsx
function ErrorWarningMonitor() {
  const [severity, setSeverity] = useState<McpErrorSeverity | "all">("all");

  const { data: errorData } = useMcpErrors({ severity, limit: 50 });

  return (
    <div>
      <ErrorSeverityFilter value={severity} onChange={setSeverity} />

      {errorData && (
        <>
          <ErrorSummaryBadge summary={errorData.summary} />
          <ErrorList errors={errorData.errors} />
        </>
      )}
    </div>
  );
}
```

### Example 3: Analytics with Recharts

**Component Usage**:

```typescript
// In McpAnalyticsSection.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function TokenUsageTrend({ days = 30 }: { days?: number }) {
  const { data: analytics } = useMcpAnalytics({ days });

  if (!analytics?.trends.tokens) return null;

  const chartData = analytics.trends.tokens.data_points.map((point) => ({
    date: new Date(point.timestamp).toLocaleDateString(),
    tokens: point.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="tokens" stroke="#3b82f6" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## Type Export Checklist

### Add to `src/lib/types.ts`

**Session Details & Requests** (Task 3, 4):
- [ ] `McpRequestStatus` (type)
- [ ] `McpRequest` (interface)
- [ ] `McpRequestSummary` (interface)
- [ ] `McpSessionDetails` (interface)
- [ ] `McpSessionMetadata` (interface)

**Error Monitoring** (Task 5):
- [ ] `McpErrorSeverity` (type)
- [ ] `McpError` (interface)
- [ ] `McpErrorSummary` (interface)
- [ ] `McpErrorResponse` (interface)

**Analytics** (Task 6):
- [ ] `McpToolUsage` (interface) - **Extract from apiClient.ts**
- [ ] `McpAnalyticsDataPoint` (interface)
- [ ] `McpAnalyticsTrend` (interface)
- [ ] `McpToolAnalytics` (interface)
- [ ] `McpAnalyticsDashboard` (interface)

**Logs Viewer** (Task 7):
- [ ] `McpRequestLog` (interface)
- [ ] `McpRequestFilters` (interface)
- [ ] `McpPagination` (interface)
- [ ] `McpLogsResponse` (interface)
- [ ] `McpLogExportFormat` (type)
- [ ] `McpLogSort` (interface)

**Shared** (Extract existing):
- [ ] `McpUsageSummary` (interface) - **Extract from apiClient.ts inline type**

---

## Validation & Testing

### Type Safety Checks

**1. Backend Response Alignment**

Ensure TypeScript interfaces match backend JSON responses exactly:

```typescript
// Test: Does McpRequest match database schema?
const mockBackendResponse: McpRequest = {
  request_id: "uuid",
  session_id: "uuid",
  method: "tools/call",
  tool_name: "rag_search_knowledge_base",
  prompt_tokens: 150,
  completion_tokens: 300,
  total_tokens: 450,
  estimated_cost: 0.001350,
  timestamp: "2026-01-09T10:00:00Z",
  duration_ms: 250,
  status: "success",
  error_message: null,
};
```

**2. Component Props Validation**

Ensure all component props are typed:

```typescript
// ✅ DO: Explicit prop types
interface ToolExecutionHistoryProps {
  sessionId: string;
  onRequestSelect?: (request: McpRequest) => void;
}

function ToolExecutionHistory({ sessionId, onRequestSelect }: ToolExecutionHistoryProps) {
  // ...
}

// ❌ DON'T: Implicit any
function ToolExecutionHistory({ sessionId, onRequestSelect }) {
  // ...
}
```

---

## Summary & Next Steps

### Key Design Decisions

1. **Extend existing types** - Build on `McpClient`, `McpSessionInfo`
2. **TanStack Query patterns** - Polling, query keys, cache management
3. **Type safety first** - Mirror backend responses exactly
4. **Component state separation** - Server state (TanStack) vs UI state (React)
5. **Reusable interfaces** - `McpRequest` shared across components

### Implementation Order

**Phase 1**: Types & Hooks (Tasks 2-5)
1. ✅ Task 2 complete - Add types to `types.ts`
2. Task 5 - Backend error endpoint
3. Tasks 3, 4, 7 - Add hooks (`useSessionDetails`, `useMcpErrors`, `useMcpRequestLogs`)

**Phase 2**: Components (Tasks 3-7)
4. Task 3 - `ToolExecutionHistory.tsx`
5. Task 4 - `SessionTimeline.tsx`
6. Task 7 - `ToolExecutionLogsViewer.tsx`
7. Task 6 - `McpAnalyticsSection.tsx` (install recharts first)

**Phase 3**: Testing (Task 8)
8. Unit tests with MSW mocks

### Files to Modify

| File | Changes | Task |
|------|---------|------|
| `src/lib/types.ts` | Add 20+ new interfaces | Task 2 |
| `src/hooks/useMcpQueries.ts` | Add 3 new hooks, extend mcpKeys | Tasks 3-7 |
| `src/lib/apiClient.ts` | Add `getSessionDetails`, `getErrors` methods | Tasks 3, 5 |
| `src/components/MCP/` | Create 5 new components | Tasks 3-7 |
| `src/app/mcp/page.tsx` | Integrate new components | All |

---

**End of Design Document** | **Next Task**: Add real-time error/warning monitoring (Task 5)
