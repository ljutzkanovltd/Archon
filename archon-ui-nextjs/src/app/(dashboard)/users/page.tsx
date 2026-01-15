"use client";

import { usePermissions } from "@/hooks/usePermissions";
import { Forbidden } from "@/components/Forbidden";
import { Card } from "flowbite-react";
import { HiUsers } from "react-icons/hi";

/**
 * Users Management Page
 *
 * Admin-only page for managing users, roles, and permissions.
 * Full implementation will be added in RBAC Phase 3C.
 *
 * Current: Placeholder with permission guard
 * Future: User list, invite modal, role management, permissions editor
 */
export default function UsersPage() {
  // Permission check - admin only
  const { canManageUsers } = usePermissions();
  if (!canManageUsers) {
    return <Forbidden />;
  }

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          User Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage users, roles, and permissions across the Archon platform.
        </p>
      </div>

      {/* Placeholder Card */}
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 rounded-full bg-brand-100 p-6 dark:bg-brand-900/20">
            <HiUsers className="h-16 w-16 text-brand-600 dark:text-brand-400" />
          </div>
          <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-white">
            Coming Soon
          </h2>
          <p className="mb-4 max-w-md text-gray-600 dark:text-gray-400">
            Full user management interface will be implemented in RBAC Phase 3C,
            including user list, invite system, role management, and permissions
            editor.
          </p>
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Phase 3C Features:</strong>
              <br />
              • User list with search and filters
              <br />
              • Invite users via email
              <br />
              • Edit user roles (admin/member/viewer)
              <br />
              • Manage granular permissions
              <br />
              • Deactivate/delete users
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
