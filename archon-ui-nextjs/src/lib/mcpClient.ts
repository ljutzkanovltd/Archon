/**
 * MCP Client Library
 *
 * Implements JSON-RPC 2.0 protocol for communicating with Archon MCP Server
 *
 * Protocol: https://www.jsonrpc.org/specification
 * Archon MCP Server: http://localhost:8051
 */

import axios, { AxiosInstance } from 'axios';

// JSON-RPC 2.0 Types
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: number | string;
}

interface JsonRpcResponse<T = any> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: number | string;
}

// MCP Tool Response Types
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface McpSearchResult {
  success: boolean;
  results?: any[];
  pages?: any[];
  chunks?: any[];
  return_mode?: string;
  reranked?: boolean;
  error?: string | null;
}

export interface McpSourcesResult {
  success: boolean;
  sources?: any[];
  count?: number;
  error?: string | null;
}

export interface McpPageResult {
  success: boolean;
  page?: {
    full_content: string;
    title: string;
    url: string;
    metadata?: any;
  };
  error?: string | null;
}

export interface McpProjectsResult {
  success: boolean;
  projects?: any[];
  project?: any;
  count?: number;
  total?: number;
  message?: string;
  error?: string | null;
}

export interface McpTasksResult {
  success: boolean;
  tasks?: any[];
  task?: any;
  count?: number;
  total_count?: number;
  message?: string;
  error?: string | null;
}

/**
 * MCP Client for JSON-RPC 2.0 communication with Archon MCP Server
 */
export class McpClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private timeout: number;
  private requestId: number = 0;

  constructor(baseUrl: string = 'http://localhost:8051', timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate next request ID
   */
  private getNextRequestId(): number {
    return ++this.requestId;
  }

  /**
   * Generic JSON-RPC 2.0 call
   */
  async call<T = any>(method: string, params?: any): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params: params || {},
      id: this.getNextRequestId(),
    };

    try {
      const response = await this.client.post<JsonRpcResponse<T>>('/', request);

      if (response.data.error) {
        throw new Error(
          `MCP Error [${response.data.error.code}]: ${response.data.error.message}`
        );
      }

      if (response.data.result === undefined) {
        throw new Error('Invalid JSON-RPC response: missing result');
      }

      return response.data.result;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('MCP Server not available. Is it running on port 8051?');
        }
        if (error.code === 'ETIMEDOUT') {
          throw new Error('MCP Server request timeout');
        }
        throw new Error(`MCP Server error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * List all available MCP tools
   */
  async listTools(): Promise<McpTool[]> {
    return this.call<McpTool[]>('tools/list');
  }

  /**
   * Call a specific MCP tool (generic)
   */
  async callTool<T = any>(toolName: string, params: any = {}): Promise<T> {
    return this.call<T>(`tools/call`, { name: toolName, arguments: params });
  }

  // ==================== Knowledge Base Tools ====================

  /**
   * Search knowledge base for relevant content
   *
   * @param query - Search query (2-5 keywords recommended)
   * @param sourceId - Optional source ID filter
   * @param matchCount - Max results (default: 5)
   * @param returnMode - "pages" or "chunks" (default: "pages")
   */
  async searchKnowledgeBase(
    query: string,
    sourceId?: string,
    matchCount: number = 5,
    returnMode: 'pages' | 'chunks' = 'pages'
  ): Promise<McpSearchResult> {
    return this.callTool('rag_search_knowledge_base', {
      query,
      source_id: sourceId,
      match_count: matchCount,
      return_mode: returnMode,
    });
  }

  /**
   * Search for code examples in knowledge base
   *
   * @param query - Search query (2-5 keywords recommended)
   * @param sourceId - Optional source ID filter
   * @param matchCount - Max results (default: 5)
   */
  async searchCodeExamples(
    query: string,
    sourceId?: string,
    matchCount: number = 5
  ): Promise<McpSearchResult> {
    return this.callTool('rag_search_code_examples', {
      query,
      source_id: sourceId,
      match_count: matchCount,
    });
  }

  /**
   * Get list of available knowledge sources
   */
  async getAvailableSources(): Promise<McpSourcesResult> {
    return this.callTool('rag_get_available_sources');
  }

  /**
   * List all pages for a given knowledge source
   *
   * @param sourceId - Source ID from getAvailableSources()
   * @param section - Optional section title filter
   */
  async listPagesForSource(
    sourceId: string,
    section?: string
  ): Promise<any> {
    return this.callTool('rag_list_pages_for_source', {
      source_id: sourceId,
      section,
    });
  }

  /**
   * Retrieve full page content from knowledge base
   *
   * @param pageId - Page UUID from search results
   * @param url - Alternative: Page URL
   */
  async readFullPage(pageId?: string, url?: string): Promise<McpPageResult> {
    return this.callTool('rag_read_full_page', {
      page_id: pageId,
      url,
    });
  }

  // ==================== Project Management Tools ====================

  /**
   * Find and search projects
   *
   * @param projectId - Get specific project by ID
   * @param query - Keyword search in title/description
   * @param page - Page number
   * @param perPage - Items per page
   */
  async findProjects(params: {
    projectId?: string;
    query?: string;
    page?: number;
    perPage?: number;
  } = {}): Promise<McpProjectsResult> {
    return this.callTool('find_projects', {
      project_id: params.projectId,
      query: params.query,
      page: params.page || 1,
      per_page: params.perPage || 10,
    });
  }

  /**
   * Manage projects (create/update/delete)
   *
   * @param action - "create" | "update" | "delete"
   * @param projectId - Project UUID for update/delete
   * @param title - Project title (required for create)
   * @param description - Project description
   * @param githubRepo - GitHub repository URL
   */
  async manageProject(params: {
    action: 'create' | 'update' | 'delete';
    projectId?: string;
    title?: string;
    description?: string;
    githubRepo?: string;
  }): Promise<McpProjectsResult> {
    return this.callTool('manage_project', {
      action: params.action,
      project_id: params.projectId,
      title: params.title,
      description: params.description,
      github_repo: params.githubRepo,
    });
  }

  // ==================== Task Management Tools ====================

  /**
   * Find and search tasks
   *
   * @param query - Keyword search
   * @param taskId - Get specific task by ID
   * @param filterBy - "status" | "project" | "assignee"
   * @param filterValue - Filter value
   * @param projectId - Project UUID filter
   * @param includeClosed - Include done tasks
   * @param page - Page number
   * @param perPage - Items per page
   */
  async findTasks(params: {
    query?: string;
    taskId?: string;
    filterBy?: string;
    filterValue?: string;
    projectId?: string;
    includeClosed?: boolean;
    page?: number;
    perPage?: number;
  } = {}): Promise<McpTasksResult> {
    return this.callTool('find_tasks', {
      query: params.query,
      task_id: params.taskId,
      filter_by: params.filterBy,
      filter_value: params.filterValue,
      project_id: params.projectId,
      include_closed: params.includeClosed !== false,
      page: params.page || 1,
      per_page: params.perPage || 10,
    });
  }

  /**
   * Manage tasks (create/update/delete)
   *
   * @param action - "create" | "update" | "delete"
   * @param taskId - Task UUID for update/delete
   * @param projectId - Project UUID for create
   * @param title - Task title
   * @param description - Task description
   * @param status - "todo" | "doing" | "review" | "done"
   * @param assignee - Assignee name
   * @param taskOrder - Priority (0-100)
   * @param feature - Feature label
   */
  async manageTask(params: {
    action: 'create' | 'update' | 'delete';
    taskId?: string;
    projectId?: string;
    title?: string;
    description?: string;
    status?: 'todo' | 'doing' | 'review' | 'done';
    assignee?: string;
    taskOrder?: number;
    feature?: string;
  }): Promise<McpTasksResult> {
    return this.callTool('manage_task', {
      action: params.action,
      task_id: params.taskId,
      project_id: params.projectId,
      title: params.title,
      description: params.description,
      status: params.status,
      assignee: params.assignee,
      task_order: params.taskOrder,
      feature: params.feature,
    });
  }

  // ==================== Document Management Tools ====================

  /**
   * Find and search documents
   */
  async findDocuments(params: {
    projectId: string;
    documentId?: string;
    query?: string;
    documentType?: string;
    page?: number;
    perPage?: number;
  }): Promise<any> {
    return this.callTool('find_documents', {
      project_id: params.projectId,
      document_id: params.documentId,
      query: params.query,
      document_type: params.documentType,
      page: params.page || 1,
      per_page: params.perPage || 10,
    });
  }

  /**
   * Manage documents (create/update/delete)
   */
  async manageDocument(params: {
    action: 'create' | 'update' | 'delete';
    projectId: string;
    documentId?: string;
    title?: string;
    documentType?: string;
    content?: any;
    tags?: string[];
    author?: string;
  }): Promise<any> {
    return this.callTool('manage_document', {
      action: params.action,
      project_id: params.projectId,
      document_id: params.documentId,
      title: params.title,
      document_type: params.documentType,
      content: params.content,
      tags: params.tags,
      author: params.author,
    });
  }

  // ==================== Health & Status ====================

  /**
   * Check MCP server health
   */
  async healthCheck(): Promise<any> {
    return this.callTool('health_check');
  }

  /**
   * Get session information
   */
  async sessionInfo(): Promise<any> {
    return this.callTool('session_info');
  }

  /**
   * Test connection to MCP server
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const mcpClient = new McpClient();

// Export for testing/custom instances
export default mcpClient;
