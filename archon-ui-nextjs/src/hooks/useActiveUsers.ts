/**
 * Hook for fetching active users data
 *
 * Returns unique assignees who have had task activity in the last 24 hours
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/apiClient';

interface ActiveUser {
  name: string;
  last_activity: string;
}

interface ActiveUsersResponse {
  count: number;
  users: ActiveUser[];
}

export const useActiveUsers = () => {
  return useQuery<ActiveUsersResponse>({
    queryKey: ['activeUsers'],
    queryFn: async () => {
      const response = await apiClient.get<ActiveUsersResponse>('/api/v1/active-users');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};
