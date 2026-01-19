"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface VelocityChartProps {
  velocityData: Array<{
    sprint_name: string;
    planned_points: number;
    completed_points: number;
  }>;
  averageVelocity?: number;
  className?: string;
}

/**
 * VelocityChart Component
 *
 * Phase 3.8: Sprint velocity visualization
 *
 * Features:
 * - Bar chart comparing planned vs completed points per sprint
 * - Average velocity reference line
 * - Sprint-based X-axis
 * - Points-based Y-axis
 * - Hover tooltips with detailed info
 * - Color-coded bars (planned = blue, completed = green)
 * - Responsive design
 *
 * Usage:
 * ```tsx
 * <VelocityChart
 *   velocityData={[
 *     { sprint_name: "Sprint 1", planned_points: 42, completed_points: 38 },
 *     { sprint_name: "Sprint 2", planned_points: 45, completed_points: 45 },
 *     { sprint_name: "Sprint 3", planned_points: 40, completed_points: 35 },
 *   ]}
 *   averageVelocity={39.3}
 * />
 * ```
 */
export function VelocityChart({
  velocityData,
  averageVelocity,
  className = "",
}: VelocityChartProps) {
  const chartData = useMemo(() => {
    return velocityData.map((sprint) => ({
      name: sprint.sprint_name,
      planned: sprint.planned_points,
      completed: sprint.completed_points,
    }));
  }, [velocityData]);

  const calculatedAverage = useMemo(() => {
    if (averageVelocity !== undefined) return averageVelocity;

    if (velocityData.length === 0) return 0;

    const totalCompleted = velocityData.reduce(
      (sum, sprint) => sum + sprint.completed_points,
      0
    );
    return Math.round((totalCompleted / velocityData.length) * 10) / 10;
  }, [velocityData, averageVelocity]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const planned = payload.find((p: any) => p.dataKey === "planned")?.value ?? 0;
    const completed = payload.find((p: any) => p.dataKey === "completed")?.value ?? 0;
    const commitmentRate = planned > 0 ? Math.round((completed / planned) * 100) : 0;

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <p className="mb-2 font-semibold text-gray-900 dark:text-white">{label}</p>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Planned: {planned} pts
        </p>
        <p className="text-sm text-green-600 dark:text-green-400">
          Completed: {completed} pts
        </p>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Commitment: {commitmentRate}%
        </p>
      </div>
    );
  };

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Velocity Chart
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sprint commitment vs. completion
          </p>
        </div>
        {calculatedAverage > 0 && (
          <div className="rounded-lg bg-brand-50 px-3 py-2 dark:bg-brand-900/30">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Avg Velocity
            </p>
            <p className="text-xl font-bold text-brand-700 dark:text-brand-400">
              {calculatedAverage} <span className="text-sm font-normal">pts</span>
            </p>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="name"
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

          {/* Average velocity reference line */}
          {calculatedAverage > 0 && (
            <ReferenceLine
              y={calculatedAverage}
              stroke="#F59E0B"
              strokeDasharray="3 3"
              label={{
                value: `Avg: ${calculatedAverage}`,
                position: "right",
                fill: "#F59E0B",
                fontSize: 12,
              }}
            />
          )}

          {/* Planned points bar (blue) */}
          <Bar
            dataKey="planned"
            fill="#3B82F6"
            name="Planned"
            radius={[4, 4, 0, 0]}
          />

          {/* Completed points bar (green) */}
          <Bar
            dataKey="completed"
            fill="#10B981"
            name="Completed"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend Note */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-blue-500"></div>
          <span>Planned</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-green-500"></div>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-0.5 w-6 border-t-2 border-dashed border-amber-500"></div>
          <span>Average</span>
        </div>
      </div>

      {/* Empty State */}
      {chartData.length === 0 && (
        <div className="flex h-[300px] items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No velocity data available
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Complete sprints to see velocity trends
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
