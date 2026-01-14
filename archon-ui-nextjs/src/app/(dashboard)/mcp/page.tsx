"use client";

import { useState } from "react";
import { usePageTitle, useMcpStatus, useMcpConfig, useMcpClients, useMcpSessionInfo, useMcpUsageStats } from "@/hooks";
import { HiServer } from "react-icons/hi";
import { McpConfigSection, McpStatusBar, McpClientList, UsageStatsCard, UsageByToolChart, ToolExecutionHistory, SessionTimeline, McpAnalytics, McpLogsViewer, SessionHealthMetrics, ViewToggle, UnifiedActivityView, ViewMode } from "@/components/MCP";

export default function McpPage() {
  usePageTitle("MCP Status", "Archon");

  // View mode state for switching between API/MCP/Unified views
  const [viewMode, setViewMode] = useState<ViewMode>("unified");

  // Fetch real MCP data with polling
  const { data: status, isLoading: statusLoading } = useMcpStatus();
  const { data: config } = useMcpConfig();
  const { data: clients = [] } = useMcpClients();
  const { data: sessionInfo } = useMcpSessionInfo();
  const { data: usageStats, isLoading: usageLoading } = useMcpUsageStats(30);

  // Show loading state
  if (statusLoading || !status) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <HiServer className="w-8 h-8 text-pink-500 animate-pulse" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              MCP Status Dashboard
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading server status...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <HiServer className="w-8 h-8 text-pink-500" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            MCP Status Dashboard
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Model Context Protocol server status and IDE configuration
        </p>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-6">
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Server Status Bar - Always visible */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${status.status === "running" ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
          Server Status
        </h2>
        <McpStatusBar status={status} sessionInfo={sessionInfo} config={config} />
      </div>

      {/* Unified Activity View - Show for all modes */}
      <div className="mb-6">
        <UnifiedActivityView viewMode={viewMode} />
      </div>

      {/* Session Health Metrics - Show for MCP and Unified modes */}
      {(viewMode === "mcp" || viewMode === "unified") && (
        <div className="mb-6">
          <SessionHealthMetrics />
        </div>
      )}

      {/* Connected Clients - Show for MCP and Unified modes */}
      {(viewMode === "mcp" || viewMode === "unified") && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
            Connected Clients
          </h2>
          <McpClientList clients={clients} />
        </div>
      )}

      {/* Tool Execution History - Show for MCP and Unified modes */}
      {(viewMode === "mcp" || viewMode === "unified") && clients.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
            Tool Execution History
          </h2>
          {clients.map((client) => (
            <div key={client.session_id} className="mb-6">
              <h3 className="text-lg font-medium mb-3 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span>{client.client_type}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  ({client.session_id.slice(0, 8)})
                </span>
              </h3>
              <ToolExecutionHistory sessionId={client.session_id} />
            </div>
          ))}
        </div>
      )}

      {/* Session Timeline - Show for MCP and Unified modes */}
      {(viewMode === "mcp" || viewMode === "unified") && clients.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
            Session Timeline
          </h2>
          {clients.map((client) => (
            <div key={client.session_id} className="mb-6">
              <h3 className="text-lg font-medium mb-3 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span>{client.client_type}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  ({client.session_id.slice(0, 8)})
                </span>
              </h3>
              <SessionTimeline sessionId={client.session_id} height={400} />
            </div>
          ))}
        </div>
      )}

      {/* Analytics Dashboard - Show for all modes */}
      <div className="mb-6">
        <McpAnalytics days={30} compare={true} />
      </div>

      {/* Logs Viewer - Show for MCP and Unified modes */}
      {(viewMode === "mcp" || viewMode === "unified") && (
        <div className="mb-6">
          <McpLogsViewer initialLevel="all" />
        </div>
      )}

      {/* Usage Statistics - Show for API and Unified modes */}
      {(viewMode === "api" || viewMode === "unified") && usageStats && (
        <div className="mb-6">
          <UsageStatsCard
            summary={usageStats.summary}
            period={usageStats.period}
            isLoading={usageLoading}
          />
        </div>
      )}

      {/* Usage by Tool - Show for API and Unified modes */}
      {(viewMode === "api" || viewMode === "unified") && usageStats && (
        <div className="mb-6">
          <UsageByToolChart
            byTool={usageStats.by_tool}
            isLoading={usageLoading}
          />
        </div>
      )}

      {/* IDE Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">
          IDE Configuration
        </h2>
        <McpConfigSection config={config} status={status} />
      </div>
    </div>
  );
}
