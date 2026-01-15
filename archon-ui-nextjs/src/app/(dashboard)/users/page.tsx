"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { Forbidden } from "@/components/Forbidden";
import { adminApi } from "@/lib/apiClient";
import {
  UserListItem,
  PermissionKey,
  InviteUserRequest,
  UpdateUserPermissionsRequest,
} from "@/lib/admin-types";
import {
  Card,
  Button,
  TextInput,
  Select,
  Badge,
  Label,
  Textarea,
  Checkbox,
  Spinner,
  Alert,
} from "flowbite-react";
import {
  HiUsers,
  HiSearch,
  HiUserAdd,
  HiPencil,
  HiTrash,
  HiCheckCircle,
  HiXCircle,
} from "react-icons/hi";
import { toast } from "react-hot-toast";

/**
 * Users Management Page
 *
 * Admin-only page for managing users, invitations, and permissions.
 * Features:
 * - User list with search and filtering
 * - Invite users via email
 * - Activate/deactivate users
 * - Manage granular permissions
 */
export default function UsersPage() {
  const queryClient = useQueryClient();
  const { canManageUsers } = usePermissions();

  // State
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);

  // Permission guard
  if (!canManageUsers) {
    return <Forbidden />;
  }

  // Fetch users
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ["admin-users", page, perPage, search, statusFilter],
    queryFn: async () => {
      try {
        return await adminApi.listUsers({
          page,
          per_page: perPage,
          search: search || undefined,
          status_filter:
            statusFilter === "all"
              ? undefined
              : (statusFilter as "active" | "inactive" | "verified" | "unverified"),
        });
      } catch (err: any) {
        // If 401, user needs to log in again
        if (err.status === 401) {
          toast.error("Session expired. Please log in again.");
          // Optionally redirect to login
          // window.location.href = '/login';
        }
        throw err;
      }
    },
    placeholderData: (previousData) => previousData,
    retry: false, // Don't retry on auth errors
  });

  // Fetch selected user permissions
  const { data: userPermissions } = useQuery({
    queryKey: ["user-permissions", selectedUser?.id],
    queryFn: () => adminApi.getUserPermissions(selectedUser!.id),
    enabled: !!selectedUser && permissionsModalOpen,
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: (data: InviteUserRequest) => adminApi.inviteUser(data),
    onSuccess: () => {
      toast.success("Invitation sent successfully");
      setInviteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  // Update user status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApi.updateUserStatus(userId, { is_active: isActive }),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update user status");
    },
  });

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: ({
      userId,
      permissions,
    }: {
      userId: string;
      permissions: PermissionKey[];
    }) => adminApi.updateUserPermissions(userId, { permissions }),
    onSuccess: (data) => {
      toast.success(data.message);
      setPermissionsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update permissions");
    },
  });

  // Handle toggle user status
  const handleToggleStatus = (user: UserListItem) => {
    const action = user.is_active ? "deactivate" : "activate";
    if (
      confirm(
        `Are you sure you want to ${action} ${user.full_name} (${user.email})?`
      )
    ) {
      updateStatusMutation.mutate({
        userId: user.id,
        isActive: !user.is_active,
      });
    }
  };

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          User Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage users, invitations, and permissions across the Archon platform.
        </p>
      </div>

      {/* Filters and Actions */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <TextInput
              icon={HiSearch}
              placeholder="Search by email or name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Users</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </Select>
          </div>

          {/* Invite Button */}
          <Button
            color="blue"
            onClick={() => setInviteModalOpen(true)}
          >
            <HiUserAdd className="mr-2 h-5 w-5" />
            Invite User
          </Button>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        {error && (
          <Alert color="failure" className="mb-4">
            {error instanceof Error ? error.message : "Failed to load users"}
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="xl" />
          </div>
        ) : usersData && usersData.users.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="px-6 py-3">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Verified
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Created
                    </th>
                    <th scope="col" className="px-6 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usersData.users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                    >
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900 dark:text-white">
                        <div>
                          <div className="font-semibold">{user.full_name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <Badge color="success" icon={HiCheckCircle}>
                            Active
                          </Badge>
                        ) : (
                          <Badge color="failure" icon={HiXCircle}>
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.is_verified ? (
                          <Badge color="info">Verified</Badge>
                        ) : (
                          <Badge color="warning">Unverified</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button
                            size="xs"
                            color="blue"
                            onClick={() => {
                              setSelectedUser(user);
                              setPermissionsModalOpen(true);
                            }}
                          >
                            <HiPencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="xs"
                            color={user.is_active ? "failure" : "success"}
                            onClick={() => handleToggleStatus(user)}
                            disabled={updateStatusMutation.isPending}
                          >
                            {user.is_active ? (
                              <HiXCircle className="h-4 w-4" />
                            ) : (
                              <HiCheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {usersData.total_pages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="text-sm text-gray-700 dark:text-gray-400">
                  Showing {(page - 1) * perPage + 1} to{" "}
                  {Math.min(page * perPage, usersData.total)} of {usersData.total}{" "}
                  users
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    color="gray"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={page >= usersData.total_pages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <HiUsers className="mb-4 h-16 w-16 text-gray-400" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              No users found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {search || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by inviting your first user"}
            </p>
          </div>
        )}
      </Card>

      {/* Invite User Modal */}
      <InviteUserModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onSubmit={(data) => inviteUserMutation.mutate(data)}
        isPending={inviteUserMutation.isPending}
      />

      {/* Edit Permissions Modal */}
      {selectedUser && (
        <EditPermissionsModal
          open={permissionsModalOpen}
          onClose={() => {
            setPermissionsModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          currentPermissions={userPermissions?.permissions || []}
          onSubmit={(permissions) =>
            updatePermissionsMutation.mutate({
              userId: selectedUser.id,
              permissions,
            })
          }
          isPending={updatePermissionsMutation.isPending}
        />
      )}
    </div>
  );
}

// ==================== INVITE USER MODAL ====================

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: InviteUserRequest) => void;
  isPending: boolean;
}

function InviteUserModal({
  open,
  onClose,
  onSubmit,
  isPending,
}: InviteUserModalProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ email, message: message || undefined });
    setEmail("");
    setMessage("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-gray-900/50">
      <div className="relative max-h-full w-full max-w-md p-4">
        <div className="relative rounded-lg bg-white shadow dark:bg-gray-800">
          {/* Header */}
          <div className="flex items-start justify-between rounded-t border-b p-4 dark:border-gray-600">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Invite User
            </h3>
            <button
              type="button"
              className="ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white"
              onClick={onClose}
            >
              <HiXCircle className="h-5 w-5" />
            </button>
          </div>
          {/* Body */}
          <div className="space-y-6 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <TextInput
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="message">Custom Message (Optional)</Label>
                <Textarea
                  id="message"
                  rows={4}
                  placeholder="Add a personal message to the invitation email..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                />
                <p className="mt-1 text-sm text-gray-500">
                  {message.length}/500 characters
                </p>
              </div>
            </form>
          </div>
          {/* Footer */}
          <div className="flex items-center justify-end space-x-2 rounded-b border-t border-gray-200 p-6 dark:border-gray-600">
            <Button onClick={handleSubmit} disabled={isPending || !email}>
              {isPending ? <Spinner size="sm" className="mr-2" /> : null}
              Send Invitation
            </Button>
            <Button color="gray" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== EDIT PERMISSIONS MODAL ====================

interface EditPermissionsModalProps {
  open: boolean;
  onClose: () => void;
  user: UserListItem;
  currentPermissions: PermissionKey[];
  onSubmit: (permissions: PermissionKey[]) => void;
  isPending: boolean;
}

function EditPermissionsModal({
  open,
  onClose,
  user,
  currentPermissions,
  onSubmit,
  isPending,
}: EditPermissionsModalProps) {
  const [selectedPermissions, setSelectedPermissions] =
    useState<PermissionKey[]>(currentPermissions);

  // Update when currentPermissions change
  useEffect(() => {
    setSelectedPermissions(currentPermissions);
  }, [currentPermissions]);

  const permissionGroups = {
    "Content Management": [
      {
        key: PermissionKey.VIEW_PROJECTS,
        label: "View Projects",
        description: "Access to projects list and details",
      },
      {
        key: PermissionKey.VIEW_TASKS,
        label: "View Tasks",
        description: "Access to tasks list and details",
      },
      {
        key: PermissionKey.VIEW_KNOWLEDGE_BASE,
        label: "View Knowledge Base",
        description: "Access to documentation and knowledge articles",
      },
    ],
    "Developer Tools": [
      {
        key: PermissionKey.VIEW_MCP_INSPECTOR,
        label: "View MCP Inspector",
        description: "Access to MCP server diagnostics and monitoring",
      },
      {
        key: PermissionKey.VIEW_TEST_FOUNDATION,
        label: "View Test Foundation",
        description: "Access to testing and QA tools",
      },
      {
        key: PermissionKey.VIEW_AGENT_WORK_ORDERS,
        label: "View Agent Work Orders",
        description: "Access to AI agent task management",
      },
    ],
    "System Management": [
      {
        key: PermissionKey.MANAGE_DATABASE_SYNC,
        label: "Manage Database Sync",
        description: "Configure and manage database synchronization",
      },
      {
        key: PermissionKey.MANAGE_USERS,
        label: "Manage Users",
        description: "Full user management access (admin)",
      },
      {
        key: PermissionKey.EDIT_SETTINGS,
        label: "Edit Settings",
        description: "Modify system settings and configuration",
      },
    ],
  };

  const togglePermission = (permission: PermissionKey) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSubmit = () => {
    onSubmit(selectedPermissions);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-gray-900/50">
      <div className="relative max-h-full w-full max-w-2xl p-4">
        <div className="relative rounded-lg bg-white shadow dark:bg-gray-800">
          {/* Header */}
          <div className="flex items-start justify-between rounded-t border-b p-4 dark:border-gray-600">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Edit Permissions - {user.full_name}
            </h3>
            <button
              type="button"
              className="ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-white"
              onClick={onClose}
            >
              <HiXCircle className="h-5 w-5" />
            </button>
          </div>
          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto p-6">
            <div className="space-y-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select the permissions you want to grant to this user. Changes will take
                effect immediately.
              </p>

              {Object.entries(permissionGroups).map(([group, permissions]) => (
                <div key={group}>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                    {group}
                  </h3>
                  <div className="space-y-2">
                    {permissions.map((permission) => (
                      <div
                        key={permission.key}
                        className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <Checkbox
                          id={permission.key}
                          checked={selectedPermissions.includes(permission.key)}
                          onChange={() => togglePermission(permission.key)}
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={permission.key}
                            className="cursor-pointer font-medium"
                          >
                            {permission.label}
                          </Label>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {permission.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Footer */}
          <div className="flex items-center justify-end space-x-2 rounded-b border-t border-gray-200 p-6 dark:border-gray-600">
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <Spinner size="sm" className="mr-2" /> : null}
              Save Permissions
            </Button>
            <Button color="gray" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
