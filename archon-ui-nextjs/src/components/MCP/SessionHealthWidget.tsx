"use client";

import React from "react";
import { HiCheckCircle, HiExclamationCircle, HiUsers, HiRefresh } from "react-icons/hi";
import { useMcpSessionHealth } from "@/hooks";

interface SessionHealthWidgetProps {
  className?: string;
}

/**
 * Compact session health widget for dashboard layouts.
 * Shows key metrics: active, disconnected, and total sessions with health status.
 * Updates every 10 seconds via smart polling (30s when tab hidden).
 */
export function SessionHealthWidget({ className = "" }: SessionHealthWidgetProps) {
  const { data: health, isLoading, error, refetch } = useMcpSessionHealth();

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <HiUsers className="w-5 h-5 text-blue-500 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Session Health
          </h3>
        </div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700 p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">
            Health Check Failed
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

  const { status_breakdown, age_distribution } = health;

  // Calculate overall health status
  const totalActive = age_distribution.healthy + age_distribution.aging + age_distribution.stale;
  const healthPercent = totalActive > 0
    ? Math.round((age_distribution.healthy / totalActive) * 100)
    : 0;

  // Determine health status color and label
  let healthStatus: "healthy" | "warning" | "critical" = "healthy";
  let healthColor = "text-green-600 dark:text-green-400";
  let healthBg = "bg-green-50 dark:bg-green-900/20";
  let healthBorder = "border-green-200 dark:border-green-800";
  let healthLabel = "Healthy";

  if (healthPercent < 50) {
    healthStatus = "critical";
    healthColor = "text-red-600 dark:text-red-400";
    healthBg = "bg-red-50 dark:bg-red-900/20";
    healthBorder = "border-red-200 dark:border-red-800";
    healthLabel = "Critical";
  } else if (healthPercent < 80) {
    healthStatus = "warning";
    healthColor = "text-yellow-600 dark:text-yellow-400";
    healthBg = "bg-yellow-50 dark:bg-yellow-900/20";
    healthBorder = "border-yellow-200 dark:border-yellow-800";
    healthLabel = "Warning";
  }

  const activePercent = status_breakdown.total > 0
    ? Math.round((status_breakdown.active / status_breakdown.total) * 100)
    : 0;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HiUsers className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Session Health
          </h3>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${healthBg} ${healthColor} ${healthBorder} border`}>
          {healthStatus === "healthy" && <HiCheckCircle className="w-3.5 h-3.5" />}
          {healthStatus !== "healthy" && <HiExclamationCircle className="w-3.5 h-3.5" />}
          {healthLabel}
        </span>
      </div>

      {/* Session Counts Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-center mb-1">
            <HiCheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300 text-center">
            {status_breakdown.active}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 text-center font-medium">
            Active
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-center mb-1">
            <HiExclamationCircle className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-700 dark:text-gray-300 text-center">
            {status_breakdown.disconnected}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center font-medium">
            Disconnected
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-center mb-1">
            <HiUsers className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 text-center">
            {status_breakdown.total}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 text-center font-medium">
            Total
          </p>
        </div>
      </div>

      {/* Age Distribution Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Active Sessions</span>
          <span className="font-semibold text-gray-900 dark:text-white">{activePercent}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
            style={{ width: `${activePercent}%` }}
          />
        </div>

        {/* Age breakdown badges */}
        <div className="flex items-center gap-2 pt-2">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {age_distribution.healthy} healthy
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {age_distribution.aging} aging
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {age_distribution.stale} stale
            </span>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Updated: {new Date(health.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
