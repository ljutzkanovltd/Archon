"use client";

import React, { FC, useCallback, useEffect, useRef, useState } from "react";
import { HiDotsVertical } from "react-icons/hi";
import { cn } from "@/lib/utils";

/**
 * RowMenu - 3-dots dropdown action menu for table rows
 *
 * Uses CSS-based positioning (relative parent + absolute child) for reliable
 * dropdown placement. This approach works correctly inside scrollable containers
 * and avoids the issues with fixed positioning and viewport clamping.
 *
 * Pattern: Parent `relative` + Child `absolute` with direction classes
 */

export interface RowMenuAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  ariaLabel?: string;
}

interface RowMenuProps {
  actions: RowMenuAction[];
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  /** Direction to open the menu. Default is "bottom-end" (below trigger, right-aligned) */
  direction?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
}

/**
 * CSS classes for each direction - uses Tailwind absolute positioning
 */
const DIRECTION_CLASSES = {
  "bottom-start": "top-full left-0 mt-1",
  "bottom-end": "top-full right-0 mt-1",
  "top-start": "bottom-full left-0 mb-1",
  "top-end": "bottom-full right-0 mb-1",
} as const;

const RowMenu: FC<RowMenuProps> = ({
  actions,
  className,
  triggerClassName,
  menuClassName,
  direction = "bottom-end", // Default: below trigger, right-aligned (best for table rows)
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close menu
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    // Use mousedown for better UX (closes before click handlers fire)
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const handleActionClick = useCallback(
    (action: RowMenuAction, e: React.MouseEvent) => {
      e.stopPropagation();
      if (action.disabled) return;
      action.onClick();
      setIsOpen(false);
    },
    []
  );

  if (actions.length === 0) return null;

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* 3-dots trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex items-center justify-center h-8 w-8 rounded-full",
          "hover:bg-gray-200 dark:hover:bg-gray-600",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500",
          triggerClassName
        )}
        aria-label="Open actions menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <HiDotsVertical className="h-5 w-5 text-gray-500 dark:text-gray-400" />
      </button>

      {/* Dropdown menu - CSS-based positioning (no JS calculations) */}
      {isOpen && (
        <div
          className={cn(
            // Absolute positioning relative to the parent container
            "absolute z-50",
            DIRECTION_CLASSES[direction],
            // Styling
            "bg-white dark:bg-gray-800 rounded-lg shadow-lg",
            "border border-gray-200 dark:border-gray-700",
            "min-w-[160px] py-1",
            // Animation
            "animate-in fade-in-0 zoom-in-95 duration-100",
            menuClassName
          )}
          role="menu"
          aria-orientation="vertical"
        >
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                type="button"
                onClick={(e) => handleActionClick(action, e)}
                disabled={action.disabled}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                  "transition-colors",
                  action.variant === "danger"
                    ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700",
                  action.disabled && "opacity-50 cursor-not-allowed"
                )}
                role="menuitem"
                aria-label={action.ariaLabel || action.label}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      action.variant === "danger"
                        ? "text-red-500 dark:text-red-400"
                        : "text-gray-500 dark:text-gray-400"
                    )}
                  />
                )}
                <span className="font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RowMenu;
