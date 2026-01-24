"use client";

import { useState } from "react";
import { Button, Label, Select, Badge, Spinner } from "flowbite-react";
import toast from "react-hot-toast";
import { HiPlus, HiX, HiUsers, HiUserCircle } from "react-icons/hi";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import {
  useTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  useUpdateMemberRole,
} from "../hooks/useTeamQueries";
import type { TeamRole, TeamMember } from "@/lib/types";

interface TeamMemberListProps {
  teamId: string;
  teamName: string;
  projectId?: string;
}

/**
 * TeamMemberList - Component for managing team members
 *
 * Features:
 * - Display list of team members with avatars and role badges
 * - Add new members with role selection (lead/member/observer)
 * - Remove members from team
 * - Update member roles
 * - Real-time updates via React Query
 *
 * Usage:
 * ```tsx
 * <TeamMemberList teamId={teamId} teamName="Engineering Team" />
 * ```
 */
export function TeamMemberList({
  teamId,
  teamName,
  projectId,
}: TeamMemberListProps) {
  // State for adding new member
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<TeamRole>("member");
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch team with members
  const { data: teamData, isLoading: isLoadingTeam } = useTeam(teamId, true);

  // Mutations
  const addMemberMutation = useAddTeamMember();
  const removeMemberMutation = useRemoveTeamMember();
  const updateRoleMutation = useUpdateMemberRole();

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    try {
      await addMemberMutation.mutateAsync({
        teamId,
        userId: selectedUserId,
        role: selectedRole,
      });
      toast.success("Member added successfully");
      // Reset form
      setSelectedUserId("");
      setSelectedRole("member");
      setShowAddForm(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to add member");
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    const confirmed = window.confirm(
      `Remove this member from team "${teamName}"?`
    );
    if (confirmed) {
      try {
        await removeMemberMutation.mutateAsync({
          teamId,
          userId: member.user_id,
        });
        toast.success("Member removed successfully");
      } catch (error: any) {
        toast.error(error.message || "Failed to remove member");
      }
    }
  };

  const handleUpdateRole = async (member: TeamMember, newRole: TeamRole) => {
    if (newRole === member.role) return;

    try {
      await updateRoleMutation.mutateAsync({
        teamId,
        userId: member.user_id,
        role: newRole,
      });
      toast.success("Member role updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update member role");
    }
  };

  const members = teamData?.members || [];

  return (
    <div className="space-y-6">
      {/* Header with Add Member Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Team Members
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {members.length} member{members.length !== 1 ? "s" : ""}
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
              Add Member to Team
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="user-select">User</Label>
                <Select
                  id="user-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={addMemberMutation.isPending}
                >
                  <option value="">Select a user...</option>
                  {/* TODO: Phase 4.6 - Fetch available users from API */}
                  <option value="temp-user-1">User 1 (user1@example.com)</option>
                  <option value="temp-user-2">User 2 (user2@example.com)</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="role-select">Role</Label>
                <Select
                  id="role-select"
                  value={selectedRole}
                  onChange={(e) =>
                    setSelectedRole(e.target.value as TeamRole)
                  }
                  disabled={addMemberMutation.isPending}
                >
                  <option value="member">Member</option>
                  <option value="lead">Lead</option>
                  <option value="observer">Observer</option>
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
                  setSelectedRole("member");
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
      {isLoadingTeam ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <HiUserCircle className="mx-auto h-16 w-16 text-gray-400" />
          <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No members yet
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add team members to start collaborating
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onRemove={handleRemoveMember}
              onUpdateRole={handleUpdateRole}
              isUpdating={updateRoleMutation.isPending}
              isRemoving={removeMemberMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MemberCard - Individual member card with avatar, role badge, and actions
 */
interface MemberCardProps {
  member: TeamMember;
  onRemove: (member: TeamMember) => void;
  onUpdateRole: (member: TeamMember, newRole: TeamRole) => void;
  isUpdating: boolean;
  isRemoving: boolean;
}

function MemberCard({
  member,
  onRemove,
  onUpdateRole,
  isUpdating,
  isRemoving,
}: MemberCardProps) {
  // Get role badge color
  const getRoleBadgeColor = (role: TeamRole) => {
    switch (role) {
      case "lead":
        return "purple";
      case "member":
        return "info";
      case "observer":
        return "gray";
      default:
        return "info";
    }
  };

  // Note: User data would come from joined query in real implementation
  // For now, showing member data structure
  const userName = `User ${member.user_id.substring(0, 8)}`;
  const userInitial = "U";

  return (
    <div className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3 flex-1">
        {/* Avatar - placeholder for now */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white font-semibold">
          {userInitial}
        </div>

        {/* Member Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {userName}
            </h4>
            <Badge
              color={getRoleBadgeColor(member.role)}
              size="xs"
            >
              {member.role}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            ID: {member.user_id.substring(0, 8)}...
          </p>
          {member.joined_at && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
            </p>
          )}

          {/* Role Selector */}
          <div className="mt-2">
            <Select
              sizing="sm"
              value={member.role}
              onChange={(e) => onUpdateRole(member, e.target.value as TeamRole)}
              disabled={isUpdating}
            >
              <option value="member">Member</option>
              <option value="lead">Lead</option>
              <option value="observer">Observer</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Remove Button */}
      <Button
        color="light"
        size="xs"
        onClick={() => onRemove(member)}
        disabled={isRemoving}
        title="Remove from team"
      >
        <HiX className="h-4 w-4" />
      </Button>
    </div>
  );
}
