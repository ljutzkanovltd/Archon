"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge, Spinner, Button, Modal } from "flowbite-react";
import {
  HiGlobeAlt,
  HiCheckCircle,
  HiExternalLink,
  HiClock,
  HiX,
} from "react-icons/hi";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import { KnowledgeStatusBadgeGroup } from "./KnowledgeStatusBadge";

interface LinkedKnowledgeSectionProps {
  projectId: string;
}

interface LinkedKBItem {
  link_id: string;
  source_id: string;
  title: string;
  url?: string;
  content_preview?: string;
  knowledge_type: string;
  relevance_score: number;
  linked_at: string;
  linked_by: string;
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
            <LinkedKBCard key={item.link_id} item={item} projectId={projectId} />
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
        `http://localhost:8181/api/projects/${projectId}/knowledge/sources/${item.source_id}/link`,
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
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <HiCheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
              <h4 className="font-medium text-gray-900 dark:text-white">
                {item.title}
              </h4>
            </div>

          {/* URL */}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {item.url}
              <HiExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Preview */}
          {item.content_preview && (
            <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
              {item.content_preview}
            </p>
          )}
        </div>

        {/* Badges & Unlink Button */}
        <div className="flex flex-col items-end gap-2">
          <Button
            size="xs"
            color="failure"
            onClick={() => setShowUnlinkModal(true)}
            disabled={unlinkMutation.isPending}
            title="Unlink from project"
          >
            <HiX className="h-3 w-3" />
          </Button>

          <Badge color={getRelevanceColor(score)} size="sm">
            {score}%
          </Badge>

          <KnowledgeStatusBadgeGroup types={["global", "linked"]} size="sm" />
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <span>Type: {item.knowledge_type.replace("_", " ")}</span>
        <span className="flex items-center gap-1">
          <HiClock className="h-3 w-3" />
          Linked{" "}
          {formatDistanceToNow(new Date(item.linked_at), {
            addSuffix: true,
          })}
        </span>
      </div>

      {item.linked_by && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          by {item.linked_by}
        </div>
      )}
    </div>

    {/* Unlink Confirmation Modal */}
    <Modal show={showUnlinkModal} onClose={() => setShowUnlinkModal(false)} size="md">
      <Modal.Header>Unlink Knowledge Item?</Modal.Header>
      <Modal.Body>
        <div className="space-y-4">
          <p className="text-base text-gray-900 dark:text-white">
            Are you sure you want to unlink <strong>"{item.title}"</strong> from this project?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This won't delete the knowledge item from the global knowledge base, it will just remove the link to this project.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer>
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
      </Modal.Footer>
    </Modal>
  </>
  );
}
