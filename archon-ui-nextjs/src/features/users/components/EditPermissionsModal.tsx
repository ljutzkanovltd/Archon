"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Label } from "flowbite-react";
import toast from "react-hot-toast";
import CustomModal from "@/components/common/CustomModal";
import { adminApi } from "@/lib/apiClient";
import { PermissionKey, UserListItem } from "@/lib/admin-types";

interface EditPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserListItem | null;
}

/**
 * EditPermissionsModal - Modal for editing user permissions
 *
 * Allows admins to grant or revoke permissions for a specific user
 */
export function EditPermissionsModal({
  isOpen,
  onClose,
  user,
}: EditPermissionsModalProps) {
  const queryClient = useQueryClient();
  const [selectedPermissions, setSelectedPermissions] = useState<
    PermissionKey[]
  >([]);

  // Fetch user permissions when modal opens
  const { data: permissionsData, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("No user selected");
      return await adminApi.getUserPermissions(user.id);
    },
    enabled: isOpen && !!user?.id,
  });

  // Initialize selected permissions from API data
  useEffect(() => {
    if (permissionsData?.permissions) {
      setSelectedPermissions(permissionsData.permissions);
    }
  }, [permissionsData]);

  const updatePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user selected");
      return await adminApi.updateUserPermissions(user.id, {
        permissions: selectedPermissions,
      });
    },
    onSuccess: () => {
      toast.success("Permissions updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-permissions", user?.id] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update permissions");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePermissionsMutation.mutate();
  };

  const handlePermissionToggle = (permission: PermissionKey) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const availablePermissions: { key: PermissionKey; label: string; description: string }[] = [
    {
      key: PermissionKey.VIEW_PROJECTS,
      label: "View Projects",
      description: "View all projects",
    },
    {
      key: PermissionKey.VIEW_TASKS,
      label: "View Tasks",
      description: "View all tasks",
    },
    {
      key: PermissionKey.VIEW_KNOWLEDGE_BASE,
      label: "View Knowledge Base",
      description: "Access knowledge base",
    },
    {
      key: PermissionKey.VIEW_MCP_INSPECTOR,
      label: "View MCP Inspector",
      description: "Access MCP debugging tools",
    },
    {
      key: PermissionKey.VIEW_TEST_FOUNDATION,
      label: "View Test Foundation",
      description: "Access test foundation page",
    },
    {
      key: PermissionKey.VIEW_AGENT_WORK_ORDERS,
      label: "View Agent Work Orders",
      description: "Access agent work orders",
    },
    {
      key: PermissionKey.MANAGE_DATABASE_SYNC,
      label: "Manage Database Sync",
      description: "Manage database synchronization",
    },
    {
      key: PermissionKey.MANAGE_USERS,
      label: "Manage Users",
      description: "Manage users and permissions",
    },
    {
      key: PermissionKey.EDIT_SETTINGS,
      label: "Edit Settings",
      description: "Edit system settings",
    },
  ];

  if (!user) return null;

  return (
    <CustomModal
      open={isOpen}
      close={onClose}
      title={`Edit Permissions - ${user.full_name || user.email}`}
      description="Grant or revoke access permissions for this user"
      size="LARGE"
      containerClassName="p-0 flex flex-col h-full"
    >
      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          <p className="ml-3 text-gray-500 dark:text-gray-400">
            Loading permissions...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4 space-y-6 min-h-0">
            {/* User Info */}
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Email:</strong> {user.email}
              </p>
              {user.full_name && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Name:</strong> {user.full_name}
                </p>
              )}
            </div>

            {/* Permissions List */}
            <div>
              <div className="mb-3">
                <label className="text-sm font-medium text-gray-900 dark:text-white">
                  Permissions
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select permissions to grant to this user
                </p>
              </div>
              <div className="space-y-2 rounded-lg border border-gray-200 p-4 dark:border-gray-600">
                {availablePermissions.map((perm) => {
                  const isChecked = selectedPermissions.includes(perm.key);
                  return (
                    <div
                      key={perm.key}
                      className="flex items-start gap-3 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Checkbox
                        id={`perm-${perm.key}`}
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          handlePermissionToggle(perm.key);
                        }}
                        disabled={updatePermissionsMutation.isPending}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`perm-${perm.key}`}
                          className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white"
                        >
                          {perm.label}
                        </Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {perm.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticky Footer with Action Buttons */}
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex justify-end gap-3">
              <Button
                color="gray"
                onClick={onClose}
                disabled={updatePermissionsMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="blue"
                disabled={updatePermissionsMutation.isPending}
              >
                {updatePermissionsMutation.isPending && (
                  <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {updatePermissionsMutation.isPending
                  ? "Saving..."
                  : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </CustomModal>
  );
}
