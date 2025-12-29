"use client";

import { useState } from "react";
import { Tooltip } from "flowbite-react";
import {
  HiChevronDown,
  HiChevronUp,
  HiEye,
  HiPencil,
  HiArchive,
  HiPlus,
  HiCalendar,
} from "react-icons/hi";
import { Project, Task } from "@/lib/types";
import { useTaskStore } from "@/store/useTaskStore";
import { formatDistanceToNow } from "date-fns";
import { TaskCard } from "@/components/Tasks/TaskCard";

interface ProjectWithTasksCardProps {
  project: Project;
  onView: (project: Project) => void;
  onEdit: (project: Project) => void;
  onArchive: (project: Project) => void;
  onCreateTask?: (projectId: string) => void;
}

const statusBadgeStyles = {
  todo: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  doing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
} as const;

export function ProjectWithTasksCard({
  project,
  onView,
  onEdit,
  onArchive,
  onCreateTask,
}: ProjectWithTasksCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { tasks, fetchTasks, isLoading: tasksLoading } = useTaskStore();

  // Filter tasks for this project
  const projectTasks = (tasks || []).filter(
    (task) => task.project_id === project.id
  );

  // Group tasks by status
  const tasksByStatus = {
    todo: projectTasks.filter((t) => t.status === "todo"),
    doing: projectTasks.filter((t) => t.status === "doing"),
    review: projectTasks.filter((t) => t.status === "review"),
    done: projectTasks.filter((t) => t.status === "done"),
  };

  const handleToggle = async () => {
    if (!isExpanded) {
      // Fetch tasks for this project when expanding
      await fetchTasks({ project_id: project.id, per_page: 100 });
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="relative rounded-lg overflow-hidden bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 p-4">
      {/* Header with badges and actions */}
      <div className="flex items-center gap-1.5 mb-2">
        {/* Badges (archived, pinned) */}
        <div className="flex flex-wrap gap-1">
          {project.archived && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
              <HiArchive className="w-3 h-3 mr-1" aria-hidden="true" />
              Archived
            </span>
          )}
          {project.pinned && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              Pinned
            </span>
          )}
        </div>

        {/* Action buttons group */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* View Button */}
          <Tooltip content="View project" style="light" trigger="hover,focus">
            <button
              type="button"
              onClick={() => onView(project)}
              className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-800/40 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              aria-label={`View ${project.title} details`}
            >
              <HiEye className="w-3 h-3" aria-hidden="true" />
            </button>
          </Tooltip>

          {/* Edit Button */}
          <Tooltip content="Edit project" style="light" trigger="hover,focus">
            <button
              type="button"
              onClick={() => onEdit(project)}
              disabled={project.archived}
              className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/40 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Edit ${project.title}`}
            >
              <HiPencil className="w-3 h-3" aria-hidden="true" />
            </button>
          </Tooltip>

          {/* Archive/Restore Button */}
          <Tooltip content={project.archived ? "Restore project" : "Archive project"} style="light" trigger="hover,focus">
            <button
              type="button"
              onClick={() => onArchive(project)}
              className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              aria-label={project.archived ? `Restore ${project.title}` : `Archive ${project.title}`}
            >
              <HiArchive className="w-3 h-3" aria-hidden="true" />
            </button>
          </Tooltip>

          {/* Toggle Tasks Button */}
          <Tooltip content={isExpanded ? "Hide tasks" : `Show ${projectTasks.length} tasks`} style="light" trigger="hover,focus">
            <button
              type="button"
              onClick={handleToggle}
              className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-200 dark:hover:bg-brand-800/40 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              aria-label={isExpanded ? "Hide tasks" : `Show ${projectTasks.length} tasks`}
            >
              {isExpanded ? (
                <HiChevronUp className="w-3 h-3" aria-hidden="true" />
              ) : (
                <HiChevronDown className="w-3 h-3" aria-hidden="true" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight mb-2 line-clamp-2">
        {project.title}
      </h3>

      {/* Description */}
      {project.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2 line-clamp-3">
          {project.description}
        </p>
      )}

      {/* Footer with metadata and task counts */}
      <div className="mt-auto pt-2.5 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Created date */}
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
            <HiCalendar className="h-3 w-3" aria-hidden="true" />
            <span>
              {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
            </span>
          </div>

          {/* Task Summary Badges */}
          <div className="flex items-center gap-1 flex-wrap">
            {tasksByStatus.todo.length > 0 && (
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${statusBadgeStyles.todo}`}>
                {tasksByStatus.todo.length} To Do
              </span>
            )}
            {tasksByStatus.doing.length > 0 && (
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${statusBadgeStyles.doing}`}>
                {tasksByStatus.doing.length} Doing
              </span>
            )}
            {tasksByStatus.review.length > 0 && (
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${statusBadgeStyles.review}`}>
                {tasksByStatus.review.length} Review
              </span>
            )}
            {tasksByStatus.done.length > 0 && (
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${statusBadgeStyles.done}`}>
                {tasksByStatus.done.length} Done
              </span>
            )}
            {projectTasks.length === 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">No tasks</span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Tasks Section */}
      {isExpanded && (
        <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
          {tasksLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          ) : projectTasks.length > 0 ? (
            <>
              {/* Create Task Button */}
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => onCreateTask?.(project.id)}
                  disabled={project.archived}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors duration-200 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <HiPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                  New Task
                </button>
              </div>

              {/* Task Columns */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* To Do Column */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <div className="h-2 w-2 rounded-full bg-gray-400" />
                    To Do ({tasksByStatus.todo.length})
                  </h4>
                  <div className="space-y-2">
                    {tasksByStatus.todo.map((task) => (
                      <TaskCard key={task.id} task={task} compact />
                    ))}
                  </div>
                </div>

                {/* Doing Column */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    Doing ({tasksByStatus.doing.length})
                  </h4>
                  <div className="space-y-2">
                    {tasksByStatus.doing.map((task) => (
                      <TaskCard key={task.id} task={task} compact />
                    ))}
                  </div>
                </div>

                {/* Review Column */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    Review ({tasksByStatus.review.length})
                  </h4>
                  <div className="space-y-2">
                    {tasksByStatus.review.map((task) => (
                      <TaskCard key={task.id} task={task} compact />
                    ))}
                  </div>
                </div>

                {/* Done Column */}
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    Done ({tasksByStatus.done.length})
                  </h4>
                  <div className="space-y-2">
                    {tasksByStatus.done.map((task) => (
                      <TaskCard key={task.id} task={task} compact />
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                No tasks in this project yet
              </p>
              {!project.archived && (
                <button
                  onClick={() => onCreateTask?.(project.id)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors duration-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  <HiPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Create First Task
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
