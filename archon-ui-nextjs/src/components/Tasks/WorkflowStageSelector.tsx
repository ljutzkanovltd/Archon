"use client";

import { useEffect, useState } from "react";
import { WorkflowStage } from "@/lib/types";
import { workflowsApi } from "@/lib/apiClient";

interface WorkflowStageSelectorProps {
  value: string; // workflow_stage_id
  onChange: (stageId: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * WorkflowStageSelector - Dynamic dropdown for selecting workflow stages
 *
 * Fetches workflow stages from the API and renders them as options.
 * Replaces the hardcoded status dropdown with dynamic workflow stages.
 *
 * Features:
 * - Fetches stages from Standard Agile workflow on mount
 * - Displays stage names in order (Backlog → In Progress → Review → Done)
 * - Shows loading state while fetching
 * - Color-coded options based on stage order
 */
export function WorkflowStageSelector({
  value,
  onChange,
  disabled = false,
  required = false,
  className = "",
}: WorkflowStageSelectorProps) {
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStages = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await workflowsApi.getDefaultWorkflow();

        if (response.stages && response.stages.length > 0) {
          // Sort stages by stage_order
          const sortedStages = response.stages.sort((a, b) => a.stage_order - b.stage_order);
          setStages(sortedStages);

          // If no value is set and we're not disabled, set the first stage (Backlog) as default
          if (!value && sortedStages.length > 0 && !disabled) {
            onChange(sortedStages[0].id);
          }
        } else {
          setError("Failed to load workflow stages");
        }
      } catch (err) {
        console.error("[WorkflowStageSelector] Error fetching stages:", err);
        setError("Failed to load workflow stages");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStages();
  }, []); // Only fetch once on mount

  if (isLoading) {
    return (
      <div className={`${className} flex items-center`}>
        <select
          disabled
          className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option>Loading stages...</option>
        </select>
      </div>
    );
  }

  if (error || stages.length === 0) {
    return (
      <div className={`${className}`}>
        <select
          disabled
          className="block w-full rounded-lg border border-red-300 bg-red-50 p-2.5 text-sm text-red-900 dark:border-red-600 dark:bg-red-900/20 dark:text-red-400"
        >
          <option>{error || "No stages available"}</option>
        </select>
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          Please configure workflow stages in settings.
        </p>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      className={`block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${className}`}
    >
      {stages.map((stage) => (
        <option key={stage.id} value={stage.id}>
          {stage.name}
          {stage.description ? ` - ${stage.description}` : ""}
        </option>
      ))}
    </select>
  );
}
