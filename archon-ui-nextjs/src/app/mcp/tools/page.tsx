"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { HiX } from "react-icons/hi";
import {
  ToolFilterBar,
  ToolFilters,
  ToolExecutionDetails,
  ToolExecution,
  ToolExecutionTimeline,
  TimelineExecution,
  ToolComparisonChart,
  ToolStats,
  SlowQueryDashboard,
  SlowExecution,
} from "@/components/MCP";

export default function ToolsPage() {
  const [filters, setFilters] = useState<ToolFilters>({
    timeRange: "1h",
    toolName: "",
    status: "all",
  });

  const [selectedExecution, setSelectedExecution] = useState<ToolExecution | null>(null);

  // Fetch tool execution data
  const { data: executionsData, isLoading } = useQuery({
    queryKey: ["mcp-tool-executions", filters],
    queryFn: async () => {
      // Calculate time range
      const now = new Date();
      const timeRangeMap: Record<ToolFilters["timeRange"], number> = {
        "5m": 5 * 60 * 1000,
        "15m": 15 * 60 * 1000,
        "1h": 60 * 60 * 1000,
        "6h": 6 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
      };
      const startTime = new Date(now.getTime() - timeRangeMap[filters.timeRange]);

      // Fetch from API
      const params = new URLSearchParams({
        start_time: startTime.toISOString(),
        end_time: now.toISOString(),
      });

      if (filters.toolName) {
        params.append("tool_name", filters.toolName);
      }
      if (filters.status !== "all") {
        params.append("status", filters.status);
      }
      if (filters.sessionId) {
        params.append("session_id", filters.sessionId);
      }

      const response = await fetch(`http://localhost:8181/api/mcp/requests?${params}`);
      if (!response.ok) throw new Error("Failed to fetch tool executions");

      const data = await response.json();
      return data.requests || [];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch available tool names for filter dropdown
  const { data: toolNames = [] } = useQuery({
    queryKey: ["mcp-tool-names"],
    queryFn: async () => {
      const response = await fetch("http://localhost:8181/api/mcp/analytics?days=7");
      if (!response.ok) return [];

      const data = await response.json();
      if (!data.response_times?.by_tool) return [];

      return Object.keys(data.response_times.by_tool);
    },
  });

  // Process executions data
  const executions: ToolExecution[] = useMemo(() => {
    if (!executionsData) return [];

    return executionsData.map((req: any) => ({
      request_id: req.request_id,
      session_id: req.session_id,
      tool_name: req.tool_name,
      timestamp: req.timestamp,
      duration_ms: req.duration_ms,
      status: req.status,
      request_params: req.request_params,
      response_data: req.response_data,
      error_message: req.error_message,
      token_count: req.token_count,
    }));
  }, [executionsData]);

  // Timeline data
  const timelineExecutions: TimelineExecution[] = useMemo(() => {
    return executions.map((exec) => ({
      request_id: exec.request_id,
      tool_name: exec.tool_name,
      timestamp: exec.timestamp,
      duration_ms: exec.duration_ms || 0,
      status: exec.status,
    }));
  }, [executions]);

  // Slow executions
  const slowExecutions: SlowExecution[] = useMemo(() => {
    return executions.map((exec) => ({
      request_id: exec.request_id,
      session_id: exec.session_id,
      tool_name: exec.tool_name,
      timestamp: exec.timestamp,
      duration_ms: exec.duration_ms || 0,
      status: exec.status,
      request_params: exec.request_params,
      error_message: exec.error_message,
    }));
  }, [executions]);

  // Tool stats for comparison
  const toolStats: ToolStats[] = useMemo(() => {
    const statsByTool = new Map<
      string,
      {
        calls: number;
        successes: number;
        errors: number;
        durations: number[];
      }
    >();

    executions.forEach((exec) => {
      if (!statsByTool.has(exec.tool_name)) {
        statsByTool.set(exec.tool_name, {
          calls: 0,
          successes: 0,
          errors: 0,
          durations: [],
        });
      }

      const stats = statsByTool.get(exec.tool_name)!;
      stats.calls++;
      if (exec.status === "success") stats.successes++;
      if (exec.status === "error") stats.errors++;
      if (exec.duration_ms) stats.durations.push(exec.duration_ms);
    });

    return Array.from(statsByTool.entries()).map(([toolName, stats]) => {
      const avgDuration =
        stats.durations.length > 0
          ? stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length
          : 0;

      const sortedDurations = [...stats.durations].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedDurations.length * 0.95);
      const p95Duration = sortedDurations[p95Index] || 0;

      return {
        tool_name: toolName,
        total_calls: stats.calls,
        success_rate: stats.calls > 0 ? stats.successes / stats.calls : 0,
        avg_duration_ms: avgDuration,
        p95_duration_ms: p95Duration,
        error_count: stats.errors,
      };
    });
  }, [executions]);

  // CSV Export
  const handleExport = () => {
    const csvHeaders = [
      "Request ID",
      "Session ID",
      "Tool Name",
      "Timestamp",
      "Duration (ms)",
      "Status",
      "Error Message",
    ];
    const csvRows = executions.map((exec) => [
      exec.request_id,
      exec.session_id,
      exec.tool_name,
      exec.timestamp,
      exec.duration_ms || 0,
      exec.status,
      exec.error_message || "",
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) =>
        row.map((cell) => (typeof cell === "string" && cell.includes(",") ? `"${cell}"` : cell)).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tool-executions-${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Tool Execution Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Deep dive into tool performance, timelines, and slow query detection
        </p>
      </div>

      {/* Filter Bar */}
      <div className="mb-6">
        <ToolFilterBar
          filters={filters}
          onChange={setFilters}
          onExport={handleExport}
          toolNames={toolNames}
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Content */}
      {!isLoading && (
        <div className="space-y-6">
          {/* Slow Query Dashboard */}
          <SlowQueryDashboard
            executions={slowExecutions}
            threshold={2000}
            onExecutionClick={(exec) =>
              setSelectedExecution(executions.find((e) => e.request_id === exec.request_id) || null)
            }
          />

          {/* Tool Comparison Chart */}
          {toolStats.length > 0 && (
            <ToolComparisonChart tools={toolStats} metric="avg_duration" />
          )}

          {/* Execution Timeline */}
          {timelineExecutions.length > 0 && (
            <ToolExecutionTimeline
              executions={timelineExecutions}
              onExecutionClick={(exec) =>
                setSelectedExecution(executions.find((e) => e.request_id === exec.request_id) || null)
              }
            />
          )}

          {/* Empty State */}
          {executions.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                No tool executions found for the selected filters
              </p>
            </div>
          )}
        </div>
      )}

      {/* Execution Details Modal */}
      {selectedExecution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Execution Details</h2>
              <button
                onClick={() => setSelectedExecution(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <HiX className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <ToolExecutionDetails execution={selectedExecution} />
          </div>
        </div>
      )}
    </div>
  );
}
