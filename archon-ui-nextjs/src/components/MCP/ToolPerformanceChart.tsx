"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { HiLightningBolt, HiRefresh } from "react-icons/hi";
import { useMcpAnalytics } from "@/hooks";

interface ToolPerformanceChartProps {
  days?: number;
  className?: string;
}

/**
 * Bar chart showing tool execution performance metrics.
 * Displays average response times for each MCP tool with color-coded performance levels.
 * Updates every 30 seconds (120s when tab hidden).
 */
export function ToolPerformanceChart({ days = 7, className = "" }: ToolPerformanceChartProps) {
  const { data: analytics, isLoading, error, refetch } = useMcpAnalytics({ days, compare: false });

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <HiLightningBolt className="w-5 h-5 text-purple-500 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tool Performance
          </h3>
        </div>
        <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700 p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">
            Failed to load performance data
          </h3>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <HiRefresh className="w-4 h-4" />
            Retry
          </button>
        </div>
        <p className="text-red-600 dark:text-red-400 text-sm">{error?.message}</p>
      </div>
    );
  }

  const { response_times_by_tool } = analytics;

  if (!response_times_by_tool || Object.keys(response_times_by_tool).length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <HiLightningBolt className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tool Performance
          </h3>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No tool performance data available for the selected period
          </p>
        </div>
      </div>
    );
  }

  // Transform data for bar chart
  const chartData = Object.entries(response_times_by_tool)
    .map(([tool, time]) => ({
      tool: tool.replace(/_/g, " "), // Make tool names more readable
      time: Math.round(time), // Round to milliseconds
      rawName: tool, // Keep original for sorting/filtering
    }))
    .sort((a, b) => b.time - a.time); // Sort by time (slowest first)

  // Color code based on performance thresholds
  const getBarColor = (time: number) => {
    if (time < 200) return "#10B981"; // Green - Fast (<200ms)
    if (time < 500) return "#3B82F6"; // Blue - Normal (200-500ms)
    if (time < 1000) return "#F59E0B"; // Orange - Slow (500-1000ms)
    return "#EF4444"; // Red - Very slow (>1000ms)
  };

  // Calculate statistics
  const avgTime = chartData.reduce((sum, item) => sum + item.time, 0) / chartData.length;
  const fastestTool = chartData.reduce((min, item) => item.time < min.time ? item : min);
  const slowestTool = chartData.reduce((max, item) => item.time > max.time ? item : max);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <HiLightningBolt className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tool Performance
          </h3>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Last {days} days
        </span>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 20, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="tool"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
            label={{
              value: 'Response Time (ms)',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#9CA3AF' }
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              color: '#F9FAFB',
            }}
            formatter={(value: number) => [`${value}ms`, 'Response Time']}
            labelFormatter={(label) => `Tool: ${label}`}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            content={() => (
              <div className="flex items-center justify-center gap-4 text-xs text-gray-600 dark:text-gray-400 mt-4">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: '#10B981' }}></span>
                  <span>Fast (&lt;200ms)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: '#3B82F6' }}></span>
                  <span>Normal (200-500ms)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: '#F59E0B' }}></span>
                  <span>Slow (500-1000ms)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: '#EF4444' }}></span>
                  <span>Very Slow (&gt;1000ms)</span>
                </div>
              </div>
            )}
          />
          <Bar dataKey="time" name="Response Time (ms)" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.time)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Performance Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
            Average Response Time
          </p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {Math.round(avgTime)}ms
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
            Fastest Tool
          </p>
          <p className="text-lg font-bold text-green-700 dark:text-green-300 truncate">
            {fastestTool.tool}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">
            {fastestTool.time}ms
          </p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">
            Slowest Tool
          </p>
          <p className="text-lg font-bold text-red-700 dark:text-red-300 truncate">
            {slowestTool.tool}
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">
            {slowestTool.time}ms
          </p>
        </div>
      </div>
    </div>
  );
}
