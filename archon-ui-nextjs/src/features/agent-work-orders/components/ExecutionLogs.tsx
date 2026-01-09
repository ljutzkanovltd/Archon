"use client";

/**
 * Execution Logs Component
 *
 * Displays log entries from SSE stream or historical data with filtering and auto-scroll.
 * Adapted to archon-ui-nextjs patterns using Flowbite components and react-icons/hi.
 */

import { useEffect, useRef, useState } from "react";
import { Button, Select, ToggleSwitch } from "flowbite-react";
import { HiTrash } from "react-icons/hi";
import { cn } from "@/lib/utils";
import type { LogEntry } from "../types";

export interface ExecutionLogsProps {
  /** Log entries to display (from SSE stream or historical data) */
  logs: LogEntry[];

  /** Whether logs are from live SSE stream (shows "Live" indicator) */
  isLive?: boolean;

  /** Callback to clear logs (optional, defaults to no-op) */
  onClearLogs?: () => void;
}

/**
 * Get color class for log level badge - STATIC lookup
 */
const logLevelColors: Record<string, string> = {
  info: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-400/30",
  warning: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-400/30",
  error: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-400/30",
  debug: "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-400/30",
};

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const logTime = new Date(timestamp).getTime();
  const diffSeconds = Math.floor((now - logTime) / 1000);

  if (diffSeconds < 0) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  return `${Math.floor(diffSeconds / 3600)}h ago`;
}

/**
 * Individual log entry component
 */
function LogEntryRow({ log }: { log: LogEntry }) {
  const colorClass = logLevelColors[log.level] || logLevelColors.debug;

  return (
    <div className="flex items-start gap-2 rounded px-2 py-1 font-mono text-sm hover:bg-white/5 dark:hover:bg-black/20">
      <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
        {formatRelativeTime(log.timestamp)}
      </span>
      <span className={cn("whitespace-nowrap rounded border px-1.5 py-0.5 text-xs uppercase", colorClass)}>
        {log.level}
      </span>
      {log.step && <span className="whitespace-nowrap text-xs text-cyan-600 dark:text-cyan-400">[{log.step}]</span>}
      <span className="min-w-0 flex-1 text-gray-900 dark:text-gray-300">{log.event}</span>
      {log.progress && (
        <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">{log.progress}</span>
      )}
    </div>
  );
}

export function ExecutionLogs({ logs, isLive = false, onClearLogs = () => {} }: ExecutionLogsProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [localLogs, setLocalLogs] = useState<LogEntry[]>(logs);
  const [isCleared, setIsCleared] = useState(false);
  const previousLogsLengthRef = useRef<number>(logs.length);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Update local logs when props change
  useEffect(() => {
    const currentLogsLength = logs.length;
    const previousLogsLength = previousLogsLengthRef.current;

    // If we cleared logs, only update if new logs arrive (length increases)
    if (isCleared) {
      if (currentLogsLength > previousLogsLength) {
        // New logs arrived after clear - reset cleared state and show new logs
        setLocalLogs(logs);
        setIsCleared(false);
      }
      // Otherwise, keep local logs empty (user's cleared view)
    } else {
      // Normal case: update local logs with prop changes
      setLocalLogs(logs);
    }

    previousLogsLengthRef.current = currentLogsLength;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs]);

  // Filter logs by level
  const filteredLogs = levelFilter === "all" ? localLogs : localLogs.filter((log) => log.level === levelFilter);

  /**
   * Handle clear logs button click
   */
  const handleClearLogs = () => {
    setLocalLogs([]);
    setIsCleared(true);
    onClearLogs();
  };

  /**
   * Auto-scroll to bottom when new logs arrive (if enabled)
   */
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [localLogs.length, autoScroll]); // Trigger on new logs, not filtered logs

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20 backdrop-blur dark:border-gray-700/30 dark:bg-white/5">
      {/* Header with controls */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gray-900/50 px-4 py-3 dark:border-gray-700/30 dark:bg-gray-800/30">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900 dark:text-gray-300">Execution Logs</span>

          {/* Live/Historical indicator */}
          {isLive ? (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500 dark:bg-green-400" />
              <span className="text-xs text-green-600 dark:text-green-400">Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-gray-500 dark:bg-gray-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Historical</span>
            </div>
          )}

          <span className="text-xs text-gray-500 dark:text-gray-400">({filteredLogs.length} entries)</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Level filter using Flowbite Select */}
          <Select
            id="log-level-filter"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="h-8 w-32 text-xs"
            sizing="sm"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </Select>

          {/* Auto-scroll toggle using Flowbite ToggleSwitch */}
          <div className="flex items-center gap-2">
            <label htmlFor="auto-scroll-toggle" className="text-xs text-gray-700 dark:text-gray-300">
              Auto-scroll:
            </label>
            <ToggleSwitch
              id="auto-scroll-toggle"
              checked={autoScroll}
              onChange={setAutoScroll}
              sizing="sm"
            />
            <span
              className={cn(
                "text-xs font-medium",
                autoScroll ? "text-cyan-600 dark:text-cyan-400" : "text-gray-500 dark:text-gray-400",
              )}
            >
              {autoScroll ? "ON" : "OFF"}
            </span>
          </div>

          {/* Clear logs button */}
          <Button
            color="gray"
            size="xs"
            onClick={handleClearLogs}
            className="h-8 text-xs text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
            disabled={localLogs.length === 0}
          >
            <HiTrash className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Clear logs
          </Button>
        </div>
      </div>

      {/* Log content - scrollable area */}
      <div ref={scrollContainerRef} className="max-h-96 overflow-y-auto bg-black/40 dark:bg-black/20">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <p>No logs match the current filter</p>
          </div>
        ) : (
          <div className="p-2">
            {filteredLogs.map((log, index) => (
              <LogEntryRow key={`${log.timestamp}-${index}`} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
