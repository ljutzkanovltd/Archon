"use client";

import { Label } from "flowbite-react";
import { useSprints } from "../hooks/useSprintQueries";
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

  // Filter to only active and planned sprints
  const availableSprints =
    data?.sprints.filter(
      (s) => s.status === "active" || s.status === "planned"
    ) || [];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    onChange(newValue === "" ? undefined : newValue);
  };

  return (
    <div>
      <Label htmlFor="sprint-selector" value={`${label}${required ? " *" : ""}`} />
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
            {sprint.name}
            {" - "}
            {sprint.status === "active" ? "🟢 Active" : "📅 Planned"}
            {" ("}
            {new Date(sprint.start_date).toLocaleDateString()} -{" "}
            {new Date(sprint.end_date).toLocaleDateString()}
            {")"}
          </option>
        ))}
      </select>

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
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          No active or planned sprints available. Create a sprint first.
        </p>
      )}
    </div>
  );
}
