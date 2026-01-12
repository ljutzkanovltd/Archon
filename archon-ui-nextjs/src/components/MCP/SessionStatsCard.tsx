"use client";

import React from "react";
import { IconType } from "react-icons";
import { HiTrendingUp, HiTrendingDown } from "react-icons/hi";

interface SessionStatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: IconType;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  color?: "blue" | "green" | "purple" | "orange" | "red" | "gray";
  className?: string;
  isLoading?: boolean;
}

/**
 * Reusable statistical summary card component for displaying MCP metrics.
 * Supports trend indicators, custom icons, and color themes.
 */
export function SessionStatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "blue",
  className = "",
  isLoading = false,
}: SessionStatsCardProps) {
  // Color configuration for different themes
  const colorConfig = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-200 dark:border-blue-800",
      text: "text-blue-600 dark:text-blue-400",
      valueText: "text-blue-700 dark:text-blue-300",
      icon: "text-blue-500",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-900/20",
      border: "border-green-200 dark:border-green-800",
      text: "text-green-600 dark:text-green-400",
      valueText: "text-green-700 dark:text-green-300",
      icon: "text-green-500",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-900/20",
      border: "border-purple-200 dark:border-purple-800",
      text: "text-purple-600 dark:text-purple-400",
      valueText: "text-purple-700 dark:text-purple-300",
      icon: "text-purple-500",
    },
    orange: {
      bg: "bg-orange-50 dark:bg-orange-900/20",
      border: "border-orange-200 dark:border-orange-800",
      text: "text-orange-600 dark:text-orange-400",
      valueText: "text-orange-700 dark:text-orange-300",
      icon: "text-orange-500",
    },
    red: {
      bg: "bg-red-50 dark:bg-red-900/20",
      border: "border-red-200 dark:border-red-800",
      text: "text-red-600 dark:text-red-400",
      valueText: "text-red-700 dark:text-red-300",
      icon: "text-red-500",
    },
    gray: {
      bg: "bg-gray-50 dark:bg-gray-700/50",
      border: "border-gray-200 dark:border-gray-600",
      text: "text-gray-600 dark:text-gray-400",
      valueText: "text-gray-700 dark:text-gray-300",
      icon: "text-gray-500",
    },
  };

  const colors = colorConfig[color];

  if (isLoading) {
    return (
      <div className={`${colors.bg} rounded-lg p-4 border ${colors.border} ${className}`}>
        <div className="space-y-2">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3 animate-pulse"></div>
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/2 animate-pulse"></div>
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${colors.bg} rounded-lg p-4 border ${colors.border} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-xs ${colors.text} font-medium mb-1`}>
            {title}
          </p>
          <p className={`text-2xl font-bold ${colors.valueText}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-xs ${colors.text} mt-1`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={`${colors.icon}`}>
          <Icon className="w-8 h-8" />
        </div>
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1">
            {trend.isPositive ? (
              <HiTrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <HiTrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span
              className={`text-xs font-semibold ${
                trend.isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {trend.isPositive ? "+" : ""}{trend.value}%
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {trend.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Pre-configured stats cards for common MCP metrics.
 */
export const SessionStatsCardVariants = {
  /**
   * Total requests card
   */
  TotalRequests: ({ value, trend, isLoading }: { value: number; trend?: SessionStatsCardProps["trend"]; isLoading?: boolean }) => (
    <SessionStatsCard
      title="Total Requests"
      value={value.toLocaleString()}
      icon={require("react-icons/hi").HiChartBar}
      color="blue"
      trend={trend}
      isLoading={isLoading}
    />
  ),

  /**
   * Success rate card
   */
  SuccessRate: ({ value, trend, isLoading }: { value: number; trend?: SessionStatsCardProps["trend"]; isLoading?: boolean }) => (
    <SessionStatsCard
      title="Success Rate"
      value={`${value.toFixed(1)}%`}
      icon={require("react-icons/hi").HiCheckCircle}
      color="green"
      trend={trend}
      isLoading={isLoading}
    />
  ),

  /**
   * Average response time card
   */
  AvgResponseTime: ({ value, trend, isLoading }: { value: number; trend?: SessionStatsCardProps["trend"]; isLoading?: boolean }) => (
    <SessionStatsCard
      title="Avg Response Time"
      value={`${Math.round(value)}ms`}
      icon={require("react-icons/hi").HiClock}
      color="purple"
      trend={trend}
      isLoading={isLoading}
    />
  ),

  /**
   * Error rate card
   */
  ErrorRate: ({ value, trend, isLoading }: { value: number; trend?: SessionStatsCardProps["trend"]; isLoading?: boolean }) => (
    <SessionStatsCard
      title="Error Rate"
      value={`${value.toFixed(1)}%`}
      icon={require("react-icons/hi").HiExclamationCircle}
      color="red"
      trend={trend}
      isLoading={isLoading}
    />
  ),

  /**
   * Active sessions card
   */
  ActiveSessions: ({ value, trend, isLoading }: { value: number; trend?: SessionStatsCardProps["trend"]; isLoading?: boolean }) => (
    <SessionStatsCard
      title="Active Sessions"
      value={value}
      icon={require("react-icons/hi").HiUsers}
      color="green"
      trend={trend}
      isLoading={isLoading}
    />
  ),

  /**
   * Token usage card
   */
  TokenUsage: ({ value, trend, isLoading }: { value: number; trend?: SessionStatsCardProps["trend"]; isLoading?: boolean }) => (
    <SessionStatsCard
      title="Token Usage"
      value={value.toLocaleString()}
      subtitle="Total tokens"
      icon={require("react-icons/hi").HiCube}
      color="orange"
      trend={trend}
      isLoading={isLoading}
    />
  ),
};
