"use client";

import { Task } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  onView?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}

/**
 * TaskCard - Grid view card component for tasks
 *
 * Displays task information in a card format with status badge,
 * priority indicator, and action buttons.
 */
export function TaskCard({ task, onView, onEdit, onDelete }: TaskCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="font-medium text-gray-900 dark:text-white">{task.title}</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Status: {task.status}
      </p>
      {/* TODO: Add full card implementation with actions */}
    </div>
  );
}
