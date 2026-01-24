"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card } from "flowbite-react";
import {
  HiServer,
  HiClipboardList,
  HiChartBar,
  HiUsers,
  HiHome,
} from "react-icons/hi";

/**
 * Admin Navigation Component
 *
 * Provides navigation menu for admin pages:
 * - System Health Dashboard
 * - Audit Log Viewer
 * - Workflow Analytics
 * - User Management
 *
 * Features:
 * - Active page highlighting
 * - Icon-based navigation
 * - Responsive design
 * - Dark mode support
 *
 * Usage:
 * ```tsx
 * <AdminNav />
 * ```
 */
export function AdminNav() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/admin",
      label: "Overview",
      icon: HiHome,
      exact: true,
    },
    {
      href: "/admin/health",
      label: "System Health",
      icon: HiServer,
    },
    {
      href: "/admin/audit",
      label: "Audit Log",
      icon: HiClipboardList,
    },
    {
      href: "/admin/analytics",
      label: "Workflow Analytics",
      icon: HiChartBar,
    },
    {
      href: "/admin/users",
      label: "User Management",
      icon: HiUsers,
    },
  ];

  const isActive = (href: string, exact: boolean = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <Card className="sticky top-4">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  active
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </Card>
  );
}
