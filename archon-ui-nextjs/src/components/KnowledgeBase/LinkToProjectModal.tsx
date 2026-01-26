"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  TextInput,
  Button,
  Spinner,
  Badge,
} from "flowbite-react";
import {
  HiSearch,
  HiCheckCircle,
  HiFolder,
  HiExternalLink,
} from "react-icons/hi";
import toast from "react-hot-toast";
import { KnowledgeSource } from "@/lib/types";

interface LinkToProjectModalProps {
  source: KnowledgeSource | null;
  isOpen: boolean;
  onClose: () => void;
  onLinked: () => void;
}

interface ProjectSearchResult {
  id: string;
  title: string;
  description?: string;
  archived: boolean;
  is_linked?: boolean; // Whether this KB item is already linked to this project
}

/**
 * LinkToProjectModal - Modal for linking a KB item to multiple projects
 *
 * Reverse of LinkFromGlobalKBModal - used from Knowledge Base page.
 *
 * Features:
 * - Search/filter projects
 * - Multi-select projects
 * - Show already-linked projects with checkmark
 * - Bulk link to selected projects
 * - Loading states and error handling
 * - Success/error toasts
 */
export function LinkToProjectModal({
  source,
  isOpen,
  onClose,
  onLinked,
}: LinkToProjectModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

  // Fetch all projects with link status for this source
  const {
    data: projectsData,
    isLoading: isLoadingProjects,
  } = useQuery({
    queryKey: ["projects-for-linking", source?.source_id, searchQuery],
    queryFn: async () => {
      if (!source) return { projects: [] };

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("archon_token")
          : null;

      // Fetch all projects
      const projectsResponse = await fetch(
        `http://localhost:8181/api/projects?per_page=100`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      if (!projectsResponse.ok) {
        throw new Error("Failed to fetch projects");
      }

      const projectsJson = await projectsResponse.json();
      const allProjects = projectsJson.items || projectsJson || [];

      // Fetch which projects already link this source (backlinks)
      const backlinksResponse = await fetch(
        `http://localhost:8181/api/knowledge/sources/${source.source_id}/projects`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      let linkedProjectIds = new Set<string>();
      if (backlinksResponse.ok) {
        const backlinksJson = await backlinksResponse.json();
        const backlinks = backlinksJson.projects || [];
        linkedProjectIds = new Set(backlinks.map((p: any) => p.project_id));
      }

      // Merge link status into projects
      const projectsWithLinkStatus = allProjects.map((project: any) => ({
        id: project.id,
        title: project.title,
        description: project.description,
        archived: project.archived || false,
        is_linked: linkedProjectIds.has(project.id),
      }));

      // Filter by search query (client-side for simplicity)
      if (searchQuery.length >= 2) {
        const lowerQuery = searchQuery.toLowerCase();
        return {
          projects: projectsWithLinkStatus.filter(
            (p: ProjectSearchResult) =>
              p.title.toLowerCase().includes(lowerQuery) ||
              (p.description && p.description.toLowerCase().includes(lowerQuery))
          ),
        };
      }

      return { projects: projectsWithLinkStatus };
    },
    enabled: isOpen && !!source,
  });

  // Link mutation - link source to multiple projects
  const linkMutation = useMutation({
    mutationFn: async (projectIds: string[]) => {
      if (!source) throw new Error("No source selected");

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("archon_token")
          : null;

      // Link to all selected projects with Promise.allSettled
      const results = await Promise.allSettled(
        projectIds.map((projectId) =>
          fetch(
            `http://localhost:8181/api/projects/${projectId}/knowledge/sources/${source.source_id}/link`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: `Bearer ${token}` }),
              },
              body: JSON.stringify({
                linked_by: "User",
                relevance_score: 1.0, // Manual link = 100% relevance
              }),
            }
          ).then((res) => {
            if (!res.ok) {
              throw new Error(`Failed to link to project ${projectId}`);
            }
            return res.json();
          })
        )
      );

      // Count successes and failures
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      return { succeeded, failed, total: projectIds.length };
    },
    onSuccess: ({ succeeded, failed, total }) => {
      if (failed === 0) {
        toast.success(
          `Successfully linked to ${succeeded} project${succeeded > 1 ? "s" : ""}`
        );
      } else {
        toast.warning(
          `Linked to ${succeeded}/${total} projects (${failed} failed)`
        );
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ["projects-for-linking", source?.source_id],
      });

      setSelectedProjects(new Set());
      setSearchQuery("");
      onLinked();
      onClose();
    },
    onError: () => {
      toast.error("Bulk link operation failed");
    },
  });

  const handleToggleSelection = (projectId: string) => {
    const newSet = new Set(selectedProjects);
    if (newSet.has(projectId)) {
      newSet.delete(projectId);
    } else {
      newSet.add(projectId);
    }
    setSelectedProjects(newSet);
  };

  const handleSelectAll = () => {
    const unlinkableProjects = projects.filter((p: ProjectSearchResult) => !p.is_linked && !p.archived);
    const allIds = new Set(unlinkableProjects.map((p: ProjectSearchResult) => p.id));
    setSelectedProjects(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedProjects(new Set());
  };

  const handleLink = () => {
    if (selectedProjects.size === 0) return;
    linkMutation.mutate(Array.from(selectedProjects));
  };

  const projects = projectsData?.projects || [];
  const unlinkableProjects = projects.filter((p: ProjectSearchResult) => !p.is_linked && !p.archived);
  const allSelected = unlinkableProjects.length > 0 && selectedProjects.size === unlinkableProjects.length;

  return (
    <>
      {/* Progress Overlay */}
      {linkMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <Spinner size="xl" />
            <p className="mt-4 text-center text-base font-medium text-gray-900 dark:text-white">
              Linking to {selectedProjects.size} project{selectedProjects.size !== 1 ? "s" : ""}...
            </p>
            <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
              Please wait while we process your request
            </p>
          </div>
        </div>
      )}

      <Modal show={isOpen} onClose={onClose} size="3xl">
        <Modal.Header>
          Link to Project
          {source && (
            <p className="mt-2 text-sm font-normal text-gray-600 dark:text-gray-400">
              Linking: <span className="font-medium text-gray-900 dark:text-white">{source.title}</span>
            </p>
          )}
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {/* Search Input */}
            <TextInput
              type="search"
              placeholder="Search projects... (min 2 characters)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={HiSearch}
              autoFocus
            />

            {/* Loading State */}
            {isLoadingProjects && (
              <div className="flex items-center justify-center py-8">
                <Spinner size="lg" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">
                  Loading projects...
                </span>
              </div>
            )}

            {/* No Projects State */}
            {!isLoadingProjects && projects.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
                <HiFolder className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {searchQuery.length >= 2 ? "No projects found" : "No projects available"}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {searchQuery.length >= 2 ? "Try different search terms" : "Create a project first"}
                </p>
              </div>
            )}

            {/* Projects List */}
            {projects.length > 0 && (
              <>
                {/* Select All / Deselect All */}
                {unlinkableProjects.length > 0 && (
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {projects.length} project{projects.length !== 1 ? "s" : ""} found
                      {projects.filter((p: ProjectSearchResult) => p.is_linked).length > 0 && (
                        <span className="ml-2 text-xs">
                          ({projects.filter((p: ProjectSearchResult) => p.is_linked).length} already linked)
                        </span>
                      )}
                    </span>
                    <Button
                      size="xs"
                      color="gray"
                      onClick={allSelected ? handleDeselectAll : handleSelectAll}
                    >
                      {allSelected ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                )}

                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {projects.map((project: ProjectSearchResult) => (
                    <div
                      key={project.id}
                      className={`cursor-pointer rounded-lg border p-3 transition-all ${
                        selectedProjects.has(project.id)
                          ? "border-purple-500 bg-purple-50 dark:border-purple-400 dark:bg-purple-900/20"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                      } ${project.is_linked || project.archived ? "opacity-60" : ""}`}
                      onClick={() => {
                        if (!project.is_linked && !project.archived) {
                          handleToggleSelection(project.id);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox Icon */}
                        <div className="mt-1">
                          {project.is_linked ? (
                            <HiCheckCircle className="h-5 w-5 text-green-500" />
                          ) : project.archived ? (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300 bg-gray-100" />
                          ) : selectedProjects.has(project.id) ? (
                            <HiCheckCircle className="h-5 w-5 text-purple-600" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-400" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {project.title}
                            </h4>
                            {project.is_linked && (
                              <Badge color="success" size="sm">
                                Already Linked
                              </Badge>
                            )}
                            {project.archived && (
                              <Badge color="gray" size="sm">
                                Archived
                              </Badge>
                            )}
                          </div>

                          {project.description && (
                            <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Bulk Actions Bar */}
            {selectedProjects.size > 0 && (
              <div className="sticky bottom-0 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                    {selectedProjects.size} project{selectedProjects.size !== 1 ? "s" : ""} selected
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" color="gray" onClick={handleDeselectAll}>
                      Clear Selection
                    </Button>
                    <Button
                      size="sm"
                      color="purple"
                      onClick={handleLink}
                      disabled={linkMutation.isPending}
                    >
                      {linkMutation.isPending ? (
                        <>
                          <Spinner size="xs" className="mr-2" />
                          Linking...
                        </>
                      ) : (
                        <>Link Selected</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="purple"
            onClick={handleLink}
            disabled={selectedProjects.size === 0 || linkMutation.isPending}
          >
            {linkMutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Linking...
              </>
            ) : (
              <>Link to {selectedProjects.size} Project{selectedProjects.size !== 1 ? "s" : ""}</>
            )}
          </Button>
          <Button color="gray" onClick={onClose}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
