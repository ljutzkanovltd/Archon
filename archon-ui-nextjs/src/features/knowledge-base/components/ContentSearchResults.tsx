"use client";

import { useState } from "react";
import { HiChevronDown, HiChevronUp } from "react-icons/hi";

export interface ContentSearchResult {
  id?: string;
  url: string;
  content: string;
  match_type: string;
  similarity: number;
  chunk_number: number;
}

export interface ContentSearchResultsProps {
  query: string;
  results: ContentSearchResult[];
  loading: boolean;
  error: string | null;
  total: number;
  pages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

/**
 * ContentSearchResults - Display semantic content search results
 *
 * This component shows search results from crawled page content (semantic/full-text search),
 * separate from the DataTable's title/URL/tags search.
 *
 * Features:
 * - Collapsible section to save space
 * - Displays matching snippets with similarity scores
 * - Pagination for large result sets
 * - Loading and error states
 */
export function ContentSearchResults({
  query,
  results,
  loading,
  error,
  total,
  pages,
  currentPage,
  onPageChange,
}: ContentSearchResultsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Don't render if no query
  if (!query) {
    return null;
  }

  return (
    <div className="rounded-lg border-2 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header with expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            Content Search Results
          </span>
          {!loading && results.length > 0 && (
            <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-300">
              {total} {total === 1 ? "match" : "matches"} in crawled pages
            </span>
          )}
        </div>
        {isExpanded ? (
          <HiChevronUp className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        ) : (
          <HiChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600 dark:border-brand-800 dark:border-t-brand-400"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                Searching content...
              </span>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="font-semibold text-red-800 dark:text-red-400">
                Search Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Results */}
          {!loading && !error && results.length > 0 && (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={result.id || index}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-brand-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-brand-600"
                >
                  <div className="mb-2 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400 break-all"
                    >
                      {result.url}
                    </a>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded bg-brand-100 px-2 py-1 text-xs font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-300">
                        {result.match_type}
                      </span>
                      <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {Math.round(result.similarity * 100)}% match
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                    {result.content}
                  </p>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Chunk #{result.chunk_number}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                  <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                    Page {currentPage} of {pages}
                  </span>
                  <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === pages || loading}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && query && results.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800/50">
              <p className="text-gray-600 dark:text-gray-400">
                No content matches found for &quot;{query}&quot;
              </p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                Try different keywords or check the title/URL search above
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
