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
  StopOperationResponse,
  Progress
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
// DUAL-MODE SUPPORT:
// - Browser context: Use relative URLs ("") - Next.js proxy handles routing
// - Server context (SSR): Use API_SERVER_URL (Docker) or NEXT_PUBLIC_API_URL (local)
//
// URL Priority (SSR context):
// 1. API_SERVER_URL (Docker service name like archon-server:8181)
// 2. NEXT_PUBLIC_API_URL (fallback for hybrid mode)
// 3. localhost:8181 (final fallback)
const API_BASE_URL = typeof window !== 'undefined'
  ? "" // Browser: relative paths work with Next.js proxy
  : (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181");

// Debug logging only in development and server-side
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
  console.log('[API Client] Base URL:', API_BASE_URL || '(empty - using Next.js proxy)');
}

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
      // Unauthorized - use auth store's handleSessionExpiry
      if (typeof window !== "undefined") {
        // Dynamically import useAuthStore to avoid circular dependency
        import("@/store/useAuthStore").then(({ useAuthStore }) => {
          const store = useAuthStore.getState();
          store.handleSessionExpiry();
        });
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

  /**
   * Get project hierarchy
   * Phase 3.1: Project hierarchy tree
   */
  getProjectHierarchy: async (id: string): Promise<{
    parent: {
      id: string;
      title: string;
      description?: string;
      workflow_id?: string;
      relationship_type?: string;
    } | null;
    children: Array<{
      id: string;
      title: string;
      description?: string;
      workflow_id?: string;
      relationship_type?: string;
      task_count?: number;
    }>;
    ancestors: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
    siblings: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
    children_count: number;
    siblings_count: number;
  }> => {
    const response = await apiClient.get(`/api/projects/${id}/hierarchy`);
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
    workflow_stage_id?: string; // New: workflow stage ID
    status?: string; // Legacy: for backward compatibility
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
      workflow_stage_id: string; // New: workflow stage ID
      status: string; // Legacy: for backward compatibility
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
    const response = await apiClient.put(`/api/knowledge-items/${sourceId}`, data);
    return response.data;
  },

  /**
   * Delete knowledge source
   */
  deleteSource: async (sourceId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/knowledge-items/${sourceId}`);
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

  /**
   * Search within crawled page content using hybrid search.
   * Searches the archon_crawled_pages table using vector + full-text + RRF.
   *
   * @param params - Search parameters
   * @param params.query - Search query text
   * @param params.match_count - Number of results to fetch (default: 20)
   * @param params.source_id - Optional source ID to filter results
   * @param params.page - Page number for pagination (default: 1)
   * @param params.per_page - Items per page (default: 20)
   * @returns Paginated content search results
   */
  searchContent: async (params: {
    query: string;
    match_count?: number;
    source_id?: string;
    page?: number;
    per_page?: number;
  }): Promise<{
    success: boolean;
    results: Array<{
      id: string;
      url: string;
      chunk_number: number;
      content: string;
      metadata: Record<string, any>;
      source_id: string;
      similarity: number;
      match_type: string;
    }>;
    total: number;
    page: number;
    per_page: number;
    pages: number;
    query: string;
  }> => {
    const response = await apiClient.post("/api/knowledge/search", {
      query: params.query,
      match_count: params.match_count || 20,
      source_id: params.source_id,
      page: params.page || 1,
      per_page: params.per_page || 20,
    });
    return { success: true, ...response.data };
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

  /**
   * Pause an ongoing crawl operation
   */
  pause: async (progressId: string): Promise<{success: boolean; message: string; progressId: string}> => {
    const response = await apiClient.post(`/api/knowledge-items/pause/${progressId}`);
    return response.data;
  },

  /**
   * Resume a paused crawl operation
   */
  resume: async (progressId: string): Promise<{success: boolean; message: string; progressId: string}> => {
    const response = await apiClient.post(`/api/knowledge-items/resume/${progressId}`);
    return response.data;
  },
};

// ==================== KNOWLEDGE LINKS ====================

export const knowledgeLinksApi = {
  /**
   * Get AI-powered knowledge suggestions for a project
   */
  getProjectSuggestions: async (projectId: string, limit: number = 5): Promise<{
    success: boolean;
    suggestions: Array<{
      knowledge_id: string;
      knowledge_type: string;
      title: string;
      url?: string;
      relevance_score: number;
      content_preview?: string;
      source_id: string;
    }>;
    count: number;
    cached: boolean;
  }> => {
    const response = await apiClient.get(`/api/projects/${projectId}/knowledge/suggestions`, {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get AI-powered knowledge suggestions for a task
   */
  getTaskSuggestions: async (taskId: string, projectId: string, limit: number = 5): Promise<{
    success: boolean;
    suggestions: Array<{
      knowledge_id: string;
      knowledge_type: string;
      title: string;
      url?: string;
      relevance_score: number;
      content_preview?: string;
      source_id: string;
    }>;
    count: number;
    cached: boolean;
  }> => {
    const response = await apiClient.get(`/api/tasks/${taskId}/knowledge/suggestions`, {
      params: { project_id: projectId, limit },
    });
    return response.data;
  },

  /**
   * Get linked knowledge items for a project
   */
  getProjectKnowledge: async (projectId: string): Promise<{
    success: boolean;
    links: Array<any>;
    count: number;
  }> => {
    const response = await apiClient.get(`/api/projects/${projectId}/knowledge`);
    return response.data;
  },

  /**
   * Get linked knowledge items for a task
   */
  getTaskKnowledge: async (taskId: string, projectId: string): Promise<{
    success: boolean;
    links: Array<any>;
    count: number;
  }> => {
    const response = await apiClient.get(`/api/tasks/${taskId}/knowledge`, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  /**
   * Link knowledge item to a project
   */
  linkToProject: async (
    projectId: string,
    data: {
      knowledge_type: string;
      knowledge_id: string;
      relevance_score?: number;
    }
  ): Promise<{
    success: boolean;
    link: any;
    knowledge_item: any;
  }> => {
    const response = await apiClient.post(`/api/projects/${projectId}/knowledge`, data);
    return response.data;
  },

  /**
   * Link knowledge item to a task
   */
  linkToTask: async (
    taskId: string,
    projectId: string,
    data: {
      knowledge_type: string;
      knowledge_id: string;
      relevance_score?: number;
    }
  ): Promise<{
    success: boolean;
    link: any;
    knowledge_item: any;
  }> => {
    const response = await apiClient.post(`/api/tasks/${taskId}/knowledge`, data, {
      params: { project_id: projectId },
    });
    return response.data;
  },

  /**
   * Remove a knowledge link
   */
  unlink: async (linkId: string, projectId: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await apiClient.delete(`/api/knowledge-links/${linkId}`, {
      params: { project_id: projectId },
    });
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
   * Get MCP session health metrics
   */
  getSessionHealth: async (): Promise<{
    status_breakdown: {
      active: number;
      disconnected: number;
      total: number;
    };
    age_distribution: {
      healthy: number;
      aging: number;
      stale: number;
    };
    connection_health: {
      avg_duration_seconds: number;
      sessions_per_hour: number;
      disconnect_rate_percent: number;
      total_sessions_24h: number;
    };
    recent_activity: Array<{
      session_id: string;
      client_type: string;
      status: string;
      age_minutes: number;
      uptime_minutes: number;
    }>;
    timestamp: string;
  }> => {
    const response = await apiClient.get("/api/mcp/sessions/health");
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

  /**
   * Get MCP session details with request history
   */
  getSessionDetails: async (sessionId: string): Promise<any> => {
    const response = await apiClient.get(`/api/mcp/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Get MCP errors with filtering
   */
  getErrors: async (params?: {
    severity?: "error" | "timeout" | "all";
    limit?: number;
    sessionId?: string;
  }): Promise<{
    errors: any[];
    summary: {
      error_count: number;
      timeout_count: number;
      last_error_at: string | null;
      error_rate_percent: number;
    };
    total: number;
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.severity) queryParams.append("severity", params.severity);
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString());
    if (params?.sessionId) queryParams.append("session_id", params.sessionId);

    const url = `/api/mcp/errors${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  /**
   * Get comprehensive MCP analytics
   */
  getAnalytics: async (params?: {
    days?: number;
    compare?: boolean;
  }): Promise<import("./types").McpAnalyticsResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.days !== undefined) queryParams.append("days", params.days.toString());
    if (params?.compare !== undefined) queryParams.append("compare", params.compare.toString());

    const url = `/api/mcp/analytics${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  /**
   * Get MCP logs with filtering, search, and pagination
   */
  getLogs: async (params?: {
    level?: "info" | "warning" | "error" | "all";
    search?: string;
    sessionId?: string;
    limit?: number;
    offset?: number;
  }): Promise<import("./types").McpLogsResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.level) queryParams.append("level", params.level);
    if (params?.search) queryParams.append("search", params.search);
    if (params?.sessionId) queryParams.append("session_id", params.sessionId);
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString());
    if (params?.offset !== undefined) queryParams.append("offset", params.offset.toString());

    const url = `/api/mcp/logs${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await apiClient.get(url);
    return response.data;
  },
};

// ==================== ADMIN API ====================

export const adminApi = {
  /**
   * List all users with pagination and filtering
   */
  listUsers: async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status_filter?: "active" | "inactive" | "verified" | "unverified";
  }): Promise<import("./admin-types").UsersListResponse> => {
    const response = await apiClient.get("/api/admin/users", { params });
    return response.data;
  },

  /**
   * Invite user via email
   */
  inviteUser: async (
    data: import("./admin-types").InviteUserRequest
  ): Promise<import("./admin-types").InviteUserResponse> => {
    const response = await apiClient.post("/api/admin/users/invite", data);
    return response.data;
  },

  /**
   * Update user status (activate/deactivate)
   */
  updateUserStatus: async (
    userId: string,
    data: import("./admin-types").UpdateUserStatusRequest
  ): Promise<import("./admin-types").UpdateUserStatusResponse> => {
    const response = await apiClient.put(`/api/admin/users/${userId}/status`, data);
    return response.data;
  },

  /**
   * Get user permissions
   */
  getUserPermissions: async (
    userId: string
  ): Promise<import("./admin-types").UserPermissionsResponse> => {
    const response = await apiClient.get(`/api/admin/users/${userId}/permissions`);
    return response.data;
  },

  /**
   * Update user permissions
   */
  updateUserPermissions: async (
    userId: string,
    data: import("./admin-types").UpdateUserPermissionsRequest
  ): Promise<import("./admin-types").UpdateUserPermissionsResponse> => {
    const response = await apiClient.put(`/api/admin/users/${userId}/permissions`, data);
    return response.data;
  },

  /**
   * Update user details (name, email, role)
   */
  updateUser: async (
    userId: string,
    data: import("./admin-types").UpdateUserRequest
  ): Promise<import("./admin-types").UpdateUserResponse> => {
    const response = await apiClient.put(`/api/admin/users/${userId}`, data);
    return response.data;
  },

  /**
   * Send password reset email to user
   */
  sendPasswordReset: async (userId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(`/api/admin/users/${userId}/password-reset`);
    return response.data;
  },

  /**
   * Get user's accessible projects
   */
  getUserProjects: async (userId: string): Promise<import("./admin-types").UserProjectsResponse> => {
    const response = await apiClient.get(`/api/admin/users/${userId}/projects`);
    return response.data;
  },

  /**
   * Get project members
   */
  getProjectMembers: async (projectId: string): Promise<import("./admin-types").ProjectMembersResponse> => {
    const response = await apiClient.get(`/api/admin/projects/${projectId}/members`);
    return response.data;
  },

  /**
   * Add user to project
   */
  addProjectMember: async (
    projectId: string,
    data: import("./admin-types").AddProjectMemberRequest
  ): Promise<import("./admin-types").AddProjectMemberResponse> => {
    const response = await apiClient.post(`/api/admin/projects/${projectId}/members`, data);
    return response.data;
  },

  /**
   * Remove user from project
   */
  removeProjectMember: async (
    projectId: string,
    userId: string
  ): Promise<import("./admin-types").RemoveProjectMemberResponse> => {
    const response = await apiClient.delete(`/api/admin/projects/${projectId}/members/${userId}`);
    return response.data;
  },
};

// ==================== WORKFLOW ENDPOINTS ====================

export const workflowsApi = {
  /**
   * Get all workflows
   * API returns: { workflows: Workflow[], count: number }
   */
  getAll: async (): Promise<{
    workflows: import("./types").Workflow[];
    count: number;
  }> => {
    const response = await apiClient.get(`/api/workflows`);
    return response.data;
  },

  /**
   * Get a single workflow by ID
   * API returns: Workflow object directly (with stages included)
   */
  getById: async (workflowId: string): Promise<import("./types").Workflow> => {
    const response = await apiClient.get(`/api/workflows/${workflowId}`);
    return response.data; // API returns workflow directly, not wrapped
  },

  /**
   * Get workflow stages for a workflow
   * API returns: { stages: WorkflowStage[], count: number }
   */
  getStages: async (workflowId: string): Promise<{
    stages: import("./types").WorkflowStage[];
    count: number;
  }> => {
    const response = await apiClient.get(`/api/workflows/${workflowId}/stages`);
    return response.data;
  },

  /**
   * Get workflow stages for a workflow (legacy alias)
   * @deprecated Use getStages instead
   */
  getWorkflowStages: async (workflowId: string): Promise<{
    stages: import("./types").WorkflowStage[];
    count: number;
  }> => {
    return workflowsApi.getStages(workflowId);
  },

  /**
   * Get default workflow for a project (Standard Agile workflow)
   * API returns: { stages: WorkflowStage[], count: number }
   */
  getDefaultWorkflow: async (): Promise<{
    stages: import("./types").WorkflowStage[];
    count: number;
  }> => {
    // Use the Standard Agile workflow ID (from seed data)
    const workflowId = "29d6341c-0352-46e7-95d3-c26ae27a1aff";
    const response = await apiClient.get(`/api/workflows/${workflowId}/stages`);
    return response.data;
  },

  /**
   * Get all project types
   * API returns: { project_types: ProjectType[], count: number }
   */
  getProjectTypes: async (): Promise<{
    project_types: import("./types").ProjectType[];
    count: number;
  }> => {
    const response = await apiClient.get(`/api/project-types`);
    return response.data;
  },

  /**
   * Update project workflow assignment
   * API returns: { project: Project }
   */
  updateProjectWorkflow: async (projectId: string, workflowId: string): Promise<import("./types").Project> => {
    const response = await apiClient.put(`/api/projects/${projectId}/workflow`, {
      workflow_id: workflowId,
    });
    return response.data.project;
  },

  /**
   * Update workflow stage agent assignment
   * API returns: { stage: WorkflowStage }
   */
  updateStageAgent: async (stageId: string, agentName: string | null): Promise<import("./types").WorkflowStage> => {
    const response = await apiClient.put(`/api/workflow-stages/${stageId}/agent`, {
      default_agent: agentName,
    });
    return response.data.stage;
  },

  /**
   * Transition task to a different workflow stage
   * API returns: { task: Task }
   */
  transitionTask: async (taskId: string, newStageId: string): Promise<import("./types").Task> => {
    const response = await apiClient.post(`/api/tasks/${taskId}/transition`, {
      workflow_stage_id: newStageId,
    });
    return response.data.task;
  },
};

// ==================== SPRINT ENDPOINTS ====================

export const sprintsApi = {
  /**
   * Get all sprints for a project
   * API returns: { sprints: Sprint[], count: number }
   */
  getAll: async (projectId: string): Promise<{
    sprints: import("./types").Sprint[];
    count: number;
  }> => {
    const response = await apiClient.get(`/api/projects/${projectId}/sprints`);
    return response.data;
  },

  /**
   * Get active sprint for a project
   * API returns: Sprint | null
   */
  getActive: async (projectId: string): Promise<import("./types").Sprint | null> => {
    const response = await apiClient.get(`/api/projects/${projectId}/sprints/active`);
    return response.data.sprint || null;
  },

  /**
   * Get sprint by ID
   * API returns: { sprint: Sprint }
   */
  getById: async (sprintId: string): Promise<import("./types").Sprint> => {
    const response = await apiClient.get(`/api/sprints/${sprintId}`);
    return response.data.sprint;
  },

  /**
   * Create a new sprint
   * API expects: { name: string, goal?: string, start_date: string, end_date: string }
   * API returns: { sprint: Sprint }
   */
  create: async (
    projectId: string,
    data: {
      name: string;
      goal?: string;
      start_date: string;
      end_date: string;
    }
  ): Promise<import("./types").Sprint> => {
    const response = await apiClient.post(`/api/projects/${projectId}/sprints`, data);
    return response.data.sprint;
  },

  /**
   * Start a sprint (change status from planned to active)
   * API returns: { sprint: Sprint }
   */
  start: async (sprintId: string): Promise<import("./types").Sprint> => {
    const response = await apiClient.post(`/api/sprints/${sprintId}/start`);
    return response.data.sprint;
  },

  /**
   * Complete a sprint (change status from active to completed)
   * API returns: { sprint: Sprint }
   */
  complete: async (sprintId: string): Promise<import("./types").Sprint> => {
    const response = await apiClient.post(`/api/sprints/${sprintId}/complete`);
    return response.data.sprint;
  },

  /**
   * Get sprint velocity
   * API returns: { sprint_id: string, velocity: number, completed_points: number }
   */
  getVelocity: async (sprintId: string): Promise<{
    sprint_id: string;
    velocity: number;
    completed_points: number;
  }> => {
    const response = await apiClient.get(`/api/sprints/${sprintId}/velocity`);
    return response.data;
  },
};

// ==================== TEAM ENDPOINTS ====================

export const teamsApi = {
  /**
   * Get all teams, optionally filtered by project
   * API returns: { teams: Team[], count: number }
   */
  getAll: async (projectId?: string): Promise<{
    teams: import("./types").Team[];
    count: number;
  }> => {
    const params = projectId ? { project_id: projectId } : undefined;
    const response = await apiClient.get("/api/teams", { params });
    return response.data;
  },

  /**
   * Get team by ID with members
   * API returns: { team: Team, members: TeamMember[], count: number }
   */
  getById: async (teamId: string, includeMembers: boolean = true): Promise<{
    team: import("./types").Team;
    members: import("./types").TeamMember[];
    count: number;
  }> => {
    const response = await apiClient.get(`/api/teams/${teamId}`, {
      params: { include_members: includeMembers },
    });
    return response.data;
  },

  /**
   * Create a new team
   * API expects: { name: string, description?: string, project_id?: string }
   * API returns: { team: Team }
   */
  create: async (data: {
    name: string;
    description?: string;
    project_id?: string;
  }): Promise<import("./types").Team> => {
    const response = await apiClient.post("/api/teams", data);
    return response.data.team;
  },

  /**
   * Update team details
   * API expects: { name?: string, description?: string }
   * API returns: { team: Team }
   */
  update: async (
    teamId: string,
    data: {
      name?: string;
      description?: string;
    }
  ): Promise<import("./types").Team> => {
    const response = await apiClient.put(`/api/teams/${teamId}`, data);
    return response.data.team;
  },

  /**
   * Delete a team
   * API returns: { message: string }
   */
  delete: async (teamId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/teams/${teamId}`);
    return response.data;
  },

  /**
   * Add a member to a team
   * API expects: { user_id: string, role: TeamRole }
   * API returns: { member: TeamMember, team: Team }
   */
  addMember: async (
    teamId: string,
    data: {
      user_id: string;
      role: import("./types").TeamRole;
    }
  ): Promise<{
    member: import("./types").TeamMember;
    team: import("./types").Team;
  }> => {
    const response = await apiClient.post(`/api/teams/${teamId}/members`, data);
    return response.data;
  },

  /**
   * Remove a member from a team
   * API returns: { message: string }
   */
  removeMember: async (teamId: string, userId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/teams/${teamId}/members/${userId}`);
    return response.data;
  },

  /**
   * Update a member's role
   * API expects: { role: TeamRole }
   * API returns: { member: TeamMember }
   */
  updateMemberRole: async (
    teamId: string,
    userId: string,
    role: import("./types").TeamRole
  ): Promise<{ member: import("./types").TeamMember }> => {
    const response = await apiClient.put(
      `/api/teams/${teamId}/members/${userId}/role`,
      { role }
    );
    return response.data;
  },

  /**
   * Get teams for a specific user
   * API returns: { teams: Team[], count: number }
   */
  getUserTeams: async (userId: string, projectId?: string): Promise<{
    teams: import("./types").Team[];
    count: number;
  }> => {
    const params = projectId ? { project_id: projectId } : undefined;
    const response = await apiClient.get(`/api/users/${userId}/teams`, { params });
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
