"use client";

import { Card, Badge, Button } from "flowbite-react";
import { HiFolder, HiClock, HiDocument, HiClipboardList, HiArchive, HiPencil, HiEye } from "react-icons/hi";
import { Project } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

interface ProjectCardProps {
  project: Project;
  onView?: (project: Project) => void;
  onEdit?: (project: Project) => void;
  onArchive?: (project: Project) => void;
}

/**
 * ProjectCard component following SportERP card pattern
 *
 * Features:
 * - Hover effects with shadow and background transition
 * - Metadata display (tasks, documents, dates)
 * - Action buttons (View, Edit, Archive)
 * - Badge overlay for pinned projects
 * - Responsive design
 */
export function ProjectCard({
  project,
  onView,
  onEdit,
  onArchive,
}: ProjectCardProps) {
  const formattedDate = formatDistanceToNow(new Date(project.created_at), {
    addSuffix: true,
  });

  return (
    <Card
      className="group max-w-full transition-all duration-200 hover:bg-gray-50 hover:shadow-lg dark:hover:bg-gray-700/50 md:max-w-md"
    >
      {/* Pinned Badge Overlay */}
      {project.pinned && (
        <div className="absolute right-4 top-4">
          <Badge color="warning" size="sm">
            Pinned
          </Badge>
        </div>
      )}

      {/* Header with Icon */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900">
          <HiFolder className="h-6 w-6 text-brand-600 dark:text-brand-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
            {project.title}
          </h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {project.project_type && (
              <Badge
                color="info"
                size="xs"
                style={
                  project.project_type.color
                    ? {
                        backgroundColor: project.project_type.color,
                        color: "#ffffff",
                      }
                    : undefined
                }
              >
                {project.project_type.name}
              </Badge>
            )}
            {/* Phase 3.5: Hierarchy Badges */}
            {project.has_parent && (
              <Badge color="purple" size="xs">
                Subproject
              </Badge>
            )}
            {project.children_count && project.children_count > 0 && (
              <Badge color="indigo" size="xs">
                {project.children_count} {project.children_count === 1 ? "Subproject" : "Subprojects"}
              </Badge>
            )}
            {project.archived && (
              <Badge color="gray" size="xs">
                Archived
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="mb-4 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
        {project.description || "No description available"}
      </p>

      {/* Metadata */}
      <div className="mb-4 space-y-2">
        {/* Created Date */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <HiClock className="h-4 w-4" />
          <span>Created {formattedDate}</span>
        </div>

        {/* Task Count */}
        {typeof project.task_count !== "undefined" && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <HiClipboardList className="h-4 w-4" />
            <span>
              {project.task_count} {project.task_count === 1 ? "task" : "tasks"}
            </span>
          </div>
        )}

        {/* Document Count */}
        {typeof project.document_count !== "undefined" && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <HiDocument className="h-4 w-4" />
            <span>
              {project.document_count}{" "}
              {project.document_count === 1 ? "document" : "documents"}
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
        {onView && (
          <Button
            size="xs"
            color="light"
            onClick={() => onView(project)}
            className="flex-1"
          >
            <HiEye className="mr-1 h-4 w-4" />
            View
          </Button>
        )}
        {onEdit && !project.archived && (
          <Button
            size="xs"
            color="light"
            onClick={() => onEdit(project)}
            className="flex-1"
          >
            <HiPencil className="mr-1 h-4 w-4" />
            Edit
          </Button>
        )}
        {onArchive && (
          <Button
            size="xs"
            color={project.archived ? "success" : "gray"}
            onClick={() => onArchive(project)}
            className="flex-1"
          >
            <HiArchive className="mr-1 h-4 w-4" />
            {project.archived ? "Restore" : "Archive"}
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * ProjectCardSkeleton - Loading placeholder
 */
export function ProjectCardSkeleton() {
  return (
    <Card className="max-w-full animate-pulse md:max-w-md">
      <div className="mb-4 flex items-start gap-3">
        <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
      <div className="mb-4 space-y-2">
        <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="mb-4 space-y-2">
        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-2/5 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="flex gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="h-8 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-8 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-8 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </Card>
  );
}
