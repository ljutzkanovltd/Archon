"use client";

/**
 * Real Time Stats Component
 *
 * Displays real-time progress statistics for a work order with SSE integration.
 * Shows current step, progress bar, elapsed time, and collapsible execution logs.
 * Adapted to archon-ui-nextjs patterns using react-icons/hi.
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "flowbite-react";
import { HiChevronDown, HiChevronUp, HiLightningBolt, HiClock, HiTrendingUp } from "react-icons/hi";
import { useStepHistory, useWorkOrderLogs } from "../hooks/useAgentWorkOrderQueries";
import { useAgentWorkOrdersStore } from "../state/agentWorkOrdersStore";
import type { LiveProgress } from "../state/slices/sseSlice";
import type { LogEntry } from "../types";
import { ExecutionLogs } from "./ExecutionLogs";

export interface RealTimeStatsProps {
  /** Work order ID to stream logs for */
  workOrderId: string | undefined;
}

/**
 * Stable empty array reference to prevent infinite re-renders
 * CRITICAL: Never use `|| []` in Zustand selectors - creates new reference each render
 */
const EMPTY_LOGS: never[] = [];

/**
 * Type guard to narrow LogEntry to one with required step_number and total_steps
 */
type LogEntryWithSteps = LogEntry & {
  step_number: number;
  total_steps: number;
};

function hasStepInfo(log: LogEntry): log is LogEntryWithSteps {
  return log.step_number !== undefined && log.total_steps !== undefined;
}

/**
 * Calculate progress metrics from log entries
 * Used as fallback when no SSE progress data exists (e.g., after refresh)
 */
function useCalculateProgressFromLogs(logs: LogEntry[]): LiveProgress | null {
  return useMemo(() => {
    if (logs.length === 0) return null;

    // Find latest progress-related logs using type guard for proper narrowing
    const stepLogs = logs.filter(hasStepInfo);
    const latestStepLog = stepLogs[stepLogs.length - 1];

    const workflowCompleted = logs.some((log) => log.event === "workflow_completed");
    const workflowFailed = logs.some((log) => log.event === "workflow_failed" || log.level === "error");

    const latestElapsed = logs.reduce((max, log) => {
      return log.elapsed_seconds !== undefined && log.elapsed_seconds > max ? log.elapsed_seconds : max;
    }, 0);

    if (!latestStepLog && logs.length > 0) {
      // Have logs but no step info - show minimal progress
      return {
        currentStep: "initializing",
        progressPct: workflowCompleted ? 100 : workflowFailed ? 0 : 10,
        elapsedSeconds: latestElapsed,
        status: workflowCompleted ? "completed" : workflowFailed ? "failed" : "running",
      };
    }

    if (latestStepLog) {
      // Type guard ensures step_number and total_steps are defined, so safe to access
      const stepNumber = latestStepLog.step_number;
      const totalSteps = latestStepLog.total_steps;
      const completedSteps = stepNumber - 1;

      return {
        currentStep: latestStepLog.step || "unknown",
        stepNumber: stepNumber,
        totalSteps: totalSteps,
        progressPct: workflowCompleted ? 100 : Math.round((completedSteps / totalSteps) * 100),
        elapsedSeconds: latestElapsed,
        status: workflowCompleted ? "completed" : workflowFailed ? "failed" : "running",
      };
    }

    return null;
  }, [logs]);
}

/**
 * Calculate progress from step history (persistent database data)
 * Used when logs are not available (completed work orders, server restart)
 */
function useCalculateProgressFromSteps(stepHistory: any): LiveProgress | null {
  return useMemo(() => {
    if (!stepHistory?.steps || stepHistory.steps.length === 0) return null;

    const steps = stepHistory.steps;
    const totalSteps = steps.length;
    const completedSteps = steps.filter((s: any) => s.success).length;
    const lastStep = steps[steps.length - 1];
    const hasFailure = steps.some((s: any) => !s.success);

    // Calculate total duration
    const totalDuration = steps.reduce((sum: number, step: any) => sum + (step.duration_seconds || 0), 0);

    return {
      currentStep: lastStep.step,
      stepNumber: totalSteps,
      totalSteps: totalSteps,
      progressPct: Math.round((completedSteps / totalSteps) * 100),
      elapsedSeconds: Math.round(totalDuration),
      status: hasFailure ? "failed" : "completed",
    };
  }, [stepHistory]);
}

/**
 * Convert step history to log entries for display
 */
function useConvertStepsToLogs(stepHistory: any): LogEntry[] {
  return useMemo(() => {
    if (!stepHistory?.steps) return [];

    return stepHistory.steps.map((step: any, index: number) => ({
      work_order_id: stepHistory.agent_work_order_id,
      level: step.success ? ("info" as const) : ("error" as const),
      event: step.success ? `Step completed: ${step.step}` : `Step failed: ${step.step}`,
      timestamp: step.timestamp,
      step: step.step,
      step_number: index + 1,
      total_steps: stepHistory.steps.length,
      elapsed_seconds: Math.round(step.duration_seconds),
      output: step.output || step.error_message,
    })) as LogEntry[];
  }, [stepHistory]);
}

/**
 * Format elapsed seconds to human-readable duration
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function RealTimeStats({ workOrderId }: RealTimeStatsProps) {
  const [showLogs, setShowLogs] = useState(false);

  // Zustand SSE slice - subscribe to live data (connection managed by parent)
  const clearLogs = useAgentWorkOrdersStore((s) => s.clearLogs);
  const sseProgress = useAgentWorkOrdersStore((s) => s.liveProgress[workOrderId ?? ""]);
  const sseLogs = useAgentWorkOrdersStore((s) => s.liveLogs[workOrderId ?? ""]);

  // Fetch historical logs from backend as fallback (for refresh/HMR)
  const { data: historicalLogsData } = useWorkOrderLogs(workOrderId, { limit: 500 });

  // Fetch step history for completed work orders (persistent data)
  const { data: stepHistoryData } = useStepHistory(workOrderId);

  // Calculate progress from step history (fallback for completed work orders)
  const stepsProgress = useCalculateProgressFromSteps(stepHistoryData);
  const stepsLogs = useConvertStepsToLogs(stepHistoryData);

  // Data priority: SSE > Historical Logs API > Step History
  const logs =
    sseLogs && sseLogs.length > 0
      ? sseLogs
      : historicalLogsData?.log_entries && historicalLogsData.log_entries.length > 0
        ? historicalLogsData.log_entries
        : stepsLogs;

  const progress = sseProgress || stepsProgress;

  // Logs are "live" only if coming from SSE
  const isLiveData = sseLogs && sseLogs.length > 0;

  // Live elapsed time that updates every second
  const [currentElapsedSeconds, setCurrentElapsedSeconds] = useState<number | null>(null);

  /**
   * Update elapsed time every second if work order is running
   * Note: SSE connection is managed by parent component (AgentWorkOrderDetailView)
   */
  useEffect(() => {
    const isRunning = progress?.status !== "completed" && progress?.status !== "failed";

    if (!progress || !isRunning) {
      setCurrentElapsedSeconds(progress?.elapsedSeconds ?? null);
      return;
    }

    // Start from last known elapsed time or 0
    const startTime = Date.now();
    const initialElapsed = progress.elapsedSeconds || 0;

    const interval = setInterval(() => {
      const additionalSeconds = Math.floor((Date.now() - startTime) / 1000);
      setCurrentElapsedSeconds(initialElapsed + additionalSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [progress?.status, progress?.elapsedSeconds, progress]);

  // Only hide if we have absolutely no data from any source
  if (!progress && logs.length === 0) {
    return null;
  }

  const currentStep = progress?.currentStep || "initializing";
  const stepDisplay =
    progress?.stepNumber !== undefined && progress?.totalSteps !== undefined
      ? `(${progress.stepNumber}/${progress.totalSteps})`
      : "";
  const progressPct = progress?.progressPct || 0;
  const elapsedSeconds = currentElapsedSeconds !== null ? currentElapsedSeconds : progress?.elapsedSeconds || 0;
  const latestLog = logs[logs.length - 1];
  const currentActivity = latestLog?.event || "Initializing workflow...";

  // Determine status for display
  const status = progress?.status || "running";
  const isRunning = status === "running";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";

  // Status display configuration
  const statusConfig = {
    running: { label: "Running", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500 dark:bg-blue-400" },
    completed: {
      label: "Completed",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500 dark:bg-green-400",
    },
    failed: { label: "Failed", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-500 dark:bg-red-400" },
  };

  const currentStatus = statusConfig[status as keyof typeof statusConfig] || statusConfig.running;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/10 bg-black/20 p-4 backdrop-blur dark:border-gray-700/30 dark:bg-white/5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-300">
          <HiLightningBolt className="h-4 w-4" aria-hidden="true" />
          {isRunning ? "Real-Time Execution" : "Execution Summary"}
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Current Step */}
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Current Step</div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-200">
              {currentStep}
              {stepDisplay && <span className="ml-2 text-gray-500 dark:text-gray-400">{stepDisplay}</span>}
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <HiTrendingUp className="h-3 w-3" aria-hidden="true" />
              Progress
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 h-2 overflow-hidden rounded-full bg-gray-700 dark:bg-gray-200/20">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ease-out dark:from-cyan-400 dark:to-blue-400"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">{progressPct}%</span>
              </div>
            </div>
          </div>

          {/* Elapsed Time */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <HiClock className="h-3 w-3" aria-hidden="true" />
              Elapsed Time
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-200">{formatDuration(elapsedSeconds)}</div>
          </div>
        </div>

        {/* Latest Activity with Status Indicator - at top */}
        <div className="mt-4 border-t border-white/10 pt-3 dark:border-gray-700/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <div className="whitespace-nowrap text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Latest Activity:
              </div>
              <div className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-300">{currentActivity}</div>
            </div>
            {/* Status Indicator - right side of Latest Activity */}
            <div className={`flex flex-shrink-0 items-center gap-1 text-xs ${currentStatus.color}`}>
              <div className={`h-2 w-2 ${currentStatus.bgColor} rounded-full ${isRunning ? "animate-pulse" : ""}`} />
              <span>{currentStatus.label}</span>
            </div>
          </div>
        </div>

        {/* Show Execution Logs button - at bottom */}
        <div className="mt-3 border-t border-white/10 pt-3 dark:border-gray-700/30">
          <Button
            color="gray"
            size="sm"
            onClick={() => setShowLogs(!showLogs)}
            className="w-full justify-center text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-400"
            aria-label={showLogs ? "Hide execution logs" : "Show execution logs"}
            aria-expanded={showLogs}
          >
            {showLogs ? (
              <>
                <HiChevronUp className="mr-1 h-4 w-4" aria-hidden="true" />
                Hide Execution Logs
              </>
            ) : (
              <>
                <HiChevronDown className="mr-1 h-4 w-4" aria-hidden="true" />
                Show Execution Logs
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Collapsible Execution Logs */}
      {showLogs && (
        <ExecutionLogs
          logs={logs}
          isLive={isLiveData}
          onClearLogs={() => {
            if (workOrderId) {
              clearLogs(workOrderId);
            }
          }}
        />
      )}
    </div>
  );
}
