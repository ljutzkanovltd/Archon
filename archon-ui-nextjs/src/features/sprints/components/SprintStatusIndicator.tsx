"use client";

import { SprintStatus } from "@/lib/types";
import { Badge } from "flowbite-react";

interface SprintStatusIndicatorProps {
  status: SprintStatus;
  className?: string;
}

/**
 * SprintStatusIndicator - Visual indicator for sprint status
 *
 * Displays sprint status with color-coded badge:
 * - planned: gray (not started)
 * - active: blue (currently running)
 * - completed: green (finished)
 * - cancelled: red (abandoned)
 *
 * Usage:
 * ```tsx
 * <SprintStatusIndicator status="active" />
 * ```
 */
export function SprintStatusIndicator({
  status,
  className = "",
}: SprintStatusIndicatorProps) {
  const statusConfig = {
    planned: {
      color: "gray" as const,
      label: "Planned",
    },
    active: {
      color: "info" as const,
      label: "Active",
    },
    completed: {
      color: "success" as const,
      label: "Completed",
    },
    cancelled: {
      color: "failure" as const,
      label: "Cancelled",
    },
  };

  const config = statusConfig[status];

  return (
    <Badge color={config.color} className={className}>
      {config.label}
    </Badge>
  );
}
