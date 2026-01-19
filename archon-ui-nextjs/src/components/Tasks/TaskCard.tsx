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
  HiArrowDown,
  HiMinus,
  HiArrowUp,
  HiExclamation,
  HiCalendar,
} from "react-icons/hi";
import { Task } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef, useEffect } from "react";
import React from "react";
import { useSprints } from "@/features/sprints/hooks/useSprintQueries";

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onArchive?: (task: Task) => void;
  onStatusChange?: (task: Task, newStatus: Task["status"]) => void;
  onAssigneeChange?: (task: Task, newAssignee: string) => void;
  compact?: boolean;
  variant?: "default" | "grid";
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
 * Updated for new workflow statuses: backlog, in_progress, review, done
 */
const statusColors = {
  // New workflow statuses
  backlog: "gray",
  in_progress: "blue",
  review: "yellow",
  done: "success",
  // Legacy support
  todo: "gray",
  doing: "blue",
} as const;

/**
 * Priority configuration with colors and icons for accessibility
 */
const priorityConfig = {
  low: { color: "gray" as const, icon: HiArrowDown },
  medium: { color: "blue" as const, icon: HiMinus },
  high: { color: "warning" as const, icon: HiArrowUp },
  urgent: { color: "failure" as const, icon: HiExclamation },
};

/**
 * Safe priority accessor with fallback to medium if undefined
 */
const getPriorityConfig = (priority: string | undefined) => {
  return priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium;
};

/**
 * Priority color mapping (for backward compatibility)
 */
const priorityColors = {
  low: priorityConfig.low.color,
  medium: priorityConfig.medium.color,
  high: priorityConfig.high.color,
  urgent: priorityConfig.urgent.color,
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
  variant = "default",
}: TaskCardProps) {
  // State for expandable description
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowToggle, setShouldShowToggle] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  // Fetch sprint data if task has sprint_id
  const { data: sprintsData } = useSprints(task.project_id);
  const sprint = sprintsData?.sprints?.find((s) => s.id === task.sprint_id);

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

  // Focus management for keyboard navigation
  useEffect(() => {
    if (showAssigneeDropdown && focusedIndex >= 0) {
      const listbox = document.getElementById("assignee-listbox");
      if (listbox) {
        const options = listbox.querySelectorAll('[role="option"]');
        const focusedOption = options[focusedIndex] as HTMLElement;
        if (focusedOption) {
          focusedOption.focus();
        }
      }
    }
  }, [focusedIndex, showAssigneeDropdown]);

  // Get next status for quick status change
  // Updated for new workflow statuses: backlog → in_progress → review → done
  const getNextStatus = (): Task["status"] | null => {
    const statusFlow: Task["status"][] = ["backlog", "in_progress", "review", "done"];
    const currentIndex = statusFlow.indexOf(task.status);
    return currentIndex < statusFlow.length - 1
      ? statusFlow[currentIndex + 1]
      : null;
  };

  // Keyboard navigation for assignee dropdown
  const handleDropdownKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setShowAssigneeDropdown(!showAssigneeDropdown);
      setFocusedIndex(-1);
    } else if (e.key === "Escape") {
      setShowAssigneeDropdown(false);
      setFocusedIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setShowAssigneeDropdown(true);
      setFocusedIndex(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setShowAssigneeDropdown(true);
      setFocusedIndex(AVAILABLE_ASSIGNEES.length - 1);
    }
  };

  const handleListItemKeyNav = (e: React.KeyboardEvent, assignee: string, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onAssigneeChange) onAssigneeChange(task, assignee);
      setShowAssigneeDropdown(false);
      setFocusedIndex(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowAssigneeDropdown(false);
      setFocusedIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((index + 1) % AVAILABLE_ASSIGNEES.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((index - 1 + AVAILABLE_ASSIGNEES.length) % AVAILABLE_ASSIGNEES.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedIndex(AVAILABLE_ASSIGNEES.length - 1);
    }
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
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge color={getPriorityConfig(task.priority).color} size="xs">
                {React.createElement(getPriorityConfig(task.priority).icon, {
                  className: "w-3 h-3 mr-0.5 inline",
                  "aria-hidden": "true"
                })}
                {(task.priority || "medium").charAt(0).toUpperCase() + (task.priority || "medium").slice(1)}
              </Badge>
              {sprint && (
                <Badge color="info" size="xs">
                  <HiCalendar className="w-3 h-3 mr-0.5 inline" />
                  {sprint.name}
                </Badge>
              )}
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
  // Map new workflow status names to visual styles
  // New: backlog, in_progress, review, done
  // Old (legacy): todo, doing, review, done
  const statusStylesMap: Record<string, { border: string; glow: string }> = {
    // New workflow statuses
    backlog: {
      border: "border-l-gray-500 dark:border-l-gray-400",
      glow: "shadow-[0_0_15px_rgba(107,114,128,0.2)] dark:shadow-[0_0_15px_rgba(107,114,128,0.4)]",
    },
    in_progress: {
      border: "border-l-blue-500 dark:border-l-blue-400",
      glow: "shadow-[0_0_15px_rgba(59,130,246,0.2)] dark:shadow-[0_0_15px_rgba(59,130,246,0.4)]",
    },
    review: {
      border: "border-l-yellow-500 dark:border-l-yellow-400",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.2)] dark:shadow-[0_0_15px_rgba(245,158,11,0.4)]",
    },
    done: {
      border: "border-l-green-500 dark:border-l-green-400",
      glow: "shadow-[0_0_15px_rgba(34,197,94,0.2)] dark:shadow-[0_0_15px_rgba(34,197,94,0.4)]",
    },
    // Legacy support (for backward compatibility)
    todo: {
      border: "border-l-gray-500 dark:border-l-gray-400",
      glow: "shadow-[0_0_15px_rgba(107,114,128,0.2)] dark:shadow-[0_0_15px_rgba(107,114,128,0.4)]",
    },
    doing: {
      border: "border-l-blue-500 dark:border-l-blue-400",
      glow: "shadow-[0_0_15px_rgba(59,130,246,0.2)] dark:shadow-[0_0_15px_rgba(59,130,246,0.4)]",
    },
  };

  const statusStyles = statusStylesMap[task.status] || statusStylesMap.backlog;

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

  // Grid mode - compact card for grid view
  if (variant === "grid") {
    return (
      <div
        className={`group rounded-lg border-l-[3px] ${statusStyles.border} border border-gray-200 bg-white p-2.5 transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 cursor-pointer`}
        onClick={() => onEdit?.(task)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit?.(task);
          }
        }}
        aria-label={`Task: ${task.title}. Status: ${task.status}. Priority: ${task.priority}. ${sprint ? `Sprint: ${sprint.name}.` : ""} Click to edit.`}
      >
        {/* Title - single line, truncated */}
        <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-white mb-1.5" title={task.title}>
          {task.title}
        </h4>
        {/* Status + Priority + Sprint badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge color={statusColors[task.status]} size="xs">
            {task.status}
          </Badge>
          <Badge color={getPriorityConfig(task.priority).color} size="xs">
            {React.createElement(getPriorityConfig(task.priority).icon, {
              className: "w-3 h-3 mr-0.5 inline",
              "aria-hidden": "true"
            })}
            {task.priority.charAt(0).toUpperCase()}
          </Badge>
          {sprint && (
            <Badge color="info" size="xs">
              <HiCalendar className="w-3 h-3 mr-0.5 inline" />
              {sprint.name.length > 15 ? sprint.name.substring(0, 12) + "..." : sprint.name}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  // Full mode for detailed task cards (default/kanban)
  return (
    <div className={`relative group max-w-full min-h-[100px] rounded-lg overflow-hidden border-l-[3px] ${statusStyles.border} border-2 border-gray-200 dark:border-gray-700 transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg bg-white dark:bg-gray-800`}>
      {/* Content container - padding p-4 (16px) for SportERP consistency */}
      <div className="relative flex flex-col h-full p-4">
        {/* Header with feature and action buttons */}
        <div className="flex items-center gap-1.5 mb-2">
          {/* Archived badge */}
          {task.archived && (
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-500 dark:bg-gray-600 text-white text-xs font-bold rounded-full">
              <HiArchive className="w-3 h-3" />
              <span>ARCHIVED</span>
            </div>
          )}

          {/* Sprint badge */}
          {sprint && (
            <Tooltip content={`Sprint: ${sprint.name}${sprint.goal ? ` - ${sprint.goal}` : ""}`} style="light" trigger="hover">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-medium transition-opacity duration-200 hover:opacity-80">
                <HiCalendar className="w-3 h-3" />
                {sprint.name}
              </span>
            </Tooltip>
          )}

          {/* Feature tag */}
          {task.feature && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium transition-opacity duration-200 hover:opacity-80">
              <HiTag className="w-3 h-3" />
              {task.feature}
            </span>
          )}

          {/* Action buttons group (ml-auto pushes to right) */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Copy ID Button */}
            <Tooltip content="Copy Task ID" style="light" trigger="hover">
              <button
                type="button"
                onClick={handleCopyId}
                className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-2 focus:ring-brand-500"
                aria-label="Copy Task ID"
              >
                <HiClipboard className="w-3 h-3" aria-hidden="true" />
                <span className="sr-only">Copy Task ID</span>
              </button>
            </Tooltip>

            {/* Edit Button */}
            {onEdit && (
              <Tooltip content="Edit task" style="light" trigger="hover">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-800/40 focus:ring-2 focus:ring-brand-500"
                  aria-label={`Edit ${task.title}`}
                >
                  <HiPencil className="w-3 h-3" aria-hidden="true" />
                  <span className="sr-only">Edit {task.title}</span>
                </button>
              </Tooltip>
            )}

            {/* Status Change Button */}
            {onStatusChange && nextStatus && (
              <Tooltip content={`Move to ${nextStatus}`} style="light" trigger="hover">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(task, nextStatus);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/40 focus:ring-2 focus:ring-brand-500"
                  aria-label={`Move to ${nextStatus}`}
                >
                  <HiCheckCircle className="w-3 h-3" aria-hidden="true" />
                  <span className="sr-only">Move to {nextStatus}</span>
                </button>
              </Tooltip>
            )}

            {/* Archive Button */}
            {onArchive && (
              <Tooltip content={task.archived ? "Restore task" : "Archive task"} style="light" trigger="hover">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchive(task);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-2 focus:ring-brand-500"
                  aria-label={task.archived ? "Restore task" : "Archive task"}
                >
                  <HiArchive className="w-3 h-3" aria-hidden="true" />
                  <span className="sr-only">{task.archived ? "Restore task" : "Archive task"}</span>
                </button>
              </Tooltip>
            )}

            {/* Delete Button */}
            {onDelete && (
              <Tooltip content="Delete task" style="light" trigger="hover">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(task);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40 focus:ring-2 focus:ring-brand-500"
                  aria-label={`Delete ${task.title}`}
                >
                  <HiTrash className="w-3 h-3" aria-hidden="true" />
                  <span className="sr-only">Delete {task.title}</span>
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
            <p
              id={`task-description-${task.id}`}
              ref={descriptionRef}
              className={`text-gray-600 dark:text-gray-400 break-words whitespace-pre-wrap opacity-80 text-sm leading-relaxed ${
                isExpanded ? "" : "line-clamp-3"
              }`}
            >
              {task.description}
            </p>
            {shouldShowToggle && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                aria-controls={`task-description-${task.id}`}
                className="mt-1 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 focus:ring-2 focus:ring-brand-500 focus:outline-none rounded"
              >
                {isExpanded ? "Show less" : "Show more"}
              </button>
            )}
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
              onKeyDown={handleDropdownKeyNav}
              className="group flex items-center gap-0.5 text-xs text-gray-700 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors duration-150 max-w-[140px] focus:ring-2 focus:ring-brand-500 focus:outline-none rounded"
              aria-haspopup="listbox"
              aria-expanded={showAssigneeDropdown}
              aria-controls="assignee-listbox"
              aria-label={`Change assignee. Current assignee: ${task.assignee}`}
            >
              <span className="truncate font-medium">{task.assignee}</span>
              <HiChevronDown className="w-3 h-3 flex-shrink-0 transition-transform duration-150 group-hover:rotate-180" aria-hidden="true" />
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
                <div
                  id="assignee-listbox"
                  role="listbox"
                  aria-label="Assignee options"
                  className="absolute left-0 bottom-full mb-1 z-20 w-56 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1 max-h-60 overflow-y-auto"
                >
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
                    Assign to
                  </div>

                  {/* User & Archon */}
                  <div
                    role="option"
                    aria-selected={task.assignee === "User"}
                    tabIndex={focusedIndex === 0 ? 0 : -1}
                    onClick={() => {
                      if (onAssigneeChange) onAssigneeChange(task, "User");
                      setShowAssigneeDropdown(false);
                      setFocusedIndex(-1);
                    }}
                    onKeyDown={(e) => handleListItemKeyNav(e, "User", 0)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus:ring-2 focus:ring-brand-500 focus:outline-none ${
                      focusedIndex === 0 ? "bg-gray-100 dark:bg-gray-700" : ""
                    } ${task.assignee === "User" ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    👤 User
                  </div>
                  <div
                    role="option"
                    aria-selected={task.assignee === "Archon"}
                    tabIndex={focusedIndex === 1 ? 0 : -1}
                    onClick={() => {
                      if (onAssigneeChange) onAssigneeChange(task, "Archon");
                      setShowAssigneeDropdown(false);
                      setFocusedIndex(-1);
                    }}
                    onKeyDown={(e) => handleListItemKeyNav(e, "Archon", 1)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus:ring-2 focus:ring-brand-500 focus:outline-none ${
                      focusedIndex === 1 ? "bg-gray-100 dark:bg-gray-700" : ""
                    } ${task.assignee === "Archon" ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300" : "text-gray-700 dark:text-gray-300"}`}
                  >
                    🤖 Archon
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Expert Agents
                  </div>

                  {/* Expert Agents */}
                  {AVAILABLE_ASSIGNEES.filter(a => !["User", "Archon"].includes(a)).map((assignee, idx) => {
                    const index = idx + 2; // Offset by 2 for User and Archon
                    return (
                      <div
                        key={assignee}
                        role="option"
                        aria-selected={task.assignee === assignee}
                        tabIndex={focusedIndex === index ? 0 : -1}
                        onClick={() => {
                          if (onAssigneeChange) onAssigneeChange(task, assignee);
                          setShowAssigneeDropdown(false);
                          setFocusedIndex(-1);
                        }}
                        onKeyDown={(e) => handleListItemKeyNav(e, assignee, index)}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus:ring-2 focus:ring-brand-500 focus:outline-none ${
                          focusedIndex === index ? "bg-gray-100 dark:bg-gray-700" : ""
                        } ${task.assignee === assignee ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 font-medium" : "text-gray-700 dark:text-gray-300"}`}
                      >
                        {assignee}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Priority badge */}
          <Badge color={getPriorityConfig(task.priority).color} size="xs">
            {React.createElement(getPriorityConfig(task.priority).icon, {
              className: "w-3 h-3 mr-0.5 inline",
              "aria-hidden": "true"
            })}
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
