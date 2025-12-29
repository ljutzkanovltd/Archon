"use client";

import { Project } from "@/lib/types";

type ProjectHeaderMode = "list" | "detail";

interface ProjectHeaderListProps {
  mode: "list";
  title?: string;
  description?: string;
}

interface ProjectHeaderDetailProps {
  mode: "detail";
  project: Project;
}

type ProjectHeaderProps = ProjectHeaderListProps | ProjectHeaderDetailProps;

/**
 * ProjectHeader - Reusable header component for projects pages
 *
 * Supports two modes:
 * - list: Display static "Projects" title and description
 * - detail: Display project title, description, and metadata
 *
 * Usage:
 * ```tsx
 * // List mode
 * <ProjectHeader mode="list" />
 *
 * // Detail mode
 * <ProjectHeader mode="detail" project={project} />
 * ```
 */
export function ProjectHeader(props: ProjectHeaderProps) {
  if (props.mode === "list") {
    return (
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          {props.title || "Projects"}
        </h1>
        {props.description && (
          <p className="text-gray-600 dark:text-gray-400">
            {props.description}
          </p>
        )}
      </div>
    );
  }

  // Detail mode
  const { project } = props;

  return (
    <div className="mb-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {project.title}
            </h1>
            {project.archived && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                Archived
              </span>
            )}
          </div>

          {project.description && (
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {project.description}
            </p>
          )}

          {/* Project Stats */}
          <div className="mt-4 flex gap-6">
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">Tasks:</span>{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {project.task_count || 0}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                Documents:
              </span>{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {project.document_count || 0}
              </span>
            </div>
            {project.github_repo && (
              <div className="text-sm">
                <a
                  href={project.github_repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  GitHub →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
