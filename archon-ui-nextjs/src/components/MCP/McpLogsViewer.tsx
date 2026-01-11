"use client";

import React, { useState, useMemo, useRef } from "react";
// @ts-expect-error - react-window v2 types mismatch with v1 @types
import { List } from "react-window";
// @ts-expect-error - react-window-infinite-loader types issue
import { InfiniteLoader } from "react-window-infinite-loader";
import {
  HiSearch,
  HiFilter,
  HiDownload,
  HiRefresh,
  HiChevronDown,
  HiChevronUp,
  HiCheckCircle,
  HiXCircle,
  HiClock,
  HiInformationCircle,
} from "react-icons/hi";
import { useMcpLogs } from "@/hooks";
import type { McpLogEntry, McpLogLevel } from "@/lib/types";

interface McpLogsViewerProps {
  sessionId?: string;
  initialLevel?: McpLogLevel;
  className?: string;
}

export function McpLogsViewer({ sessionId, initialLevel = "all", className = "" }: McpLogsViewerProps) {
  const [levelFilter, setLevelFilter] = useState<McpLogLevel>(initialLevel);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 500);
  };

  // Fetch logs with infinite query
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useMcpLogs(
    {
      level: (levelFilter === "all" ? undefined : levelFilter) as "info" | "warning" | "error" | undefined,
      search: debouncedSearch || undefined,
      sessionId: sessionId,
    },
    100 // Page size
  );

  // Flatten all pages into single array
  const allLogs = useMemo(() => {
    return data?.pages.flatMap((page) => page.logs) ?? [];
  }, [data]);

  // Total count from last page
  const totalCount = data?.pages[data.pages.length - 1]?.pagination.total ?? 0;

  // Helper functions
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "N/A";
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms.toFixed(0)}ms`;
  };

  const getLevelBadge = (level: McpLogLevel) => {
    const configs = {
      info: {
        icon: HiCheckCircle,
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        label: "INFO",
      },
      warning: {
        icon: HiClock,
        className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
        label: "WARN",
      },
      error: {
        icon: HiXCircle,
        className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        label: "ERROR",
      },
      debug: {
        icon: HiInformationCircle,
        className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
        label: "DEBUG",
      },
      all: {
        icon: HiInformationCircle,
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        label: "ALL",
      },
    };

    const config = configs[level];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  // Export logs to file
  const exportLogs = (format: "json" | "csv") => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `mcp-logs-${timestamp}.${format}`;

    if (format === "json") {
      const jsonData = JSON.stringify(allLogs, null, 2);
      const blob = new Blob([jsonData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV format
      const headers = ["Timestamp", "Level", "Tool", "Status", "Duration", "Tokens", "Cost", "Error"];
      const rows = allLogs.map((log) => [
        log.timestamp,
        log.level,
        log.tool_name || log.method || "N/A",
        log.status,
        log.duration_ms?.toString() || "N/A",
        log.total_tokens.toString(),
        log.estimated_cost.toFixed(6),
        log.error_message || "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // Virtualized row renderer
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const log = allLogs[index];
    if (!log) {
      return (
        <div style={style} className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    const isExpanded = expandedLogId === log.request_id;

    return (
      <div
        style={style}
        className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
          isExpanded ? "bg-gray-50 dark:bg-gray-750" : ""
        }`}
      >
        <div
          className="p-4 cursor-pointer"
          onClick={() => setExpandedLogId(isExpanded ? null : log.request_id)}
        >
          <div className="flex items-start gap-3">
            {/* Level Badge */}
            <div className="flex-shrink-0 mt-0.5">{getLevelBadge(log.level)}</div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-white truncate">
                  {log.tool_name || log.method}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {formatTimestamp(log.timestamp)}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                <span>
                  <span className="text-gray-500 dark:text-gray-400">Duration:</span>{" "}
                  {formatDuration(log.duration_ms)}
                </span>
                <span>
                  <span className="text-gray-500 dark:text-gray-400">Tokens:</span> {log.total_tokens}
                </span>
                <span>
                  <span className="text-gray-500 dark:text-gray-400">Cost:</span> ${log.estimated_cost.toFixed(6)}
                </span>
              </div>

              {/* Error message preview */}
              {log.error_message && !isExpanded && (
                <div className="mt-1 text-sm text-red-600 dark:text-red-400 truncate">
                  {log.error_message}
                </div>
              )}
            </div>

            {/* Expand Icon */}
            <div className="flex-shrink-0">
              {isExpanded ? (
                <HiChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <HiChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Request ID:</span>
                  <span className="ml-2 font-mono text-xs">{log.request_id.slice(0, 16)}...</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Session ID:</span>
                  <span className="ml-2 font-mono text-xs">{log.session_id.slice(0, 16)}...</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Method:</span>
                  <span className="ml-2">{log.method}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <span className="ml-2 capitalize">{log.status}</span>
                </div>
              </div>

              {/* Token breakdown */}
              <div className="flex gap-4 text-sm">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded px-3 py-2">
                  <div className="text-gray-500 dark:text-gray-400 text-xs">Prompt Tokens</div>
                  <div className="font-semibold">{log.prompt_tokens}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded px-3 py-2">
                  <div className="text-gray-500 dark:text-gray-400 text-xs">Completion Tokens</div>
                  <div className="font-semibold">{log.completion_tokens}</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded px-3 py-2">
                  <div className="text-gray-500 dark:text-gray-400 text-xs">Total Tokens</div>
                  <div className="font-semibold">{log.total_tokens}</div>
                </div>
              </div>

              {/* Full error message */}
              {log.error_message && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                  <div className="text-xs font-semibold text-red-800 dark:text-red-400 mb-1">
                    Error Message
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
                    {log.error_message}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading && !data) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700 p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HiXCircle className="w-6 h-6 text-red-500" />
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">
              Failed to load logs
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
        <p className="text-red-600 dark:text-red-400">{(error as Error).message}</p>
      </div>
    );
  }

  const itemCount = hasNextPage ? allLogs.length + 1 : allLogs.length;
  const isItemLoaded = (index: number) => !hasNextPage || index < allLogs.length;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header with Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Title */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">MCP Logs Viewer</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {totalCount.toLocaleString()} logs total
              {debouncedSearch && ` • Searching for "${debouncedSearch}"`}
            </p>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <HiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search tool name or error..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Level Filter */}
          <div className="relative">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as McpLogLevel)}
              className="appearance-none pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="debug">Debug</option>
            </select>
            <HiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          {/* Export Button */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
              <HiDownload className="w-4 h-4" />
              Export
            </button>
            <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => exportLogs("json")}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg"
              >
                Export JSON
              </button>
              <button
                onClick={() => exportLogs("csv")}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg"
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <HiRefresh className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Virtualized List */}
      {allLogs.length > 0 ? (
        <InfiniteLoader
          isRowLoaded={isItemLoaded}
          rowCount={itemCount}
          loadMoreRows={fetchNextPage as any}
        >
          {({ onRowsRendered }: any) => (
            <List
              height={600}
              rowCount={itemCount}
              rowHeight={expandedLogId ? 300 : 100}
              width="100%"
              onRowsRendered={onRowsRendered}
              rowComponent={Row}
              rowProps={{}}
              className="scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
            />
          )}
        </InfiniteLoader>
      ) : (
        <div className="p-12 text-center text-gray-500 dark:text-gray-400">
          <HiInformationCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No logs found</p>
          {debouncedSearch && <p className="text-sm mt-2">Try adjusting your search or filters</p>}
        </div>
      )}

      {/* Loading More Indicator */}
      {isFetchingNextPage && (
        <div className="p-4 text-center border-t border-gray-200 dark:border-gray-700">
          <div className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            Loading more logs...
          </div>
        </div>
      )}
    </div>
  );
}
