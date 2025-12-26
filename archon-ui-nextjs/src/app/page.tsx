"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { projectsApi, tasksApi } from "@/lib/apiClient";
import { HiOutlineFolder, HiOutlineClipboardList, HiOutlineUserGroup, HiOutlineCheckCircle, HiOutlineUser, HiOutlineCog, HiOutlineClipboardCheck } from "react-icons/hi";
import { useActiveUsers } from "@/hooks";

interface DashboardStats {
  totalProjects: number;
  totalTasks: number;
  userTasks: number;
  agentTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  todoTasks: number;
  loading: boolean;
  error: string | null;
}

export default function DashboardPage() {
  // Fetch active users from API
  const { data: activeUsersData, isLoading: activeUsersLoading, error: activeUsersError } = useActiveUsers();

  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    totalTasks: 0,
    userTasks: 0,
    agentTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    reviewTasks: 0,
    todoTasks: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function fetchDashboardStats() {
      try {
        setStats((prev) => ({ ...prev, loading: true, error: null }));

        // Fetch all data in parallel
        const [projectsData, allTasksData, userTasksData, completedTasksData, inProgressTasksData, reviewTasksData, todoTasksData] = await Promise.all([
          projectsApi.getAll({ per_page: 1 }), // Just need count
          tasksApi.getAll({ per_page: 1 }), // Just need total count
          tasksApi.getAll({ filter_by: "assignee", filter_value: "User", per_page: 1 }),
          tasksApi.getAll({ filter_by: "status", filter_value: "done", per_page: 1 }),
          tasksApi.getAll({ filter_by: "status", filter_value: "doing", per_page: 1 }),
          tasksApi.getAll({ filter_by: "status", filter_value: "review", per_page: 1 }),
          tasksApi.getAll({ filter_by: "status", filter_value: "todo", per_page: 1 }),
        ]);

        const totalTasks = allTasksData.total;
        const userTasks = userTasksData.total;
        const agentTasks = totalTasks - userTasks; // All tasks not assigned to "User"

        setStats({
          totalProjects: projectsData.total,
          totalTasks,
          userTasks,
          agentTasks,
          completedTasks: completedTasksData.total,
          inProgressTasks: inProgressTasksData.total,
          reviewTasks: reviewTasksData.total,
          todoTasks: todoTasksData.total,
          loading: false,
          error: null,
        });

        console.log("[Dashboard] Stats loaded:", {
          projects: projectsData.total,
          totalTasks,
          userTasks,
          agentTasks,
          completed: completedTasksData.total,
          inProgress: inProgressTasksData.total,
          review: reviewTasksData.total,
          todo: todoTasksData.total,
        });
      } catch (error) {
        console.error("[Dashboard] Error fetching stats:", error);
        setStats((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to load dashboard statistics",
        }));
      }
    }

    fetchDashboardStats();
  }, []);

  const completionRate = stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  if (stats.loading) {
    return (
      <div className="p-6 animate-fadeIn">
        {/* Header Skeleton */}
        <div className="mb-6">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-2 h-5 w-96 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mt-2 h-9 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mt-1 h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
                <div className="h-12 w-12 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>

        {/* Task Breakdown Chart Skeleton */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 h-6 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="h-4 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                    <div className="h-2 w-full animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions Skeleton */}
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1">
                  <div className="h-5 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mt-1 h-4 w-36 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">Error</h2>
          <p className="mt-2 text-red-600 dark:text-red-300">{stats.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-fadeIn">
      {/* Header */}
      <div className="mb-6 transition-opacity duration-200 ease-in-out">
        <h1 className="h1 text-gray-900 dark:text-white">Dashboard</h1>
        <p className="body-1 mt-2 text-gray-600 dark:text-gray-400">
          Welcome to Archon Knowledge Base & Task Management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 transition-opacity duration-200 ease-in-out">
        {/* Total Projects */}
        <div className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Projects
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {stats.totalProjects}
              </p>
            </div>
            <div className="rounded-lg bg-brand-100 p-3 dark:bg-brand-900/20">
              <HiOutlineFolder className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            </div>
          </div>
        </div>

        {/* Total Tasks */}
        <div className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Tasks
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {stats.totalTasks}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {stats.inProgressTasks} in progress • {stats.todoTasks} to do
              </p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/20">
              <HiOutlineClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Completion Rate
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {completionRate}%
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {stats.completedTasks} of {stats.totalTasks} completed
              </p>
            </div>
            <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/20">
              <HiOutlineCheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* User Tasks */}
        <div className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                My Tasks
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {stats.userTasks}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Assigned to you
              </p>
            </div>
            <div className="rounded-lg bg-purple-100 p-3 dark:bg-purple-900/20">
              <HiOutlineUser className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        {/* Agent Tasks */}
        <div className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Agent Tasks
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {stats.agentTasks}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Assigned to AI agents
              </p>
            </div>
            <div className="rounded-lg bg-orange-100 p-3 dark:bg-orange-900/20">
              <HiOutlineCog className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        {/* Active Agents (Real Data) */}
        <div className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Agents
              </p>
              {activeUsersLoading ? (
                <div className="mt-2 h-9 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              ) : activeUsersError ? (
                <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                  !
                </p>
              ) : (
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {activeUsersData?.count || 0}
                </p>
              )}
              {activeUsersLoading ? (
                <div className="mt-1 h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              ) : activeUsersError ? (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                  Failed to load
                </p>
              ) : activeUsersData && activeUsersData.count > 0 ? (
                <>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {activeUsersData.users.slice(0, 3).map(u => u.name).join(", ")}
                    {activeUsersData.count > 3 && ` +${activeUsersData.count - 3} more`}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    AI assistants active in last 24h
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  No activity in last 24h
                </p>
              )}
            </div>
            <div className="rounded-lg bg-indigo-100 p-3 dark:bg-indigo-900/20">
              <HiOutlineUserGroup className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Task Breakdown Chart */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Task Status Breakdown */}
        <div className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <h2 className="h3 mb-4 text-gray-900 dark:text-white">
            Task Status Breakdown
          </h2>
          <div className="space-y-4">
            {/* To Do */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">To Do</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.todoTasks}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-gray-500"
                  style={{ width: `${stats.totalTasks > 0 ? (stats.todoTasks / stats.totalTasks) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* In Progress */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">In Progress</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.inProgressTasks}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${stats.totalTasks > 0 ? (stats.inProgressTasks / stats.totalTasks) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* In Review */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">In Review</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.reviewTasks}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-orange-500"
                  style={{ width: `${stats.totalTasks > 0 ? (stats.reviewTasks / stats.totalTasks) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Completed */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.completedTasks}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Task Assignment Breakdown */}
        <div className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <h2 className="h3 mb-4 text-gray-900 dark:text-white">
            Task Assignment
          </h2>
          <div className="space-y-4">
            {/* User Tasks */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">User Tasks</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.userTasks}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-purple-500"
                  style={{ width: `${stats.totalTasks > 0 ? (stats.userTasks / stats.totalTasks) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Agent Tasks */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Agent Tasks</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.agentTasks}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-orange-500"
                  style={{ width: `${stats.totalTasks > 0 ? (stats.agentTasks / stats.totalTasks) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <Link
          href="/projects"
          className="group rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-brand-500 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-400"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-100 p-2 group-hover:bg-brand-200 dark:bg-brand-900/20">
              <HiOutlineFolder className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">View Projects</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage all projects</p>
            </div>
          </div>
        </Link>

        <Link
          href="/projects?view=tasks"
          className="group rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-blue-500 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-400"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 group-hover:bg-blue-200 dark:bg-blue-900/20">
              <HiOutlineClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">My Tasks</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">View assigned tasks</p>
            </div>
          </div>
        </Link>

        <Link
          href="/knowledge-base"
          className="group rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-green-500 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:hover:border-green-400"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 group-hover:bg-green-200 dark:bg-green-900/20">
              <svg
                className="h-5 w-5 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Knowledge Base</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Browse sources and docs</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
