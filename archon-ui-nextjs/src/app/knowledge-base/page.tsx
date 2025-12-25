"use client";

import { useEffect, useState } from "react";
import { knowledgeBaseApi } from "@/lib/apiClient";
import { KnowledgeSource, CrawlRequest, UploadMetadata } from "@/lib/types";
import { KnowledgeSourceCard } from "@/components/KnowledgeBase/KnowledgeSourceCard";
import { AddSourceDialog } from "@/components/KnowledgeBase/AddSourceDialog";
import { EditSourceDialog } from "@/components/KnowledgeBase/EditSourceDialog";
import { SourceInspector } from "@/components/KnowledgeBase/SourceInspector";
import { CrawlingProgress } from "@/components/KnowledgeBase/CrawlingProgress";
import { usePageTitle } from "@/hooks";
import { HiPlus, HiSearch } from "react-icons/hi";

export default function KnowledgeBasePage() {
  usePageTitle("Knowledge Base", "Archon");

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [filteredSources, setFilteredSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | "technical" | "business">("all");
  const [selectedLevel, setSelectedLevel] = useState<"all" | "basic" | "intermediate" | "advanced">("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<KnowledgeSource | null>(null);
  const [sourceToEdit, setSourceToEdit] = useState<KnowledgeSource | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    filterSources();
  }, [sources, searchQuery, selectedType, selectedLevel]);

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
                documents_count: chunksResponse.total || 0,
                code_examples_count: codeResponse.total || 0,
              };
            } catch (err) {
              console.error(`Failed to load counts for source ${source.source_id}:`, err);
              return {
                ...source,
                documents_count: 0,
                code_examples_count: 0,
              };
            }
          })
        );

        setSources(sourcesWithCounts);
      } else {
        setError(response.error || "Failed to load sources");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setIsLoading(false);
    }
  };

  const filterSources = () => {
    let filtered = [...sources];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((source) => {
        const url = source.url || source.metadata?.original_url || "";
        const tags = source.tags?.length > 0 ? source.tags : (source.metadata?.tags || []);

        return (
          source.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          url.toLowerCase().includes(searchQuery.toLowerCase()) ||
          source.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      });
    }

    // Filter by type
    if (selectedType !== "all") {
      filtered = filtered.filter((source) => {
        const knowledgeType = source.knowledge_type || source.metadata?.knowledge_type;
        return knowledgeType === selectedType;
      });
    }

    // Filter by level
    if (selectedLevel !== "all") {
      filtered = filtered.filter((source) => {
        return source.level === selectedLevel;
      });
    }

    setFilteredSources(filtered);
  };

  const handleCrawl = async (data: CrawlRequest) => {
    try {
      const response = await knowledgeBaseApi.crawlUrl(data);
      if (response.success) {
        // Show success message
        alert(
          `Crawl started successfully! ${response.message}\nProgress ID: ${response.progressId}`
        );
        // Reload sources after a delay to allow the crawl to start
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
        // Show success message
        alert(
          `Upload started for ${response.filename || file.name}! ${response.message}\nProgress ID: ${response.progressId}`
        );
        // Reload sources after a delay to allow the upload to process
        setTimeout(() => loadSources(), 2000);
      } else {
        throw new Error("Failed to upload document");
      }
    } catch (err) {
      throw err;
    }
  };

  const handleViewSource = (source: KnowledgeSource) => {
    setSelectedSource(source);
    setIsInspectorOpen(true);
  };

  const handleEditSource = (source: KnowledgeSource) => {
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
      throw err; // Re-throw to let EditSourceDialog handle it
    }
  };

  const handleDeleteSource = async (source: KnowledgeSource) => {
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

  const handleRecrawlSource = async (source: KnowledgeSource) => {
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

  return (
    <div className="min-h-screen bg-gray-50 p-8 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          Knowledge Base
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage and explore indexed documentation and code examples
        </p>
      </div>

      {/* Filters & Actions */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative flex-1 lg:max-w-md">
          <HiSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sources..."
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="technical">Technical</option>
            <option value="business">Business</option>
          </select>

          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value as any)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">All Levels</option>
            <option value="basic">Basic</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <button
            onClick={() => setIsAddDialogOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <HiPlus className="h-5 w-5" />
            Add Source
          </button>
        </div>
      </div>

      {/* Stats - Compact */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Total Sources</div>
          <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {sources.length}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Total Documents</div>
          <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {sources.reduce((sum, s) => sum + (s.documents_count || 0), 0).toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Code Examples</div>
          <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {sources.reduce((sum, s) => sum + (s.code_examples_count || 0), 0).toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">Total Words</div>
          <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {sources.reduce((sum, s) => sum + (s.total_words || 0), 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Active Operations - Live Progress Tracking */}
      <CrawlingProgress className="mb-4" />

      {/* Sources Grid - Compact spacing */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold text-sm">Error loading sources</p>
          <p className="text-xs">{error}</p>
          <button
            onClick={loadSources}
            className="mt-2 text-xs underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      ) : filteredSources.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {searchQuery || selectedType !== "all" || selectedLevel !== "all"
              ? "No sources match your filters"
              : "No sources yet. Add your first source to get started!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSources.map((source) => (
            <KnowledgeSourceCard
              key={source.source_id}
              source={source}
              onView={handleViewSource}
              onEdit={handleEditSource}
              onDelete={handleDeleteSource}
              onRecrawl={handleRecrawlSource}
            />
          ))}
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
    </div>
  );
}
