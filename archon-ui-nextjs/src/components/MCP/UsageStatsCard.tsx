"use client";

import React from "react";
import { HiChartBar, HiCurrencyDollar, HiCube, HiLightningBolt } from "react-icons/hi";

interface UsageStatsCardProps {
  summary: {
    total_requests: number;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    total_cost: number;
    unique_sessions: number;
  };
  period: {
    start: string;
    end: string;
    days: number;
  };
  isLoading?: boolean;
  className?: string;
}

export function UsageStatsCard({ summary, period, isLoading, className = "" }: UsageStatsCardProps) {
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
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Requests",
      value: formatNumber(summary.total_requests),
      icon: HiChartBar,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Total Tokens",
      value: formatNumber(summary.total_tokens),
      icon: HiCube,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      subtitle: `${formatNumber(summary.total_prompt_tokens)} in / ${formatNumber(summary.total_completion_tokens)} out`,
    },
    {
      label: "Total Cost",
      value: formatCost(summary.total_cost),
      icon: HiCurrencyDollar,
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    },
    {
      label: "Active Sessions",
      value: summary.unique_sessions.toString(),
      icon: HiLightningBolt,
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
    },
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Usage Statistics
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Last {period.days} days
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={`${stat.bgColor} rounded-lg p-4 transition-all duration-200 hover:shadow-md`}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {stat.label}
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </div>
            {stat.subtitle && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {stat.subtitle}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
