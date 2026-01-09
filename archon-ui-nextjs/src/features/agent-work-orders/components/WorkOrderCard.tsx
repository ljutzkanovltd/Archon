"use client";

/**
 * WorkOrderCard Component
 *
 * Card component for displaying agent work orders in grid/compact views.
 * Follows TaskCard design patterns with status-specific styling.
 */

import { Badge, Tooltip } from "flowbite-react";
import {
  HiEye,
  HiTrash,
  HiPlay,
  HiStop,
  HiPencil,
  HiClipboard,
} from "react-icons/hi";
import { formatDistanceToNow } from "date-fns";
import type { AgentWorkOrder } from "../types";

export interface WorkOrderCardProps {
  workOrder: AgentWorkOrder;
  onView?: (workOrder: AgentWorkOrder) => void;
  onStart?: (workOrder: AgentWorkOrder) => void;
  onStop?: (workOrder: AgentWorkOrder) => void;
  onEdit?: (workOrder: AgentWorkOrder) => void;
  onDelete?: (workOrder: AgentWorkOrder) => void;
  compact?: boolean;
  variant?: "default" | "grid";
}

/**
 * Status badge color mapping
 */
const statusColors = {
  pending: "gray",
  running: "blue",
  completed: "success",
  failed: "failure",
} as const;

/**
 * WorkOrderCard component following SportERP card pattern
 *
 * Features:
 * - Status badge with color coding (pending/running/completed/failed)
 * - Repository and branch information
 * - Action buttons (View, Start/Stop, Edit, Delete)
 * - Hover effects with shadow and background transition
 * - Responsive design
 */
export function WorkOrderCard({
  workOrder,
  onView,
  onStart,
  onStop,
  onEdit,
  onDelete,
  compact = false,
  variant = "default",
}: WorkOrderCardProps) {
  const formattedCreatedAt = formatDistanceToNow(new Date(workOrder.created_at), {
    addSuffix: true,
  });

  const repoName = workOrder.repository_url.split("/").slice(-2).join("/");
  const isRunning = workOrder.status === "running";
  const canStart = workOrder.status === "pending" || workOrder.status === "failed";

  // Status-specific border color and glow
  const statusStyles = {
    pending: {
      border: "border-l-gray-500 dark:border-l-gray-400",
      glow: "shadow-[0_0_15px_rgba(107,114,128,0.2)] dark:shadow-[0_0_15px_rgba(156,163,175,0.4)]",
    },
    running: {
      border: "border-l-blue-500 dark:border-l-blue-400",
      glow: "shadow-[0_0_15px_rgba(59,130,246,0.2)] dark:shadow-[0_0_15px_rgba(59,130,246,0.4)]",
    },
    completed: {
      border: "border-l-green-500 dark:border-l-green-400",
      glow: "shadow-[0_0_15px_rgba(34,197,94,0.2)] dark:shadow-[0_0_15px_rgba(34,197,94,0.4)]",
    },
    failed: {
      border: "border-l-red-500 dark:border-l-red-400",
      glow: "shadow-[0_0_15px_rgba(239,68,68,0.2)] dark:shadow-[0_0_15px_rgba(239,68,68,0.4)]",
    },
  }[workOrder.status];

  // Copy work order ID to clipboard
  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(workOrder.agent_work_order_id);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = workOrder.agent_work_order_id;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  // Compact mode for inline display
  if (compact) {
    return (
      <div className="group rounded-lg border border-gray-200 bg-white p-3 transition-all duration-200 hover:border-brand-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-400">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-mono text-sm font-semibold text-gray-900 dark:text-white">
              {workOrder.agent_work_order_id}
            </h4>
            <div className="mt-1 flex items-center gap-2">
              <Badge color={statusColors[workOrder.status]} size="xs">
                {workOrder.status.charAt(0).toUpperCase() + workOrder.status.slice(1)}
              </Badge>
              <span className="truncate text-xs text-gray-600 dark:text-gray-400">
                {repoName}
              </span>
            </div>
            {workOrder.git_branch_name && (
              <p className="mt-1 truncate font-mono text-xs text-gray-500 dark:text-gray-400">
                {workOrder.git_branch_name}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid mode - compact card for grid view
  if (variant === "grid") {
    return (
      <div
        className={`group rounded-lg border-l-[3px] ${statusStyles.border} border border-gray-200 bg-white p-2.5 transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 cursor-pointer`}
        onClick={() => onView?.(workOrder)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onView?.(workOrder);
          }
        }}
        aria-label={`Work Order: ${workOrder.agent_work_order_id}. Status: ${workOrder.status}. Repository: ${repoName}. Click to view.`}
      >
        {/* Title - single line, truncated */}
        <h4 className="mb-1.5 truncate font-mono text-sm font-semibold text-gray-900 dark:text-white" title={workOrder.agent_work_order_id}>
          {workOrder.agent_work_order_id}
        </h4>
        {/* Status + Repository badges */}
        <div className="flex items-center gap-1.5">
          <Badge color={statusColors[workOrder.status]} size="xs">
            {workOrder.status}
          </Badge>
          <span className="truncate text-xs text-gray-600 dark:text-gray-400" title={repoName}>
            {repoName}
          </span>
        </div>
      </div>
    );
  }

  // Full mode for detailed work order cards (default)
  return (
    <div className={`relative group max-w-full min-h-[100px] rounded-lg overflow-hidden border-l-[3px] ${statusStyles.border} border-2 border-gray-200 dark:border-gray-700 transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg bg-white dark:bg-gray-800`}>
      {/* Content container */}
      <div className="relative flex flex-col h-full p-4">
        {/* Header with repository badge and action buttons */}
        <div className="flex items-center gap-1.5 mb-2">
          {/* Repository badge */}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium transition-opacity duration-200 hover:opacity-80">
            {repoName}
          </span>

          {/* Action buttons group (ml-auto pushes to right) */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Copy ID Button */}
            <Tooltip content="Copy Work Order ID" style="light" trigger="hover">
              <button
                type="button"
                onClick={handleCopyId}
                className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-2 focus:ring-brand-500"
                aria-label="Copy Work Order ID"
              >
                <HiClipboard className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">Copy Work Order ID</span>
              </button>
            </Tooltip>

            {/* View Button */}
            {onView && (
              <Tooltip content="View details" style="light" trigger="hover">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(workOrder);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-800/40 focus:ring-2 focus:ring-brand-500"
                  aria-label={`View ${workOrder.agent_work_order_id}`}
                >
                  <HiEye className="w-3 h-3" aria-hidden="true" />
                  <span className="sr-only">View {workOrder.agent_work_order_id}</span>
                </button>
              </Tooltip>
            )}

            {/* Start Button (for pending/failed work orders) */}
            {onStart && canStart && (
              <Tooltip content="Start work order" style="light" trigger="hover">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStart(workOrder);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/40 focus:ring-2 focus:ring-brand-500"
                  aria-label="Start work order"
                >
                  <HiPlay className="w-3 h-3" aria-hidden="true" />
                  <span className="sr-only">Start work order</span>
                </button>
              </Tooltip>
            )}

            {/* Stop Button (for running work orders) */}
            {onStop && isRunning && (
              <Tooltip content="Stop work order" style="light" trigger="hover">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStop(workOrder);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40 focus:ring-2 focus:ring-brand-500"
                  aria-label="Stop work order"
                >
                  <HiStop className="w-3 h-3" aria-hidden="true" />
                  <span className="sr-only">Stop work order</span>
                </button>
              </Tooltip>
            )}

            {/* Delete Button */}
            {onDelete && (
              <Tooltip content="Delete work order" style="light" trigger="hover">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(workOrder);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40 focus:ring-2 focus:ring-brand-500"
                  aria-label={`Delete ${workOrder.agent_work_order_id}`}
                >
                  <HiTrash className="w-3 h-3" aria-hidden="true" />
                  <span className="sr-only">Delete {workOrder.agent_work_order_id}</span>
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="mb-2 font-mono text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 overflow-hidden leading-tight" title={workOrder.agent_work_order_id}>
          {workOrder.agent_work_order_id}
        </h4>

        {/* Current Phase / Error Message */}
        {(workOrder.current_phase || workOrder.error_message) && (
          <div className="mb-2 flex-1">
            {workOrder.error_message && (
              <p className="text-sm text-red-600 dark:text-red-400">{workOrder.error_message}</p>
            )}
            {workOrder.current_phase && !workOrder.error_message && (
              <p className="text-sm text-gray-600 dark:text-gray-400">Phase: {workOrder.current_phase}</p>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Footer with branch and created date */}
        <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-gray-200 dark:border-gray-700">
          {/* Branch badge */}
          <div className="flex items-center gap-1.5">
            {workOrder.git_branch_name && (
              <Badge color="gray" size="xs">
                <span className="font-mono">{workOrder.git_branch_name}</span>
              </Badge>
            )}
          </div>

          {/* Status badge */}
          <Badge color={statusColors[workOrder.status]} size="xs">
            {workOrder.status.charAt(0).toUpperCase() + workOrder.status.slice(1)}
          </Badge>
        </div>

        {/* Created date */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Created {formattedCreatedAt}
        </div>
      </div>
    </div>
  );
}

/**
 * WorkOrderCardSkeleton - Loading placeholder
 */
export function WorkOrderCardSkeleton() {
  return (
    <div className="max-w-full animate-pulse rounded-lg border-l-[3px] border-l-gray-300 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      {/* Header Skeleton */}
      <div className="mb-2 flex items-center justify-between">
        <div className="h-5 w-32 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex gap-1.5">
          <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      {/* Title Skeleton */}
      <div className="mb-2 h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />

      {/* Description Skeleton */}
      <div className="mb-2 space-y-2">
        <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Footer Skeleton */}
      <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2.5 dark:border-gray-700">
        <div className="h-4 w-24 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}
