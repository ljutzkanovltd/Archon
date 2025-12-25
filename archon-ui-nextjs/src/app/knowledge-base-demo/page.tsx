"use client";

import { useState, useMemo } from "react";
import {
  KnowledgeListHeader,
  KnowledgeTypeFilter,
  KnowledgeTagsFilter,
  KnowledgeTableView,
  KnowledgeGridView,
  type KnowledgeType,
} from "@/components/KnowledgeBase";
import { KnowledgeSource } from "@/lib/types";

// Mock data for testing
const mockSources: KnowledgeSource[] = [
  {
    source_id: "1",
    title: "React Hooks Guide",
    knowledge_type: "technical",
    tags: ["React", "JavaScript", "Frontend"],
    summary: "Comprehensive guide to React Hooks including useState, useEffect, and custom hooks",
    url: "https://react.dev/reference/react",
    documents_count: 12,
    code_examples_count: 8,
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-12-20T14:22:00Z",
    level: "intermediate",
    metadata: {},
  },
  {
    source_id: "2",
    title: "Business Strategy Framework",
    knowledge_type: "business",
    tags: ["Strategy", "Business", "Planning"],
    summary: "Strategic planning and business model canvas for modern enterprises",
    url: "https://strategyzer.com/business-model-canvas",
    documents_count: 5,
    code_examples_count: 0,
    created_at: "2024-02-10T09:15:00Z",
    updated_at: "2024-12-18T11:30:00Z",
    level: "advanced",
    metadata: {},
  },
  {
    source_id: "3",
    title: "TypeScript Best Practices",
    knowledge_type: "technical",
    tags: ["TypeScript", "JavaScript", "Types"],
    summary: "Type-safe coding patterns and advanced TypeScript features",
    url: "https://www.typescriptlang.org/docs/",
    documents_count: 18,
    code_examples_count: 15,
    created_at: "2024-03-05T16:45:00Z",
    updated_at: "2024-12-22T09:10:00Z",
    level: "advanced",
    metadata: {},
  },
  {
    source_id: "4",
    title: "Next.js App Router",
    knowledge_type: "technical",
    tags: ["Next.js", "React", "SSR"],
    summary: "Server components, layouts, and routing in Next.js 14+",
    url: "https://nextjs.org/docs/app",
    documents_count: 22,
    code_examples_count: 20,
    created_at: "2024-04-12T08:00:00Z",
    updated_at: "2024-12-23T07:45:00Z",
    level: "intermediate",
    metadata: {},
  },
  {
    source_id: "5",
    title: "Product Management Essentials",
    knowledge_type: "business",
    tags: ["Product", "Management", "UX"],
    summary: "User research, roadmapping, and product development lifecycle",
    url: "https://www.productplan.com/learn/",
    documents_count: 8,
    code_examples_count: 0,
    created_at: "2024-05-20T13:20:00Z",
    updated_at: "2024-12-19T16:00:00Z",
    level: "basic",
    metadata: {},
  },
  {
    source_id: "6",
    title: "FastAPI Development",
    knowledge_type: "technical",
    tags: ["Python", "API", "Backend"],
    summary: "Modern Python web framework with automatic API documentation",
    url: "https://fastapi.tiangolo.com/",
    documents_count: 15,
    code_examples_count: 12,
    created_at: "2024-06-08T11:30:00Z",
    updated_at: "2024-12-21T10:15:00Z",
    level: "intermediate",
    metadata: {},
  },
];

export default function KnowledgeBaseDemoPage() {
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedType, setSelectedType] = useState<KnowledgeType>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Extract all unique tags from sources
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    mockSources.forEach((source) => {
      source.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, []);

  // Calculate type counts
  const typeCounts = useMemo(() => {
    const counts = {
      all: mockSources.length,
      technical: 0,
      business: 0,
    };
    mockSources.forEach((source) => {
      const type = source.knowledge_type || "technical";
      if (type === "technical") counts.technical++;
      if (type === "business") counts.business++;
    });
    return counts;
  }, []);

  // Filter sources based on all filters
  const filteredSources = useMemo(() => {
    return mockSources.filter((source) => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        source.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        source.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        source.url?.toLowerCase().includes(searchQuery.toLowerCase());

      // Type filter
      const sourceType = source.knowledge_type || "technical";
      const matchesType = selectedType === "all" || sourceType === selectedType;

      // Tags filter
      const sourceTags = source.tags || [];
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => sourceTags.includes(tag));

      return matchesSearch && matchesType && matchesTags;
    });
  }, [searchQuery, selectedType, selectedTags]);

  // Action handlers
  const handleView = (source: KnowledgeSource) => {
    console.log("View source:", source);
    alert(`Viewing: ${source.title}`);
  };

  const handleEdit = (source: KnowledgeSource) => {
    console.log("Edit source:", source);
    alert(`Editing: ${source.title}`);
  };

  const handleDelete = (source: KnowledgeSource) => {
    console.log("Delete source:", source);
    if (confirm(`Delete "${source.title}"?`)) {
      alert(`Deleted: ${source.title}`);
    }
  };

  const handleRecrawl = (source: KnowledgeSource) => {
    console.log("Recrawl source:", source);
    alert(`Recrawling: ${source.title}`);
  };

  const handleAddSource = () => {
    console.log("Add new source");
    alert("Add Source dialog would open here");
  };

  // Test loading state
  const toggleLoading = () => {
    setIsLoading(!isLoading);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Test Controls */}
      <div className="bg-yellow-50 border-b border-yellow-200 p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200">
              Knowledge Base Demo Page
            </h1>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Testing all components with mock data ({filteredSources.length} of {mockSources.length} sources shown)
            </p>
          </div>
          <button
            onClick={toggleLoading}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            {isLoading ? "Hide" : "Show"} Loading State
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {/* Header with Search & Actions */}
        <KnowledgeListHeader
          title="Knowledge Base"
          searchPlaceholder="Search sources..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAddSource={handleAddSource}
          showSuggestions={true}
          suggestions={["React", "TypeScript", "Next.js", "FastAPI", "Business Strategy"]}
          onSuggestionClick={(suggestion) => setSearchQuery(suggestion)}
        />

        {/* Type Filter */}
        <KnowledgeTypeFilter
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          counts={typeCounts}
        />

        {/* Tags Filter */}
        <KnowledgeTagsFilter
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          availableTags={availableTags}
          placeholder="Add tag..."
        />

        {/* Content Grid/Table */}
        {viewMode === "grid" ? (
          <KnowledgeGridView
            sources={filteredSources}
            searchTerm={searchQuery}
            isLoading={isLoading}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRecrawl={handleRecrawl}
          />
        ) : (
          <KnowledgeTableView
            sources={filteredSources}
            searchTerm={searchQuery}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRecrawl={handleRecrawl}
          />
        )}
      </div>
    </div>
  );
}
