"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO, eachDayOfInterval, differenceInDays } from "date-fns";

interface BurndownChartProps {
  sprintStartDate: string;
  sprintEndDate: string;
  totalPoints: number;
  burndownData: Array<{
    date: string;
    remaining_points: number;
    completed_points: number;
  }>;
  className?: string;
}

/**
 * BurndownChart Component
 *
 * Phase 3.7: Sprint burndown visualization
 *
 * Features:
 * - Ideal burndown line (linear from total to zero)
 * - Actual burndown line (real progress)
 * - Completed points line
 * - Date-based X-axis
 * - Points-based Y-axis
 * - Hover tooltips with detailed info
 * - Responsive design
 *
 * Usage:
 * ```tsx
 * <BurndownChart
 *   sprintStartDate="2024-01-15"
 *   sprintEndDate="2024-01-29"
 *   totalPoints={42}
 *   burndownData={[
 *     { date: "2024-01-15", remaining_points: 42, completed_points: 0 },
 *     { date: "2024-01-16", remaining_points: 38, completed_points: 4 },
 *     // ...
 *   ]}
 * />
 * ```
 */
export function BurndownChart({
  sprintStartDate,
  sprintEndDate,
  totalPoints,
  burndownData,
  className = "",
}: BurndownChartProps) {
  const chartData = useMemo(() => {
    const startDate = parseISO(sprintStartDate);
    const endDate = parseISO(sprintEndDate);
    const allDates = eachDayOfInterval({ start: startDate, end: endDate });
    const totalDays = differenceInDays(endDate, startDate);

    // Create ideal burndown line (linear from totalPoints to 0)
    const idealBurndownRate = totalPoints / totalDays;

    return allDates.map((date, index) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const actualData = burndownData.find((d) => d.date === dateStr);

      // Ideal burndown: decreases linearly
      const idealRemaining = Math.max(0, totalPoints - idealBurndownRate * index);

      return {
        date: format(date, "MMM dd"),
        fullDate: dateStr,
        ideal: Math.round(idealRemaining * 10) / 10, // Round to 1 decimal
        actual: actualData?.remaining_points ?? null,
        completed: actualData?.completed_points ?? null,
      };
    });
  }, [sprintStartDate, sprintEndDate, totalPoints, burndownData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <p className="mb-2 font-semibold text-gray-900 dark:text-white">{label}</p>
        {payload.map((entry: any) => (
          <p
            key={entry.name}
            className="text-sm"
            style={{ color: entry.color }}
          >
            {entry.name === "ideal" && "Ideal: "}
            {entry.name === "actual" && "Actual Remaining: "}
            {entry.name === "completed" && "Completed: "}
            {entry.value !== null ? `${entry.value} pts` : "No data"}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Burndown Chart
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Sprint progress vs. ideal burndown
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="date"
            stroke="#9CA3AF"
            style={{ fontSize: "0.75rem" }}
          />
          <YAxis
            stroke="#9CA3AF"
            style={{ fontSize: "0.75rem" }}
            label={{ value: "Points", angle: -90, position: "insideLeft" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {/* Reference line at zero */}
          <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" />

          {/* Ideal burndown line (dashed gray) */}
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="#9CA3AF"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Ideal"
            dot={false}
          />

          {/* Actual burndown line (solid blue) */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#3B82F6"
            strokeWidth={2}
            name="Actual"
            dot={{ fill: "#3B82F6", r: 3 }}
            connectNulls={false}
          />

          {/* Completed points line (solid green) */}
          <Line
            type="monotone"
            dataKey="completed"
            stroke="#10B981"
            strokeWidth={2}
            name="Completed"
            dot={{ fill: "#10B981", r: 3 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Legend Note */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-6 border-t-2 border-dashed border-gray-400"></div>
          <span>Ideal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-6 bg-blue-500"></div>
          <span>Actual Remaining</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-6 bg-green-500"></div>
          <span>Completed</span>
        </div>
      </div>
    </div>
  );
}
