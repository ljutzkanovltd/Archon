"use client";

import { ProjectsListView } from "@/features/projects/views/ProjectsListView";

/**
 * Projects Page - Next.js page component
 *
 * Delegates to ProjectsListView feature component for all logic and rendering.
 */
export default function ProjectsPage() {
  return <ProjectsListView />;
}
