"use client";

interface VerifiedBadgeProps {
  isVerified: boolean;
}

/**
 * VerifiedBadge - Display user email verification status
 *
 * Usage:
 * ```tsx
 * <VerifiedBadge isVerified={user.is_verified} />
 * ```
 */
export function VerifiedBadge({ isVerified }: VerifiedBadgeProps) {
  return isVerified ? (
    <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900/20 dark:text-brand-400">
      ✓ Verified
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      Unverified
    </span>
  );
}
