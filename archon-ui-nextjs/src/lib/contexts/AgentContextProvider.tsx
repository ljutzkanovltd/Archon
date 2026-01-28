/**
 * Agent Context Provider
 *
 * Wraps the Archon dashboard with CopilotKit and exposes user context
 * for AI agent operations with proper permission filtering.
 *
 * This provider bridges the gap between:
 * - User authentication state (from useAuthStore)
 * - Project context (from useProjectStore)
 * - CopilotKit AI agent (useCopilotReadable)
 *
 * The exposed context enables the AI agent to:
 * - Filter knowledge base results by user permissions
 * - Respect three-tier access controls (global/project/user)
 * - Track user actions for audit logging
 */

'use client';

import { useCopilotReadable } from '@copilotkit/react-core';
import { useAuthStore } from '@/store/useAuthStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useEffect, useMemo } from 'react';

// ===========================
// Type Definitions
// ===========================

export interface AgentUserContext {
  // User identity
  userId: string | null;
  email: string | null;
  fullName: string | null;
  role: string | null;

  // Project access
  currentProjectId: string | null;
  currentProjectTitle: string | null;
  accessibleProjectIds: string[];

  // Authentication state
  isAuthenticated: boolean;

  // Permissions (for future RBAC)
  permissions: string[];
}

// ===========================
// Agent Context Provider
// ===========================

export function AgentContextProvider({ children }: { children: React.ReactNode }) {
  // Get user from auth store
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Get current project from project store
  const selectedProject = useProjectStore((state) => state.selectedProject);
  const projects = useProjectStore((state) => state.projects);

  // Compute user context for agent
  // NOTE: For now, we use loaded projects from store for performance.
  // The user context service (services/user-context.ts) is used by
  // jwt-middleware.ts for server-side authentication and by the backend
  // for actual permission enforcement. This frontend context is for
  // displaying UI hints and providing context to the AI agent.
  const userContext = useMemo<AgentUserContext>(() => {
    // User identity
    const userId = user?.id || null;
    const email = user?.email || null;
    const fullName = user?.name || null;
    const role = user?.role || null;

    // Project context
    const currentProjectId = selectedProject?.id || null;
    const currentProjectTitle = selectedProject?.title || null;

    // Accessible project IDs from loaded projects
    // This is sufficient for frontend since:
    // 1. Backend API already filters projects by user access
    // 2. User can only load projects they have permission to see
    // 3. The user-context.ts service is used for backend validation
    const accessibleProjectIds = projects
      .filter(p => !p.archived)
      .map(p => p.id);

    // Permissions (from user object or default empty array)
    const permissions = user?.permissions || [];

    return {
      userId,
      email,
      fullName,
      role,
      currentProjectId,
      currentProjectTitle,
      accessibleProjectIds,
      isAuthenticated,
      permissions
    };
  }, [user, selectedProject, projects, isAuthenticated]);

  // Expose user context to CopilotKit agent via useCopilotReadable
  useCopilotReadable({
    description: `Current user context with authentication state and project access permissions.
      Use this to filter knowledge base results by user scope and verify project access.`,
    value: userContext
  });

  // Log context changes in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AgentContext] User context updated:', {
        userId: userContext.userId,
        email: userContext.email,
        role: userContext.role,
        currentProject: userContext.currentProjectTitle,
        accessibleProjects: userContext.accessibleProjectIds.length,
        isAuthenticated: userContext.isAuthenticated
      });
    }
  }, [userContext]);

  // Warn if user is not authenticated
  useEffect(() => {
    if (!isAuthenticated && process.env.NODE_ENV === 'development') {
      console.warn('[AgentContext] User is not authenticated - agent context will be limited');
    }
  }, [isAuthenticated]);

  return <>{children}</>;
}

// ===========================
// Hook: useAgentContext
// ===========================

/**
 * Hook to access agent user context directly in components
 *
 * Usage:
 * ```tsx
 * const agentContext = useAgentContext();
 * if (!agentContext.isAuthenticated) {
 *   return <LoginPrompt />;
 * }
 * ```
 */
export function useAgentContext(): AgentUserContext {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const selectedProject = useProjectStore((state) => state.selectedProject);
  const projects = useProjectStore((state) => state.projects);

  return useMemo<AgentUserContext>(() => ({
    userId: user?.id || null,
    email: user?.email || null,
    fullName: user?.name || null,
    role: user?.role || null,
    currentProjectId: selectedProject?.id || null,
    currentProjectTitle: selectedProject?.title || null,
    accessibleProjectIds: projects.filter(p => !p.archived).map(p => p.id),
    isAuthenticated,
    permissions: user?.permissions || []
  }), [user, selectedProject, projects, isAuthenticated]);
}

// ===========================
// Exports
// ===========================

export default AgentContextProvider;
