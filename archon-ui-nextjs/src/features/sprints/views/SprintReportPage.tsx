"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HiArrowLeft, HiDownload, HiRefresh } from "react-icons/hi";
import { toast } from "react-hot-toast";
import { BurndownChart } from "../components/BurndownChart";
import { VelocityChart } from "../components/VelocityChart";
import { SprintSummary } from "../components/SprintSummary";

interface SprintReportPageProps {
  sprintId: string;
  projectId: string;
}

interface SprintReportData {
  sprint: {
    id: string;
    name: string;
    status: "planned" | "active" | "completed";
    start_date: string;
    end_date: string;
    goal?: string;
  };
  summary: {
    total_tasks: number;
    completed_tasks: number;
    total_points: number;
    completed_points: number;
    velocity_trend: "up" | "down" | "stable" | null;
  };
  burndown: Array<{
    date: string;
    remaining_points: number;
    completed_points: number;
  }>;
  velocity_history: Array<{
    sprint_name: string;
    planned_points: number;
    completed_points: number;
  }>;
  average_velocity: number;
}

/**
 * SprintReportPage Component
 *
 * Phase 3.10: Sprint analytics report page
 *
 * Features:
 * - Sprint summary stats card
 * - Burndown chart
 * - Velocity chart
 * - Export report functionality
 * - Refresh data
 * - Back navigation
 * - Loading and error states
 *
 * Usage:
 * ```tsx
 * <SprintReportPage
 *   sprintId="d2e7cd39-d435-41ba-bf4e-d8cf6065277e"
 *   projectId="b8c93ec9-966f-43ca-9756-e08ca6d36cc7"
 * />
 * ```
 */
export function SprintReportPage({ sprintId, projectId }: SprintReportPageProps) {
  const router = useRouter();
  const [reportData, setReportData] = useState<SprintReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReportData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181"}/api/sprints/${sprintId}/report`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch sprint report");
      }

      const data = await response.json();
      setReportData(data);
    } catch (err: any) {
      console.error("[SprintReportPage] Error fetching report:", err);
      setError(err.message || "Failed to load sprint report");
      toast.error("Failed to load sprint report");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintId]);

  // Phase 3.11: Real-time updates via polling (every 60 seconds)
  useEffect(() => {
    if (!reportData || reportData.sprint.status !== "active") {
      // Only poll for active sprints
      return;
    }

    const intervalId = setInterval(() => {
      fetchReportData();
    }, 60000); // Poll every 60 seconds

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData?.sprint.status, sprintId]);

  const handleRefresh = () => {
    fetchReportData();
    toast.success("Report refreshed");
  };

  const handleExport = () => {
    if (!reportData) return;

    // Create simple CSV export
    const csvContent = `Sprint Report - ${reportData.sprint.name}\n\n` +
      `Status:,${reportData.sprint.status}\n` +
      `Duration:,${reportData.sprint.start_date} to ${reportData.sprint.end_date}\n` +
      `Goal:,${reportData.sprint.goal || "N/A"}\n\n` +
      `Tasks Completed:,${reportData.summary.completed_tasks} / ${reportData.summary.total_tasks}\n` +
      `Points Completed:,${reportData.summary.completed_points} / ${reportData.summary.total_points}\n` +
      `Average Velocity:,${reportData.average_velocity}\n`;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sprint-report-${reportData.sprint.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Report exported");
  };

  const handleBack = () => {
    router.push(`/projects/${projectId}`);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="p-8">
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <HiArrowLeft className="h-4 w-4" />
          Back to Project
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold">Error Loading Report</p>
          <p className="mt-1 text-sm">{error || "Failed to load sprint report"}</p>
          <button
            onClick={fetchReportData}
            className="mt-3 text-sm underline hover:no-underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={handleBack}
            className="mb-2 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <HiArrowLeft className="h-4 w-4" />
            Back to Project
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {reportData.sprint.name} Report
          </h1>
          {reportData.sprint.goal && (
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {reportData.sprint.goal}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <HiRefresh className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <HiDownload className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Sprint Summary */}
      <div className="mb-6">
        <SprintSummary
          sprintName={reportData.sprint.name}
          sprintStatus={reportData.sprint.status}
          startDate={reportData.sprint.start_date}
          endDate={reportData.sprint.end_date}
          totalTasks={reportData.summary.total_tasks}
          completedTasks={reportData.summary.completed_tasks}
          totalPoints={reportData.summary.total_points}
          completedPoints={reportData.summary.completed_points}
          velocityTrend={reportData.summary.velocity_trend}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Burndown Chart */}
        <BurndownChart
          sprintStartDate={reportData.sprint.start_date}
          sprintEndDate={reportData.sprint.end_date}
          totalPoints={reportData.summary.total_points}
          burndownData={reportData.burndown}
        />

        {/* Velocity Chart */}
        <VelocityChart
          velocityData={reportData.velocity_history}
          averageVelocity={reportData.average_velocity}
        />
      </div>
    </div>
  );
}
