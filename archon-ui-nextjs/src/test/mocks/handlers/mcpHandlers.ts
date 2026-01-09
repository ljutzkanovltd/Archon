import { http, HttpResponse } from 'msw';
import type {
  McpSessionDetails,
  McpAnalyticsResponse,
  McpLogsResponse,
} from '@/lib/types';

// Use relative URLs to match apiClient behavior in browser (tests run in happy-dom)
const BASE_URL = '';

// Mock session details data
const mockSessionDetails: McpSessionDetails = {
  session: {
    session_id: 'test-session-123',
    client_type: 'claude-desktop',
    started_at: '2025-01-01T10:00:00Z',
    ended_at: null,
    last_activity_at: '2025-01-01T10:30:00Z',
    status: 'active',
  },
  summary: {
    total_requests: 5,
    total_tokens: 1500,
    total_prompt_tokens: 1000,
    total_completion_tokens: 500,
    total_cost: 0.002,
    success_count: 4,
    error_count: 1,
    timeout_count: 0,
  },
  requests: [
    {
      request_id: 'req-1',
      session_id: 'test-session-123',
      method: 'tools/call',
      tool_name: 'search_docs',
      timestamp: '2025-01-01T10:00:00Z',
      duration_ms: 150,
      status: 'success',
      prompt_tokens: 200,
      completion_tokens: 100,
      total_tokens: 300,
      estimated_cost: 0.0003,
      error_message: null,
    },
    {
      request_id: 'req-2',
      session_id: 'test-session-123',
      method: 'tools/call',
      tool_name: 'create_task',
      timestamp: '2025-01-01T10:05:00Z',
      duration_ms: 200,
      status: 'error',
      prompt_tokens: 250,
      completion_tokens: 50,
      total_tokens: 300,
      estimated_cost: 0.0004,
      error_message: 'Task creation failed',
    },
    {
      request_id: 'req-3',
      session_id: 'test-session-123',
      method: 'tools/call',
      tool_name: 'list_tasks',
      timestamp: '2025-01-01T10:10:00Z',
      duration_ms: 100,
      status: 'success',
      prompt_tokens: 150,
      completion_tokens: 100,
      total_tokens: 250,
      estimated_cost: 0.0003,
      error_message: null,
    },
    {
      request_id: 'req-4',
      session_id: 'test-session-123',
      method: 'tools/call',
      tool_name: 'get_task',
      timestamp: '2025-01-01T10:20:00Z',
      duration_ms: 80,
      status: 'success',
      prompt_tokens: 200,
      completion_tokens: 150,
      total_tokens: 350,
      estimated_cost: 0.0005,
      error_message: null,
    },
    {
      request_id: 'req-5',
      session_id: 'test-session-123',
      method: 'tools/call',
      tool_name: 'update_task',
      timestamp: '2025-01-01T10:30:00Z',
      duration_ms: 120,
      status: 'success',
      prompt_tokens: 200,
      completion_tokens: 100,
      total_tokens: 300,
      estimated_cost: 0.0004,
      error_message: null,
    },
  ],
};

// Mock analytics data
const mockAnalytics: McpAnalyticsResponse = {
  period: {
    start_date: '2025-01-01',
    end_date: '2025-01-30',
    days: 30,
  },
  summary: {
    total_requests: 150,
    total_tokens: 45000,
    total_cost: 0.45,
    success_count: 140,
    error_count: 8,
    timeout_count: 2,
    avg_response_time_ms: 125.5,
    peak_requests_per_day: 12,
  },
  trends: {
    daily: [
      { date: '2025-01-29', total_requests: 10, total_tokens: 3000, total_cost: 0.03 },
      { date: '2025-01-30', total_requests: 12, total_tokens: 3600, total_cost: 0.036 },
    ],
    hourly: [
      { hour: 10, total_requests: 5, total_tokens: 1500, total_cost: 0.015 },
      { hour: 11, total_requests: 7, total_tokens: 2100, total_cost: 0.021 },
    ],
  },
  ratios: {
    success_rate: 0.933,
    error_rate: 0.053,
    timeout_rate: 0.013,
  },
  response_times: {
    by_tool: [
      { tool_name: 'search_docs', avg_duration_ms: 100, count: 50 },
      { tool_name: 'create_task', avg_duration_ms: 150, count: 30 },
    ],
  },
  comparison: {
    current: {
      total_requests: 150,
      total_tokens: 45000,
      total_cost: 0.45,
      avg_response_time_ms: 125.5,
    },
    previous: {
      total_requests: 120,
      total_tokens: 36000,
      total_cost: 0.36,
      avg_response_time_ms: 140.0,
    },
    changes: {
      requests_change_pct: 25.0,
      tokens_change_pct: 25.0,
      cost_change_pct: 25.0,
      response_time_change_pct: -10.3,
    },
  },
};

// Mock logs data
const mockLogs: McpLogsResponse = {
  logs: [
    {
      request_id: 'log-1',
      session_id: 'test-session-123',
      method: 'tools/call',
      tool_name: 'search_docs',
      timestamp: '2025-01-01T10:00:00Z',
      duration_ms: 150,
      status: 'success',
      level: 'info',
      prompt_tokens: 200,
      completion_tokens: 100,
      total_tokens: 300,
      estimated_cost: 0.0003,
      error_message: null,
    },
    {
      request_id: 'log-2',
      session_id: 'test-session-123',
      method: 'tools/call',
      tool_name: 'create_task',
      timestamp: '2025-01-01T10:05:00Z',
      duration_ms: 200,
      status: 'error',
      level: 'error',
      prompt_tokens: 250,
      completion_tokens: 50,
      total_tokens: 300,
      estimated_cost: 0.0004,
      error_message: 'Task creation failed',
    },
  ],
  pagination: {
    total: 2,
    limit: 100,
    offset: 0,
    has_more: false,
  },
};

// MSW Handlers
export const mcpHandlers = [
  // Get session details
  http.get('/api/mcp/sessions/:sessionId', () => {
    return HttpResponse.json(mockSessionDetails);
  }),

  // Get analytics
  http.get('/api/mcp/analytics', () => {
    return HttpResponse.json(mockAnalytics);
  }),

  // Get logs
  http.get('/api/mcp/logs', () => {
    return HttpResponse.json(mockLogs);
  }),

  // Error handlers for testing error states
  http.get('/api/mcp/sessions/error-session', () => {
    return HttpResponse.json(
      { detail: 'Session not found' },
      { status: 404 }
    );
  }),

  http.get('/api/mcp/analytics-error', () => {
    return HttpResponse.json(
      { detail: 'Analytics service unavailable' },
      { status: 500 }
    );
  }),
];

// Export mock data for use in tests
export { mockSessionDetails, mockAnalytics, mockLogs };
