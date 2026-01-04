"use client";

import React, { FC, memo } from "react";
import { cn } from "@/lib/utils";
import RowMenu, { RowMenuAction } from "../../RowMenu";
import { DataTableButton } from "../context/DataTableContext";

/**
 * RowActions Component
 *
 * Displays row actions with the "primary action" pattern:
 * - First action is shown as a visible button
 * - Remaining actions are in a 3-dots overflow menu
 *
 * This improves UX by making the most common action (usually "View")
 * immediately accessible without opening a dropdown.
 *
 * @example
 * <RowActions
 *   actions={[
 *     { label: "View", icon: HiEye, onClick: handleView },
 *     { label: "Edit", icon: HiPencil, onClick: handleEdit },
 *     { label: "Delete", icon: HiTrash, onClick: handleDelete, variant: "danger" },
 *   ]}
 *   showPrimary={true}
 * />
 */

export interface RowActionsProps {
  /** Array of action buttons for this row */
  actions: DataTableButton[];
  /** Whether to show the first action as a visible button (default: true) */
  showPrimary?: boolean;
  /** Additional class name for the container */
  className?: string;
  /** Size variant for buttons */
  size?: "sm" | "md";
}

const RowActions: FC<RowActionsProps> = memo(({
  actions,
  showPrimary = true,
  className,
  size = "sm",
}) => {
  // No actions = no render
  if (!actions || actions.length === 0) {
    return null;
  }

  // Single action - show as button (no dropdown needed)
  if (actions.length === 1) {
    const action = actions[0];
    const Icon = action.icon;

    return (
      <div className={cn("flex items-center justify-end", className)}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
          }}
          disabled={action.disabled}
          className={cn(
            "inline-flex items-center gap-1.5 font-medium rounded transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1",
            size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
            action.variant === "primary"
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : action.variant === "danger"
                ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
            action.disabled && "opacity-50 cursor-not-allowed"
          )}
          aria-label={action.ariaLabel || action.label}
        >
          {Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
          <span>{action.label}</span>
        </button>
      </div>
    );
  }

  // Multiple actions with primary pattern disabled - show all in dropdown
  if (!showPrimary) {
    const menuActions: RowMenuAction[] = actions.map((action) => ({
      label: action.label,
      icon: action.icon,
      onClick: action.onClick,
      variant: action.variant === "danger" ? "danger" : "default",
      disabled: action.disabled,
      ariaLabel: action.ariaLabel,
    }));

    return (
      <div className={cn("flex items-center justify-end", className)}>
        <RowMenu actions={menuActions} direction="bottom-end" />
      </div>
    );
  }

  // Multiple actions with primary pattern - split primary and overflow
  const [primaryAction, ...overflowActions] = actions;
  const PrimaryIcon = primaryAction.icon;

  const overflowMenuActions: RowMenuAction[] = overflowActions.map((action) => ({
    label: action.label,
    icon: action.icon,
    onClick: action.onClick,
    variant: action.variant === "danger" ? "danger" : "default",
    disabled: action.disabled,
    ariaLabel: action.ariaLabel,
  }));

  return (
    <div className={cn("flex items-center justify-end gap-1", className)}>
      {/* Primary Action Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          primaryAction.onClick();
        }}
        disabled={primaryAction.disabled}
        className={cn(
          "inline-flex items-center gap-1.5 font-medium rounded transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1",
          size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
          primaryAction.variant === "primary"
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : primaryAction.variant === "danger"
              ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
          primaryAction.disabled && "opacity-50 cursor-not-allowed"
        )}
        aria-label={primaryAction.ariaLabel || primaryAction.label}
      >
        {PrimaryIcon && <PrimaryIcon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
        <span>{primaryAction.label}</span>
      </button>

      {/* Overflow Menu (3-dots) */}
      {overflowMenuActions.length > 0 && (
        <RowMenu
          actions={overflowMenuActions}
          direction="bottom-end"
          triggerClassName={cn(
            size === "sm" ? "h-7 w-7" : "h-8 w-8"
          )}
        />
      )}
    </div>
  );
});

RowActions.displayName = "RowActions";

export default RowActions;
