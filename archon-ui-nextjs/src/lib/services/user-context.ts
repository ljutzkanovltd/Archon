/**
 * User Context Extraction Service
 *
 * Provides user permission and project membership queries for CopilotKit integration.
 * Implements caching to minimize API calls and improve performance.
 */

// ===========================
// Type Definitions
// ===========================

export interface UserProjectMembership {
  project_id: string;
  title: string;
  access_level: 'owner' | 'member';
  pinned: boolean;
  archived: boolean;
}

export interface UserContextExtended {
  userId: string;
  email: string;
  fullName?: string;
  role: 'owner' | 'member' | 'viewer' | 'admin';

  // Project access
  accessibleProjectIds: string[];
  projects: UserProjectMembership[];

  // Permissions (from user object)
  permissions: string[];

  // Metadata
  isAdmin: boolean;
  cachedAt: number;
}

export interface UserContextCacheEntry {
  context: UserContextExtended;
  expiresAt: number;
}

// ===========================
// Cache Configuration
// ===========================

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const contextCache = new Map<string, UserContextCacheEntry>();

/**
 * Clear cache for a specific user
 */
export function clearUserContextCache(userId: string): void {
  contextCache.delete(userId);
}

/**
 * Clear all cached user contexts
 */
export function clearAllUserContextCache(): void {
  contextCache.clear();
}

/**
 * Check if cached context is still valid
 */
function isCacheValid(entry: UserContextCacheEntry): boolean {
  return Date.now() < entry.expiresAt;
}

// ===========================
// API Client Functions
// ===========================

/**
 * Fetch user's accessible projects from Backend API
 *
 * Uses the existing /api/projects endpoint which automatically filters
 * by user permissions for authenticated requests.
 *
 * @param token - JWT authentication token
 * @returns Array of project memberships
 */
export async function getUserProjectMemberships(
  token: string
): Promise<UserProjectMembership[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8181';

  try {
    const response = await fetch(`${apiUrl}/api/projects?include_content=false&include_archived=false`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed: Invalid or expired token');
      }
      if (response.status === 403) {
        throw new Error('Access denied: Insufficient permissions');
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Backend returns projects filtered by user access
    // Map to our UserProjectMembership interface
    return data.map((project: any) => ({
      project_id: project.id || project.project_id,
      title: project.title,
      access_level: project.access_level || 'member',
      pinned: project.pinned || false,
      archived: project.archived || false,
    }));

  } catch (error) {
    if (error instanceof Error) {
      console.error('[UserContext] Failed to fetch project memberships:', error.message);
      throw error;
    }
    console.error('[UserContext] Unknown error fetching project memberships');
    throw new Error('Failed to fetch project memberships');
  }
}

/**
 * Get user permissions from JWT payload
 *
 * JWT tokens issued by the Backend API include a permissions array.
 * This function extracts permissions from the decoded token.
 *
 * @param token - JWT authentication token
 * @returns Array of permission keys
 */
export function getUserPermissionsFromToken(token: string): string[] {
  try {
    // Decode JWT payload (2nd part of token)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[UserContext] Malformed JWT token');
      return [];
    }

    const payload = JSON.parse(atob(parts[1]));

    // Backend includes permissions array in JWT
    return Array.isArray(payload.permissions) ? payload.permissions : [];

  } catch (error) {
    console.error('[UserContext] Failed to extract permissions from token:', error);
    return [];
  }
}

/**
 * Check if user has admin role
 *
 * Admin users have access to all projects and bypass RLS.
 *
 * @param role - User role from JWT
 * @returns True if user is admin
 */
export function isUserAdmin(role: string): boolean {
  return role === 'admin';
}

// ===========================
// Main User Context Service
// ===========================

/**
 * Get complete user context with permissions and project access
 *
 * This is the main function used by AgentContextProvider and jwt-middleware.
 * Implements caching to reduce API calls.
 *
 * @param userId - User ID
 * @param email - User email
 * @param fullName - User full name (optional)
 * @param role - User role
 * @param token - JWT authentication token
 * @param forceRefresh - Force cache refresh (default: false)
 * @returns Complete user context with project access and permissions
 */
export async function getUserContext(
  userId: string,
  email: string,
  fullName: string | undefined,
  role: 'owner' | 'member' | 'viewer' | 'admin',
  token: string,
  forceRefresh: boolean = false
): Promise<UserContextExtended> {

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = contextCache.get(userId);
    if (cached && isCacheValid(cached)) {
      console.log('[UserContext] Returning cached context for user:', userId);
      return cached.context;
    }
  }

  console.log('[UserContext] Fetching fresh context for user:', userId);

  try {
    // Fetch project memberships from Backend API
    const projects = await getUserProjectMemberships(token);

    // Extract project IDs
    const accessibleProjectIds = projects
      .filter(p => !p.archived)
      .map(p => p.project_id);

    // Get permissions from JWT
    const permissions = getUserPermissionsFromToken(token);

    // Check if user is admin
    const isAdmin = isUserAdmin(role);

    // Build complete context
    const context: UserContextExtended = {
      userId,
      email,
      fullName,
      role,
      accessibleProjectIds,
      projects,
      permissions,
      isAdmin,
      cachedAt: Date.now(),
    };

    // Cache the result
    const cacheEntry: UserContextCacheEntry = {
      context,
      expiresAt: Date.now() + CACHE_DURATION_MS,
    };
    contextCache.set(userId, cacheEntry);

    console.log('[UserContext] Context cached for user:', userId, {
      projectCount: projects.length,
      permissionCount: permissions.length,
      isAdmin,
    });

    return context;

  } catch (error) {
    console.error('[UserContext] Failed to build user context:', error);

    // Return minimal context on error (fail-safe)
    const fallbackContext: UserContextExtended = {
      userId,
      email,
      fullName,
      role,
      accessibleProjectIds: [], // No projects on error
      projects: [],
      permissions: [],
      isAdmin: false,
      cachedAt: Date.now(),
    };

    return fallbackContext;
  }
}

// ===========================
// Edge Case Handlers
// ===========================

/**
 * Handle no projects scenario
 *
 * Returns true if user has no accessible projects.
 * This could mean:
 * - New user with no project assignments yet
 * - User access revoked from all projects
 * - Database/API error (check fallback context)
 */
export function hasNoProjects(context: UserContextExtended): boolean {
  return context.accessibleProjectIds.length === 0;
}

/**
 * Handle revoked access scenario
 *
 * Compares cached context with fresh context to detect access changes.
 * Useful for detecting when user's project access has been revoked.
 *
 * @param oldContext - Previous user context
 * @param newContext - Current user context
 * @returns True if projects were removed
 */
export function hasRevokedAccess(
  oldContext: UserContextExtended,
  newContext: UserContextExtended
): boolean {
  const oldProjectIds = new Set(oldContext.accessibleProjectIds);
  const newProjectIds = new Set(newContext.accessibleProjectIds);

  // Check if any projects were removed
  for (const projectId of oldProjectIds) {
    if (!newProjectIds.has(projectId)) {
      return true;
    }
  }

  return false;
}

/**
 * Handle admin access scenario
 *
 * Admin users have access to all projects and bypass RLS.
 * For admins, project lists may be extensive.
 */
export function isAdminUser(context: UserContextExtended): boolean {
  return context.isAdmin;
}

// ===========================
// Exports
// ===========================

export {
  getUserProjectMemberships,
  getUserPermissionsFromToken,
  getUserContext,
  clearUserContextCache,
  clearAllUserContextCache,
  isUserAdmin,
  hasNoProjects,
  hasRevokedAccess,
  isAdminUser,
};

export default getUserContext;
