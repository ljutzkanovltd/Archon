"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HiPlus, HiEye, HiPencil, HiTrash, HiArchive } from "react-icons/hi";
import { tasksApi } from "@/lib/apiClient";
import { Task } from "@/lib/types";
import { TaskCard } from "@/components/Tasks/TaskCard";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import { DataTable, DataTableColumn, DataTableButton, FilterConfig } from "@/components/common/DataTable";
import { usePageTitle } from "@/hooks";
import { formatDistanceToNow } from "date-fns";

/**
 * TasksListView - List view for all tasks
 *
 * Features:
 * - DataTable with table/grid views
 * - Search by title/description
 * - Filters: status, project, assignee, priority
 * - URL query params support
 * - Row click navigates to task detail
 * - Task actions (view, edit, delete, archive)
 */
export function TasksListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  usePageTitle("Tasks", "Archon");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tasks on mount
  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await tasksApi.getAll({
        per_page: 1000,
        include_closed: true,
      });

      if (response.success && response.items) {
        setTasks(response.items);
      } else {
        setError("Failed to load tasks");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  // ========== HANDLERS ==========

  const handleView = (task: Task) => {
    router.push(`/tasks/${task.id}`);
  };

  const handleEdit = (task: Task) => {
    // TODO: Implement edit modal or navigate to edit page
    alert(`Edit task: ${task.title}`);
  };

  const handleDelete = async (task: Task) => {
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) {
      return;
    }

    try {
      await tasksApi.delete(task.id);
      alert("Task deleted successfully!");
      await loadTasks();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  const handleArchive = async (task: Task) => {
    try {
      if (task.archived) {
        await tasksApi.unarchive(task.id);
      } else {
        await tasksApi.archive(task.id, "User");
      }
      await loadTasks();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive/unarchive task");
    }
  };

  const handleCreateTask = () => {
    // TODO: Implement create task modal
    alert("Create task functionality - coming soon!");
  };

  const handleStatusChange = async (task: Task, newStatus: Task["status"]) => {
    try {
      await tasksApi.update(task.id, { status: newStatus });
      await loadTasks();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update task status");
    }
  };

  const handleAssigneeChange = async (task: Task, newAssignee: string) => {
    try {
      await tasksApi.update(task.id, { assignee: newAssignee });
      await loadTasks();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update task assignee");
    }
  };

  // ========== DATATABLE CONFIGURATION ==========

  /**
   * Status badge component
   */
  const StatusBadge = ({ status }: { status: Task["status"] }) => {
    const colors = {
      todo: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      doing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    };

    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  /**
   * Priority badge component
   */
  const PriorityBadge = ({ priority }: { priority: string }) => {
    const colors = {
      low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
      urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    };

    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colors[priority as keyof typeof colors] || colors.medium}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

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
          {task.feature && (
            <div className="text-xs text-purple-600 dark:text-purple-400">
              {task.feature}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "project_id",
      label: "Project",
      sortable: false,
      width: "150px",
      render: (value) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {value ? value.substring(0, 8) + "..." : "N/A"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      width: "120px",
      render: (value) => <StatusBadge status={value as Task["status"]} />,
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
      key: "priority",
      label: "Priority",
      sortable: true,
      width: "110px",
      render: (value) => <PriorityBadge priority={value} />,
    },
    {
      key: "estimated_hours",
      label: "Est. Hours",
      sortable: true,
      width: "100px",
      render: (value) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {value ? `${value}h` : "N/A"}
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
          {value ? formatDistanceToNow(new Date(value), { addSuffix: true }) : "N/A"}
        </span>
      ),
    },
  ];

  const tableButtons: DataTableButton[] = [
    {
      label: "New Task",
      icon: HiPlus,
      onClick: handleCreateTask,
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
    },
    {
      label: task.archived ? "Restore" : "Archive",
      icon: HiArchive,
      onClick: () => handleArchive(task),
    },
    {
      label: "Delete",
      icon: HiTrash,
      onClick: () => handleDelete(task),
      variant: "ghost",
    },
  ];

  // Get unique values for filters
  const statusOptions = useMemo(() => {
    return [
      { value: "todo", label: "To Do" },
      { value: "doing", label: "Doing" },
      { value: "review", label: "Review" },
      { value: "done", label: "Done" },
    ];
  }, []);

  const assigneeOptions = useMemo(() => {
    const assignees = [...new Set(tasks.map(t => t.assignee).filter(Boolean))];
    return assignees.map(assignee => ({ value: assignee, label: assignee }));
  }, [tasks]);

  const priorityOptions = useMemo(() => {
    return [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "urgent", label: "Urgent" },
    ];
  }, []);

  const filterConfigs: FilterConfig[] = [
    {
      field: "status",
      label: "Status",
      type: "select",
      options: statusOptions,
    },
    {
      field: "assignee",
      label: "Assignee",
      type: "select",
      options: assigneeOptions,
    },
    {
      field: "priority",
      label: "Priority",
      type: "select",
      options: priorityOptions,
    },
    {
      field: "archived",
      label: "Show Archived",
      type: "boolean",
    },
  ];

  // ========== RENDER ==========

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold">Error loading tasks</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={loadTasks}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
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
          Manage and track all your tasks across projects
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Total Tasks</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {tasks.length}
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">In Progress</div>
          <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {tasks.filter(t => t.status === "doing").length}
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">In Review</div>
          <div className="mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {tasks.filter(t => t.status === "review").length}
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
          <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
            {tasks.filter(t => t.status === "done").length}
          </div>
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        data={tasks}
        columns={columns}
        tableButtons={tableButtons}
        rowButtons={rowButtons}
        tableId="archon-tasks-list"
        enableMultiSort={true}
        showPrimaryAction={true}
        viewMode="table"
        customRender={(task) => (
          <TaskCard
            task={task}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onStatusChange={handleStatusChange}
            onAssigneeChange={handleAssigneeChange}
          />
        )}
        showSearch
        filterConfigs={filterConfigs}
        showViewToggle={true}
        showFilters={true}
        showPagination
        isLoading={isLoading}
        emptyMessage="No tasks found. Create your first task to get started!"
        caption={`List of ${tasks.length} tasks`}
        keyExtractor={(task) => task.id}
        onRowClick={handleView}
      />
    </div>
  );
}
