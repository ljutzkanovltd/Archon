"use client";

import { useDataTableContext } from "./context/DataTableContext";

/**
 * DataTableGrid - Grid view component
 *
 * Renders data in a responsive grid layout
 * Uses customRender prop to render each item as a card
 */
export function DataTableGrid() {
  const { data, customRender, keyExtractor } = useDataTableContext();

  if (!customRender) {
    return (
      <div className="rounded-lg border border-gray-200 p-8 text-center dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Grid view requires a customRender prop
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((item) => {
        const itemKey = keyExtractor?.(item) || String(item);
        return <div key={itemKey}>{customRender(item)}</div>;
      })}
    </div>
  );
}
