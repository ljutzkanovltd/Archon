"use client";

import { useMemo } from "react";
import { HiClock, HiCheckCircle, HiXCircle } from "react-icons/hi";

export interface TimelineExecution {
  request_id: string;
  tool_name: string;
  timestamp: string;
  duration_ms: number;
  status: "success" | "error" | "timeout";
}

interface ToolExecutionTimelineProps {
  executions: TimelineExecution[];
  onExecutionClick?: (execution: TimelineExecution) => void;
  className?: string;
}

export function ToolExecutionTimeline({
  executions,
  onExecutionClick,
  className = "",
}: ToolExecutionTimelineProps) {
  const timelineData = useMemo(() => {
    if (!executions.length) return { rows: [], minTime: 0, maxTime: 0, duration: 0 };

    const sortedExecs = [...executions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const minTime = new Date(sortedExecs[0].timestamp).getTime();
    const maxTime = Math.max(
      ...sortedExecs.map((e) => new Date(e.timestamp).getTime() + (e.duration_ms || 0))
    );
    const duration = maxTime - minTime;

    const rows = sortedExecs.map((exec) => {
      const startTime = new Date(exec.timestamp).getTime();
      const startPercent = ((startTime - minTime) / duration) * 100;
      const durationPercent = ((exec.duration_ms || 0) / duration) * 100;

      return {
        execution: exec,
        startPercent: Math.max(0, startPercent),
        durationPercent: Math.max(0.5, durationPercent), // Minimum 0.5% width for visibility
      };
    });

    return { rows, minTime, maxTime, duration };
  }, [executions]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (!executions.length) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="flex items-center justify-center text-gray-500 dark:text-gray-400">
          <HiClock className="w-5 h-5 mr-2" />
          <p>No tool executions to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tool Execution Timeline</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {executions.length} execution{executions.length !== 1 ? "s" : ""} over {formatDuration(timelineData.duration)}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <HiCheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-gray-600 dark:text-gray-400">
                {executions.filter((e) => e.status === "success").length} success
              </span>
            </div>
            <div className="flex items-center gap-2">
              <HiXCircle className="w-4 h-4 text-red-500" />
              <span className="text-gray-600 dark:text-gray-400">
                {executions.filter((e) => e.status === "error").length} error
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4">
        <div className="space-y-2">
          {timelineData.rows.map(({ execution, startPercent, durationPercent }) => {
            const isSlow = execution.duration_ms > 2000;
            const statusColor =
              execution.status === "success"
                ? "bg-green-500 hover:bg-green-600"
                : execution.status === "error"
                ? "bg-red-500 hover:bg-red-600"
                : "bg-yellow-500 hover:bg-yellow-600";

            return (
              <div key={execution.request_id} className="flex items-center gap-3">
                {/* Tool Name */}
                <div className="w-48 flex-shrink-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={execution.tool_name}>
                    {execution.tool_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatTime(execution.timestamp)}</p>
                </div>

                {/* Timeline Bar */}
                <div className="flex-1 relative h-8 bg-gray-100 dark:bg-gray-900 rounded">
                  <button
                    onClick={() => onExecutionClick?.(execution)}
                    className={`absolute h-full rounded transition-all ${statusColor} ${
                      isSlow ? "ring-2 ring-red-500 ring-offset-1" : ""
                    }`}
                    style={{
                      left: `${startPercent}%`,
                      width: `${durationPercent}%`,
                    }}
                    title={`${execution.tool_name} - ${formatDuration(execution.duration_ms)} - ${execution.status}`}
                  >
                    <span className="sr-only">
                      {execution.tool_name} - {formatDuration(execution.duration_ms)}
                    </span>
                  </button>
                </div>

                {/* Duration */}
                <div className="w-20 flex-shrink-0 text-right">
                  <p className={`text-sm font-mono ${isSlow ? "text-red-600 dark:text-red-400 font-bold" : "text-gray-600 dark:text-gray-400"}`}>
                    {formatDuration(execution.duration_ms)}
                  </p>
                  {isSlow && <p className="text-xs text-red-600 dark:text-red-400">⚠️ Slow</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Success</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Error</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span>Timeout</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded ring-2 ring-red-500 ring-offset-1"></div>
              <span>Slow (&gt;2s)</span>
            </div>
          </div>
          <p>Click on any bar to view execution details</p>
        </div>
      </div>
    </div>
  );
}
