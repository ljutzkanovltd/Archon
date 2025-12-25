import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '@/lib/apiClient';

export interface TaskCounts {
  total: number;
  todo: number;
  doing: number;
  review: number;
  done: number;
}

/**
 * Hook to fetch task counts by status
 *
 * Fetches tasks and counts them by status (todo/doing/review/done).
 * Can be scoped to a specific project or show global counts.
 * Auto-refreshes every 30 seconds to keep counts up-to-date.
 *
 * @param projectId - Optional project ID to filter tasks by project
 * @returns Task counts object with loading/error states
 */
export const useTaskCounts = (projectId?: string) => {
  return useQuery<TaskCounts>({
    queryKey: projectId ? ['taskCounts', 'project', projectId] : ['taskCounts', 'global'],
    queryFn: async () => {
      try {
        // Fetch tasks (optionally filtered by project)
        const response = await tasksApi.getAll({
          per_page: 1000, // Get all tasks (assuming < 1000 total)
          include_closed: true, // Include done tasks
          project_id: projectId, // Filter by project if provided
        });

        const tasks = response.items || [];

        // Count tasks by status
        const counts: TaskCounts = {
          total: tasks.length,
          todo: tasks.filter(t => t.status === 'todo').length,
          doing: tasks.filter(t => t.status === 'doing').length,
          review: tasks.filter(t => t.status === 'review').length,
          done: tasks.filter(t => t.status === 'done').length,
        };

        return counts;
      } catch (error) {
        console.error('Failed to fetch task counts:', error);
        // Return zero counts on error
        return {
          total: 0,
          todo: 0,
          doing: 0,
          review: 0,
          done: 0,
        };
      }
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    retry: 2, // Retry failed requests twice
    refetchOnWindowFocus: true, // Refresh when user returns to window
  });
};
