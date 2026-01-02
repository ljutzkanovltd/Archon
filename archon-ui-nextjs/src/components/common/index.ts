/**
 * Common components shared across the Archon dashboard
 * Aligned with SportERP Flowbite patterns
 */

export { default as CustomModal } from "./CustomModal";
export { default as EmptyState } from "./EmptyState";
export { default as RowMenu } from "./RowMenu";
export type { RowMenuAction } from "./RowMenu";
export { default as ViewModeToggle } from "./ViewModeToggle";
export type { ViewMode } from "./ViewModeToggle";

// Re-export DataTable components
export { default as DataTable } from "./DataTable";
export * from "./DataTable/context/DataTableContext";
