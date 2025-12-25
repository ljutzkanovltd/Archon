"use client";

import { useState } from "react";
import { Card, Badge, Button } from "flowbite-react";
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

const statusColors = {
  todo: "gray",
  doing: "blue",
  review: "yellow",
  done: "success",
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
    <Card className="transition-all duration-200 hover:shadow-lg">
      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {project.title}
            </h3>
            {project.archived && (
              <Badge color="gray" size="sm">
                Archived
              </Badge>
            )}
            {project.pinned && (
              <Badge color="info" size="sm">
                Pinned
              </Badge>
            )}
          </div>

          {project.description && (
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              {project.description}
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <HiCalendar className="h-4 w-4" />
              <span>
                Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
              </span>
            </div>

            {/* Task Summary Badges */}
            <div className="flex items-center gap-2">
              {tasksByStatus.todo.length > 0 && (
                <Badge color={statusColors.todo} size="sm">
                  {tasksByStatus.todo.length} To Do
                </Badge>
              )}
              {tasksByStatus.doing.length > 0 && (
                <Badge color={statusColors.doing} size="sm">
                  {tasksByStatus.doing.length} Doing
                </Badge>
              )}
              {tasksByStatus.review.length > 0 && (
                <Badge color={statusColors.review} size="sm">
                  {tasksByStatus.review.length} Review
                </Badge>
              )}
              {tasksByStatus.done.length > 0 && (
                <Badge color={statusColors.done} size="sm">
                  {tasksByStatus.done.length} Done
                </Badge>
              )}
              {projectTasks.length === 0 && (
                <span className="text-xs text-gray-400">No tasks</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-start gap-2">
          <Button
            size="xs"
            color="light"
            onClick={() => onView(project)}
          >
            <HiEye className="mr-1 h-4 w-4" />
            View
          </Button>
          <Button
            size="xs"
            color="light"
            onClick={() => onEdit(project)}
            disabled={project.archived}
          >
            <HiPencil className="mr-1 h-4 w-4" />
            Edit
          </Button>
          <Button
            size="xs"
            color={project.archived ? "blue" : "light"}
            onClick={() => onArchive(project)}
          >
            <HiArchive className="mr-1 h-4 w-4" />
            {project.archived ? "Restore" : "Archive"}
          </Button>
          <Button
            size="xs"
            color="light"
            onClick={handleToggle}
          >
            {isExpanded ? (
              <>
                <HiChevronUp className="mr-1 h-4 w-4" />
                Hide Tasks
              </>
            ) : (
              <>
                <HiChevronDown className="mr-1 h-4 w-4" />
                Show Tasks ({projectTasks.length})
              </>
            )}
          </Button>
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
                <Button
                  size="sm"
                  color="blue"
                  onClick={() => onCreateTask?.(project.id)}
                  disabled={project.archived}
                >
                  <HiPlus className="mr-2 h-4 w-4" />
                  New Task
                </Button>
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
                <Button
                  size="sm"
                  color="blue"
                  onClick={() => onCreateTask?.(project.id)}
                >
                  <HiPlus className="mr-2 h-4 w-4" />
                  Create First Task
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
