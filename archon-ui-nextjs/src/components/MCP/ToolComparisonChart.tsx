"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { HiTrendingUp, HiTrendingDown } from "react-icons/hi";

export interface ToolStats {
  tool_name: string;
  total_calls: number;
  success_rate: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  error_count: number;
}

interface ToolComparisonChartProps {
  tools: ToolStats[];
  metric?: "avg_duration" | "p95_duration" | "success_rate" | "total_calls";
  className?: string;
}

export function ToolComparisonChart({
  tools,
  metric = "avg_duration",
  className = "",
}: ToolComparisonChartProps) {
  const chartData = useMemo(() => {
    return tools.map((tool) => ({
      name: tool.tool_name.length > 20 ? tool.tool_name.substring(0, 20) + "..." : tool.tool_name,
      fullName: tool.tool_name,
      "Avg Duration (ms)": Math.round(tool.avg_duration_ms),
      "P95 Duration (ms)": Math.round(tool.p95_duration_ms),
      "Success Rate (%)": Math.round(tool.success_rate * 100),
      "Total Calls": tool.total_calls,
      "Error Count": tool.error_count,
    }));
  }, [tools]);

  const metricConfig = {
    avg_duration: {
      dataKey: "Avg Duration (ms)",
      label: "Average Duration",
      color: "#3b82f6",
      unit: "ms",
    },
    p95_duration: {
      dataKey: "P95 Duration (ms)",
      label: "P95 Duration",
      color: "#8b5cf6",
      unit: "ms",
    },
    success_rate: {
      dataKey: "Success Rate (%)",
      label: "Success Rate",
      color: "#10b981",
      unit: "%",
    },
    total_calls: {
      dataKey: "Total Calls",
      label: "Total Calls",
      color: "#f59e0b",
      unit: "",
    },
  };

  const config = metricConfig[metric];

  const sortedData = useMemo(() => {
    return [...chartData].sort((a, b) => {
      const aValue = a[config.dataKey] || 0;
      const bValue = b[config.dataKey] || 0;
      return bValue - aValue; // Descending order
    });
  }, [chartData, config.dataKey]);

  const stats = useMemo(() => {
    if (!sortedData.length) return { best: null, worst: null, avg: 0 };

    const values = sortedData.map((d) => d[config.dataKey] || 0);
    const best = sortedData[sortedData.length - 1]; // Lowest value (last in descending sort)
    const worst = sortedData[0]; // Highest value (first in descending sort)
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

    return { best, worst, avg };
  }, [sortedData, config.dataKey]);

  if (!tools.length) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="flex items-center justify-center text-gray-500 dark:text-gray-400">
          <p>No tool data available for comparison</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tool Performance Comparison</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Comparing {tools.length} tool{tools.length !== 1 ? "s" : ""} by {config.label.toLowerCase()}
        </p>
      </div>

      {/* Stats Summary */}
      <div className="p-4 grid grid-cols-3 gap-4 border-b border-gray-200 dark:border-gray-700">
        {/* Best Performer */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <HiTrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            <p className="text-xs font-medium text-green-600 dark:text-green-400">Best Performer</p>
          </div>
          {stats.best && (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={stats.best.fullName}>
                {stats.best.name}
              </p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {stats.best[config.dataKey]}{config.unit}
              </p>
            </>
          )}
        </div>

        {/* Average */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Average</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {Math.round(stats.avg)}{config.unit}
          </p>
        </div>

        {/* Worst Performer */}
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <HiTrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
            <p className="text-xs font-medium text-red-600 dark:text-red-400">Needs Attention</p>
          </div>
          {stats.worst && (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={stats.worst.fullName}>
                {stats.worst.name}
              </p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">
                {stats.worst[config.dataKey]}{config.unit}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={sortedData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fill: "currentColor" }}
              className="text-gray-600 dark:text-gray-400"
            />
            <YAxis
              tick={{ fill: "currentColor" }}
              className="text-gray-600 dark:text-gray-400"
              label={{
                value: `${config.label} (${config.unit})`,
                angle: -90,
                position: "insideLeft",
                style: { fill: "currentColor" },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--tooltip-bg)",
                border: "1px solid var(--tooltip-border)",
                borderRadius: "0.5rem",
              }}
              labelStyle={{ color: "var(--tooltip-text)" }}
              formatter={(value: number, name: string, props: any) => [
                `${value}${config.unit}`,
                props.payload.fullName,
              ]}
            />
            <Legend />
            <Bar dataKey={config.dataKey} fill={config.color} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tool Details Table */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Tool Name</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Total Calls</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Success Rate</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Avg Duration</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">P95 Duration</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedData.map((tool, idx) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white" title={tool.fullName}>
                    {tool.name}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{tool["Total Calls"]}</td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`font-medium ${
                        tool["Success Rate (%)"] >= 95
                          ? "text-green-600 dark:text-green-400"
                          : tool["Success Rate (%)"] >= 80
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {tool["Success Rate (%)"]}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-400">
                    {tool["Avg Duration (ms)"]}ms
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-400">
                    {tool["P95 Duration (ms)"]}ms
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={tool["Error Count"] > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-600 dark:text-gray-400"}>
                      {tool["Error Count"]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
