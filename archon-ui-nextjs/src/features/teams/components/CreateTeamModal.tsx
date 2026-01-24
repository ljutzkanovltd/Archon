"use client";

import { useState } from "react";
import { Button, Label, TextInput, Select } from "flowbite-react";
import CustomModal from "@/components/common/CustomModal";
import { useCreateTeam } from "../hooks/useTeamQueries";
import { toast } from "react-hot-toast";

interface CreateTeamModalProps {
  projectId?: string;  // Optional: If provided, team is project-specific
  isOpen: boolean;
  onClose: () => void;
  onTeamCreated?: (teamId: string) => void;
}

/**
 * CreateTeamModal - Modal for creating a new team
 *
 * Features:
 * - Team name (required)
 * - Team description (optional)
 * - Scope selector (organization-wide or project-specific)
 * - Form validation
 * - Success/error notifications
 * - Optional callback on team creation
 *
 * Usage:
 * ```tsx
 * <CreateTeamModal
 *   projectId={projectId}  // Optional: Pre-select project scope
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   onTeamCreated={(teamId) => console.log('Created team:', teamId)}
 * />
 * ```
 */
export function CreateTeamModal({
  projectId,
  isOpen,
  onClose,
  onTeamCreated,
}: CreateTeamModalProps) {
  const createTeam = useCreateTeam();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scope: projectId ? "project" : "organization",  // Default based on context
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Team name is required";
    }
    if (formData.name.trim().length < 2) {
      newErrors.name = "Team name must be at least 2 characters";
    }
    if (formData.name.trim().length > 200) {
      newErrors.name = "Team name must be less than 200 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const newTeam = await createTeam.mutateAsync({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        project_id: formData.scope === "project" ? projectId : undefined,
      });

      toast.success(
        `Team "${formData.name}" created successfully!`
      );

      // Call the callback with the new team ID
      if (onTeamCreated && newTeam?.id) {
        onTeamCreated(newTeam.id);
      }

      handleClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create team");
    }
  };

  const handleClose = () => {
    // Reset form
    setFormData({
      name: "",
      description: "",
      scope: projectId ? "project" : "organization",
    });
    setErrors({});
    onClose();
  };

  return (
    <CustomModal
      open={isOpen}
      close={handleClose}
      title="Create New Team"
      size="NORMAL"
    >
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh]">
        {/* Form Fields */}
        <div className="space-y-4 p-6 overflow-y-auto flex-1">
          {/* Team Name */}
          <div>
            <div className="mb-2 block">
              <Label htmlFor="team-name">Team Name *</Label>
            </div>
            <TextInput
              id="team-name"
              type="text"
              placeholder="Engineering Team"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              color={errors.name ? "failure" : undefined}
              autoFocus
              required
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                {errors.name}
              </p>
            )}
          </div>

          {/* Team Description */}
          <div>
            <div className="mb-2 block">
              <Label htmlFor="team-description">
                Description (Optional)
              </Label>
            </div>
            <textarea
              id="team-description"
              placeholder="Describe the team's purpose and responsibilities..."
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
            />
          </div>

          {/* Team Scope */}
          {!projectId && (
            <div>
              <div className="mb-2 block">
                <Label htmlFor="team-scope">Team Scope *</Label>
              </div>
              <Select
                id="team-scope"
                value={formData.scope}
                onChange={(e) =>
                  setFormData({ ...formData, scope: e.target.value })
                }
                required
              >
                <option value="organization">
                  Organization-wide (all projects)
                </option>
                <option value="project">
                  Project-specific (limited to one project)
                </option>
              </Select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formData.scope === "organization"
                  ? "Team will be available across all projects"
                  : "Team will be limited to a specific project"}
              </p>
            </div>
          )}

          {projectId && (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                This team will be created for the current project.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer - Sticky at bottom, always visible */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-700 flex items-center justify-end gap-3 border-t border-gray-200 p-6 dark:border-gray-600">
          <Button
            type="button"
            color="gray"
            onClick={handleClose}
            disabled={createTeam.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            color="blue"
            disabled={createTeam.isPending}
          >
            {createTeam.isPending && (
              <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {createTeam.isPending ? "Creating..." : "Create Team"}
          </Button>
        </div>
      </form>
    </CustomModal>
  );
}
