"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Tasks Page - Redirects to Projects Page
 *
 * Tasks are now managed per-project. This page redirects users
 * to the projects page where they can view task counts for each
 * project and manage tasks within project context.
 */
export default function TasksPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to projects page
    router.replace("/projects");
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent mx-auto" />
        <p className="text-gray-600 dark:text-gray-400">
          Redirecting to Projects...
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
          Tasks are now managed per-project
        </p>
      </div>
    </div>
  );
}
