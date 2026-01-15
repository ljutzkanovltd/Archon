"use client";

interface StatusBadgeProps {
  isActive: boolean;
}

/**
 * StatusBadge - Display user active/inactive status
 *
 * Usage:
 * ```tsx
 * <StatusBadge isActive={user.is_active} />
 * ```
 */
export function StatusBadge({ isActive }: StatusBadgeProps) {
  return isActive ? (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-400">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/20 dark:text-red-400">
      Inactive
    </span>
  );
}
