"use client";

import { useCallback } from "react";
import {
  useSortable,
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

/**
 * useColumnReorder Hook
 *
 * Provides column reordering functionality using @dnd-kit.
 * Following TanStack Table column ordering patterns.
 *
 * @example
 * const { attributes, listeners, setNodeRef, style, isDragging } = useColumnReorder({
 *   columnKey: 'title',
 *   disabled: false,
 * });
 */

export interface UseColumnReorderOptions {
  /** Unique column identifier */
  columnKey: string;
  /** Whether reordering is disabled for this column */
  disabled?: boolean;
}

export interface UseColumnReorderReturn {
  /** Ref to attach to the draggable element */
  setNodeRef: (node: HTMLElement | null) => void;
  /** Drag handle attributes */
  attributes: Record<string, any>;
  /** Drag handle event listeners */
  listeners: Record<string, any> | undefined;
  /** Transform style for the dragging element */
  style: React.CSSProperties;
  /** Whether this column is currently being dragged */
  isDragging: boolean;
  /** Whether this column is over a drop target */
  isOver: boolean;
  /** Transform value */
  transform: { x: number; y: number; scaleX: number; scaleY: number } | null;
}

export function useColumnReorder({
  columnKey,
  disabled = false,
}: UseColumnReorderOptions): UseColumnReorderReturn {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: columnKey,
    disabled,
    data: {
      type: "column",
      columnKey,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return {
    setNodeRef,
    attributes,
    listeners,
    style,
    isDragging,
    isOver,
    transform,
  };
}

/**
 * Utility function to handle column reorder on drag end
 * Follows TanStack Table's splice-based reorder pattern
 */
export function reorderColumns(
  columnOrder: string[],
  activeId: string,
  overId: string
): string[] {
  const oldIndex = columnOrder.indexOf(activeId);
  const newIndex = columnOrder.indexOf(overId);

  if (oldIndex === -1 || newIndex === -1) {
    return columnOrder;
  }

  const newOrder = [...columnOrder];
  newOrder.splice(oldIndex, 1);
  newOrder.splice(newIndex, 0, activeId);

  return newOrder;
}

/**
 * Hook for creating drag event handlers
 */
export function useColumnDragHandlers(
  columnOrder: string[],
  setColumnOrder: (order: string[]) => void,
  onDragStart?: (columnKey: string) => void,
  onDragEnd?: (columnKey: string, newIndex: number) => void
) {
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      onDragStart?.(active.id as string);
    },
    [onDragStart]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const newOrder = reorderColumns(
          columnOrder,
          active.id as string,
          over.id as string
        );
        setColumnOrder(newOrder);

        const newIndex = newOrder.indexOf(active.id as string);
        onDragEnd?.(active.id as string, newIndex);
      }
    },
    [columnOrder, setColumnOrder, onDragEnd]
  );

  return {
    handleDragStart,
    handleDragEnd,
  };
}

// Re-export dnd-kit components for convenience
export { SortableContext, horizontalListSortingStrategy };

export default useColumnReorder;
