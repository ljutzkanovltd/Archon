import { Skeleton, SkeletonText, SkeletonCircle } from "./Skeleton";

/**
 * SkeletonCard - Skeleton for card layouts
 *
 * Common patterns:
 * - Project cards
 * - Task cards
 * - Team member cards
 */

interface SkeletonCardProps {
  /**
   * Show header with avatar/icon
   * @default true
   */
  showHeader?: boolean;

  /**
   * Number of text lines in body
   * @default 3
   */
  bodyLines?: number;

  /**
   * Show footer actions
   * @default true
   */
  showFooter?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export function SkeletonCard({
  showHeader = true,
  bodyLines = 3,
  showFooter = true,
  className = "",
}: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-label="Loading content..."
      className={`rounded-lg border-2 border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {/* Header */}
      {showHeader && (
        <div className="mb-4 flex items-center gap-4">
          <SkeletonCircle size="3rem" />
          <div className="flex-1">
            <Skeleton height="1.25rem" width="60%" className="mb-2" />
            <Skeleton height="0.875rem" width="40%" />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="mb-4">
        <SkeletonText lines={bodyLines} />
      </div>

      {/* Footer */}
      {showFooter && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
          <Skeleton height="2rem" width="6rem" variant="lg" />
          <Skeleton height="2rem" width="4rem" variant="lg" />
        </div>
      )}
    </div>
  );
}

/**
 * SkeletonProjectCard - Specific skeleton for project cards
 * Matches ProjectWithTasksCard structure
 */
export function SkeletonProjectCard() {
  return (
    <div
      role="status"
      aria-label="Loading project..."
      className="rounded-lg border-2 border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
    >
      {/* Project title */}
      <Skeleton height="1.5rem" width="70%" className="mb-3" />

      {/* Description */}
      <Skeleton height="1rem" width="90%" className="mb-4" />

      {/* Stats row */}
      <div className="mb-4 flex gap-6">
        <div className="flex-1">
          <Skeleton height="0.875rem" width="4rem" className="mb-1" />
          <Skeleton height="1.25rem" width="3rem" />
        </div>
        <div className="flex-1">
          <Skeleton height="0.875rem" width="4rem" className="mb-1" />
          <Skeleton height="1.25rem" width="3rem" />
        </div>
        <div className="flex-1">
          <Skeleton height="0.875rem" width="4rem" className="mb-1" />
          <Skeleton height="1.25rem" width="3rem" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Skeleton height="2.25rem" width="5rem" variant="lg" />
        <Skeleton height="2.25rem" width="5rem" variant="lg" />
        <Skeleton height="2.25rem" width="5rem" variant="lg" />
      </div>
    </div>
  );
}

/**
 * SkeletonTaskCard - Skeleton for task cards in kanban board
 */
export function SkeletonTaskCard() {
  return (
    <div
      role="status"
      aria-label="Loading task..."
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      {/* Task title */}
      <Skeleton height="1.25rem" width="80%" className="mb-2" />

      {/* Description */}
      <Skeleton height="0.875rem" width="100%" className="mb-1" />
      <Skeleton height="0.875rem" width="70%" className="mb-3" />

      {/* Metadata row */}
      <div className="flex items-center justify-between">
        <Skeleton height="1.5rem" width="4rem" variant="full" />
        <SkeletonCircle size="1.75rem" />
      </div>
    </div>
  );
}
