"use client";

import { useState, useEffect } from "react";
import { HiSearch, HiX, HiFilter } from "react-icons/hi";
import { Button, Label, Select } from "flowbite-react";
import { useDataTableState, useDataTableContext, ViewMode } from "./context/DataTableContext";
import { useDebounce } from "@/hooks";
import { ViewModeToggle, ViewMode as ToggleViewMode } from "../ViewModeToggle";

export interface FilterConfig {
  field: string;
  label: string;
  type: "select" | "multiselect" | "text" | "date" | "daterange" | "boolean";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface DataTableSearchWithFiltersProps {
  filterConfigs?: FilterConfig[];
  showViewToggle?: boolean;
}

export function DataTableSearchWithFilters({
  filterConfigs = [],
  showViewToggle = true,
}: DataTableSearchWithFiltersProps) {
  const { searchQuery, setSearchQuery, currentViewMode, setViewMode, addFilter, removeFilter, filters } = useDataTableState();
  const debouncedQuery = useDebounce(searchQuery, 300);

  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<Record<string, any>>({});

  // You can expose the debounced query to parent components if needed
  useEffect(() => {
    // Trigger search/filter logic here if needed
    // For now, the search query is available in context
  }, [debouncedQuery]);

  const handleFilterChange = (field: string, value: any, filterType?: string) => {
    setLocalFilters((prev) => ({ ...prev, [field]: value }));

    if (value && value !== "" && value !== "all") {
      // Determine operator based on filter type
      let operator: "equals" | "contains" | "in" | "between" = "equals";

      if (filterType === "text") {
        operator = "contains";
      } else if (filterType === "multiselect" || Array.isArray(value)) {
        operator = "in";
      } else if (filterType === "daterange" && field.includes("_from")) {
        // For date range, we need to handle from/to separately
        const baseField = field.replace("_from", "").replace("_to", "");
        const fromValue = field.includes("_from") ? value : localFilters[`${baseField}_from`];
        const toValue = field.includes("_to") ? value : localFilters[`${baseField}_to`];

        if (fromValue || toValue) {
          addFilter({
            field: baseField,
            operator: "between",
            value: { from: fromValue, to: toValue }
          });
        } else {
          removeFilter(baseField);
        }
        return;
      } else if (filterType === "daterange" && field.includes("_to")) {
        // Handle _to part of date range
        const baseField = field.replace("_from", "").replace("_to", "");
        const fromValue = localFilters[`${baseField}_from`];
        const toValue = field.includes("_to") ? value : localFilters[`${baseField}_to`];

        if (fromValue || toValue) {
          addFilter({
            field: baseField,
            operator: "between",
            value: { from: fromValue, to: toValue }
          });
        } else {
          removeFilter(baseField);
        }
        return;
      }

      addFilter({ field, operator, value });
    } else {
      removeFilter(field);
    }
  };

  const clearAllFilters = () => {
    setLocalFilters({});
    filterConfigs.forEach((config) => removeFilter(config.field));
  };

  const activeFilterCount = filters.length;

  return (
    <div className="space-y-4">
      {/* Search Bar and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div role="search" className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <HiSearch className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 pl-10 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-brand-500 dark:focus:ring-brand-500"
            placeholder="Search..."
            aria-label="Search"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Filter Toggle Button */}
          {filterConfigs.length > 0 && (
            <Button
              color="light"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
            >
              <HiFilter className="mr-2 h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}

          {/* View Mode Toggle - uses reusable ViewModeToggle component */}
          {/* Labels shown on desktop (sm+), hidden on mobile for space efficiency */}
          {showViewToggle && (
            <ViewModeToggle
              modes={["table", "grid"]}
              currentMode={currentViewMode as ToggleViewMode}
              onChange={(mode) => setViewMode(mode as ViewMode)}
              size="md"
              showLabels={true}
            />
          )}
        </div>
      </div>

      {/* Filter Controls Panel */}
      {showFilters && filterConfigs.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Filter Options
            </h3>
            {activeFilterCount > 0 && (
              <Button
                color="light"
                size="xs"
                onClick={clearAllFilters}
              >
                <HiX className="mr-1 h-3 w-3" />
                Clear All
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filterConfigs.map((config) => (
              <div key={config.field}>
                <Label
                  htmlFor={`filter-${config.field}`}
                  className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
                >
                  {config.label}
                </Label>
                {config.type === "select" && config.options && (
                  <Select
                    id={`filter-${config.field}`}
                    value={localFilters[config.field] || "all"}
                    onChange={(e) => handleFilterChange(config.field, e.target.value, "select")}
                    sizing="sm"
                  >
                    <option value="all">All</option>
                    {config.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
                {config.type === "text" && (
                  <input
                    id={`filter-${config.field}`}
                    type="text"
                    value={localFilters[config.field] || ""}
                    onChange={(e) => handleFilterChange(config.field, e.target.value, "text")}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    placeholder={config.placeholder || `Filter by ${config.label.toLowerCase()}`}
                  />
                )}
                {config.type === "date" && (
                  <input
                    id={`filter-${config.field}`}
                    type="date"
                    value={localFilters[config.field] || ""}
                    onChange={(e) => handleFilterChange(config.field, e.target.value, "date")}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  />
                )}
                {config.type === "daterange" && (
                  <div className="flex gap-2">
                    <input
                      id={`filter-${config.field}-from`}
                      type="date"
                      value={localFilters[`${config.field}_from`] || ""}
                      onChange={(e) => handleFilterChange(`${config.field}_from`, e.target.value, "daterange")}
                      className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                      placeholder="From"
                    />
                    <input
                      id={`filter-${config.field}-to`}
                      type="date"
                      value={localFilters[`${config.field}_to`] || ""}
                      onChange={(e) => handleFilterChange(`${config.field}_to`, e.target.value, "daterange")}
                      className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                      placeholder="To"
                    />
                  </div>
                )}
                {config.type === "multiselect" && config.options && (
                  <Select
                    id={`filter-${config.field}`}
                    multiple
                    value={localFilters[config.field] || []}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                      handleFilterChange(config.field, selected.length > 0 ? selected : null, "multiselect");
                    }}
                    sizing="sm"
                    className="min-h-[100px]"
                  >
                    {config.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
                {config.type === "boolean" && (
                  <div className="flex items-center gap-2">
                    <input
                      id={`filter-${config.field}`}
                      type="checkbox"
                      checked={localFilters[config.field] === true || localFilters[config.field] === "true"}
                      onChange={(e) => handleFilterChange(config.field, e.target.checked, "boolean")}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                    />
                    <label
                      htmlFor={`filter-${config.field}`}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      {config.placeholder || config.label}
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
