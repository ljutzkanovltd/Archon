"use client";

/**
 * Knowledge Base Page Header Component
 *
 * Displays the page title and description in a consistent format
 * matching the Projects and Tasks pages pattern.
 */
export function KnowledgeBaseHeader() {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        📚 Knowledge Base
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Manage your documentation sources and code examples
      </p>
    </div>
  );
}
