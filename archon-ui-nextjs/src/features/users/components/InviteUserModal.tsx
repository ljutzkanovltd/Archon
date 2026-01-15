"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Label, TextInput, Button, Checkbox } from "flowbite-react";
import toast from "react-hot-toast";
import CustomModal from "@/components/common/CustomModal";
import { adminApi } from "@/lib/apiClient";
import { PermissionKey } from "@/lib/admin-types";

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * InviteUserModal - Modal for sending user invitations
 *
 * Allows admins to invite new users via email with optional permissions
 */
export function InviteUserModal({ isOpen, onClose }: InviteUserModalProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const inviteMutation = useMutation({
    mutationFn: async () => {
      return await adminApi.inviteUser({
        email,
        message: message || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Invitation sent successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const handleClose = () => {
    setEmail("");
    setMessage("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate();
  };

  return (
    <CustomModal
      open={isOpen}
      close={handleClose}
      title="Invite New User"
      description="Send an invitation email to add a new user to the platform"
      size="LARGE"
    >
      <form onSubmit={handleSubmit} className="space-y-6 p-6">
        {/* Email Field */}
        <div>
          <div className="mb-2 block">
            <Label htmlFor="invite-email">Email address *</Label>
          </div>
          <TextInput
            id="invite-email"
            type="email"
            placeholder="user@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={inviteMutation.isPending}
          />
        </div>

        {/* Custom Message Field */}
        <div>
          <div className="mb-2 block">
            <Label htmlFor="invite-message">Custom message (optional)</Label>
          </div>
          <TextInput
            id="invite-message"
            type="text"
            placeholder="Join our team on Archon!"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={inviteMutation.isPending}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            This message will be included in the invitation email
          </p>
        </div>

        {/* Info Note */}
        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
          <p className="text-sm text-blue-800 dark:text-blue-400">
            <strong>Note:</strong> You can set up permissions after the user accepts the invitation.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            color="light"
            onClick={handleClose}
            disabled={inviteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            color="purple"
            disabled={inviteMutation.isPending}
          >
            {inviteMutation.isPending && (
              <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
          </Button>
        </div>
      </form>
    </CustomModal>
  );
}
