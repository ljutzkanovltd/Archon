"use client";

import { useState } from "react";
import { Modal, Button, Label, TextInput, Textarea } from "flowbite-react";
import { useCreateSprint } from "../hooks/useSprintQueries";
import { toast } from "react-hot-toast";
import { format, addDays } from "date-fns";

interface CreateSprintModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
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
 *
 * Usage:
 * ```tsx
 * <CreateSprintModal
 *   projectId={projectId}
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 * />
 * ```
 */
export function CreateSprintModal({
  projectId,
  isOpen,
  onClose,
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
      await createSprint.mutateAsync({
        projectId,
        data: {
          name: formData.name.trim(),
          goal: formData.goal.trim() || undefined,
          start_date: formData.start_date,
          end_date: formData.end_date,
        },
      });

      toast.success("Sprint created successfully!");
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
    <Modal show={isOpen} onClose={handleClose} size="md">
      <Modal.Header>Create New Sprint</Modal.Header>
      <Modal.Body>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sprint Name */}
          <div>
            <Label htmlFor="sprint-name" value="Sprint Name *" />
            <TextInput
              id="sprint-name"
              type="text"
              placeholder="Sprint 1"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              color={errors.name ? "failure" : undefined}
              helperText={errors.name}
              autoFocus
            />
          </div>

          {/* Sprint Goal */}
          <div>
            <Label htmlFor="sprint-goal" value="Sprint Goal (Optional)" />
            <Textarea
              id="sprint-goal"
              placeholder="What do you want to achieve in this sprint?"
              rows={3}
              value={formData.goal}
              onChange={(e) =>
                setFormData({ ...formData, goal: e.target.value })
              }
            />
          </div>

          {/* Start Date */}
          <div>
            <Label htmlFor="start-date" value="Start Date *" />
            <TextInput
              id="start-date"
              type="date"
              value={formData.start_date}
              onChange={(e) =>
                setFormData({ ...formData, start_date: e.target.value })
              }
              color={errors.start_date ? "failure" : undefined}
              helperText={errors.start_date}
            />
          </div>

          {/* End Date */}
          <div>
            <Label htmlFor="end-date" value="End Date *" />
            <TextInput
              id="end-date"
              type="date"
              value={formData.end_date}
              onChange={(e) =>
                setFormData({ ...formData, end_date: e.target.value })
              }
              color={errors.end_date ? "failure" : undefined}
              helperText={errors.end_date}
            />
          </div>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          onClick={handleSubmit}
          disabled={createSprint.isPending}
          color="blue"
        >
          {createSprint.isPending ? "Creating..." : "Create Sprint"}
        </Button>
        <Button color="gray" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
