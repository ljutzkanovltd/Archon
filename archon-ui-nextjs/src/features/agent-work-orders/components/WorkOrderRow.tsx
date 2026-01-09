"use client";

/**
 * Work Order Row Component
 *
 * Individual table row for a work order with status indicator, start/details buttons,
 * and expandable real-time stats section.
 * Adapted to archon-ui-nextjs patterns using Flowbite components.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "flowbite-react";
import { HiChevronDown, HiChevronUp, HiEye, HiPlay } from "react-icons/hi";
import { useAgentWorkOrdersStore } from "../state/agentWorkOrdersStore";
import type { AgentWorkOrder } from "../types";
import { RealTimeStats } from "./RealTimeStats";
import { cn } from "@/lib/utils";

export interface WorkOrderRowProps {
  /** Work order data */
  workOrder: AgentWorkOrder;

  /** Repository display name (from configured repository) */
  repositoryDisplayName?: string;

  /** Row index for alternating backgrounds */
  index: number;

  /** Callback when start button is clicked */
  onStart: (id: string) => void;

  /** Whether this row was just started (auto-expand) */
  wasJustStarted?: boolean;
}

/**
 * Status color configuration
 */
interface StatusConfig {
  color: "pink" | "info" | "success" | "warning";
  edge: string;
  glow: string;
  label: string;
  stepNumber: number;
}

const STATUS_COLORS: Record<string, StatusConfig> = {
  pending: {
    color: "pink",
    edge: "bg-pink-500 dark:bg-pink-400",
    glow: "rgba(236,72,153,0.5)",
    label: "Pending",
    stepNumber: 0,
  },
  running: {
    color: "info",
    edge: "bg-cyan-500 dark:bg-cyan-400",
    glow: "rgba(34,211,238,0.5)",
    label: "Running",
    stepNumber: 1,
  },
  completed: {
    color: "success",
    edge: "bg-green-500 dark:bg-green-400",
    glow: "rgba(34,197,94,0.5)",
    label: "Completed",
    stepNumber: 5,
  },
  failed: {
    color: "warning",
    edge: "bg-orange-500 dark:bg-orange-400",
    glow: "rgba(249,115,22,0.5)",
    label: "Failed",
    stepNumber: 0,
  },
} as const;

/**
 * Get status configuration with fallback
 */
function getStatusConfig(status: string): StatusConfig {
  return STATUS_COLORS[status] || STATUS_COLORS.pending;
}

export function WorkOrderRow({
  workOrder: cachedWorkOrder,
  repositoryDisplayName,
  index,
  onStart,
  wasJustStarted = false,
}: WorkOrderRowProps) {
  const [isExpanded, setIsExpanded] = useState(wasJustStarted);
  const router = useRouter();

  // Subscribe to live progress from Zustand SSE slice
  const liveProgress = useAgentWorkOrdersStore((s) => s.liveProgress[cachedWorkOrder.agent_work_order_id]);

  // Merge: SSE data overrides cached data
  const workOrder = {
    ...cachedWorkOrder,
    ...(liveProgress?.status && { status: liveProgress.status as AgentWorkOrder["status"] }),
  };

  const statusConfig = getStatusConfig(workOrder.status);

  const handleStartClick = () => {
    setIsExpanded(true); // Auto-expand when started
    onStart(workOrder.agent_work_order_id);
  };

  const handleDetailsClick = () => {
    router.push(`/agent-work-orders/${workOrder.agent_work_order_id}`);
  };

  const isPending = workOrder.status === "pending";
  const canExpand = !isPending; // Only non-pending rows can be expanded

  // Use display name if available, otherwise extract from URL
  const displayRepo = repositoryDisplayName || workOrder.repository_url.split("/").slice(-2).join("/");

  return (
    <>
      {/* Main row */}
      <tr
        className={cn(
          "group border-b border-gray-200 transition-all duration-200 dark:border-gray-800",
          index % 2 === 0 ? "bg-white/50 dark:bg-black/50" : "bg-gray-50/80 dark:bg-gray-900/30",
          "hover:bg-gradient-to-r hover:from-cyan-50/70 hover:to-purple-50/70 dark:hover:from-cyan-900/20 dark:hover:to-purple-900/20",
        )}
      >
        {/* Status indicator - glowing circle with optional collapse button */}
        <td className="w-12 px-3 py-2">
          <div className="flex items-center justify-center gap-1">
            {canExpand && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="rounded p-0.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label={isExpanded ? "Collapse details" : "Expand details"}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <HiChevronUp className="h-3 w-3 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                ) : (
                  <HiChevronDown className="h-3 w-3 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                )}
              </button>
            )}
            <div
              className={cn("h-3 w-3 rounded-full", statusConfig.edge)}
              style={{ boxShadow: `0 0 8px ${statusConfig.glow}` }}
            />
          </div>
        </td>

        {/* Work Order ID */}
        <td className="px-4 py-2">
          <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{workOrder.agent_work_order_id}</span>
        </td>

        {/* Repository */}
        <td className="w-40 px-4 py-2">
          <span className="text-sm text-gray-900 dark:text-white">{displayRepo}</span>
        </td>

        {/* Branch */}
        <td className="px-4 py-2">
          <p className="line-clamp-2 text-sm text-gray-900 dark:text-white">
            {workOrder.git_branch_name || <span className="text-gray-400 dark:text-gray-500">-</span>}
          </p>
        </td>

        {/* Status Badge - using Flowbite Badge */}
        <td className="w-32 px-4 py-2">
          <Badge color={statusConfig.color} size="sm">
            {statusConfig.label}
          </Badge>
        </td>

        {/* Actions */}
        <td className="w-32 px-4 py-2">
          {isPending ? (
            <Button
              onClick={handleStartClick}
              size="xs"
              color="success"
              className="w-full text-xs"
              aria-label="Start work order"
            >
              <HiPlay className="mr-1 h-3 w-3" aria-hidden="true" />
              Start
            </Button>
          ) : (
            <Button
              onClick={handleDetailsClick}
              size="xs"
              color="info"
              className="w-full text-xs"
              aria-label="View work order details"
            >
              <HiEye className="mr-1 h-3 w-3" aria-hidden="true" />
              Details
            </Button>
          )}
        </td>
      </tr>

      {/* Expanded row with real-time stats - shows live or historical data */}
      {isExpanded && canExpand && (
        <tr
          className={cn(
            "border-b border-gray-200 dark:border-gray-800",
            index % 2 === 0 ? "bg-white/50 dark:bg-black/50" : "bg-gray-50/80 dark:bg-gray-900/30",
          )}
        >
          <td colSpan={6} className="px-4 py-4">
            <RealTimeStats workOrderId={workOrder.agent_work_order_id} />
          </td>
        </tr>
      )}
    </>
  );
}
