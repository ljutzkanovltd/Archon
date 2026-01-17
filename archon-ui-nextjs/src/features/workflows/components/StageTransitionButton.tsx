"use client";

import React, { useState } from 'react';
import { Button, Modal } from 'flowbite-react';
import { HiOutlineArrowRight } from 'react-icons/hi';
import { useTransitionTaskStage, useWorkflowStages } from '../hooks/useWorkflowQueries';
import { toast } from 'react-hot-toast';

/**
 * StageTransitionButton Component
 * Phase 2.3: Quick stage transition for tasks
 *
 * Allows users to transition tasks to the next workflow stage
 * with a single button click. Shows confirmation dialog for
 * important transitions.
 *
 * Features:
 * - Displays next available stage
 * - Shows confirmation modal for transitions
 * - Disabled if no next stage available
 * - Loading state during transition
 * - Success/error notifications
 *
 * Usage:
 * ```tsx
 * <StageTransitionButton
 *   taskId={task.id}
 *   currentStageId={task.workflow_stage_id}
 *   workflowId={project.workflow_id}
 *   onSuccess={refreshTask}
 * />
 * ```
 */

export interface StageTransitionButtonProps {
  /**
   * Task ID to transition
   */
  taskId: string;

  /**
   * Current workflow stage ID of the task
   */
  currentStageId: string;

  /**
   * Workflow ID to fetch stages from
   */
  workflowId: string;

  /**
   * Callback when transition succeeds
   */
  onSuccess?: () => void;

  /**
   * Button size
   * @default "sm"
   */
  size?: 'xs' | 'sm' | 'md' | 'lg';

  /**
   * Show only icon (no text)
   * @default false
   */
  iconOnly?: boolean;
}

export function StageTransitionButton({
  taskId,
  currentStageId,
  workflowId,
  onSuccess,
  size = 'sm',
  iconOnly = false,
}: StageTransitionButtonProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const { data: stagesData, isLoading: loadingStages } = useWorkflowStages(workflowId);
  const { mutate: transitionTask, isPending: isTransitioning } = useTransitionTaskStage();

  // Find current and next stage
  const stages = stagesData?.stages || [];
  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);
  const currentStageIndex = sortedStages.findIndex((s) => s.id === currentStageId);
  const currentStage = sortedStages[currentStageIndex];
  const nextStage = sortedStages[currentStageIndex + 1];

  // No next stage available
  if (!nextStage || loadingStages) {
    return null;
  }

  const handleTransition = () => {
    transitionTask(
      { taskId, newStageId: nextStage.id },
      {
        onSuccess: () => {
          toast.success(`Task moved to "${nextStage.name}"`);
          setShowConfirmModal(false);
          onSuccess?.();
        },
        onError: (error: any) => {
          toast.error(error.message || 'Failed to transition task');
        },
      }
    );
  };

  const handleButtonClick = () => {
    // Show confirmation for important transitions
    // (e.g., moving to final stages like "Done")
    if (nextStage.name.toLowerCase().includes('done') ||
        nextStage.name.toLowerCase().includes('complete')) {
      setShowConfirmModal(true);
    } else {
      handleTransition();
    }
  };

  return (
    <>
      <Button
        size={size}
        color="blue"
        onClick={handleButtonClick}
        disabled={isTransitioning}
        className="flex items-center gap-1"
      >
        {!iconOnly && (
          <span>Move to {nextStage.name}</span>
        )}
        <HiOutlineArrowRight className="h-4 w-4" />
      </Button>

      {/* Confirmation Modal */}
      <Modal
        show={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        size="md"
      >
        <Modal.Header>Confirm Stage Transition</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to move this task to <strong>{nextStage.name}</strong>?
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex-1">
                <div className="font-medium">Current Stage</div>
                <div className="text-gray-500">{currentStage?.name}</div>
              </div>
              <HiOutlineArrowRight className="h-5 w-5 text-gray-400" />
              <div className="flex-1">
                <div className="font-medium">Next Stage</div>
                <div className="text-blue-600 dark:text-blue-400">{nextStage.name}</div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            onClick={handleTransition}
            disabled={isTransitioning}
            color="blue"
          >
            {isTransitioning ? 'Moving...' : 'Confirm'}
          </Button>
          <Button
            color="gray"
            onClick={() => setShowConfirmModal(false)}
            disabled={isTransitioning}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
