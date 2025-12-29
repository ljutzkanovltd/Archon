import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTaskCounts } from '../useTaskCounts';
import { tasksApi } from '@/lib/apiClient';

// Mock the tasksApi
jest.mock('@/lib/apiClient', () => ({
  tasksApi: {
    getAll: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';

  return Wrapper;
};

describe('useTaskCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch and count tasks by status', async () => {
    const mockTasks = [
      { id: '1', status: 'todo', title: 'Task 1' },
      { id: '2', status: 'todo', title: 'Task 2' },
      { id: '3', status: 'doing', title: 'Task 3' },
      { id: '4', status: 'review', title: 'Task 4' },
      { id: '5', status: 'done', title: 'Task 5' },
      { id: '6', status: 'done', title: 'Task 6' },
    ];

    (tasksApi.getAll as jest.Mock).mockResolvedValue({
      items: mockTasks,
      total: 6,
    });

    const { result } = renderHook(() => useTaskCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      total: 6,
      todo: 2,
      doing: 1,
      review: 1,
      done: 2,
    });
  });

  it('should handle empty task list', async () => {
    (tasksApi.getAll as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
    });

    const { result } = renderHook(() => useTaskCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      total: 0,
      todo: 0,
      doing: 0,
      review: 0,
      done: 0,
    });
  });

  it('should handle API errors gracefully', async () => {
    (tasksApi.getAll as jest.Mock).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useTaskCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Should still return zero counts on error (based on catch block)
    expect(result.current.data).toBeUndefined();
  });

  it('should call API with correct parameters', async () => {
    (tasksApi.getAll as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
    });

    renderHook(() => useTaskCounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(tasksApi.getAll).toHaveBeenCalled());

    expect(tasksApi.getAll).toHaveBeenCalledWith({
      per_page: 1000,
      include_closed: true,
    });
  });
});
