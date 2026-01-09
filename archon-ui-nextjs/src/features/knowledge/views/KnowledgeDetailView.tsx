"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiArrowLeft, HiPencil, HiTrash, HiRefresh } from "react-icons/hi";
import { knowledgeBaseApi } from "@/lib/apiClient";
import { KnowledgeSource, KnowledgePage } from "@/lib/types";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import { DataTable, DataTableColumn, DataTableButton } from "@/components/common/DataTable";
import { EditSourceDialog } from "@/components/KnowledgeBase/EditSourceDialog";
import { usePageTitle } from "@/hooks";
import { formatDistanceToNow } from "date-fns";

interface KnowledgeDetailViewProps {
  sourceId: string;
}

/**
 * KnowledgeDetailView - Detail view for a single knowledge source
 *
 * Features:
 * - Breadcrumb navigation with source name
 * - Back button to return to Knowledge Base
 * - Source header with name, URL, type
 * - Source metadata (pages count, last updated, status)
 * - Pages list with DataTable (table/grid views)
 * - Source actions (reindex, edit, delete)
 */
export function KnowledgeDetailView({ sourceId }: KnowledgeDetailViewProps) {
  const router = useRouter();

  const [source, setSource] = useState<KnowledgeSource | null>(null);
  const [pages, setPages] = useState<KnowledgePage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPagesLoading, setIsPagesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [totalPages, setTotalPages] = useState(0);

  usePageTitle(
    source ? source.title : "Source Details",
    "Archon"
  );

  // Fetch source data on mount
  useEffect(() => {
    loadSource();
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const loadSource = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await knowledgeBaseApi.getSources();
      if (response.success && response.sources) {
        const foundSource = response.sources.find(
          (s: KnowledgeSource) => s.source_id === sourceId
        );

        if (foundSource) {
          // Fetch counts for this source
          const [chunksResponse, codeResponse] = await Promise.all([
            knowledgeBaseApi.listPages({ source_id: sourceId, limit: 1 }),
            knowledgeBaseApi.searchCodeExamples({ source_id: sourceId, match_count: 1 }),
          ]);

          setSource({
            ...foundSource,
            documents_count: chunksResponse.total || 0,
            code_examples_count: codeResponse.total || 0,
          });
        } else {
          setError("Source not found");
        }
      } else {
        setError(response.error || "Failed to load source");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load source");
    } finally {
      setIsLoading(false);
    }
  };

  const loadPages = async () => {
    setIsPagesLoading(true);
    setPagesError(null);

    try {
      const response = await knowledgeBaseApi.listPages({
        source_id: sourceId,
        limit: 100,
        offset: 0,
      });

      if (response.success && response.chunks) {
        setTotalPages(response.total || 0);

        // Transform chunks to page format
        const transformedChunks = response.chunks.map((chunk: any) => ({
          page_id: chunk.id.toString(),
          url: chunk.url || "",
          title: chunk.title || chunk.metadata?.title || "Untitled",
          content: chunk.content,
          full_content: chunk.content,
          section_title: chunk.section || chunk.metadata?.section || null,
          word_count: chunk.metadata?.word_count || 0,
          metadata: chunk.metadata,
        }));

        setPages(transformedChunks);
      } else {
        setPagesError(response.error || "Failed to load pages");
      }
    } catch (err) {
      setPagesError(err instanceof Error ? err.message : "Failed to load pages");
    } finally {
      setIsPagesLoading(false);
    }
  };

  // ========== HANDLERS ==========

  const handleBack = () => {
    router.push("/knowledge-base");
  };

  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const handleUpdateSource = async (id: string, data: any) => {
    try {
      const response = await knowledgeBaseApi.updateSource(id, data);
      if (response.success) {
        alert("Source updated successfully!");
        await loadSource();
      } else {
        throw new Error(response.error || "Failed to update source");
      }
    } catch (err) {
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!source) return;

    if (
      !confirm(
        `Are you sure you want to delete "${source.title}"? This will remove all indexed documents and code examples.`
      )
    ) {
      return;
    }

    try {
      const response = await knowledgeBaseApi.deleteSource(sourceId);
      if (response.success) {
        alert("Source deleted successfully!");
        router.push("/knowledge-base");
      } else {
        throw new Error(response.error || "Failed to delete source");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete source");
    }
  };

  const handleRecrawl = async () => {
    if (!source) return;

    if (
      !confirm(
        `Are you sure you want to recrawl "${source.title}"? This will update all indexed content.`
      )
    ) {
      return;
    }

    try {
      const response = await knowledgeBaseApi.recrawl(sourceId);
      if (response.success) {
        alert(
          `Recrawl started successfully! Operation ID: ${response.data?.operation_id}`
        );
        await loadSource();
        await loadPages();
      } else {
        throw new Error(response.error || "Failed to start recrawl");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start recrawl");
    }
  };

  const handleViewPage = (page: KnowledgePage) => {
    // For now, just log the page. In the future, could open a modal or navigate to a detail view
    console.log("View page:", page);
    alert(`Page: ${page.title}\n\nContent preview:\n${page.content?.substring(0, 200) || 'No content available'}...`);
  };

  // ========== DATATABLE CONFIGURATION ==========

  const columns: DataTableColumn<KnowledgePage>[] = [
    {
      key: "title",
      label: "Page Title",
      sortable: true,
      render: (value, page) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {value}
          </div>
          {page.section_title && (
            <div className="text-xs text-gray-500">
              {page.section_title}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "url",
      label: "URL",
      sortable: true,
      render: (value) => (
        <div className="max-w-xs truncate text-sm text-gray-600 dark:text-gray-400">
          {value ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline dark:text-brand-400"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          ) : (
            "N/A"
          )}
        </div>
      ),
    },
    {
      key: "word_count",
      label: "Words",
      sortable: true,
      width: "100px",
      render: (value) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {value || 0}
        </span>
      ),
    },
  ];

  const rowButtons = (page: KnowledgePage): DataTableButton[] => [
    {
      label: "View",
      icon: HiArrowLeft,
      onClick: () => handleViewPage(page),
    },
  ];

  // ========== RENDER ==========

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold">Error loading source</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={handleBack}
            className="mt-4 text-sm underline hover:no-underline"
          >
            ← Back to Knowledge Base
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !source) {
    return (
      <div className="p-8">
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <BreadCrumb
        items={[
          { label: "Knowledge Base", href: "/knowledge-base" },
          { label: source.title, href: `/knowledge-base/${sourceId}` }
        ]}
        className="mb-4"
      />

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <HiArrowLeft className="h-4 w-4" />
          Back to Knowledge Base
        </button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {source.title}
              </h1>
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-900/20 dark:text-brand-400 capitalize">
                {source.knowledge_type || "general"}
              </span>
              {source.level && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400 capitalize">
                  {source.level}
                </span>
              )}
            </div>

            {source.summary && (
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {source.summary}
              </p>
            )}

            {source.url && (
              <div className="mt-2">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-600 hover:underline dark:text-brand-400"
                >
                  {source.url}
                </a>
              </div>
            )}

            {/* Source Stats */}
            <div className="mt-4 flex gap-6">
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">Pages:</span>{" "}
                <span className="font-medium text-gray-900 dark:text-white">
                  {source.documents_count || 0}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Code Examples:
                </span>{" "}
                <span className="font-medium text-gray-900 dark:text-white">
                  {source.code_examples_count || 0}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Total Words:
                </span>{" "}
                <span className="font-medium text-gray-900 dark:text-white">
                  {(source.total_words || 0).toLocaleString()}
                </span>
              </div>
              {source.updated_at && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Last Updated:
                  </span>{" "}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDistanceToNow(new Date(source.updated_at), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <HiPencil className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={handleRecrawl}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <HiRefresh className="h-4 w-4" />
              Recrawl
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <HiTrash className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Pages Section */}
      <div className="mb-4">
        <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">
          Pages ({totalPages})
        </h2>

        {pagesError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <p className="font-semibold">Error loading pages</p>
            <p className="text-sm">{pagesError}</p>
            <button
              onClick={loadPages}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <DataTable
            data={pages}
            columns={columns}
            rowButtons={rowButtons}
            tableId={`archon-knowledge-pages-${source.source_id}`}
            enableMultiSort={true}
            showPrimaryAction={true}
            viewMode="table"
            showSearch
            showViewToggle
            showPagination
            isLoading={isPagesLoading}
            emptyMessage="No pages found for this source."
            caption={`List of ${pages.length} pages from ${source.title}`}
            keyExtractor={(page) => page.page_id}
          />
        )}
      </div>

      {/* Edit Source Dialog */}
      <EditSourceDialog
        isOpen={isEditDialogOpen}
        source={source}
        onClose={() => setIsEditDialogOpen(false)}
        onUpdate={handleUpdateSource}
      />
    </div>
  );
}
