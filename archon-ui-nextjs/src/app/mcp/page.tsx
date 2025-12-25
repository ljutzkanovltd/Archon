"use client";

import { usePageTitle, useMcpStatus, useMcpConfig, useMcpClients, useMcpSessionInfo, useMcpUsageStats } from "@/hooks";
import { HiServer } from "react-icons/hi";
import { McpConfigSection, McpStatusBar, McpClientList, UsageStatsCard, UsageByToolChart } from "@/components/MCP";

export default function McpPage() {
  usePageTitle("MCP Status", "Archon");

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

      {/* Server Status Bar */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${status.status === "running" ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
          Server Status
        </h2>
        <McpStatusBar status={status} sessionInfo={sessionInfo} config={config} />
      </div>

      {/* Connected Clients */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
          Connected Clients
        </h2>
        <McpClientList clients={clients} />
      </div>

      {/* Usage Statistics */}
      {usageStats && (
        <div className="mb-6">
          <UsageStatsCard
            summary={usageStats.summary}
            period={usageStats.period}
            isLoading={usageLoading}
          />
        </div>
      )}

      {/* Usage by Tool */}
      {usageStats && (
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
