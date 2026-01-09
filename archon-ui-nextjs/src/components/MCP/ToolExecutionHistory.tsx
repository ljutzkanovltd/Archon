"use client";

import React, { useState, useMemo } from "react";
import { HiCheckCircle, HiXCircle, HiClock, HiFilter, HiRefresh } from "react-icons/hi";
import { useSessionDetails } from "@/hooks/useMcpQueries";
import type { McpRequest, McpRequestStatus } from "@/lib/types";

interface ToolExecutionHistoryProps {
  sessionId: string;
  className?: string;
}

export function ToolExecutionHistory({ sessionId, className = "" }: ToolExecutionHistoryProps) {
  const { data: sessionDetails, isLoading, error, refetch } = useSessionDetails(sessionId);
  const [statusFilter, setStatusFilter] = useState<McpRequestStatus | "all">("all");
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<McpRequest | null>(null);

  // Get unique tool names for filter dropdown
  const uniqueTools = useMemo(() => {
    if (!sessionDetails?.requests) return [];
    const tools = new Set(
      sessionDetails.requests
        .map((r) => r.tool_name)
        .filter((t): t is string => t !== null)
    );
    return Array.from(tools).sort();
  }, [sessionDetails?.requests]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    if (!sessionDetails?.requests) return [];

    return sessionDetails.requests.filter((request) => {
      // Status filter
      if (statusFilter !== "all" && request.status !== statusFilter) return false;

      // Tool filter
      if (toolFilter !== "all" && request.tool_name !== toolFilter) return false;

      return true;
    });
  }, [sessionDetails?.requests, statusFilter, toolFilter]);

  // Format duration
  const formatDuration = (ms: number | null): string => {
    if (ms === null) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Format cost
  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(6)}`;
  };

  // Get status badge
  const getStatusBadge = (status: McpRequestStatus) => {
    switch (status) {
      case "success":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <HiCheckCircle className="w-3 h-3" />
            Success
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <HiXCircle className="w-3 h-3" />
            Error
          </span>
        );
      case "timeout":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
            <HiClock className="w-3 h-3" />
            Timeout
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className={`p-8 text-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading session details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-8 text-center rounded-lg bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 ${className}`}>
        <HiXCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
        <p className="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load session</p>
        <p className="text-sm text-gray-500 dark:text-gray-500">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <HiRefresh className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!sessionDetails || !sessionDetails.requests || sessionDetails.requests.length === 0) {
    return (
      <div className={`p-8 text-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${className}`}>
        <HiClock className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
        <p className="text-gray-600 dark:text-gray-400 font-medium">No requests yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Tool executions will appear here when the session makes requests
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <HiFilter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as McpRequestStatus | "all")}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="timeout">Timeout</option>
        </select>

        {/* Tool filter */}
        <select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Tools</option>
          {uniqueTools.map((tool) => (
            <option key={tool} value={tool}>
              {tool}
            </option>
          ))}
        </select>

        {/* Results count */}
        <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {filteredRequests.length} {filteredRequests.length === 1 ? "request" : "requests"}
        </span>
      </div>

      {/* Summary stats */}
      {sessionDetails.summary && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Requests</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {sessionDetails.summary.total_requests}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Tokens</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {sessionDetails.summary.total_tokens.toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Prompt Tokens</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {sessionDetails.summary.total_prompt_tokens.toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Completion Tokens</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {sessionDetails.summary.total_completion_tokens.toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Cost</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCost(sessionDetails.summary.total_cost)}
            </p>
          </div>
        </div>
      )}

      {/* Request list */}
      <div className="space-y-2">
        {filteredRequests.map((request) => (
          <div
            key={request.request_id}
            className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
            onClick={() => setSelectedRequest(request)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Tool name and status */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-white truncate">
                    {request.tool_name || request.method}
                  </span>
                  {getStatusBadge(request.status)}
                </div>

                {/* Request details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Time:</span>{" "}
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatTimestamp(request.timestamp)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Duration:</span>{" "}
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatDuration(request.duration_ms)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Tokens:</span>{" "}
                    <span className="text-gray-900 dark:text-white font-medium">
                      {request.total_tokens.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Cost:</span>{" "}
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {formatCost(request.estimated_cost)}
                    </span>
                  </div>
                </div>

                {/* Error message if present */}
                {request.error_message && (
                  <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-700 dark:text-red-400 font-mono">
                      {request.error_message}
                    </p>
                  </div>
                )}
              </div>

              {/* Token breakdown */}
              <div className="text-right text-xs space-y-1">
                <div className="text-gray-500 dark:text-gray-400">
                  In: {request.prompt_tokens.toLocaleString()}
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  Out: {request.completion_tokens.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Request Details
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">
                    {selectedRequest.request_id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <HiXCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tool Name</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    {selectedRequest.tool_name || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Method</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    {selectedRequest.method}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Duration</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    {formatDuration(selectedRequest.duration_ms)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Timestamp</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    {new Date(selectedRequest.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Session ID</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    {selectedRequest.session_id.slice(0, 16)}...
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Token Usage</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Prompt</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedRequest.prompt_tokens.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Completion</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedRequest.completion_tokens.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedRequest.total_tokens.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Cost</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCost(selectedRequest.estimated_cost)}
                </p>
              </div>

              {selectedRequest.error_message && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Error Message</p>
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap">
                      {selectedRequest.error_message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
