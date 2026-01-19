import React from 'react';
import { Card, Badge } from 'flowbite-react';
import { HiChevronRight } from 'react-icons/hi';
import { useWorkflow, useWorkflowStages } from '../hooks/useWorkflowQueries';
import { WorkflowStage } from '@/lib/types';

/**
 * WorkflowVisualization Component
 * Phase 2.12: Visual workflow stage progression
 *
 * Displays workflow stages in a linear flow with visual indicators.
 * Shows current stage, stage order, and allows navigation to stage tasks.
 *
 * Features:
 * - Linear stage progression display
 * - Color-coded stage indicators
 * - Current stage highlighting
 * - Stage order visualization
 * - Optional click handlers for stage navigation
 * - Loading and error states
 * - Responsive design
 *
 * Usage:
 * ```tsx
 * <WorkflowVisualization
 *   workflowId={project.workflow_id}
 *   currentStageId={task.workflow_stage_id}
 *   onStageClick={(stage) => console.log('Navigate to stage:', stage)}
 * />
 * ```
 */

export interface WorkflowVisualizationProps {
  /**
   * The workflow ID to visualize
   */
  workflowId: string;

  /**
   * Currently active workflow stage ID (highlights the stage)
   */
  currentStageId?: string;

  /**
   * Callback when a stage is clicked
   */
  onStageClick?: (stage: WorkflowStage) => void;

  /**
   * Show workflow name and description header
   * @default true
   */
  showHeader?: boolean;

  /**
   * Compact mode (smaller stages, no descriptions)
   * @default false
   */
  compact?: boolean;
}

export function WorkflowVisualization({
  workflowId,
  currentStageId,
  onStageClick,
  showHeader = true,
  compact = false,
}: WorkflowVisualizationProps) {
  const {
    data: workflow,
    isLoading: workflowLoading,
    error: workflowError,
  } = useWorkflow(workflowId);

  const {
    data: stagesData,
    isLoading: stagesLoading,
    error: stagesError,
  } = useWorkflowStages(workflowId);

  // Loading state
  if (workflowLoading || stagesLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600 dark:border-gray-700 dark:border-t-brand-400"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading workflow...
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Error state
  if (workflowError || stagesError) {
    const error = workflowError || stagesError;
    return (
      <Card>
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-400">
            <strong>Error loading workflow:</strong>{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </Card>
    );
  }

  const stages = stagesData?.stages || [];

  // Empty state
  if (stages.length === 0) {
    return (
      <Card>
        <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-400">
            <strong>No workflow stages defined.</strong> Please configure
            workflow stages first.
          </p>
        </div>
      </Card>
    );
  }

  // Sort stages by stage_order
  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);

  return (
    <Card>
      {/* Workflow Header */}
      {showHeader && workflow && (
        <div className="mb-4 border-b border-gray-200 pb-4 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {workflow.name}
          </h3>
          {workflow.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {workflow.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{sortedStages.length} stages</span>
            {workflow.is_default && (
              <Badge color="info" size="xs">
                Default Workflow
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Stage Flow Visualization */}
      <div className="space-y-2">
        {/* Desktop: Horizontal flow */}
        <div className="hidden lg:flex lg:items-center lg:gap-2">
          {sortedStages.map((stage, index) => {
            const isCurrent = stage.id === currentStageId;
            const isClickable = !!onStageClick;

            return (
              <React.Fragment key={stage.id}>
                {/* Stage Card */}
                <button
                  onClick={() => onStageClick?.(stage)}
                  disabled={!isClickable}
                  className={`
                    flex-1 rounded-lg border-2 p-3 text-left transition-all
                    ${
                      isCurrent
                        ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
                    }
                    ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                    ${!compact ? 'min-h-[100px]' : 'min-h-[60px]'}
                  `}
                  style={
                    isCurrent && stage.color
                      ? {
                          borderColor: stage.color,
                          backgroundColor: `${stage.color}15`,
                        }
                      : undefined
                  }
                >
                  {/* Stage Number Badge */}
                  <div className="mb-1 flex items-center justify-between">
                    <Badge
                      color={isCurrent ? 'info' : 'gray'}
                      size="xs"
                      style={
                        isCurrent && stage.color
                          ? {
                              backgroundColor: stage.color,
                              color: '#ffffff',
                            }
                          : undefined
                      }
                    >
                      Stage {index + 1}
                    </Badge>
                    {stage.default_agent && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {stage.default_agent}
                      </span>
                    )}
                  </div>

                  {/* Stage Name */}
                  <p
                    className={`
                      text-sm font-semibold
                      ${
                        isCurrent
                          ? 'text-brand-900 dark:text-brand-100'
                          : 'text-gray-900 dark:text-white'
                      }
                    `}
                  >
                    {stage.name}
                  </p>

                  {/* Stage Description (non-compact) */}
                  {!compact && stage.description && (
                    <p className="mt-1 text-xs text-gray-600 line-clamp-2 dark:text-gray-400">
                      {stage.description}
                    </p>
                  )}
                </button>

                {/* Arrow Separator */}
                {index < sortedStages.length - 1 && (
                  <HiChevronRight className="h-6 w-6 flex-shrink-0 text-gray-400 dark:text-gray-600" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile: Vertical flow */}
        <div className="space-y-2 lg:hidden">
          {sortedStages.map((stage, index) => {
            const isCurrent = stage.id === currentStageId;
            const isClickable = !!onStageClick;

            return (
              <button
                key={stage.id}
                onClick={() => onStageClick?.(stage)}
                disabled={!isClickable}
                className={`
                  w-full rounded-lg border-2 p-3 text-left transition-all
                  ${
                    isCurrent
                      ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
                      : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
                  }
                  ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                `}
                style={
                  isCurrent && stage.color
                    ? {
                        borderColor: stage.color,
                        backgroundColor: `${stage.color}15`,
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Stage Number Badge */}
                    <Badge
                      color={isCurrent ? 'info' : 'gray'}
                      size="xs"
                      className="mb-2"
                      style={
                        isCurrent && stage.color
                          ? {
                              backgroundColor: stage.color,
                              color: '#ffffff',
                            }
                          : undefined
                      }
                    >
                      Stage {index + 1} of {sortedStages.length}
                    </Badge>

                    {/* Stage Name */}
                    <p
                      className={`
                        text-sm font-semibold
                        ${
                          isCurrent
                            ? 'text-brand-900 dark:text-brand-100'
                            : 'text-gray-900 dark:text-white'
                        }
                      `}
                    >
                      {stage.name}
                    </p>

                    {/* Stage Description */}
                    {!compact && stage.description && (
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {stage.description}
                      </p>
                    )}

                    {/* Default Agent */}
                    {stage.default_agent && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Agent: {stage.default_agent}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/**
 * WorkflowVisualizationSkeleton - Loading placeholder
 */
export function WorkflowVisualizationSkeleton() {
  return (
    <Card>
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="mb-4 space-y-2 border-b border-gray-200 pb-4 dark:border-gray-700">
          <div className="h-6 w-48 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Stages skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex-1 space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
            >
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-full rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
