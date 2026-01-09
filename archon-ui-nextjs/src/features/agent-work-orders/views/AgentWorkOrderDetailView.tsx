"use client";

/**
 * Agent Work Order Detail View
 *
 * Detailed view of a single agent work order showing progress, step history,
 * logs, and full metadata.
 * Adapted to archon-ui-nextjs patterns using Flowbite components and BreadCrumb.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "flowbite-react";
import { HiChevronDown, HiChevronUp, HiExternalLink } from "react-icons/hi";
import { BreadCrumb } from "@/components/common/BreadCrumb";
import { cn } from "@/lib/utils";
import { RealTimeStats, StepHistoryCard, WorkflowStepButton } from "../components";
import { useStepHistory, useWorkOrder } from "../hooks/useAgentWorkOrderQueries";
import { useAgentWorkOrdersStore } from "../state/agentWorkOrdersStore";
import type { WorkflowStep } from "../types";

export interface AgentWorkOrderDetailViewProps {
  /** Work order ID from URL params */
  workOrderId: string;
}

/**
 * All available workflow steps in execution order
 */
const ALL_WORKFLOW_STEPS: WorkflowStep[] = [
  "create-branch",
  "planning",
  "execute",
  "prp-review",
  "commit",
  "create-pr",
];

export function AgentWorkOrderDetailView({ workOrderId }: AgentWorkOrderDetailViewProps) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const { data: workOrder, isLoading: isLoadingWorkOrder, isError: isErrorWorkOrder } = useWorkOrder(workOrderId);
  const { data: stepHistory, isLoading: isLoadingSteps, isError: isErrorSteps } = useStepHistory(workOrderId);

  // SSE connection management
  const connectToLogs = useAgentWorkOrdersStore((s) => s.connectToLogs);
  const disconnectFromLogs = useAgentWorkOrdersStore((s) => s.disconnectFromLogs);
  const connectionState = useAgentWorkOrdersStore((s) => s.connectionStates[workOrderId]);

  // Get live progress from SSE for total steps count
  const liveProgress = useAgentWorkOrdersStore((s) => s.liveProgress[workOrderId]);

  // Connect to SSE stream on mount, disconnect on unmount
  useEffect(() => {
    // Only connect if we're viewing a work order
    if (workOrderId && typeof window !== 'undefined') {
      connectToLogs(workOrderId);
    }

    // Cleanup: disconnect on unmount
    return () => {
      if (workOrderId) {
        disconnectFromLogs(workOrderId);
      }
    };
  }, [workOrderId, connectToLogs, disconnectFromLogs]);

  /**
   * Toggle step expansion
   */
  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  if (isLoadingWorkOrder || isLoadingSteps) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-1/3 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-40 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-60 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }

  if (isErrorWorkOrder || isErrorSteps || !workOrder || !stepHistory) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-red-400">Failed to load work order</p>
        <Button onClick={() => router.push("/agent-work-orders")} color="gray">
          Back to List
        </Button>
      </div>
    );
  }

  // Additional safety check for repository_url
  const repoName = workOrder?.repository_url?.split("/").slice(-2).join("/") || "Unknown Repository";

  return (
    <div className="space-y-6">
      {/* Breadcrumb navigation using BreadCrumb component */}
      <BreadCrumb
        items={[
          { label: "Work Orders", href: "/agent-work-orders" },
          { label: repoName, href: "/agent-work-orders" },
          { label: workOrder.agent_work_order_id, href: `/agent-work-orders/${workOrderId}` },
        ]}
      />

      {/* Real-Time Execution Stats */}
      <RealTimeStats workOrderId={workOrderId} />

      {/* Workflow Progress Bar */}
      <div
        className={cn(
          "overflow-visible rounded-lg border border-white/10 bg-black/20 p-6 backdrop-blur",
          "dark:border-gray-700/30 dark:bg-white/5",
          "border-t-4 border-t-cyan-500 dark:border-t-cyan-400",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{repoName}</h3>
          <Button
            color="gray"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-400"
            aria-label={showDetails ? "Hide details" : "Show details"}
          >
            {showDetails ? (
              <HiChevronUp className="mr-1 h-4 w-4" aria-hidden="true" />
            ) : (
              <HiChevronDown className="mr-1 h-4 w-4" aria-hidden="true" />
            )}
            Details
          </Button>
        </div>

        {/* Workflow Steps - Show all steps, highlight completed */}
        <div className="flex items-center justify-center gap-0">
          {ALL_WORKFLOW_STEPS.map((stepName, index) => {
            // Find if this step has been executed
            const executedStep = stepHistory.steps.find((s) => s.step === stepName);
            const isCompleted = executedStep?.success || false;
            // Mark as active if it's the last executed step and not successful (still running)
            const isActive = !!(
              executedStep &&
              stepHistory.steps[stepHistory.steps.length - 1]?.step === stepName &&
              !executedStep.success
            );

            return (
              <div key={stepName} className="flex items-center">
                <WorkflowStepButton
                  isCompleted={isCompleted}
                  isActive={isActive}
                  stepName={stepName}
                  color="cyan"
                  size={50}
                />
                {/* Connecting Line - only show between steps */}
                {index < ALL_WORKFLOW_STEPS.length - 1 && (
                  <div className="relative flex-shrink-0" style={{ width: "80px", height: "50px" }}>
                    <div
                      className={
                        isCompleted
                          ? "absolute left-0 right-0 top-1/2 h-[2px] border-t-2 border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                          : "absolute left-0 right-0 top-1/2 h-[2px] border-t-2 border-gray-600 dark:border-gray-700"
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Collapsible Details Section */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: {
                  duration: 0.3,
                  ease: [0.04, 0.62, 0.23, 0.98],
                },
                opacity: {
                  duration: 0.2,
                  ease: "easeInOut",
                },
              }}
              style={{ overflow: "hidden" }}
              className="mt-6"
            >
              <motion.div
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                exit={{ y: -20 }}
                transition={{
                  duration: 0.2,
                  ease: "easeOut",
                }}
                className="grid grid-cols-1 gap-6 border-t border-gray-200/50 pt-6 dark:border-gray-700/30 md:grid-cols-2"
              >
                {/* Left Column - Details */}
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Details
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                        <p className="mt-0.5 text-sm font-medium text-blue-600 dark:text-blue-400">
                          {workOrder.status.charAt(0).toUpperCase() + workOrder.status.slice(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Sandbox Type</p>
                        <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                          {workOrder.sandbox_type}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Repository</p>
                        <a
                          href={workOrder.repository_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                        >
                          {workOrder.repository_url}
                          <HiExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      </div>
                      {workOrder.git_branch_name && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Branch</p>
                          <p className="mt-0.5 font-mono text-sm font-medium text-gray-900 dark:text-white">
                            {workOrder.git_branch_name}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Work Order ID</p>
                        <p className="mt-0.5 font-mono text-sm font-medium text-gray-700 dark:text-gray-300">
                          {workOrder.agent_work_order_id}
                        </p>
                      </div>
                      {workOrder.agent_session_id && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Session ID</p>
                          <p className="mt-0.5 font-mono text-sm font-medium text-gray-700 dark:text-gray-300">
                            {workOrder.agent_session_id}
                          </p>
                        </div>
                      )}
                      {workOrder.github_pull_request_url && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Pull Request</p>
                          <a
                            href={workOrder.github_pull_request_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-cyan-600 hover:underline dark:text-cyan-400"
                          >
                            View PR
                            <HiExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        </div>
                      )}
                      {workOrder.github_issue_number && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">GitHub Issue</p>
                          <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                            #{workOrder.github_issue_number}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Statistics */}
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Statistics
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Commits</p>
                        <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">
                          {workOrder.git_commit_count}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Files Changed</p>
                        <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">
                          {workOrder.git_files_changed}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Steps Completed</p>
                        <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">
                          {stepHistory.steps.filter((s) => s.success).length} /{" "}
                          {liveProgress?.totalSteps ?? stepHistory.steps.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Step History */}
      <div className="space-y-4">
        {stepHistory.steps.map((step, index) => {
          const stepId = `${step.step}-${index}`;
          const isExpanded = expandedSteps.has(stepId);

          return (
            <StepHistoryCard
              key={stepId}
              step={{
                id: stepId,
                stepName: step.step,
                timestamp: new Date(step.timestamp).toLocaleString(),
                output: step.output || "No output",
                session: step.session_id || "Unknown session",
                collapsible: true,
                isHumanInLoop: false,
              }}
              isExpanded={isExpanded}
              onToggle={() => toggleStepExpansion(stepId)}
            />
          );
        })}
      </div>
    </div>
  );
}
