"use client";

import Link from "next/link";
import { HiHome, HiChevronRight } from "react-icons/hi";

export interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface BreadCrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * BreadCrumb - Navigation breadcrumb component
 *
 * Features:
 * - Auto-includes Home link
 * - Next.js Link integration for client-side navigation
 * - Dark mode support
 * - Responsive design with text truncation
 * - Flowbite styling
 *
 * @example
 * ```tsx
 * <BreadCrumb items={[
 *   { label: "Projects", href: "/projects" },
 *   { label: "Project Name", href: "/projects/123" }
 * ]} />
 * ```
 */
export function BreadCrumb({ items, className = "" }: BreadCrumbProps) {
  // Always include Home as first item
  const allItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    ...items,
  ];

  return (
    <nav
      className={`flex ${className}`}
      aria-label="Breadcrumb"
    >
      <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isHome = index === 0;

          return (
            <li key={item.href} className="inline-flex items-center">
              {/* Separator (except for first item) */}
              {!isHome && (
                <HiChevronRight className="mx-1 h-4 w-4 text-gray-400 rtl:rotate-180 dark:text-gray-600" />
              )}

              {isLast ? (
                // Current page - not a link
                <span className="inline-flex items-center text-sm font-medium text-gray-500 dark:text-gray-400">
                  {isHome && <HiHome className="mr-2 h-4 w-4" />}
                  <span className="max-w-[150px] truncate md:max-w-none">
                    {item.label}
                  </span>
                </span>
              ) : (
                // Link to previous pages
                <Link
                  href={item.href}
                  className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-brand-600 dark:text-gray-400 dark:hover:text-white"
                >
                  {isHome && <HiHome className="mr-2 h-4 w-4" />}
                  <span className="max-w-[150px] truncate md:max-w-none">
                    {item.label}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
