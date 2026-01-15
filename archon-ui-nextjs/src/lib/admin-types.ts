/**
 * Admin API Type Definitions
 *
 * Types for user management and admin operations
 */

// Permission keys (must match backend PermissionKey enum)
export enum PermissionKey {
  VIEW_PROJECTS = "view_projects",
  VIEW_TASKS = "view_tasks",
  VIEW_KNOWLEDGE_BASE = "view_knowledge_base",
  VIEW_MCP_INSPECTOR = "view_mcp_inspector",
  VIEW_TEST_FOUNDATION = "view_test_foundation",
  VIEW_AGENT_WORK_ORDERS = "view_agent_work_orders",
  MANAGE_DATABASE_SYNC = "manage_database_sync",
  MANAGE_USERS = "manage_users",
  EDIT_SETTINGS = "edit_settings",
}

// User list item (from backend UserListItem)
export interface UserListItem {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

// Users list response
export interface UsersListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Invite user request
export interface InviteUserRequest {
  email: string;
  message?: string;
}

// Invite user response
export interface InviteUserResponse {
  success: boolean;
  message: string;
  invitation_token: string;
  email: string;
}

// Update user status request
export interface UpdateUserStatusRequest {
  is_active: boolean;
}

// Update user status response
export interface UpdateUserStatusResponse {
  success: boolean;
  message: string;
  user_id: string;
  is_active: boolean;
}

// User permissions response
export interface UserPermissionsResponse {
  user_id: string;
  permissions: PermissionKey[];
  total_count: number;
}

// Update user permissions request
export interface UpdateUserPermissionsRequest {
  permissions: PermissionKey[];
}

// Update user permissions response
export interface UpdateUserPermissionsResponse {
  success: boolean;
  message: string;
  user_id: string;
  granted: PermissionKey[];
  revoked: PermissionKey[];
}
