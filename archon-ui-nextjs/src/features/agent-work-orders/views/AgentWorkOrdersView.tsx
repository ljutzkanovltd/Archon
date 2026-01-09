"use client";

/**
 * Agent Work Orders View
 *
 * Main view for agent work orders using DataTable with integrated search and filters.
 * Simplified from dual-layout system to use DataTable's built-in filtering.
 * Adapted to archon-ui-nextjs patterns using Flowbite components.
 */

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HiPlus, HiEye, HiTrash, HiPlay, HiStop } from "react-icons/hi";
import { DataTable, DataTableColumn, DataTableButton, FilterConfig } from "@/components/common/DataTable";
import { formatDistanceToNow } from "date-fns";
import { WorkOrderCard } from "../components";
import { useStartWorkOrder, useWorkOrders } from "../hooks/useAgentWorkOrderQueries";
import { useRepositories } from "../hooks/useRepositoryQueries";
import { useAgentWorkOrdersStore } from "../state/agentWorkOrdersStore";
import type { AgentWorkOrder } from "../types";

export function AgentWorkOrdersView() {
  const router = useRouter();

  // Zustand Modal Actions
  const openCreateWorkOrderModal = useAgentWorkOrdersStore((s) => s.openCreateWorkOrderModal);

  // Fetch data
  const { data: repositories = [] } = useRepositories();
  const { data: workOrders = [], isLoading: isLoadingWorkOrders } = useWorkOrders();
  const startWorkOrder = useStartWorkOrder();

  /**
   * Navigate to work order detail view
   */
  const handleViewWorkOrder = useCallback(
    (workOrder: AgentWorkOrder) => {
      router.push(`/agent-work-orders/${workOrder.agent_work_order_id}`);
    },
    [router],
  );

  /**
   * Start a work order
   */
  const handleStartWorkOrder = useCallback(
    (workOrder: AgentWorkOrder) => {
      startWorkOrder.mutate(workOrder.agent_work_order_id);
    },
    [startWorkOrder],
  );

  /**
   * Delete a work order (placeholder - needs implementation)
   */
  const handleDeleteWorkOrder = useCallback(
    async (workOrder: AgentWorkOrder) => {
      if (confirm(`Are you sure you want to delete work order ${workOrder.agent_work_order_id}?`)) {
        // TODO: Implement delete mutation
        console.log("Delete work order:", workOrder.agent_work_order_id);
      }
    },
    [],
  );

  // Calculate work order statistics
  const totalWorkOrders = workOrders.length;
  const activeWorkOrders = workOrders.filter((wo) => wo.status === "running" || wo.status === "pending").length;
  const completedWorkOrders = workOrders.filter((wo) => wo.status === "completed").length;
  const failedWorkOrders = workOrders.filter((wo) => wo.status === "failed").length;

  /**
   * Column definitions for work orders table
   */
  const columns: DataTableColumn<AgentWorkOrder>[] = useMemo(
    () => [
      {
        key: "agent_work_order_id",
        label: "Work Order ID",
        sortable: true,
        width: "200px",
        render: (value) => (
          <div className="font-mono text-sm font-medium text-gray-900 dark:text-white">{value}</div>
        ),
      },
      {
        key: "repository_url",
        label: "Repository",
        sortable: true,
        render: (value) => {
          const repoName = value.split("/").slice(-2).join("/");
          return <span className="text-sm text-gray-600 dark:text-gray-400">{repoName}</span>;
        },
      },
      {
        key: "git_branch_name",
        label: "Branch",
        sortable: true,
        width: "150px",
        render: (value) => (
          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{value || "N/A"}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        width: "120px",
        render: (value) => {
          const statusColors = {
            pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
            running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
            completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
            failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
          };
          const colorClass = statusColors[value as keyof typeof statusColors] || statusColors.pending;
          return (
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${colorClass}`}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
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
        label: "New Work Order",
        icon: HiPlus,
        onClick: () => openCreateWorkOrderModal(),
        variant: "primary" as const,
        ariaLabel: "Create new work order",
      },
    ],
    [openCreateWorkOrderModal],
  );

  /**
   * Row action buttons (per work order)
   */
  const rowButtons = useCallback(
    (workOrder: AgentWorkOrder): DataTableButton[] => {
      const canStart = workOrder.status === "pending" || workOrder.status === "failed";
      const isRunning = workOrder.status === "running";

      return [
        {
          label: "View",
          icon: HiEye,
          onClick: () => handleViewWorkOrder(workOrder),
          variant: "secondary" as const,
          ariaLabel: `View work order ${workOrder.agent_work_order_id}`,
        },
        ...(canStart
          ? [
              {
                label: "Start",
                icon: HiPlay,
                onClick: () => handleStartWorkOrder(workOrder),
                variant: "primary" as const,
                ariaLabel: "Start work order",
              },
            ]
          : []),
        ...(isRunning
          ? [
              {
                label: "Stop",
                icon: HiStop,
                onClick: () => console.log("Stop work order:", workOrder.agent_work_order_id),
                variant: "danger" as const,
                ariaLabel: "Stop work order",
              },
            ]
          : []),
        {
          label: "Delete",
          icon: HiTrash,
          onClick: () => handleDeleteWorkOrder(workOrder),
          variant: "danger" as const,
          ariaLabel: `Delete work order ${workOrder.agent_work_order_id}`,
        },
      ];
    },
    [handleViewWorkOrder, handleStartWorkOrder, handleDeleteWorkOrder],
  );

  /**
   * Filter configurations for DataTable
   */
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        field: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "All Statuses", value: "" },
          { label: "Pending", value: "pending" },
          { label: "Running", value: "running" },
          { label: "Completed", value: "completed" },
          { label: "Failed", value: "failed" },
        ],
      },
      {
        field: "repository_url",
        label: "Repository",
        type: "multiselect",
        options: repositories.map((repo) => ({
          label: repo.display_name || repo.repository_url.split("/").slice(-2).join("/"),
          value: repo.repository_url,
        })),
      },
      {
        field: "git_branch_name",
        label: "Branch",
        type: "text",
        placeholder: "Filter by branch name...",
      },
    ],
    [repositories],
  );

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totalWorkOrders}</div>
        </div>
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-blue-600 dark:text-blue-400">Active</div>
          <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{activeWorkOrders}</div>
        </div>
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-green-600 dark:text-green-400">Completed</div>
          <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{completedWorkOrders}</div>
        </div>
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-red-600 dark:text-red-400">Failed</div>
          <div className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{failedWorkOrders}</div>
        </div>
      </div>

      {/* Work Orders DataTable */}
      <div>
        <DataTable
          data={workOrders}
          columns={columns}
          tableButtons={tableButtons}
          rowButtons={rowButtons}
          tableId="archon-work-orders"
          enableMultiSort={true}
          showPrimaryAction={true}
          viewMode="table"
          customRender={(workOrder) => (
            <WorkOrderCard
              workOrder={workOrder}
              onView={handleViewWorkOrder}
              onStart={handleStartWorkOrder}
              onDelete={handleDeleteWorkOrder}
            />
          )}
          showSearch={true}
          filterConfigs={filterConfigs}
          showViewToggle={true}
          showFilters={true}
          showPagination={true}
          isLoading={isLoadingWorkOrders}
          emptyMessage="No work orders found. Create your first work order to get started!"
          caption={`List of ${workOrders.length} work orders`}
          keyExtractor={(workOrder) => workOrder.agent_work_order_id}
          onRowClick={handleViewWorkOrder}
        />
      </div>
    </div>
  );
}
