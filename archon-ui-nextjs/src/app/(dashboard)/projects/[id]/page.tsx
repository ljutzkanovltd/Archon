"use client";

import { useParams } from "next/navigation";
import { ProjectDetailView } from "@/features/projects/views/ProjectDetailView";

/**
 * Project Detail Page - Next.js page component
 *
 * Delegates to ProjectDetailView feature component for all logic and rendering.
 */
export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  return <ProjectDetailView projectId={projectId} />;
}
