/**
 * LoadingStates - Comprehensive loading state components
 *
 * Provides skeleton loaders, spinners, and loading indicators
 * for better user experience during async operations.
 *
 * Usage:
 *
 * ```tsx
 * import {
 *   Skeleton,
 *   SkeletonCard,
 *   SkeletonProjectCard,
 *   SkeletonTable,
 *   Spinner,
 *   FullPageSpinner
 * } from '@/components/LoadingStates';
 *
 * // Basic skeleton
 * <Skeleton width="200px" height="1rem" />
 *
 * // Project card skeleton
 * <SkeletonProjectCard />
 *
 * // Table skeleton
 * <SkeletonTable columns={5} rows={10} />
 *
 * // Spinner
 * <Spinner size="lg" center />
 *
 * // Full page loading
 * <FullPageSpinner message="Loading project..." />
 * ```
 */

// Base components
export { Skeleton, SkeletonText, SkeletonCircle } from "./Skeleton";

// Card skeletons
export {
  SkeletonCard,
  SkeletonProjectCard,
  SkeletonTaskCard,
} from "./SkeletonCard";

// Table and list skeletons
export { SkeletonTable, SkeletonList } from "./SkeletonTable";

// Spinners
export { Spinner, FullPageSpinner, InlineSpinner } from "./Spinner";
