"use client";

import React from "react";
import { HiCube, HiCurrencyDollar } from "react-icons/hi";

interface UsageByToolChartProps {
  byTool: Record<string, { count: number; tokens: number; cost: number }>;
  isLoading?: boolean;
  className?: string;
}

export function UsageByToolChart({ byTool, isLoading, className = "" }: UsageByToolChartProps) {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(6)}`;
  };

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tools = Object.entries(byTool);
  const totalRequests = tools.reduce((sum, [_, data]) => sum + data.count, 0);

  if (tools.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Usage by Tool
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No usage data available yet
        </div>
      </div>
    );
  }

  // Get top 10 tools by request count
  const topTools = tools
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  // Calculate max count for percentage bars
  const maxCount = Math.max(...topTools.map(([_, data]) => data.count));

  // Color palette for bars
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-red-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-cyan-500",
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Usage by Tool (Top 10)
      </h3>

      <div className="space-y-4">
        {topTools.map(([toolName, data], index) => {
          const percentage = (data.count / totalRequests) * 100;
          const barWidth = (data.count / maxCount) * 100;

          return (
            <div key={toolName} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                    {toolName}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <span className="text-gray-600 dark:text-gray-300 font-mono">
                  {data.count.toLocaleString()}
                </span>
              </div>

              {/* Progress bar */}
              <div className="relative h-6 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${colors[index % colors.length]} transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${barWidth}%` }}
                >
                  {barWidth > 20 && (
                    <span className="text-xs font-medium text-white">
                      {formatNumber(data.count)}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <HiCube className="w-3 h-3" />
                  <span>{formatNumber(data.tokens)} tokens</span>
                </div>
                <div className="flex items-center gap-1">
                  <HiCurrencyDollar className="w-3 h-3" />
                  <span>{formatCost(data.cost)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {tools.length > 10 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 text-center">
          Showing top 10 of {tools.length} tools
        </div>
      )}
    </div>
  );
}
