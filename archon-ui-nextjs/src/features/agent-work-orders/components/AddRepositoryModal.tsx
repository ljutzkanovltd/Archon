"use client";

/**
 * Add Repository Modal Component
 *
 * Modal for adding new configured repositories with GitHub verification.
 * Two-column layout: Left (2/3) for form fields, Right (1/3) for workflow steps.
 * Adapted to archon-ui-nextjs patterns using Flowbite components.
 */

import { useState } from "react";
import { Button, Label, TextInput, Checkbox } from "flowbite-react";
import { HiRefresh } from "react-icons/hi";
import CustomModal from "@/components/common/CustomModal";
import { useCreateRepository } from "../hooks/useRepositoryQueries";
import type { WorkflowStep } from "../types";

export interface AddRepositoryModalProps {
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

/**
 * Default selected steps for new repositories
 */
const DEFAULT_STEPS: WorkflowStep[] = ["create-branch", "planning", "execute"];

export function AddRepositoryModal({ open, onOpenChange }: AddRepositoryModalProps) {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [selectedSteps, setSelectedSteps] = useState<WorkflowStep[]>(DEFAULT_STEPS);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createRepository = useCreateRepository();

  /**
   * Reset form state
   */
  const resetForm = () => {
    setRepositoryUrl("");
    setSelectedSteps(DEFAULT_STEPS);
    setError("");
  };

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
    setError("");

    // Validation
    if (!repositoryUrl.trim()) {
      setError("Repository URL is required");
      return;
    }
    if (!repositoryUrl.includes("github.com")) {
      setError("Must be a GitHub repository URL");
      return;
    }
    if (selectedSteps.length === 0) {
      setError("At least one workflow step must be selected");
      return;
    }

    try {
      setIsSubmitting(true);
      await createRepository.mutateAsync({
        repository_url: repositoryUrl,
        verify: true,
      });

      // Success - close modal and reset form
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create repository");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CustomModal open={open} close={() => onOpenChange(false)} title="Add Repository" size="MEDIUM">
      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Left Column (2/3 width) - Form Fields */}
            <div className="col-span-2 space-y-4">
              {/* Repository URL */}
              <div className="space-y-2">
                <Label htmlFor="repository-url">Repository URL *</Label>
                <TextInput
                  id="repository-url"
                  type="url"
                  placeholder="https://github.com/owner/repository"
                  value={repositoryUrl}
                  onChange={(e) => setRepositoryUrl(e.target.value)}
                  color={error && !repositoryUrl.trim() ? "failure" : undefined}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  GitHub repository URL. We'll verify access and extract metadata automatically.
                </p>
              </div>

              {/* Info about auto-filled fields */}
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 dark:border-blue-400/20 dark:bg-blue-400/10">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Auto-filled from GitHub:</strong>
                </p>
                <ul className="ml-4 mt-1 list-disc space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                  <li>Display Name (can be customized later via Edit)</li>
                  <li>Owner/Organization</li>
                  <li>Default Branch</li>
                </ul>
              </div>
            </div>

            {/* Right Column (1/3 width) - Workflow Steps */}
            <div className="space-y-4">
              <Label>Default Workflow Steps</Label>
              <div className="space-y-2">
                {WORKFLOW_STEPS.map((step) => {
                  const isSelected = selectedSteps.includes(step.value);
                  const isDisabled = isStepDisabled(step);

                  return (
                    <div key={step.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`step-${step.value}`}
                        checked={isSelected}
                        onChange={() => !isDisabled && toggleStep(step.value)}
                        disabled={isDisabled}
                      />
                      <Label
                        htmlFor={`step-${step.value}`}
                        className={isDisabled ? "text-gray-400 dark:text-gray-500" : ""}
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
                  Adding...
                </>
              ) : (
                "Add Repository"
              )}
            </Button>
          </div>
        </form>
      </div>
    </CustomModal>
  );
}
