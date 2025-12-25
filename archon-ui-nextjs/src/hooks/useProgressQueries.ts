/**
 * Progress Queries Hook
 * React Query hooks for managing progress tracking with smart polling
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { progressApi } from "@/lib/apiClient";
import { Progress, ProgressStatus } from "@/lib/types";
import { useSmartPolling } from "./useSmartPolling";

// Terminal states - operations that should stop polling
const TERMINAL_STATES: ProgressStatus[] = ["completed", "error", "failed", "cancelled"];

/**
 * Check if a progress operation is in a terminal state
 */
function isTerminalState(status: ProgressStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

/**
 * Hook to fetch and poll all active progress operations
 */
export function useProgressList(options: {
  enabled?: boolean;
  pollingInterval?: number;
} = {}) {
  const { enabled = true, pollingInterval = 1000 } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["progress", "list"],
    queryFn: async () => {
      const response = await progressApi.getAll();
      return response;
    },
    enabled,
    refetchInterval: false, // We'll use smart polling instead
    staleTime: 1000, // Data fresh for 1 second
  });

  // Smart polling that adjusts based on page visibility
  useSmartPolling({
    baseInterval: pollingInterval,
    hiddenInterval: 10000, // Poll less frequently when tab is hidden
    enabled: enabled && !query.isError,
    onPoll: () => {
      queryClient.invalidateQueries({ queryKey: ["progress", "list"] });
    },
  });

  return query;
}

/**
 * Hook to fetch and poll a single progress operation
 */
export function useProgress(
  progressId: string | null,
  options: {
    enabled?: boolean;
    pollingInterval?: number;
  } = {}
) {
  const { enabled = true, pollingInterval = 1000 } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["progress", progressId],
    queryFn: async () => {
      if (!progressId) return null;
      const response = await progressApi.getById(progressId);
      return response.operation;
    },
    enabled: enabled && !!progressId,
    refetchInterval: false, // We'll use smart polling instead
    staleTime: 1000,
    retry: (failureCount, error: any) => {
      // Don't retry on 404 - operation might be completed and cleaned up
      if (error?.status === 404) {
        return failureCount < 3;
      }
      return failureCount < 5;
    },
  });

  const progress = query.data;
  const shouldPoll = progress && !isTerminalState(progress.status);

  // Smart polling for single operation
  useSmartPolling({
    baseInterval: pollingInterval,
    hiddenInterval: 10000,
    enabled: enabled && !!progressId && shouldPoll && !query.isError,
    onPoll: () => {
      queryClient.invalidateQueries({ queryKey: ["progress", progressId] });
    },
  });

  return {
    ...query,
    progress,
    isTerminal: progress ? isTerminalState(progress.status) : false,
  };
}

/**
 * Hook to get active operations count
 */
export function useActiveOperationsCount() {
  const { data } = useProgressList({ pollingInterval: 1000 });
  return data?.active_count || 0;
}

/**
 * Hook to track multiple progress IDs
 */
export function useMultipleProgress(progressIds: string[]) {
  const queries = progressIds.map((id) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useProgress(id, {
      enabled: !!id,
      pollingInterval: 1000,
    });
  });

  const allProgress = queries.map((q) => q.progress).filter((p): p is Progress => p !== null);
  const isAnyLoading = queries.some((q) => q.isLoading);
  const hasErrors = queries.some((q) => q.isError);

  return {
    queries,
    allProgress,
    isAnyLoading,
    hasErrors,
    activeCount: allProgress.filter((p) => !isTerminalState(p.status)).length,
    completedCount: allProgress.filter((p) => p.status === "completed").length,
    errorCount: allProgress.filter((p) => isTerminalState(p.status) && p.status !== "completed")
      .length,
  };
}
