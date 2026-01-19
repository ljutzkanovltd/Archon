"use client";

import { Modal, Button } from "flowbite-react";
import { HiExclamationCircle } from "react-icons/hi";
import { Sprint } from "@/lib/types";

interface SprintActionConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sprint: Sprint;
  action: "start" | "complete";
  isLoading?: boolean;
}

/**
 * SprintActionConfirmDialog - Confirmation dialog for sprint lifecycle actions
 *
 * Provides user confirmation before:
 * - Starting a sprint (planned → active)
 * - Completing a sprint (active → completed)
 *
 * Features:
 * - Action-specific messaging
 * - Sprint details display
 * - Loading state during mutation
 * - Cancel option
 *
 * Usage:
 * ```tsx
 * <SprintActionConfirmDialog
 *   isOpen={isConfirmOpen}
 *   onClose={() => setIsConfirmOpen(false)}
 *   onConfirm={handleConfirm}
 *   sprint={sprint}
 *   action="start"
 *   isLoading={mutation.isPending}
 * />
 * ```
 */
export function SprintActionConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  sprint,
  action,
  isLoading = false,
}: SprintActionConfirmDialogProps) {
  const config = {
    start: {
      title: "Start Sprint",
      message: "Are you sure you want to start this sprint?",
      details:
        "This will activate the sprint and allow tasks to be tracked against it. Only one sprint can be active at a time.",
      confirmLabel: "Start Sprint",
      confirmColor: "blue" as const,
    },
    complete: {
      title: "Complete Sprint",
      message: "Are you sure you want to complete this sprint?",
      details:
        "This will mark the sprint as completed and calculate final velocity. Incomplete tasks will need to be moved to another sprint.",
      confirmLabel: "Complete Sprint",
      confirmColor: "success" as const,
    },
  };

  const actionConfig = config[action];

  return (
    <Modal show={isOpen} onClose={onClose} size="md">
      <div className="p-6">
        {/* Icon and Title */}
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <HiExclamationCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {actionConfig.title}
          </h3>
        </div>

        {/* Sprint Details */}
        <div className="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <p className="font-medium text-gray-900 dark:text-white">
            {sprint.name}
          </p>
          {sprint.goal && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {sprint.goal}
            </p>
          )}
        </div>

        {/* Confirmation Message */}
        <p className="mb-2 text-gray-900 dark:text-white">
          {actionConfig.message}
        </p>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          {actionConfig.details}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            color={actionConfig.confirmColor}
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? "Processing..." : actionConfig.confirmLabel}
          </Button>
          <Button color="gray" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
