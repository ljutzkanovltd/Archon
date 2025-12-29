"use client";

import { useParams } from "next/navigation";
import { ProjectsListView } from "./ProjectsListView";
import { ProjectDetailView } from "./ProjectDetailView";

/**
 * ProjectsView - Main routing component for projects feature
 *
 * Routes between list and detail views based on URL params:
 * - /projects → ProjectsListView
 * - /projects/:projectId → ProjectDetailView
 */
export function ProjectsView() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;

  // Route to detail view if projectId is present
  if (projectId) {
    return <ProjectDetailView projectId={projectId} />;
  }

  // Otherwise show list view
  return <ProjectsListView />;
}
