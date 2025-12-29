"use client";

import { useParams } from "next/navigation";
import { KnowledgeListView } from "./KnowledgeListView";
import { KnowledgeDetailView } from "./KnowledgeDetailView";

/**
 * KnowledgeView - Main routing component for knowledge base feature
 *
 * Routes between list and detail views based on URL params:
 * - /knowledge-base → KnowledgeListView
 * - /knowledge-base/:sourceId → KnowledgeDetailView
 */
export function KnowledgeView() {
  const params = useParams();
  const sourceId = params?.sourceId as string | undefined;

  // Route to detail view if sourceId is present
  if (sourceId) {
    return <KnowledgeDetailView sourceId={sourceId} />;
  }

  // Otherwise show list view
  return <KnowledgeListView />;
}
