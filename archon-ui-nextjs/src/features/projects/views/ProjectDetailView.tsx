"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { HiArrowLeft, HiPencil, HiArchive, HiTrash } from "react-icons/hi";
import { ViewModeToggle, ViewMode } from "@/components/common/ViewModeToggle";
import { useProjectStore } from "@/store/useProjectStore";
import { useTaskStore } from "@/store/useTaskStore";
import { usePageTitle } from "@/hooks";
import { useRecentProjects } from "@/hooks/useRecentProjects";
import { BoardView } from "@/components/Projects/tasks/views/BoardView";
import { TaskModal, TaskFormData } from "@/components/Tasks/TaskModal";
import { Task } from "@/lib/types";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import { ProjectHeader } from "../components";
import { DataTable, DataTableColumn, DataTableButton } from "@/components/common/DataTable";
import { TaskCard } from "@/components/Tasks/TaskCard";
import { formatDistanceToNow } from "date-fns";

// Use ViewMode from ViewModeToggle component (supports: "kanban" | "table" | "grid" | "list")

// Status badge colors for table view
const STATUS_COLORS: Record<Task["status"], string> = {
  todo: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  doing: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
  done: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
};

// Priority colors for table view
const PRIORITY_COLORS: Record<Task["priority"], string> = {
  low: "text-gray-600 dark:text-gray-400",
  medium: "text-blue-600 dark:text-blue-400",
  high: "text-orange-600 dark:text-orange-400",
  urgent: "text-red-600 dark:text-red-400",
};

interface ProjectDetailViewProps {
  projectId: string;
}

/**
 * ProjectDetailView - Detail view for a single project
 *
 * Features:
 * - Project header with title, description, metadata
 * - Tabs: Board view, Table view for tasks
 * - Project actions: Edit, Archive/Restore
 * - Task management: Create, edit, delete, archive tasks
 * - Breadcrumb navigation and back button
 */
export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const router = useRouter();

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
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [taskModalMode, setTaskModalMode] = useState<"create" | "edit">("create");

  // Define columns for DataTable (used in table view)
  const taskColumns: DataTableColumn<Task>[] = useMemo(() => [
    {
      key: "title",
      label: "Title",
      sortable: true,
      render: (value: string, task: Task) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{value}</div>
          {task.feature && (
            <div className="text-sm text-gray-500 dark:text-gray-400">{task.feature}</div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value: Task["status"]) => (
        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${STATUS_COLORS[value]}`}>
          {value}
        </span>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      sortable: true,
      render: (value: Task["priority"]) => (
        <span className={`text-sm font-medium ${PRIORITY_COLORS[value]}`}>
          {value}
        </span>
      ),
    },
    {
      key: "assignee",
      label: "Assignee",
      sortable: true,
    },
    {
      key: "updated_at",
      label: "Updated",
      sortable: true,
      render: (value: string) => formatDistanceToNow(new Date(value), { addSuffix: true }),
    },
  ], []);

  // Row buttons for DataTable actions
  const getRowButtons = useCallback((task: Task): DataTableButton[] => [
    {
      label: "Edit",
      icon: HiPencil,
      onClick: () => handleEditTask(task),
      variant: "ghost",
      ariaLabel: `Edit ${task.title}`,
    },
    {
      label: task.archived ? "Restore" : "Archive",
      icon: HiArchive,
      onClick: () => handleArchiveTask(task),
      variant: "ghost",
      ariaLabel: task.archived ? `Restore ${task.title}` : `Archive ${task.title}`,
    },
    {
      label: "Delete",
      icon: HiTrash,
      onClick: () => handleDeleteTask(task),
      variant: "danger",
      ariaLabel: `Delete ${task.title}`,
    },
  ], []);

  // Custom render for grid view - uses TaskCard with grid variant (compact)
  const renderTaskCard = useCallback((task: Task) => (
    <TaskCard
      task={task}
      variant="grid"
      onEdit={handleEditTask}
      onDelete={handleDeleteTask}
      onArchive={handleArchiveTask}
      onStatusChange={async (t, newStatus) => {
        await taskStore.updateTask(t.id, { status: newStatus });
        await fetchTasks({ project_id: projectId, include_closed: true, per_page: 1000 });
      }}
      onAssigneeChange={async (t, newAssignee) => {
        await taskStore.updateTask(t.id, { assignee: newAssignee });
        await fetchTasks({ project_id: projectId, include_closed: true, per_page: 1000 });
      }}
    />
  ), [projectId, taskStore, fetchTasks]);

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
    fetchProjectById(projectId);
    // Fetch all tasks with high per_page to avoid pagination issues
    fetchTasks({ project_id: projectId, include_closed: true, per_page: 1000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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
      {/* Breadcrumb */}
      <BreadCrumb
        items={[
          { label: "Projects", href: "/projects" },
          { label: selectedProject.title, href: `/projects/${projectId}` }
        ]}
        className="mb-4"
      />

      {/* Back Button */}
      <button
        onClick={handleBack}
        className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <HiArrowLeft className="h-4 w-4" />
        Back to Projects
      </button>

      {/* Header with Actions */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1">
          <ProjectHeader
            mode="detail"
            project={{ ...selectedProject, task_count: tasks.length }}
          />
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

        {/* Three-mode view toggle: Kanban / Table / Grid - uses reusable ViewModeToggle */}
        <ViewModeToggle
          modes={["kanban", "table", "grid"]}
          currentMode={viewMode}
          onChange={setViewMode}
          size="md"
          showLabels={true}
        />
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
      ) : viewMode === "kanban" ? (
        // Kanban view - uses BoardView with status columns
        <BoardView
          projectId={projectId}
          tasks={tasks}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onArchiveTask={handleArchiveTask}
        />
      ) : viewMode === "table" ? (
        // Table view - uses DataTable with columns
        <DataTable<Task>
          data={tasks}
          columns={taskColumns}
          keyExtractor={(task) => task.id}
          rowButtons={getRowButtons}
          tableId={`archon-project-tasks-${projectId}`}
          enableMultiSort={true}
          showPrimaryAction={true}
          viewMode="table"
          showSearch={true}
          showPagination={true}
          showHeader={false}
          showViewToggle={false}
          emptyMessage="No tasks found. Create your first task to get started!"
          caption="Tasks in this project"
        />
      ) : (
        // Grid view - uses DataTable with TaskCard customRender
        <DataTable<Task>
          data={tasks}
          columns={taskColumns}
          keyExtractor={(task) => task.id}
          customRender={renderTaskCard}
          tableId={`archon-project-tasks-grid-${projectId}`}
          viewMode="grid"
          showSearch={true}
          showPagination={true}
          showHeader={false}
          showViewToggle={false}
          emptyMessage="No tasks found. Create your first task to get started!"
          caption="Tasks in this project"
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
