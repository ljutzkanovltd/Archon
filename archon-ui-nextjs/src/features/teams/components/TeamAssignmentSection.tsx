"use client";

import { useState } from "react";
import { Button, Select, Label, Badge } from "flowbite-react";
import { HiPlus, HiUsers } from "react-icons/hi";
import { useTeams } from "../hooks/useTeamQueries";
import { CreateTeamModal } from "./CreateTeamModal";
import type { Team } from "@/lib/types";

interface TeamAssignmentSectionProps {
  projectId: string;
  projectTitle: string;
}

/**
 * TeamAssignmentSection - Manage team assignments for a project
 *
 * Features:
 * - Display teams associated with this project (project-specific)
 * - Display organization-wide teams available for this project
 * - Create new project-specific teams
 * - Quick team navigation and management
 *
 * Usage:
 * ```tsx
 * <TeamAssignmentSection projectId={projectId} projectTitle="My Project" />
 * ```
 */
export function TeamAssignmentSection({
  projectId,
  projectTitle,
}: TeamAssignmentSectionProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch all teams (org-wide + project-specific)
  const { data, isLoading, error } = useTeams();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
        <p className="font-semibold">Error loading teams</p>
        <p className="text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  const teams = data?.teams || [];

  // Separate teams by scope
  const projectTeams = teams.filter((t) => t.project_id === projectId);
  const organizationTeams = teams.filter((t) => !t.project_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Team Assignment
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage teams associated with this project
          </p>
        </div>

        <Button
          color="blue"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <HiPlus className="mr-2 h-4 w-4" />
          New Team
        </Button>
      </div>

      {/* Project-Specific Teams */}
      {projectTeams.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Project Teams
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            {projectTeams.map((team) => (
              <TeamCard key={team.id} team={team} variant="project" />
            ))}
          </div>
        </div>
      )}

      {/* Organization-Wide Teams */}
      {organizationTeams.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Organization Teams
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            {organizationTeams.map((team) => (
              <TeamCard key={team.id} team={team} variant="organization" />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {projectTeams.length === 0 && organizationTeams.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <HiUsers className="mx-auto h-16 w-16 text-gray-400" />
          <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No teams yet
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create a project-specific team or use organization-wide teams
          </p>
          <Button
            color="blue"
            className="mt-4"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <HiPlus className="mr-2 h-4 w-4" />
            Create Team
          </Button>
        </div>
      )}

      {/* Create Team Modal */}
      <CreateTeamModal
        projectId={projectId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTeamCreated={(teamId) => {
          console.log("Team created:", teamId);
          setIsCreateModalOpen(false);
        }}
      />
    </div>
  );
}

/**
 * TeamCard - Compact team card for assignment section
 */
interface TeamCardProps {
  team: Team;
  variant: "project" | "organization";
}

function TeamCard({ team, variant }: TeamCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h5 className="font-medium text-gray-900 dark:text-white truncate">
            {team.name}
          </h5>
          {variant === "organization" && (
            <Badge color="gray" size="xs">
              Organization
            </Badge>
          )}
        </div>
        {team.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {team.description}
          </p>
        )}
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <HiUsers className="h-3 w-3" />
          <span>{team.member_count || 0} members</span>
        </div>
      </div>

      <Button size="xs" color="gray" outline>
        Manage
      </Button>
    </div>
  );
}
