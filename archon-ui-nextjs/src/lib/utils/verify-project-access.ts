/**
 * Project Access Verification Utility
 *
 * Validates user access to specific projects for CopilotKit actions.
 * Implements three-tier security model:
 * 1. Frontend context (UI hints)
 * 2. Backend validation (this file)
 * 3. Database RLS (enforced by Supabase)
 */

import type { UserContext } from '../jwt-middleware';

// ===========================
// Type Definitions
// ===========================

export interface ProjectAccessResult {
  hasAccess: boolean;
  reason?: string;
  scope: 'global' | 'project' | 'user' | 'none';
}

export type ScopeLevel = 'global' | 'project' | 'user';

// ===========================
// Access Verification Functions
// ===========================

/**
 * Verify user has access to a specific project
 *
 * @param userContext - User context from JWT validation
 * @param projectId - Project UUID to check access for
 * @returns Access result with hasAccess boolean and reason
 */
export function verifyProjectAccess(
  userContext: UserContext,
  projectId: string
): ProjectAccessResult {
  // Admin users have access to everything
  if (userContext.role === 'admin') {
    return {
      hasAccess: true,
      reason: 'Admin role grants access to all projects',
      scope: 'global',
    };
  }

  // Check if project is in user's accessible projects list
  const hasProjectAccess = userContext.accessibleProjectIds.includes(projectId);

  if (hasProjectAccess) {
    return {
      hasAccess: true,
      reason: 'User has explicit access to project',
      scope: 'project',
    };
  }

  // Check wildcard access (backward compatibility)
  const hasWildcardAccess = userContext.accessibleProjectIds.includes('*');

  if (hasWildcardAccess) {
    return {
      hasAccess: true,
      reason: 'User has wildcard access to all projects',
      scope: 'global',
    };
  }

  // No access
  return {
    hasAccess: false,
    reason: 'User does not have access to this project',
    scope: 'none',
  };
}

/**
 * Verify user has access to at least one project in a list
 *
 * @param userContext - User context from JWT validation
 * @param projectIds - Array of project UUIDs to check
 * @returns Access result with array of accessible project IDs
 */
export function verifyMultipleProjectAccess(
  userContext: UserContext,
  projectIds: string[]
): {
  hasAccess: boolean;
  accessibleProjectIds: string[];
  deniedProjectIds: string[];
} {
  // Admin users have access to all projects
  if (userContext.role === 'admin') {
    return {
      hasAccess: true,
      accessibleProjectIds: projectIds,
      deniedProjectIds: [],
    };
  }

  // Wildcard access grants access to all
  if (userContext.accessibleProjectIds.includes('*')) {
    return {
      hasAccess: true,
      accessibleProjectIds: projectIds,
      deniedProjectIds: [],
    };
  }

  // Filter projects by user's accessible project IDs
  const accessible: string[] = [];
  const denied: string[] = [];

  for (const projectId of projectIds) {
    if (userContext.accessibleProjectIds.includes(projectId)) {
      accessible.push(projectId);
    } else {
      denied.push(projectId);
    }
  }

  return {
    hasAccess: accessible.length > 0,
    accessibleProjectIds: accessible,
    deniedProjectIds: denied,
  };
}

/**
 * Determine user's access scope level
 *
 * Used for filtering knowledge base queries by scope.
 *
 * @param userContext - User context from JWT validation
 * @param requestedScope - Requested scope level (optional)
 * @param currentProjectId - Current project context (optional)
 * @returns Effective scope level for the query
 */
export function determineAccessScope(
  userContext: UserContext,
  requestedScope?: ScopeLevel,
  currentProjectId?: string
): ScopeLevel {
  // Admin users can access any scope
  if (userContext.role === 'admin') {
    return requestedScope || 'global';
  }

  // Wildcard access can use any scope
  if (userContext.accessibleProjectIds.includes('*')) {
    return requestedScope || 'global';
  }

  // If scope is 'project', verify user has access to current project
  if (requestedScope === 'project') {
    if (!currentProjectId) {
      // No current project context - fallback to user scope
      return 'user';
    }

    const hasProjectAccess = userContext.accessibleProjectIds.includes(currentProjectId);

    if (!hasProjectAccess) {
      // User doesn't have access to current project - fallback to user scope
      return 'user';
    }

    return 'project';
  }

  // If scope is 'global', check if user has permissions
  if (requestedScope === 'global') {
    // Only admins and wildcard users can access global scope
    // Regular users fallback to project scope
    if (currentProjectId && userContext.accessibleProjectIds.includes(currentProjectId)) {
      return 'project';
    }

    return 'user';
  }

  // Default to user scope for maximum security
  return 'user';
}

/**
 * Filter results by user's project access
 *
 * Used to filter knowledge base search results by user permissions.
 *
 * @param userContext - User context from JWT validation
 * @param results - Array of results with project_id field
 * @returns Filtered results that user has access to
 */
export function filterResultsByProjectAccess<T extends { project_id?: string }>(
  userContext: UserContext,
  results: T[]
): T[] {
  // Admin users see all results
  if (userContext.role === 'admin') {
    return results;
  }

  // Wildcard access sees all results
  if (userContext.accessibleProjectIds.includes('*')) {
    return results;
  }

  // Filter results by accessible projects
  return results.filter((result) => {
    // Results without project_id are considered global and accessible to all
    if (!result.project_id) {
      return true;
    }

    // Check if user has access to this project
    return userContext.accessibleProjectIds.includes(result.project_id);
  });
}

/**
 * Check if user has required permissions
 *
 * Used for permission-based access control (PBAC).
 *
 * @param userContext - User context from JWT validation
 * @param requiredPermissions - Array of required permission keys
 * @param requireAll - If true, user must have ALL permissions. If false, user must have AT LEAST ONE.
 * @returns True if user has required permissions
 */
export function hasRequiredPermissions(
  userContext: UserContext,
  requiredPermissions: string[],
  requireAll: boolean = true
): boolean {
  // No permissions required
  if (requiredPermissions.length === 0) {
    return true;
  }

  // Admin users have all permissions
  if (userContext.role === 'admin') {
    return true;
  }

  // Check if user has required permissions
  const userPermissions = new Set(userContext.accessibleProjectIds);

  if (requireAll) {
    // User must have ALL required permissions
    return requiredPermissions.every((perm) => userPermissions.has(perm));
  } else {
    // User must have AT LEAST ONE required permission
    return requiredPermissions.some((perm) => userPermissions.has(perm));
  }
}

// ===========================
// Role-Based Access Control (RBAC)
// ===========================

/**
 * Check if user has required role level
 *
 * Role hierarchy: admin > owner > member > viewer
 *
 * @param userContext - User context from JWT validation
 * @param minimumRole - Minimum required role level
 * @returns True if user has sufficient role level
 */
export function hasRequiredRole(
  userContext: UserContext,
  minimumRole: 'admin' | 'owner' | 'member' | 'viewer'
): boolean {
  const roleHierarchy = {
    admin: 4,
    owner: 3,
    member: 2,
    viewer: 1,
  };

  const userRoleLevel = roleHierarchy[userContext.role];
  const requiredRoleLevel = roleHierarchy[minimumRole];

  return userRoleLevel >= requiredRoleLevel;
}

/**
 * Check if user is project owner
 *
 * Project owners have full access to their projects.
 *
 * @param userContext - User context from JWT validation
 * @returns True if user has owner role
 */
export function isProjectOwner(userContext: UserContext): boolean {
  return userContext.role === 'owner' || userContext.role === 'admin';
}

/**
 * Check if user can modify project
 *
 * Only owners and admins can modify projects.
 *
 * @param userContext - User context from JWT validation
 * @returns True if user can modify projects
 */
export function canModifyProject(userContext: UserContext): boolean {
  return isProjectOwner(userContext);
}

// ===========================
// Exports
// ===========================

export {
  verifyProjectAccess,
  verifyMultipleProjectAccess,
  determineAccessScope,
  filterResultsByProjectAccess,
  hasRequiredPermissions,
  hasRequiredRole,
  isProjectOwner,
  canModifyProject,
};

export default verifyProjectAccess;
