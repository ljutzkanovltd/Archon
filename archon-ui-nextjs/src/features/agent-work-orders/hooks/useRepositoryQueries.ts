/**
 * Repository Query Hooks
 *
 * TanStack Query hooks for repository management.
 * Provides data fetching, mutations, and optimistic updates for repositories.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { repositoryService } from "../services/repositoryService";
import type { ConfiguredRepository, CreateRepositoryRequest, UpdateRepositoryRequest } from "../types/repository";

// Stale time constants
const STALE_TIME_NORMAL = 30000; // 30 seconds

/**
 * Query key factory for repositories
 * Follows the pattern: domain > scope > identifier
 */
export const repositoryKeys = {
  all: ["repositories"] as const,
  lists: () => [...repositoryKeys.all, "list"] as const,
  detail: (id: string) => [...repositoryKeys.all, "detail", id] as const,
};

/**
 * List all configured repositories
 * @returns Query result with array of repositories
 */
export function useRepositories() {
  return useQuery<ConfiguredRepository[]>({
    queryKey: repositoryKeys.lists(),
    queryFn: () => repositoryService.listRepositories(),
    staleTime: STALE_TIME_NORMAL,
    refetchOnWindowFocus: true,
  });
}

/**
 * Get single repository by ID
 * @param id - Repository ID to fetch
 * @returns Query result with repository detail
 */
export function useRepository(id: string | undefined) {
  return useQuery<ConfiguredRepository>({
    queryKey: id ? repositoryKeys.detail(id) : ["disabled"],
    queryFn: async () => {
      if (!id) throw new Error("No repository ID provided");
      return repositoryService.getRepository(id);
    },
    enabled: !!id,
    staleTime: STALE_TIME_NORMAL,
  });
}

/**
 * Create a new configured repository with optimistic updates
 * @returns Mutation result for creating repository
 */
export function useCreateRepository() {
  const queryClient = useQueryClient();

  return useMutation<
    ConfiguredRepository,
    Error,
    CreateRepositoryRequest,
    { previousRepositories?: ConfiguredRepository[] }
  >({
    mutationFn: (request: CreateRepositoryRequest) => repositoryService.createRepository(request),
    onMutate: async (newRepositoryData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: repositoryKeys.lists() });

      // Snapshot the previous value
      const previousRepositories = queryClient.getQueryData<ConfiguredRepository[]>(repositoryKeys.lists());

      // Create optimistic repository
      const optimisticRepository: ConfiguredRepository = {
        id: `temp-${Date.now()}`, // Temporary ID
        repository_url: newRepositoryData.repository_url,
        display_name: null,
        owner: null,
        default_branch: null,
        is_verified: false,
        last_verified_at: null,
        default_sandbox_type: "git_worktree",
        default_commands: ["create-branch", "planning", "execute", "commit", "create-pr"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Optimistically add the new repository
      queryClient.setQueryData<ConfiguredRepository[]>(repositoryKeys.lists(), (old) => {
        if (!old) return [optimisticRepository];
        return [optimisticRepository, ...old];
      });

      return { previousRepositories };
    },
    onError: (error, _variables, context) => {
      console.error("Failed to create repository:", error);

      // Rollback on error
      if (context?.previousRepositories) {
        queryClient.setQueryData(repositoryKeys.lists(), context.previousRepositories);
      }
    },
    onSuccess: (response) => {
      // Replace optimistic entity with real response
      queryClient.setQueryData<ConfiguredRepository[]>(repositoryKeys.lists(), (old) => {
        if (!old) return [response];
        // Remove temp entry and add real one
        const filtered = old.filter((r) => !r.id.startsWith("temp-"));
        return [response, ...filtered];
      });
    },
  });
}

/**
 * Update an existing repository with optimistic updates
 * @returns Mutation result for updating repository
 */
export function useUpdateRepository() {
  const queryClient = useQueryClient();

  return useMutation<
    ConfiguredRepository,
    Error,
    { id: string; request: UpdateRepositoryRequest },
    { previousRepositories?: ConfiguredRepository[] }
  >({
    mutationFn: ({ id, request }) => repositoryService.updateRepository(id, request),
    onMutate: async ({ id, request }) => {
      await queryClient.cancelQueries({ queryKey: repositoryKeys.lists() });

      const previousRepositories = queryClient.getQueryData<ConfiguredRepository[]>(repositoryKeys.lists());

      // Optimistically update the repository
      queryClient.setQueryData<ConfiguredRepository[]>(repositoryKeys.lists(), (old) => {
        if (!old) return old;
        return old.map((repo) =>
          repo.id === id
            ? {
                ...repo,
                ...request,
                updated_at: new Date().toISOString(),
              }
            : repo,
        );
      });

      return { previousRepositories };
    },
    onError: (error, _variables, context) => {
      console.error("Failed to update repository:", error);

      // Rollback on error
      if (context?.previousRepositories) {
        queryClient.setQueryData(repositoryKeys.lists(), context.previousRepositories);
      }
    },
    onSuccess: (response) => {
      // Replace with server response
      queryClient.setQueryData<ConfiguredRepository[]>(repositoryKeys.lists(), (old) => {
        if (!old) return [response];
        return old.map((repo) => (repo.id === response.id ? response : repo));
      });
    },
  });
}

/**
 * Delete a repository with optimistic removal
 * @returns Mutation result for deleting repository
 */
export function useDeleteRepository() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, { previousRepositories?: ConfiguredRepository[] }>({
    mutationFn: (id: string) => repositoryService.deleteRepository(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: repositoryKeys.lists() });

      const previousRepositories = queryClient.getQueryData<ConfiguredRepository[]>(repositoryKeys.lists());

      // Optimistically remove the repository
      queryClient.setQueryData<ConfiguredRepository[]>(repositoryKeys.lists(), (old) => {
        if (!old) return old;
        return old.filter((repo) => repo.id !== id);
      });

      return { previousRepositories };
    },
    onError: (error, _variables, context) => {
      console.error("Failed to delete repository:", error);

      // Rollback on error
      if (context?.previousRepositories) {
        queryClient.setQueryData(repositoryKeys.lists(), context.previousRepositories);
      }
    },
    onSuccess: () => {
      // Success - optimistic update is already applied
    },
  });
}

/**
 * Verify repository access and update metadata
 * @returns Mutation result for verifying repository
 */
export function useVerifyRepository() {
  const queryClient = useQueryClient();

  return useMutation<
    { is_accessible: boolean; repository_id: string },
    Error,
    string,
    { previousRepositories?: ConfiguredRepository[] }
  >({
    mutationFn: (id: string) => repositoryService.verifyRepositoryAccess(id),
    onMutate: async (_id) => {
      await queryClient.cancelQueries({ queryKey: repositoryKeys.lists() });

      const previousRepositories = queryClient.getQueryData<ConfiguredRepository[]>(repositoryKeys.lists());

      return { previousRepositories };
    },
    onError: (error, _variables, context) => {
      console.error("Failed to verify repository:", error);

      // Rollback on error
      if (context?.previousRepositories) {
        queryClient.setQueryData(repositoryKeys.lists(), context.previousRepositories);
      }
    },
    onSuccess: () => {
      // Invalidate queries to refetch updated metadata from server
      queryClient.invalidateQueries({ queryKey: repositoryKeys.lists() });
    },
  });
}
