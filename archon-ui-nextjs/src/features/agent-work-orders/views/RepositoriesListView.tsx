"use client";

/**
 * Repositories List View
 *
 * Dedicated view for managing configured repositories using DataTable.
 * Follows patterns from TasksListView and ProjectsListView.
 */

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HiPlus, HiEye, HiPencil, HiTrash, HiClipboard, HiCheckCircle, HiXCircle } from "react-icons/hi";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import { DataTable, DataTableColumn, DataTableButton, FilterConfig } from "@/components/common/DataTable";
import { formatDistanceToNow } from "date-fns";
import { RepositoryCard } from "../components";
import { useDeleteRepository, useRepositories } from "../hooks/useRepositoryQueries";
import { useAgentWorkOrdersStore } from "../state/agentWorkOrdersStore";
import type { ConfiguredRepository } from "../types/repository";

export function RepositoriesListView() {
  const router = useRouter();

  // Zustand Modal Actions
  const openAddRepoModal = useAgentWorkOrdersStore((s) => s.openAddRepoModal);
  const openEditRepoModal = useAgentWorkOrdersStore((s) => s.openEditRepoModal);

  // Fetch data
  const { data: repositories = [], isLoading: isLoadingRepos } = useRepositories();
  const deleteRepository = useDeleteRepository();

  /**
   * Copy repository URL to clipboard
   */
  const handleCopyUrl = useCallback(async (repository: ConfiguredRepository) => {
    try {
      await navigator.clipboard.writeText(repository.repository_url);
      console.log("Repository URL copied to clipboard");
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  }, []);

  /**
   * Open edit modal for repository
   */
  const handleEdit = useCallback(
    (repository: ConfiguredRepository) => {
      openEditRepoModal(repository);
    },
    [openEditRepoModal],
  );

  /**
   * Delete repository
   */
  const handleDelete = useCallback(
    async (repository: ConfiguredRepository) => {
      if (confirm(`Are you sure you want to delete repository "${repository.display_name || repository.repository_url}"?`)) {
        await deleteRepository.mutateAsync(repository.id);
      }
    },
    [deleteRepository],
  );

  // Calculate repository statistics
  const totalRepositories = repositories.length;
  const verifiedRepositories = repositories.filter((repo) => repo.is_verified).length;
  const unverifiedRepositories = repositories.filter((repo) => !repo.is_verified).length;

  /**
   * Column definitions for repositories table
   */
  const columns: DataTableColumn<ConfiguredRepository>[] = useMemo(
    () => [
      {
        key: "display_name",
        label: "Repository Name",
        sortable: true,
        render: (value, repository) => {
          const displayName = value || repository.repository_url.split("/").slice(-2).join("/");
          return (
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{displayName}</div>
              {repository.is_verified && (
                <div className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <HiCheckCircle className="h-3 w-3" aria-hidden="true" />
                  Verified
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "repository_url",
        label: "URL",
        sortable: true,
        render: (value) => (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            onClick={(e) => e.stopPropagation()}
          >
            {value}
          </a>
        ),
      },
      {
        key: "owner",
        label: "Owner",
        sortable: true,
        width: "150px",
        render: (value) => (
          <span className="text-sm text-gray-600 dark:text-gray-400">{value || "N/A"}</span>
        ),
      },
      {
        key: "is_verified",
        label: "Status",
        sortable: true,
        width: "120px",
        render: (value) => {
          const isVerified = value as boolean;
          return (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                isVerified
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {isVerified ? (
                <>
                  <HiCheckCircle className="h-3 w-3" aria-hidden="true" />
                  Verified
                </>
              ) : (
                <>
                  <HiXCircle className="h-3 w-3" aria-hidden="true" />
                  Unverified
                </>
              )}
            </span>
          );
        },
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
    ],
    [],
  );

  /**
   * Table action buttons (top-level actions)
   */
  const tableButtons: DataTableButton[] = useMemo(
    () => [
      {
        label: "Add Repository",
        icon: HiPlus,
        onClick: () => openAddRepoModal(),
        variant: "primary" as const,
        ariaLabel: "Add new repository",
      },
    ],
    [openAddRepoModal],
  );

  /**
   * Row action buttons (per repository)
   */
  const rowButtons = useCallback(
    (repository: ConfiguredRepository): DataTableButton[] => [
      {
        label: "Copy URL",
        icon: HiClipboard,
        onClick: () => handleCopyUrl(repository),
        variant: "secondary" as const,
        ariaLabel: "Copy repository URL",
      },
      {
        label: "Edit",
        icon: HiPencil,
        onClick: () => handleEdit(repository),
        variant: "secondary" as const,
        ariaLabel: `Edit repository ${repository.display_name || repository.repository_url}`,
      },
      {
        label: "Delete",
        icon: HiTrash,
        onClick: () => handleDelete(repository),
        variant: "danger" as const,
        ariaLabel: `Delete repository ${repository.display_name || repository.repository_url}`,
      },
    ],
    [handleCopyUrl, handleEdit, handleDelete],
  );

  /**
   * Filter configurations for DataTable
   */
  const filterConfigs: FilterConfig[] = useMemo(() => {
    // Extract unique owners for filter dropdown
    const uniqueOwners = Array.from(new Set(repositories.map((r) => r.owner).filter(Boolean))) as string[];

    return [
      {
        field: "is_verified",
        label: "Status",
        type: "select",
        options: [
          { label: "All Repositories", value: "" },
          { label: "Verified", value: "true" },
          { label: "Unverified", value: "false" },
        ],
      },
      {
        field: "owner",
        label: "Owner",
        type: "select",
        options: [
          { label: "All Owners", value: "" },
          ...uniqueOwners.map((owner) => ({ label: owner, value: owner })),
        ],
      },
    ];
  }, [repositories]);

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Total Repositories</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totalRepositories}</div>
        </div>
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-green-600 dark:text-green-400">Verified</div>
          <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{verifiedRepositories}</div>
        </div>
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Unverified</div>
          <div className="mt-1 text-2xl font-bold text-gray-600 dark:text-gray-400">{unverifiedRepositories}</div>
        </div>
      </div>

      {/* Repositories DataTable */}
      <DataTable
        data={repositories}
        columns={columns}
        tableButtons={tableButtons}
        rowButtons={rowButtons}
        tableId="archon-repositories-list"
        enableMultiSort={true}
        showPrimaryAction={true}
        viewMode="table"
        customRender={(repository) => (
          <RepositoryCard
            repository={repository}
            onDelete={() => handleDelete(repository)}
          />
        )}
        showSearch={true}
        filterConfigs={filterConfigs}
        showViewToggle={true}
        showFilters={true}
        showPagination={true}
        isLoading={isLoadingRepos}
        emptyMessage="No repositories configured. Add a repository to get started!"
        caption={`List of ${repositories.length} repositories`}
        keyExtractor={(repository) => repository.id}
        onRowClick={handleEdit}
      />
    </div>
  );
}
