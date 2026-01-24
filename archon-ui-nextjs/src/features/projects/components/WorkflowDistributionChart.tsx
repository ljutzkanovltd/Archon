"use client";

import { useMemo } from "react";
import { Card, Badge, ToggleSwitch } from "flowbite-react";
import { HiChartPie, HiChartBar } from "react-icons/hi";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { useState } from "react";

interface WorkflowDistributionChartProps {
  data: Record<string, number>;
  title?: string;
  showLegend?: boolean;
  defaultChartType?: "pie" | "bar";
  className?: string;
}

// Workflow stage colors (matching established pattern)
const STAGE_COLORS: Record<string, string> = {
  backlog: "#6B7280", // gray-500
  in_progress: "#3B82F6", // blue-500
  review: "#F59E0B", // amber-500
  done: "#10B981", // green-500
  todo: "#9CA3AF", // gray-400
  doing: "#3B82F6", // blue-500
};

/**
 * WorkflowDistributionChart - Display task distribution across workflow stages
 *
 * Features:
 * - Pie chart or bar chart visualization
 * - Toggle between chart types
 * - Color-coded workflow stages
 * - Total task count display
 * - Percentage calculations
 * - Empty state handling
 * - Responsive design
 *
 * Usage:
 * ```tsx
 * <WorkflowDistributionChart
 *   data={{ backlog: 10, in_progress: 5, review: 3, done: 20 }}
 *   title="Workflow Stage Distribution"
 * />
 * ```
 */
export function WorkflowDistributionChart({
  data,
  title = "Workflow Distribution",
  showLegend = true,
  defaultChartType = "pie",
  className = "",
}: WorkflowDistributionChartProps) {
  const [chartType, setChartType] = useState<"pie" | "bar">(defaultChartType);

  // Calculate total tasks
  const totalTasks = useMemo(
    () => Object.values(data).reduce((sum, count) => sum + count, 0),
    [data]
  );

  // Transform data for charts
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([stage, count]) => ({
        name: stage.replace(/_/g, " ").toUpperCase(),
        value: count,
        count,
        fill: STAGE_COLORS[stage.toLowerCase()] || "#6B7280",
        percentage: totalTasks > 0 ? (count / totalTasks) * 100 : 0,
      }))
      .filter((item) => item.count > 0) // Only show stages with tasks
      .sort((a, b) => b.count - a.count); // Sort by count descending
  }, [data, totalTasks]);

  // Custom label for pie chart
  const renderPieLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Only show label if percentage is > 5%
    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Empty state
  if (totalTasks === 0 || chartData.length === 0) {
    return (
      <Card className={className}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <HiChartPie className="h-16 w-16 text-gray-400" />
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            No workflow data available
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {chartType === "pie" ? (
            <HiChartPie className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          ) : (
            <HiChartBar className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          )}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <Badge color="gray" size="sm">
            {totalTasks} tasks
          </Badge>
        </div>

        {/* Chart Type Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Chart:
          </span>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            <button
              onClick={() => setChartType("pie")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                chartType === "pie"
                  ? "bg-white text-brand-600 shadow-sm dark:bg-gray-700 dark:text-brand-400"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Pie
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                chartType === "bar"
                  ? "bg-white text-brand-600 shadow-sm dark:bg-gray-700 dark:text-brand-400"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Bar
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartType === "pie" ? (
        <div className="flex flex-col items-center lg:flex-row lg:items-start lg:justify-around">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderPieLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  `${value} tasks`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          {showLegend && (
            <div className="mt-4 space-y-2 lg:mt-0 lg:ml-4">
              {chartData.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {entry.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {entry.count}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({entry.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #ccc",
                borderRadius: "8px",
              }}
              formatter={(value: number, name: string) => [
                `${value} tasks`,
                "Count",
              ]}
            />
            {showLegend && <Legend />}
            <Bar dataKey="count" radius={[8, 8, 0, 0]} name="Tasks">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Summary Stats */}
      <div className="mt-4 flex justify-around border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Total Stages
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {chartData.length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Total Tasks
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {totalTasks}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Largest Stage
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {chartData[0]?.name || "N/A"}
          </p>
        </div>
      </div>
    </Card>
  );
}
