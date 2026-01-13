"use client";

import { useState } from "react";
import { KnowledgeSource } from "@/lib/types";
import ReactIcons from "@/components/ReactIcons";
import { HiDotsVertical } from "react-icons/hi";
import { EmptyState } from "@/components/common";

interface KnowledgeTableViewProps {
  sources: KnowledgeSource[];
  onView?: (source: KnowledgeSource) => void;
  onEdit?: (source: KnowledgeSource) => void;
  onDelete?: (source: KnowledgeSource) => void;
  onRecrawl?: (source: KnowledgeSource) => void;
  searchTerm?: string;
}

type SortColumn = "title" | "created_at" | null;
type SortDirection = "asc" | "desc";

export default function KnowledgeTableView({
  sources,
  onView,
  onEdit,
  onDelete,
  onRecrawl,
  searchTerm,
}: KnowledgeTableViewProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [openMenuId, setOpenMenuId] = useState<string | number | null>(null);

  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get knowledge type color
  const getKnowledgeTypeColor = (type: string) => {
    switch (type) {
      case "technical":
        return "bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400";
      case "business":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  // Handle sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Sort sources
  const sortedSources = [...sources].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: string | number = "";
    let bValue: string | number = "";

    if (sortColumn === "title") {
      aValue = a.title.toLowerCase();
      bValue = b.title.toLowerCase();
    } else if (sortColumn === "created_at") {
      aValue = new Date(a.created_at).getTime();
      bValue = new Date(b.created_at).getTime();
    }

    if (sortDirection === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Empty state check
  const shouldShowEmptyState = sources.length === 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
        {/* Header */}
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
          <tr>
            {/* Title - Sortable */}
            <th
              scope="col"
              className="px-4 py-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
              onClick={() => handleSort("title")}
              title="Sort by Title"
            >
              <div className="flex items-center">
                Title
                {sortColumn !== "title" && (
                  <ReactIcons icon="SORT" className="h-3 w-3 ml-1" />
                )}
                {sortColumn === "title" && (
                  <span className="ml-1">
                    {sortDirection === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </div>
            </th>

            {/* Type - Hidden on mobile */}
            <th scope="col" className="hidden sm:table-cell px-4 py-3">
              Type
            </th>

            {/* Source - Hidden on mobile */}
            <th scope="col" className="hidden md:table-cell px-4 py-3">
              Source
            </th>

            {/* Docs Count - Hidden on mobile */}
            <th scope="col" className="hidden lg:table-cell px-4 py-3 text-center">
              Docs
            </th>

            {/* Examples Count - Hidden on mobile */}
            <th scope="col" className="hidden lg:table-cell px-4 py-3 text-center">
              Examples
            </th>

            {/* Created - Sortable, Hidden on mobile */}
            <th
              scope="col"
              className="hidden md:table-cell px-4 py-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
              onClick={() => handleSort("created_at")}
              title="Sort by Created"
            >
              <div className="flex items-center">
                Created
                {sortColumn !== "created_at" && (
                  <ReactIcons icon="SORT" className="h-3 w-3 ml-1" />
                )}
                {sortColumn === "created_at" && (
                  <span className="ml-1">
                    {sortDirection === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </div>
            </th>

            {/* Actions */}
            <th scope="col" className="px-4 py-3">
              Actions
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {shouldShowEmptyState ? (
            <tr>
              <td colSpan={7} className="px-4 py-8">
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
              </td>
            </tr>
          ) : (
            <>
              {sortedSources.map((source) => {
                const knowledgeType =
                  source.knowledge_type ||
                  source.metadata?.knowledge_type ||
                  "technical";
                const url = source.url || source.metadata?.original_url || "";
                const isMenuOpen = openMenuId === source.source_id;

                return (
                  <tr
                    key={source.source_id}
                    className="border-b hover:bg-gray-100 border-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => onView?.(source)}
                  >
                    {/* Title */}
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      <div className="max-w-xs">
                        <div className="font-semibold truncate">
                          {source.title}
                        </div>
                        {source.summary && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                            {source.summary}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Type - Hidden on mobile */}
                    <td className="hidden sm:table-cell px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getKnowledgeTypeColor(
                          knowledgeType
                        )}`}
                      >
                        {knowledgeType}
                      </span>
                    </td>

                    {/* Source URL - Hidden on mobile */}
                    <td className="hidden md:table-cell px-4 py-3">
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:underline dark:text-brand-400 text-xs truncate block max-w-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {url}
                        </a>
                      )}
                    </td>

                    {/* Docs Count - Hidden on mobile */}
                    <td className="hidden lg:table-cell px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 text-xs font-semibold text-gray-700 bg-gray-100 rounded-full dark:bg-gray-700 dark:text-gray-300">
                        {source.documents_count || 0}
                      </span>
                    </td>

                    {/* Examples Count - Hidden on mobile */}
                    <td className="hidden lg:table-cell px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 text-xs font-semibold text-brand-700 bg-brand-100 rounded-full dark:bg-brand-900/20 dark:text-brand-400">
                        {source.code_examples_count || 0}
                      </span>
                    </td>

                    {/* Created - Hidden on mobile */}
                    <td className="hidden md:table-cell px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(source.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenMenuId(isMenuOpen ? null : source.source_id)
                          }
                          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
                        >
                          <HiDotsVertical className="w-5 h-5" />
                        </button>

                        {/* Action Dropdown Menu */}
                        {isMenuOpen && (
                          <>
                            {/* Backdrop to close menu */}
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />

                            {/* Menu */}
                            <div className="absolute right-0 top-0 z-20 mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-200 dark:bg-gray-700 dark:border-gray-600">
                              <ul className="py-1 text-sm text-gray-700 dark:text-gray-200">
                                {onView && (
                                  <li>
                                    <button
                                      onClick={() => {
                                        onView(source);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                    >
                                      <ReactIcons icon="EYE" size={16} />
                                      View
                                    </button>
                                  </li>
                                )}
                                {onEdit && (
                                  <li>
                                    <button
                                      onClick={() => {
                                        onEdit(source);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                    >
                                      <ReactIcons icon="EDIT" size={16} />
                                      Edit
                                    </button>
                                  </li>
                                )}
                                {onRecrawl && (
                                  <li>
                                    <button
                                      onClick={() => {
                                        onRecrawl(source);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                    >
                                      <ReactIcons icon="REFRESH" size={16} />
                                      Recrawl
                                    </button>
                                  </li>
                                )}
                                {onDelete && (
                                  <li>
                                    <button
                                      onClick={() => {
                                        onDelete(source);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-600 flex items-center gap-2"
                                    >
                                      <ReactIcons icon="TRASH" size={16} />
                                      Delete
                                    </button>
                                  </li>
                                )}
                              </ul>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
