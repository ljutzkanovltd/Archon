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
