"use client";

import { Badge } from "flowbite-react";
import { HiX } from "react-icons/hi";
import { useFiltering } from "./context/DataTableContext";

export function DataTableFilters() {
  const { filters, removeFilter, clearFilters, hasFilters } = useFiltering();

  if (!hasFilters) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Active filters:
      </span>
      {filters.map((filter) => (
        <Badge key={filter.field} color="info" className="flex items-center gap-1">
          <span>
            {filter.field}: {String(filter.value)}
          </span>
          <button
            onClick={() => removeFilter(filter.field)}
            className="ml-1 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
            aria-label={`Remove ${filter.field} filter`}
          >
            <HiX className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {filters.length > 1 && (
        <button
          onClick={clearFilters}
          className="text-xs text-brand-600 hover:underline dark:text-brand-400"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
