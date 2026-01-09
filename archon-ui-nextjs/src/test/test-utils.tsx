import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a custom render function with providers
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface AllTheProvidersProps {
  children: React.ReactNode;
}

export function AllTheProviders({ children }: AllTheProvidersProps) {
  const testQueryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={testQueryClient}>
      {children}
    </QueryClientProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Mock data factories
export const mockProject = (overrides = {}) => ({
  id: 'project-1',
  title: 'Test Project',
  description: 'Test description',
  github_repo: 'https://github.com/test/repo',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  archived: false,
  ...overrides,
});

export const mockTask = (overrides = {}) => ({
  id: 'task-1',
  project_id: 'project-1',
  title: 'Test Task',
  description: 'Test task description',
  status: 'todo' as const,
  assignee: 'User',
  task_order: 0,
  priority: 'medium' as const,
  feature: 'Test Feature',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  archived: false,
  ...overrides,
});

export const mockKnowledgeSource = (overrides = {}) => ({
  source_id: 'source-1',
  title: 'Test Documentation',
  url: 'https://docs.example.com',
  knowledge_type: 'technical' as const,
  level: 'intermediate' as const,
  summary: 'Test summary',
  tags: ['react', 'testing'],
  documents_count: 10,
  code_examples_count: 5,
  total_chunks: 100,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

// MCP mock data factories
export const mockMcpRequest = (overrides = {}) => ({
  request_id: 'req-1',
  session_id: 'test-session-123',
  method: 'tools/call',
  tool_name: 'search_docs',
  timestamp: '2025-01-01T10:00:00Z',
  duration_ms: 150,
  status: 'success' as const,
  prompt_tokens: 200,
  completion_tokens: 100,
  total_tokens: 300,
  estimated_cost: 0.0003,
  error_message: null,
  ...overrides,
});

export const mockMcpSessionDetails = (overrides = {}) => ({
  session: {
    session_id: 'test-session-123',
    client_type: 'claude-desktop',
    started_at: '2025-01-01T10:00:00Z',
    ended_at: null,
    last_activity_at: '2025-01-01T10:30:00Z',
    status: 'active' as const,
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
  requests: [mockMcpRequest()],
  ...overrides,
});

export const mockMcpAnalytics = (overrides = {}) => ({
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
  ...overrides,
});

export const mockMcpLogEntry = (overrides = {}) => ({
  request_id: 'log-1',
  session_id: 'test-session-123',
  method: 'tools/call',
  tool_name: 'search_docs',
  timestamp: '2025-01-01T10:00:00Z',
  duration_ms: 150,
  status: 'success' as const,
  level: 'info' as const,
  prompt_tokens: 200,
  completion_tokens: 100,
  total_tokens: 300,
  estimated_cost: 0.0003,
  error_message: null,
  ...overrides,
});
