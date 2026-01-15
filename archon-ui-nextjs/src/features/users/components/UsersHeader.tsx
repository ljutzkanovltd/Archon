"use client";

/**
 * UsersHeader - Header component for users page
 *
 * Displays page title and description for user management interface
 */
export function UsersHeader() {
  return (
    <div className="mb-6">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
        User Management
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        Manage users, invitations, and permissions across the Archon platform.
      </p>
    </div>
  );
}
