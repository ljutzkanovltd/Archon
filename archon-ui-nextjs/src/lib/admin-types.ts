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
  role?: string; // "admin" | "member" | "viewer"
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: string | null;
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

// Update user request (for editing user details)
export interface UpdateUserRequest {
  full_name?: string;
  email?: string;
  role?: "admin" | "member" | "viewer";
}

// Update user response
export interface UpdateUserResponse {
  success: boolean;
  message: string;
  user: UserListItem;
}

// Project member item
export interface ProjectMemberItem {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  access_level: "owner" | "member";
  added_at: string | null;
  added_by: string | null;
  added_by_name: string | null;
}

// Project members response
export interface ProjectMembersResponse {
  success: boolean;
  project_id: string;
  members: ProjectMemberItem[];
  total: number;
}

// Add project member request
export interface AddProjectMemberRequest {
  user_id: string;
  access_level: "owner" | "member";
}

// Add project member response
export interface AddProjectMemberResponse {
  success: boolean;
  message: string;
  project_id: string;
  user_id: string;
  access_level: string;
}

// Remove project member response
export interface RemoveProjectMemberResponse {
  success: boolean;
  message: string;
}

// User project item
export interface UserProjectItem {
  project_id: string;
  title: string;
  description: string | null;
  github_repo: string | null;
  pinned: boolean;
  archived: boolean;
  access_level: string;
  created_at: string | null;
  updated_at: string | null;
}

// User projects response
export interface UserProjectsResponse {
  success: boolean;
  user_id: string;
  projects: UserProjectItem[];
  total: number;
  is_admin: boolean;
}
