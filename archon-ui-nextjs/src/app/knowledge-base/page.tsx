"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HiPlus, HiEye, HiPencil, HiTrash, HiRefresh } from "react-icons/hi";
import { knowledgeBaseApi, tasksApi, RecrawlOptions } from "@/lib/apiClient";
import { KnowledgeSource, CrawlRequest, UploadMetadata } from "@/lib/types";
import { KnowledgeSourceCard } from "@/components/KnowledgeBase/KnowledgeSourceCard";
import { AddSourceDialog } from "@/components/KnowledgeBase/AddSourceDialog";
import { EditSourceDialog } from "@/components/KnowledgeBase/EditSourceDialog";
import { RecrawlOptionsModal } from "@/components/KnowledgeBase/RecrawlOptionsModal";
import { SourceInspector } from "@/components/KnowledgeBase/SourceInspector";
import { CrawlingProgress } from "@/components/KnowledgeBase/CrawlingProgress";
import { CrawlQueueMonitor } from "@/components/KnowledgeBase/CrawlQueueMonitor";
import KnowledgeTableViewWithBulk from "@/components/KnowledgeBase/KnowledgeTableViewWithBulk";
import { DataTable, DataTableColumn, DataTableButton, FilterConfig } from "@/components/common/DataTable";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import EmptyState from "@/components/common/EmptyState";
import { usePageTitle } from "@/hooks";
import { formatDistanceToNow } from "date-fns";

export default function KnowledgeBasePage() {
  usePageTitle("Knowledge Base", "Archon");

  const router = useRouter();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<KnowledgeSource | null>(null);
  const [sourceToEdit, setSourceToEdit] = useState<KnowledgeSource | null>(null);
  const [recrawlSource, setRecrawlSource] = useState<KnowledgeSource | null>(null);

  // Additional metrics state
  const [tasksLinked, setTasksLinked] = useState<number>(0);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Content search state
  const [searchMode, setSearchMode] = useState<"sources" | "content">("sources");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPages, setSearchPages] = useState(0);

  // View mode state
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  useEffect(() => {
    loadSources();
    loadAdditionalMetrics();
  }, []);

  const loadSources = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await knowledgeBaseApi.getSources();
      if (response.success) {
        const sourcesData = response.sources || [];

        // Extract all source IDs for bulk counts query
        const sourceIds = sourcesData.map((s: KnowledgeSource) => s.source_id);

        // Fetch all counts in a single request (replaces N*2 individual requests)
        let countsMap: Record<string, { documents_count: number; code_examples_count: number }> = {};

        if (sourceIds.length > 0) {
          try {
            const countsResponse = await knowledgeBaseApi.getBulkCounts(sourceIds);
            if (countsResponse.success) {
              countsMap = countsResponse.counts;
            }
          } catch (err) {
            console.error("Failed to load bulk counts, falling back to individual fetches:", err);
            // Fallback to individual fetches if bulk counts fails (backwards compatibility)
            await Promise.all(
              sourcesData.map(async (source: KnowledgeSource) => {
                try {
                  const [chunksResponse, codeResponse] = await Promise.all([
                    knowledgeBaseApi.listPages({ source_id: source.source_id, limit: 1 }),
                    knowledgeBaseApi.searchCodeExamples({ source_id: source.source_id, match_count: 1 }),
                  ]);
                  countsMap[source.source_id] = {
                    documents_count: chunksResponse.total || 0,
                    code_examples_count: codeResponse.total || 0,
                  };
                } catch (innerErr) {
                  console.error(`Failed to load counts for source ${source.source_id}:`, innerErr);
                  countsMap[source.source_id] = { documents_count: 0, code_examples_count: 0 };
                }
              })
            );
          }
        }

        // Merge counts into sources
        const sourcesWithCounts = sourcesData.map((source: KnowledgeSource) => ({
          ...source,
          id: source.source_id, // Add id for DataTable keyExtractor
          documents_count: countsMap[source.source_id]?.documents_count || 0,
          code_examples_count: countsMap[source.source_id]?.code_examples_count || 0,
        }));

        setSources(sourcesWithCounts);

        // Calculate completion rate (sources with >5 documents)
        const sourcesWithDocs = sourcesWithCounts.filter((s: KnowledgeSource) => (s.documents_count || 0) > 5).length;
        const rate = sourcesWithCounts.length > 0
          ? Math.round((sourcesWithDocs / sourcesWithCounts.length) * 100)
          : 0;
        setCompletionRate(rate);
      } else {
        setError(response.error || "Failed to load sources");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdditionalMetrics = async () => {
    setMetricsLoading(true);

    try {
      const tasksResponse = await tasksApi.getAll({ per_page: 1000 });

      if (tasksResponse.success && tasksResponse.items) {
        const linkedCount = tasksResponse.items.filter(task => {
          return (task as any).sources_count && (task as any).sources_count > 0;
        }).length;

        setTasksLinked(linkedCount);
      }
    } catch (err) {
      console.error("Failed to load additional metrics:", err);
    } finally {
      setMetricsLoading(false);
    }
  };

  // ========== HANDLERS ==========

  const handleView = (source: KnowledgeSource) => {
    setSelectedSource(source);
    setIsInspectorOpen(true);
  };

  const handleEdit = (source: KnowledgeSource) => {
    setSourceToEdit(source);
    setIsEditDialogOpen(true);
  };

  const handleUpdateSource = async (id: string, data: import("@/lib/types").SourceUpdateRequest) => {
    try {
      const response = await knowledgeBaseApi.updateSource(id, data);
      if (response.success) {
        alert("Source updated successfully!");
        await loadSources();
      } else {
        throw new Error(response.error || "Failed to update source");
      }
    } catch (err) {
      throw err;
    }
  };

  const handleDelete = async (source: KnowledgeSource) => {
    if (
      !confirm(
        `Are you sure you want to delete "${source.title}"? This will remove all indexed documents and code examples.`
      )
    ) {
      return;
    }

    try {
      const response = await knowledgeBaseApi.deleteSource(source.source_id);
      if (response.success) {
        alert("Source deleted successfully!");
        await loadSources();
      } else {
        throw new Error(response.error || "Failed to delete source");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete source");
    }
  };

  /**
   * Opens the recrawl options modal for a source.
   */
  const handleRecrawl = (source: KnowledgeSource) => {
    setRecrawlSource(source);
  };

  /**
   * Performs the actual recrawl with user-selected options.
   */
  const handleRecrawlConfirm = async (options: RecrawlOptions) => {
    if (!recrawlSource) return;

    try {
      const response = await knowledgeBaseApi.recrawl(recrawlSource.source_id, options);
      if (response.success) {
        alert(
          `Recrawl started successfully! Operation ID: ${response.data?.operation_id}`
        );
        await loadSources();
      } else {
        throw new Error(response.error || "Failed to start recrawl");
      }
    } catch (err) {
      throw err; // Let modal handle the error display
    }
  };

  const handleCrawl = async (data: CrawlRequest) => {
    try {
      const response = await knowledgeBaseApi.crawlUrl(data);
      if (response.success) {
        alert(
          `Crawl started successfully! ${response.message}\nProgress ID: ${response.progressId}`
        );
        setTimeout(() => loadSources(), 2000);
      } else {
        throw new Error("Failed to start crawl");
      }
    } catch (err) {
      throw err;
    }
  };

  const handleUpload = async (file: File, metadata: UploadMetadata) => {
    try {
      const response = await knowledgeBaseApi.uploadDocument(file, metadata);
      if (response.success) {
        alert(
          `Upload started for ${response.filename || file.name}! ${response.message}\nProgress ID: ${response.progressId}`
        );
        setTimeout(() => loadSources(), 2000);
      } else {
        throw new Error("Failed to upload document");
      }
    } catch (err) {
      throw err;
    }
  };

  const handleContentSearch = async (page = 1) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchTotal(0);
      setSearchPages(0);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setSearchPage(page);

    try {
      const response = await knowledgeBaseApi.searchContent({
        query: searchQuery,
        match_count: 50,
        page,
        per_page: 10,
      });

      if (response.success) {
        setSearchResults(response.results);
        setSearchTotal(response.total);
        setSearchPages(response.pages);
      } else {
        throw new Error("Search failed");
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Failed to search content");
      setSearchResults([]);
      setSearchTotal(0);
      setSearchPages(0);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchModeChange = (mode: "sources" | "content") => {
    setSearchMode(mode);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setSearchPage(1);
  };

  /**
   * Bulk re-crawl handler - Adds selected sources to crawl queue
   * Uses default crawl depth from settings (Settings > Crawl > Default Max Depth)
   */
  const handleBulkRecrawl = async (selectedSources: KnowledgeSource[]) => {
    try {
      // Fetch default crawl settings
      const settingsResponse = await fetch("http://localhost:8181/api/settings");
      let crawlDepth = 3; // Fallback default

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        crawlDepth = settingsData.data?.crawl?.default_max_depth || 3;
      }

      const sourceIds = selectedSources.map((s) => s.source_id);
      const priorities = Object.fromEntries(
        sourceIds.map((id) => [id, 100]) // High priority for all
      );

      const response = await fetch("http://localhost:8181/api/crawl-queue/add-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_ids: sourceIds,
          priorities
        }),
      });

      if (!response.ok) throw new Error("Failed to add sources to queue");

      const result = await response.json();

      alert(
        `✅ Added ${result.added_count} sources to crawl queue!\n\nBatch ID: ${result.batch_id}\nCrawl Depth: ${crawlDepth} (from settings)\n\nWatch the queue monitor below to see progress.`
      );

      // Refresh sources list
      await loadSources();
    } catch (error) {
      console.error("Bulk re-crawl error:", error);
      alert("❌ Failed to add sources to queue. Check console for details.");
    }
  };

  /**
   * Bulk delete handler - Deletes selected sources with confirmation
   */
  const handleBulkDelete = async (selectedSources: KnowledgeSource[]) => {
    const count = selectedSources.length;
    const sourceNames = selectedSources.map((s) => s.title).join(", ");

    if (
      !confirm(
        `⚠️ Delete ${count} sources?\n\nSources: ${sourceNames}\n\nThis will remove all indexed documents and code examples. This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const sourceIds = selectedSources.map((s) => s.source_id);

      const response = await fetch("http://localhost:8181/api/sources/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_ids: sourceIds }),
      });

      if (!response.ok) throw new Error("Failed to delete sources");

      const result = await response.json();

      alert(
        `✅ Deleted ${result.deleted_count} of ${result.total_requested} sources`
      );

      if (result.failed_count > 0) {
        console.error("Failed deletions:", result.details.filter((d: any) => !d.success));
        alert(`⚠️ Warning: Failed to delete ${result.failed_count} sources. Check console for details.`);
      }

      // Refresh sources list
      await loadSources();
    } catch (error) {
      console.error("Bulk delete error:", error);
      alert("❌ Failed to delete sources. Check console for details.");
    }
  };

  // ========== DATATABLE CONFIGURATION ==========

  const columns: DataTableColumn<KnowledgeSource>[] = [
    {
      key: "title",
      label: "Source Name",
      sortable: true,
      render: (value, source) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {value}
          </div>
          {source.url && (
            <div className="text-xs text-gray-500 truncate max-w-xs">
              {source.url}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "knowledge_type",
      label: "Type",
      sortable: true,
      width: "120px",
      render: (value) => (
        <span className="text-sm text-gray-900 dark:text-white capitalize">
          {value || "N/A"}
        </span>
      ),
    },
    {
      key: "documents_count",
      label: "Pages",
      sortable: true,
      width: "100px",
      render: (value) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {value || 0}
        </span>
      ),
    },
    {
      key: "code_examples_count",
      label: "Code Examples",
      sortable: true,
      width: "130px",
      render: (value) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {value || 0}
        </span>
      ),
    },
    {
      key: "updated_at",
      label: "Last Updated",
      sortable: true,
      width: "150px",
      render: (value) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {value ? formatDistanceToNow(new Date(value), { addSuffix: true }) : "N/A"}
        </span>
      ),
    },
  ];

  const tableButtons: DataTableButton[] = [
    {
      label: "Add Source",
      icon: HiPlus,
      onClick: () => setIsAddDialogOpen(true),
      variant: "primary",
    },
  ];

  const rowButtons = (source: KnowledgeSource): DataTableButton[] => [
    {
      label: "View",
      icon: HiEye,
      onClick: () => handleView(source),
    },
    {
      label: "Edit",
      icon: HiPencil,
      onClick: () => handleEdit(source),
    },
    {
      label: "Recrawl",
      icon: HiRefresh,
      onClick: () => handleRecrawl(source),
    },
    {
      label: "Delete",
      icon: HiTrash,
      onClick: () => handleDelete(source),
      variant: "ghost",
    },
  ];

  // Get unique types and levels for filters
  const typeOptions = useMemo(() => {
    const types = [...new Set(sources.map(s => s.knowledge_type).filter(Boolean))];
    return types.map(type => ({ value: type, label: type?.charAt(0).toUpperCase() + type?.slice(1) || "" }));
  }, [sources]);

  const levelOptions = useMemo(() => {
    const levels = [...new Set(sources.map(s => s.level).filter(Boolean))] as string[];
    return levels.map(level => ({ value: level, label: level.charAt(0).toUpperCase() + level.slice(1) }));
  }, [sources]);

  const filterConfigs: FilterConfig[] = [
    {
      field: "knowledge_type",
      label: "Type",
      type: "select",
      options: typeOptions,
    },
    {
      field: "level",
      label: "Level",
      type: "select",
      options: levelOptions,
    },
  ];

  // ========== RENDER ==========

  if (error) {
    return (
      <div className="p-8">
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          <p className="font-semibold">Error loading sources</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={loadSources}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <BreadCrumb
        items={[{ label: "Knowledge Base", href: "/knowledge-base" }]}
        className="mb-4"
      />

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          Knowledge Base
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage and explore indexed documentation and code examples
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Total Sources</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {isLoading ? (
              <div className="h-8 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ) : (
              sources.length
            )}
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Total Documents</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {isLoading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ) : (
              sources.reduce((sum, s) => sum + (s.documents_count || 0), 0).toLocaleString()
            )}
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Code Examples</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {isLoading ? (
              <div className="h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ) : (
              sources.reduce((sum, s) => sum + (s.code_examples_count || 0), 0).toLocaleString()
            )}
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Total Words</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ) : (
              sources.reduce((sum, s) => sum + (s.total_words || 0), 0).toLocaleString()
            )}
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Tasks Linked</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {metricsLoading ? (
              <div className="h-8 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ) : (
              tasksLinked
            )}
          </div>
        </div>

        <div className="rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Completion Rate</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {isLoading ? (
              <div className="h-8 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ) : (
              `${completionRate}%`
            )}
          </div>
        </div>
      </div>

      {/* Active Operations */}
      <CrawlingProgress className="mb-4" />

      {/* Crawl Queue Monitor */}
      <CrawlQueueMonitor sources={sources} className="mb-4" />

      {/* Search Mode Toggle and Content Search */}
      <div className="mb-6 rounded-lg border-2 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        {/* Search Mode Toggle */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Search Mode:
          </span>
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600">
            <button
              onClick={() => handleSearchModeChange("sources")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                searchMode === "sources"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              } rounded-l-lg border-r border-gray-300 dark:border-gray-600`}
            >
              Source Titles
            </button>
            <button
              onClick={() => handleSearchModeChange("content")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                searchMode === "content"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              } rounded-r-lg`}
            >
              Page Content
            </button>
          </div>
        </div>

        {/* Content Search UI */}
        {searchMode === "content" && (
          <div>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleContentSearch(1)}
                placeholder="Search within crawled pages (e.g., 'authentication JWT tokens')..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
              <button
                onClick={() => handleContentSearch(1)}
                disabled={searchLoading || !searchQuery.trim()}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Search Results */}
            {searchError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                <p className="font-semibold">Search Error</p>
                <p className="text-sm">{searchError}</p>
              </div>
            )}

            {searchResults.length > 0 && (
              <div>
                <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                  Found {searchTotal} results in {searchPages} pages
                </div>
                <div className="space-y-4">
                  {searchResults.map((result, index) => (
                    <div
                      key={result.id || index}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {result.url}
                        </a>
                        <div className="flex gap-2">
                          <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {result.match_type}
                          </span>
                          <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
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
                </div>

                {/* Pagination */}
                {searchPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleContentSearch(searchPage - 1)}
                      disabled={searchPage === 1 || searchLoading}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Page {searchPage} of {searchPages}
                    </span>
                    <button
                      onClick={() => handleContentSearch(searchPage + 1)}
                      disabled={searchPage === searchPages || searchLoading}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {!searchLoading && searchQuery && searchResults.length === 0 && !searchError && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-gray-600 dark:text-gray-400">
                  No results found for &quot;{searchQuery}&quot;
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Data Table with Bulk Operations Support */}
      {!isLoading && sources.length === 0 ? (
        <div className="rounded-lg border-2 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <EmptyState
            config={{
              type: "knowledge_base",
              title: "Start Building Your Knowledge Base",
              description: "Crawl documentation, upload files, or add sources to get started. Build a comprehensive knowledge repository for your projects.",
              button: {
                text: "Add Your First Source",
                onClick: () => setIsAddDialogOpen(true),
                variant: "primary" as any,
                icon: "HiPlus" as any,
              },
            }}
          />
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View: Use DataTable for consistency */
        <DataTable
          data={sources}
          columns={columns}
          tableButtons={tableButtons}
          rowButtons={rowButtons}
          tableId="archon-knowledge-sources-grid"
          viewMode="grid"
          customRender={(source) => (
            <KnowledgeSourceCard
              key={source.source_id}
              source={source}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRecrawl={handleRecrawl}
            />
          )}
          showSearch={searchMode === "sources"}
          showViewToggle={true}
          showFilters={true}
          filterConfigs={filterConfigs}
          showPagination
          isLoading={isLoading}
          emptyMessage="No sources found. Create your first source to get started!"
          caption={`Grid view of ${sources.length} knowledge sources`}
          keyExtractor={(source) => source.source_id}
          className="rounded-lg border-2 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
        />
      ) : (
        /* Table View: Use KnowledgeTableViewWithBulk with DataTable-style wrapper */
        <div className="space-y-4 rounded-lg border-2 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {/* DataTable-style Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Knowledge Sources ({sources.length})
            </h2>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600">
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === "table"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  } rounded-l-lg`}
                  title="Table View"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === "grid"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  } rounded-r-lg border-l border-gray-300 dark:border-gray-600`}
                  title="Grid View"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
              </div>
              {/* Add Source Button */}
              <button
                onClick={() => setIsAddDialogOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <HiPlus className="h-5 w-5" />
                Add Source
              </button>
            </div>
          </div>

          {/* Table Content with Bulk Operations */}
          <KnowledgeTableViewWithBulk
            sources={sources}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRecrawl={handleRecrawl}
            onBulkRecrawl={handleBulkRecrawl}
            onBulkDelete={handleBulkDelete}
            searchTerm={searchQuery}
          />
        </div>
      )}

      {/* Add Source Dialog */}
      <AddSourceDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onCrawl={handleCrawl}
        onUpload={handleUpload}
      />

      {/* Edit Source Dialog */}
      <EditSourceDialog
        isOpen={isEditDialogOpen}
        source={sourceToEdit}
        onClose={() => {
          setIsEditDialogOpen(false);
          setSourceToEdit(null);
        }}
        onUpdate={handleUpdateSource}
      />

      {/* Source Inspector */}
      <SourceInspector
        source={selectedSource}
        isOpen={isInspectorOpen}
        onClose={() => {
          setIsInspectorOpen(false);
          setSelectedSource(null);
        }}
      />

      {/* Recrawl Options Modal */}
      <RecrawlOptionsModal
        isOpen={recrawlSource !== null}
        source={recrawlSource}
        onClose={() => setRecrawlSource(null)}
        onConfirm={handleRecrawlConfirm}
      />
    </div>
  );
}
