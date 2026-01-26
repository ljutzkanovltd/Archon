"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  TextInput,
  Button,
  Spinner,
  Badge,
} from "flowbite-react";
import {
  HiSearch,
  HiCheckCircle,
  HiGlobeAlt,
  HiExternalLink,
} from "react-icons/hi";
import toast from "react-hot-toast";
import { KnowledgeStatusBadge } from "./KnowledgeStatusBadge";

interface LinkFromGlobalKBModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onLinked: () => void;
}

interface KBSearchResult {
  source_id: string;
  title: string;
  url?: string;
  content_preview?: string;
  knowledge_type: string;
  is_linked?: boolean;
}

/**
 * LinkFromGlobalKBModal - Modal for manually searching and linking KB items to project
 *
 * Features:
 * - Search input with debounced global KB search
 * - Results list showing title, preview, type
 * - Link button on each result
 * - Already linked items shown with checkmark (disabled link button)
 * - Loading states during search and link operations
 * - Success/error toasts
 */
export function LinkFromGlobalKBModal({
  projectId,
  isOpen,
  onClose,
  onLinked,
}: LinkFromGlobalKBModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Search global KB with debounce
  const {
    data: searchResults,
    isLoading: isSearching,
  } = useQuery({
    queryKey: ["global-kb-search", projectId, searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 3) {
        return { results: [] };
      }

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("archon_token")
          : null;

      // Fetch both search results and linked knowledge in parallel
      const [searchResponse, linkedResponse] = await Promise.all([
        fetch(
          `http://localhost:8181/api/knowledge-items?search=${encodeURIComponent(searchQuery)}&per_page=20`,
          {
            headers: {
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          }
        ),
        fetch(
          `http://localhost:8181/api/projects/${projectId}/knowledge`,
          {
            headers: {
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          }
        ),
      ]);

      if (!searchResponse.ok) {
        throw new Error("Failed to search knowledge base");
      }

      const searchData = await searchResponse.json();

      // Get linked source IDs (handle if linkedResponse fails)
      let linkedSourceIds = new Set<string>();
      if (linkedResponse.ok) {
        const linkedData = await linkedResponse.json();

        // Backend returns { links: [...], count: N } where links contain page-level data
        // Extract source_id from each link's knowledge_item
        const sourceIds = (linkedData.links || [])
          .map((link: any) => link.knowledge_item?.source_id)
          .filter(Boolean);

        linkedSourceIds = new Set(sourceIds);
      }

      // Map backend format to frontend format
      const results = searchData.items.map((item: any) => {
        const isLinked = linkedSourceIds.has(item.source_id);
        return {
          source_id: item.source_id,
          title: item.title,
          url: item.url,
          content_preview: item.metadata?.description || "",
          knowledge_type: item.metadata?.knowledge_type || "technical",
          is_linked: isLinked,
        };
      });

      return { results };
    },
    enabled: searchQuery.length >= 3,
  });

  // Link mutation with improved error handling
  const linkMutation = useMutation({
    mutationFn: async (sourceIds: string[]) => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("archon_token")
          : null;

      // Link all selected items with Promise.allSettled for partial success handling
      const results = await Promise.allSettled(
        sourceIds.map(async (sourceId) => {
          const res = await fetch(
            `http://localhost:8181/api/projects/${projectId}/knowledge/sources/${sourceId}/link`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: `Bearer ${token}` }),
              },
              body: JSON.stringify({
                linked_by: "User",
              }),
            }
          );

          if (!res.ok) {
            const errorData = await res.json();

            // Handle "already linked" case with friendly message
            if (errorData.already_linked) {
              throw new Error(`already_linked:${errorData.source?.title || "Source"}`);
            }

            throw new Error(`Failed to link item ${sourceId}`);
          }

          return res.json();
        })
      );

      // Count successes, failures, and already-linked
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const alreadyLinked = results.filter(
        (r) => r.status === "rejected" &&
        (r.reason as Error).message.startsWith("already_linked:")
      );
      const failed = results.filter(
        (r) => r.status === "rejected" &&
        !(r.reason as Error).message.startsWith("already_linked:")
      ).length;

      return {
        succeeded,
        failed,
        alreadyLinked: alreadyLinked.length,
        alreadyLinkedNames: alreadyLinked.map(r =>
          (r.reason as Error).message.replace("already_linked:", "")
        ),
        total: sourceIds.length
      };
    },
    onSuccess: ({ succeeded, failed, alreadyLinked, alreadyLinkedNames, total }) => {
      // Show appropriate message based on results
      if (failed === 0 && alreadyLinked === 0) {
        toast.success(
          `Successfully linked ${succeeded} item${succeeded > 1 ? "s" : ""}`
        );
      } else if (alreadyLinked > 0 && failed === 0) {
        toast.error(
          `${alreadyLinked} source${alreadyLinked > 1 ? "s" : ""} already linked to project: ${alreadyLinkedNames.join(", ")}`,
          { icon: '⚠️', duration: 6000 }
        );
      } else {
        toast.error(
          `Linked ${succeeded}/${total} items (${failed} failed${alreadyLinked > 0 ? `, ${alreadyLinked} already linked` : ""})`,
          { icon: '⚠️', duration: 5000 }
        );
      }

      queryClient.invalidateQueries({
        queryKey: ["knowledge-suggestions", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["linked-knowledge", projectId],
      });
      setSelectedItems(new Set());
      setSearchQuery("");
      onLinked();
      onClose();
    },
    onError: () => {
      toast.error("Bulk link operation failed");
    },
  });

  const handleToggleSelection = (sourceId: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(sourceId)) {
      newSet.delete(sourceId);
    } else {
      newSet.add(sourceId);
    }
    setSelectedItems(newSet);
  };

  const handleSelectAll = () => {
    const unlinkableResults = results.filter((r: KBSearchResult) => !r.is_linked);
    const allIds: Set<string> = new Set(unlinkableResults.map((r: KBSearchResult) => r.source_id));
    setSelectedItems(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedItems(new Set());
  };

  const handleLink = () => {
    if (selectedItems.size === 0) return;
    linkMutation.mutate(Array.from(selectedItems));
  };

  const results = searchResults?.results || [];
  const unlinkableResults = results.filter((r: KBSearchResult) => !r.is_linked);
  const allSelected = unlinkableResults.length > 0 && selectedItems.size === unlinkableResults.length;

  return (
    <>
      {/* Progress Overlay */}
      {linkMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <Spinner size="xl" />
            <p className="mt-4 text-center text-base font-medium text-gray-900 dark:text-white">
              Linking {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""}...
            </p>
            <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
              Please wait while we process your request
            </p>
          </div>
        </div>
      )}

      <Modal show={isOpen} onClose={onClose} size="3xl">
        <ModalHeader>Link from Global Knowledge Base</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
          {/* Search Input */}
          <TextInput
            type="search"
            placeholder="Search global knowledge base... (min 3 characters)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={HiSearch}
            autoFocus
          />

          {/* Loading State */}
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">
                Searching...
              </span>
            </div>
          )}

          {/* No Query State */}
          {!searchQuery && (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
              <HiSearch className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Start typing to search
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter at least 3 characters to begin searching
              </p>
            </div>
          )}

          {/* Query Too Short */}
          {searchQuery.length > 0 && searchQuery.length < 3 && (
            <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
              <p className="text-sm">
                Enter at least 3 characters to search
              </p>
            </div>
          )}

          {/* No Results */}
          {searchQuery.length >= 3 && !isSearching && results.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
              <HiGlobeAlt className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                No results found
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Try different search terms
              </p>
            </div>
          )}

          {/* Results List */}
          {results.length > 0 && (
            <>
              {/* Select All / Deselect All */}
              {unlinkableResults.length > 0 && (
                <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {results.length} result{results.length !== 1 ? "s" : ""} found
                  </span>
                  <Button
                    size="xs"
                    color="gray"
                    onClick={allSelected ? handleDeselectAll : handleSelectAll}
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </Button>
                </div>
              )}

              <div className="max-h-96 space-y-2 overflow-y-auto">
                {results.map((item: KBSearchResult) => (
                <div
                  key={item.source_id}
                  className={`cursor-pointer rounded-lg border p-3 transition-all ${
                    selectedItems.has(item.source_id)
                      ? "border-purple-500 bg-purple-50 dark:border-purple-400 dark:bg-purple-900/20"
                      : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                  } ${item.is_linked ? "opacity-60" : ""}`}
                  onClick={() => {
                    if (!item.is_linked) {
                      handleToggleSelection(item.source_id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox Icon */}
                    <div className="mt-1">
                      {item.is_linked ? (
                        <HiCheckCircle className="h-5 w-5 text-green-500" />
                      ) : selectedItems.has(item.source_id) ? (
                        <HiCheckCircle className="h-5 w-5 text-purple-600" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {item.title}
                        </h4>
                        <KnowledgeStatusBadge type="global" size="sm" showLabel={false} />
                        {item.is_linked && (
                          <KnowledgeStatusBadge type="linked" size="sm" />
                        )}
                      </div>

                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.url}
                          <HiExternalLink className="h-3 w-3" />
                        </a>
                      )}

                      {item.content_preview && (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                          {item.content_preview}
                        </p>
                      )}

                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Type: {item.knowledge_type.replace("_", " ")}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </>
          )}

          {/* Bulk Actions Bar */}
          {selectedItems.size > 0 && (
            <div className="sticky bottom-0 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex gap-2">
                  <Button size="sm" color="gray" onClick={handleDeselectAll}>
                    Clear Selection
                  </Button>
                  <Button
                    size="sm"
                    color="purple"
                    className="bg-purple-700 hover:bg-purple-800 text-white"
                    onClick={handleLink}
                    disabled={linkMutation.isPending}
                  >
                    {linkMutation.isPending ? (
                      <>
                        <Spinner size="xs" className="mr-2" />
                        Linking...
                      </>
                    ) : (
                      <>Link Selected</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          color="purple"
          className="bg-purple-700 hover:bg-purple-800 text-white"
          onClick={handleLink}
          disabled={selectedItems.size === 0 || linkMutation.isPending}
        >
          {linkMutation.isPending ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Linking...
            </>
          ) : (
            <>Link Selected ({selectedItems.size})</>
          )}
        </Button>
        <Button color="gray" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
    </>
  );
}
