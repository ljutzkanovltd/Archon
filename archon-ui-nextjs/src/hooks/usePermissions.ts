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
 * **Current Implementation:**
 * - Admin users: Full access to all features
 * - Member users: Limited access to basic features
 *
 * **Future Enhancement (Phase 4):**
 * Will load user-specific permissions from archon_user_permissions table
 * and support granular permission checks beyond role-based access.
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

  // Future: Load user-specific permissions from backend
  // const userPermissions = user?.permissions || [];
  // const hasPermission = (permission: string) =>
  //   userPermissions.includes(permission);

  return {
    // Admin-only features
    canAccessDatabaseSync: isAdmin,
    canManageUsers: isAdmin,
    canViewMCPInspector: isAdmin,
    canViewTestFoundation: isAdmin,

    // Agent Work Orders - admin or has explicit permission
    canViewAgentWorkOrders: isAdmin,
    // Future: isAdmin || hasPermission('view_agent_work_orders')

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
