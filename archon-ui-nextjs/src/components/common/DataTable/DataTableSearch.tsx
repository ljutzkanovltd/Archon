"use client";

import { HiSearch } from "react-icons/hi";
import { useDataTableState } from "./context/DataTableContext";
import { useDebounce } from "@/hooks";
import { useEffect } from "react";

export function DataTableSearch() {
  const { searchQuery, setSearchQuery } = useDataTableState();
  const debouncedQuery = useDebounce(searchQuery, 300);

  // You can expose the debounced query to parent components if needed
  useEffect(() => {
    // Trigger search/filter logic here if needed
    // For now, the search query is available in context
  }, [debouncedQuery]);

  return (
    <div role="search" className="relative">
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
  );
}
