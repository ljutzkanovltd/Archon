"use client";

/**
 * Edit Repository Modal Component
 *
 * Modal for editing configured repository settings.
 * Two-column layout: Left (2/3) for repository info, Right (1/3) for workflow steps.
 * Adapted to archon-ui-nextjs patterns using Flowbite components.
 */

import { useEffect, useState } from "react";
import { Button, Label, Checkbox, Tooltip } from "flowbite-react";
import { HiRefresh } from "react-icons/hi";
import CustomModal from "@/components/common/CustomModal";
import { useUpdateRepository } from "../hooks/useRepositoryQueries";
import { useAgentWorkOrdersStore } from "../state/agentWorkOrdersStore";
import type { WorkflowStep } from "../types";

export interface EditRepositoryModalProps {
  /** Whether modal is open */
  open: boolean;

  /** Callback to change open state */
  onOpenChange: (open: boolean) => void;
}

/**
 * All available workflow steps
 */
const WORKFLOW_STEPS: { value: WorkflowStep; label: string; description: string; dependsOn?: WorkflowStep[] }[] = [
  { value: "create-branch", label: "Create Branch", description: "Create a new git branch for isolated work" },
  { value: "planning", label: "Planning", description: "Generate implementation plan" },
  { value: "execute", label: "Execute", description: "Implement the planned changes" },
  { value: "prp-review", label: "Review/Fix", description: "Review implementation and fix issues", dependsOn: ["execute"] },
  { value: "commit", label: "Commit", description: "Commit changes to git", dependsOn: ["execute"] },
  { value: "create-pr", label: "Create PR", description: "Create pull request", dependsOn: ["commit"] },
];

export function EditRepositoryModal({ open, onOpenChange }: EditRepositoryModalProps) {
  // Read editing repository from Zustand store
  const repository = useAgentWorkOrdersStore((s) => s.editingRepository);

  const [selectedSteps, setSelectedSteps] = useState<WorkflowStep[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateRepository = useUpdateRepository();

  /**
   * Pre-populate form when repository changes
   */
  useEffect(() => {
    if (repository) {
      setSelectedSteps(repository.default_commands);
      setError("");
    }
  }, [repository]);

  /**
   * Toggle workflow step selection
   * When unchecking a step, also uncheck steps that depend on it (cascade removal)
   */
  const toggleStep = (step: WorkflowStep) => {
    setSelectedSteps((prev) => {
      if (prev.includes(step)) {
        // Removing a step - also remove steps that depend on it
        const stepsToRemove = new Set([step]);

        // Find all steps that transitively depend on the one being removed (cascade)
        let changed = true;
        while (changed) {
          changed = false;
          WORKFLOW_STEPS.forEach((s) => {
            if (!stepsToRemove.has(s.value) && s.dependsOn?.some((dep) => stepsToRemove.has(dep))) {
              stepsToRemove.add(s.value);
              changed = true;
            }
          });
        }

        return prev.filter((s) => !stepsToRemove.has(s));
      }
      return [...prev, step];
    });
  };

  /**
   * Check if a step is disabled based on dependencies
   */
  const isStepDisabled = (step: (typeof WORKFLOW_STEPS)[number]): boolean => {
    if (!step.dependsOn) return false;
    return step.dependsOn.some((dep) => !selectedSteps.includes(dep));
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repository) return;

    setError("");

    // Validation
    if (selectedSteps.length === 0) {
      setError("At least one workflow step must be selected");
      return;
    }

    try {
      setIsSubmitting(true);

      // Sort selected steps by WORKFLOW_STEPS order before sending to backend
      const sortedSteps = WORKFLOW_STEPS.filter((step) => selectedSteps.includes(step.value)).map(
        (step) => step.value,
      );

      await updateRepository.mutateAsync({
        id: repository.id,
        request: {
          default_sandbox_type: repository.default_sandbox_type,
          default_commands: sortedSteps,
        },
      });

      // Success - close modal
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update repository");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!repository) return null;

  return (
    <CustomModal open={open} close={() => onOpenChange(false)} title="Edit Repository" size="MEDIUM">
      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Left Column (2/3 width) - Repository Info */}
            <div className="col-span-2 space-y-4">
              {/* Repository Info Card */}
              <div className="space-y-3 rounded-lg border border-gray-500/20 bg-gray-500/10 p-4 dark:border-gray-400/20 dark:bg-gray-400/10">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Repository Information</h4>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">URL: </span>
                    <span className="font-mono text-xs text-gray-900 dark:text-white">{repository.repository_url}</span>
                  </div>

                  {repository.display_name && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Name: </span>
                      <span className="text-gray-900 dark:text-white">{repository.display_name}</span>
                    </div>
                  )}

                  {repository.owner && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Owner: </span>
                      <span className="text-gray-900 dark:text-white">{repository.owner}</span>
                    </div>
                  )}

                  {repository.default_branch && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Branch: </span>
                      <span className="font-mono text-xs text-gray-900 dark:text-white">
                        {repository.default_branch}
                      </span>
                    </div>
                  )}
                </div>

                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Repository metadata is auto-filled from GitHub and cannot be edited directly.
                </p>
              </div>
            </div>

            {/* Right Column (1/3 width) - Workflow Steps */}
            <div className="space-y-4">
              <Label>Default Workflow Steps</Label>
              <div className="space-y-2">
                {WORKFLOW_STEPS.map((step) => {
                  const isSelected = selectedSteps.includes(step.value);
                  const isDisabledForEnable = isStepDisabled(step);

                  const tooltipContent =
                    isDisabledForEnable && step.dependsOn
                      ? `Requires: ${step.dependsOn.map((dep) => WORKFLOW_STEPS.find((s) => s.value === dep)?.label ?? dep).join(", ")}`
                      : undefined;

                  const checkbox = (
                    <Checkbox
                      id={`edit-step-${step.value}`}
                      checked={isSelected}
                      onChange={() => {
                        if (!isDisabledForEnable) {
                          toggleStep(step.value);
                        }
                      }}
                      disabled={isDisabledForEnable}
                    />
                  );

                  return (
                    <div key={step.value} className="flex items-center gap-2">
                      {tooltipContent ? <Tooltip content={tooltipContent}>{checkbox}</Tooltip> : checkbox}
                      <Label
                        htmlFor={`edit-step-${step.value}`}
                        className={
                          isDisabledForEnable
                            ? "cursor-not-allowed text-gray-400 dark:text-gray-500"
                            : "cursor-pointer"
                        }
                      >
                        {step.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Commit and PR require Execute</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
            <Button color="gray" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} color="info">
              {isSubmitting ? (
                <>
                  <HiRefresh className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Updating...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </div>
    </CustomModal>
  );
}
