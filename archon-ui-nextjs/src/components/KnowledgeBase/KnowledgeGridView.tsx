"use client";

import { KnowledgeSource } from "@/lib/types";
import { KnowledgeSourceCard } from "./KnowledgeSourceCard";
import { EmptyState } from "@/components/common";

interface KnowledgeGridViewProps {
  sources: KnowledgeSource[];
  onView?: (source: KnowledgeSource) => void;
  onEdit?: (source: KnowledgeSource) => void;
  onDelete?: (source: KnowledgeSource) => void;
  onRecrawl?: (source: KnowledgeSource) => void;
  searchTerm?: string;
  isLoading?: boolean;
}

export default function KnowledgeGridView({
  sources,
  onView,
  onEdit,
  onDelete,
  onRecrawl,
  searchTerm,
  isLoading = false,
}: KnowledgeGridViewProps) {
  // Empty state check
  const shouldShowEmptyState = !isLoading && sources.length === 0;

  if (shouldShowEmptyState) {
    return (
      <div className="py-8">
        <EmptyState
          config={{
            type: searchTerm ? "no_search_results" : "no_data",
            title: searchTerm
              ? "No sources found"
              : "No knowledge sources",
            description: searchTerm
              ? `No sources match "${searchTerm}". Try adjusting your search.`
              : "Get started by adding your first knowledge source.",
          }}
          searchTerm={searchTerm}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
      {isLoading ? (
        // Loading skeletons
        Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 animate-pulse"
          >
            {/* Top edge skeleton */}
            <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-t-lg mb-6 -mt-6 -mx-6" />

            {/* Header skeleton */}
            <div className="mb-4 flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
              </div>
            </div>

            {/* Summary skeleton */}
            <div className="mb-4 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            </div>

            {/* Stats skeleton */}
            <div className="mb-4 flex gap-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            </div>

            {/* Tags skeleton */}
            <div className="mb-4 flex gap-2">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-14" />
            </div>

            {/* Timestamp skeleton */}
            <div className="mb-4 flex gap-4">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            </div>

            {/* Buttons skeleton */}
            <div className="flex gap-2">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-20" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            </div>
          </div>
        ))
      ) : (
        // Actual cards
        sources.map((source) => (
          <KnowledgeSourceCard
            key={source.source_id}
            source={source}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onRecrawl={onRecrawl}
          />
        ))
      )}
    </div>
  );
}
