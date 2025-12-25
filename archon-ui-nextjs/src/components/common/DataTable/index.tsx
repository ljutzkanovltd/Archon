"use client";

import React from "react";
import {
  DataTableProvider,
  DataTableColumn,
  DataTableButton,
} from "./context/DataTableContext";
import { DataTableList } from "./DataTableList";
import { DataTableGrid } from "./DataTableGrid";
import { DataTableSearch } from "./DataTableSearch";
import { DataTableFilters } from "./DataTableFilters";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableHeader } from "./DataTableHeader";

/**
 * DataTable - Main wrapper component
 *
 * A flexible, type-safe table component with:
 * - Multiple view modes (table, grid, list, custom)
 * - Built-in pagination, filtering, sorting
 * - Row and table-level actions
 * - Empty states and loading states
 * - Fully customizable via context
 *
 * @example
 * ```tsx
 * <DataTable
 *   data={projects}
 *   columns={[
 *     { key: "title", label: "Title", sortable: true },
 *     { key: "created_at", label: "Created", render: (val) => formatDate(val) }
 *   ]}
 *   tableButtons={[
 *     { label: "New Project", onClick: handleCreate, variant: "primary" }
 *   ]}
 *   rowButtons={(item) => [
 *     { label: "Edit", onClick: () => handleEdit(item) },
 *     { label: "Delete", onClick: () => handleDelete(item), variant: "danger" }
 *   ]}
 *   viewMode="table"
 *   showSearch
 *   showFilters
 *   showPagination
 * />
 * ```
 */

export interface DataTableProps<T = any> {
  // Data & Configuration
  data: T[];
  columns: DataTableColumn<T>[];
  keyExtractor?: (item: T) => string;

  // Actions
  tableButtons?: DataTableButton[];
  rowButtons?: (item: T) => DataTableButton[];

  // View Configuration
  viewMode?: "table" | "list" | "grid" | "custom";
  customRender?: (item: T) => React.ReactNode;

  // Feature Flags
  showSearch?: boolean;
  showFilters?: boolean;
  showPagination?: boolean;
  showHeader?: boolean;

  // Customization
  emptyMessage?: string;
  className?: string;

  // Pagination
  initialPage?: number;
  initialPerPage?: number;
  totalItems?: number;

  // Loading State
  isLoading?: boolean;
}

export function DataTable<T = any>({
  data,
  columns,
  keyExtractor,
  tableButtons,
  rowButtons,
  viewMode = "table",
  customRender,
  showSearch = true,
  showFilters = false,
  showPagination = true,
  showHeader = true,
  emptyMessage = "No data available",
  className = "",
  initialPage = 1,
  initialPerPage = 10,
  totalItems,
  isLoading = false,
}: DataTableProps<T>) {
  return (
    <DataTableProvider
      data={data}
      columns={columns}
      keyExtractor={keyExtractor}
      tableButtons={tableButtons}
      rowButtons={rowButtons}
      viewMode={viewMode}
      customRender={customRender}
      emptyMessage={emptyMessage}
      initialPagination={{
        page: initialPage,
        per_page: initialPerPage,
        total: totalItems || (data || []).length,
      }}
    >
      <div className={`space-y-4 ${className}`}>
        {/* Header with Title, Description, and Table Buttons */}
        {showHeader && <DataTableHeader />}

        {/* Search Bar */}
        {showSearch && <DataTableSearch />}

        {/* Active Filters Display */}
        {showFilters && <DataTableFilters />}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (data || []).length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12 dark:border-gray-600">
            <svg
              className="mb-4 h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {emptyMessage}
            </p>
          </div>
        )}

        {/* Data Display - View Mode Dependent */}
        {!isLoading && (data || []).length > 0 && (
          <>
            {viewMode === "table" && <DataTableList />}
            {viewMode === "grid" && <DataTableGrid />}
            {viewMode === "list" && <DataTableList variant="list" />}
            {viewMode === "custom" && customRender && (
              <div className="space-y-2">
                {(data || []).map((item) => (
                  <div key={keyExtractor?.(item) || String(item)}>
                    {customRender(item)}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {showPagination && !isLoading && (data || []).length > 0 && (
          <DataTablePagination />
        )}
      </div>
    </DataTableProvider>
  );
}

// Re-export context and hooks for external use
export {
  useDataTableContext,
  useDataTableProps,
  useDataTableState,
  usePagination,
  useFiltering,
  useSorting,
  useSelection,
} from "./context/DataTableContext";

export type { DataTableColumn, DataTableButton } from "./context/DataTableContext";
