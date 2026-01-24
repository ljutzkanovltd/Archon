"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Badge,
  Spinner,
  Alert,
  Button,
  Table,
  Modal,
  TextInput,
  Select,
  Checkbox,
} from "flowbite-react";
import {
  HiUsers,
  HiRefresh,
  HiUserAdd,
  HiPencil,
  HiTrash,
  HiKey,
  HiMail,
} from "react-icons/hi";
import { apiClient } from "@/lib/apiClient";
import { ExportButton } from "@/components/ExportButton";
import { toast } from "react-hot-toast";

/**
 * User interface
 */
interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role?: string;
  is_active: boolean;
  is_verified: boolean;
  last_login_at?: string;
  created_at: string;
}

/**
 * UserManagementPanel - Manage users with RBAC roles
 *
 * Features:
 * - List all users with pagination
 * - Invite new users via email
 * - Edit user information (name, email, role)
 * - Activate/deactivate user accounts
 * - Send password reset emails
 * - Manage user permissions
 * - Filter by role and status
 * - Export user data
 *
 * RBAC Roles:
 * - admin: Full system access
 * - manager: Project management
 * - member: Standard user access
 * - viewer: Read-only access
 *
 * API Endpoints:
 * - GET /api/admin/users - List users
 * - POST /api/admin/users/invite - Invite user
 * - PUT /api/admin/users/{id} - Update user
 * - PUT /api/admin/users/{id}/status - Update status
 * - POST /api/admin/users/{id}/reset-password - Send reset
 *
 * Usage:
 * ```tsx
 * <UserManagementPanel />
 * ```
 */
export function UserManagementPanel() {
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const queryClient = useQueryClient();

  // Fetch users
  const {
    data: usersData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-users", page, roleFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("per_page", "20");
      if (roleFilter) params.append("role", roleFilter);
      if (statusFilter === "active") params.append("is_active", "true");
      if (statusFilter === "inactive") params.append("is_active", "false");

      const response = await apiClient.get(`/api/admin/users?${params.toString()}`);
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds
  });

  // Invite user mutation
  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiClient.post("/api/admin/users/invite", { email });
      return response.data;
    },
    onSuccess: () => {
      toast.success("User invitation sent successfully");
      setShowInviteModal(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to invite user");
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: any }) => {
      const response = await apiClient.put(`/api/admin/users/${userId}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("User updated successfully");
      setShowEditModal(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to update user");
    },
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const response = await apiClient.put(`/api/admin/users/${userId}/status`, {
        is_active: isActive,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("User status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to update user status");
    },
  });

  // Send password reset mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.post(`/api/admin/users/${userId}/reset-password`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Password reset email sent successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to send password reset");
    },
  });

  const users = usersData?.users || [];
  const totalPages = usersData?.total_pages || 1;

  // Prepare export data
  const exportData = users.map((user: User) => ({
    email: user.email,
    full_name: user.full_name,
    role: user.role || "member",
    status: user.is_active ? "Active" : "Inactive",
    verified: user.is_verified ? "Yes" : "No",
    last_login: user.last_login_at
      ? new Date(user.last_login_at).toLocaleString()
      : "Never",
    created_at: new Date(user.created_at).toLocaleString(),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HiUsers className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              User Management
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage users and RBAC permissions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={exportData}
            filename="users"
            headers={{
              email: "Email",
              full_name: "Name",
              role: "Role",
              status: "Status",
              verified: "Verified",
              last_login: "Last Login",
              created_at: "Created At",
            }}
            size="sm"
            disabled={users.length === 0}
          />
          <Button color="gray" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <HiRefresh className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button color="blue" size="sm" onClick={() => setShowInviteModal(true)}>
            <HiUserAdd className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label htmlFor="role-filter" className="mb-2 block text-sm font-medium">
              Filter by Role
            </label>
            <Select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </Select>
          </div>
          <div className="flex-1">
            <label htmlFor="status-filter" className="mb-2 block text-sm font-medium">
              Filter by Status
            </label>
            <Select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              color="gray"
              size="sm"
              onClick={() => {
                setRoleFilter("");
                setStatusFilter("");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <div className="flex items-center justify-center py-12">
            <Spinner size="xl" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Loading users...
            </span>
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Alert color="failure">
          <span className="font-medium">Failed to load users:</span> {String(error)}
        </Alert>
      )}

      {/* Users Table */}
      {!isLoading && !error && (
        <Card>
          <div className="overflow-x-auto">
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell>User</Table.HeadCell>
                <Table.HeadCell>Email</Table.HeadCell>
                <Table.HeadCell>Role</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Last Login</Table.HeadCell>
                <Table.HeadCell>Actions</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {users.map((user: User) => (
                  <Table.Row
                    key={user.id}
                    className="bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    <Table.Cell className="whitespace-nowrap font-medium">
                      <div className="flex items-center gap-2">
                        {user.avatar_url && (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name}
                            className="h-8 w-8 rounded-full"
                          />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {user.full_name}
                          </p>
                          {user.is_verified && (
                            <Badge color="success" size="xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{user.email}</Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={
                          user.role === "admin"
                            ? "purple"
                            : user.role === "manager"
                            ? "blue"
                            : "gray"
                        }
                      >
                        {user.role || "member"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={user.is_active ? "success" : "failure"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-sm text-gray-600 dark:text-gray-400">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleDateString()
                        : "Never"}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="xs"
                          color="light"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowEditModal(true);
                          }}
                        >
                          <HiPencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="xs"
                          color="light"
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              userId: user.id,
                              isActive: !user.is_active,
                            })
                          }
                          disabled={toggleStatusMutation.isPending}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          size="xs"
                          color="light"
                          onClick={() => resetPasswordMutation.mutate(user.id)}
                          disabled={resetPasswordMutation.isPending}
                        >
                          <HiMail className="h-4 w-4" />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing page {page} of {totalPages} ({usersData?.total || 0} total users)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                color="gray"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                color="gray"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Invite User Modal */}
      <Modal show={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <Modal.Header>Invite New User</Modal.Header>
        <Modal.Body>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const email = formData.get("email") as string;
              inviteMutation.mutate(email);
            }}
          >
            <div className="space-y-4">
              <div>
                <label htmlFor="invite-email" className="mb-2 block text-sm font-medium">
                  Email Address
                </label>
                <TextInput
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button color="gray" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            </div>
          </form>
        </Modal.Body>
      </Modal>

      {/* Edit User Modal */}
      <Modal show={showEditModal} onClose={() => setShowEditModal(false)}>
        <Modal.Header>Edit User</Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  full_name: formData.get("full_name") as string,
                  email: formData.get("email") as string,
                  role: formData.get("role") as string,
                };
                updateUserMutation.mutate({ userId: selectedUser.id, data });
              }}
            >
              <div className="space-y-4">
                <div>
                  <label htmlFor="edit-full-name" className="mb-2 block text-sm font-medium">
                    Full Name
                  </label>
                  <TextInput
                    id="edit-full-name"
                    name="full_name"
                    defaultValue={selectedUser.full_name}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="edit-email" className="mb-2 block text-sm font-medium">
                    Email
                  </label>
                  <TextInput
                    id="edit-email"
                    name="email"
                    type="email"
                    defaultValue={selectedUser.email}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="edit-role" className="mb-2 block text-sm font-medium">
                    Role
                  </label>
                  <Select id="edit-role" name="role" defaultValue={selectedUser.role || "member"}>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    color="gray"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedUser(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateUserMutation.isPending}>
                    {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
