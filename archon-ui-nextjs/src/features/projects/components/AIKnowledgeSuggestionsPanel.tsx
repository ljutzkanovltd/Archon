"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Spinner, Tabs } from "flowbite-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HiLightBulb,
  HiCheckCircle,
  HiGlobeAlt,
  HiExternalLink,
  HiRefresh,
  HiX,
  HiInformationCircle,
} from "react-icons/hi";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { KnowledgeStatusBadgeGroup, KnowledgeStatusType } from "./KnowledgeStatusBadge";

interface AIKnowledgeSuggestionsPanelProps {
  projectId: string;
}

interface KnowledgeSuggestion {
  knowledge_id: string;
  title: string;
  url?: string;
  content_preview?: string;
  knowledge_type: string;
  relevance_score: number;
  is_linked?: boolean;
  linked_at?: string;
  link_id?: string;
}

interface SuggestionsData {
  suggestions: KnowledgeSuggestion[];
  total: number;
  cached?: boolean;
}

/**
 * AIKnowledgeSuggestionsPanel - Enhanced AI Knowledge Suggestions with Tabs
 *
 * Features:
 * - Tabs: "Suggested" (new items) and "Already Linked" (existing links)
 * - Visual Indicators: ✅ checkmark, 💡 lightbulb, 🌐 globe
 * - Click behavior: Navigate to KB item detail
 * - Smooth transitions using Framer Motion
 * - Refresh button to invalidate cache
 */
export function AIKnowledgeSuggestionsPanel({
  projectId,
}: AIKnowledgeSuggestionsPanelProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"suggested" | "linked">("suggested");

  // Fetch suggestions with linked items
  const {
    data: suggestionsData,
    isLoading,
    error,
  } = useQuery<SuggestionsData>({
    queryKey: ["knowledge-suggestions", projectId],
    queryFn: async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("archon_token")
          : null;

      const response = await fetch(
        `http://localhost:8181/api/projects/${projectId}/knowledge/suggestions?include_linked=true`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch suggestions");
      }

      return await response.json();
    },
  });

  // Refresh suggestions mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["knowledge-suggestions", projectId],
      });
    },
    onSuccess: () => {
      toast.success("Suggestions refreshed");
    },
  });

  // Separate suggestions into tabs
  const suggestions = suggestionsData?.suggestions || [];
  const linked = suggestions.filter((s) => s.is_linked);
  const suggested = suggestions.filter((s) => !s.is_linked);

  const getRelevanceColor = (score: number): string => {
    if (score >= 0.8) return "success"; // Green: 80-100%
    if (score >= 0.6) return "info"; // Blue: 60-79%
    if (score >= 0.4) return "warning"; // Yellow: 40-59%
    return "gray"; // Gray: 0-39%
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <Spinner size="lg" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          Loading knowledge suggestions...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
        <p className="font-semibold">Error loading suggestions</p>
        <p className="text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiLightBulb className="h-6 w-6 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI Knowledge Suggestions
          </h3>
          {suggestionsData?.cached && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <HiInformationCircle className="h-3 w-3" />
              Cached
            </span>
          )}
        </div>
        <Button
          size="xs"
          color="gray"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          title="Refresh suggestions (clear cache)"
        >
          <HiRefresh
            className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        aria-label="Knowledge suggestions tabs"
        style="underline"
        onActiveTabChange={(tab) => setActiveTab(tab === 0 ? "suggested" : "linked")}
      >
        <Tabs.Item
          active={activeTab === "suggested"}
          title={
            <div className="flex items-center gap-2">
              <HiLightBulb className="h-4 w-4" />
              Suggested
              <Badge color="info" size="sm">
                {suggested.length}
              </Badge>
            </div>
          }
        >
          <AnimatePresence mode="wait">
            <motion.div
              key="suggested"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 pt-4"
            >
              {suggested.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
                  <HiLightBulb className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    No suggestions available
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Add more details to your project description to get better
                    suggestions
                  </p>
                </div>
              ) : (
                suggested.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.knowledge_id}
                    suggestion={suggestion}
                    getRelevanceColor={getRelevanceColor}
                  />
                ))
              )}
            </motion.div>
          </AnimatePresence>
        </Tabs.Item>

        <Tabs.Item
          active={activeTab === "linked"}
          title={
            <div className="flex items-center gap-2">
              <HiCheckCircle className="h-4 w-4" />
              Already Linked
              <Badge color="success" size="sm">
                {linked.length}
              </Badge>
            </div>
          }
        >
          <AnimatePresence mode="wait">
            <motion.div
              key="linked"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 pt-4"
            >
              {linked.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
                  <HiCheckCircle className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    No linked knowledge items yet
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Click "Link" on suggested items to connect them to this project
                  </p>
                </div>
              ) : (
                linked.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.knowledge_id}
                    suggestion={suggestion}
                    getRelevanceColor={getRelevanceColor}
                    isLinked={true}
                  />
                ))
              )}
            </motion.div>
          </AnimatePresence>
        </Tabs.Item>
      </Tabs>
    </div>
  );
}

// Suggestion Card Component
function SuggestionCard({
  suggestion,
  getRelevanceColor,
  isLinked = false,
}: {
  suggestion: KnowledgeSuggestion;
  getRelevanceColor: (score: number) => string;
  isLinked?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const score = Math.round(suggestion.relevance_score * 100);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isLinked ? (
              <HiCheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
            ) : (
              <HiLightBulb className="h-5 w-5 flex-shrink-0 text-purple-500" />
            )}
            <h4 className="font-medium text-gray-900 dark:text-white">
              {suggestion.title}
            </h4>
          </div>

          {/* URL */}
          {suggestion.url && (
            <a
              href={suggestion.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
              onClick={(e) => e.stopPropagation()}
            >
              {suggestion.url}
              <HiExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Preview */}
          {suggestion.content_preview && (
            <p
              className={`mt-2 text-sm text-gray-600 dark:text-gray-400 ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {suggestion.content_preview}
            </p>
          )}

          {suggestion.content_preview && suggestion.content_preview.length > 150 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-col items-end gap-2">
          <Badge color={getRelevanceColor(suggestion.relevance_score)} size="sm">
            {score}%
          </Badge>

          <KnowledgeStatusBadgeGroup
            types={
              isLinked
                ? (["global", "linked"] as KnowledgeStatusType[])
                : (["global", "suggested"] as KnowledgeStatusType[])
            }
            size="sm"
          />
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Type: {suggestion.knowledge_type.replace("_", " ")}</span>
        {isLinked && suggestion.linked_at && (
          <span>
            Linked{" "}
            {formatDistanceToNow(new Date(suggestion.linked_at), {
              addSuffix: true,
            })}
          </span>
        )}
      </div>
    </div>
  );
}
