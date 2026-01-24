"use client";

import { useState } from "react";
import { Button, Spinner } from "flowbite-react";
import { HiPlus } from "react-icons/hi";
import { useTeams } from "../hooks/useTeamQueries";
import { Team } from "@/lib/types";
import { CreateTeamModal } from "../components/CreateTeamModal";

interface TeamListViewProps {
  projectId?: string;  // Optional: Filter teams by project
}

/**
 * TeamListView - Main view for displaying and managing teams
 *
 * Features:
 * - List all teams (organization-wide or project-specific)
 * - Filter teams by project
 * - Create new team button
 * - Team cards with member counts and roles
 * - Loading and error states
 * - Empty state
 *
 * Usage:
 * ```tsx
 * <TeamListView /> // All organization teams
 * <TeamListView projectId={projectId} /> // Project teams only
 * ```
 */
export function TeamListView({ projectId }: TeamListViewProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data, isLoading, error } = useTeams(projectId);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="xl" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
        <p className="font-medium">Error loading teams</p>
        <p className="mt-1 text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  const teams = data?.teams || [];

  // Separate teams by scope
  const organizationTeams = teams.filter((t) => !t.project_id);
  const projectTeams = teams.filter((t) => t.project_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Teams
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {projectId
              ? "Manage teams for this project"
              : "Manage organization and project teams"}
          </p>
        </div>
        <Button color="blue" onClick={() => setIsCreateModalOpen(true)}>
          <HiPlus className="mr-2 h-5 w-5" />
          New Team
        </Button>
      </div>

      {/* Empty State */}
      {teams.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No teams yet
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Get started by creating your first team
          </p>
          <Button
            color="blue"
            className="mt-4"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <HiPlus className="mr-2 h-5 w-5" />
            Create Team
          </Button>
        </div>
      )}

      {/* Project Teams (if filtered by project or if any exist) */}
      {projectTeams.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            {projectId ? "Teams" : "Project Teams"}
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projectTeams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </div>
      )}

      {/* Organization Teams (only show if not filtered by project) */}
      {!projectId && organizationTeams.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Organization Teams
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizationTeams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      <CreateTeamModal
        projectId={projectId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTeamCreated={(teamId) => {
          // Optionally handle team creation callback
          console.log("Team created:", teamId);
        }}
      />
    </div>
  );
}

/**
 * TeamCard - Display team summary with member count
 * Temporary inline component - will be extracted to components/ in Phase 4.5
 */
function TeamCard({ team }: { team: Team }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
            {team.name}
          </h4>
          {team.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {team.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {team.member_count || 0}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {team.member_count === 1 ? "member" : "members"}
          </span>
        </div>

        <div className="flex gap-2">
          <Button size="sm" color="gray" outline>
            View
          </Button>
          <Button size="sm" color="blue" outline>
            Manage
          </Button>
        </div>
      </div>

      {!team.project_id && (
        <div className="mt-3 inline-block rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          Organization-wide
        </div>
      )}
    </div>
  );
}
