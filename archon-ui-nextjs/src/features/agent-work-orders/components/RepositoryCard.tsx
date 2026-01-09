"use client";

/**
 * Repository Card Component
 *
 * Displays a configured repository with work order statistics.
 * Adapted to archon-ui-nextjs patterns using Flowbite components.
 */

import { Card, Badge, Button } from "flowbite-react";
import { HiFolder, HiClock, HiLightningBolt, HiCheckCircle, HiPencil, HiTrash, HiClipboard } from "react-icons/hi";
import { useAgentWorkOrdersStore } from "../state/agentWorkOrdersStore";
import type { ConfiguredRepository } from "../types/repository";

export interface RepositoryCardProps {
  /** Repository data to display */
  repository: ConfiguredRepository;

  /** Whether this repository is currently selected */
  isSelected?: boolean;

  /** Callback when repository is selected */
  onSelect?: () => void;

  /** Callback when delete button is clicked */
  onDelete?: () => void;

  /** Work order statistics for this repository */
  stats?: {
    total: number;
    active: number;
    done: number;
  };
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy:", err);
    return false;
  }
}

export function RepositoryCard({
  repository,
  isSelected = false,
  onSelect,
  onDelete,
  stats = { total: 0, active: 0, done: 0 },
}: RepositoryCardProps) {
  // Get modal action from Zustand store (no prop drilling)
  const openEditRepoModal = useAgentWorkOrdersStore((s) => s.openEditRepoModal);

  const handleCopyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await copyToClipboard(repository.repository_url);
    if (success) {
      console.log("Repository URL copied to clipboard");
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    openEditRepoModal(repository);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete();
    }
  };

  const displayName = repository.display_name || repository.repository_url.replace("https://github.com/", "");

  return (
    <Card
      onClick={onSelect}
      className={`group max-w-sm cursor-pointer transition-all duration-200 ${
        isSelected
          ? "border-brand-500 bg-brand-50 shadow-lg dark:border-brand-400 dark:bg-brand-900/20"
          : "hover:bg-gray-50 hover:shadow-lg dark:hover:bg-gray-700/50"
      }`}
    >
      {/* Header with Icon and Title */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900">
          <HiFolder className="h-6 w-6 text-brand-600 dark:text-brand-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-lg font-semibold text-gray-900 dark:text-white" title={displayName}>
            {displayName}
          </h3>
          {repository.is_verified && (
            <Badge color="success" size="xs" className="mt-1">
              ✓ Verified
            </Badge>
          )}
        </div>
      </div>

      {/* Work Order Statistics */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {/* Total */}
        <div className="rounded-lg border border-pink-200 bg-pink-50 p-2 text-center dark:border-pink-700 dark:bg-pink-900/20">
          <HiClock className="mx-auto mb-1 h-4 w-4 text-pink-600 dark:text-pink-400" />
          <div className="text-lg font-bold text-pink-600 dark:text-pink-400">{stats.total}</div>
          <div className="text-[10px] text-gray-600 dark:text-gray-400">Total</div>
        </div>

        {/* Active */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-center dark:border-blue-700 dark:bg-blue-900/20">
          <HiLightningBolt className="mx-auto mb-1 h-4 w-4 text-blue-600 dark:text-blue-400" />
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.active}</div>
          <div className="text-[10px] text-gray-600 dark:text-gray-400">Active</div>
        </div>

        {/* Done */}
        <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-center dark:border-green-700 dark:bg-green-900/20">
          <HiCheckCircle className="mx-auto mb-1 h-4 w-4 text-green-600 dark:text-green-400" />
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.done}</div>
          <div className="text-[10px] text-gray-600 dark:text-gray-400">Done</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
        <Button
          size="xs"
          color="light"
          onClick={handleEdit}
          title="Edit repository"
        >
          <HiPencil className="mr-1 h-3 w-3" />
          Edit
        </Button>
        <Button
          size="xs"
          color="light"
          onClick={handleCopyUrl}
          title="Copy repository URL"
        >
          <HiClipboard className="mr-1 h-3 w-3" />
          Copy
        </Button>
        <Button
          size="xs"
          color="failure"
          onClick={handleDelete}
          title="Delete repository"
        >
          <HiTrash className="mr-1 h-3 w-3" />
          Delete
        </Button>
      </div>
    </Card>
  );
}

/**
 * RepositoryCardSkeleton - Loading placeholder
 */
export function RepositoryCardSkeleton() {
  return (
    <Card className="max-w-sm animate-pulse">
      {/* Header Skeleton */}
      <div className="mb-4 flex items-start gap-3">
        <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      {/* URL Skeleton */}
      <div className="mb-4 space-y-2">
        <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="h-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Buttons Skeleton */}
      <div className="flex gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </Card>
  );
}
