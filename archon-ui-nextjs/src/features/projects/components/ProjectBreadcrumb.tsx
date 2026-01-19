"use client";

import { HiChevronRight, HiHome } from "react-icons/hi";
import Link from "next/link";

interface BreadcrumbItem {
  id: string;
  title: string;
  href: string;
}

interface ProjectBreadcrumbProps {
  ancestors: BreadcrumbItem[];
  current: BreadcrumbItem;
  showHome?: boolean;
  className?: string;
}

/**
 * ProjectBreadcrumb Component
 *
 * Phase 3.4: Breadcrumb navigation
 *
 * Features:
 * - Display hierarchical path from root to current project
 * - Optional home link
 * - Clickable ancestor links
 * - Current project highlighted (not clickable)
 * - Responsive truncation for long paths
 * - Dark mode support
 *
 * Usage:
 * ```tsx
 * <ProjectBreadcrumb
 *   ancestors={[
 *     { id: "1", title: "Platform", href: "/projects/1" },
 *     { id: "2", title: "Frontend", href: "/projects/2" },
 *   ]}
 *   current={{ id: "3", title: "Auth Module", href: "/projects/3" }}
 *   showHome={true}
 * />
 * ```
 */
export function ProjectBreadcrumb({
  ancestors,
  current,
  showHome = true,
  className = "",
}: ProjectBreadcrumbProps) {
  return (
    <nav
      className={`flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 ${className}`}
      aria-label="Breadcrumb"
    >
      <ol className="inline-flex items-center space-x-1">
        {/* Home Link (Optional) */}
        {showHome && (
          <li className="inline-flex items-center">
            <Link
              href="/projects"
              className="inline-flex items-center text-gray-600 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
            >
              <HiHome className="h-4 w-4" />
              <span className="sr-only">Projects Home</span>
            </Link>
          </li>
        )}

        {/* Ancestor Links */}
        {ancestors.map((ancestor, index) => (
          <li key={ancestor.id} className="inline-flex items-center">
            <HiChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-600" />
            <Link
              href={ancestor.href}
              className="ml-1 truncate text-gray-600 hover:text-brand-600 hover:underline dark:text-gray-400 dark:hover:text-brand-400"
              title={ancestor.title}
            >
              {ancestor.title}
            </Link>
          </li>
        ))}

        {/* Current Project */}
        <li className="inline-flex items-center" aria-current="page">
          <HiChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-600" />
          <span
            className="ml-1 truncate font-medium text-gray-900 dark:text-white"
            title={current.title}
          >
            {current.title}
          </span>
        </li>
      </ol>
    </nav>
  );
}
