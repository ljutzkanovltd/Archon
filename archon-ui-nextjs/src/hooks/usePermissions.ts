import { useUser } from "@/store/useAuthStore";

/**
 * Permission Definitions
 *
 * These map to specific user roles and granular permissions.
 * Currently implements role-based permissions (admin vs member).
 * Future: Will integrate with archon_user_permissions table.
 */
export interface Permissions {
  // Database & System Management
  canAccessDatabaseSync: boolean;

  // User Management
  canManageUsers: boolean;

  // Developer Tools
  canViewMCPInspector: boolean;
  canViewTestFoundation: boolean;

  // Feature Access
  canViewAgentWorkOrders: boolean;

  // Content Management
  canViewProjects: boolean;
  canViewTasks: boolean;
  canViewKnowledgeBase: boolean;

  // Settings
  canEditSettings: boolean;
}

/**
 * usePermissions Hook
 *
 * Provides role-based access control (RBAC) for the application.
 *
 * **Implementation (RBAC Phase 4):**
 * - Loads user-specific permissions from archon_user_permissions table
 * - Falls back to role-based checks for backward compatibility
 * - Admin users: Full access to all features
 * - Member users: Permission-based access
 *
 * **Permission Checking:**
 * 1. Checks if user has specific permission key in permissions array
 * 2. Falls back to role-based check (admin = all permissions)
 * 3. Core features available to all authenticated users
 *
 * @returns {Permissions} Object containing permission flags
 *
 * @example
 * ```tsx
 * const { canManageUsers, canViewMCPInspector } = usePermissions();
 *
 * if (!canManageUsers) {
 *   return <Forbidden />;
 * }
 * ```
 */
export function usePermissions(): Permissions {
  const user = useUser();

  // Check if user is authenticated and has admin role
  const isAdmin = user?.role === "admin";

  // RBAC Phase 4: Load user-specific permissions from backend
  const userPermissions = user?.permissions || [];
  const hasPermission = (permission: string) =>
    userPermissions.includes(permission);

  return {
    // Admin-only features - check permission or admin role
    canAccessDatabaseSync: isAdmin || hasPermission('database_sync'),
    canManageUsers: isAdmin || hasPermission('manage_users'),
    canViewMCPInspector: isAdmin || hasPermission('view_mcp_inspector'),
    canViewTestFoundation: isAdmin || hasPermission('view_test_foundation'),

    // Agent Work Orders - admin or has explicit permission
    canViewAgentWorkOrders: isAdmin || hasPermission('view_agent_work_orders'),

    // Core features - available to all authenticated users
    canViewProjects: !!user,
    canViewTasks: !!user,
    canViewKnowledgeBase: !!user,

    // Settings - all users can edit their own settings
    canEditSettings: !!user,
  };
}

/**
 * useIsAdmin Hook
 *
 * Convenience hook to check if current user is an admin.
 *
 * @returns {boolean} True if user has admin role
 */
export function useIsAdmin(): boolean {
  const user = useUser();
  return user?.role === "admin";
}
