import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import {
  Project,
  Task,
  Document,
  CrawlRequest,
  UploadMetadata,
  ProgressResponse,
  ProgressListResponse,
  ProgressDetailResponse,
  StopOperationResponse
} from "./types";

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

// API Error type
export interface ApiError {
  message: string;
  status?: number;
  details?: unknown;
}

// Create Axios instance
// CRITICAL: Must use absolute URL for API calls to backend server
const API_BASE_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181")
  : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181");

console.log('[API Client] Base URL:', API_BASE_URL); // Debug log

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage (will be set by auth store)
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("archon_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const apiError: ApiError = {
      message: error.message || "An unexpected error occurred",
      status: error.response?.status,
      details: error.response?.data,
    };

    // Handle specific error codes
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      if (typeof window !== "undefined") {
        localStorage.removeItem("archon_token");
        // Note: Actual redirect would be handled by auth store
      }
      apiError.message = "Authentication required. Please log in.";
    } else if (error.response?.status === 403) {
      apiError.message = "You don't have permission to access this resource.";
    } else if (error.response?.status === 404) {
      apiError.message = "Resource not found.";
    } else if (error.response?.status === 500) {
      apiError.message = "Server error. Please try again later.";
    }

    console.error("API Error:", apiError);
    return Promise.reject(apiError);
  }
);

// ==================== PROJECT ENDPOINTS ====================

export const projectsApi = {
  /**
   * Get all projects
   */
  getAll: async (params?: {
    page?: number;
    per_page?: number;
    query?: string;
    include_archived?: boolean;
  }): Promise<PaginatedResponse<Project>> => {
    const response = await apiClient.get("/api/projects", { params });
    // Backend returns {projects: [...], count: 4, timestamp: "..."}
    // Transform to PaginatedResponse format
    const data = response.data;
    return {
      success: true,
      items: data.projects || [],
      total: data.count || 0,
      page: params?.page || 1,
      per_page: params?.per_page || 10,
    };
  },

  /**
   * Get project by ID
   */
  getById: async (id: string): Promise<Project> => {
    const response = await apiClient.get(`/api/projects/${id}`);
    // Backend returns project object directly, not wrapped
    return response.data;
  },

  /**
   * Create new project
   */
  create: async (data: {
    title: string;
    description?: string;
    github_repo?: string;
  }): Promise<Project> => {
    const response = await apiClient.post("/api/projects", data);
    return response.data.project;
  },

  /**
   * Update project
   */
  update: async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      github_repo: string;
    }>
  ): Promise<Project> => {
    const response = await apiClient.put(`/api/projects/${id}`, data);
    return response.data.project;
  },

  /**
   * Archive project
   */
  archive: async (id: string, archived_by: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`/api/projects/${id}/archive`, {
      archived_by,
    });
    return response.data;
  },

  /**
   * Unarchive project
   */
  unarchive: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`/api/projects/${id}/unarchive`);
    return response.data;
  },

  /**
   * Delete project
   */
  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/projects/${id}`);
    return response.data;
  },
};

// ==================== TASK ENDPOINTS ====================

export const tasksApi = {
  /**
   * Get all tasks
   */
  getAll: async (params?: {
    page?: number;
    per_page?: number;
    query?: string;
    filter_by?: "status" | "project" | "assignee";
    filter_value?: string;
    project_id?: string;
    include_closed?: boolean;
  }): Promise<PaginatedResponse<Task>> => {
    // Map frontend filter_by + filter_value to backend parameter names
    const backendParams: Record<string, any> = {
      page: params?.page,
      per_page: params?.per_page,
      q: params?.query,
      include_closed: params?.include_closed,
    };

    // Map filter_by + filter_value to backend parameters
    if (params?.filter_by && params?.filter_value) {
      if (params.filter_by === "status") {
        backendParams.status = params.filter_value;
      } else if (params.filter_by === "project") {
        backendParams.project_id = params.filter_value;
      } else if (params.filter_by === "assignee") {
        backendParams.assignee = params.filter_value;
      }
    }

    // Also support direct project_id parameter
    if (params?.project_id) {
      backendParams.project_id = params.project_id;
    }

    const response = await apiClient.get("/api/tasks", { params: backendParams });
    // Backend returns {tasks: [...], pagination: {total, page, per_page, pages}}
    // Transform to PaginatedResponse format
    const data = response.data;
    return {
      success: true,
      items: data.tasks || [],
      total: data.pagination?.total || 0,
      page: data.pagination?.page || params?.page || 1,
      per_page: data.pagination?.per_page || params?.per_page || 10,
    };
  },

  /**
   * Get task by ID
   */
  getById: async (id: string): Promise<Task> => {
    const response = await apiClient.get(`/api/tasks/${id}`);
    return response.data.task;
  },

  /**
   * Create new task
   */
  create: async (data: {
    project_id: string;
    title: string;
    description?: string;
    status?: "todo" | "doing" | "review" | "done";
    assignee?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    task_order?: number;
    feature?: string;
  }): Promise<Task> => {
    const response = await apiClient.post("/api/tasks", data);
    return response.data.task;
  },

  /**
   * Update task
   */
  update: async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      status: "todo" | "doing" | "review" | "done";
      assignee: string;
      priority: "low" | "medium" | "high" | "urgent";
      task_order: number;
      feature: string;
    }>
  ): Promise<Task> => {
    const response = await apiClient.put(`/api/tasks/${id}`, data);
    return response.data.task;
  },

  /**
   * Get task history
   */
  getHistory: async (
    taskId: string,
    params?: { field_name?: string; limit?: number }
  ) => {
    const response = await apiClient.get(`/api/tasks/${taskId}/history`, {
      params,
    });
    return response.data;
  },

  /**
   * Get completion statistics
   */
  getCompletionStats: async (params?: {
    project_id?: string;
    days?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get("/api/tasks/completion-stats", {
      params,
    });
    return response.data;
  },

  /**
   * Delete task
   */
  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/tasks/${id}`);
    return response.data;
  },

  /**
   * Archive task
   */
  archive: async (id: string, archived_by: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`/api/tasks/${id}/archive`, {
      archived_by,
    });
    return response.data;
  },

  /**
   * Unarchive task
   */
  unarchive: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`/api/tasks/${id}/unarchive`);
    return response.data;
  },
};

// ==================== DOCUMENT ENDPOINTS ====================

export const documentsApi = {
  /**
   * Get all documents
   */
  getAll: async (params: {
    project_id: string;
    page?: number;
    per_page?: number;
    query?: string;
    document_type?: "spec" | "design" | "note" | "prp" | "api" | "guide";
  }): Promise<PaginatedResponse<Document>> => {
    const response = await apiClient.get("/api/documents", { params });
    // Backend returns {documents: [...], pagination: {total, page, per_page, pages}}
    // Transform to PaginatedResponse format
    const data = response.data;
    return {
      success: true,
      items: data.documents || [],
      total: data.pagination?.total || 0,
      page: data.pagination?.page || params?.page || 1,
      per_page: data.pagination?.per_page || params?.per_page || 10,
    };
  },

  /**
   * Get document by ID
   */
  getById: async (projectId: string, documentId: string): Promise<Document> => {
    const response = await apiClient.get(
      `/api/documents?project_id=${projectId}&document_id=${documentId}`
    );
    return response.data.document;
  },

  /**
   * Create new document
   */
  create: async (data: {
    project_id: string;
    title: string;
    document_type: "spec" | "design" | "note" | "prp" | "api" | "guide";
    content?: Record<string, unknown>;
    tags?: string[];
    author?: string;
  }): Promise<Document> => {
    const response = await apiClient.post("/api/documents", data);
    return response.data.document;
  },

  /**
   * Update document
   */
  update: async (
    projectId: string,
    documentId: string,
    data: Partial<{
      title: string;
      document_type: "spec" | "design" | "note" | "prp" | "api" | "guide";
      content: Record<string, unknown>;
      tags: string[];
    }>
  ): Promise<Document> => {
    const response = await apiClient.put(
      `/api/documents?project_id=${projectId}&document_id=${documentId}`,
      data
    );
    return response.data.document;
  },

  /**
   * Delete document
   */
  delete: async (
    projectId: string,
    documentId: string
  ): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(
      `/api/documents?project_id=${projectId}&document_id=${documentId}`
    );
    return response.data;
  },
};

// ==================== KNOWLEDGE BASE ENDPOINTS ====================

/**
 * Options for recrawling a knowledge source.
 * All fields are optional - when not provided, backend uses stored metadata.
 */
export interface RecrawlOptions {
  max_depth?: number;  // 1-5, override stored value
  knowledge_type?: 'technical' | 'business';  // override stored value
  extract_code_examples?: boolean;  // override stored value
  tags?: string[];  // override stored value
}

export const knowledgeBaseApi = {
  /**
   * Get all knowledge sources with summaries
   */
  getSources: async () => {
    const response = await apiClient.get("/api/rag/sources");
    return response.data;
  },

  /**
   * Get source by ID
   */
  getSourceById: async (sourceId: string) => {
    const response = await apiClient.get(`/api/rag/sources/${sourceId}`);
    return response.data;
  },

  /**
   * Search knowledge base
   */
  search: async (params: {
    query: string;
    source_id?: string;
    match_count?: number;
    return_mode?: "pages" | "chunks";
  }) => {
    const response = await apiClient.get("/api/rag/search", { params });
    return response.data;
  },

  /**
   * Search code examples
   */
  searchCodeExamples: async (params: {
    query?: string;
    source_id?: string;
    match_count?: number;
  }) => {
    const { source_id, ...rest } = params;

    // If source_id is provided, use the specific endpoint
    if (source_id) {
      const response = await apiClient.get(`/api/knowledge-items/${source_id}/code-examples`, { params: rest });
      return response.data;
    }

    // Otherwise use the general search endpoint (POST)
    const response = await apiClient.post("/api/rag/code-examples", params);
    return response.data;
  },

  /**
   * Get full page content
   */
  getPage: async (params: { page_id?: string; url?: string }) => {
    const response = await apiClient.get("/api/rag/page", { params });
    return response.data;
  },

  /**
   * List pages/chunks for source
   */
  listPages: async (params: { source_id: string; section?: string; limit?: number; offset?: number }) => {
    const { source_id, ...rest } = params;
    const response = await apiClient.get(`/api/knowledge-items/${source_id}/chunks`, { params: rest });
    return response.data;
  },

  /**
   * Get document and code example counts for multiple sources in a single request.
   * Replaces N*2 individual requests with 1 efficient query.
   */
  getBulkCounts: async (sourceIds: string[]): Promise<{
    success: boolean;
    counts: Record<string, { documents_count: number; code_examples_count: number }>;
    total_sources: number;
  }> => {
    if (sourceIds.length === 0) {
      return { success: true, counts: {}, total_sources: 0 };
    }
    const response = await apiClient.get("/api/knowledge-items/bulk-counts", {
      params: { source_ids: sourceIds.join(",") }
    });
    return response.data;
  },

  /**
   * Crawl website URL and add to knowledge base
   */
  crawlUrl: async (data: CrawlRequest): Promise<ProgressResponse> => {
    const response = await apiClient.post("/api/knowledge-items/crawl", {
      url: data.url,
      knowledge_type: data.knowledge_type || "technical",
      tags: data.tags || [],
      max_depth: data.max_depth || 2,
      extract_code_examples: data.extract_code_examples ?? true,
    });
    return response.data;
  },

  /**
   * Upload document to knowledge base
   */
  uploadDocument: async (
    file: File,
    metadata: UploadMetadata
  ): Promise<ProgressResponse> => {
    const formData = new FormData();
    formData.append("file", file);

    if (metadata.knowledge_type) {
      formData.append("knowledge_type", metadata.knowledge_type);
    }
    if (metadata.tags?.length) {
      formData.append("tags", JSON.stringify(metadata.tags));
    }
    if (metadata.extract_code_examples !== undefined) {
      formData.append("extract_code_examples", String(metadata.extract_code_examples));
    }

    const response = await apiClient.post("/api/documents/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  /**
   * Update knowledge source metadata
   */
  updateSource: async (sourceId: string, data: import("./types").SourceUpdateRequest): Promise<ApiResponse<import("./types").KnowledgeSource>> => {
    const response = await apiClient.patch(`/api/rag/sources/${sourceId}`, data);
    return response.data;
  },

  /**
   * Delete knowledge source
   */
  deleteSource: async (sourceId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/rag/sources/${sourceId}`);
    return response.data;
  },

  /**
   * Trigger recrawl of knowledge source with optional parameter overrides.
   * @param sourceId - The source ID to recrawl
   * @param options - Optional parameters to override stored metadata
   */
  recrawl: async (
    sourceId: string,
    options?: RecrawlOptions
  ): Promise<ApiResponse<{ operation_id: string }>> => {
    const response = await apiClient.post(
      `/api/knowledge-items/${sourceId}/refresh`,
      options || {}
    );
    return response.data;
  },
};

// ==================== PROGRESS TRACKING ====================

/**
 * Transform backend progress response to frontend format
 */
function transformProgress(apiProgress: any): Progress {
  return {
    id: apiProgress.operation_id,
    operation_type: apiProgress.operation_type,
    status: apiProgress.status,
    progress_percentage: apiProgress.progress ?? 0,
    message: apiProgress.message,
    url: apiProgress.url,
    current_url: apiProgress.current_url,
    crawl_type: apiProgress.crawl_type,
    pages_crawled: apiProgress.pages_crawled,
    total_pages: apiProgress.total_pages,
    code_examples_found: apiProgress.code_examples_found,
    current_depth: apiProgress.current_depth,
    max_depth: apiProgress.max_depth,
    error_message: apiProgress.error_message,
    started_at: apiProgress.started_at,
    completed_at: apiProgress.completed_at,
  };
}

export const progressApi = {
  /**
   * Get all active progress operations
   */
  getAll: async (): Promise<ProgressListResponse> => {
    const response = await apiClient.get("/api/progress/");
    const backendData = response.data;

    return {
      success: true,
      operations: (backendData.operations || []).map(transformProgress),
      active_count: backendData.count || 0,
      total_count: backendData.count || 0,
    };
  },

  /**
   * Get specific progress operation by ID
   */
  getById: async (progressId: string): Promise<ProgressDetailResponse> => {
    const response = await apiClient.get(`/api/progress/${progressId}`);
    return {
      success: true,
      operation: transformProgress(response.data),
    };
  },

  /**
   * Stop/cancel an ongoing operation
   */
  stop: async (progressId: string): Promise<StopOperationResponse> => {
    const response = await apiClient.post(`/api/knowledge-items/stop/${progressId}`);
    return response.data;
  },
};

// ==================== SETTINGS ====================

export const settingsApi = {
  /**
   * Get all settings
   */
  getSettings: async (): Promise<ApiResponse<any>> => {
    const response = await apiClient.get("/api/settings");
    return response.data;
  },

  /**
   * Update settings section
   */
  updateSettings: async (request: any): Promise<ApiResponse<any>> => {
    const response = await apiClient.patch("/api/settings", request);
    return response.data;
  },

  /**
   * Reset settings to defaults
   */
  resetSettings: async (): Promise<ApiResponse<any>> => {
    const response = await apiClient.post("/api/settings/reset");
    return response.data;
  },

  /**
   * Test API key validity
   */
  testApiKey: async (provider: "openai" | "azure", apiKey: string): Promise<ApiResponse<{ valid: boolean }>> => {
    const response = await apiClient.post("/api/settings/test-api-key", {
      provider,
      api_key: apiKey,
    });
    return response.data;
  },
};

// ==================== MCP API ====================

export const mcpApi = {
  /**
   * Get MCP server status
   */
  getStatus: async (): Promise<{ status: "running" | "starting" | "stopped" | "stopping"; uptime: number | null; logs: string[] }> => {
    const response = await apiClient.get("/api/mcp/status");
    return response.data;
  },

  /**
   * Get MCP server configuration
   */
  getConfig: async (): Promise<{ transport: string; host: string; port: number; model_choice?: string }> => {
    const response = await apiClient.get("/api/mcp/config");
    return response.data;
  },

  /**
   * Get MCP session information
   */
  getSessionInfo: async (): Promise<{ active_sessions: number; session_timeout: number; server_uptime_seconds?: number }> => {
    const response = await apiClient.get("/api/mcp/sessions");
    return response.data;
  },

  /**
   * Get connected MCP clients
   */
  getClients: async (): Promise<{ clients: any[]; total: number }> => {
    const response = await apiClient.get("/api/mcp/clients");
    return response.data;
  },

  /**
   * Get MCP usage statistics
   */
  getUsageSummary: async (params?: {
    startDate?: string;
    endDate?: string;
    days?: number;
  }): Promise<{
    period: { start: string; end: string; days: number };
    summary: {
      total_requests: number;
      total_prompt_tokens: number;
      total_completion_tokens: number;
      total_tokens: number;
      total_cost: number;
      unique_sessions: number;
    };
    by_tool: Record<string, { count: number; tokens: number; cost: number }>;
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append("start_date", params.startDate);
    if (params?.endDate) queryParams.append("end_date", params.endDate);
    if (params?.days !== undefined) queryParams.append("days", params.days.toString());

    const url = `/api/mcp/usage/summary${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await apiClient.get(url);
    return response.data;
  },
};

// ==================== HEALTH CHECK ====================

export const healthApi = {
  /**
   * Check API health
   */
  check: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await apiClient.get("/health");
    return response.data;
  },

  /**
   * Get backup status
   */
  getBackupStatus: async () => {
    const response = await apiClient.get("/api/backup/status");
    return response.data;
  },
};

// Export the configured axios instance
export default apiClient;
