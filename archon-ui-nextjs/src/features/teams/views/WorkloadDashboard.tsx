"use client";

import { useMemo } from "react";
import { Card, Progress, Badge, Spinner } from "flowbite-react";
import { HiUsers, HiChartBar, HiTrendingUp } from "react-icons/hi";
import { useTeams } from "../hooks/useTeamQueries";
import { useTaskStore } from "@/store/useTaskStore";
import type { Task } from "@/lib/types";

interface WorkloadDashboardProps {
  projectId: string;
}

interface MemberWorkload {
  userId: string;
  userName: string;
  totalStoryPoints: number;
  completedStoryPoints: number;
  inProgressStoryPoints: number;
  todoStoryPoints: number;
  utilization: number;
  taskCount: number;
}

interface TeamWorkload {
  teamId: string;
  teamName: string;
  members: MemberWorkload[];
  totalCapacity: number;
  totalUtilization: number;
}

/**
 * WorkloadDashboard - Display team and member workload metrics
 *
 * Features:
 * - Show teams with their members
 * - Story points breakdown per member (total/completed/in-progress/todo)
 * - Utilization percentages with visual progress bars
 * - Team-level aggregate metrics
 * - Color-coded utilization levels (under/optimal/over-utilized)
 *
 * Usage:
 * ```tsx
 * <WorkloadDashboard projectId={projectId} />
 * ```
 */
export function WorkloadDashboard({ projectId }: WorkloadDashboardProps) {
  const { data: teamsData, isLoading: isLoadingTeams } = useTeams(projectId);
  const { tasks, isLoading: isLoadingTasks } = useTaskStore();

  // Filter tasks for this project
  const projectTasks = useMemo(
    () => tasks.filter((t) => t.project_id === projectId),
    [tasks, projectId]
  );

  // Calculate workload metrics
  const workloadData = useMemo(() => {
    if (!teamsData?.teams) return [];

    const teams: TeamWorkload[] = [];

    for (const team of teamsData.teams) {
      // For now, we don't have member data directly
      // This would need to be fetched from team members API
      // Placeholder structure for demonstration
      const teamWorkload: TeamWorkload = {
        teamId: team.id,
        teamName: team.name,
        members: [],
        totalCapacity: 0,
        totalUtilization: 0,
      };

      teams.push(teamWorkload);
    }

    return teams;
  }, [teamsData, projectTasks]);

  // Calculate task metrics by assignee
  const assigneeMetrics = useMemo(() => {
    const metrics: Record<string, MemberWorkload> = {};

    for (const task of projectTasks) {
      if (!task.assignee) continue;

      if (!metrics[task.assignee]) {
        metrics[task.assignee] = {
          userId: task.assignee,
          userName: task.assignee, // Would be actual name from user data
          totalStoryPoints: 0,
          completedStoryPoints: 0,
          inProgressStoryPoints: 0,
          todoStoryPoints: 0,
          utilization: 0,
          taskCount: 0,
        };
      }

      const storyPoints = task.story_points || 0;
      metrics[task.assignee].totalStoryPoints += storyPoints;
      metrics[task.assignee].taskCount += 1;

      // Categorize by status
      if (task.status === "done") {
        metrics[task.assignee].completedStoryPoints += storyPoints;
      } else if (task.status === "doing" || task.status === "review") {
        metrics[task.assignee].inProgressStoryPoints += storyPoints;
      } else {
        metrics[task.assignee].todoStoryPoints += storyPoints;
      }
    }

    // Calculate utilization (completed / total * 100)
    for (const assignee in metrics) {
      const metric = metrics[assignee];
      if (metric.totalStoryPoints > 0) {
        metric.utilization = Math.round(
          (metric.completedStoryPoints / metric.totalStoryPoints) * 100
        );
      }
    }

    return Object.values(metrics);
  }, [projectTasks]);

  if (isLoadingTeams || isLoadingTasks) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="xl" />
      </div>
    );
  }

  const teams = teamsData?.teams || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HiChartBar className="h-6 w-6 text-brand-600 dark:text-brand-400" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Workload Dashboard
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Team capacity and member utilization metrics
          </p>
        </div>
      </div>

      {/* Overall Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Total Teams"
          value={teams.length}
          icon={HiUsers}
          color="blue"
        />
        <MetricCard
          title="Team Members"
          value={assigneeMetrics.length}
          icon={HiUsers}
          color="purple"
        />
        <MetricCard
          title="Total Story Points"
          value={assigneeMetrics.reduce((sum, m) => sum + m.totalStoryPoints, 0)}
          icon={HiTrendingUp}
          color="green"
        />
      </div>

      {/* Team Workload Breakdown */}
      {teams.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <HiUsers className="mx-auto h-16 w-16 text-gray-400" />
            <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No teams yet
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create teams to track workload metrics
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Member Workload
          </h3>
          {assigneeMetrics.length === 0 ? (
            <Card>
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                No tasks assigned yet
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assigneeMetrics.map((member) => (
                <MemberWorkloadCard key={member.userId} member={member} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * MetricCard - Display a single metric with icon
 */
interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "purple" | "green";
}

function MetricCard({ title, value, icon: Icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    green: "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  };

  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * MemberWorkloadCard - Display individual member workload
 */
interface MemberWorkloadCardProps {
  member: MemberWorkload;
}

function MemberWorkloadCard({ member }: MemberWorkloadCardProps) {
  // Determine utilization level
  const getUtilizationColor = (utilization: number) => {
    if (utilization < 50) return "warning"; // Under-utilized
    if (utilization < 80) return "success"; // Optimal
    return "failure"; // Over-utilized
  };

  const getUtilizationBadge = (utilization: number) => {
    if (utilization < 50) return { color: "warning", label: "Under-utilized" };
    if (utilization < 80) return { color: "success", label: "Optimal" };
    return { color: "failure", label: "Over-utilized" };
  };

  const utilizationBadge = getUtilizationBadge(member.utilization);

  return (
    <Card>
      <div className="space-y-3">
        {/* Member Info */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {member.userName}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {member.taskCount} tasks
            </p>
          </div>
          <Badge color={utilizationBadge.color} size="sm">
            {member.utilization}%
          </Badge>
        </div>

        {/* Story Points Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>Story Points</span>
            <span className="font-medium">
              {member.completedStoryPoints} / {member.totalStoryPoints}
            </span>
          </div>
          <Progress
            progress={member.utilization}
            color={getUtilizationColor(member.utilization)}
            size="sm"
          />
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Done</p>
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              {member.completedStoryPoints}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">In Progress</p>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {member.inProgressStoryPoints}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">To Do</p>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {member.todoStoryPoints}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
