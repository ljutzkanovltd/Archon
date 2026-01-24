import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teamsApi } from "@/lib/apiClient";
import { Team, TeamMember } from "@/lib/types";

/**
 * useTeamQueries - TanStack Query hooks for team data fetching
 *
 * Provides hooks for fetching, creating, updating, and deleting teams and members
 * with automatic cache invalidation.
 */

/**
 * Fetch all teams, optionally filtered by project
 */
export function useTeams(projectId?: string) {
  return useQuery({
    queryKey: ["teams", projectId],
    queryFn: () => teamsApi.getAll(projectId),
    enabled: true,  // Always enabled, project filter is optional
  });
}

/**
 * Fetch a single team by ID with members
 */
export function useTeam(teamId: string, includeMembers: boolean = true) {
  return useQuery({
    queryKey: ["teams", teamId, includeMembers ? "with-members" : "basic"],
    queryFn: () => teamsApi.getById(teamId, includeMembers),
    enabled: !!teamId,
  });
}

/**
 * Get teams for a specific user
 */
export function useUserTeams(userId: string, projectId?: string) {
  return useQuery({
    queryKey: ["teams", "user", userId, projectId],
    queryFn: () => teamsApi.getUserTeams(userId, projectId),
    enabled: !!userId,
  });
}

/**
 * Create a new team
 */
export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      project_id?: string;
    }) => teamsApi.create(data),
    onSuccess: (team) => {
      // Invalidate all teams queries
      queryClient.invalidateQueries({ queryKey: ["teams"] });

      // If team is project-specific, invalidate project teams
      if (team.project_id) {
        queryClient.invalidateQueries({ queryKey: ["teams", team.project_id] });
      }
    },
  });
}

/**
 * Update team details
 */
export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      teamId,
      data,
    }: {
      teamId: string;
      data: {
        name?: string;
        description?: string;
      };
    }) => teamsApi.update(teamId, data),
    onSuccess: (team) => {
      // Invalidate specific team and all teams queries
      queryClient.invalidateQueries({ queryKey: ["teams", team.id] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });

      if (team.project_id) {
        queryClient.invalidateQueries({ queryKey: ["teams", team.project_id] });
      }
    },
  });
}

/**
 * Delete a team
 */
export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => teamsApi.delete(teamId),
    onSuccess: () => {
      // Invalidate all teams queries
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

/**
 * Add a member to a team
 */
export function useAddTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      teamId,
      userId,
      role,
    }: {
      teamId: string;
      userId: string;
      role: "member" | "lead" | "observer";
    }) => teamsApi.addMember(teamId, { user_id: userId, role }),
    onSuccess: (result) => {
      const teamId = result.team.id;

      // Invalidate team with members
      queryClient.invalidateQueries({ queryKey: ["teams", teamId] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });

      // Invalidate user's teams
      queryClient.invalidateQueries({ queryKey: ["teams", "user"] });
    },
  });
}

/**
 * Remove a member from a team
 */
export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsApi.removeMember(teamId, userId),
    onSuccess: (_, variables) => {
      // Invalidate team with members
      queryClient.invalidateQueries({ queryKey: ["teams", variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });

      // Invalidate user's teams
      queryClient.invalidateQueries({ queryKey: ["teams", "user", variables.userId] });
    },
  });
}

/**
 * Update a member's role
 */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      teamId,
      userId,
      role,
    }: {
      teamId: string;
      userId: string;
      role: "member" | "lead" | "observer";
    }) => teamsApi.updateMemberRole(teamId, userId, role),
    onSuccess: (_, variables) => {
      // Invalidate team with members
      queryClient.invalidateQueries({ queryKey: ["teams", variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });

      // Invalidate user's teams
      queryClient.invalidateQueries({ queryKey: ["teams", "user", variables.userId] });
    },
  });
}
