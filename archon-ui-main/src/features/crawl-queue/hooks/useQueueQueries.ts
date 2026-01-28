/**
 * Crawl Queue React Query Hooks
 * TanStack Query hooks for crawl queue data fetching with real-time polling
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/features/shared/hooks/useToast';
import { queueService } from '../services/queueService';
import type { QueueItemsResponse, QueueStatusResponse } from '../types';

/**
 * Query keys for cache management
 */
export const queueKeys = {
  all: ['queue'] as const,
  stats: () => [...queueKeys.all, 'stats'] as const,
  items: () => [...queueKeys.all, 'items'] as const,
  itemsFiltered: (filters: Record<string, any>) => [...queueKeys.items(), filters] as const,
};

/**
 * Hook to fetch queue statistics with real-time polling
 */
export function useQueueStats(options?: { refetchInterval?: number }) {
  return useQuery<QueueStatusResponse>({
    queryKey: queueKeys.stats(),
    queryFn: () => queueService.getStats(),
    refetchInterval: options?.refetchInterval ?? 5000, // Poll every 5 seconds by default
    staleTime: 4000, // Consider data stale after 4 seconds
  });
}

/**
 * Hook to fetch queue items with optional filtering and real-time polling
 */
export function useQueueItems(
  filters?: {
    status?: string;
    requires_review?: boolean;
    limit?: number;
  },
  options?: { refetchInterval?: number }
) {
  return useQuery<QueueItemsResponse>({
    queryKey: queueKeys.itemsFiltered(filters || {}),
    queryFn: () => queueService.listItems(filters),
    refetchInterval: options?.refetchInterval ?? 5000, // Poll every 5 seconds by default
    staleTime: 4000,
  });
}

/**
 * Hook to retry a failed queue item
 */
export function useRetryQueueItem() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (itemId: string) => queueService.retryItem(itemId),
    onSuccess: (data) => {
      // Invalidate all queue queries to refetch latest data
      queryClient.invalidateQueries({ queryKey: queueKeys.all });
      showToast(data.message || 'Queue item retried successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(`Failed to retry: ${error.message}`, 'error');
    },
  });
}

/**
 * Hook to stop/cancel a queue item
 */
export function useStopQueueItem() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (itemId: string) => queueService.stopItem(itemId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.all });
      showToast(data.message || 'Queue item stopped successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(`Failed to stop: ${error.message}`, 'error');
    },
  });
}

/**
 * Hook to delete a queue item
 */
export function useDeleteQueueItem() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (itemId: string) => queueService.deleteItem(itemId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.all });
      showToast(data.message || 'Queue item deleted successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(`Failed to delete: ${error.message}`, 'error');
    },
  });
}
