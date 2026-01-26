"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge, Spinner, Button, Modal, ModalHeader, ModalBody, ModalFooter } from "flowbite-react";
import {
  HiGlobeAlt,
  HiCheckCircle,
  HiExternalLink,
  HiClock,
  HiX,
  HiDocumentText,
} from "react-icons/hi";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { KnowledgeStatusBadgeGroup } from "./KnowledgeStatusBadge";

interface LinkedKnowledgeSectionProps {
  projectId: string;
}

interface LinkedKBItem {
  id: string;  // Link ID from archon_knowledge_links table
  source_id: string;  // Project ID (not used for delete)
  knowledge_type: string;
  knowledge_id: string;  // Page UUID
  relevance_score: number;
  created_at: string;
  created_by: string;
  knowledge_item: {  // Nested knowledge item details
    source_id: string;  // THIS is the knowledge source ID we need for delete
    title: string;
    url?: string;
    content?: string;
    content_preview?: string;
    page_count?: number;  // Number of pages aggregated (for RAG sources)
    avg_relevance?: number;  // Average relevance across all pages
    max_relevance?: number;  // Maximum relevance score
    [key: string]: any;
  };
}

/**
 * LinkedKnowledgeSection - Show all globally-linked KB items in a dedicated section
 *
 * Features:
 * - List of linked items with title, preview, linked date
 * - Visual badges: 🌐 Global, ✅ Linked
 * - Actions: View detail, Unlink (Phase 2)
 * - Empty state: "No linked knowledge items. Click 'Link from Global KB' to get started."
 * - Refresh on link/unlink
 */
export function LinkedKnowledgeSection({
  projectId,
}: LinkedKnowledgeSectionProps) {
  const {
    data: linkedKB,
    isLoading,
    error,
  } = useQuery<{ links: LinkedKBItem[]; count: number }>({
    queryKey: ["linked-knowledge", projectId],
    queryFn: async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("archon_token")
          : null;

      const response = await fetch(
        `http://localhost:8181/api/projects/${projectId}/knowledge`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch linked knowledge");
      }

      return await response.json();
    },
  });

  const links = linkedKB?.links || [];

  if (isLoading) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex h-32 items-center justify-center">
          <Spinner size="lg" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading linked knowledge...
          </span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
        <p className="font-semibold">Error loading linked knowledge</p>
        <p className="text-sm">{(error as Error).message}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <HiGlobeAlt className="h-6 w-6 text-cyan-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Linked Global Knowledge
          </h3>
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {links.length} item{links.length !== 1 ? "s" : ""} linked to this
          project
        </p>
      </header>

      {/* Empty State */}
      {links.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-600">
          <div className="flex justify-center">
            <HiGlobeAlt className="h-16 w-16 text-gray-400" />
          </div>
          <h4 className="mt-4 text-base font-medium text-gray-900 dark:text-white">
            No linked knowledge items
          </h4>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Click "Link from Global KB" to connect relevant knowledge to this
            project.
          </p>
        </div>
      ) : (
        /* Linked Items Grid */
        <div className="grid gap-4 md:grid-cols-2">
          {links.map((item) => (
            <LinkedKBCard key={item.id} item={item} projectId={projectId} />
          ))}
        </div>
      )}
    </section>
  );
}

// Linked KB Card Component
function LinkedKBCard({ item, projectId }: { item: LinkedKBItem; projectId: string }) {
  const queryClient = useQueryClient();
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const score = Math.round(item.relevance_score * 100);

  const getRelevanceColor = (score: number): string => {
    if (score >= 80) return "success"; // Green: 80-100%
    if (score >= 60) return "info"; // Blue: 60-79%
    if (score >= 40) return "warning"; // Yellow: 40-59%
    return "gray"; // Gray: 0-39%
  };

  // Unlink mutation
  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("archon_token")
          : null;

      const response = await fetch(
        `http://localhost:8181/api/projects/${projectId}/knowledge/sources/${item.knowledge_item.source_id}/link`,
        {
          method: "DELETE",
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to unlink knowledge item");
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Knowledge item unlinked successfully");
      queryClient.invalidateQueries({ queryKey: ["linked-knowledge", projectId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions", projectId] });
      setShowUnlinkModal(false);
    },
    onError: () => {
      toast.error("Failed to unlink knowledge item");
    },
  });

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
        {/* Header Row: Icon + Title + Badges + Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              <HiDocumentText className="h-5 w-5 text-cyan-500" />
            </div>

            {/* Title + URL */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white truncate">
                {item.knowledge_item.title}
              </h4>

              {/* URL */}
              {item.knowledge_item.url && (
                <a
                  href={item.knowledge_item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="truncate">{item.knowledge_item.url}</span>
                  <HiExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              )}
            </div>
          </div>

          {/* Right Side: Badges + Unlink Button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Relevance Score Badge */}
            <Badge color={getRelevanceColor(score)} size="sm">
              {score}%
            </Badge>

            {/* Status Badges */}
            <KnowledgeStatusBadgeGroup types={["global", "linked"]} size="sm" />

            {/* Unlink Button */}
            <Button
              size="xs"
              color="failure"
              onClick={() => setShowUnlinkModal(true)}
              disabled={unlinkMutation.isPending}
              title="Unlink from project"
            >
              <HiX className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content Preview / Page Count */}
        <div className="mt-3">
          {item.knowledge_item.page_count ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {item.knowledge_item.page_count} pages
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                linked from this source
              </span>
            </div>
          ) : item.knowledge_item.content_preview ? (
            <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
              {item.knowledge_item.content_preview}
            </p>
          ) : null}
        </div>

        {/* Metadata Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="font-medium">Type:</span> {item.knowledge_type.replace("_", " ")}
            </span>
            {item.created_by && (
              <span className="flex items-center gap-1">
                <span className="font-medium">Linked by:</span> {item.created_by}
              </span>
            )}
          </div>

          <span className="flex items-center gap-1">
            <HiClock className="h-3 w-3" />
            {formatDistanceToNow(new Date(item.created_at), {
              addSuffix: true,
            })}
          </span>
        </div>
      </div>

      {/* Unlink Confirmation Modal */}
      <Modal show={showUnlinkModal} onClose={() => setShowUnlinkModal(false)} size="md">
        <ModalHeader>Unlink Knowledge Item?</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-base text-gray-900 dark:text-white">
              Are you sure you want to unlink <strong>"{item.knowledge_item.title}"</strong> from this project?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This won't delete the knowledge item from the global knowledge base, it will just remove the link to this project.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="failure"
            onClick={() => unlinkMutation.mutate()}
            disabled={unlinkMutation.isPending}
          >
            {unlinkMutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Unlinking...
              </>
            ) : (
              "Unlink"
            )}
          </Button>
          <Button color="gray" onClick={() => setShowUnlinkModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
