/**
 * CopilotKit Runtime API Route
 *
 * Provides AI-powered conversational interface for Archon knowledge base
 * Integrates CopilotRuntime with Archon MCP server
 *
 * Architecture:
 * User → CopilotKit UI → This Route → CopilotRuntime → Archon MCP (8051) → Knowledge Base
 */

import { CopilotRuntime, OpenAIAdapter } from '@copilotkit/runtime';
import { NextRequest } from 'next/server';
import { validateJWT, withAuth, type UserContext } from '@/lib/jwt-middleware';
import { getArchonMCPClient } from '@/lib/archon-mcp-client';
import {
  verifyProjectAccess,
  determineAccessScope,
  filterResultsByProjectAccess,
} from '@/lib/utils/verify-project-access';

// ===========================
// Environment Configuration
// ===========================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MCP_URL = process.env.MCP_URL || 'http://localhost:8051/mcp';

// ===========================
// CopilotKit Actions
// ===========================

/**
 * Define available actions for the agent
 * These wrap Archon MCP tools with user context and permissions
 */
function createCopilotActions(userContext: UserContext) {
  const mcpClient = getArchonMCPClient({ mcpUrl: MCP_URL });

  return [
    // Action 1: Search Knowledge Base
    {
      name: 'SearchArchonKnowledge',
      description: 'Search Archon knowledge base for documentation, guides, and technical content. Use for queries like "find authentication patterns" or "show me React hooks documentation".',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query (2-5 keywords work best). Example: "FastAPI authentication" or "React hooks"',
          required: true
        },
        {
          name: 'scope',
          type: 'string',
          description: 'Search scope: "global" (all knowledge), "project" (project-specific), or "user" (private docs)',
          enum: ['global', 'project', 'user']
        },
        {
          name: 'match_count',
          type: 'number',
          description: 'Number of results to return (default: 5, max: 20)'
        }
      ],
      handler: async ({ query, scope = 'project', match_count = 5 }: {
        query: string;
        scope?: string;
        match_count?: number;
      }) => {
        // Determine effective access scope based on user permissions
        const effectiveScope = determineAccessScope(
          userContext,
          scope as 'global' | 'project' | 'user',
          userContext.currentProjectId
        );

        // Validate project access if scope is 'project'
        if (effectiveScope === 'project' && userContext.currentProjectId) {
          const accessResult = verifyProjectAccess(userContext, userContext.currentProjectId);
          if (!accessResult.hasAccess) {
            return {
              success: false,
              error: `Access denied to project: ${accessResult.reason}`
            };
          }
        }

        try {
          const results = await mcpClient.ragSearchKnowledgeBase({
            query,
            match_count: Math.min(match_count, 20),
            return_mode: 'pages'
          });

          // Filter results by user permissions (additional security layer)
          // This ensures users only see results from projects they have access to
          const filteredResults = filterResultsByProjectAccess(
            userContext,
            results.results
          );

          return {
            success: true,
            results: filteredResults,
            count: filteredResults.length,
            query,
            scope: effectiveScope
          };
        } catch (error) {
          console.error('SearchArchonKnowledge error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Search failed'
          };
        }
      }
    },

    // Action 2: Read Full Page
    {
      name: 'ReadFullPage',
      description: 'Retrieve complete content of a knowledge base page. Use when user wants full details of a specific document.',
      parameters: [
        {
          name: 'page_id',
          type: 'string',
          description: 'Page UUID from search results'
        },
        {
          name: 'url',
          type: 'string',
          description: 'Page URL (alternative to page_id)'
        }
      ],
      handler: async ({ page_id, url }: { page_id?: string; url?: string }) => {
        if (!page_id && !url) {
          return {
            success: false,
            error: 'Either page_id or url must be provided'
          };
        }

        try {
          const result = await mcpClient.ragReadFullPage({ page_id, url });
          return result;
        } catch (error) {
          console.error('ReadFullPage error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read page'
          };
        }
      }
    },

    // Action 3: Search Code Examples
    {
      name: 'SearchCodeExamples',
      description: 'Search for code examples and programming patterns. Use for queries like "show me authentication code" or "find React component examples".',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query for code patterns (e.g., "JWT authentication", "React hooks")',
          required: true
        },
        {
          name: 'match_count',
          type: 'number',
          description: 'Number of code examples to return (default: 5)'
        }
      ],
      handler: async ({ query, match_count = 5 }: {
        query: string;
        match_count?: number;
      }) => {
        try {
          const results = await mcpClient.ragSearchCodeExamples({
            query,
            match_count: Math.min(match_count, 10)
          });

          return results;
        } catch (error) {
          console.error('SearchCodeExamples error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Code search failed'
          };
        }
      }
    },

    // Action 4: Find Projects
    {
      name: 'FindProjects',
      description: 'Search for projects or get project details. Use for queries like "show my projects" or "find authentication project".',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query for projects (optional)'
        },
        {
          name: 'project_id',
          type: 'string',
          description: 'Get specific project by ID (optional)'
        }
      ],
      handler: async ({ query, project_id }: {
        query?: string;
        project_id?: string;
      }) => {
        try {
          const results = await mcpClient.findProjects({ query, project_id });

          // Filter by accessible projects using verification utility
          const filteredProjects = filterResultsByProjectAccess(
            userContext,
            results.projects.map(p => ({ ...p, project_id: p.id }))
          );

          return {
            success: true,
            projects: filteredProjects,
            count: filteredProjects.length
          };
        } catch (error) {
          console.error('FindProjects error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Project search failed'
          };
        }
      }
    },

    // Action 5: Find Tasks
    {
      name: 'FindTasks',
      description: 'Search for tasks or get task details. Use for queries like "show my tasks" or "find authentication tasks".',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query for tasks (optional)'
        },
        {
          name: 'project_id',
          type: 'string',
          description: 'Filter by project ID (optional)'
        },
        {
          name: 'filter_by',
          type: 'string',
          description: 'Filter field: "status", "assignee", etc.',
          enum: ['status', 'assignee', 'priority']
        },
        {
          name: 'filter_value',
          type: 'string',
          description: 'Filter value (e.g., "in_progress", "backend-api-expert")'
        }
      ],
      handler: async ({ query, project_id, filter_by, filter_value }: {
        query?: string;
        project_id?: string;
        filter_by?: string;
        filter_value?: string;
      }) => {
        // Verify project access if project_id is specified
        if (project_id) {
          const accessResult = verifyProjectAccess(userContext, project_id);
          if (!accessResult.hasAccess) {
            return {
              success: false,
              error: `Access denied to project: ${accessResult.reason}`
            };
          }
        }

        try {
          const results = await mcpClient.findTasks({
            query,
            project_id,
            filter_by,
            filter_value
          });

          // Filter tasks by user's accessible projects
          if (results.tasks) {
            results.tasks = filterResultsByProjectAccess(
              userContext,
              results.tasks
            );
          }

          return results;
        } catch (error) {
          console.error('FindTasks error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Task search failed'
          };
        }
      }
    }
  ];
}

// ===========================
// API Route Handler
// ===========================

/**
 * POST /api/copilot
 *
 * Handles CopilotKit requests with JWT authentication
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (userContext) => {
    try {
      // Validate OpenAI API key
      if (!OPENAI_API_KEY) {
        return Response.json(
          { error: 'OpenAI API key not configured' },
          { status: 500 }
        );
      }

      // Create CopilotRuntime with user-scoped actions
      const runtime = new CopilotRuntime({
        actions: () => createCopilotActions(userContext)
      });

      // Create OpenAI adapter
      const serviceAdapter = new OpenAIAdapter({
        model: 'gpt-4-turbo-preview',
        apiKey: OPENAI_API_KEY
      });

      // Process request
      const { messages } = await req.json();

      const response = await runtime.process({
        messages,
        serviceAdapter,
        // Pass user context for additional tracking
        metadata: {
          userId: userContext.userId,
          email: userContext.email,
          role: userContext.role
        }
      });

      return Response.json(response);
    } catch (error) {
      console.error('CopilotKit runtime error:', error);

      return Response.json(
        {
          error: error instanceof Error ? error.message : 'Internal server error',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        },
        { status: 500 }
      );
    }
  });
}

// ===========================
// Health Check Endpoint
// ===========================

/**
 * GET /api/copilot
 *
 * Health check for CopilotKit endpoint
 */
export async function GET() {
  const mcpClient = getArchonMCPClient({ mcpUrl: MCP_URL });

  try {
    // Check MCP connectivity
    const mcpHealth = await mcpClient.healthCheck();

    return Response.json({
      status: 'ok',
      copilotkit: 'ready',
      mcp: mcpHealth,
      openai: OPENAI_API_KEY ? 'configured' : 'missing',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json(
      {
        status: 'degraded',
        copilotkit: 'ready',
        mcp: 'unreachable',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
