"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Badge, Button, Spinner } from "flowbite-react";
import { HiLightBulb, HiPlus, HiExternalLink, HiCheck } from "react-icons/hi";
import { knowledgeLinksApi } from "@/lib/apiClient";
import { toast } from "react-hot-toast";

interface KnowledgeSuggestionsPanelProps {
  sourceType: "project" | "task";
  sourceId: string;
  projectId: string;
  limit?: number;
  className?: string;
}

/**
 * KnowledgeSuggestionsPanel - Display AI-powered knowledge suggestions
 *
 * Features:
 * - Fetch AI-suggested knowledge items based on context
 * - Display relevance scores with color-coded badges
 * - Preview content with expandable sections
 * - One-click linking of suggestions
 * - Shows linked status for already-linked items
 * - Cached results indicator
 *
 * Usage:
 * ```tsx
 * <KnowledgeSuggestionsPanel
 *   sourceType="project"
 *   sourceId={projectId}
 *   projectId={projectId}
 *   limit={5}
 * />
 * ```
 */
export function KnowledgeSuggestionsPanel({
  sourceType,
  sourceId,
  projectId,
  limit = 5,
  className = "",
}: KnowledgeSuggestionsPanelProps) {
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch suggestions
  const {
    data: suggestionsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["knowledge-suggestions", sourceType, sourceId, limit],
    queryFn: async () => {
      if (sourceType === "project") {
        return await knowledgeLinksApi.getProjectSuggestions(sourceId, limit);
      } else {
        return await knowledgeLinksApi.getTaskSuggestions(
          sourceId,
          projectId,
          limit
        );
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour (matches backend cache)
  });

  // Fetch already linked knowledge
  const { data: linkedData } = useQuery({
    queryKey: ["knowledge-links", sourceType, sourceId],
    queryFn: async () => {
      if (sourceType === "project") {
        return await knowledgeLinksApi.getProjectKnowledge(sourceId);
      } else {
        return await knowledgeLinksApi.getTaskKnowledge(sourceId, projectId);
      }
    },
  });

  // Link suggestion mutation
  const linkMutation = useMutation({
    mutationFn: async ({
      knowledgeType,
      knowledgeId,
      relevanceScore,
    }: {
      knowledgeType: string;
      knowledgeId: string;
      relevanceScore: number;
    }) => {
      if (sourceType === "project") {
        return await knowledgeLinksApi.linkToProject(sourceId, {
          knowledge_type: knowledgeType,
          knowledge_id: knowledgeId,
          relevance_score: relevanceScore,
        });
      } else {
        return await knowledgeLinksApi.linkToTask(sourceId, projectId, {
          knowledge_type: knowledgeType,
          knowledge_id: knowledgeId,
          relevance_score: relevanceScore,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["knowledge-links", sourceType, sourceId],
      });
      toast.success("Knowledge item linked successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to link knowledge item");
    },
  });

  const handleToggleExpand = (knowledgeId: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(knowledgeId)) {
        newSet.delete(knowledgeId);
      } else {
        newSet.add(knowledgeId);
      }
      return newSet;
    });
  };

  const handleLink = (
    knowledgeType: string,
    knowledgeId: string,
    relevanceScore: number
  ) => {
    linkMutation.mutate({ knowledgeType, knowledgeId, relevanceScore });
  };

  // Check if knowledge item is already linked
  const isLinked = (knowledgeId: string): boolean => {
    return (
      linkedData?.links?.some(
        (link) => link.knowledge_id === knowledgeId
      ) || false
    );
  };

  // Get relevance badge color
  const getRelevanceBadgeColor = (score: number): string => {
    if (score >= 0.8) return "success";
    if (score >= 0.6) return "info";
    if (score >= 0.4) return "warning";
    return "gray";
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <div className="text-center py-8">
          <p className="text-red-600 dark:text-red-400">
            Failed to load suggestions
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {(error as Error).message}
          </p>
        </div>
      </Card>
    );
  }

  const suggestions = suggestionsData?.suggestions || [];

  return (
    <Card className={className}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <HiLightBulb className="h-6 w-6 text-yellow-500" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI Knowledge Suggestions
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {suggestions.length} relevant items found
            {suggestionsData?.cached && (
              <span className="ml-2 text-xs">(cached)</span>
            )}
          </p>
        </div>
      </div>

      {/* Suggestions List */}
      {suggestions.length === 0 ? (
        <div className="text-center py-8">
          <HiLightBulb className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            No relevant knowledge items found
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Try adding more details to get better suggestions
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion) => {
            const linked = isLinked(suggestion.knowledge_id);
            const expanded = expandedIds.has(suggestion.knowledge_id);

            return (
              <div
                key={suggestion.knowledge_id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                {/* Suggestion Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {suggestion.title}
                      </h4>
                      <Badge
                        color={getRelevanceBadgeColor(
                          suggestion.relevance_score
                        )}
                        size="sm"
                      >
                        {Math.round(suggestion.relevance_score * 100)}%
                      </Badge>
                      {linked && (
                        <Badge color="success" size="sm">
                          <HiCheck className="mr-1 h-3 w-3" />
                          Linked
                        </Badge>
                      )}
                    </div>

                    {suggestion.url && (
                      <a
                        href={suggestion.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        <span className="truncate">{suggestion.url}</span>
                        <HiExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    )}

                    {/* Content Preview */}
                    {suggestion.content_preview && (
                      <div className="mt-2">
                        <p
                          className={`text-sm text-gray-600 dark:text-gray-400 ${
                            expanded ? "" : "line-clamp-2"
                          }`}
                        >
                          {suggestion.content_preview}
                        </p>
                        {suggestion.content_preview.length > 150 && (
                          <button
                            onClick={() =>
                              handleToggleExpand(suggestion.knowledge_id)
                            }
                            className="mt-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {expanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Link Button */}
                  <Button
                    size="xs"
                    color={linked ? "gray" : "blue"}
                    disabled={linked || linkMutation.isPending}
                    onClick={() =>
                      handleLink(
                        suggestion.knowledge_type,
                        suggestion.knowledge_id,
                        suggestion.relevance_score
                      )
                    }
                  >
                    {linkMutation.isPending ? (
                      <Spinner size="xs" className="mr-1" />
                    ) : linked ? (
                      <HiCheck className="mr-1 h-3 w-3" />
                    ) : (
                      <HiPlus className="mr-1 h-3 w-3" />
                    )}
                    {linked ? "Linked" : "Link"}
                  </Button>
                </div>

                {/* Metadata */}
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="capitalize">{suggestion.knowledge_type.replace("_", " ")}</span>
                  <span>•</span>
                  <span>Source ID: {suggestion.source_id.substring(0, 8)}...</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
