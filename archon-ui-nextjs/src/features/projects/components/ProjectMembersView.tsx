"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Label, Select, Badge, Spinner } from "flowbite-react";
import toast from "react-hot-toast";
import { HiPlus, HiX, HiUsers, HiUserCircle } from "react-icons/hi";
import { adminApi } from "@/lib/apiClient";
import { projectsApi } from "@/lib/apiClient";
import { ProjectMemberItem } from "@/lib/admin-types";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import { usePermissions } from "@/hooks/usePermissions";

interface ProjectMembersViewProps {
  projectId: string;
  projectTitle: string;
}

/**
 * ProjectMembersView - View for managing project members
 *
 * Features:
 * - Display list of project members with access levels
 * - Add new members with owner/member access
 * - Remove members from project
 * - Shows admin users (they have automatic access)
 * - Real-time updates via React Query
 */
export function ProjectMembersView({
  projectId,
  projectTitle,
}: ProjectMembersViewProps) {
  const queryClient = useQueryClient();
  const { canManageUsers } = usePermissions();

  // State for adding new member
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<"owner" | "member">("member");
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch project members
  const { data: membersData, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      return await adminApi.getProjectMembers(projectId);
    },
    enabled: canManageUsers,
  });

  // Fetch all users for the dropdown (only admin users can see this)
  const { data: allUsersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      return await adminApi.listUsers({ per_page: 100 });
    },
    enabled: canManageUsers && showAddForm,
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) {
        throw new Error("User not selected");
      }
      return await adminApi.addProjectMember(projectId, {
        user_id: selectedUserId,
        access_level: selectedAccessLevel,
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
      // Reset form
      setSelectedUserId("");
      setSelectedAccessLevel("member");
      setShowAddForm(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to add member");
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ userId, userName }: { userId: string; userName: string }) => {
      return await adminApi.removeProjectMember(projectId, userId);
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to remove member");
    },
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }
    addMemberMutation.mutate();
  };

  const handleRemoveMember = (member: ProjectMemberItem) => {
    // Don't allow removing admin users (they have automatic access)
    if (member.role === "admin") {
      toast.error("Cannot remove admin users - they have automatic access to all projects");
      return;
    }

    const confirmed = window.confirm(
      `Remove ${member.full_name} from project "${projectTitle}"?`
    );
    if (confirmed) {
      removeMemberMutation.mutate({
        userId: member.user_id,
        userName: member.full_name,
      });
    }
  };

  // Get available users (not already members)
  const memberUserIds = new Set(
    membersData?.members.map((m) => m.user_id) || []
  );
  const availableUsers = allUsersData?.users.filter(
    (u) => !memberUserIds.has(u.id)
  ) || [];

  // Permission check
  if (!canManageUsers) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
        <HiUsers className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          You don't have permission to manage project members
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Member Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Project Members
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {membersData?.total || 0} member{membersData?.total !== 1 ? "s" : ""}
          </p>
        </div>

        {!showAddForm && (
          <Button
            color="blue"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <HiPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {/* Add Member Form */}
      {showAddForm && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <form onSubmit={handleAddMember} className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Add Member to Project
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="user-select">User</Label>
                <Select
                  id="user-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={addMemberMutation.isPending || isLoadingUsers}
                >
                  <option value="">Select a user...</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="access-level-select">Access Level</Label>
                <Select
                  id="access-level-select"
                  value={selectedAccessLevel}
                  onChange={(e) =>
                    setSelectedAccessLevel(e.target.value as "owner" | "member")
                  }
                  disabled={addMemberMutation.isPending}
                >
                  <option value="member">Member</option>
                  <option value="owner">Owner</option>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                color="gray"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedUserId("");
                  setSelectedAccessLevel("member");
                }}
                disabled={addMemberMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="blue"
                size="sm"
                disabled={!selectedUserId || addMemberMutation.isPending}
              >
                {addMemberMutation.isPending ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <HiPlus className="mr-2 h-4 w-4" />
                    Add Member
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Members List */}
      {isLoadingMembers ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : membersData?.members.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <HiUserCircle className="mx-auto h-16 w-16 text-gray-400" />
          <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No members yet
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add team members to this project to collaborate
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {membersData?.members.map((member) => (
            <div
              key={member.id}
              className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start gap-3 flex-1">
                {/* Avatar */}
                {member.avatar_url ? (
                  <Image
                    src={member.avatar_url}
                    alt={member.full_name}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white font-semibold">
                    {member.full_name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {member.full_name}
                    </h4>
                    <Badge
                      color={member.access_level === "owner" ? "purple" : "info"}
                      size="xs"
                    >
                      {member.access_level}
                    </Badge>
                    {member.role === "admin" && (
                      <Badge color="failure" size="xs">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {member.email}
                  </p>
                  {member.added_at && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Added {formatDistanceToNow(new Date(member.added_at), { addSuffix: true })}
                      {member.added_by_name && ` by ${member.added_by_name}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Remove Button */}
              {member.role !== "admin" && (
                <Button
                  color="light"
                  size="xs"
                  onClick={() => handleRemoveMember(member)}
                  disabled={removeMemberMutation.isPending}
                  title="Remove from project"
                >
                  <HiX className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
