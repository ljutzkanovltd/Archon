"use client";

import { useEffect, useMemo } from "react";
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
import { ProjectExpansionControls } from "@/components/Projects/ProjectExpansionControls";

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

  // Split projects into pinned and regular for organized display
  const { pinnedProjects, regularProjects } = useMemo(() => {
    const pinned = projects.filter((p) => p.pinned);
    const regular = projects.filter((p) => !p.pinned);
    return { pinnedProjects: pinned, regularProjects: regular };
  }, [projects]);

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
      key: "linked_knowledge_count",
      label: "KB Items",
      sortable: true,
      width: "100px",
      render: (value, project) => (
        <span
          className={`text-sm font-medium ${
            value && value > 0
              ? "text-purple-600 dark:text-purple-400 cursor-pointer hover:text-purple-700 dark:hover:text-purple-300"
              : "text-gray-400 dark:text-gray-600"
          }`}
          onClick={() => value && value > 0 && router.push(`/projects/${project.id}?tab=documents`)}
          title={value && value > 0 ? "Click to view linked knowledge items" : "No linked knowledge items"}
        >
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

      {/* Expansion Controls */}
      <div className="mb-4 flex justify-end">
        <ProjectExpansionControls />
      </div>

      {/* Pinned Projects Section */}
      {pinnedProjects.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              📌 Pinned Projects
            </h2>
            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-200">
              {pinnedProjects.length}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedProjects.map((project) => (
              <ProjectWithTasksCard
                key={project.id}
                project={project}
                onView={handleView}
                onEdit={handleEdit}
                onArchive={handleArchive}
                onCreateTask={handleCreateTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Projects Section */}
      {projects.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            📁 All Projects
            <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-200">
              {projects.length}
            </span>
          </h2>
        </div>
      )}

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
