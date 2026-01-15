"use client";

import React from "react";
import { shouldShowTestFoundation } from "@/lib/utils";

// Lazy load the full test foundation content
const TestFoundationContent = React.lazy(() =>
  import("./TestFoundationContent").then((mod) => ({
    default: mod.TestFoundationContent,
  }))
);

/**
 * Test Foundation Tab for Settings
 *
 * This tab provides testing capabilities for the foundation layer:
 * - API Client tests
 * - Store (Zustand) tests
 * - Custom Hooks tests
 *
 * Only visible when NEXT_PUBLIC_SHOW_TEST_FOUNDATION=true (dev/staging)
 */
export default function TestFoundationTab() {
  // Check environment flag
  if (!shouldShowTestFoundation()) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-600 dark:text-gray-400">
          Test Foundation is disabled. Set{" "}
          <code className="rounded bg-gray-200 px-2 py-1 text-sm dark:bg-gray-700">
            NEXT_PUBLIC_SHOW_TEST_FOUNDATION=true
          </code>{" "}
          in your <code>.env.local</code> file to enable.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Test Foundation
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Test API Client, Stores, and Custom Hooks
        </p>
      </div>

      {/* Lazy-loaded Test Content */}
      <React.Suspense
        fallback={
          <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-12 dark:border-gray-700 dark:bg-gray-800">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600 dark:border-gray-700"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading Test Foundation...
              </p>
            </div>
          </div>
        }
      >
        <TestFoundationContent />
      </React.Suspense>
    </div>
  );
}
