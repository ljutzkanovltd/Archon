/**
 * Archon MCP Client Wrapper
 * Provides typed interface for communicating with Archon MCP server via JSON-RPC 2.0
 *
 * Protocol: JSON-RPC 2.0 over HTTP
 * Endpoint: http://localhost:8051/mcp
 *
 * Critical Headers:
 * - Content-Type: application/json
 * - Accept: application/json, text/event-stream (BOTH required by FastMCP)
 */

// ===========================
// Type Definitions
// ===========================

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: Record<string, unknown>;
}

export interface MCPResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string;
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface SearchResult {
  page_id: string;
  url: string;
  title: string;
  preview: string;
  word_count: number;
  chunk_matches: number;
  similarity?: number;
}

export interface PageContent {
  success: boolean;
  page: {
    page_id: string;
    url: string;
    title: string;
    full_content: string;
    section_title?: string;
    word_count: number;
    metadata?: Record<string, unknown>;
  };
}

export interface CodeExample {
  id: string;
  source_id: string;
  language: string;
  code: string;
  summary: string;
  similarity?: number;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  github_repo?: string;
  created_at: string;
  archived?: boolean;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: string;
  assignee?: string;
  estimated_hours?: number;
  priority?: string;
}

export interface ArchonMCPClientConfig {
  mcpUrl?: string;
  timeout?: number;
}

// ===========================
// Error Classes
// ===========================

export class MCPError extends Error {
  constructor(
    message: string,
    public code?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class MCPTimeoutError extends MCPError {
  constructor(timeout: number) {
    super(`MCP request timed out after ${timeout}ms`, -32000);
    this.name = 'MCPTimeoutError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(message: string) {
    super(message, -32001);
    this.name = 'MCPConnectionError';
  }
}

// ===========================
// Archon MCP Client
// ===========================

export class ArchonMCPClient {
  private mcpUrl: string;
  private timeout: number;
  private sessionId: string | null = null;

  constructor(config: ArchonMCPClientConfig = {}) {
    this.mcpUrl = config.mcpUrl || 'http://localhost:8051/mcp';
    this.timeout = config.timeout || 30000; // 30 second default timeout
  }

  /**
   * Make a JSON-RPC 2.0 call to Archon MCP server
   *
   * CRITICAL: Must include both Accept headers for FastMCP compatibility
   */
  private async call<T>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const requestId = crypto.randomUUID();

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        // FastMCP requires BOTH accept types
        'Accept': 'application/json, text/event-stream',
      };

      // Include session ID if we have one
      if (this.sessionId) {
        headers['X-MCP-Session-Id'] = this.sessionId;
      }

      const response = await fetch(this.mcpUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new MCPConnectionError(
          `MCP server returned ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json() as MCPResponse<T>;

      // Handle JSON-RPC error
      if (data.error) {
        throw new MCPError(
          data.error.message,
          data.error.code,
          data.error.data
        );
      }

      // Extract result from content array
      if (data.result?.content?.[0]?.text) {
        return JSON.parse(data.result.content[0].text);
      }

      throw new MCPError('Invalid response format: missing result content');
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof MCPError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new MCPTimeoutError(this.timeout);
        }
        throw new MCPConnectionError(error.message);
      }

      throw new MCPError('Unknown error occurred');
    }
  }

  /**
   * Search knowledge base with semantic similarity
   *
   * @param query - Search query (keep short: 2-5 keywords)
   * @param source_id - Optional source filter (from rag_get_available_sources)
   * @param match_count - Number of results (default: 5)
   * @param return_mode - 'pages' (full pages) or 'chunks' (raw chunks)
   */
  async ragSearchKnowledgeBase(params: {
    query: string;
    source_id?: string;
    match_count?: number;
    return_mode?: 'pages' | 'chunks';
  }): Promise<{ success: boolean; results: SearchResult[]; return_mode: string }> {
    return this.call('tools/call', {
      name: 'rag_search_knowledge_base',
      arguments: {
        query: params.query,
        source_id: params.source_id || null,
        match_count: params.match_count || 5,
        return_mode: params.return_mode || 'pages'
      }
    });
  }

  /**
   * Read full page content from knowledge base
   *
   * @param page_id - Page UUID from search results
   * @param url - Page URL (alternative to page_id)
   */
  async ragReadFullPage(params: {
    page_id?: string;
    url?: string;
  }): Promise<PageContent> {
    if (!params.page_id && !params.url) {
      throw new MCPError('Either page_id or url must be provided');
    }

    return this.call('tools/call', {
      name: 'rag_read_full_page',
      arguments: {
        page_id: params.page_id || null,
        url: params.url || null
      }
    });
  }

  /**
   * Search for code examples
   *
   * @param query - Search query (programming concepts, patterns)
   * @param source_id - Optional source filter
   * @param match_count - Number of results (default: 5)
   */
  async ragSearchCodeExamples(params: {
    query: string;
    source_id?: string;
    match_count?: number;
  }): Promise<{ success: boolean; results: CodeExample[] }> {
    return this.call('tools/call', {
      name: 'rag_search_code_examples',
      arguments: {
        query: params.query,
        source_id: params.source_id || null,
        match_count: params.match_count || 5
      }
    });
  }

  /**
   * Get available knowledge sources
   */
  async ragGetAvailableSources(): Promise<{
    success: boolean;
    sources: Array<{
      id: string;
      title: string;
      url: string;
      scope?: string;
    }>;
    count: number;
  }> {
    return this.call('tools/call', {
      name: 'rag_get_available_sources',
      arguments: {}
    });
  }

  /**
   * Find projects (list, search, or get specific)
   *
   * @param query - Keyword search (optional)
   * @param project_id - Get specific project (optional)
   */
  async findProjects(params: {
    query?: string;
    project_id?: string;
  } = {}): Promise<{ success: boolean; projects: Project[] }> {
    return this.call('tools/call', {
      name: 'find_projects',
      arguments: {
        query: params.query || null,
        project_id: params.project_id || null
      }
    });
  }

  /**
   * Find tasks (list, search, filter)
   *
   * @param task_id - Get specific task (optional)
   * @param project_id - Filter by project (optional)
   * @param filter_by - Filter field: 'status', 'assignee', etc.
   * @param filter_value - Filter value
   * @param query - Keyword search
   */
  async findTasks(params: {
    task_id?: string;
    project_id?: string;
    filter_by?: string;
    filter_value?: string;
    query?: string;
  } = {}): Promise<{ success: boolean; tasks: Task[] }> {
    return this.call('tools/call', {
      name: 'find_tasks',
      arguments: {
        task_id: params.task_id || null,
        project_id: params.project_id || null,
        filter_by: params.filter_by || null,
        filter_value: params.filter_value || null,
        query: params.query || null
      }
    });
  }

  /**
   * Create a new task
   *
   * @param project_id - Project UUID (required)
   * @param title - Task title
   * @param description - Task description
   * @param assignee - Assigned agent/user
   * @param status - Task status
   */
  async manageTask(params: {
    action: 'create' | 'update' | 'delete';
    task_id?: string;
    project_id?: string;
    title?: string;
    description?: string;
    assignee?: string;
    status?: string;
    estimated_hours?: number;
    priority?: string;
  }): Promise<{ success: boolean; task?: Task; message: string }> {
    return this.call('tools/call', {
      name: 'manage_task',
      arguments: params
    });
  }

  /**
   * Health check - verify MCP server is accessible
   */
  async healthCheck(): Promise<{ status: string; uptime_seconds?: number }> {
    try {
      const response = await fetch(this.mcpUrl.replace('/mcp', '/health'), {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new MCPConnectionError(`Health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      throw new MCPConnectionError('MCP server is not accessible');
    }
  }
}

// ===========================
// Singleton Instance
// ===========================

let mcpClientInstance: ArchonMCPClient | null = null;

/**
 * Get singleton instance of Archon MCP client
 */
export function getArchonMCPClient(config?: ArchonMCPClientConfig): ArchonMCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new ArchonMCPClient(config);
  }
  return mcpClientInstance;
}

/**
 * Reset MCP client (useful for testing)
 */
export function resetArchonMCPClient(): void {
  mcpClientInstance = null;
}

// ===========================
// Exports
// ===========================

export default ArchonMCPClient;
