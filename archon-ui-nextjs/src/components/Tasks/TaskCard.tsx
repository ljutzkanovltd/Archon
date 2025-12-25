"use client";

import { Card, Badge, Tooltip, Dropdown } from "flowbite-react";
import {
  HiClipboardList,
  HiClock,
  HiFlag,
  HiTag,
  HiPencil,
  HiTrash,
  HiCheckCircle,
  HiArchive,
  HiOutlineUser,
  HiClipboard,
  HiChevronDown,
} from "react-icons/hi";
import { Task } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef, useEffect } from "react";

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onArchive?: (task: Task) => void;
  onStatusChange?: (task: Task, newStatus: Task["status"]) => void;
  onAssigneeChange?: (task: Task, newAssignee: string) => void;
  compact?: boolean;
}

/**
 * Available assignees - matching original Archon agent list
 */
const AVAILABLE_ASSIGNEES = [
  "User",
  "Archon",
  "planner",
  "architect",
  "llms-expert",
  "computer-vision-expert",
  "codebase-analyst",
  "library-researcher",
  "ux-ui-researcher",
  "ui-implementation-expert",
  "backend-api-expert",
  "database-expert",
  "integration-expert",
  "testing-expert",
  "performance-expert",
  "documentation-expert",
] as const;

/**
 * Status badge color mapping
 */
const statusColors = {
  todo: "gray",
  doing: "blue",
  review: "yellow",
  done: "success",
} as const;

/**
 * Priority color mapping
 */
const priorityColors = {
  low: "gray",
  medium: "blue",
  high: "warning",
  urgent: "failure",
} as const;

/**
 * TaskCard component following SportERP card pattern
 *
 * Features:
 * - Status badge with color coding (todo/doing/review/done)
 * - Priority indicator with color coding
 * - Assignee with avatar placeholder
 * - Due date display with warning for overdue
 * - Feature tag
 * - Action buttons (Edit, Change Status, Delete)
 * - Hover effects with shadow and background transition
 * - Responsive design
 */
export function TaskCard({
  task,
  onEdit,
  onDelete,
  onArchive,
  onStatusChange,
  onAssigneeChange,
  compact = false,
}: TaskCardProps) {
  // State for expandable description
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowToggle, setShouldShowToggle] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  const formattedCreatedAt = formatDistanceToNow(new Date(task.created_at), {
    addSuffix: true,
  });

  const formattedDueDate = task.due_date
    ? formatDistanceToNow(new Date(task.due_date), { addSuffix: true })
    : null;

  const isOverdue =
    task.due_date &&
    task.status !== "done" &&
    new Date(task.due_date) < new Date();

  // Detect if description exceeds 2 lines
  useEffect(() => {
    if (descriptionRef.current && task.description) {
      const lineHeight = parseInt(
        getComputedStyle(descriptionRef.current).lineHeight
      );
      const height = descriptionRef.current.scrollHeight;
      const lines = Math.floor(height / lineHeight);
      setShouldShowToggle(lines > 2);
    }
  }, [task.description]);

  // Get next status for quick status change
  const getNextStatus = (): Task["status"] | null => {
    const statusFlow: Task["status"][] = ["todo", "doing", "review", "done"];
    const currentIndex = statusFlow.indexOf(task.status);
    return currentIndex < statusFlow.length - 1
      ? statusFlow[currentIndex + 1]
      : null;
  };

  const nextStatus = getNextStatus();

  // Compact mode for inline display in project cards
  if (compact) {
    return (
      <div className="group rounded-lg border border-gray-200 bg-white p-3 transition-all duration-200 hover:border-brand-500 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-400">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {task.title}
            </h4>
            <div className="mt-1 flex items-center gap-2">
              <Badge color={priorityColors[task.priority]} size="xs">
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </Badge>
              {task.feature && (
                <Badge color="purple" size="xs">
                  {task.feature}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {task.assignee}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Status-specific border color and glow (matching original Archon pattern)
  const statusStyles = {
    todo: {
      border: "border-l-pink-500 dark:border-l-pink-400",
      glow: "shadow-[0_0_15px_rgba(236,72,153,0.2)] dark:shadow-[0_0_15px_rgba(236,72,153,0.4)]",
    },
    doing: {
      border: "border-l-blue-500 dark:border-l-blue-400",
      glow: "shadow-[0_0_15px_rgba(59,130,246,0.2)] dark:shadow-[0_0_15px_rgba(59,130,246,0.4)]",
    },
    review: {
      border: "border-l-purple-500 dark:border-l-purple-400",
      glow: "shadow-[0_0_15px_rgba(168,85,247,0.2)] dark:shadow-[0_0_15px_rgba(168,85,247,0.4)]",
    },
    done: {
      border: "border-l-green-500 dark:border-l-green-400",
      glow: "shadow-[0_0_15px_rgba(34,197,94,0.2)] dark:shadow-[0_0_15px_rgba(34,197,94,0.4)]",
    },
  }[task.status];

  // Copy task ID to clipboard
  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(task.id);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = task.id;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  // Full mode for detailed task cards
  return (
    <div className={`relative group max-w-full min-h-[100px] rounded-lg overflow-hidden border-l-[3px] ${statusStyles.border} border-2 border-gray-200 dark:border-gray-700 transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg bg-white dark:bg-gray-800`}>
      {/* Content container - padding p-4 (16px) for SportERP consistency */}
      <div className="relative flex flex-col h-full p-4">
        {/* Header with feature and action buttons */}
        <div className="flex items-center gap-1.5 mb-2">
          {/* Archived badge */}
          {task.archived && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-500 dark:bg-gray-600 text-white text-[10px] font-bold rounded-full">
              <HiArchive className="w-3 h-3" />
              <span>ARCHIVED</span>
            </div>
          )}

          {/* Feature tag */}
          {task.feature && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-medium transition-opacity duration-200 hover:opacity-80">
              <HiTag className="w-3 h-3" />
              {task.feature}
            </span>
          )}

          {/* Action buttons group (ml-auto pushes to right) */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Copy ID Button */}
            <Tooltip content="Copy Task ID" style="light">
              <button
                type="button"
                onClick={handleCopyId}
                className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                aria-label="Copy Task ID"
              >
                <HiClipboard className="w-3 h-3" />
              </button>
            </Tooltip>

            {/* Edit Button */}
            {onEdit && (
              <Tooltip content="Edit task" style="light">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-800/40"
                  aria-label={`Edit ${task.title}`}
                >
                  <HiPencil className="w-3 h-3" />
                </button>
              </Tooltip>
            )}

            {/* Status Change Button */}
            {onStatusChange && nextStatus && (
              <Tooltip content={`Move to ${nextStatus}`} style="light">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(task, nextStatus);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/40"
                  aria-label={`Move to ${nextStatus}`}
                >
                  <HiCheckCircle className="w-3 h-3" />
                </button>
              </Tooltip>
            )}

            {/* Archive Button */}
            {onArchive && (
              <Tooltip content={task.archived ? "Restore task" : "Archive task"} style="light">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(task);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  aria-label={task.archived ? "Restore task" : "Archive task"}
                >
                  <HiArchive className="w-3 h-3" />
                </button>
              </Tooltip>
            )}

            {/* Delete Button */}
            {onDelete && (
              <Tooltip content="Delete task" style="light">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(task);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40"
                  aria-label={`Delete ${task.title}`}
                >
                  <HiTrash className="w-3 h-3" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Title - matching KnowledgeSourceCard sizing */}
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 overflow-hidden leading-tight" title={task.title}>
          {task.title}
        </h4>

        {/* Description - visible when task has description */}
        {task.description && (
          <div className="mb-2 flex-1">
            <p className="text-gray-600 dark:text-gray-400 line-clamp-3 break-words whitespace-pre-wrap opacity-80 text-xs leading-relaxed">
              {task.description}
            </p>
          </div>
        )}

        {/* Spacer when no description */}
        {!task.description && <div className="flex-1"></div>}

        {/* Footer with assignee and priority - improved spacing to match KnowledgeSourceCard */}
        <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-gray-200 dark:border-gray-700">
          {/* Assignee Dropdown */}
          <div className="flex items-center gap-1 relative">
            <HiOutlineUser className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
            <button
              type="button"
              onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
              className="group flex items-center gap-0.5 text-xs text-gray-700 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors duration-150 max-w-[140px]"
            >
              <span className="truncate font-medium">{task.assignee}</span>
              <HiChevronDown className="w-3 h-3 flex-shrink-0 transition-transform duration-150 group-hover:rotate-180" />
            </button>

            {/* Assignee Dropdown Menu */}
            {showAssigneeDropdown && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowAssigneeDropdown(false)}
                />

                {/* Dropdown content */}
                <div className="absolute left-0 bottom-full mb-1 z-20 w-56 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1 max-h-60 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
                    Assign to
                  </div>

                  {/* User & Archon */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onAssigneeChange) onAssigneeChange(task, "User");
                      setShowAssigneeDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${task.assignee === "User" ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    👤 User
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onAssigneeChange) onAssigneeChange(task, "Archon");
                      setShowAssigneeDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${task.assignee === "Archon" ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    🤖 Archon
                  </button>

                  <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                  <div className="px-3 py-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Expert Agents
                  </div>

                  {/* Expert Agents */}
                  {AVAILABLE_ASSIGNEES.filter(a => !["User", "Archon"].includes(a)).map((assignee) => (
                    <button
                      key={assignee}
                      type="button"
                      onClick={() => {
                        if (onAssigneeChange) onAssigneeChange(task, assignee);
                        setShowAssigneeDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${task.assignee === assignee ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 font-medium" : "text-gray-700 dark:text-gray-300"}`}
                    >
                      {assignee}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Priority badge */}
          <Badge color={priorityColors[task.priority]} size="xs">
            {task.priority.charAt(0).toUpperCase()}
          </Badge>
        </div>
      </div>
    </div>
  );
}

/**
 * TaskCardSkeleton - Loading placeholder
 */
export function TaskCardSkeleton() {
  return (
    <Card className="max-w-full animate-pulse">
      {/* Status Badge Skeleton */}
      <div className="absolute right-4 top-4">
        <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Header Skeleton */}
      <div className="mb-4 flex items-start gap-3">
        <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2 pr-16">
          <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-1/4 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      {/* Description Skeleton */}
      <div className="mb-4 space-y-2">
        <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Metadata Skeleton */}
      <div className="mb-4 space-y-2">
        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Action Buttons Skeleton */}
      <div className="flex gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="h-8 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-8 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-8 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </Card>
  );
}
