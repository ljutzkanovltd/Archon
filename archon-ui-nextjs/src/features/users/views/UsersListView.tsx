"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { HiUserAdd, HiKey, HiStatusOnline, HiStatusOffline } from "react-icons/hi";
import { DataTable, DataTableColumn, DataTableButton, FilterConfig } from "@/components/common/DataTable";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import { usePageTitle } from "@/hooks";
import { adminApi } from "@/lib/apiClient";
import { UserListItem } from "@/lib/admin-types";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import {
  StatusBadge,
  VerifiedBadge,
  UsersHeader,
  InviteUserModal,
  EditPermissionsModal,
} from "../components";
import { usePermissions } from "@/hooks/usePermissions";
import { Forbidden } from "@/components/Forbidden";

/**
 * UsersListView - List view for users with DataTable integration
 *
 * Features:
 * - Table view with search and filtering
 * - Status badges (active/inactive, verified/unverified)
 * - Row actions (edit permissions, toggle status)
 * - Invite user modal
 * - Pagination
 */
export function UsersListView() {
  usePageTitle("Users", "Archon");

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

  // Fetch users with error handling (MUST be called unconditionally per Rules of Hooks)
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
        if (err.status === 401) {
          toast.error("Session expired. Please log in again.");
        }
        throw err;
      }
    },
    placeholderData: (previousData) => previousData,
    retry: false,
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (user: UserListItem) => {
      return await adminApi.updateUserStatus(user.id, {
        is_active: !user.is_active,
      });
    },
    onSuccess: (_, user) => {
      toast.success(
        `User ${user.is_active ? "deactivated" : "activated"} successfully`
      );
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: any, user) => {
      toast.error(
        error.message ||
          `Failed to ${user.is_active ? "deactivate" : "activate"} user`
      );
    },
  });

  // ========== HANDLERS ==========

  const handleInviteUser = () => {
    setInviteModalOpen(true);
  };

  const handleEditPermissions = (user: UserListItem) => {
    setSelectedUser(user);
    setPermissionsModalOpen(true);
  };

  const handleToggleStatus = async (user: UserListItem) => {
    const action = user.is_active ? "deactivate" : "activate";
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${user.full_name || user.email}?`
    );

    if (confirmed) {
      toggleStatusMutation.mutate(user);
    }
  };

  // ========== TABLE CONFIGURATION ==========

  const columns: DataTableColumn<UserListItem>[] = [
    {
      key: "email",
      label: "User",
      sortable: true,
      render: (value, user) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {user.full_name || "—"}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {value}
          </div>
        </div>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      width: "120px",
      render: (value) => <StatusBadge isActive={value} />,
    },
    {
      key: "is_verified",
      label: "Verification",
      sortable: true,
      width: "140px",
      render: (value) => <VerifiedBadge isVerified={value} />,
    },
    {
      key: "created_at",
      label: "Joined",
      sortable: true,
      width: "150px",
      render: (value) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDistanceToNow(new Date(value), { addSuffix: true })}
        </span>
      ),
    },
  ];

  const tableButtons: DataTableButton[] = [
    {
      label: "Invite User",
      icon: HiUserAdd,
      onClick: handleInviteUser,
      variant: "primary",
    },
  ];

  const rowButtons = (user: UserListItem): DataTableButton[] => [
    {
      label: "Edit Permissions",
      icon: HiKey,
      onClick: () => handleEditPermissions(user),
      ariaLabel: `Edit permissions for ${user.full_name || user.email}`,
    },
    {
      label: user.is_active ? "Deactivate" : "Activate",
      icon: user.is_active ? HiStatusOffline : HiStatusOnline,
      onClick: () => handleToggleStatus(user),
      variant: user.is_active ? "ghost" : "primary",
      disabled: toggleStatusMutation.isPending,
      ariaLabel: user.is_active
        ? `Deactivate ${user.full_name || user.email}`
        : `Activate ${user.full_name || user.email}`,
    },
  ];

  // Filter configuration
  const filterConfigs: FilterConfig[] = [
    {
      field: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "all", label: "All Users" },
        { value: "active", label: "Active Only" },
        { value: "inactive", label: "Inactive Only" },
        { value: "verified", label: "Verified Only" },
        { value: "unverified", label: "Unverified Only" },
      ],
    },
  ];

  // ========== RENDER ==========

  // Permission guard (MUST be after all hooks per Rules of Hooks)
  if (!canManageUsers) {
    return <Forbidden />;
  }

  if (error) {
    return (
      <div className="p-8">
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          <p className="font-semibold">Error loading users</p>
          <p className="text-sm">{(error as any).message || "Unknown error"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <BreadCrumb
        items={[{ label: "Users", href: "/users" }]}
        className="mb-4"
      />

      {/* Page Header */}
      <UsersHeader />

      {/* DataTable */}
      <DataTable
        data={usersData?.users || []}
        columns={columns}
        tableButtons={tableButtons}
        rowButtons={rowButtons}
        tableId="archon-users-list"
        enableMultiSort={true}
        showPrimaryAction={true}
        viewMode="table"
        showSearch
        filterConfigs={filterConfigs}
        showViewToggle={false}
        showFilters={true}
        showPagination
        isLoading={isLoading}
        emptyMessage="No users found. Invite your first user to get started!"
        caption={`List of ${usersData?.total || 0} users`}
        totalItems={usersData?.total || 0}
        initialPage={page}
        initialPerPage={perPage}
      />

      {/* Modals */}
      <InviteUserModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />
      <EditPermissionsModal
        isOpen={permissionsModalOpen}
        onClose={() => {
          setPermissionsModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />
    </div>
  );
}
