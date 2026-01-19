"use client";

import { useState, useEffect } from "react";
import { HiFolder, HiFolderOpen, HiChevronRight, HiChevronDown, HiPlus } from "react-icons/hi";
import { Project } from "@/lib/types";
import { projectsApi } from "@/lib/apiClient";
import Link from "next/link";

interface ProjectHierarchyTreeProps {
  projectId: string;
  onAddSubproject?: (parentId: string) => void;
  className?: string;
}

interface HierarchyNode {
  project: Project;
  children: HierarchyNode[];
  isExpanded: boolean;
  level: number;
}

interface HierarchyData {
  parent: {
    id: string;
    title: string;
    description?: string;
    workflow_id?: string;
    relationship_type?: string;
  } | null;
  children: Array<{
    id: string;
    title: string;
    description?: string;
    workflow_id?: string;
    relationship_type?: string;
    task_count?: number;
  }>;
  ancestors: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
  siblings: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
  children_count: number;
  siblings_count: number;
}

/**
 * ProjectHierarchyTree Component
 *
 * Phase 3.1: Display project hierarchy in tree view
 *
 * Features:
 * - Expandable/collapsible tree nodes
 * - Shows parent, current, children, and siblings
 * - Breadcrumb-style ancestor path
 * - Add subproject buttons for each node
 * - Visual indentation for hierarchy levels
 * - Clickable project links
 *
 * @example
 * ```tsx
 * <ProjectHierarchyTree
 *   projectId={project.id}
 *   onAddSubproject={(parentId) => setShowSubprojectModal(true)}
 * />
 * ```
 */
export function ProjectHierarchyTree({
  projectId,
  onAddSubproject,
  className = "",
}: ProjectHierarchyTreeProps) {
  const [hierarchyData, setHierarchyData] = useState<HierarchyData | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([projectId]));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHierarchy();
  }, [projectId]);

  const loadHierarchy = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await projectsApi.getProjectHierarchy(projectId);
      setHierarchyData(data);
    } catch (err) {
      console.error("[ProjectHierarchyTree] Error loading hierarchy:", err);
      setError(err instanceof Error ? err.message : "Failed to load hierarchy");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const renderProjectNode = (
    project: { id: string; title: string; task_count?: number; relationship_type?: string },
    level: number,
    isCurrent: boolean = false,
    hasChildren: boolean = false
  ) => {
    const isExpanded = expandedNodes.has(project.id);
    const indent = level * 24; // 24px per level

    return (
      <div key={project.id} className="group">
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
            isCurrent
              ? "bg-brand-100 dark:bg-brand-900/30"
              : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
          }`}
          style={{ paddingLeft: `${indent + 12}px` }}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren && (
            <button
              onClick={() => toggleNode(project.id)}
              className="flex-shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <HiChevronDown className="h-4 w-4" />
              ) : (
                <HiChevronRight className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Folder Icon */}
          <div className="flex-shrink-0">
            {isExpanded ? (
              <HiFolderOpen className={`h-5 w-5 ${isCurrent ? "text-brand-600" : "text-gray-500"}`} />
            ) : (
              <HiFolder className={`h-5 w-5 ${isCurrent ? "text-brand-600" : "text-gray-500"}`} />
            )}
          </div>

          {/* Project Title */}
          <Link
            href={`/projects/${project.id}`}
            className={`flex-1 truncate text-sm font-medium transition-colors ${
              isCurrent
                ? "text-brand-700 dark:text-brand-400"
                : "text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
            }`}
          >
            {project.title}
            {isCurrent && <span className="ml-2 text-xs text-gray-500">(current)</span>}
          </Link>

          {/* Task Count Badge */}
          {typeof project.task_count !== "undefined" && (
            <span className="flex-shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {project.task_count} {project.task_count === 1 ? "task" : "tasks"}
            </span>
          )}

          {/* Relationship Type Badge */}
          {project.relationship_type && !isCurrent && (
            <span className="flex-shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {project.relationship_type}
            </span>
          )}

          {/* Add Subproject Button */}
          {onAddSubproject && (
            <button
              onClick={() => onAddSubproject(project.id)}
              className="flex-shrink-0 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100 dark:hover:bg-gray-600 dark:hover:text-gray-200"
              aria-label="Add subproject"
              title="Add subproject"
            >
              <HiPlus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"></div>
          <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">Loading hierarchy...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400 ${className}`}>
        <p className="font-semibold">Error loading hierarchy</p>
        <p>{error}</p>
        <button
          onClick={loadHierarchy}
          className="mt-2 text-xs underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!hierarchyData) {
    return null;
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Project Hierarchy
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {hierarchyData.children_count} {hierarchyData.children_count === 1 ? "subproject" : "subprojects"}
          {hierarchyData.parent && " · 1 parent"}
          {hierarchyData.siblings_count > 0 && ` · ${hierarchyData.siblings_count} ${hierarchyData.siblings_count === 1 ? "sibling" : "siblings"}`}
        </p>
      </div>

      {/* Hierarchy Tree */}
      <div className="p-2">
        {/* Ancestors (Breadcrumb Path) */}
        {hierarchyData.ancestors && hierarchyData.ancestors.length > 0 && (
          <div className="mb-2 px-2">
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              {hierarchyData.ancestors.map((ancestor, index) => (
                <span key={ancestor.id} className="flex items-center gap-1">
                  {index > 0 && <HiChevronRight className="h-3 w-3" />}
                  <Link
                    href={`/projects/${ancestor.id}`}
                    className="hover:text-brand-600 hover:underline dark:hover:text-brand-400"
                  >
                    {ancestor.title}
                  </Link>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Parent */}
        {hierarchyData.parent && (
          <div className="mb-1">
            {renderProjectNode(hierarchyData.parent, 0, false, false)}
          </div>
        )}

        {/* Current Project */}
        {renderProjectNode(
          { id: projectId, title: "Current Project", task_count: undefined },
          hierarchyData.parent ? 1 : 0,
          true,
          hierarchyData.children.length > 0
        )}

        {/* Children */}
        {expandedNodes.has(projectId) && hierarchyData.children.length > 0 && (
          <div className="mt-1 space-y-1">
            {hierarchyData.children.map((child) =>
              renderProjectNode(child, hierarchyData.parent ? 2 : 1, false, false)
            )}
          </div>
        )}

        {/* Siblings */}
        {hierarchyData.siblings && hierarchyData.siblings.length > 0 && (
          <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
            <p className="mb-1 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
              Sibling Projects
            </p>
            <div className="space-y-1">
              {hierarchyData.siblings.map((sibling) =>
                renderProjectNode(sibling, hierarchyData.parent ? 1 : 0, false, false)
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!hierarchyData.parent && hierarchyData.children.length === 0 && hierarchyData.siblings.length === 0 && (
          <div className="py-6 text-center">
            <HiFolder className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No hierarchy relationships
            </p>
            {onAddSubproject && (
              <button
                onClick={() => onAddSubproject(projectId)}
                className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Add Subproject
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
