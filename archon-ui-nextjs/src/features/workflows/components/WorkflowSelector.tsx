"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Label, Select, Button, Modal, Alert, Spinner } from "flowbite-react";
import { HiExclamation, HiSwitchHorizontal, HiCheck } from "react-icons/hi";
import { apiClient } from "@/lib/apiClient";
import { toast } from "react-hot-toast";

interface WorkflowSelectorProps {
  projectId: string;
  currentWorkflowId: string;
  currentWorkflowName?: string;
  onWorkflowChange?: (workflowId: string) => void;
  disabled?: boolean;
  className?: string;
}

interface Workflow {
  id: string;
  name: string;
  project_type_id: string | null;
  description?: string;
}

/**
 * WorkflowSelector - Component for changing a project's workflow
 *
 * Features:
 * - Dropdown to select new workflow
 * - Confirmation modal before switching
 * - Automatic task reassignment to new workflow stages
 * - Loading and error states
 * - Success notifications
 * - Disabled state support
 *
 * Usage:
 * ```tsx
 * <WorkflowSelector
 *   projectId={projectId}
 *   currentWorkflowId={currentWorkflowId}
 *   currentWorkflowName="Kanban"
 *   onWorkflowChange={(workflowId) => console.log('Changed to:', workflowId)}
 * />
 * ```
 */
export function WorkflowSelector({
  projectId,
  currentWorkflowId,
  currentWorkflowName = "Current Workflow",
  onWorkflowChange,
  disabled = false,
  className = "",
}: WorkflowSelectorProps) {
  const queryClient = useQueryClient();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch available workflows
  const {
    data: workflowsData,
    isLoading: isLoadingWorkflows,
    error: workflowsError,
  } = useQuery<{ workflows: Workflow[]; count: number }>({
    queryKey: ["workflows"],
    queryFn: async () => {
      const response = await apiClient.get("/api/workflows");
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Change workflow mutation
  const changeWorkflowMutation = useMutation({
    mutationFn: async (newWorkflowId: string) => {
      const response = await apiClient.put(
        `/api/projects/${projectId}/workflow`,
        {
          workflow_id: newWorkflowId,
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({
        queryKey: ["project-health", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["task-metrics", projectId],
      });

      const tasksReassigned = data.tasks_reassigned || 0;
      toast.success(
        `Workflow changed successfully! ${tasksReassigned} task${
          tasksReassigned !== 1 ? "s" : ""
        } reassigned.`
      );

      if (onWorkflowChange) {
        onWorkflowChange(selectedWorkflowId);
      }

      setShowConfirmModal(false);
      setSelectedWorkflowId("");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.detail || "Failed to change workflow"
      );
      setShowConfirmModal(false);
    },
  });

  const handleWorkflowChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newWorkflowId = e.target.value;

    if (newWorkflowId === currentWorkflowId || !newWorkflowId) {
      return;
    }

    setSelectedWorkflowId(newWorkflowId);
    setShowConfirmModal(true);
  };

  const handleConfirmChange = () => {
    if (selectedWorkflowId) {
      changeWorkflowMutation.mutate(selectedWorkflowId);
    }
  };

  const handleCancelChange = () => {
    setShowConfirmModal(false);
    setSelectedWorkflowId("");
  };

  const selectedWorkflow = workflowsData?.workflows.find(
    (w) => w.id === selectedWorkflowId
  );

  if (isLoadingWorkflows) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Spinner size="sm" />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Loading workflows...
        </span>
      </div>
    );
  }

  if (workflowsError) {
    return (
      <Alert color="failure" className={className}>
        <span className="text-sm">Failed to load workflows</span>
      </Alert>
    );
  }

  const workflows = workflowsData?.workflows || [];

  return (
    <>
      <div className={className}>
        <div className="mb-2 block">
          <Label htmlFor="workflow-select" value="Project Workflow" />
        </div>
        <div className="flex items-center gap-3">
          <Select
            id="workflow-select"
            value={currentWorkflowId}
            onChange={handleWorkflowChange}
            disabled={disabled || changeWorkflowMutation.isPending}
            className="flex-1"
          >
            <option value="" disabled>
              Select workflow...
            </option>
            {workflows.map((workflow) => (
              <option
                key={workflow.id}
                value={workflow.id}
                disabled={workflow.id === currentWorkflowId}
              >
                {workflow.name}
                {workflow.id === currentWorkflowId ? " (current)" : ""}
              </option>
            ))}
          </Select>
          {changeWorkflowMutation.isPending && (
            <Spinner size="sm" className="ml-2" />
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Current: <span className="font-medium">{currentWorkflowName}</span>
        </p>
      </div>

      {/* Confirmation Modal */}
      <Modal
        show={showConfirmModal}
        onClose={handleCancelChange}
        size="md"
        popup
      >
        <Modal.Header />
        <Modal.Body>
          <div className="text-center">
            <HiExclamation className="mx-auto mb-4 h-14 w-14 text-amber-400 dark:text-amber-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Change Project Workflow?
            </h3>
            <div className="mb-6 space-y-2 text-left rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">From:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {currentWorkflowName}
                </span>
              </div>
              <HiSwitchHorizontal className="mx-auto h-5 w-5 text-gray-400" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">To:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedWorkflow?.name || "Unknown"}
                </span>
              </div>
            </div>
            <Alert color="warning" className="mb-4 text-left">
              <span className="text-sm">
                <strong>Note:</strong> All tasks will be automatically reassigned
                to compatible stages in the new workflow based on their current
                stage order.
              </span>
            </Alert>
            <div className="flex justify-center gap-4">
              <Button
                color="gray"
                onClick={handleCancelChange}
                disabled={changeWorkflowMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                color="blue"
                onClick={handleConfirmChange}
                disabled={changeWorkflowMutation.isPending}
              >
                {changeWorkflowMutation.isPending ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Changing...
                  </>
                ) : (
                  <>
                    <HiCheck className="mr-2 h-4 w-4" />
                    Confirm Change
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
