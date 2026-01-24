"use client";

import { useState } from "react";
import { Button, Spinner } from "flowbite-react";
import { HiPlus } from "react-icons/hi";
import { useSprints, useStartSprint, useCompleteSprint } from "../hooks/useSprintQueries";
import { SprintCard } from "../components/SprintCard";
import { CreateSprintModal } from "../components/CreateSprintModal";
import { SprintActionConfirmDialog } from "../components/SprintActionConfirmDialog";
import { Sprint } from "@/lib/types";
import { toast } from "react-hot-toast";
import { SkeletonCard } from "@/components/LoadingStates";

interface SprintListViewProps {
  projectId: string;
}

/**
 * SprintListView - Main view for displaying and managing sprints
 *
 * Features:
 * - List all sprints for a project
 * - Create new sprint button
 * - Start/Complete sprint actions with confirmation
 * - Loading and error states
 * - Empty state
 *
 * Usage:
 * ```tsx
 * <SprintListView projectId={projectId} />
 * ```
 */
export function SprintListView({ projectId }: SprintListViewProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    sprint: Sprint;
    action: "start" | "complete";
  } | null>(null);

  const { data, isLoading, error } = useSprints(projectId);
  const startSprint = useStartSprint();
  const completeSprint = useCompleteSprint();

  const handleStartSprint = (sprintId: string) => {
    const sprint = data?.sprints.find((s) => s.id === sprintId);
    if (sprint) {
      setConfirmAction({ sprint, action: "start" });
    }
  };

  const handleCompleteSprint = (sprintId: string) => {
    const sprint = data?.sprints.find((s) => s.id === sprintId);
    if (sprint) {
      setConfirmAction({ sprint, action: "complete" });
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    try {
      if (confirmAction.action === "start") {
        await startSprint.mutateAsync(confirmAction.sprint.id);
        toast.success("Sprint started successfully!");
      } else {
        await completeSprint.mutateAsync(confirmAction.sprint.id);
        toast.success("Sprint completed successfully!");
      }
      setConfirmAction(null);
    } catch (error: any) {
      toast.error(
        error.message || `Failed to ${confirmAction.action} sprint`
      );
    }
  };

  const handleSprintClick = (sprint: Sprint) => {
    // TODO: Navigate to sprint detail page
    console.log("Sprint clicked:", sprint.id);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard
            key={index}
            showHeader={true}
            bodyLines={3}
            showFooter={true}
          />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
        <p className="font-medium">Error loading sprints</p>
        <p className="mt-1 text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  const sprints = data?.sprints || [];

  // Separate sprints by status
  const activeSprints = sprints.filter((s) => s.status === "active");
  const plannedSprints = sprints.filter((s) => s.status === "planned");
  const completedSprints = sprints.filter((s) => s.status === "completed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sprints
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your agile sprints and track progress
          </p>
        </div>
        <Button color="blue" onClick={() => setIsCreateModalOpen(true)}>
          <HiPlus className="mr-2 h-5 w-5" />
          New Sprint
        </Button>
      </div>

      {/* Empty State */}
      {sprints.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No sprints yet
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Get started by creating your first sprint
          </p>
          <Button
            color="blue"
            className="mt-4"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <HiPlus className="mr-2 h-5 w-5" />
            Create Sprint
          </Button>
        </div>
      )}

      {/* Active Sprints */}
      {activeSprints.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Active Sprints
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeSprints.map((sprint) => (
              <SprintCard
                key={sprint.id}
                sprint={sprint}
                onComplete={handleCompleteSprint}
                onClick={handleSprintClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Planned Sprints */}
      {plannedSprints.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Planned Sprints
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plannedSprints.map((sprint) => (
              <SprintCard
                key={sprint.id}
                sprint={sprint}
                onStart={handleStartSprint}
                onClick={handleSprintClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Sprints */}
      {completedSprints.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Completed Sprints ({completedSprints.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedSprints.map((sprint) => (
              <SprintCard
                key={sprint.id}
                sprint={sprint}
                onClick={handleSprintClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Sprint Modal */}
      <CreateSprintModal
        projectId={projectId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Confirmation Dialog */}
      {confirmAction && (
        <SprintActionConfirmDialog
          isOpen={true}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
          sprint={confirmAction.sprint}
          action={confirmAction.action}
          isLoading={
            confirmAction.action === "start"
              ? startSprint.isPending
              : completeSprint.isPending
          }
        />
      )}
    </div>
  );
}
