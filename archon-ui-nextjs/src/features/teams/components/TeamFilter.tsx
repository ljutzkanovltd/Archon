"use client";

import { Select, Label } from "flowbite-react";
import { HiUsers, HiX } from "react-icons/hi";
import { useTeams, useTeam } from "../hooks/useTeamQueries";

interface TeamFilterProps {
  projectId?: string;
  selectedTeamId: string | null;
  onTeamChange: (teamId: string | null) => void;
  className?: string;
}

/**
 * TeamFilter - Dropdown to filter by team
 *
 * Features:
 * - Show all teams (organization + project-specific)
 * - "All Teams" option to clear filter
 * - Displays member count for each team
 * - Compact design for toolbar integration
 *
 * Usage:
 * ```tsx
 * const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
 * <TeamFilter
 *   projectId={projectId}
 *   selectedTeamId={selectedTeam}
 *   onTeamChange={setSelectedTeam}
 * />
 * ```
 */
export function TeamFilter({
  projectId,
  selectedTeamId,
  onTeamChange,
  className = "",
}: TeamFilterProps) {
  // Fetch all teams
  const { data: teamsData, isLoading } = useTeams(projectId);

  // Fetch selected team details (to get members)
  const { data: selectedTeamData } = useTeam(
    selectedTeamId || "",
    true
  );

  const teams = teamsData?.teams || [];

  // Get member user IDs from selected team
  const teamMemberUserIds = selectedTeamData?.members.map(m => m.user_id) || [];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Label htmlFor="team-filter" className="flex items-center gap-1 text-sm whitespace-nowrap">
        <HiUsers className="h-4 w-4" />
        <span className="hidden sm:inline">Team:</span>
      </Label>

      <div className="relative flex items-center">
        <Select
          id="team-filter"
          sizing="sm"
          value={selectedTeamId || ""}
          onChange={(e) => onTeamChange(e.target.value || null)}
          disabled={isLoading}
          className="min-w-[150px]"
        >
          <option value="">All Teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name} ({team.member_count || 0})
            </option>
          ))}
        </Select>

        {selectedTeamId && (
          <button
            onClick={() => onTeamChange(null)}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Clear filter"
          >
            <HiX className="h-3 w-3" />
          </button>
        )}
      </div>

      {selectedTeamId && selectedTeamData && (
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {teamMemberUserIds.length} member{teamMemberUserIds.length !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

/**
 * Hook to filter tasks by team members
 *
 * Usage:
 * ```tsx
 * const filteredTasks = useTeamFilteredTasks(tasks, selectedTeamId);
 * ```
 */
export function useTeamMemberUserIds(teamId: string | null): string[] {
  const { data: teamData } = useTeam(teamId || "", true);

  if (!teamId || !teamData) {
    return [];
  }

  return teamData.members.map(m => m.user_id);
}
