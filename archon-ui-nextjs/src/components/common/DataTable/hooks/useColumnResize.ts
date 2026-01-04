"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * useColumnResize Hook
 *
 * Provides column resize functionality following TanStack Table patterns:
 * - Native mouse/touch event handlers
 * - Support for 'onChange' (real-time) and 'onEnd' (on release) modes
 * - Min/max width constraints
 * - Double-click to reset to default
 *
 * @example
 * const { isResizing, getResizeHandler, getResizeProps } = useColumnResize({
 *   columnKey: 'title',
 *   initialWidth: 200,
 *   onResize: (key, width) => setColumnWidth(key, width),
 * });
 */

export type ColumnResizeMode = "onChange" | "onEnd";

export interface UseColumnResizeOptions {
  columnKey: string;
  initialWidth: number;
  minWidth?: number;
  maxWidth?: number;
  resizeMode?: ColumnResizeMode;
  onResize: (columnKey: string, width: number) => void;
  onResizeStart?: (columnKey: string) => void;
  onResizeEnd?: (columnKey: string, width: number) => void;
}

export interface UseColumnResizeReturn {
  isResizing: boolean;
  currentWidth: number;
  getResizeHandler: () => (e: React.MouseEvent | React.TouchEvent) => void;
  getResizeProps: () => {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onDoubleClick: () => void;
    style: React.CSSProperties;
    className: string;
    role: string;
    "aria-label": string;
    tabIndex: number;
  };
  resetWidth: () => void;
}

export function useColumnResize({
  columnKey,
  initialWidth,
  minWidth = 50,
  maxWidth = 500,
  resizeMode = "onChange",
  onResize,
  onResizeStart,
  onResizeEnd,
}: UseColumnResizeOptions): UseColumnResizeReturn {
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(initialWidth);

  // Refs to track resize state without causing re-renders
  const startXRef = useRef(0);
  const startWidthRef = useRef(initialWidth);
  const currentWidthRef = useRef(initialWidth);

  // Update current width when initial width changes (e.g., from persistence)
  useEffect(() => {
    setCurrentWidth(initialWidth);
    currentWidthRef.current = initialWidth;
  }, [initialWidth]);

  // Clamp width to min/max constraints
  const clampWidth = useCallback(
    (width: number) => Math.max(minWidth, Math.min(maxWidth, width)),
    [minWidth, maxWidth]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;

      setIsResizing(true);
      startXRef.current = clientX;
      startWidthRef.current = currentWidthRef.current;

      onResizeStart?.(columnKey);
    },
    [columnKey, onResizeStart]
  );

  // Handle resize move
  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const delta = clientX - startXRef.current;
      const newWidth = clampWidth(startWidthRef.current + delta);

      currentWidthRef.current = newWidth;

      if (resizeMode === "onChange") {
        setCurrentWidth(newWidth);
        onResize(columnKey, newWidth);
      } else {
        // In 'onEnd' mode, only update local state for visual feedback
        setCurrentWidth(newWidth);
      }
    };

    const handleEnd = () => {
      setIsResizing(false);

      if (resizeMode === "onEnd") {
        // Only notify parent on end
        onResize(columnKey, currentWidthRef.current);
      }

      onResizeEnd?.(columnKey, currentWidthRef.current);
    };

    // Add event listeners
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);

    // Prevent text selection and set cursor
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, columnKey, resizeMode, clampWidth, onResize, onResizeEnd]);

  // Reset to initial/default width
  const resetWidth = useCallback(() => {
    const defaultWidth = 150; // Default column width
    setCurrentWidth(defaultWidth);
    currentWidthRef.current = defaultWidth;
    onResize(columnKey, defaultWidth);
  }, [columnKey, onResize]);

  // Get resize handler function (TanStack Table style)
  const getResizeHandler = useCallback(() => {
    return handleResizeStart;
  }, [handleResizeStart]);

  // Get all props for the resize handle element
  const getResizeProps = useCallback(() => {
    return {
      onMouseDown: handleResizeStart as (e: React.MouseEvent) => void,
      onTouchStart: handleResizeStart as (e: React.TouchEvent) => void,
      onDoubleClick: resetWidth,
      style: {
        position: "absolute" as const,
        right: 0,
        top: 0,
        height: "100%",
        width: "5px",
        cursor: "col-resize",
        userSelect: "none" as const,
        touchAction: "none" as const,
      },
      className: `resize-handle ${isResizing ? "is-resizing" : ""}`,
      role: "separator",
      "aria-label": `Resize ${columnKey} column`,
      tabIndex: 0,
    };
  }, [columnKey, handleResizeStart, resetWidth, isResizing]);

  return {
    isResizing,
    currentWidth,
    getResizeHandler,
    getResizeProps,
    resetWidth,
  };
}

/**
 * Hook for managing multiple column resize states
 * Useful when you need to track resize state for the entire table
 */
export function useTableResize() {
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);

  const startResize = useCallback((columnKey: string) => {
    setResizingColumn(columnKey);
  }, []);

  const endResize = useCallback(() => {
    setResizingColumn(null);
  }, []);

  return {
    resizingColumn,
    isAnyColumnResizing: resizingColumn !== null,
    startResize,
    endResize,
  };
}

export default useColumnResize;
