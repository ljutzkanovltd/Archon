"use client";

import { HiCheckCircle, HiClock, HiTrendingUp, HiTrendingDown, HiMinus } from "react-icons/hi";
import { format, parseISO, differenceInDays } from "date-fns";

interface SprintSummaryProps {
  sprintName: string;
  sprintStatus: "planned" | "active" | "completed";
  startDate: string;
  endDate: string;
  totalTasks: number;
  completedTasks: number;
  totalPoints?: number;
  completedPoints?: number;
  velocityTrend?: "up" | "down" | "stable" | null;
  className?: string;
}

/**
 * SprintSummary Component
 *
 * Phase 3.9: Sprint statistics summary card
 *
 * Features:
 * - Sprint metadata (name, status, dates)
 * - Task completion stats
 * - Points completion stats (optional)
 * - Velocity trend indicator
 * - Progress percentages
 * - Status-based color coding
 * - Responsive layout
 *
 * Usage:
 * ```tsx
 * <SprintSummary
 *   sprintName="Sprint 1"
 *   sprintStatus="active"
 *   startDate="2024-01-15"
 *   endDate="2024-01-29"
 *   totalTasks={15}
 *   completedTasks={8}
 *   totalPoints={42}
 *   completedPoints={28}
 *   velocityTrend="up"
 * />
 * ```
 */
export function SprintSummary({
  sprintName,
  sprintStatus,
  startDate,
  endDate,
  totalTasks,
  completedTasks,
  totalPoints,
  completedPoints,
  velocityTrend,
  className = "",
}: SprintSummaryProps) {
  const taskCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const pointsCompletion =
    totalPoints && totalPoints > 0 && completedPoints !== undefined
      ? Math.round((completedPoints / totalPoints) * 100)
      : null;

  const daysRemaining = differenceInDays(parseISO(endDate), new Date());
  const totalDays = differenceInDays(parseISO(endDate), parseISO(startDate));

  const statusColors = {
    planned: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    active: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
  };

  const getTrendIcon = () => {
    if (velocityTrend === "up") {
      return <HiTrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />;
    } else if (velocityTrend === "down") {
      return <HiTrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />;
    } else if (velocityTrend === "stable") {
      return <HiMinus className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
    }
    return null;
  };

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {sprintName}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {format(parseISO(startDate), "MMM dd")} - {format(parseISO(endDate), "MMM dd, yyyy")}
          </p>
        </div>
        <div>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusColors[sprintStatus]}`}>
            {sprintStatus.charAt(0).toUpperCase() + sprintStatus.slice(1)}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Days Remaining */}
        {sprintStatus === "active" && (
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
            <div className="flex items-center gap-2">
              <HiClock className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Days Remaining
              </p>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {daysRemaining > 0 ? daysRemaining : 0} <span className="text-sm font-normal">/ {totalDays}</span>
            </p>
          </div>
        )}

        {/* Task Completion */}
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <div className="flex items-center gap-2">
            <HiCheckCircle className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Tasks Completed
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {completedTasks} <span className="text-sm font-normal">/ {totalTasks}</span>
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
            <div
              className="h-full bg-green-500"
              style={{ width: `${taskCompletion}%` }}
            ></div>
          </div>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {taskCompletion}% complete
          </p>
        </div>

        {/* Points Completion */}
        {totalPoints !== undefined && completedPoints !== undefined && (
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Points Completed
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {completedPoints} <span className="text-sm font-normal">/ {totalPoints}</span>
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${pointsCompletion}%` }}
              ></div>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {pointsCompletion}% complete
            </p>
          </div>
        )}

        {/* Velocity Trend */}
        {velocityTrend && (
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Velocity Trend
            </p>
            <div className="mt-2 flex items-center gap-2">
              {getTrendIcon()}
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {velocityTrend === "up" && "Improving"}
                {velocityTrend === "down" && "Declining"}
                {velocityTrend === "stable" && "Stable"}
              </p>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              vs. previous sprints
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
