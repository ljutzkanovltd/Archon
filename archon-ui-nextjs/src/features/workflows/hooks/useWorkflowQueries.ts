import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workflowsApi } from "@/lib/apiClient";

/**
 * useWorkflowQueries - TanStack Query hooks for workflow data fetching
 *
 * Provides hooks for fetching workflows, workflow stages, and managing
 * workflow assignments with automatic cache invalidation.
 */

/**
 * Fetch all workflows
 */
export function useWorkflows() {
  return useQuery({
    queryKey: ["workflows"],
    queryFn: () => workflowsApi.getAll(),
  });
}

/**
 * Fetch a single workflow by ID
 */
export function useWorkflow(workflowId: string) {
  return useQuery({
    queryKey: ["workflows", workflowId],
    queryFn: () => workflowsApi.getById(workflowId),
    enabled: !!workflowId,
  });
}

/**
 * Fetch workflow stages for a specific workflow
 */
export function useWorkflowStages(workflowId: string) {
  return useQuery({
    queryKey: ["workflows", workflowId, "stages"],
    queryFn: () => workflowsApi.getStages(workflowId),
    enabled: !!workflowId,
  });
}

/**
 * Fetch all project types
 */
export function useProjectTypes() {
  return useQuery({
    queryKey: ["projectTypes"],
    queryFn: () => workflowsApi.getProjectTypes(),
  });
}

/**
 * Update project workflow assignment
 */
export function useUpdateProjectWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      workflowId,
    }: {
      projectId: string;
      workflowId: string;
    }) => workflowsApi.updateProjectWorkflow(projectId, workflowId),
    onSuccess: (_, variables) => {
      // Invalidate project cache
      queryClient.invalidateQueries({ queryKey: ["projects", variables.projectId] });
      // Invalidate tasks cache (they may need new workflow stages)
      queryClient.invalidateQueries({ queryKey: ["tasks", variables.projectId] });
    },
  });
}

/**
 * Update workflow stage agent assignment
 */
export function useUpdateStageAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stageId,
      agentName,
    }: {
      stageId: string;
      agentName: string | null;
    }) => workflowsApi.updateStageAgent(stageId, agentName),
    onSuccess: (updatedStage: { workflow_id: string }) => {
      // Invalidate workflow stages cache
      queryClient.invalidateQueries({
        queryKey: ["workflows", updatedStage.workflow_id, "stages"],
      });
    },
  });
}

/**
 * Transition task to a different workflow stage
 */
export function useTransitionTaskStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      newStageId,
    }: {
      taskId: string;
      newStageId: string;
    }) => workflowsApi.transitionTask(taskId, newStageId),
    onSuccess: (updatedTask: { id: string; project_id: string }) => {
      // Invalidate task cache
      queryClient.invalidateQueries({ queryKey: ["tasks", updatedTask.id] });
      // Invalidate project tasks cache
      queryClient.invalidateQueries({ queryKey: ["tasks", updatedTask.project_id] });
    },
  });
}
