"use client";

import { ReactNode } from "react";
import { AdminNav } from "./AdminNav";
import { Card, Alert } from "flowbite-react";
import { HiInformationCircle } from "react-icons/hi";

/**
 * Admin Layout Component
 *
 * Provides consistent layout for all admin pages with:
 * - Side navigation
 * - Main content area
 * - Permission requirements notice
 * - Responsive 2-column layout
 *
 * Features:
 * - Sticky navigation sidebar
 * - Full-width content area
 * - Dark mode support
 * - Responsive design (stacks on mobile)
 *
 * Usage:
 * ```tsx
 * <AdminLayout>
 *   <YourAdminContent />
 * </AdminLayout>
 * ```
 */
interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  requiresPermission?: string;
}

export function AdminLayout({
  children,
  title,
  description,
  requiresPermission = "admin",
}: AdminLayoutProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      {(title || description) && (
        <div className="mb-6">
          {title && (
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
          )}
          {description && (
            <p className="mt-2 text-gray-600 dark:text-gray-400">{description}</p>
          )}
        </div>
      )}

      {/* Permission Notice */}
      {requiresPermission && (
        <Alert color="info" icon={HiInformationCircle} className="mb-6">
          <span className="text-sm">
            <strong>Admin Access Required:</strong> These pages require{" "}
            <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">
              {requiresPermission}
            </code>{" "}
            permissions to access.
          </span>
        </Alert>
      )}

      {/* Layout Grid */}
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        {/* Navigation Sidebar */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <AdminNav />
        </aside>

        {/* Main Content */}
        <main>{children}</main>
      </div>
    </div>
  );
}
