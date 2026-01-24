import { Skeleton } from "./Skeleton";

/**
 * SkeletonTable - Skeleton for table layouts
 *
 * Provides realistic loading state for DataTable components
 */

interface SkeletonTableProps {
  /**
   * Number of columns
   * @default 4
   */
  columns?: number;

  /**
   * Number of rows to display
   * @default 5
   */
  rows?: number;

  /**
   * Show table header
   * @default true
   */
  showHeader?: boolean;

  /**
   * Show action buttons column
   * @default true
   */
  showActions?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export function SkeletonTable({
  columns = 4,
  rows = 5,
  showHeader = true,
  showActions = true,
  className = "",
}: SkeletonTableProps) {
  const totalColumns = showActions ? columns + 1 : columns;

  return (
    <div
      role="status"
      aria-label="Loading table data..."
      className={`overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Table Header */}
          {showHeader && (
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {Array.from({ length: totalColumns }).map((_, colIndex) => (
                  <th key={colIndex} className="p-4">
                    <Skeleton
                      height="1rem"
                      width={
                        colIndex === totalColumns - 1 && showActions
                          ? "4rem"
                          : `${60 + Math.random() * 30}%`
                      }
                    />
                  </th>
                ))}
              </tr>
            </thead>
          )}

          {/* Table Body */}
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: totalColumns }).map((_, colIndex) => (
                  <td key={colIndex} className="p-4">
                    {colIndex === totalColumns - 1 && showActions ? (
                      // Actions column - buttons
                      <div className="flex gap-2">
                        <Skeleton height="2rem" width="2rem" variant="md" />
                        <Skeleton height="2rem" width="2rem" variant="md" />
                      </div>
                    ) : (
                      // Data column
                      <Skeleton
                        height="1rem"
                        width={`${50 + Math.random() * 40}%`}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * SkeletonList - Skeleton for list layouts
 *
 * Provides realistic loading state for list views
 */

interface SkeletonListProps {
  /**
   * Number of list items
   * @default 5
   */
  items?: number;

  /**
   * Show avatar/icon
   * @default true
   */
  showAvatar?: boolean;

  /**
   * Number of text lines per item
   * @default 2
   */
  lines?: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export function SkeletonList({
  items = 5,
  showAvatar = true,
  lines = 2,
  className = "",
}: SkeletonListProps) {
  return (
    <div
      role="status"
      aria-label="Loading list..."
      className={`space-y-4 ${className}`}
    >
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          {showAvatar && (
            <div className="flex-shrink-0">
              <Skeleton width="3rem" height="3rem" variant="full" />
            </div>
          )}

          <div className="flex-1">
            <Skeleton height="1.25rem" width="60%" className="mb-2" />
            {Array.from({ length: lines - 1 }).map((_, lineIndex) => (
              <Skeleton
                key={lineIndex}
                height="0.875rem"
                width={`${70 + Math.random() * 20}%`}
                className="mb-1"
              />
            ))}
          </div>

          <div className="flex-shrink-0">
            <Skeleton height="2rem" width="4rem" variant="lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
