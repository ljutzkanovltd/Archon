import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sprintsApi } from "@/lib/apiClient";
import { Sprint } from "@/lib/types";

/**
 * useSprintQueries - TanStack Query hooks for sprint data fetching
 *
 * Provides hooks for fetching, creating, starting, and completing sprints
 * with automatic cache invalidation.
 */

/**
 * Fetch all sprints for a project
 */
export function useSprints(projectId: string) {
  return useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => sprintsApi.getAll(projectId),
    enabled: !!projectId,
  });
}

/**
 * Fetch active sprint for a project
 */
export function useActiveSprint(projectId: string) {
  return useQuery({
    queryKey: ["sprints", projectId, "active"],
    queryFn: () => sprintsApi.getActive(projectId),
    enabled: !!projectId,
  });
}

/**
 * Fetch a single sprint by ID
 */
export function useSprint(sprintId: string) {
  return useQuery({
    queryKey: ["sprints", sprintId],
    queryFn: () => sprintsApi.getById(sprintId),
    enabled: !!sprintId,
  });
}

/**
 * Fetch sprint velocity
 */
export function useSprintVelocity(sprintId: string) {
  return useQuery({
    queryKey: ["sprints", sprintId, "velocity"],
    queryFn: () => sprintsApi.getVelocity(sprintId),
    enabled: !!sprintId,
  });
}

/**
 * Create a new sprint
 */
export function useCreateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: {
        name: string;
        goal?: string;
        start_date: string;
        end_date: string;
      };
    }) => sprintsApi.create(projectId, data),
    onSuccess: (_, variables) => {
      // Invalidate project sprints cache
      queryClient.invalidateQueries({ queryKey: ["sprints", variables.projectId] });
      queryClient.invalidateQueries({
        queryKey: ["sprints", variables.projectId, "active"],
      });
    },
  });
}

/**
 * Start a sprint (planned -> active)
 */
export function useStartSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) => sprintsApi.start(sprintId),
    onSuccess: (sprint) => {
      // Invalidate related caches
      queryClient.invalidateQueries({ queryKey: ["sprints", sprint.project_id] });
      queryClient.invalidateQueries({
        queryKey: ["sprints", sprint.project_id, "active"],
      });
      queryClient.invalidateQueries({ queryKey: ["sprints", sprint.id] });
    },
  });
}

/**
 * Complete a sprint (active -> completed)
 */
export function useCompleteSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sprintId: string) => sprintsApi.complete(sprintId),
    onSuccess: (sprint) => {
      // Invalidate related caches
      queryClient.invalidateQueries({ queryKey: ["sprints", sprint.project_id] });
      queryClient.invalidateQueries({
        queryKey: ["sprints", sprint.project_id, "active"],
      });
      queryClient.invalidateQueries({ queryKey: ["sprints", sprint.id] });
    },
  });
}
