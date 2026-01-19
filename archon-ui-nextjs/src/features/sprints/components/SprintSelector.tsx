"use client";

import { useState } from "react";
import { Label, Button } from "flowbite-react";
import { HiPlus } from "react-icons/hi";
import { useSprints } from "../hooks/useSprintQueries";
import { CreateSprintModal } from "./CreateSprintModal";
import { Sprint } from "@/lib/types";

interface SprintSelectorProps {
  projectId: string;
  value?: string;
  onChange: (sprintId: string | undefined) => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  required?: boolean;
}

/**
 * SprintSelector - Dropdown for selecting a sprint for a task
 *
 * Features:
 * - Fetches available sprints for a project
 * - Shows only active and planned sprints (not completed/cancelled)
 * - Displays sprint status and date range
 * - Supports clearing selection (None option)
 * - Inline sprint creation with "+ New Sprint" button
 * - Auto-selects newly created sprint
 * - Loading and error states
 *
 * Usage:
 * ```tsx
 * <SprintSelector
 *   projectId={task.project_id}
 *   value={task.sprint_id}
 *   onChange={(sprintId) => setFormData({ ...formData, sprint_id: sprintId })}
 *   label="Sprint"
 * />
 * ```
 */
export function SprintSelector({
  projectId,
  value,
  onChange,
  disabled = false,
  label = "Sprint",
  helperText,
  required = false,
}: SprintSelectorProps) {
  const { data, isLoading, error } = useSprints(projectId);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filter to only active and planned sprints
  const availableSprints =
    data?.sprints.filter(
      (s) => s.status === "active" || s.status === "planned"
    ) || [];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    onChange(newValue === "" ? undefined : newValue);
  };

  const handleSprintCreated = (newSprintId: string) => {
    // Auto-select the newly created sprint
    onChange(newSprintId);
    setIsCreateModalOpen(false);
  };

  const handleCreateAndAssign = () => {
    // Open modal with intent to auto-assign after creation
    setIsCreateModalOpen(true);
  };

  const formatSprintOption = (sprint: Sprint) => {
    const startDate = new Date(sprint.start_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endDate = new Date(sprint.end_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const statusEmoji = sprint.status === "active" ? "🟢" : "📅";
    const statusText = sprint.status === "active" ? "Active" : "Planned";

    return `${statusEmoji} ${sprint.name} - ${statusText} (${startDate} - ${endDate})`;
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label htmlFor="sprint-selector" value={`${label}${required ? " *" : ""}`} />
        <Button
          size="xs"
          color="light"
          onClick={() => setIsCreateModalOpen(true)}
          disabled={disabled}
          className="mb-1"
          title="Create a new sprint"
        >
          <HiPlus className="mr-1 h-3 w-3" />
          New Sprint
        </Button>
      </div>

      <div className="relative">
        <select
          id="sprint-selector"
          value={value || ""}
          onChange={handleChange}
          disabled={disabled || isLoading}
          className={`
            mt-1 block w-full rounded-lg border
            ${
              error
                ? "border-red-500 bg-red-50 text-red-900 placeholder-red-700 focus:border-red-500 focus:ring-red-500 dark:border-red-400 dark:bg-red-100"
                : "border-gray-300 bg-gray-50 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-brand-500 dark:focus:ring-brand-500"
            }
            ${
              disabled || isLoading
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer"
            }
            p-2.5 text-sm
          `}
        >
          <option value="">
            {isLoading
              ? "Loading sprints..."
              : error
              ? "Error loading sprints"
              : "None (No sprint)"}
          </option>

          {availableSprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {formatSprintOption(sprint)}
            </option>
          ))}
        </select>
      </div>

      {helperText && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-500">
          {error instanceof Error ? error.message : "Failed to load sprints"}
        </p>
      )}

      {!isLoading && !error && availableSprints.length === 0 && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No active or planned sprints available.
          </p>
          <Button
            size="xs"
            color="blue"
            onClick={handleCreateAndAssign}
            className="mt-2"
          >
            <HiPlus className="mr-1 h-3 w-3" />
            Create Sprint & Assign
          </Button>
        </div>
      )}

      {/* Inline Sprint Creation Modal */}
      <CreateSprintModal
        projectId={projectId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSprintCreated={handleSprintCreated}
      />
    </div>
  );
}
