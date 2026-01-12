"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { HiTrendingUp, HiRefresh } from "react-icons/hi";
import { useMcpAnalytics } from "@/hooks";

interface SessionTrendsChartProps {
  days?: number;
  className?: string;
}

export function SessionTrendsChart({ days = 7, className = "" }: SessionTrendsChartProps) {
  const { data: analytics, isLoading, error, refetch } = useMcpAnalytics({ days, compare: false });

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <HiTrendingUp className="w-5 h-5 text-blue-500 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Session Duration Trends
          </h3>
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700 p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">
            Failed to load trends
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

  const { trends } = analytics;

  if (trends.daily.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <HiTrendingUp className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Session Duration Trends
          </h3>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No session data available for the selected period
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <HiTrendingUp className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Session Duration Trends
          </h3>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Last {days} days
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={trends.daily}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              color: '#F9FAFB',
            }}
            labelFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="requests"
            stroke="#3B82F6"
            strokeWidth={2}
            name="Total Requests"
            dot={{ fill: '#3B82F6', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="success_rate"
            stroke="#10B981"
            strokeWidth={2}
            name="Success Rate (%)"
            dot={{ fill: '#10B981', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
            Total Requests
          </p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {trends.daily.reduce((sum, day) => sum + day.requests, 0)}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
            Avg Success Rate
          </p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
            {(trends.daily.reduce((sum, day) => sum + day.success_rate, 0) / trends.daily.length).toFixed(1)}%
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
          <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">
            Peak Day
          </p>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {Math.max(...trends.daily.map(d => d.requests))}
          </p>
        </div>
      </div>
    </div>
  );
}
