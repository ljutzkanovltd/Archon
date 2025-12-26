"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HiPlus, HiEye, HiPencil, HiTrash, HiArchive } from "react-icons/hi";
import { DataTable, DataTableColumn, DataTableButton } from "@/components/common/DataTable";
import { useTaskStore } from "@/store/useTaskStore";
import { useProjectStore } from "@/store/useProjectStore";
import { usePageTitle } from "@/hooks";
import { Task } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { BreadCrumb } from "@/components/common/BreadCrumb";

// Status badge colors
const statusColors = {
  todo: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  doing: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  review: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
  done: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
};

export default function TasksPage() {
  usePageTitle("Tasks", "Archon");

  const router = useRouter();
  const {
    tasks,
    fetchTasks,
    deleteTask,
    archiveTask,
    unarchiveTask,
    isLoading,
    error,
  } = useTaskStore();

  const { projects, fetchProjects } = useProjectStore();

  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Fetch tasks and projects on mount
  useEffect(() => {
    fetchTasks({ include_closed: true, per_page: 1000 });
    if (projects.length === 0) {
      fetchProjects({ per_page: 100 });
    }
  }, [fetchTasks, fetchProjects, projects.length]);

  // ========== HANDLERS ==========

  const handleView = (task: Task) => {
    if (task.project_id) {
      router.push(`/projects/${task.project_id}?taskId=${task.id}`);
    }
  };

  const handleEdit = (task: Task) => {
    if (task.project_id) {
      router.push(`/projects/${task.project_id}?taskId=${task.id}&mode=edit`);
    }
  };

  const handleDelete = async (task: Task) => {
    if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
      try {
        await deleteTask(task.id);
        await fetchTasks({ include_closed: true, per_page: 1000 });
      } catch (err) {
        console.error("Error deleting task:", err);
        alert("Failed to delete task. Please try again.");
      }
    }
  };

  const handleArchive = async (task: Task) => {
    try {
      if (task.archived) {
        await unarchiveTask(task.id);
      } else {
        await archiveTask(task.id, "User");
      }
      await fetchTasks({ include_closed: true, per_page: 1000 });
    } catch (err) {
      console.error("Error archiving task:", err);
      alert("Failed to archive task. Please try again.");
    }
  };

  const handleCreate = () => {
    // Navigate to first project or projects page
    if (projects.length > 0) {
      router.push(`/projects/${projects[0].id}?createTask=true`);
    } else {
      router.push("/projects");
    }
  };

  // ========== TABLE CONFIGURATION ==========

  const columns: DataTableColumn<Task>[] = [
    {
      key: "title",
      label: "Task Title",
      sortable: true,
      render: (value, task) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {value}
          </div>
          {task.archived && (
            <span className="text-xs text-gray-500">Archived</span>
          )}
        </div>
      ),
    },
    {
      key: "project_id",
      label: "Project",
      render: (value, task) => {
        const project = projects.find((p) => p.id === value);
        return (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {project ? (
              <a
                href={`/projects/${project.id}`}
                className="text-brand-600 hover:underline dark:text-brand-400"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                {project.title}
              </a>
            ) : (
              "Unknown Project"
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      width: "120px",
      render: (value) => {
        const status = (value || "todo") as keyof typeof statusColors;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status]}`}
          >
            {status}
          </span>
        );
      },
    },
    {
      key: "assignee",
      label: "Assignee",
      sortable: true,
      width: "150px",
      render: (value) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {value || "Unassigned"}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      width: "150px",
      render: (value) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDistanceToNow(new Date(value), { addSuffix: true })}
        </span>
      ),
    },
  ];

  const tableButtons: DataTableButton[] = [
    {
      label: "New Task",
      icon: HiPlus,
      onClick: handleCreate,
      variant: "primary",
    },
  ];

  const rowButtons = (task: Task): DataTableButton[] => [
    {
      label: "View",
      icon: HiEye,
      onClick: () => handleView(task),
    },
    {
      label: "Edit",
      icon: HiPencil,
      onClick: () => handleEdit(task),
      disabled: task.archived,
    },
    {
      label: "Delete",
      icon: HiTrash,
      onClick: () => handleDelete(task),
      variant: "ghost",
    },
    {
      label: task.archived ? "Restore" : "Archive",
      icon: HiArchive,
      onClick: () => handleArchive(task),
      variant: task.archived ? "primary" : "ghost",
    },
  ];

  // ========== RENDER ==========

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold">Error loading tasks</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <BreadCrumb
        items={[{ label: "Tasks", href: "/tasks" }]}
        className="mb-4"
      />

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          Tasks
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View and manage all tasks across projects
        </p>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-4 flex justify-end">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setViewMode("table")}
            className={`rounded-l-lg px-4 py-2 text-sm font-medium ${
              viewMode === "table"
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`rounded-r-lg border-l border-gray-200 px-4 py-2 text-sm font-medium dark:border-gray-700 ${
              viewMode === "grid"
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Grid
          </button>
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        data={tasks}
        columns={columns}
        tableButtons={tableButtons}
        rowButtons={rowButtons}
        viewMode={viewMode}
        showSearch
        showFilters={false}
        showPagination
        isLoading={isLoading}
        emptyMessage="No tasks found. Create your first task to get started!"
      />
    </div>
  );
}
