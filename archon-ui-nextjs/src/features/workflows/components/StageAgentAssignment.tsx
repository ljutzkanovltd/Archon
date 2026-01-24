"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Badge, Spinner, Alert, Select, Label, Button } from "flowbite-react";
import {
  HiInformationCircle,
  HiUserGroup,
  HiSave,
  HiXCircle,
} from "react-icons/hi";
import { apiClient } from "@/lib/apiClient";

interface StageAgentAssignmentProps {
  /**
   * Workflow ID to configure agent assignments for
   */
  workflowId: string;

  /**
   * Whether to show workflow name in header
   */
  showWorkflowName?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

interface WorkflowStage {
  id: string;
  name: string;
  color: string;
  stage_order: number;
  workflow_id: string;
  description?: string;
  // Note: default_agent field not yet in database
  default_agent?: string;
}

interface Workflow {
  id: string;
  name: string;
  project_type_id: string | null;
  description?: string;
  stages: WorkflowStage[];
}

/**
 * Available AI agents for task assignment
 * Based on the agentic workflow architecture
 */
const AVAILABLE_AGENTS = [
  { value: "", label: "No Default Agent" },
  { value: "planner", label: "Planner (Orchestrator)", tier: 1 },
  { value: "architect", label: "Architect (System Design)", tier: 2 },
  { value: "llms-expert", label: "LLMs Expert (AI/ML)", tier: 2 },
  { value: "computer-vision-expert", label: "Computer Vision Expert", tier: 2 },
  { value: "codebase-analyst", label: "Codebase Analyst (Patterns)", tier: 3 },
  { value: "library-researcher", label: "Library Researcher", tier: 3 },
  { value: "ux-ui-researcher", label: "UX/UI Researcher", tier: 3 },
  { value: "ui-implementation-expert", label: "UI Implementation Expert", tier: 4 },
  { value: "backend-api-expert", label: "Backend API Expert", tier: 4 },
  { value: "database-expert", label: "Database Expert", tier: 4 },
  { value: "integration-expert", label: "Integration Expert", tier: 4 },
  { value: "testing-expert", label: "Testing Expert", tier: 5 },
  { value: "performance-expert", label: "Performance Expert", tier: 5 },
  { value: "documentation-expert", label: "Documentation Expert", tier: 5 },
];

/**
 * StageAgentAssignment - Configure default agent for each workflow stage
 *
 * Features:
 * - View workflow stages with agent assignments
 * - Dropdown to select default agent for each stage
 * - Agent tier badges (1-5)
 * - Visual agent categorization
 * - Save/cancel functionality (UI ready)
 *
 * Note: Requires backend implementation:
 * - Database migration: Add `default_agent` VARCHAR(100) to archon_workflow_stages
 * - API endpoint: PUT /api/workflow-stages/{id}/agent
 *
 * Usage:
 * ```tsx
 * <StageAgentAssignment workflowId={workflowId} showWorkflowName />
 * ```
 */
export function StageAgentAssignment({
  workflowId,
  showWorkflowName = true,
  className = "",
}: StageAgentAssignmentProps) {
  const [agentAssignments, setAgentAssignments] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch workflow with stages
  const {
    data: workflow,
    isLoading,
    error,
  } = useQuery<Workflow>({
    queryKey: ["workflow-agent-assignment", workflowId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/workflows/${workflowId}`);
      return response.data;
    },
    enabled: !!workflowId,
    staleTime: 1000 * 60 * 5,
    onSuccess: (data) => {
      // Initialize agent assignments from loaded data
      const initialAssignments: Record<string, string> = {};
      data.stages?.forEach((stage) => {
        initialAssignments[stage.id] = stage.default_agent || "";
      });
      setAgentAssignments(initialAssignments);
    },
  });

  const handleAgentChange = (stageId: string, agentValue: string) => {
    setAgentAssignments((prev) => ({
      ...prev,
      [stageId]: agentValue,
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // TODO: Implement when backend endpoint is available
    // await apiClient.put(`/api/workflow-stages/${stageId}/agent`, { default_agent: agentValue });
    console.log("Agent assignments to save:", agentAssignments);
  };

  const handleCancel = () => {
    // Reset to original values
    const initialAssignments: Record<string, string> = {};
    workflow?.stages?.forEach((stage) => {
      initialAssignments[stage.id] = stage.default_agent || "";
    });
    setAgentAssignments(initialAssignments);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading workflow stages...
          </span>
        </div>
      </Card>
    );
  }

  if (error || !workflow) {
    return (
      <Card className={className}>
        <Alert color="failure" icon={HiXCircle}>
          <span className="font-medium">Failed to load workflow stages!</span>{" "}
          {(error as Error)?.message || "Unknown error occurred"}
        </Alert>
      </Card>
    );
  }

  const sortedStages = [...(workflow.stages || [])].sort(
    (a, b) => a.stage_order - b.stage_order
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HiUserGroup className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Stage Agent Assignment
            </h3>
            {showWorkflowName && workflow.name && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {workflow.name}
              </p>
            )}
          </div>
        </div>
        <Badge color="info" size="sm">
          {sortedStages.length} stages
        </Badge>
      </div>

      {/* Info Alert */}
      <Alert color="info" icon={HiInformationCircle}>
        <span className="text-sm">
          <strong>Backend Required:</strong> This feature requires database
          migration (add `default_agent` to archon_workflow_stages) and API
          endpoint (PUT /api/workflow-stages/&#123;id&#125;/agent). UI is ready
          for integration.
        </span>
      </Alert>

      {/* Stage Agent Assignments */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
            Assign Default Agents
          </h4>
          <div className="flex gap-2">
            <Button
              color="gray"
              size="xs"
              onClick={handleCancel}
              disabled={!hasChanges}
            >
              Cancel
            </Button>
            <Button
              color="blue"
              size="xs"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              <HiSave className="mr-2 h-3 w-3" />
              Save (Demo Only)
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {sortedStages.length > 0 ? (
            sortedStages.map((stage, index) => (
              <StageAgentRow
                key={stage.id}
                stage={stage}
                position={index + 1}
                selectedAgent={agentAssignments[stage.id] || ""}
                onAgentChange={(agentValue) =>
                  handleAgentChange(stage.id, agentValue)
                }
              />
            ))
          ) : (
            <div className="py-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No stages configured for this workflow
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Agent Tier Legend */}
      <Card>
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          Agent Hierarchy (Tiers)
        </h4>
        <div className="grid gap-2 md:grid-cols-5">
          <div className="rounded-md bg-purple-50 p-2 dark:bg-purple-900/20">
            <Badge color="purple" size="xs" className="mb-1">
              Tier 1
            </Badge>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              Orchestrator (Planner)
            </p>
          </div>
          <div className="rounded-md bg-blue-50 p-2 dark:bg-blue-900/20">
            <Badge color="info" size="xs" className="mb-1">
              Tier 2
            </Badge>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              Architecture & Strategy
            </p>
          </div>
          <div className="rounded-md bg-green-50 p-2 dark:bg-green-900/20">
            <Badge color="success" size="xs" className="mb-1">
              Tier 3
            </Badge>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              Specialist Researchers
            </p>
          </div>
          <div className="rounded-md bg-yellow-50 p-2 dark:bg-yellow-900/20">
            <Badge color="warning" size="xs" className="mb-1">
              Tier 4
            </Badge>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              Implementation Experts
            </p>
          </div>
          <div className="rounded-md bg-gray-50 p-2 dark:bg-gray-900/20">
            <Badge color="gray" size="xs" className="mb-1">
              Tier 5
            </Badge>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              Quality & Documentation
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * StageAgentRow - Single stage with agent selection
 */
interface StageAgentRowProps {
  stage: WorkflowStage;
  position: number;
  selectedAgent: string;
  onAgentChange: (agentValue: string) => void;
}

function StageAgentRow({
  stage,
  position,
  selectedAgent,
  onAgentChange,
}: StageAgentRowProps) {
  const selectedAgentData = AVAILABLE_AGENTS.find(
    (agent) => agent.value === selectedAgent
  );

  const getTierColor = (tier?: number) => {
    switch (tier) {
      case 1:
        return "purple";
      case 2:
        return "info";
      case 3:
        return "success";
      case 4:
        return "warning";
      case 5:
        return "gray";
      default:
        return "gray";
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Stage Info */}
        <div className="flex items-center gap-3">
          <Badge color="gray" size="sm">
            #{position}
          </Badge>
          <div
            className="h-4 w-4 rounded-full border border-gray-300 dark:border-gray-600"
            style={{ backgroundColor: stage.color }}
          />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {stage.name}
            </p>
            {stage.description && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {stage.description}
              </p>
            )}
          </div>
        </div>

        {/* Agent Selection */}
        <div>
          <Label htmlFor={`agent-${stage.id}`} className="mb-2 block text-xs">
            Default Agent
          </Label>
          <div className="flex items-center gap-2">
            <Select
              id={`agent-${stage.id}`}
              value={selectedAgent}
              onChange={(e) => onAgentChange(e.target.value)}
              className="flex-1"
              sizing="sm"
            >
              {AVAILABLE_AGENTS.map((agent) => (
                <option key={agent.value} value={agent.value}>
                  {agent.label}
                  {agent.tier ? ` (Tier ${agent.tier})` : ""}
                </option>
              ))}
            </Select>
            {selectedAgentData && selectedAgentData.tier && (
              <Badge
                color={getTierColor(selectedAgentData.tier)}
                size="sm"
              >
                T{selectedAgentData.tier}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
