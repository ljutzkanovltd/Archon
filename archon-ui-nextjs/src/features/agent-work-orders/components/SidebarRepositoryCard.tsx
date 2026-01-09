"use client";

/**
 * Sidebar Repository Card Component
 *
 * Compact version of RepositoryCard for sidebar layout.
 * Shows repository name and inline stat badges.
 * Adapted to archon-ui-nextjs patterns using Flowbite components.
 */

import { Card, Badge, Button } from "flowbite-react";
import { HiClock, HiLightningBolt, HiCheckCircle, HiPencil, HiTrash, HiClipboard } from "react-icons/hi";
import { useAgentWorkOrdersStore } from "../state/agentWorkOrdersStore";
import type { ConfiguredRepository } from "../types/repository";

export interface SidebarRepositoryCardProps {
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

export function SidebarRepositoryCard({
  repository,
  isSelected = false,
  onSelect,
  onDelete,
  stats = { total: 0, active: 0, done: 0 },
}: SidebarRepositoryCardProps) {
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
      className={`cursor-pointer p-2 transition-all duration-200 ${
        isSelected
          ? "border-brand-500 bg-brand-50 shadow-md dark:border-brand-400 dark:bg-brand-900/20"
          : "hover:bg-gray-50 hover:shadow-md dark:hover:bg-gray-700/50"
      }`}
    >
      {/* Title */}
      <div className="mb-2 text-center">
        <h4
          className={`line-clamp-1 text-sm font-medium ${
            isSelected
              ? "text-brand-700 dark:text-brand-300"
              : "text-gray-700 dark:text-gray-300"
          }`}
          title={displayName}
        >
          {displayName}
        </h4>
      </div>

      {/* Status Badges - all 3 in one row - centered */}
      <div className="mb-2 flex items-center justify-center gap-1.5">
        <Badge color="pink" size="sm" icon={HiClock} title={`${stats.total} total`}>
          {stats.total}
        </Badge>
        <Badge color="info" size="sm" icon={HiLightningBolt} title={`${stats.active} active`}>
          {stats.active}
        </Badge>
        <Badge color="success" size="sm" icon={HiCheckCircle} title={`${stats.done} done`}>
          {stats.done}
        </Badge>
      </div>

      {/* Action buttons bar */}
      <div className="flex items-center justify-center gap-1 border-t border-gray-200 pt-2 dark:border-gray-700">
        <Button
          size="xs"
          color="light"
          onClick={handleEdit}
          title="Edit repository"
          className="p-1"
        >
          <HiPencil className="h-3 w-3" />
        </Button>
        <Button
          size="xs"
          color="light"
          onClick={handleCopyUrl}
          title="Copy repository URL"
          className="p-1"
        >
          <HiClipboard className="h-3 w-3" />
        </Button>
        <Button
          size="xs"
          color="failure"
          onClick={handleDelete}
          title="Delete repository"
          className="p-1"
        >
          <HiTrash className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
