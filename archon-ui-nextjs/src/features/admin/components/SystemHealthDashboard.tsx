"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, Badge, Spinner, Alert, Button, Progress } from "flowbite-react";
import {
  HiServer,
  HiDatabase,
  HiUsers,
  HiRefresh,
  HiCheckCircle,
  HiXCircle,
  HiClock,
  HiChartBar,
} from "react-icons/hi";
import { apiClient } from "@/lib/apiClient";
import { ExportButton } from "@/components/ExportButton";

/**
 * System Health Dashboard - Monitor MCP, database, and session metrics
 *
 * Features:
 * - MCP server status
 * - Database health and table counts
 * - Active session monitoring
 * - Session age distribution (healthy/aging/stale)
 * - Connection health metrics (24h)
 * - Auto-refresh every 30 seconds
 * - Export functionality
 *
 * API Endpoints:
 * - GET /api/mcp/health - MCP health check
 * - GET /api/mcp/sessions/health - Session metrics
 * - GET /api/database/metrics - Database statistics
 * - GET /api/health - General API health
 *
 * Usage:
 * ```tsx
 * <SystemHealthDashboard />
 * ```
 */
export function SystemHealthDashboard() {
  // MCP Health
  const {
    data: mcpHealth,
    isLoading: mcpLoading,
    error: mcpError,
    refetch: refetchMCP,
  } = useQuery({
    queryKey: ["mcp-health"],
    queryFn: async () => {
      const response = await apiClient.get("/api/mcp/health");
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // Auto-refresh every 30 seconds
  });

  // Session Health
  const {
    data: sessionHealth,
    isLoading: sessionLoading,
    error: sessionError,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ["session-health"],
    queryFn: async () => {
      const response = await apiClient.get("/api/mcp/sessions/health");
      return response.data;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });

  // Database Metrics
  const {
    data: dbMetrics,
    isLoading: dbLoading,
    error: dbError,
    refetch: refetchDB,
  } = useQuery({
    queryKey: ["database-metrics"],
    queryFn: async () => {
      const response = await apiClient.get("/api/database/metrics");
      return response.data;
    },
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60,
  });

  // General API Health
  const {
    data: apiHealth,
    isLoading: apiLoading,
    refetch: refetchAPI,
  } = useQuery({
    queryKey: ["api-health"],
    queryFn: async () => {
      const response = await apiClient.get("/api/health");
      return response.data;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });

  const handleRefreshAll = () => {
    refetchMCP();
    refetchSessions();
    refetchDB();
    refetchAPI();
  };

  const isLoading = mcpLoading || sessionLoading || dbLoading || apiLoading;

  // Prepare export data
  const exportData = [
    {
      category: "MCP Server",
      status: mcpHealth?.status || "unknown",
      service: mcpHealth?.service || "mcp",
    },
    {
      category: "API Server",
      status: apiHealth?.status || "unknown",
      service: apiHealth?.service || "api",
    },
    {
      category: "Database",
      status: dbMetrics?.status || "unknown",
      database: dbMetrics?.database || "supabase",
      total_records: dbMetrics?.total_records || 0,
    },
    {
      category: "Active Sessions",
      count: sessionHealth?.status_breakdown?.active || 0,
      healthy: sessionHealth?.age_distribution?.healthy || 0,
      aging: sessionHealth?.age_distribution?.aging || 0,
      stale: sessionHealth?.age_distribution?.stale || 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HiServer className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              System Health Dashboard
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time monitoring of MCP, database, and sessions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={exportData}
            filename="system-health"
            headers={{
              category: "Category",
              status: "Status",
              service: "Service",
              count: "Count",
              healthy: "Healthy",
              aging: "Aging",
              stale: "Stale",
            }}
            size="sm"
          />
          <Button
            color="gray"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isLoading}
          >
            <HiRefresh className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Service Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* MCP Server Status */}
        <Card>
          <div className="flex items-center gap-4">
            <div
              className={`rounded-lg p-3 ${
                mcpHealth?.status === "healthy"
                  ? "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              {mcpHealth?.status === "healthy" ? (
                <HiCheckCircle className="h-6 w-6" />
              ) : (
                <HiXCircle className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                MCP Server
              </p>
              {mcpLoading ? (
                <Spinner size="sm" />
              ) : mcpError ? (
                <p className="text-sm font-bold text-red-600">Error</p>
              ) : (
                <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                  {mcpHealth?.status || "Unknown"}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* API Server Status */}
        <Card>
          <div className="flex items-center gap-4">
            <div
              className={`rounded-lg p-3 ${
                apiHealth?.status === "healthy"
                  ? "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              {apiHealth?.status === "healthy" ? (
                <HiCheckCircle className="h-6 w-6" />
              ) : (
                <HiXCircle className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                API Server
              </p>
              {apiLoading ? (
                <Spinner size="sm" />
              ) : (
                <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                  {apiHealth?.status || "Unknown"}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Database Status */}
        <Card>
          <div className="flex items-center gap-4">
            <div
              className={`rounded-lg p-3 ${
                dbMetrics?.status === "healthy"
                  ? "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
              }`}
            >
              <HiDatabase className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Database
              </p>
              {dbLoading ? (
                <Spinner size="sm" />
              ) : dbError ? (
                <p className="text-sm font-bold text-red-600">Error</p>
              ) : (
                <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                  {dbMetrics?.status || "Unknown"}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Active Sessions */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <HiUsers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Active Sessions
              </p>
              {sessionLoading ? (
                <Spinner size="sm" />
              ) : sessionError ? (
                <p className="text-sm font-bold text-red-600">Error</p>
              ) : (
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {sessionHealth?.status_breakdown?.active || 0}
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Database Metrics */}
      {dbMetrics && (
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Database Statistics
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatItem
              label="Projects"
              value={dbMetrics.tables?.projects || 0}
              icon={HiChartBar}
            />
            <StatItem
              label="Tasks"
              value={dbMetrics.tables?.tasks || 0}
              icon={HiChartBar}
            />
            <StatItem
              label="Crawled Pages"
              value={dbMetrics.tables?.crawled_pages || 0}
              icon={HiChartBar}
            />
            <StatItem
              label="Total Records"
              value={dbMetrics.total_records || 0}
              icon={HiDatabase}
              highlighted
            />
          </div>
        </Card>
      )}

      {/* Session Health Details */}
      {sessionHealth && (
        <>
          {/* Session Age Distribution */}
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Session Age Distribution
            </h3>
            <div className="space-y-4">
              <SessionAgeBar
                label="Healthy"
                count={sessionHealth.age_distribution?.healthy || 0}
                total={sessionHealth.status_breakdown?.active || 1}
                color="green"
                description="< 5 minutes since last activity"
              />
              <SessionAgeBar
                label="Aging"
                count={sessionHealth.age_distribution?.aging || 0}
                total={sessionHealth.status_breakdown?.active || 1}
                color="yellow"
                description="5-10 minutes since last activity"
              />
              <SessionAgeBar
                label="Stale"
                count={sessionHealth.age_distribution?.stale || 0}
                total={sessionHealth.status_breakdown?.active || 1}
                color="red"
                description="> 10 minutes since last activity"
              />
            </div>
          </Card>

          {/* Connection Health (24h) */}
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Connection Health (Last 24 Hours)
            </h3>
            <div className="grid gap-4 md:grid-cols-4">
              <StatItem
                label="Avg Duration"
                value={`${Math.floor((sessionHealth.connection_health?.avg_duration_seconds || 0) / 60)}m`}
                icon={HiClock}
              />
              <StatItem
                label="Sessions/Hour"
                value={sessionHealth.connection_health?.sessions_per_hour || 0}
                icon={HiUsers}
              />
              <StatItem
                label="Disconnect Rate"
                value={`${sessionHealth.connection_health?.disconnect_rate_percent || 0}%`}
                icon={HiXCircle}
              />
              <StatItem
                label="Total Sessions"
                value={sessionHealth.connection_health?.total_sessions_24h || 0}
                icon={HiChartBar}
              />
            </div>
          </Card>

          {/* Recent Activity */}
          {sessionHealth.recent_activity &&
            sessionHealth.recent_activity.length > 0 && (
              <Card>
                <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Session Activity
                </h3>
                <div className="space-y-2">
                  {sessionHealth.recent_activity.slice(0, 5).map((session: any) => (
                    <div
                      key={session.session_id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          color={session.status === "active" ? "success" : "gray"}
                          size="sm"
                        >
                          {session.status}
                        </Badge>
                        <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                          {session.session_id.substring(0, 8)}...
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {session.client_type}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(session.last_activity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
        </>
      )}

      {/* Error States */}
      {(mcpError || sessionError || dbError) && (
        <Alert color="warning">
          <span className="font-medium">Some health checks failed:</span>
          <ul className="mt-2 list-inside list-disc text-sm">
            {mcpError && <li>MCP Server health check failed</li>}
            {sessionError && <li>Session health check failed</li>}
            {dbError && <li>Database metrics unavailable</li>}
          </ul>
        </Alert>
      )}
    </div>
  );
}

/**
 * StatItem - Individual stat display
 */
interface StatItemProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  highlighted?: boolean;
}

function StatItem({ label, value, icon: Icon, highlighted = false }: StatItemProps) {
  return (
    <div
      className={`rounded-lg p-4 ${
        highlighted
          ? "bg-blue-50 dark:bg-blue-900/20"
          : "bg-gray-50 dark:bg-gray-800"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={`h-5 w-5 ${
            highlighted
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-400"
          }`}
        />
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * SessionAgeBar - Progress bar for session age distribution
 */
interface SessionAgeBarProps {
  label: string;
  count: number;
  total: number;
  color: "green" | "yellow" | "red";
  description: string;
}

function SessionAgeBar({
  label,
  count,
  total,
  color,
  description,
}: SessionAgeBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  const colorMap = {
    green: "success",
    yellow: "warning",
    red: "failure",
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white">
            {label}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            ({description})
          </span>
        </div>
        <span className="font-medium text-gray-900 dark:text-white">
          {count} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <Progress progress={percentage} color={colorMap[color]} size="lg" />
    </div>
  );
}
