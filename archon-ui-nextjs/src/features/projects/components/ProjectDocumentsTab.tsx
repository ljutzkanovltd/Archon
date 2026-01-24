"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Spinner } from "flowbite-react";
import toast from "react-hot-toast";
import {
  HiPlus,
  HiTrash,
  HiChevronUp,
  HiExternalLink,
  HiClock,
  HiLink,
} from "react-icons/hi";
import { EnhancedDocumentUpload } from "./EnhancedDocumentUpload";
import { DocumentPrivacyBadge } from "./DocumentPrivacyBadge";
import { LinkFromGlobalKBModal } from "./LinkFromGlobalKBModal";
import { LinkedKnowledgeSection } from "./LinkedKnowledgeSection";
import { formatDistanceToNow } from "date-fns";

interface ProjectDocumentsTabProps {
  projectId: string;
}

interface Document {
  source_id: string;
  source_url: string;
  title: string;
  source_display_name: string;
  is_project_private: boolean;
  promoted_to_kb_at?: string | null;
  promoted_by?: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

/**
 * ProjectDocumentsTab - Tab component for managing project documents
 *
 * Features:
 * - Upload documents (URL-based)
 * - List documents with privacy status
 * - Promote documents to global knowledge base
 * - Delete documents
 * - Expand/collapse upload form
 * - Real-time updates via React Query
 */
export function ProjectDocumentsTab({ projectId }: ProjectDocumentsTabProps) {
  const queryClient = useQueryClient();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showLinkFromKBModal, setShowLinkFromKBModal] = useState(false);

  // Fetch project documents
  const {
    data: documentsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: async () => {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("archon_token") : null;

      const response = await fetch(
        `http://localhost:8181/api/projects/${projectId}/documents?include_private=true&limit=100&project_id=${projectId}`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      return await response.json();
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("archon_token") : null;

      const response = await fetch(
        `http://localhost:8181/api/projects/${projectId}/documents/${sourceId}?project_id=${projectId}`,
        {
          method: "DELETE",
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete document");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Document deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete document");
    },
  });

  // Promote document mutation
  const promoteMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("archon_token") : null;

      const response = await fetch(
        `http://localhost:8181/api/documents/${sourceId}/promote?project_id=${projectId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            promoted_by: "User", // TODO: Get from auth store
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to promote document");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success("Document promoted to global knowledge base");
      queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to promote document");
    },
  });

  const handleUploadSuccess = () => {
    toast.success("Document uploaded successfully!");
    setShowUploadForm(false);
    queryClient.invalidateQueries({ queryKey: ["project-documents", projectId] });
  };

  const handleUploadError = (error: string) => {
    toast.error(error || "Upload failed");
  };

  const handleDelete = async (sourceId: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      await deleteMutation.mutateAsync(sourceId);
    }
  };

  const handlePromote = async (sourceId: string, title: string) => {
    if (
      confirm(
        `Promote "${title}" to global knowledge base?\n\nThis will make it visible to all projects.`
      )
    ) {
      await promoteMutation.mutateAsync(sourceId);
    }
  };

  const documents: Document[] = documentsData?.documents || [];

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="xl" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading documents...
        </span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
        <p className="font-semibold">Error loading documents</p>
        <p className="text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Project Documents
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {documents.length} document{documents.length !== 1 ? "s" : ""} in this
            project
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            color="purple"
            onClick={() => setShowLinkFromKBModal(true)}
            size="sm"
          >
            <HiLink className="mr-2 h-4 w-4" />
            Link from Global KB
          </Button>
          <Button
            color="blue"
            onClick={() => setShowUploadForm(!showUploadForm)}
            size="sm"
          >
            {showUploadForm ? (
              <>
                <HiChevronUp className="mr-2 h-4 w-4" />
                Hide Upload
              </>
            ) : (
              <>
                <HiPlus className="mr-2 h-4 w-4" />
                Upload Document
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Upload Form (collapsible) */}
      {showUploadForm && (
        <EnhancedDocumentUpload
          projectId={projectId}
          onSuccess={handleUploadSuccess}
          onError={handleUploadError}
        />
      )}

      {/* Empty State */}
      {documents.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No documents yet
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Get started by uploading your first document
          </p>
          <Button
            color="blue"
            className="mt-4"
            onClick={() => setShowUploadForm(true)}
          >
            <HiPlus className="mr-2 h-5 w-5" />
            Upload Document
          </Button>
        </div>
      )}

      {/* Documents List */}
      {documents.length > 0 && (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.source_id}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between">
                {/* Document Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {doc.title}
                    </h4>
                    <DocumentPrivacyBadge isPrivate={doc.is_project_private} />
                    {doc.promoted_to_kb_at && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Promoted by {doc.promoted_by}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    <a
                      href={doc.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {doc.source_url}
                      <HiExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <HiClock className="h-4 w-4" />
                      {formatDistanceToNow(new Date(doc.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Promote button (only for private documents) */}
                  {doc.is_project_private && !doc.promoted_to_kb_at && (
                    <Button
                      size="xs"
                      color="success"
                      onClick={() => handlePromote(doc.source_id, doc.title)}
                      disabled={promoteMutation.isPending}
                      title="Promote to global knowledge base"
                    >
                      {promoteMutation.isPending ? (
                        <Spinner size="xs" />
                      ) : (
                        <HiChevronUp className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {/* Delete button */}
                  <Button
                    size="xs"
                    color="failure"
                    onClick={() => handleDelete(doc.source_id, doc.title)}
                    disabled={deleteMutation.isPending}
                    title="Delete document"
                  >
                    {deleteMutation.isPending ? (
                      <Spinner size="xs" />
                    ) : (
                      <HiTrash className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Linked Knowledge Section */}
      <LinkedKnowledgeSection projectId={projectId} />

      {/* Link from Global KB Modal */}
      <LinkFromGlobalKBModal
        projectId={projectId}
        isOpen={showLinkFromKBModal}
        onClose={() => setShowLinkFromKBModal(false)}
        onLinked={() => {
          queryClient.invalidateQueries({
            queryKey: ["linked-knowledge", projectId],
          });
          queryClient.invalidateQueries({
            queryKey: ["knowledge-suggestions", projectId],
          });
        }}
      />
    </div>
  );
}
