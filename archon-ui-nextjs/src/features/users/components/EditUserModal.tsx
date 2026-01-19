"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Label, TextInput, Select } from "flowbite-react";
import toast from "react-hot-toast";
import CustomModal from "@/components/common/CustomModal";
import { adminApi } from "@/lib/apiClient";
import { UserListItem } from "@/lib/admin-types";
import { HiMail } from "react-icons/hi";

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserListItem | null;
}

/**
 * EditUserModal - Modal for editing user basic information
 *
 * Allows admins to edit user name, email, role, and send password reset
 */
export function EditUserModal({
  isOpen,
  onClose,
  user,
}: EditUserModalProps) {
  const queryClient = useQueryClient();

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setEmail(user.email);
      setRole((user.role as "admin" | "member" | "viewer") || "member");
    }
  }, [user]);

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user selected");
      return await adminApi.updateUser(user.id, {
        full_name: fullName,
        email,
        role,
      });
    },
    onSuccess: () => {
      toast.success("User updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update user");
    },
  });

  const sendPasswordResetMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("No user selected");
      return await adminApi.sendPasswordReset(user.id);
    },
    onSuccess: () => {
      toast.success("Password reset email sent successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send password reset email");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserMutation.mutate();
  };

  const handleSendPasswordReset = () => {
    const confirmed = window.confirm(
      `Send password reset email to ${user?.email}?`
    );
    if (confirmed) {
      sendPasswordResetMutation.mutate();
    }
  };

  if (!user) return null;

  return (
    <CustomModal
      open={isOpen}
      close={onClose}
      title={`Edit User - ${user.full_name || user.email}`}
      description="Update user information and manage account settings"
      size="LARGE"
      containerClassName="p-0 flex flex-col h-full"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4 space-y-6 min-h-0">
          {/* User Info Card */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>User ID:</strong> {user.id}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Created:</strong>{" "}
              {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* Full Name Field */}
          <div>
            <div className="mb-2 block">
              <Label htmlFor="edit-full-name">Full Name</Label>
            </div>
            <TextInput
              id="edit-full-name"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={updateUserMutation.isPending}
            />
          </div>

          {/* Email Field */}
          <div>
            <div className="mb-2 block">
              <Label htmlFor="edit-email">Email address</Label>
            </div>
            <TextInput
              id="edit-email"
              type="email"
              placeholder="user@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={updateUserMutation.isPending}
            />
          </div>

          {/* Role Field */}
          <div>
            <div className="mb-2 block">
              <Label htmlFor="edit-role">Role</Label>
            </div>
            <Select
              id="edit-role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "admin" | "member" | "viewer")
              }
              disabled={updateUserMutation.isPending}
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </Select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Admins have full access, Members have standard access, Viewers have
              read-only access
            </p>
          </div>

          {/* Password Reset Section */}
          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
              Password Management
            </h4>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              Send a password reset email to allow the user to set a new password.
            </p>
            <Button
              type="button"
              color="light"
              size="sm"
              onClick={handleSendPasswordReset}
              disabled={
                sendPasswordResetMutation.isPending ||
                updateUserMutation.isPending
              }
            >
              <HiMail className="mr-2 h-4 w-4" />
              {sendPasswordResetMutation.isPending
                ? "Sending..."
                : "Send Password Reset Email"}
            </Button>
          </div>
        </div>

        {/* Sticky Footer with Action Buttons */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex justify-end gap-3">
            <Button
              color="gray"
              onClick={onClose}
              disabled={updateUserMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="blue"
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending && (
                <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>
    </CustomModal>
  );
}
