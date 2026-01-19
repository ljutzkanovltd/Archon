"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Label, Select, Badge, Spinner } from "flowbite-react";
import toast from "react-hot-toast";
import { HiPlus, HiX, HiOfficeBuilding } from "react-icons/hi";
import CustomModal from "@/components/common/CustomModal";
import { adminApi } from "@/lib/apiClient";
import { projectsApi } from "@/lib/apiClient";
import { UserListItem, ProjectMemberItem, UserProjectItem } from "@/lib/admin-types";

interface ManageProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserListItem | null;
}

/**
 * ManageProjectsModal - Modal for managing user project assignments
 *
 * Features:
 * - Display user's current project assignments with access levels
 * - Add user to new projects with specified access level
 * - Remove user from projects
 * - Shows user role badge (admin users have access to all projects)
 */
export function ManageProjectsModal({
  isOpen,
  onClose,
  user,
}: ManageProjectsModalProps) {
  const queryClient = useQueryClient();

  // State for adding new project
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<"owner" | "member">("member");

  // Fetch user's accessible projects
  const { data: userProjectsData, isLoading: isLoadingUserProjects } = useQuery({
    queryKey: ["admin-user-projects", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("No user selected");
      return await adminApi.getUserProjects(user.id);
    },
    enabled: isOpen && !!user?.id,
  });

  // Fetch all projects for the dropdown
  const { data: allProjectsData, isLoading: isLoadingAllProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await projectsApi.getAll();
      return response;
    },
    enabled: isOpen,
  });

  // Add user to project mutation
  const addProjectMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedProjectId) {
        throw new Error("User or project not selected");
      }
      return await adminApi.addProjectMember(selectedProjectId, {
        user_id: user.id,
        access_level: selectedAccessLevel,
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-user-projects", user?.id] });
      // Reset form
      setSelectedProjectId("");
      setSelectedAccessLevel("member");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to add user to project");
    },
  });

  // Remove user from project mutation
  const removeProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!user?.id) throw new Error("No user selected");
      return await adminApi.removeProjectMember(projectId, user.id);
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-user-projects", user?.id] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to remove user from project");
    },
  });

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }
    addProjectMutation.mutate();
  };

  const handleRemoveProject = (projectId: string, projectTitle: string) => {
    const confirmed = window.confirm(
      `Remove ${user?.full_name || user?.email} from project "${projectTitle}"?`
    );
    if (confirmed) {
      removeProjectMutation.mutate(projectId);
    }
  };

  // Get available projects (not already assigned)
  const assignedProjectIds = new Set(
    userProjectsData?.projects.map((p) => p.project_id) || []
  );
  const availableProjects = allProjectsData?.projects?.filter(
    (p) => !assignedProjectIds.has(p.id)
  ) || [];

  if (!user) return null;

  const isAdmin = userProjectsData?.is_admin || user.role === "admin";

  return (
    <CustomModal
      open={isOpen}
      close={onClose}
      title={`Manage Projects - ${user.full_name || user.email}`}
      description={
        isAdmin
          ? "This user is an admin and has access to all projects automatically."
          : "Assign this user to projects with specific access levels."
      }
      size="LARGE"
      containerClassName="p-0 flex flex-col h-full"
    >
      <div className="flex flex-col h-full">
        {/* User Info Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white font-semibold text-lg">
              {(user.full_name || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {user.full_name || user.email}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {user.email}
                </span>
                {user.role && (
                  <Badge
                    color={
                      user.role === "admin"
                        ? "failure"
                        : user.role === "member"
                        ? "info"
                        : "gray"
                    }
                  >
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 min-h-0">
          {/* Admin Notice */}
          {isAdmin && (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <p className="text-sm text-blue-800 dark:text-blue-400">
                <strong>Admin User:</strong> This user has automatic access to all projects
                with owner-level permissions. Project assignments below are for reference only.
              </p>
            </div>
          )}

          {/* Add Project Form */}
          {!isAdmin && availableProjects.length > 0 && (
            <form onSubmit={handleAddProject} className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Add to Project
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="project-select">Project</Label>
                  <Select
                    id="project-select"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    disabled={addProjectMutation.isPending}
                  >
                    <option value="">Select a project...</option>
                    {availableProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="access-level-select">Access Level</Label>
                  <Select
                    id="access-level-select"
                    value={selectedAccessLevel}
                    onChange={(e) =>
                      setSelectedAccessLevel(e.target.value as "owner" | "member")
                    }
                    disabled={addProjectMutation.isPending}
                  >
                    <option value="member">Member</option>
                    <option value="owner">Owner</option>
                  </Select>
                </div>
              </div>
              <Button
                type="submit"
                color="blue"
                size="sm"
                disabled={!selectedProjectId || addProjectMutation.isPending}
              >
                {addProjectMutation.isPending ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <HiPlus className="mr-2 h-4 w-4" />
                    Add to Project
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Current Projects List */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Current Projects ({userProjectsData?.total || 0})
            </h4>

            {isLoadingUserProjects ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : userProjectsData?.projects.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
                <HiOfficeBuilding className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  No projects assigned yet
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Use the form above to add this user to projects
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {userProjectsData?.projects.map((project) => (
                  <div
                    key={project.project_id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          {project.title}
                        </h5>
                        <Badge
                          color={project.access_level === "owner" ? "purple" : "info"}
                        >
                          {project.access_level}
                        </Badge>
                        {project.pinned && (
                          <Badge color="warning" size="xs">
                            Pinned
                          </Badge>
                        )}
                      </div>
                      {project.description && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>

                    {!isAdmin && (
                      <Button
                        color="light"
                        size="xs"
                        onClick={() =>
                          handleRemoveProject(project.project_id, project.title)
                        }
                        disabled={removeProjectMutation.isPending}
                      >
                        <HiX className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex justify-end">
            <Button color="gray" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </CustomModal>
  );
}
