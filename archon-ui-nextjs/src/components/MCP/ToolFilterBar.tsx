"use client";

import { useState } from "react";
import { HiFilter, HiX, HiDownload } from "react-icons/hi";

export interface ToolFilters {
  timeRange: "5m" | "15m" | "1h" | "6h" | "24h" | "7d";
  toolName: string;
  status: "all" | "success" | "error" | "timeout";
  sessionId?: string;
}

interface ToolFilterBarProps {
  filters: ToolFilters;
  onChange: (filters: ToolFilters) => void;
  onExport?: () => void;
  toolNames?: string[];
  className?: string;
}

export function ToolFilterBar({
  filters,
  onChange,
  onExport,
  toolNames = [],
  className = "",
}: ToolFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const timeRangeOptions: Array<{ value: ToolFilters["timeRange"]; label: string }> = [
    { value: "5m", label: "Last 5 minutes" },
    { value: "15m", label: "Last 15 minutes" },
    { value: "1h", label: "Last hour" },
    { value: "6h", label: "Last 6 hours" },
    { value: "24h", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
  ];

  const statusOptions: Array<{ value: ToolFilters["status"]; label: string; color: string }> = [
    { value: "all", label: "All Status", color: "gray" },
    { value: "success", label: "Success", color: "green" },
    { value: "error", label: "Error", color: "red" },
    { value: "timeout", label: "Timeout", color: "yellow" },
  ];

  const activeFiltersCount = [
    filters.toolName !== "",
    filters.status !== "all",
    filters.sessionId,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onChange({
      timeRange: filters.timeRange,
      toolName: "",
      status: "all",
      sessionId: undefined,
    });
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <HiFilter className="w-4 h-4" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <HiX className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Time Range Selector */}
            <select
              value={filters.timeRange}
              onChange={(e) => onChange({ ...filters, timeRange: e.target.value as ToolFilters["timeRange"] })}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {timeRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Export Button */}
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <HiDownload className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tool Name Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tool Name
            </label>
            <select
              value={filters.toolName}
              onChange={(e) => onChange({ ...filters, toolName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Tools</option>
              {toolNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => {
                const isActive = filters.status === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => onChange({ ...filters, status: option.value })}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? option.value === "success"
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          : option.value === "error"
                          ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                          : option.value === "timeout"
                          ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Session ID Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Session ID (optional)
            </label>
            <input
              type="text"
              value={filters.sessionId || ""}
              onChange={(e) => onChange({ ...filters, sessionId: e.target.value || undefined })}
              placeholder="Filter by session ID"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
}
