"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Label, TextInput, Textarea, Select } from "flowbite-react";
import { HiX } from "react-icons/hi";
import { toast } from "react-hot-toast";
import { projectsApi } from "@/lib/apiClient";
import { Project } from "@/lib/types";

interface SubprojectModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentProject: Project;
  onSubprojectCreated?: (subproject: Project) => void;
}

const RELATIONSHIP_TYPES = [
  { value: "component", label: "Component" },
  { value: "module", label: "Module" },
  { value: "feature", label: "Feature" },
  { value: "epic", label: "Epic" },
  { value: "phase", label: "Phase" },
  { value: "workstream", label: "Workstream" },
];

/**
 * SubprojectModal Component
 *
 * Phase 3.3: Subproject creation modal
 *
 * Features:
 * - Create subprojects with parent-child relationship
 * - Select relationship type (component, module, feature, etc.)
 * - Inherit parent's workflow (optional)
 * - Display parent project context
 * - Validation and error handling
 *
 * Usage:
 * ```tsx
 * <SubprojectModal
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   parentProject={currentProject}
 *   onSubprojectCreated={(subproject) => {
 *     console.log("Created:", subproject);
 *     refetchHierarchy();
 *   }}
 * />
 * ```
 */
export function SubprojectModal({
  isOpen,
  onClose,
  parentProject,
  onSubprojectCreated,
}: SubprojectModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [relationshipType, setRelationshipType] = useState("component");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setDescription("");
      setRelationshipType("component");
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    } else if (title.trim().length < 3) {
      newErrors.title = "Title must be at least 3 characters";
    } else if (title.trim().length > 200) {
      newErrors.title = "Title must be less than 200 characters";
    }

    if (description.trim() && description.trim().length > 2000) {
      newErrors.description = "Description must be less than 2000 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Create subproject via POST /api/projects/{parent_id}/subprojects
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181"}/api/projects/${parentProject.id}/subprojects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            relationship_type: relationshipType,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();

        // Phase 3.15: Handle circular reference errors
        if (response.status === 400 && errorData.detail?.includes("circular")) {
          toast.error("Cannot create subproject: This would create a circular reference");
          setErrors({ title: "This relationship would create a circular reference" });
          return;
        }

        throw new Error(errorData.detail || "Failed to create subproject");
      }

      const data = await response.json();
      const newSubproject = data.project;

      toast.success(`Subproject "${newSubproject.title}" created successfully!`);

      // Call callback with new subproject
      if (onSubprojectCreated) {
        onSubprojectCreated(newSubproject);
      }

      // Close modal
      onClose();
    } catch (error: any) {
      console.error("[SubprojectModal] Error creating subproject:", error);
      toast.error(error.message || "Failed to create subproject");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={isOpen} onClose={onClose} size="lg">
      <Modal.Header>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create Subproject
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add a subproject to <span className="font-medium">{parentProject.title}</span>
            </p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Field */}
          <div>
            <Label htmlFor="subproject-title" value="Title *" />
            <TextInput
              id="subproject-title"
              type="text"
              placeholder="Enter subproject title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              color={errors.title ? "failure" : "gray"}
              helperText={errors.title}
              autoFocus
              required
            />
          </div>

          {/* Description Field */}
          <div>
            <Label htmlFor="subproject-description" value="Description" />
            <Textarea
              id="subproject-description"
              placeholder="Describe the subproject's purpose and scope"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              color={errors.description ? "failure" : "gray"}
              helperText={errors.description}
            />
          </div>

          {/* Relationship Type Field */}
          <div>
            <Label htmlFor="relationship-type" value="Relationship Type" />
            <Select
              id="relationship-type"
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value)}
            >
              {RELATIONSHIP_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Describes how this subproject relates to {parentProject.title}
            </p>
          </div>

          {/* Parent Context Info */}
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Parent Project
            </p>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">
              {parentProject.title}
            </p>
            {parentProject.description && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {parentProject.description.substring(0, 150)}
                {parentProject.description.length > 150 && "..."}
              </p>
            )}
          </div>
        </form>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex w-full justify-end gap-2">
          <Button color="gray" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleSubmit}
            disabled={isSubmitting}
            isProcessing={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Subproject"}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
