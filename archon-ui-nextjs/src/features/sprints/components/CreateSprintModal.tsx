"use client";

import { useState } from "react";
import { Button, Label, TextInput } from "flowbite-react";
import CustomModal from "@/components/common/CustomModal";
import { useCreateSprint } from "../hooks/useSprintQueries";
import { toast } from "react-hot-toast";
import { format, addDays } from "date-fns";

interface CreateSprintModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSprintCreated?: (sprintId: string) => void;
}

/**
 * CreateSprintModal - Modal for creating a new sprint
 *
 * Features:
 * - Sprint name (required)
 * - Sprint goal (optional)
 * - Start date (defaults to today)
 * - End date (defaults to 2 weeks from start)
 * - Form validation
 * - Success/error notifications
 * - Optional callback on sprint creation
 *
 * Usage:
 * ```tsx
 * <CreateSprintModal
 *   projectId={projectId}
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   onSprintCreated={(sprintId) => console.log('Created sprint:', sprintId)}
 * />
 * ```
 */
export function CreateSprintModal({
  projectId,
  isOpen,
  onClose,
  onSprintCreated,
}: CreateSprintModalProps) {
  const createSprint = useCreateSprint();

  // Default dates: today to 2 weeks from now
  const defaultStartDate = format(new Date(), "yyyy-MM-dd");
  const defaultEndDate = format(addDays(new Date(), 14), "yyyy-MM-dd");

  const [formData, setFormData] = useState({
    name: "",
    goal: "",
    start_date: defaultStartDate,
    end_date: defaultEndDate,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Sprint name is required";
    }
    if (!formData.start_date) {
      newErrors.start_date = "Start date is required";
    }
    if (!formData.end_date) {
      newErrors.end_date = "End date is required";
    }
    if (
      formData.start_date &&
      formData.end_date &&
      new Date(formData.end_date) <= new Date(formData.start_date)
    ) {
      newErrors.end_date = "End date must be after start date";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const newSprint = await createSprint.mutateAsync({
        projectId,
        data: {
          name: formData.name.trim(),
          goal: formData.goal.trim() || undefined,
          start_date: formData.start_date,
          end_date: formData.end_date,
        },
      });

      toast.success("Sprint created successfully!");

      // Call the callback with the new sprint ID
      if (onSprintCreated && newSprint?.id) {
        onSprintCreated(newSprint.id);
      }

      handleClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create sprint");
    }
  };

  const handleClose = () => {
    // Reset form
    setFormData({
      name: "",
      goal: "",
      start_date: defaultStartDate,
      end_date: defaultEndDate,
    });
    setErrors({});
    onClose();
  };

  return (
    <CustomModal
      open={isOpen}
      close={handleClose}
      title="Create New Sprint"
      size="NORMAL"
    >
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh]">
        {/* Form Fields */}
        <div className="space-y-4 p-6 overflow-y-auto flex-1">
          {/* Sprint Name */}
          <div>
            <div className="mb-2 block">
              <Label htmlFor="sprint-name">Sprint Name *</Label>
            </div>
            <TextInput
              id="sprint-name"
              type="text"
              placeholder="Sprint 1"
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

          {/* Sprint Goal */}
          <div>
            <div className="mb-2 block">
              <Label htmlFor="sprint-goal">Sprint Goal (Optional)</Label>
            </div>
            <textarea
              id="sprint-goal"
              placeholder="What do you want to achieve in this sprint?"
              rows={3}
              value={formData.goal}
              onChange={(e) =>
                setFormData({ ...formData, goal: e.target.value })
              }
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
            />
          </div>

          {/* Start Date */}
          <div>
            <div className="mb-2 block">
              <Label htmlFor="start-date">Start Date *</Label>
            </div>
            <TextInput
              id="start-date"
              type="date"
              value={formData.start_date}
              onChange={(e) =>
                setFormData({ ...formData, start_date: e.target.value })
              }
              color={errors.start_date ? "failure" : undefined}
              required
            />
            {errors.start_date && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                {errors.start_date}
              </p>
            )}
          </div>

          {/* End Date */}
          <div>
            <div className="mb-2 block">
              <Label htmlFor="end-date">End Date *</Label>
            </div>
            <TextInput
              id="end-date"
              type="date"
              value={formData.end_date}
              onChange={(e) =>
                setFormData({ ...formData, end_date: e.target.value })
              }
              color={errors.end_date ? "failure" : undefined}
              required
            />
            {errors.end_date && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                {errors.end_date}
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer - Sticky at bottom, always visible */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-700 flex items-center justify-end gap-3 border-t border-gray-200 p-6 dark:border-gray-600">
          <Button
            type="button"
            color="gray"
            onClick={handleClose}
            disabled={createSprint.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            color="purple"
            disabled={createSprint.isPending}
          >
            {createSprint.isPending && (
              <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {createSprint.isPending ? "Creating..." : "Create Sprint"}
          </Button>
        </div>
      </form>
    </CustomModal>
  );
}
