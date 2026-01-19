import React from 'react';
import { Label, Select, HelperText } from 'flowbite-react';
import { useProjectTypes } from '../hooks/useWorkflowQueries';

/**
 * ProjectTypeSelector Component
 * Phase 2.9: Dynamic project type selector
 *
 * Provides a dropdown to select a project type during project creation/editing.
 * Each project type has a default workflow associated with it.
 *
 * Features:
 * - Fetches all available project types
 * - Displays project type name and description
 * - Shows loading/error/empty states
 * - Supports controlled component pattern
 * - Accessible with Label and helper text
 * - Optional selection (allows "None")
 *
 * Usage:
 * ```tsx
 * <ProjectTypeSelector
 *   value={project.project_type_id}
 *   onChange={(typeId) => setProject({ ...project, project_type_id: typeId })}
 *   label="Project Type"
 *   required
 * />
 * ```
 */

export interface ProjectTypeSelectorProps {
  /**
   * Currently selected project type ID
   */
  value?: string;

  /**
   * Callback when project type selection changes
   */
  onChange: (projectTypeId: string | undefined) => void;

  /**
   * Label text for the selector
   * @default "Project Type"
   */
  label?: string;

  /**
   * Helper text displayed below the selector
   */
  helperText?: string;

  /**
   * Whether the field is required
   * @default false
   */
  required?: boolean;

  /**
   * Whether the selector is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Show "None" option to allow clearing selection
   * @default true
   */
  allowNone?: boolean;
}

export function ProjectTypeSelector({
  value,
  onChange,
  label = 'Project Type',
  helperText,
  required = false,
  disabled = false,
  allowNone = true,
}: ProjectTypeSelectorProps) {
  const { data, isLoading, error } = useProjectTypes();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    onChange(selectedValue === '' ? undefined : selectedValue);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-1">
        <Label htmlFor="project-type-selector" value={required ? `${label} *` : label} />
        <Select
          id="project-type-selector"
          disabled
          className="opacity-50"
        >
          <option>Loading project types...</option>
        </Select>
        {helperText && <HelperText>{helperText}</HelperText>}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-1">
        <Label htmlFor="project-type-selector" value={required ? `${label} *` : label} />
        <Select
          id="project-type-selector"
          disabled
          className="border-red-500"
        >
          <option>Error loading project types</option>
        </Select>
        {helperText && (
          <HelperText color="failure">
            Failed to load project types. Please try again.
          </HelperText>
        )}
      </div>
    );
  }

  const projectTypes = data?.project_types || [];

  // Empty state (no project types defined)
  if (projectTypes.length === 0) {
    return (
      <div className="space-y-1">
        <Label htmlFor="project-type-selector" value={required ? `${label} *` : label} />
        <Select
          id="project-type-selector"
          disabled
          className="opacity-50"
        >
          <option>No project types available</option>
        </Select>
        {helperText && (
          <HelperText color="warning">
            No project types configured. Please contact an administrator.
          </HelperText>
        )}
      </div>
    );
  }

  // Normal state with project types
  return (
    <div className="space-y-1">
      <Label htmlFor="project-type-selector" value={required ? `${label} *` : label} />
      <Select
        id="project-type-selector"
        value={value || ''}
        onChange={handleChange}
        required={required}
        disabled={disabled}
      >
        {allowNone && <option value="">None (No specific type)</option>}

        {projectTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
            {type.description && ` - ${type.description}`}
          </option>
        ))}
      </Select>
      {helperText && <HelperText>{helperText}</HelperText>}
    </div>
  );
}
