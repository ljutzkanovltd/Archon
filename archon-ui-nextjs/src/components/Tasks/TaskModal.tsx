"use client";

import { useState, useEffect } from "react";
import { HiX, HiCheck } from "react-icons/hi";
import { Task } from "@/lib/types";
import { WorkflowStageSelector } from "./WorkflowStageSelector";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: TaskFormData) => Promise<void>;
  task?: Task | null;
  projectId: string;
  mode: "create" | "edit";
}

export interface TaskFormData {
  title: string;
  description: string;
  workflow_stage_id: string; // NEW: workflow stage ID
  priority: "low" | "medium" | "high" | "urgent";
  assignee: string;
  feature?: string;
  project_id: string;
}

export function TaskModal({
  isOpen,
  onClose,
  onSave,
  task,
  projectId,
  mode,
}: TaskModalProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    title: "",
    description: "",
    workflow_stage_id: "", // Will be set by WorkflowStageSelector
    priority: "medium",
    assignee: "User",
    feature: "",
    project_id: projectId,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with task data when editing
  useEffect(() => {
    if (task && mode === "edit") {
      setFormData({
        title: task.title,
        description: task.description || "",
        workflow_stage_id: task.workflow_stage_id,
        priority: task.priority,
        assignee: task.assignee,
        feature: task.feature || "",
        project_id: task.project_id,
      });
    } else if (mode === "create") {
      // Reset form for new task
      setFormData({
        title: "",
        description: "",
        workflow_stage_id: "", // Will be set by WorkflowStageSelector default
        priority: "medium",
        assignee: "User",
        feature: "",
        project_id: projectId,
      });
    }
  }, [task, mode, projectId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error("Error saving task:", err);
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (
    field: keyof TaskFormData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-50 dark:bg-opacity-80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-4 shadow-lg dark:bg-gray-800">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {mode === "create" ? "Create New Task" : "Edit Task"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <HiX className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                Task Title *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="Enter task title"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={4}
                className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="Enter task description"
              />
            </div>

            {/* Workflow Stage */}
            <div>
              <label htmlFor="workflow_stage" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                Workflow Stage *
              </label>
              <WorkflowStageSelector
                value={formData.workflow_stage_id}
                onChange={(stageId) => handleChange("workflow_stage_id", stageId)}
                required
              />
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                Priority *
              </label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => handleChange("priority", e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label htmlFor="assignee" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                Assignee *
              </label>
              <input
                type="text"
                id="assignee"
                value={formData.assignee}
                onChange={(e) => handleChange("assignee", e.target.value)}
                required
                className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="Enter assignee name"
              />
            </div>

            {/* Feature */}
            <div>
              <label htmlFor="feature" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                Feature/Category
              </label>
              <input
                type="text"
                id="feature"
                value={formData.feature}
                onChange={(e) => handleChange("feature", e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="e.g., Documentation, Backend, Frontend"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 flex gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !formData.title.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-800 hover:text-white dark:focus:ring-brand-800"
          >
            <HiCheck className="h-5 w-5" />
            {isSaving ? "Saving..." : mode === "create" ? "Create Task" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 hover:text-brand-700 focus:z-10 focus:outline-none focus:ring-4 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white dark:focus:ring-gray-700"
          >
            <HiX className="h-5 w-5" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
