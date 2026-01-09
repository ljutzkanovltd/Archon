/**
 * Repository Service
 *
 * Service layer for repository CRUD operations.
 * Backend API runs on port 8053 (agent work orders microservice).
 */

import axios, { AxiosInstance } from "axios";
import type { ConfiguredRepository, CreateRepositoryRequest, UpdateRepositoryRequest } from "../types/repository";

/**
 * Get the base URL for agent work orders API
 * Backend microservice runs on port 8053
 */
const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Browser context: use NEXT_PUBLIC_ env var
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
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

// Create singleton instance
const apiClient = createApiClient();

/**
 * List all configured repositories
 * @returns Array of configured repositories ordered by created_at DESC
 */
export async function listRepositories(): Promise<ConfiguredRepository[]> {
  const response = await apiClient.get<ConfiguredRepository[]>("/api/agent-work-orders/repositories");
  return response.data;
}

/**
 * Get a single configured repository by ID
 * @param id - Repository ID
 * @returns The configured repository
 */
export async function getRepository(id: string): Promise<ConfiguredRepository> {
  const response = await apiClient.get<ConfiguredRepository>(`/api/agent-work-orders/repositories/${id}`);
  return response.data;
}

/**
 * Create a new configured repository
 * @param request - Repository creation request with URL and optional verification
 * @returns The created repository with metadata
 */
export async function createRepository(request: CreateRepositoryRequest): Promise<ConfiguredRepository> {
  const response = await apiClient.post<ConfiguredRepository>("/api/agent-work-orders/repositories", request);
  return response.data;
}

/**
 * Update an existing configured repository
 * @param id - Repository ID
 * @param request - Partial update request with fields to modify
 * @returns The updated repository
 */
export async function updateRepository(id: string, request: UpdateRepositoryRequest): Promise<ConfiguredRepository> {
  const response = await apiClient.patch<ConfiguredRepository>(`/api/agent-work-orders/repositories/${id}`, request);
  return response.data;
}

/**
 * Delete a configured repository
 * @param id - Repository ID to delete
 */
export async function deleteRepository(id: string): Promise<void> {
  await apiClient.delete(`/api/agent-work-orders/repositories/${id}`);
}

/**
 * Verify repository access and update metadata
 * Re-verifies GitHub repository access and updates display_name, owner, default_branch
 * @param id - Repository ID to verify
 * @returns Verification result with is_accessible boolean
 */
export async function verifyRepositoryAccess(id: string): Promise<{ is_accessible: boolean; repository_id: string }> {
  const response = await apiClient.post<{ is_accessible: boolean; repository_id: string }>(
    `/api/agent-work-orders/repositories/${id}/verify`
  );
  return response.data;
}

// Export all methods as named exports and default object
export const repositoryService = {
  listRepositories,
  getRepository,
  createRepository,
  updateRepository,
  deleteRepository,
  verifyRepositoryAccess,
};

export default repositoryService;
