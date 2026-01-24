"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Modal,
  Label,
  TextInput,
  Textarea,
  Alert,
  Spinner,
} from "flowbite-react";
import {
  HiDuplicate,
  HiInformationCircle,
  HiCheck,
  HiX,
} from "react-icons/hi";
import { apiClient } from "@/lib/apiClient";
import { toast } from "react-hot-toast";

interface WorkflowCloneButtonProps {
  /**
   * Workflow ID to clone
   */
  workflowId: string;

  /**
   * Original workflow name (for display)
   */
  workflowName: string;

  /**
   * Original workflow description (optional)
   */
  workflowDescription?: string;

  /**
   * Callback when clone is successful
   */
  onCloneSuccess?: (newWorkflowId: string) => void;

  /**
   * Button size
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";

  /**
   * Button color
   */
  color?: "blue" | "gray" | "green" | "red" | "yellow" | "purple";

  /**
   * Whether to show button text
   */
  showText?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * WorkflowCloneButton - Button and modal to clone a workflow
 *
 * Features:
 * - Clone button with duplicate icon
 * - Modal with name and description inputs
 * - Name validation (required, unique suggested)
 * - Automatic name suggestion (adds "Copy" prefix)
 * - Success/error notifications
 * - Loading state during clone
 *
 * Note: Requires backend implementation:
 * - API endpoint: POST /api/workflows/{id}/clone
 * - Request body: { name: string, description?: string }
 * - Response: { workflow: WorkflowObject }
 * - Clones workflow + all stages with new UUIDs
 *
 * Usage:
 * ```tsx
 * <WorkflowCloneButton
 *   workflowId={workflow.id}
 *   workflowName={workflow.name}
 *   onCloneSuccess={(newId) => navigate(`/workflows/${newId}`)}
 * />
 * ```
 */
export function WorkflowCloneButton({
  workflowId,
  workflowName,
  workflowDescription = "",
  onCloneSuccess,
  size = "sm",
  color = "gray",
  showText = true,
  className = "",
}: WorkflowCloneButtonProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState(`${workflowName} (Copy)`);
  const [newDescription, setNewDescription] = useState(workflowDescription);
  const [nameError, setNameError] = useState("");

  // Clone workflow mutation
  const cloneWorkflowMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      // TODO: Implement when backend endpoint is available
      // const response = await apiClient.post(
      //   `/api/workflows/${workflowId}/clone`,
      //   data
      // );
      // return response.data;

      // Simulate API call for demo
      await new Promise((resolve) => setTimeout(resolve, 1000));
      throw new Error(
        "Backend endpoint not implemented: POST /api/workflows/{id}/clone"
      );
    },
    onSuccess: (data: any) => {
      toast.success(`Workflow "${newName}" created successfully!`);
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-config"] });

      if (onCloneSuccess && data?.workflow?.id) {
        onCloneSuccess(data.workflow.id);
      }

      handleCloseModal();
    },
    onError: (error: any) => {
      const errorMessage =
        error.response?.data?.detail ||
        error.message ||
        "Failed to clone workflow";
      toast.error(errorMessage);
    },
  });

  const handleOpenModal = () => {
    setNewName(`${workflowName} (Copy)`);
    setNewDescription(workflowDescription);
    setNameError("");
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setNameError("");
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewName(value);

    if (!value.trim()) {
      setNameError("Name is required");
    } else if (value.trim().length < 3) {
      setNameError("Name must be at least 3 characters");
    } else {
      setNameError("");
    }
  };

  const handleClone = () => {
    if (!newName.trim()) {
      setNameError("Name is required");
      return;
    }

    if (newName.trim().length < 3) {
      setNameError("Name must be at least 3 characters");
      return;
    }

    cloneWorkflowMutation.mutate({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
    });
  };

  return (
    <>
      <Button
        color={color}
        size={size}
        onClick={handleOpenModal}
        className={className}
      >
        <HiDuplicate className={showText ? "mr-2 h-4 w-4" : "h-4 w-4"} />
        {showText && "Clone Workflow"}
      </Button>

      <Modal show={showModal} onClose={handleCloseModal} size="md" popup>
        <Modal.Header>
          <div className="flex items-center gap-2 p-2">
            <HiDuplicate className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-semibold">Clone Workflow</span>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {/* Info Alert */}
            <Alert color="info" icon={HiInformationCircle}>
              <span className="text-sm">
                <strong>Backend Required:</strong> This feature requires API
                endpoint POST /api/workflows/&#123;id&#125;/clone to duplicate
                workflow and all stages. UI is ready for integration.
              </span>
            </Alert>

            {/* Original Workflow Info */}
            <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Cloning from:
              </p>
              <p className="mt-1 font-medium text-gray-900 dark:text-white">
                {workflowName}
              </p>
              {workflowDescription && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {workflowDescription}
                </p>
              )}
            </div>

            {/* New Name Input */}
            <div>
              <Label htmlFor="new-workflow-name" className="mb-2 block">
                New Workflow Name <span className="text-red-500">*</span>
              </Label>
              <TextInput
                id="new-workflow-name"
                value={newName}
                onChange={handleNameChange}
                placeholder="Enter workflow name"
                color={nameError ? "failure" : undefined}
                helperText={nameError}
                disabled={cloneWorkflowMutation.isPending}
                autoFocus
              />
            </div>

            {/* New Description Input */}
            <div>
              <Label htmlFor="new-workflow-description" className="mb-2 block">
                Description (optional)
              </Label>
              <Textarea
                id="new-workflow-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Enter workflow description"
                rows={3}
                disabled={cloneWorkflowMutation.isPending}
              />
            </div>

            {/* Clone Details */}
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                What will be cloned:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-blue-600 dark:text-blue-400">
                <li className="flex items-center gap-1">
                  <HiCheck className="h-3 w-3" />
                  All workflow stages (with new UUIDs)
                </li>
                <li className="flex items-center gap-1">
                  <HiCheck className="h-3 w-3" />
                  Stage names, colors, and order
                </li>
                <li className="flex items-center gap-1">
                  <HiCheck className="h-3 w-3" />
                  Stage descriptions
                </li>
                <li className="flex items-center gap-1">
                  <HiX className="h-3 w-3 text-red-500" />
                  Tasks (not copied)
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button
                color="gray"
                onClick={handleCloseModal}
                disabled={cloneWorkflowMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                color="blue"
                onClick={handleClone}
                disabled={
                  cloneWorkflowMutation.isPending ||
                  !newName.trim() ||
                  !!nameError
                }
              >
                {cloneWorkflowMutation.isPending ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Cloning...
                  </>
                ) : (
                  <>
                    <HiDuplicate className="mr-2 h-4 w-4" />
                    Clone (Demo)
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
