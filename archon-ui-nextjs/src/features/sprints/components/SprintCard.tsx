"use client";

import { Sprint } from "@/lib/types";
import { Card } from "flowbite-react";
import { SprintStatusIndicator } from "./SprintStatusIndicator";
import { format } from "date-fns";
import { HiCalendar, HiFlag } from "react-icons/hi";

interface SprintCardProps {
  sprint: Sprint;
  onStart?: (sprintId: string) => void;
  onComplete?: (sprintId: string) => void;
  onClick?: (sprint: Sprint) => void;
  className?: string;
}

/**
 * SprintCard - Display sprint information in a card layout
 *
 * Shows sprint details including:
 * - Name and goal
 * - Status badge
 * - Start/end dates
 * - Action buttons based on status
 *
 * Usage:
 * ```tsx
 * <SprintCard
 *   sprint={sprint}
 *   onStart={handleStart}
 *   onComplete={handleComplete}
 *   onClick={handleClick}
 * />
 * ```
 */
export function SprintCard({
  sprint,
  onStart,
  onComplete,
  onClick,
  className = "",
}: SprintCardProps) {
  const startDate = format(new Date(sprint.start_date), "MMM d, yyyy");
  const endDate = format(new Date(sprint.end_date), "MMM d, yyyy");

  return (
    <Card
      className={`cursor-pointer transition-shadow hover:shadow-lg ${className}`}
      onClick={() => onClick?.(sprint)}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {sprint.name}
          </h3>
          {sprint.goal && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              <HiFlag className="mr-1 inline h-4 w-4" />
              {sprint.goal}
            </p>
          )}
        </div>
        <SprintStatusIndicator status={sprint.status} />
      </div>

      {/* Dates */}
      <div className="mt-4 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center">
          <HiCalendar className="mr-2 h-4 w-4" />
          <span>
            {startDate} → {endDate}
          </span>
        </div>
      </div>

      {/* Velocity (if available) */}
      {sprint.velocity !== undefined && sprint.velocity !== null && (
        <div className="mt-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Velocity:</span>{" "}
          <span className="font-medium text-gray-900 dark:text-white">
            {sprint.velocity} points
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex gap-2">
        {sprint.status === "planned" && onStart && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStart(sprint.id);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          >
            Start Sprint
          </button>
        )}
        {sprint.status === "active" && onComplete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onComplete(sprint.id);
            }}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-300 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800"
          >
            Complete Sprint
          </button>
        )}
      </div>
    </Card>
  );
}
