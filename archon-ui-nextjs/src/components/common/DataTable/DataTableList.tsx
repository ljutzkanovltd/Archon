"use client";

import { Button, Checkbox } from "flowbite-react";
import { HiChevronUp, HiChevronDown } from "react-icons/hi";
import {
  useDataTableContext,
  useSorting,
  useSelection,
  useFilteredData,
} from "./context/DataTableContext";

interface DataTableListProps {
  variant?: "table" | "list";
}

/**
 * DataTableList - Table/List view component
 *
 * Renders data in a table format with:
 * - Sortable columns
 * - Row selection
 * - Row action buttons
 * - Responsive design
 */
export function DataTableList({ variant = "table" }: DataTableListProps) {
  const { columns, rowButtons, keyExtractor, caption } = useDataTableContext();
  const filteredData = useFilteredData();
  const { toggleSort, getSortDirection } = useSorting();
  const { isSelected, toggleSelection, isAllSelected, toggleSelectAll } =
    useSelection();

  const hasActions = !!rowButtons;
  const hasSelection = true; // Can be made configurable

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
        {caption && (
          <caption className="sr-only">{caption}</caption>
        )}
        <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            {/* Selection Column */}
            {hasSelection && (
              <th scope="col" className="w-12 px-6 py-3">
                <Checkbox
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all rows"
                />
              </th>
            )}

            {/* Data Columns */}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-6 py-3 ${column.sortable ? "cursor-pointer select-none" : ""}`}
                onClick={() => column.sortable && toggleSort(column.key)}
                style={{ width: column.width }}
              >
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                  {column.sortable && (
                    <div className="flex flex-col">
                      <HiChevronUp
                        className={`h-3 w-3 ${
                          getSortDirection(column.key) === "asc"
                            ? "text-brand-600"
                            : "text-gray-400"
                        }`}
                      />
                      <HiChevronDown
                        className={`-mt-1 h-3 w-3 ${
                          getSortDirection(column.key) === "desc"
                            ? "text-brand-600"
                            : "text-gray-400"
                        }`}
                      />
                    </div>
                  )}
                </div>
              </th>
            ))}

            {/* Actions Column */}
            {hasActions && (
              <th scope="col" className="px-6 py-3 text-right">
                Actions
              </th>
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredData.map((item) => {
            const itemKey = keyExtractor?.(item) || String(item);
            const actions = rowButtons?.(item) || [];

            return (
              <tr
                key={itemKey}
                className={
                  isSelected(itemKey)
                    ? "bg-brand-50 dark:bg-brand-900/20"
                    : "bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                }
              >
                {/* Selection Cell */}
                {hasSelection && (
                  <td className="px-6 py-4">
                    <Checkbox
                      checked={isSelected(itemKey)}
                      onChange={() => toggleSelection(itemKey)}
                      aria-label={`Select row ${itemKey}`}
                    />
                  </td>
                )}

                {/* Data Cells */}
                {columns.map((column) => {
                  const value = (item as any)[column.key];
                  return (
                    <td key={column.key} className="px-6 py-4">
                      {column.render ? column.render(value, item) : value}
                    </td>
                  );
                })}

                {/* Actions Cell */}
                {hasActions && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {actions.map((action, index) => (
                        <Button
                          key={index}
                          size="xs"
                          color={
                            action.variant === "primary"
                              ? "blue"
                              : action.variant === "danger"
                                ? "failure"
                                : "light"
                          }
                          onClick={action.onClick}
                          disabled={action.disabled}
                          aria-label={action.ariaLabel}
                        >
                          {action.icon && (
                            <action.icon className="mr-1 h-3 w-3" aria-hidden="true" />
                          )}
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
