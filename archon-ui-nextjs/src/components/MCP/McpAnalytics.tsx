"use client";

import React, { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  HiChartBar,
  HiClock,
  HiCheckCircle,
  HiXCircle,
  HiChevronDown,
  HiChevronUp,
  HiRefresh,
  HiTrendingUp,
  HiTrendingDown,
} from "react-icons/hi";
import { useMcpAnalytics } from "@/hooks";
import type { McpAnalyticsResponse } from "@/lib/types";

interface McpAnalyticsProps {
  days?: number;
  compare?: boolean;
  className?: string;
}

export function McpAnalytics({ days = 30, compare = true, className = "" }: McpAnalyticsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: analytics, isLoading, error, refetch } = useMcpAnalytics({ days, compare });

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <HiChartBar className="w-6 h-6 text-blue-500 animate-pulse" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              MCP Analytics Dashboard
            </h3>
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700 p-6 ${className}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HiXCircle className="w-6 h-6 text-red-500" />
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">
              Failed to load analytics
            </h3>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <HiRefresh className="w-4 h-4" />
            Retry
          </button>
        </div>
        <p className="text-red-600 dark:text-red-400">{error.message}</p>
      </div>
    );
  }

  // Empty state
  if (!analytics || (analytics.trends.daily.length === 0 && analytics.trends.hourly.length === 0)) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}
      >
        <div className="flex items-center gap-2 mb-4">
          <HiChartBar className="w-6 h-6 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            MCP Analytics Dashboard
          </h3>
        </div>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <HiChartBar className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No analytics data available yet</p>
          <p className="text-sm mt-2">Analytics will appear once MCP requests are processed</p>
        </div>
      </div>
    );
  }

  // Helper functions
  const formatCost = (cost: number) => `$${cost.toFixed(6)}`;
  const formatNumber = (num: number) => num.toLocaleString();
  const formatDuration = (ms: number | null | undefined) => {
    if (ms === null || ms === undefined) return "N/A";
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms.toFixed(0)}ms`;
  };

  // Chart colors
  const COLORS = {
    success: "#10b981",
    error: "#ef4444",
    timeout: "#f97316",
    primary: "#3b82f6",
    secondary: "#8b5cf6",
    tertiary: "#ec4899",
  };

  // Pie chart data for success/failure ratio
  const pieData = [
    { name: "Success", value: analytics.ratios.success, color: COLORS.success },
    { name: "Error", value: analytics.ratios.error, color: COLORS.error },
    { name: "Timeout", value: analytics.ratios.timeout, color: COLORS.timeout },
  ].filter((item) => item.value > 0);

  // Comparison badge component
  const ComparisonBadge = ({ change }: { change: number }) => {
    if (change === 0) return null;
    const isPositive = change > 0;
    const Icon = isPositive ? HiTrendingUp : HiTrendingDown;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
          isPositive
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        }`}
      >
        <Icon className="w-3 h-3" />
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
    >
      {/* Header */}
      <div
        className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HiChartBar className="w-6 h-6 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              MCP Analytics Dashboard
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              (Last {analytics.period.days} days)
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Quick stats */}
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400">Success Rate:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {analytics.ratios.success_rate.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400">Avg Response:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {formatDuration(analytics.response_times.overall_avg)}
                </span>
              </div>
            </div>
            {isExpanded ? (
              <HiChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <HiChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          {/* Comparison Cards */}
          {analytics.comparison && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Requests</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(analytics.comparison.requests.current)}
                  </span>
                  <ComparisonBadge change={analytics.comparison.requests.change_percent} />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  vs {formatNumber(analytics.comparison.requests.previous)} previous
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Success Rate</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {analytics.comparison.success_rate.current.toFixed(1)}%
                  </span>
                  <ComparisonBadge change={analytics.comparison.success_rate.change_percent} />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  vs {analytics.comparison.success_rate.previous.toFixed(1)}% previous
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Tokens</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatNumber(analytics.comparison.tokens.current)}
                  </span>
                  <ComparisonBadge change={analytics.comparison.tokens.change_percent} />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  vs {formatNumber(analytics.comparison.tokens.previous)} previous
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Cost</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCost(analytics.comparison.cost.current)}
                  </span>
                  <ComparisonBadge change={analytics.comparison.cost.change_percent} />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  vs {formatCost(analytics.comparison.cost.previous)} previous
                </div>
              </div>
            </div>
          )}

          {/* Daily Trends Chart */}
          {analytics.trends.daily.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Daily Request Trends
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.trends.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    fontSize={12}
                    tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f3f4f6" }}
                    formatter={(value: any, name: any) => {
                      if (name === "cost") return formatCost(Number(value));
                      if (name === "success_rate") return `${Number(value).toFixed(1)}%`;
                      return formatNumber(Number(value));
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={{ fill: COLORS.primary }}
                    name="Requests"
                  />
                  <Line
                    type="monotone"
                    dataKey="success_rate"
                    stroke={COLORS.success}
                    strokeWidth={2}
                    dot={{ fill: COLORS.success }}
                    name="Success Rate (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Success/Failure Pie Chart */}
            {pieData.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                  Request Status Distribution
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-gray-700 dark:text-gray-300">
                      Success: {analytics.ratios.success}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-gray-700 dark:text-gray-300">
                      Error: {analytics.ratios.error}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span className="text-gray-700 dark:text-gray-300">
                      Timeout: {analytics.ratios.timeout}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Peak Usage Times */}
            {analytics.trends.hourly.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                  Peak Usage by Hour
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.trends.hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis
                      dataKey="hour"
                      stroke="#9ca3af"
                      fontSize={12}
                      tickFormatter={(value) => `${value}:00`}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #374151",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#f3f4f6" }}
                      labelFormatter={(value: any) => `Hour ${value}:00`}
                      formatter={(value: any) => formatNumber(Number(value))}
                    />
                    <Bar dataKey="requests" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Response Times by Tool */}
          {analytics.response_times.by_tool.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Average Response Times by Tool
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analytics.response_times.by_tool.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="tool"
                    stroke="#9ca3af"
                    fontSize={12}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#f3f4f6" }}
                    formatter={(value: any) => formatDuration(Number(value))}
                  />
                  <Bar dataKey="avg_ms" fill={COLORS.secondary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-gray-500 dark:text-gray-400">Average</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDuration(analytics.response_times.overall_avg)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500 dark:text-gray-400">P50</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDuration(analytics.response_times.p50)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500 dark:text-gray-400">P95</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDuration(analytics.response_times.p95)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-gray-500 dark:text-gray-400">P99</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDuration(analytics.response_times.p99)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
