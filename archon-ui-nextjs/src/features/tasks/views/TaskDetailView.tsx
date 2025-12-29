"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiArrowLeft, HiPencil, HiTrash, HiArchive, HiDuplicate, HiExternalLink } from "react-icons/hi";
import { tasksApi } from "@/lib/apiClient";
import { Task } from "@/lib/types";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import { usePageTitle } from "@/hooks";
import { formatDistanceToNow, format } from "date-fns";

interface TaskDetailViewProps {
  taskId: string;
}

/**
 * TaskDetailView - Detail view for a single task
 *
 * Features:
 * - Breadcrumb navigation with task title
 * - Back button to return to Tasks list
 * - Task header with title, status badge, priority indicator
 * - Task metadata (project, assignee, dates)
 * - Task description display
 * - Status update dropdown
 * - Task history timeline
 * - Related project link
 * - Task actions (edit, delete, duplicate, archive)
 */
export function TaskDetailView({ taskId }: TaskDetailViewProps) {
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [taskHistory, setTaskHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  usePageTitle(
    task ? task.title : "Task Details",
    "Archon"
  );

  // Fetch task data on mount
  useEffect(() => {
    loadTask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const loadTask = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await tasksApi.getById(taskId);
      if (response) {
        setTask(response);
      } else {
        setError("Task not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task");
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!task) return;

    setIsHistoryLoading(true);
    try {
      const response = await tasksApi.getHistory(taskId);
      if (response.success && response.history) {
        setTaskHistory(response.history);
      }
    } catch (err) {
      console.error("Failed to load task history:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (showHistory && taskHistory.length === 0) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistory]);

  // ========== HANDLERS ==========

  const handleBack = () => {
    router.push("/tasks");
  };

  const handleEdit = () => {
    // TODO: Implement edit modal or navigate to edit page
    alert(`Edit task: ${task?.title}`);
  };

  const handleDelete = async () => {
    if (!task) return;

    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) {
      return;
    }

    try {
      await tasksApi.delete(taskId);
      alert("Task deleted successfully!");
      router.push("/tasks");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const handleArchive = async () => {
    if (!task) return;

    try {
      if (task.archived) {
        await tasksApi.unarchive(taskId);
      } else {
        await tasksApi.archive(taskId, "User");
      }
      await loadTask();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive/unarchive task");
    }
  };

  const handleDuplicate = () => {
    // TODO: Implement duplicate functionality
    alert("Duplicate task functionality - coming soon!");
  };

  const handleStatusChange = async (newStatus: Task["status"]) => {
    if (!task) return;

    try {
      await tasksApi.update(taskId, { status: newStatus });
      await loadTask();
      // Reload history to show new status change
      if (showHistory) {
        await loadHistory();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update task status");
    }
  };

  const handleViewProject = () => {
    if (task?.project_id) {
      router.push(`/projects/${task.project_id}`);
    }
  };

  // ========== STATUS BADGE ==========

  const StatusBadge = ({ status }: { status: Task["status"] }) => {
    const colors = {
      todo: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      doing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    };

    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const PriorityBadge = ({ priority }: { priority: string }) => {
    const colors = {
      low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
      urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    };

    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${colors[priority as keyof typeof colors] || colors.medium}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  // ========== RENDER ==========

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold">Error loading task</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={handleBack}
            className="mt-4 text-sm underline hover:no-underline"
          >
            ← Back to Tasks
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !task) {
    return (
      <div className="p-8">
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <BreadCrumb
        items={[
          { label: "Tasks", href: "/tasks" },
          { label: task.title, href: `/tasks/${taskId}` }
        ]}
        className="mb-4"
      />

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <HiArrowLeft className="h-4 w-4" />
          Back to Tasks
        </button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {task.title}
              </h1>
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.feature && (
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                  {task.feature}
                </span>
              )}
              {task.archived && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  Archived
                </span>
              )}
            </div>

            {/* Task Metadata */}
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Assignee</div>
                <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {task.assignee || "Unassigned"}
                </div>
              </div>

              {task.estimated_hours && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Estimated Hours</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {task.estimated_hours}h
                  </div>
                </div>
              )}

              {task.actual_hours && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Actual Hours</div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {task.actual_hours}h
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Created</div>
                <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Last Updated</div>
                <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                </div>
              </div>

              {task.project_id && (
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Project</div>
                  <button
                    onClick={handleViewProject}
                    className="mt-1 flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    View Project
                    <HiExternalLink className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              disabled={task.archived}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <HiPencil className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={handleDuplicate}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <HiDuplicate className="h-4 w-4" />
              Duplicate
            </button>
            <button
              onClick={handleArchive}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <HiArchive className="h-4 w-4" />
              {task.archived ? "Restore" : "Archive"}
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <HiTrash className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Status Update Section */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Update Status
        </h2>
        <div className="flex gap-2">
          {(["todo", "doing", "review", "done"] as Task["status"][]).map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={task.status === status || task.archived}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                task.status === status
                  ? "bg-brand-600 text-white cursor-not-allowed"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              } disabled:opacity-50`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Description Section */}
      {task.description && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Description
          </h2>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {task.description}
            </p>
          </div>
        </div>
      )}

      {/* History Timeline */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Task History
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {showHistory ? "Hide" : "Show"}
          </span>
        </button>

        {showHistory && (
          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            {isHistoryLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
              </div>
            ) : taskHistory.length > 0 ? (
              <div className="space-y-4">
                {taskHistory.map((entry, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-brand-600 mt-2" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-900 dark:text-white">
                        <strong>{entry.field_name}</strong> changed from{" "}
                        <span className="font-medium">{entry.old_value || "none"}</span> to{" "}
                        <span className="font-medium">{entry.new_value}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {entry.changed_by} • {formatDistanceToNow(new Date(entry.changed_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No history available for this task
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
