"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HiPlus, HiEye, HiPencil, HiTrash, HiRefresh } from "react-icons/hi";
import { knowledgeBaseApi, tasksApi } from "@/lib/apiClient";
import { KnowledgeSource, CrawlRequest, UploadMetadata } from "@/lib/types";
import { KnowledgeSourceCard } from "@/components/KnowledgeBase/KnowledgeSourceCard";
import { AddSourceDialog } from "@/components/KnowledgeBase/AddSourceDialog";
import { EditSourceDialog } from "@/components/KnowledgeBase/EditSourceDialog";
import { SourceInspector } from "@/components/KnowledgeBase/SourceInspector";
import { CrawlingProgress } from "@/components/KnowledgeBase/CrawlingProgress";
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

  // Additional metrics state
  const [tasksLinked, setTasksLinked] = useState<number>(0);
  const [completionRate, setCompletionRate] = useState<number>(0);
  const [metricsLoading, setMetricsLoading] = useState(false);

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

        // Fetch counts for each source (documents and code examples)
        const sourcesWithCounts = await Promise.all(
          sourcesData.map(async (source: KnowledgeSource) => {
            try {
              // Fetch with limit=1 to get just the total count efficiently
              const [chunksResponse, codeResponse] = await Promise.all([
                knowledgeBaseApi.listPages({ source_id: source.source_id, limit: 1 }),
                knowledgeBaseApi.searchCodeExamples({ source_id: source.source_id, match_count: 1 }),
              ]);

              return {
                ...source,
                id: source.source_id, // Add id for DataTable keyExtractor
                documents_count: chunksResponse.total || 0,
                code_examples_count: codeResponse.total || 0,
              };
            } catch (err) {
              console.error(`Failed to load counts for source ${source.source_id}:`, err);
              return {
                ...source,
                id: source.source_id,
                documents_count: 0,
                code_examples_count: 0,
              };
            }
          })
        );

        setSources(sourcesWithCounts);

        // Calculate completion rate (sources with >5 documents)
        const sourcesWithDocs = sourcesWithCounts.filter(s => (s.documents_count || 0) > 5).length;
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

  const handleRecrawl = async (source: KnowledgeSource) => {
    if (
      !confirm(
        `Are you sure you want to recrawl "${source.title}"? This will update all indexed content.`
      )
    ) {
      return;
    }

    try {
      const response = await knowledgeBaseApi.recrawl(source.source_id);
      if (response.success) {
        alert(
          `Recrawl started successfully! Operation ID: ${response.data?.operation_id}`
        );
        await loadSources();
      } else {
        throw new Error(response.error || "Failed to start recrawl");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start recrawl");
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

      {/* Conditional Render: Empty State or DataTable */}
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
      ) : (
        <DataTable
          data={sources}
          columns={columns}
          tableButtons={tableButtons}
          rowButtons={rowButtons}
          viewMode="table"
          customRender={(source) => (
            <KnowledgeSourceCard
              source={source}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRecrawl={handleRecrawl}
            />
          )}
          showSearch
          filterConfigs={filterConfigs}
          showViewToggle={true}
          showFilters={true}
          showPagination
          isLoading={isLoading}
          emptyMessage="No sources found. Add your first source to get started!"
          caption={`List of ${sources.length} knowledge sources`}
        />
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
    </div>
  );
}
