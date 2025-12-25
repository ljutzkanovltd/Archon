"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiPlus, HiEye, HiPencil, HiArchive } from "react-icons/hi";
import { DataTable, DataTableColumn, DataTableButton } from "@/components/common/DataTable";
import { ProjectWithTasksCard } from "@/components/Projects/ProjectWithTasksCard";
import { useProjectStore } from "@/store/useProjectStore";
import { usePageTitle } from "@/hooks";
import { Project } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

export default function ProjectsPage() {
  usePageTitle("Projects", "Archon");

  const router = useRouter();
  const {
    projects,
    fetchProjects,
    archiveProject,
    unarchiveProject,
    isLoading,
    error,
    pagination,
  } = useProjectStore();

  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Fetch projects on mount
  useEffect(() => {
    console.log('[Projects Page] Mounting, fetching projects...');
    console.log('[Projects Page] Current projects count:', projects.length);
    console.log('[Projects Page] Is loading:', isLoading);
    console.log('[Projects Page] Error:', error);
    fetchProjects({ per_page: 10 });
  }, [fetchProjects]);

  // Debug: Log when state changes
  useEffect(() => {
    console.log('[Projects Page] State updated - Projects:', projects.length, 'Loading:', isLoading, 'Error:', error);
  }, [projects, isLoading, error]);

  // ========== HANDLERS ==========

  const handleView = (project: Project) => {
    router.push(`/projects/${project.id}`);
  };

  const handleEdit = (project: Project) => {
    router.push(`/projects/${project.id}/edit`);
  };

  const handleArchive = async (project: Project) => {
    if (project.archived) {
      await unarchiveProject(project.id);
    } else {
      await archiveProject(project.id, "User");
    }
    // Refresh list
    await fetchProjects({ per_page: pagination.per_page });
  };

  const handleCreate = () => {
    router.push("/projects/new");
  };

  const handleCreateTask = (projectId: string) => {
    router.push(`/projects/${projectId}/tasks/new`);
  };

  // ========== TABLE CONFIGURATION ==========

  const columns: DataTableColumn<Project>[] = [
    {
      key: "title",
      label: "Project Name",
      sortable: true,
      render: (value, project) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {value}
          </div>
          {project.archived && (
            <span className="text-xs text-gray-500">Archived</span>
          )}
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (value) => (
        <div className="max-w-md truncate text-sm text-gray-600 dark:text-gray-400">
          {value || "No description"}
        </div>
      ),
    },
    {
      key: "task_count",
      label: "Tasks",
      sortable: true,
      width: "100px",
      render: (value) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {value || 0}
        </span>
      ),
    },
    {
      key: "document_count",
      label: "Documents",
      sortable: true,
      width: "120px",
      render: (value) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {value || 0}
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
      label: "New Project",
      icon: HiPlus,
      onClick: handleCreate,
      variant: "primary",
    },
  ];

  const rowButtons = (project: Project): DataTableButton[] => [
    {
      label: "View",
      icon: HiEye,
      onClick: () => handleView(project),
    },
    {
      label: "Edit",
      icon: HiPencil,
      onClick: () => handleEdit(project),
      disabled: project.archived,
    },
    {
      label: project.archived ? "Restore" : "Archive",
      icon: HiArchive,
      onClick: () => handleArchive(project),
      variant: project.archived ? "primary" : "ghost",
    },
  ];

  // ========== RENDER ==========

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold">Error loading projects</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          Projects
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your projects and track progress
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
        data={projects}
        columns={columns}
        tableButtons={tableButtons}
        rowButtons={rowButtons}
        viewMode={viewMode}
        customRender={(project) => (
          <ProjectWithTasksCard
            project={project}
            onView={handleView}
            onEdit={handleEdit}
            onArchive={handleArchive}
            onCreateTask={handleCreateTask}
          />
        )}
        showSearch
        showFilters={false}
        showPagination
        isLoading={isLoading}
        emptyMessage="No projects found. Create your first project to get started!"
        totalItems={pagination.total}
        initialPage={pagination.page}
        initialPerPage={pagination.per_page}
      />
    </div>
  );
}
