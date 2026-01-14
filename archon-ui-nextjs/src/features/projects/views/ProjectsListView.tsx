"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HiPlus, HiEye, HiPencil, HiArchive, HiTrash } from "react-icons/hi";
import { DataTable, DataTableColumn, DataTableButton, FilterConfig } from "@/components/common/DataTable";
import { ProjectWithTasksCard } from "@/components/Projects/ProjectWithTasksCard";
import { useProjectStore } from "@/store/useProjectStore";
import { usePageTitle } from "@/hooks";
import { Project } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import { ProjectHeader } from "../components";

/**
 * ProjectsListView - List view for projects with DataTable integration
 *
 * Features:
 * - Table and grid view modes
 * - Search and filtering
 * - Sorting by title, created date
 * - Row actions (view, edit, archive)
 * - Pagination
 */
export function ProjectsListView() {
  usePageTitle("Projects", "Archon");

  const router = useRouter();
  const {
    projects,
    fetchProjects,
    archiveProject,
    unarchiveProject,
    deleteProject,
    isLoading,
    error,
    pagination,
  } = useProjectStore();

  // Fetch all projects on mount (active + archived) - filtering handled by DataTable
  useEffect(() => {
    fetchProjects({ per_page: 1000, include_archived: true });
  }, [fetchProjects]);

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
    // Refresh list - load all projects
    await fetchProjects({
      per_page: 1000,
      include_archived: true,
    });
  };

  const handleDelete = async (project: Project) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.title}"?\n\nThis action cannot be undone and will permanently delete the project and all associated data.`
    );

    if (confirmed) {
      await deleteProject(project.id);
      // Refresh list - load all projects
      await fetchProjects({
        per_page: 1000,
        include_archived: true,
      });
    }
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
      ariaLabel: `View ${project.title} details`,
    },
    {
      label: "Edit",
      icon: HiPencil,
      onClick: () => handleEdit(project),
      disabled: project.archived,
      ariaLabel: `Edit ${project.title}`,
    },
    {
      label: project.archived ? "Restore" : "Archive",
      icon: HiArchive,
      onClick: () => handleArchive(project),
      variant: project.archived ? "primary" : "ghost",
      ariaLabel: project.archived ? `Restore ${project.title}` : `Archive ${project.title}`,
    },
    {
      label: "Delete",
      icon: HiTrash,
      onClick: () => handleDelete(project),
      variant: "danger",
      ariaLabel: `Delete ${project.title}`,
    },
  ];

  // Filter configuration - use select for clearer UX
  const filterConfigs: FilterConfig[] = [
    {
      field: "archived",
      label: "Status",
      type: "select",
      options: [
        { value: "all", label: "All Projects" },
        { value: "false", label: "Active Only" },
        { value: "true", label: "Archived Only" },
      ],
    },
  ];

  // ========== RENDER ==========

  if (error) {
    return (
      <div className="p-8">
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          <p className="font-semibold">Error loading projects</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <BreadCrumb
        items={[{ label: "Projects", href: "/projects" }]}
        className="mb-4"
      />

      {/* Page Header */}
      <ProjectHeader
        mode="list"
        title="Projects"
        description="Manage your projects and track progress"
      />

      {/* DataTable */}
      <DataTable
        data={projects}
        columns={columns}
        tableButtons={tableButtons}
        rowButtons={rowButtons}
        tableId="archon-projects-list"
        enableMultiSort={true}
        showPrimaryAction={true}
        viewMode="table"
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
        filterConfigs={filterConfigs}
        showViewToggle={true}
        showFilters={true}
        showPagination
        isLoading={isLoading}
        emptyMessage="No projects found. Create your first project to get started!"
        caption={`List of ${projects.length} projects`}
        totalItems={pagination.total}
        initialPage={pagination.page}
        initialPerPage={pagination.per_page}
      />
    </div>
  );
}
