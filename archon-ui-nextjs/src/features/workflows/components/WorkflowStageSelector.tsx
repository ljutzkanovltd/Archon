import React from 'react';
import { Label, Select, HelperText } from 'flowbite-react';
import { useWorkflowStages } from '../hooks/useWorkflowQueries';

/**
 * WorkflowStageSelector Component
 * Phase 2.1: Dynamic workflow stage selector
 *
 * Replaces hardcoded status dropdown with dynamic workflow stages
 * based on the project's assigned workflow.
 *
 * Features:
 * - Fetches workflow stages for a specific workflow
 * - Displays stages in correct order (stage_order)
 * - Shows loading/error/empty states
 * - Supports controlled component pattern
 * - Accessible with Label and helper text
 *
 * Usage:
 * ```tsx
 * <WorkflowStageSelector
 *   workflowId={project.workflow_id}
 *   value={task.workflow_stage_id}
 *   onChange={(stageId) => setTask({ ...task, workflow_stage_id: stageId })}
 *   label="Task Status"
 *   required
 * />
 * ```
 */

export interface WorkflowStageSelectorProps {
  /**
   * The workflow ID to fetch stages for
   */
  workflowId: string;

  /**
   * Currently selected workflow stage ID
   */
  value?: string;

  /**
   * Callback when stage selection changes
   */
  onChange: (stageId: string | undefined) => void;

  /**
   * Label text for the selector
   * @default "Stage"
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
   * @default false
   */
  allowNone?: boolean;
}

export function WorkflowStageSelector({
  workflowId,
  value,
  onChange,
  label = 'Stage',
  helperText,
  required = false,
  disabled = false,
  allowNone = false,
}: WorkflowStageSelectorProps) {
  const { data, isLoading, error } = useWorkflowStages(workflowId);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    onChange(selectedValue === '' ? undefined : selectedValue);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-1">
        <Label htmlFor="workflow-stage-selector" value={required ? `${label} *` : label} />
        <Select
          id="workflow-stage-selector"
          disabled
          className="opacity-50"
        >
          <option>Loading workflow stages...</option>
        </Select>
        {helperText && <HelperText>{helperText}</HelperText>}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-1">
        <Label htmlFor="workflow-stage-selector" value={required ? `${label} *` : label} />
        <Select
          id="workflow-stage-selector"
          disabled
          className="border-red-500"
        >
          <option>Error loading stages</option>
        </Select>
        <HelperText color="failure">
          {error instanceof Error ? error.message : 'Failed to load workflow stages'}
        </HelperText>
      </div>
    );
  }

  const stages = data?.stages || [];

  // Empty state
  if (stages.length === 0) {
    return (
      <div className="space-y-1">
        <Label htmlFor="workflow-stage-selector" value={required ? `${label} *` : label} />
        <Select
          id="workflow-stage-selector"
          disabled
          className="opacity-50"
        >
          <option>No workflow stages available</option>
        </Select>
        <HelperText color="warning">
          This workflow has no stages defined. Please configure workflow stages first.
        </HelperText>
      </div>
    );
  }

  // Sort stages by stage_order
  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);

  return (
    <div className="space-y-1">
      <Label
        htmlFor="workflow-stage-selector"
        value={required ? `${label} *` : label}
      />
      <Select
        id="workflow-stage-selector"
        value={value || ''}
        onChange={handleChange}
        required={required}
        disabled={disabled}
        className="w-full"
      >
        {/* Optional "None" option */}
        {allowNone && (
          <option value="">None (No stage)</option>
        )}

        {/* Workflow stages */}
        {sortedStages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
            {stage.description && ` - ${stage.description}`}
          </option>
        ))}
      </Select>

      {/* Helper text */}
      {helperText && <HelperText>{helperText}</HelperText>}

      {/* Stage order indicator (optional visual aid) */}
      {value && !isLoading && (
        <div className="text-xs text-gray-500 mt-1">
          Stage order:{' '}
          {sortedStages.findIndex((s) => s.id === value) + 1} of {sortedStages.length}
        </div>
      )}
    </div>
  );
}
