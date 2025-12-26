"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HiArrowLeft, HiCheck, HiX } from "react-icons/hi";
import { useProjectStore } from "@/store/useProjectStore";
import { usePageTitle } from "@/hooks";
import { BreadCrumb } from "@/components/common/BreadCrumb";

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const {
    selectedProject,
    fetchProjectById,
    updateProject,
    isLoading,
    error,
  } = useProjectStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [saving, setSaving] = useState(false);

  usePageTitle(
    selectedProject ? `Edit ${selectedProject.title}` : "Edit Project",
    "Archon"
  );

  // Fetch project data on mount
  useEffect(() => {
    fetchProjectById(projectId);
  }, [projectId, fetchProjectById]);

  // Populate form when project data is loaded
  useEffect(() => {
    if (selectedProject) {
      setTitle(selectedProject.title || "");
      setDescription(selectedProject.description || "");
      setGithubRepo(selectedProject.github_repo || "");
    }
  }, [selectedProject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateProject(projectId, {
        title,
        description,
        github_repo: githubRepo || undefined,
      });

      // Refresh project data
      await fetchProjectById(projectId);

      // Navigate back to project detail
      router.push(`/projects/${projectId}`);
    } catch (err) {
      console.error("Error updating project:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/projects/${projectId}`);
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold">Error loading project</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => router.push("/projects")}
            className="mt-4 text-sm underline hover:no-underline"
          >
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !selectedProject) {
    return (
      <div className="p-8">
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <BreadCrumb
        items={[
          { label: "Projects", href: "/projects" },
          { label: selectedProject.title, href: `/projects/${projectId}` },
          { label: "Edit", href: `/projects/${projectId}/edit` }
        ]}
        className="mb-4"
      />

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <HiArrowLeft className="h-4 w-4" />
          Back to Project
        </button>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Edit Project
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Update project information
        </p>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          {/* Title Field */}
          <div className="mb-6">
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              Project Title *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              placeholder="Enter project title"
            />
          </div>

          {/* Description Field */}
          <div className="mb-6">
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              placeholder="Enter project description"
            />
          </div>

          {/* GitHub Repo Field */}
          <div className="mb-6">
            <label
              htmlFor="github_repo"
              className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
            >
              GitHub Repository
            </label>
            <input
              type="url"
              id="github_repo"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              placeholder="https://github.com/username/repo"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-700 dark:focus:ring-brand-800"
            >
              <HiCheck className="h-5 w-5" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
            >
              <HiX className="h-5 w-5" />
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
