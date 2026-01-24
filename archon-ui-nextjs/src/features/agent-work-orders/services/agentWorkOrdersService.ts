/**
 * Agent Work Orders API Service
 *
 * This service handles all API communication for agent work orders.
 * Backend API runs on port 8053 (separate microservice from main API on 8181).
 *
 * URL Resolution:
 * - Browser: Uses NEXT_PUBLIC_AGENT_WORK_ORDERS_URL (e.g., http://localhost:8053)
 * - Server (SSR): Uses AGENT_WORK_ORDERS_URL (Docker) or falls back to localhost:8053
 */

import axios, { AxiosInstance } from "axios";
import type {
  AgentWorkOrder,
  AgentWorkOrderStatus,
  CreateAgentWorkOrderRequest,
  StepHistory,
  WorkflowStep,
  WorkOrderLogsResponse,
} from "../types";

/**
 * Get the base URL for agent work orders API
 * Backend microservice runs on port 8053 (separate from main API on 8181)
 * Uses direct communication for stability isolation
 */
const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Browser context: Direct connection to microservice
    // CORS is configured on the service (allow_origins=["*"])
    return process.env.NEXT_PUBLIC_AGENT_WORK_ORDERS_URL || "http://localhost:8053";
  } else {
    // Server context (SSR): use Docker service name or fallback
    return process.env.AGENT_WORK_ORDERS_URL || process.env.NEXT_PUBLIC_AGENT_WORK_ORDERS_URL || "http://localhost:8053";
  }
};

/**
 * Create axios instance for agent work orders API
 */
const createApiClient = (): AxiosInstance => {
  const baseURL = getBaseUrl();

  return axios.create({
    baseURL,
    timeout: 60000, // 60s timeout for workflow operations
    headers: {
      "Content-Type": "application/json",
    },
  });
};

// Create singleton instance
const apiClient = createApiClient();

export const agentWorkOrdersService = {
  /**
   * Create a new agent work order
   *
   * @param request - The work order creation request
   * @returns Promise resolving to the created work order
   * @throws Error if creation fails
   */
  async createWorkOrder(request: CreateAgentWorkOrderRequest): Promise<AgentWorkOrder> {
    const response = await apiClient.post<AgentWorkOrder>("/api/agent-work-orders/", request);
    return response.data;
  },

  /**
   * List all agent work orders, optionally filtered by status
   *
   * @param statusFilter - Optional status to filter by
   * @returns Promise resolving to array of work orders
   * @throws Error if request fails
   */
  async listWorkOrders(statusFilter?: AgentWorkOrderStatus): Promise<AgentWorkOrder[]> {
    const params = statusFilter ? { status: statusFilter } : undefined;
    const response = await apiClient.get<AgentWorkOrder[]>("/api/agent-work-orders/", { params });
    return response.data;
  },

  /**
   * Get a single agent work order by ID
   *
   * @param id - The work order ID
   * @returns Promise resolving to the work order
   * @throws Error if work order not found or request fails
   */
  async getWorkOrder(id: string): Promise<AgentWorkOrder> {
    const response = await apiClient.get<AgentWorkOrder>(`/api/agent-work-orders/${id}`);
    return response.data;
  },

  /**
   * Get the complete step execution history for a work order
   *
   * @param id - The work order ID
   * @returns Promise resolving to the step history
   * @throws Error if work order not found or request fails
   */
  async getStepHistory(id: string): Promise<StepHistory> {
    const response = await apiClient.get<StepHistory>(`/api/agent-work-orders/${id}/steps`);
    return response.data;
  },

  /**
   * Start a pending work order (transition from pending to running)
   * This triggers backend execution by updating the status to "running"
   *
   * @param id - The work order ID to start
   * @returns Promise resolving to the updated work order
   * @throws Error if work order not found, already running, or request fails
   */
  async startWorkOrder(id: string): Promise<AgentWorkOrder> {
    const response = await apiClient.post<AgentWorkOrder>(`/api/agent-work-orders/${id}/start`);
    return response.data;
  },

  /**
   * Get historical logs for a work order
   * Fetches buffered logs from backend (not live streaming)
   *
   * @param id - The work order ID
   * @param options - Optional filters (limit, offset, level, step)
   * @returns Promise resolving to logs response
   * @throws Error if work order not found or request fails
   */
  async getWorkOrderLogs(
    id: string,
    options?: {
      limit?: number;
      offset?: number;
      level?: "info" | "warning" | "error" | "debug";
      step?: WorkflowStep;
    },
  ): Promise<WorkOrderLogsResponse> {
    const params = new URLSearchParams();

    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());
    if (options?.level) params.append("level", options.level);
    if (options?.step) params.append("step", options.step);

    const queryString = params.toString();
    const url = queryString ? `/api/agent-work-orders/${id}/logs?${queryString}` : `/api/agent-work-orders/${id}/logs`;

    const response = await apiClient.get<WorkOrderLogsResponse>(url);
    return response.data;
  },

  /**
   * Get SSE stream URL for real-time log monitoring
   * This URL should be used with EventSource for live updates
   *
   * @param id - The work order ID
   * @returns Full URL for SSE stream connection
   */
  getLogsStreamUrl(id: string): string {
    const baseURL = getBaseUrl();
    return `${baseURL}/api/agent-work-orders/${id}/logs/stream`;
  },
};

export default agentWorkOrdersService;
