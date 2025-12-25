"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { HiArrowLeft, HiPencil, HiArchive } from "react-icons/hi";
import { useProjectStore } from "@/store/useProjectStore";
import { useTaskStore } from "@/store/useTaskStore";
import { usePageTitle } from "@/hooks";
import { useRecentProjects } from "@/hooks/useRecentProjects";
import { BoardView } from "@/components/Projects/tasks/views/BoardView";
import { TaskTableView } from "@/components/Projects/tasks/views/TaskTableView";
import { TaskModal, TaskFormData } from "@/components/Tasks/TaskModal";
import { Task } from "@/lib/types";
import { useState, useCallback } from "react";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const projectStore = useProjectStore();
  const {
    selectedProject,
    fetchProjectById,
    archiveProject,
    unarchiveProject,
    setSelectedProject,
    isLoading: projectLoading,
    error: projectError,
  } = projectStore;

  const taskStore = useTaskStore();
  const {
    tasks,
    fetchTasks,
    isLoading: tasksLoading,
    error: tasksError,
  } = taskStore;

  const { addRecentProject } = useRecentProjects();
  const [viewMode, setViewMode] = useState<"board" | "table">("board");
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [taskModalMode, setTaskModalMode] = useState<"create" | "edit">("create");

  // Clear selected project on unmount to prevent stale data
  useEffect(() => {
    return () => {
      setSelectedProject(null);
    };
  }, [setSelectedProject]);

  usePageTitle(
    selectedProject ? selectedProject.title : "Project Details",
    "Archon"
  );

  // Fetch project and tasks on mount
  useEffect(() => {
    console.log("[Project Detail] Loading project:", projectId);
    console.log("[Project Detail] Current state - isLoading:", projectLoading, "selectedProject:", selectedProject?.title);
    fetchProjectById(projectId);
    // Fetch all tasks with high per_page to avoid pagination issues
    fetchTasks({ project_id: projectId, include_closed: true, per_page: 1000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Debug log state changes
  useEffect(() => {
    console.log("[Project Detail] State changed - isLoading:", projectLoading, "selectedProject:", selectedProject?.title, "tasksLoading:", tasksLoading, "tasks count:", tasks.length);
  }, [projectLoading, selectedProject, tasksLoading, tasks]);

  // Track project access for recent projects
  useEffect(() => {
    if (selectedProject) {
      addRecentProject({
        id: selectedProject.id,
        title: selectedProject.title,
      });
    }
  }, [selectedProject, addRecentProject]);

  // ========== HANDLERS ==========

  const handleBack = () => {
    router.push("/projects");
  };

  const handleEdit = () => {
    router.push(`/projects/${projectId}/edit`);
  };

  const handleArchive = async () => {
    if (!selectedProject) return;

    if (selectedProject.archived) {
      await unarchiveProject(projectId);
    } else {
      await archiveProject(projectId, "User");
    }

    // Refresh project
    await fetchProjectById(projectId);
  };

  // Task handlers
  const handleCreateTask = () => {
    setTaskModalMode("create");
    setSelectedTaskForEdit(null);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setTaskModalMode("edit");
    setSelectedTaskForEdit(task);
    setIsTaskModalOpen(true);
  };

  const handleDeleteTask = async (task: Task) => {
    if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
      try {
        await taskStore.deleteTask(task.id);
        // Refresh tasks
        await fetchTasks({ project_id: projectId, include_closed: true });
      } catch (error) {
        console.error("Error deleting task:", error);
        alert("Failed to delete task. Please try again.");
      }
    }
  };

  const handleArchiveTask = async (task: Task) => {
    try {
      if (task.archived) {
        await taskStore.unarchiveTask(task.id);
      } else {
        await taskStore.archiveTask(task.id, "User");
      }
      // Refresh tasks
      await fetchTasks({ project_id: projectId, include_closed: true });
    } catch (error) {
      console.error("Error archiving/unarchiving task:", error);
      alert("Failed to archive/unarchive task. Please try again.");
    }
  };

  const handleSaveTask = async (taskData: TaskFormData) => {
    try {
      if (taskModalMode === "create") {
        await taskStore.createTask(taskData);
      } else if (selectedTaskForEdit) {
        await taskStore.updateTask(selectedTaskForEdit.id, taskData);
      }

      // Refresh tasks
      await fetchTasks({ project_id: projectId, include_closed: true });
      setIsTaskModalOpen(false);
      setSelectedTaskForEdit(null);
    } catch (error) {
      console.error("Error saving task:", error);
      throw error;
    }
  };

  // ========== RENDER ==========

  if (projectError) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold">Error loading project</p>
          <p className="text-sm">{projectError}</p>
          <button
            onClick={handleBack}
            className="mt-4 text-sm underline hover:no-underline"
          >
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (projectLoading || !selectedProject) {
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
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <HiArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {selectedProject.title}
              </h1>
              {selectedProject.archived && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  Archived
                </span>
              )}
            </div>
            {selectedProject.description && (
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {selectedProject.description}
              </p>
            )}

            {/* Project Stats */}
            <div className="mt-4 flex gap-6">
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">Tasks:</span>{" "}
                <span className="font-medium text-gray-900 dark:text-white">
                  {tasks.length}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Documents:
                </span>{" "}
                <span className="font-medium text-gray-900 dark:text-white">
                  {selectedProject.document_count || 0}
                </span>
              </div>
              {selectedProject.github_repo && (
                <div className="text-sm">
                  <a
                    href={selectedProject.github_repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline dark:text-brand-400"
                  >
                    GitHub →
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              disabled={selectedProject.archived}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <HiPencil className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={handleArchive}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <HiArchive className="h-4 w-4" />
              {selectedProject.archived ? "Restore" : "Archive"}
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Toggle & Create Task Button */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={handleCreateTask}
          disabled={selectedProject.archived}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Task
        </button>

        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setViewMode("board")}
            className={`rounded-l-lg px-4 py-2 text-sm font-medium ${
              viewMode === "board"
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Board View
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`rounded-r-lg border-l border-gray-200 px-4 py-2 text-sm font-medium dark:border-gray-700 ${
              viewMode === "table"
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Table View
          </button>
        </div>
      </div>

      {/* Tasks View */}
      {tasksError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold">Error loading tasks</p>
          <p className="text-sm">{tasksError}</p>
        </div>
      ) : tasksLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : viewMode === "board" ? (
        <BoardView
          projectId={projectId}
          tasks={tasks}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onArchiveTask={handleArchiveTask}
        />
      ) : (
        <TaskTableView
          projectId={projectId}
          tasks={tasks}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onArchiveTask={handleArchiveTask}
        />
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTaskForEdit(null);
        }}
        onSave={handleSaveTask}
        task={selectedTaskForEdit}
        projectId={projectId}
        mode={taskModalMode}
      />
    </div>
  );
}
