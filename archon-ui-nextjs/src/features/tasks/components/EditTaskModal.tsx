"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Label, TextInput, Textarea } from "flowbite-react";
import { tasksApi } from "@/lib/apiClient";
import { Task } from "@/lib/types";
import { toast } from "react-hot-toast";
import { SprintSelector } from "@/features/sprints";
import { WorkflowStageSelector } from "@/features/workflows";

interface EditTaskModalProps {
  task: Task;
  workflowId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * EditTaskModal - Modal for editing an existing task
 *
 * Features:
 * - Pre-populated form with task data
 * - Task title (required)
 * - Task description (required)
 * - Workflow stage selection (Phase 2.2 - dynamic, replaces hardcoded status)
 * - Priority selection
 * - Assignee input
 * - Feature/label input
 * - Estimated hours input
 * - Sprint selection (Phase 1.15)
 * - Form validation
 * - Success/error notifications
 *
 * Usage:
 * ```tsx
 * <EditTaskModal
 *   task={selectedTask}
 *   workflowId={project.workflow_id}
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   onSuccess={refreshTasks}
 * />
 * ```
 */
export function EditTaskModal({
  task,
  workflowId,
  isOpen,
  onClose,
  onSuccess,
}: EditTaskModalProps) {
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description,
    workflow_stage_id: task.workflow_stage_id,
    priority: task.priority,
    assignee: task.assignee,
    feature: task.feature || "",
    estimated_hours: task.estimated_hours?.toString() || "",
    sprint_id: task.sprint_id,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form data when task prop changes
  useEffect(() => {
    setFormData({
      title: task.title,
      description: task.description,
      workflow_stage_id: task.workflow_stage_id,
      priority: task.priority,
      assignee: task.assignee,
      feature: task.feature || "",
      estimated_hours: task.estimated_hours?.toString() || "",
      sprint_id: task.sprint_id,
    });
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) {
      newErrors.title = "Task title is required";
    }
    if (!formData.description.trim()) {
      newErrors.description = "Task description is required";
    }
    if (!formData.workflow_stage_id) {
      newErrors.workflow_stage_id = "Workflow stage is required";
    }
    if (
      formData.estimated_hours &&
      isNaN(Number(formData.estimated_hours))
    ) {
      newErrors.estimated_hours = "Must be a valid number";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await tasksApi.update(task.id, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        workflow_stage_id: formData.workflow_stage_id!,
        priority: formData.priority,
        assignee: formData.assignee.trim() || "Unassigned",
        feature: formData.feature.trim() || undefined,
        estimated_hours: formData.estimated_hours
          ? Number(formData.estimated_hours)
          : undefined,
        sprint_id: formData.sprint_id,
      });

      toast.success("Task updated successfully!");
      handleClose();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to update task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  return (
    <Modal show={isOpen} onClose={handleClose} size="lg">
      <Modal.Header>Edit Task</Modal.Header>
      <Modal.Body>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Title */}
          <div>
            <Label htmlFor="edit-task-title" value="Task Title *" />
            <TextInput
              id="edit-task-title"
              type="text"
              placeholder="Enter task title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              color={errors.title ? "failure" : undefined}
              helperText={errors.title}
              autoFocus
            />
          </div>

          {/* Task Description */}
          <div>
            <Label htmlFor="edit-task-description" value="Description *" />
            <Textarea
              id="edit-task-description"
              placeholder="Enter task description"
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              color={errors.description ? "failure" : undefined}
              helperText={errors.description}
            />
          </div>

          {/* Workflow Stage - Phase 2.2: Dynamic workflow stage selection */}
          <WorkflowStageSelector
            workflowId={workflowId}
            value={formData.workflow_stage_id}
            onChange={(stageId) =>
              setFormData({ ...formData, workflow_stage_id: stageId })
            }
            label="Stage"
            required
            helperText={errors.workflow_stage_id}
          />

          {/* Priority */}
          <div>
            <Label htmlFor="edit-task-priority" value="Priority *" />
            <select
              id="edit-task-priority"
              value={formData.priority}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  priority: e.target.value as typeof formData.priority,
                })
              }
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-brand-500 dark:focus:ring-brand-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Assignee */}
          <div>
            <Label htmlFor="edit-task-assignee" value="Assignee" />
            <TextInput
              id="edit-task-assignee"
              type="text"
              placeholder="Enter assignee name"
              value={formData.assignee}
              onChange={(e) =>
                setFormData({ ...formData, assignee: e.target.value })
              }
            />
          </div>

          {/* Feature/Label */}
          <div>
            <Label htmlFor="edit-task-feature" value="Feature/Label (Optional)" />
            <TextInput
              id="edit-task-feature"
              type="text"
              placeholder="e.g., authentication, frontend, backend"
              value={formData.feature}
              onChange={(e) =>
                setFormData({ ...formData, feature: e.target.value })
              }
            />
          </div>

          {/* Estimated Hours */}
          <div>
            <Label htmlFor="edit-task-hours" value="Estimated Hours (Optional)" />
            <TextInput
              id="edit-task-hours"
              type="number"
              step="0.5"
              min="0"
              placeholder="e.g., 4"
              value={formData.estimated_hours}
              onChange={(e) =>
                setFormData({ ...formData, estimated_hours: e.target.value })
              }
              color={errors.estimated_hours ? "failure" : undefined}
              helperText={errors.estimated_hours}
            />
          </div>

          {/* Sprint Selection - Phase 1.15 */}
          <SprintSelector
            projectId={task.project_id}
            value={formData.sprint_id}
            onChange={(sprintId) =>
              setFormData({ ...formData, sprint_id: sprintId })
            }
            label="Sprint (Optional)"
            helperText="Assign this task to a sprint for better tracking"
          />
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleSubmit} disabled={isSubmitting || task.archived} color="blue">
          {isSubmitting ? "Updating..." : "Update Task"}
        </Button>
        <Button color="gray" onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
