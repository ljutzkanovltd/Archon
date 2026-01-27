import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "@/lib/apiClient";

export interface ProjectHierarchy {
  project: {
    id: string;
    title: string;
    description: string | null;
    workflow_id: string | null;
  };
  parent: {
    id: string;
    title: string;
    relationship_type: string;
  } | null;
  children: Array<{
    id: string;
    title: string;
    description: string | null;
    workflow_id: string | null;
    relationship_type: string;
  }>;
  siblings: Array<{
    id: string;
    title: string;
    relationship_type: string;
  }>;
  children_count: number;
  siblings_count: number;
}

/**
 * Hook to fetch project hierarchy (parent, children, siblings)
 */
export function useProjectHierarchy(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["projects", projectId, "hierarchy"],
    queryFn: async () => {
      if (!projectId) return null;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181"}/api/projects/${projectId}/hierarchy`);
      if (!response.ok) {
        throw new Error("Failed to fetch project hierarchy");
      }
      return response.json() as Promise<ProjectHierarchy>;
    },
    enabled: enabled && !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

/**
 * Build hierarchical tree structure from flat project list
 */
export function buildProjectTree(
  projects: Array<{ id: string; title: string; [key: string]: any }>
): Array<ProjectTreeNode> {
  // First pass: Create a map of all projects
  const projectMap = new Map<string, ProjectTreeNode>();
  const rootProjects: ProjectTreeNode[] = [];

  projects.forEach((project) => {
    projectMap.set(project.id, {
      id: project.id,
      title: project.title,
      project: project,
      children: [],
      parent_id: null,
      has_children: false,
      is_expanded: false,
    });
  });

  // Second pass: Fetch hierarchy for each project and build tree
  // NOTE: This is a simplified version. For production, we'd want to:
  // 1. Batch fetch hierarchies
  // 2. Cache results
  // 3. Use websocket for real-time updates

  // For now, we'll just return a flat structure
  // The Sidebar component will handle fetching children on-demand
  projects.forEach((project) => {
    const node = projectMap.get(project.id);
    if (node) {
      rootProjects.push(node);
    }
  });

  return rootProjects;
}

export interface ProjectTreeNode {
  id: string;
  title: string;
  project: any;
  children: ProjectTreeNode[];
  parent_id: string | null;
  has_children: boolean;
  is_expanded: boolean;
}
