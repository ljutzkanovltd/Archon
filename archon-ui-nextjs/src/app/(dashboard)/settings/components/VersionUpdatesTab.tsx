"use client";

import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HiInformationCircle, HiCheckCircle, HiExclamationCircle, HiRefresh } from "react-icons/hi";
import apiClient from "@/lib/apiClient";

// ==================== TYPES ====================

interface ReleaseAsset {
  name: string;
  size: number;
  download_count: number;
  browser_download_url: string;
  content_type: string;
}

interface VersionCheckResponse {
  current: string;
  latest: string | null;
  update_available: boolean;
  release_url: string | null;
  release_notes: string | null;
  published_at: string | null;
  check_error?: string | null;
  assets?: ReleaseAsset[] | null;
  author?: string | null;
}

// ==================== API SERVICE ====================

const versionService = {
  /**
   * Check for available Archon updates
   */
  async checkVersion(): Promise<VersionCheckResponse> {
    const response = await apiClient.get("/api/version/check");
    return response.data;
  },

  /**
   * Clear version cache to force fresh check
   */
  async clearCache(): Promise<{ message: string; success: boolean }> {
    const response = await apiClient.post("/api/version/clear-cache");
    return response.data;
  },
};

// ==================== QUERY KEYS ====================

const versionKeys = {
  all: ["version"] as const,
  check: () => [...versionKeys.all, "check"] as const,
};

// ==================== HOOKS ====================

/**
 * Hook to check for version updates
 * Polls every 5 minutes when tab is visible
 */
function useVersionCheck() {
  return useQuery<VersionCheckResponse>({
    queryKey: versionKeys.check(),
    queryFn: () => versionService.checkVersion(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on 404 or network errors
  });
}

/**
 * Hook to clear version cache and force fresh check
 */
function useClearVersionCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => versionService.clearCache(),
    onSuccess: () => {
      // Invalidate version queries to force fresh check
      queryClient.invalidateQueries({ queryKey: versionKeys.all });
    },
  });
}

// ==================== COMPONENT ====================

export default function VersionUpdatesTab() {
  const { data, isLoading, error, refetch } = useVersionCheck();
  const clearCache = useClearVersionCache();

  const handleRefreshClick = async () => {
    // Clear cache and then refetch
    await clearCache.mutateAsync();
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Version & Updates
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Check for Archon updates and view version information
        </p>
      </div>

      {/* Version Status Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HiInformationCircle className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Version Information
            </h3>
          </div>
          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={isLoading || clearCache.isPending}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-700"
            aria-label="Refresh version check"
          >
            <HiRefresh
              className={`h-4 w-4 text-gray-500 dark:text-gray-400 ${
                isLoading || clearCache.isPending ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>

        <div className="space-y-3">
          {/* Current Version */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Current Version
            </span>
            <span className="font-mono text-sm text-gray-900 dark:text-white">
              {data?.current || "Loading..."}
            </span>
          </div>

          {/* Latest Version */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Latest Version
            </span>
            <span className="font-mono text-sm text-gray-900 dark:text-white">
              {isLoading
                ? "Checking..."
                : error
                  ? "Check failed"
                  : data?.latest
                    ? data.latest
                    : "No releases found"}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Status
            </span>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  <span className="text-sm text-blue-500 dark:text-blue-400">
                    Checking...
                  </span>
                </>
              ) : error ? (
                <>
                  <HiExclamationCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                  <span className="text-sm text-red-500 dark:text-red-400">
                    Error checking
                  </span>
                </>
              ) : data?.update_available ? (
                <>
                  <HiExclamationCircle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                  <span className="text-sm text-yellow-500 dark:text-yellow-400">
                    Update available
                  </span>
                </>
              ) : (
                <>
                  <HiCheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                  <span className="text-sm text-green-500 dark:text-green-400">
                    Up to date
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Released Date */}
          {data?.published_at && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Released
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {new Date(data.published_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
            <p className="text-sm text-red-600 dark:text-red-400">
              {data?.check_error ||
                "Failed to check for updates. Please try again later."}
            </p>
          </div>
        )}

        {/* Update Available Banner */}
        {data?.update_available && data.latest && (
          <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
            <div className="flex items-start gap-3">
              <HiExclamationCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
              <div className="flex-1">
                <p className="font-medium text-yellow-800 dark:text-yellow-300">
                  Update Available
                </p>
                <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                  Version {data.latest} is now available. You are currently
                  running version {data.current}.
                </p>
                {data.release_url && (
                  <a
                    href={data.release_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-yellow-700 underline hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
                  >
                    View Release Notes →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Release Notes */}
      {data?.release_notes && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
            Release Notes
          </h3>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
              {data.release_notes}
            </pre>
          </div>
          {data.release_url && (
            <div className="mt-4">
              <a
                href={data.release_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                View Full Release on GitHub →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Release Assets */}
      {data?.assets && data.assets.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
            Download Assets
          </h3>
          <div className="space-y-2">
            {data.assets.map((asset) => (
              <a
                key={asset.name}
                href={asset.browser_download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {asset.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(asset.size / 1024 / 1024).toFixed(2)} MB •{" "}
                    {asset.download_count.toLocaleString()} downloads
                  </p>
                </div>
                <span className="text-sm text-brand-600 dark:text-brand-400">
                  Download →
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Author Info */}
      {data?.author && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Released by:{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {data.author}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
