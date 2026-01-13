"use client";

/**
 * Search Mode Toggle Component
 *
 * Radio button group for selecting between:
 * - Titles: Search in source titles (client-side, fast)
 * - Content: Semantic search in crawled content (server-side, powerful)
 *
 * Positioned prominently between Queue Monitor and DataTable.
 */

interface SearchModeToggleProps {
  mode: "titles" | "content";
  onChange: (mode: "titles" | "content") => void;
  className?: string;
}

export function SearchModeToggle({
  mode,
  onChange,
  className = "",
}: SearchModeToggleProps) {
  return (
    <div
      className={`rounded-lg border-2 border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-900/10 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Label */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            🔍 Search Mode
          </h3>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
            Choose where to search for knowledge
          </p>
        </div>

        {/* Radio buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onChange("titles")}
            className={`flex-1 sm:flex-initial rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              mode === "titles"
                ? "bg-brand-600 text-white shadow-md"
                : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  mode === "titles"
                    ? "border-white"
                    : "border-gray-400 dark:border-gray-500"
                }`}
              >
                {mode === "titles" && (
                  <span className="h-2 w-2 rounded-full bg-white" />
                )}
              </span>
              <span>Titles</span>
            </div>
          </button>

          <button
            onClick={() => onChange("content")}
            className={`flex-1 sm:flex-initial rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              mode === "content"
                ? "bg-brand-600 text-white shadow-md"
                : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  mode === "content"
                    ? "border-white"
                    : "border-gray-400 dark:border-gray-500"
                }`}
              >
                {mode === "content" && (
                  <span className="h-2 w-2 rounded-full bg-white" />
                )}
              </span>
              <span>Content (Semantic)</span>
            </div>
          </button>
        </div>
      </div>

      {/* Help text */}
      <div className="mt-3 flex flex-col gap-2 text-xs text-gray-600 dark:text-gray-400 sm:flex-row sm:justify-end sm:gap-6">
        <div className="flex items-start gap-1.5">
          <span className="font-semibold">Titles:</span>
          <span>Search in source titles (fast, exact matches)</span>
        </div>
        <div className="flex items-start gap-1.5">
          <span className="font-semibold">Content:</span>
          <span>Search in crawled content (powerful, semantic)</span>
        </div>
      </div>
    </div>
  );
}
