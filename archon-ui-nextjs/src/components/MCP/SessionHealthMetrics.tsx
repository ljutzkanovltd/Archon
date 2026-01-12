"use client";

import { useMcpWebSocket } from "@/hooks";
import { HiCheckCircle, HiExclamationCircle, HiClock, HiUsers, HiTrendingUp, HiTrendingDown, HiWifi } from "react-icons/hi";

export function SessionHealthMetrics() {
  const { data: health, isLoading, isConnected, usingFallback, reconnect } = useMcpWebSocket();

  if (isLoading || !health) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Session Health Metrics
        </h2>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  // Validate health data structure
  if (!health.status_breakdown || !health.age_distribution || !health.connection_health || !health.recent_activity) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[SessionHealthMetrics] Invalid health data structure:', health);
    }
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-red-900 dark:text-red-300 mb-4">
          Invalid Health Data
        </h2>
        <p className="text-red-600 dark:text-red-400 text-sm">
          Received incomplete health data from server. Please check backend API.
        </p>
      </div>
    );
  }

  const { status_breakdown, age_distribution, connection_health, recent_activity } = health;

  // Calculate percentages
  const activePercent = status_breakdown.total > 0
    ? Math.round((status_breakdown.active / status_breakdown.total) * 100)
    : 0;

  const healthyPercent = (age_distribution.healthy + age_distribution.aging + age_distribution.stale) > 0
    ? Math.round((age_distribution.healthy / (age_distribution.healthy + age_distribution.aging + age_distribution.stale)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Session Health Metrics Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Session Health Metrics
            </h2>

            {/* Connection Status Indicator */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <HiWifi className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">
                    Live
                  </span>
                </div>
              ) : usingFallback ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <HiClock className="w-4 h-4 text-yellow-500 animate-pulse" />
                  <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                    Polling (10s)
                  </span>
                  <button
                    onClick={() => reconnect()}
                    className="ml-1 text-xs underline hover:no-underline"
                  >
                    Retry WS
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <HiExclamationCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-300">
                    Disconnected
                  </span>
                  <button
                    onClick={() => reconnect()}
                    className="ml-1 text-xs underline hover:no-underline"
                  >
                    Reconnect
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Active Sessions</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">{status_breakdown.active}</p>
                </div>
                <HiCheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <div className="mt-2">
                <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                  <span>{activePercent}% of total</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Disconnected</p>
                  <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">{status_breakdown.disconnected}</p>
                </div>
                <HiExclamationCircle className="w-10 h-10 text-gray-400" />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Sessions</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{status_breakdown.total}</p>
                </div>
                <HiUsers className="w-10 h-10 text-blue-500" />
              </div>
            </div>
          </div>

          {/* Age Distribution */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Session Age Distribution (Active Sessions)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Healthy</span>
                  <HiCheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{age_distribution.healthy}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">&lt; 5 minutes idle</p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Aging</span>
                  <HiClock className="w-5 h-5 text-yellow-500" />
                </div>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{age_distribution.aging}</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">5-10 minutes idle</p>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-red-600 dark:text-red-400 font-medium">Stale</span>
                  <HiExclamationCircle className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{age_distribution.stale}</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">&gt; 10 minutes idle</p>
              </div>
            </div>
          </div>

          {/* Connection Health (24h) */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Connection Health (Last 24 Hours)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Duration</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {connection_health.avg_duration_seconds != null
                    ? `${Math.floor(connection_health.avg_duration_seconds / 60)}m`
                    : 'N/A'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {connection_health.avg_duration_seconds != null
                    ? `${connection_health.avg_duration_seconds}s`
                    : ''}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sessions/Hour</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {connection_health.sessions_per_hour}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Disconnect Rate</p>
                <div className="flex items-baseline">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {connection_health.disconnect_rate_percent != null
                      ? `${connection_health.disconnect_rate_percent}%`
                      : 'N/A'}
                  </p>
                  {connection_health.disconnect_rate_percent != null && connection_health.disconnect_rate_percent > 50 ? (
                    <HiTrendingUp className="w-5 h-5 text-red-500 ml-2" />
                  ) : connection_health.disconnect_rate_percent != null ? (
                    <HiTrendingDown className="w-5 h-5 text-green-500 ml-2" />
                  ) : null}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {connection_health.total_sessions_24h}
                </p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Recent Activity
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Session
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Idle Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Uptime
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {recent_activity.map((session, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <code className="text-xs text-gray-900 dark:text-gray-100 font-mono bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                          {session.session_id}
                        </code>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {session.client_type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          session.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {session.age_minutes} min
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {session.uptime_minutes} min
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Last Updated */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {new Date(health.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
