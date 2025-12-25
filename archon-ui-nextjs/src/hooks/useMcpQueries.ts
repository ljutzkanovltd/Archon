import { useQuery } from "@tanstack/react-query";
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
