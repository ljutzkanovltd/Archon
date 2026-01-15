"use client";

import Link from "next/link";
import { HiLockClosed, HiHome } from "react-icons/hi";
import { Button } from "flowbite-react";

/**
 * Forbidden Component (403 Access Denied)
 *
 * Displays a user-friendly error message when a user attempts to
 * access a page or feature they don't have permission for.
 *
 * **When to use:**
 * - User is authenticated but lacks required role/permission
 * - Protecting admin-only pages
 * - Protecting feature-gated content
 *
 * **NOT for:**
 * - Unauthenticated users (redirect to /login instead)
 * - 404 errors (use NotFound component)
 *
 * @example
 * ```tsx
 * const { canManageUsers } = usePermissions();
 *
 * if (!canManageUsers) {
 *   return <Forbidden />;
 * }
 * ```
 */
export function Forbidden() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-100 p-6 dark:bg-red-900/20">
            <HiLockClosed className="h-16 w-16 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* Status Code */}
        <h1 className="mb-2 text-6xl font-bold text-gray-900 dark:text-white">
          403
        </h1>

        {/* Title */}
        <h2 className="mb-4 text-2xl font-semibold text-gray-800 dark:text-gray-200">
          Access Denied
        </h2>

        {/* Description */}
        <p className="mb-8 text-gray-600 dark:text-gray-400">
          You don't have permission to access this page. If you believe this is
          an error, please contact your administrator.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/">
            <Button color="blue" size="lg">
              <HiHome className="mr-2 h-5 w-5" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Additional Help Text */}
        <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          Need access?{" "}
          <Link
            href="/settings"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
}
