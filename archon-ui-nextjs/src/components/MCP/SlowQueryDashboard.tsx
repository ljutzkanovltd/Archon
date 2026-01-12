"use client";

import { useMemo, useState } from "react";
import { HiExclamation, HiClock, HiTrendingUp, HiChevronDown, HiChevronUp } from "react-icons/hi";

export interface SlowExecution {
  request_id: string;
  session_id: string;
  tool_name: string;
  timestamp: string;
  duration_ms: number;
  status: "success" | "error" | "timeout";
  request_params?: any;
  error_message?: string;
}

interface SlowQueryDashboardProps {
  executions: SlowExecution[];
  threshold?: number; // Default 2000ms
  onExecutionClick?: (execution: SlowExecution) => void;
  className?: string;
}

export function SlowQueryDashboard({
  executions,
  threshold = 2000,
  onExecutionClick,
  className = "",
}: SlowQueryDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const slowQueries = useMemo(() => {
    return executions
      .filter((exec) => exec.duration_ms >= threshold)
      .sort((a, b) => b.duration_ms - a.duration_ms); // Slowest first
  }, [executions, threshold]);

  const stats = useMemo(() => {
    if (!slowQueries.length) {
      return {
        total: 0,
        slowest: null,
        avgDuration: 0,
        byTool: new Map<string, number>(),
      };
    }

    const byTool = new Map<string, number>();
    slowQueries.forEach((exec) => {
      byTool.set(exec.tool_name, (byTool.get(exec.tool_name) || 0) + 1);
    });

    const avgDuration = slowQueries.reduce((sum, exec) => sum + exec.duration_ms, 0) / slowQueries.length;

    return {
      total: slowQueries.length,
      slowest: slowQueries[0],
      avgDuration,
      byTool,
    };
  }, [slowQueries]);

  const topOffenders = useMemo(() => {
    return Array.from(stats.byTool.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [stats.byTool]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSeverityColor = (duration: number) => {
    if (duration >= 10000) return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"; // Critical: >10s
    if (duration >= 5000) return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20"; // High: >5s
    return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"; // Medium: >2s
  };

  const getSeverityLabel = (duration: number) => {
    if (duration >= 10000) return "CRITICAL";
    if (duration >= 5000) return "HIGH";
    return "MEDIUM";
  };

  if (!slowQueries.length) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <HiClock className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">All Systems Performing Well</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No tool executions exceeded {threshold / 1000}s threshold
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header with Alert Badge */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/10">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <HiExclamation className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Slow Query Alert Dashboard</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stats.total} execution{stats.total !== 1 ? "s" : ""} exceeded {threshold / 1000}s threshold
              </p>
            </div>
          </div>
          <div className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-sm font-semibold rounded-full">
            {stats.total} ALERTS
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-4 grid grid-cols-3 gap-4 border-b border-gray-200 dark:border-gray-700">
        {/* Slowest Query */}
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Slowest Query</p>
          {stats.slowest && (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={stats.slowest.tool_name}>
                {stats.slowest.tool_name}
              </p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">
                {formatDuration(stats.slowest.duration_ms)}
              </p>
            </>
          )}
        </div>

        {/* Average Slow Duration */}
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
          <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">Avg Slow Duration</p>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {formatDuration(stats.avgDuration)}
          </p>
        </div>

        {/* Top Offender */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
          <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">Most Frequent</p>
          {topOffenders.length > 0 && (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={topOffenders[0][0]}>
                {topOffenders[0][0]}
              </p>
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                {topOffenders[0][1]} occurrence{topOffenders[0][1] !== 1 ? "s" : ""}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Top Offenders List */}
      {topOffenders.length > 0 && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <HiTrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Top Offenders by Frequency</h4>
          </div>
          <div className="space-y-2">
            {topOffenders.map(([toolName, count], idx) => (
              <div key={toolName} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 w-6">#{idx + 1}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{toolName}</span>
                </div>
                <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                  {count} time{count !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slow Query List */}
      <div className="p-4">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">All Slow Executions</h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {slowQueries.map((exec) => {
            const isExpanded = expandedId === exec.request_id;
            const severityColor = getSeverityColor(exec.duration_ms);
            const severityLabel = getSeverityLabel(exec.duration_ms);

            return (
              <div
                key={exec.request_id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Header */}
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : exec.request_id);
                    if (onExecutionClick && !isExpanded) {
                      onExecutionClick(exec);
                    }
                  }}
                  className="w-full p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* Severity Badge */}
                    <div className={`px-2 py-1 rounded text-xs font-bold ${severityColor}`}>
                      {severityLabel}
                    </div>

                    {/* Tool Info */}
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{exec.tool_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(exec.timestamp)}</p>
                    </div>

                    {/* Duration */}
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">
                        {formatDuration(exec.duration_ms)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {((exec.duration_ms / threshold) * 100).toFixed(0)}% over threshold
                      </p>
                    </div>

                    {/* Status Icon */}
                    <div>
                      {exec.status === "success" ? (
                        <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                          <span className="text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                          <span className="text-red-600 dark:text-red-400 text-xs font-bold">✗</span>
                        </div>
                      )}
                    </div>

                    {/* Expand Icon */}
                    {isExpanded ? (
                      <HiChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <HiChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Request ID</p>
                        <p className="text-sm font-mono text-gray-900 dark:text-white">{exec.request_id}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Session ID</p>
                        <p className="text-sm font-mono text-gray-900 dark:text-white">{exec.session_id}</p>
                      </div>
                    </div>

                    {exec.error_message && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                        <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Error Message</p>
                        <p className="text-sm text-red-700 dark:text-red-300 font-mono">{exec.error_message}</p>
                      </div>
                    )}

                    {exec.request_params && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Request Parameters</p>
                        <pre className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono overflow-x-auto">
                          {JSON.stringify(exec.request_params, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        onClick={() => onExecutionClick?.(exec)}
                        className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        View Full Details
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
