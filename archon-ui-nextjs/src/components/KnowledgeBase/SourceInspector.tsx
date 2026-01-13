"use client";

import { useState, useEffect } from "react";
import { KnowledgeSource, KnowledgePage, CodeExample } from "@/lib/types";
import { knowledgeBaseApi } from "@/lib/apiClient";
import { HiX, HiDocument, HiCode, HiSearch } from "react-icons/hi";

interface SourceInspectorProps {
  source: KnowledgeSource | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SourceInspector({ source, isOpen, onClose }: SourceInspectorProps) {
  const [activeTab, setActiveTab] = useState<"pages" | "code">("pages");
  const [pages, setPages] = useState<KnowledgePage[]>([]);
  const [codeExamples, setCodeExamples] = useState<CodeExample[]>([]);
  const [selectedPage, setSelectedPage] = useState<KnowledgePage | null>(null);
  const [selectedCode, setSelectedCode] = useState<CodeExample | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalChunks, setTotalChunks] = useState(0);
  const [totalCodeExamples, setTotalCodeExamples] = useState(0);

  useEffect(() => {
    if (isOpen && source) {
      loadSourceContent();
    }
  }, [isOpen, source]);

  const loadSourceContent = async () => {
    if (!source) return;

    setIsLoading(true);
    setError(null);

    try {
      // Load first batch to get total count
      const firstBatch = await knowledgeBaseApi.listPages({
        source_id: source.source_id,
        limit: 100,
        offset: 0,
      });

      console.log("[SourceInspector] First batch response:", firstBatch);

      if (firstBatch.success && firstBatch.chunks) {
        const total = firstBatch.total || 0;
        setTotalChunks(total);

        // Show individual chunks as "documents" (not grouped by page_id)
        // Transform chunks to page format
        const transformedChunks = firstBatch.chunks.map((chunk: any) => ({
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
        console.log("[SourceInspector] Loaded", transformedChunks.length, "document chunks of", total, "total");
      }

      // Load code examples
      const codeResponse = await knowledgeBaseApi.searchCodeExamples({
        source_id: source.source_id,
        match_count: 100,
      });

      console.log("[SourceInspector] Code examples response:", codeResponse);

      if (codeResponse.success && codeResponse.code_examples) {
        const total = codeResponse.total || 0;
        setTotalCodeExamples(total);

        // Transform code examples to expected format
        const transformedExamples = codeResponse.code_examples.map((example: any) => ({
          id: example.id.toString(),
          content: example.content,
          language: example.language || example.metadata?.language || "",
          description: example.metadata?.description || "",
          summary: example.summary || example.example_name || "",
          source_id: example.source_id,
          metadata: example.metadata,
        }));
        setCodeExamples(transformedExamples);
        console.log("[SourceInspector] Loaded", transformedExamples.length, "code examples of", total, "total");
      }
    } catch (err) {
      console.error("[SourceInspector] Error loading content:", err);
      setError(err instanceof Error ? err.message : "Failed to load source content");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageClick = (page: KnowledgePage) => {
    // Content is already loaded in the page object
    setSelectedPage(page);
  };

  const handleCodeClick = (code: CodeExample) => {
    setSelectedCode(code);
  };

  const filteredPages = pages.filter(
    (page) =>
      page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCode = codeExamples.filter(
    (code) =>
      code.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      code.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen || !source) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-7xl rounded-lg bg-white shadow-xl dark:bg-gray-800">
        {/* Sidebar */}
        <div className="flex w-96 flex-col border-r border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="border-b border-gray-200 p-4 dark:border-gray-700">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {source.title}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <HiX className="h-6 w-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setActiveTab("pages");
                  setSelectedCode(null); // Clear code selection when switching to pages
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                  activeTab === "pages"
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                <HiDocument className="h-4 w-4" />
                Documents ({totalChunks})
              </button>
              <button
                onClick={() => {
                  setActiveTab("code");
                  setSelectedPage(null); // Clear page selection when switching to code
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                  activeTab === "code"
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                <HiCode className="h-4 w-4" />
                Code Examples ({totalCodeExamples})
              </button>
            </div>

            {/* Search */}
            <div className="mt-4">
              <div className="relative">
                <HiSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeTab}...`}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Content List */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Showing X of Y header */}
                {activeTab === "pages" && pages.length > 0 && (
                  <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    Showing {pages.length} of {totalChunks}
                  </div>
                )}
                {activeTab === "code" && codeExamples.length > 0 && (
                  <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    Showing {codeExamples.length} of {totalCodeExamples}
                  </div>
                )}

                {activeTab === "pages" &&
                  filteredPages.map((page) => (
                    <button
                      key={page.page_id}
                      onClick={() => handlePageClick(page)}
                      className={`w-full rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                        selectedPage?.page_id === page.page_id
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                          : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div className="mb-1 font-medium text-gray-900 dark:text-white">
                        {page.title}
                      </div>
                      {page.section_title && (
                        <div className="mb-1 text-xs text-gray-600 dark:text-gray-400">
                          {page.section_title}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        {page.word_count} words
                      </div>
                    </button>
                  ))}

                {activeTab === "code" &&
                  filteredCode.map((code) => (
                    <button
                      key={code.id}
                      onClick={() => handleCodeClick(code)}
                      className={`w-full rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                        selectedCode?.id === code.id
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                          : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div className="mb-1 font-medium text-gray-900 dark:text-white">
                        {code.summary || "Code Example"}
                      </div>
                      {code.language && (
                        <div className="mb-1 text-xs text-gray-600 dark:text-gray-400">
                          {code.language}
                        </div>
                      )}
                      {code.description && (
                        <div className="text-xs text-gray-500">{code.description}</div>
                      )}
                    </button>
                  ))}

                {activeTab === "pages" && filteredPages.length === 0 && (
                  <div className="rounded-lg border border-gray-200 p-4 text-center text-gray-500 dark:border-gray-700">
                    No pages found
                  </div>
                )}

                {activeTab === "code" && filteredCode.length === 0 && (
                  <div className="rounded-lg border border-gray-200 p-4 text-center text-gray-500 dark:border-gray-700">
                    No code examples found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedPage && !selectedCode && (
              <div className="flex h-full items-center justify-center text-gray-500">
                Select an item to view details
              </div>
            )}

            {selectedPage && (
              <div>
                <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedPage.title}
                </h3>
                {selectedPage.url && (
                  <a
                    href={selectedPage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-4 block text-sm text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {selectedPage.url}
                  </a>
                )}
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900">
                    {selectedPage.full_content || selectedPage.content}
                  </pre>
                </div>
              </div>
            )}

            {selectedCode && (
              <div>
                <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedCode.summary || "Code Example"}
                </h3>
                {selectedCode.language && (
                  <div className="mb-2 inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800 dark:bg-brand-900/20 dark:text-brand-400">
                    {selectedCode.language}
                  </div>
                )}
                {selectedCode.description && (
                  <p className="mb-4 text-gray-600 dark:text-gray-400">
                    {selectedCode.description}
                  </p>
                )}
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                    <code>{selectedCode.content}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
