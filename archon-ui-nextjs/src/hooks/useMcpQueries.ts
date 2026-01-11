import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { mcpApi } from "@/lib/apiClient";
import type { McpServerStatus, McpServerConfig, McpSessionInfo, McpClient } from "@/lib/types";

// Query keys factory
export const mcpKeys = {
  all: ["mcp"] as const,
  status: () => [...mcpKeys.all, "status"] as const,
  config: () => [...mcpKeys.all, "config"] as const,
  sessions: () => [...mcpKeys.all, "sessions"] as const,
  clients: () => [...mcpKeys.all, "clients"] as const,
  health: () => [...mcpKeys.all, "health"] as const,
  usage: (params?: { days?: number }) => [...mcpKeys.all, "usage", params] as const,
  sessionDetails: (sessionId: string) => [...mcpKeys.all, "session", sessionId] as const,
  errors: (params?: { severity?: string; limit?: number; sessionId?: string }) =>
    [...mcpKeys.all, "errors", params] as const,
  analytics: (params?: { days?: number; compare?: boolean }) =>
    [...mcpKeys.all, "analytics", params] as const,
  logs: (params?: { level?: string; search?: string; sessionId?: string }) =>
    [...mcpKeys.all, "logs", params] as const,
};

/**
 * Hook to fetch MCP server status with 5-second polling
 * Smart polling: 5s when visible, 10s when hidden
 *
 * @returns Query result with status, uptime, and logs
 */
export function useMcpStatus() {
  return useQuery({
    queryKey: mcpKeys.status(),
    queryFn: async () => {
      const data = await mcpApi.getStatus();
      // Normalize response to match McpServerStatus type
      return {
        status: data.status,
        uptime: data.uptime,
        logs: data.logs || [],
      } as McpServerStatus;
    },
    refetchInterval: (query) => {
      // Smart polling based on visibility
      return typeof document !== "undefined" && document.hidden ? 10000 : 5000;
    },
    refetchOnWindowFocus: true,
    staleTime: 2000, // 2 seconds stale time
  });
}

/**
 * Hook to fetch MCP server configuration
 * Config rarely changes, so no polling
 *
 * @returns Query result with transport, host, port
 */
export function useMcpConfig() {
  return useQuery({
    queryKey: mcpKeys.config(),
    queryFn: async () => {
      const data = await mcpApi.getConfig();
      // Normalize response to match McpServerConfig type
      return {
        transport: data.transport,
        host: data.host,
        port: data.port,
        model: data.model_choice,
      } as McpServerConfig;
    },
    staleTime: Infinity, // Config rarely changes
  });
}

/**
 * Hook to fetch connected MCP clients with 10-second polling
 * Smart polling: 10s when visible, 30s when hidden
 *
 * @returns Query result with clients array
 */
export function useMcpClients() {
  return useQuery({
    queryKey: mcpKeys.clients(),
    queryFn: async () => {
      const data = await mcpApi.getClients();
      return (data.clients || []) as McpClient[];
    },
    refetchInterval: (query) => {
      // Smart polling based on visibility
      return typeof document !== "undefined" && document.hidden ? 30000 : 10000;
    },
    refetchOnWindowFocus: true,
    staleTime: 5000, // 5 seconds stale time
  });
}

/**
 * Hook to fetch MCP session information with 10-second polling
 * Smart polling: 10s when visible, 30s when hidden
 *
 * @returns Query result with active sessions count and timeout
 */
export function useMcpSessionInfo() {
  return useQuery({
    queryKey: mcpKeys.sessions(),
    queryFn: async () => {
      const data = await mcpApi.getSessionInfo();
      return {
        active_sessions: data.active_sessions,
        session_timeout: data.session_timeout,
        server_uptime_seconds: data.server_uptime_seconds,
      } as McpSessionInfo;
    },
    refetchInterval: (query) => {
      // Smart polling based on visibility
      return typeof document !== "undefined" && document.hidden ? 30000 : 10000;
    },
    refetchOnWindowFocus: true,
    staleTime: 5000, // 5 seconds stale time
  });
}

/**
 * Hook to fetch MCP session health metrics with 10-second polling
 * Smart polling: 10s when visible, 30s when hidden
 *
 * @returns Query result with health metrics (status breakdown, age distribution, etc.)
 */
export function useMcpSessionHealth() {
  return useQuery({
    queryKey: mcpKeys.health(),
    queryFn: async () => {
      return await mcpApi.getSessionHealth();
    },
    refetchInterval: (query) => {
      // Smart polling based on visibility
      return typeof document !== "undefined" && document.hidden ? 30000 : 10000;
    },
    refetchOnWindowFocus: true,
    staleTime: 5000, // 5 seconds stale time
  });
}

/**
 * Hook to fetch MCP usage statistics with 30-second polling
 * Smart polling: 30s when visible, 60s when hidden
 *
 * @param days - Number of days to look back (default: 30)
 * @returns Query result with usage summary and breakdown by tool
 */
export function useMcpUsageStats(days: number = 30) {
  return useQuery({
    queryKey: mcpKeys.usage({ days }),
    queryFn: async () => {
      const data = await mcpApi.getUsageSummary({ days });
      return data;
    },
    refetchInterval: (query) => {
      // Smart polling based on visibility
      return typeof document !== "undefined" && document.hidden ? 60000 : 30000;
    },
    refetchOnWindowFocus: true,
    staleTime: 15000, // 15 seconds stale time
  });
}

/**
 * Hook to fetch MCP session details with request history
 * Smart polling: 10s when visible, 30s when hidden
 *
 * @param sessionId - Session UUID to fetch details for
 * @returns Query result with session metadata, requests, and summary
 */
export function useSessionDetails(sessionId: string) {
  return useQuery({
    queryKey: mcpKeys.sessionDetails(sessionId),
    queryFn: async () => {
      const data = await mcpApi.getSessionDetails(sessionId);
      return data;
    },
    refetchInterval: (query) => {
      // Smart polling based on visibility
      return typeof document !== "undefined" && document.hidden ? 30000 : 10000;
    },
    refetchOnWindowFocus: true,
    staleTime: 5000, // 5 seconds stale time
    enabled: !!sessionId, // Only fetch if sessionId is provided
  });
}

/**
 * Hook to fetch MCP errors with filtering
 * Smart polling: 10s when visible, 60s when hidden
 *
 * @param params - Filter parameters (severity, limit, sessionId)
 * @returns Query result with errors array and summary statistics
 */
export function useMcpErrors(params?: {
  severity?: "error" | "timeout" | "all";
  limit?: number;
  sessionId?: string;
}) {
  return useQuery({
    queryKey: mcpKeys.errors(params),
    queryFn: async () => {
      const data = await mcpApi.getErrors(params);
      return data;
    },
    refetchInterval: (query) => {
      // Smart polling based on visibility
      return typeof document !== "undefined" && document.hidden ? 60000 : 10000;
    },
    refetchOnWindowFocus: true,
    staleTime: 5000, // 5 seconds stale time
  });
}

/**
 * Hook to fetch comprehensive MCP analytics
 * Smart polling: 30s when visible, 120s when hidden (slower than real-time data)
 *
 * @param params - Analytics parameters (days, compare)
 * @returns Query result with trends, ratios, response times, and comparison
 */
export function useMcpAnalytics(params?: {
  days?: number;
  compare?: boolean;
}) {
  return useQuery({
    queryKey: mcpKeys.analytics(params),
    queryFn: async () => {
      const data = await mcpApi.getAnalytics(params);
      return data;
    },
    refetchInterval: (query) => {
      // Slower polling for analytics (less real-time critical)
      return typeof document !== "undefined" && document.hidden ? 120000 : 30000;
    },
    refetchOnWindowFocus: true,
    staleTime: 15000, // 15 seconds stale time
  });
}

/**
 * Hook to fetch MCP logs with infinite scroll pagination
 * Smart polling: 10s when visible, 60s when hidden
 *
 * @param params - Filter parameters (level, search, sessionId)
 * @param pageSize - Number of logs per page (default: 100)
 * @returns Infinite query result with pages of logs
 */
export function useMcpLogs(
  params?: {
    level?: "info" | "warning" | "error" | "all";
    search?: string;
    sessionId?: string;
  },
  pageSize: number = 100
) {
  return useInfiniteQuery({
    queryKey: mcpKeys.logs(params),
    queryFn: async ({ pageParam = 0 }) => {
      const data = await mcpApi.getLogs({
        ...params,
        limit: pageSize,
        offset: pageParam,
      });
      return data;
    },
    getNextPageParam: (lastPage) => {
      // Return next offset if there are more pages
      if (lastPage.pagination.has_more) {
        return lastPage.pagination.offset + lastPage.pagination.limit;
      }
      return undefined; // No more pages
    },
    refetchInterval: (query) => {
      // Smart polling based on visibility
      return typeof document !== "undefined" && document.hidden ? 60000 : 10000;
    },
    refetchOnWindowFocus: true,
    staleTime: 5000, // 5 seconds stale time
    initialPageParam: 0,
  });
}
