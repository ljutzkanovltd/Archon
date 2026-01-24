"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge, Spinner, Alert, Button } from "flowbite-react";
import {
  HiInformationCircle,
  HiColorSwatch,
  HiSortAscending,
  HiPencil,
  HiXCircle,
} from "react-icons/hi";
import { apiClient } from "@/lib/apiClient";

interface WorkflowConfigPanelProps {
  /**
   * Workflow ID to display configuration for
   */
  workflowId: string;

  /**
   * Whether to show workflow name in header
   */
  showWorkflowName?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

interface WorkflowStage {
  id: string;
  name: string;
  color: string;
  stage_order: number;
  workflow_id: string;
  description?: string;
}

interface Workflow {
  id: string;
  name: string;
  project_type_id: string | null;
  description?: string;
  stages: WorkflowStage[];
}

/**
 * WorkflowConfigPanel - Display workflow stage configuration
 *
 * Features:
 * - View stage colors, names, and order
 * - Sorted by stage_order (ascending)
 * - Color-coded stage badges
 * - Stage description display
 * - Loading and error states
 *
 * Note: Editing functionality requires backend endpoints:
 * - PUT /api/workflow-stages/{id} for updating stage properties
 * - PUT /api/workflows/{id}/reorder for changing stage order
 *
 * Usage:
 * ```tsx
 * <WorkflowConfigPanel workflowId={workflowId} showWorkflowName />
 * ```
 */
export function WorkflowConfigPanel({
  workflowId,
  showWorkflowName = true,
  className = "",
}: WorkflowConfigPanelProps) {
  // Fetch workflow with stages
  const {
    data: workflow,
    isLoading,
    error,
  } = useQuery<Workflow>({
    queryKey: ["workflow-config", workflowId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/workflows/${workflowId}`);
      return response.data;
    },
    enabled: !!workflowId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading workflow configuration...
          </span>
        </div>
      </Card>
    );
  }

  if (error || !workflow) {
    return (
      <Card className={className}>
        <Alert color="failure" icon={HiXCircle}>
          <span className="font-medium">Failed to load workflow configuration!</span>{" "}
          {(error as Error)?.message || "Unknown error occurred"}
        </Alert>
      </Card>
    );
  }

  const sortedStages = [...(workflow.stages || [])].sort(
    (a, b) => a.stage_order - b.stage_order
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {showWorkflowName && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {workflow.name}
            </h3>
          )}
          {workflow.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {workflow.description}
            </p>
          )}
        </div>
        <Badge color="info" size="sm">
          {sortedStages.length} stages
        </Badge>
      </div>

      {/* Info Alert */}
      <Alert color="info" icon={HiInformationCircle}>
        <span className="text-sm">
          <strong>View Mode:</strong> Stage editing requires backend API endpoints
          (PUT /api/workflow-stages/&#123;id&#125;). Currently displaying read-only
          configuration.
        </span>
      </Alert>

      {/* Stages Configuration */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
            Stage Configuration
          </h4>
          <Button color="gray" size="xs" disabled>
            <HiPencil className="mr-2 h-3 w-3" />
            Edit (Coming Soon)
          </Button>
        </div>

        <div className="space-y-3">
          {sortedStages.length > 0 ? (
            sortedStages.map((stage, index) => (
              <StageConfigRow
                key={stage.id}
                stage={stage}
                position={index + 1}
                totalStages={sortedStages.length}
              />
            ))
          ) : (
            <div className="py-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No stages configured for this workflow
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Stage Properties Legend */}
      <Card>
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          Stage Properties
        </h4>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-start gap-2">
            <HiColorSwatch className="mt-0.5 h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Color
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Visual identifier for stage
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <HiSortAscending className="mt-0.5 h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Order
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Workflow progression sequence
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <HiInformationCircle className="mt-0.5 h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Description
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Stage purpose and guidelines
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * StageConfigRow - Display a single stage configuration
 */
interface StageConfigRowProps {
  stage: WorkflowStage;
  position: number;
  totalStages: number;
}

function StageConfigRow({
  stage,
  position,
  totalStages,
}: StageConfigRowProps) {
  const [showDescription, setShowDescription] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 items-center gap-4">
          {/* Order Badge */}
          <Badge color="gray" size="sm">
            #{position}
          </Badge>

          {/* Color Indicator */}
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-600"
              style={{ backgroundColor: stage.color }}
              title={stage.color}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {stage.color}
            </span>
          </div>

          {/* Stage Name */}
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white">
              {stage.name}
            </p>
            {stage.description && (
              <button
                onClick={() => setShowDescription(!showDescription)}
                className="mt-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                {showDescription ? "Hide" : "Show"} description
              </button>
            )}
          </div>
        </div>

        {/* Stage Order Display */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Order: {stage.stage_order}
          </span>
          {position === 1 && (
            <Badge color="success" size="xs">
              First
            </Badge>
          )}
          {position === totalStages && (
            <Badge color="info" size="xs">
              Last
            </Badge>
          )}
        </div>
      </div>

      {/* Description (expandable) */}
      {showDescription && stage.description && (
        <div className="mt-3 rounded-md bg-white p-3 dark:bg-gray-900">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {stage.description}
          </p>
        </div>
      )}
    </div>
  );
}
