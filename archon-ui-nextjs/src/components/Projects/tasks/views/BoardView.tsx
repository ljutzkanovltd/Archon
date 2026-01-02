"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/lib/types";
import { TaskCard } from "@/components/Tasks/TaskCard";
import { useTaskStore } from "@/store/useTaskStore";
import { cn } from "@/lib/utils";

interface BoardViewProps {
  projectId: string;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onArchiveTask: (task: Task) => void;
}

type TaskStatus = "todo" | "doing" | "review" | "done";

const COLUMNS: Array<{
  id: TaskStatus;
  label: string;
  color: string;
  borderColor: string;
  gradient: string;
  dropHighlight: string;
}> = [
  {
    id: "todo",
    label: "To Do",
    color: "bg-gray-100 dark:bg-gray-800",
    borderColor: "border-l-gray-400 dark:border-l-gray-500",
    gradient: "bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900",
    dropHighlight: "ring-2 ring-gray-400 bg-gray-200/50 dark:bg-gray-700/50",
  },
  {
    id: "doing",
    label: "In Progress",
    color: "bg-blue-100 dark:bg-blue-900/20",
    borderColor: "border-l-blue-500 dark:border-l-blue-400",
    gradient: "bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30",
    dropHighlight: "ring-2 ring-blue-400 bg-blue-200/50 dark:bg-blue-700/50",
  },
  {
    id: "review",
    label: "Review",
    color: "bg-yellow-100 dark:bg-yellow-900/20",
    borderColor: "border-l-yellow-500 dark:border-l-yellow-400",
    gradient: "bg-gradient-to-b from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-900/30",
    dropHighlight: "ring-2 ring-yellow-400 bg-yellow-200/50 dark:bg-yellow-700/50",
  },
  {
    id: "done",
    label: "Done",
    color: "bg-green-100 dark:bg-green-900/20",
    borderColor: "border-l-green-500 dark:border-l-green-400",
    gradient: "bg-gradient-to-b from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/30",
    dropHighlight: "ring-2 ring-green-400 bg-green-200/50 dark:bg-green-700/50",
  },
];

/**
 * DraggableTaskCard - Wrapper that makes TaskCard draggable
 */
interface DraggableTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onArchive: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}

function DraggableTaskCard({
  task,
  onEdit,
  onDelete,
  onArchive,
  onStatusChange,
}: DraggableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { task, type: "task" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "touch-none",
        isDragging && "opacity-50 scale-105 z-50"
      )}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        task={task}
        onEdit={onEdit}
        onDelete={onDelete}
        onArchive={onArchive}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}

/**
 * EmptyColumnDropZone - Droppable zone for empty columns
 */
interface EmptyColumnDropZoneProps {
  columnId: TaskStatus;
  isOver: boolean;
}

function EmptyColumnDropZone({ columnId, isOver }: EmptyColumnDropZoneProps) {
  const { setNodeRef } = useDroppable({
    id: columnId,
    data: { type: "column", columnId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border-2 border-dashed p-4 text-center transition-colors duration-200 min-h-[100px] flex flex-col items-center justify-center",
        isOver
          ? "border-solid border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700"
          : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
      )}
    >
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {isOver ? "Drop here" : "No tasks yet"}
      </p>
      {!isOver && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Drag cards here
        </p>
      )}
    </div>
  );
}

/**
 * DroppableColumn - Column that accepts dropped tasks
 */
interface DroppableColumnProps {
  column: typeof COLUMNS[number];
  tasks: Task[];
  isOver: boolean;
  children: React.ReactNode;
}

function DroppableColumn({ column, tasks, isOver, children }: DroppableColumnProps) {
  return (
    <div className="flex flex-col group">
      {/* Column Header */}
      <div
        className={cn(
          "mb-3 rounded-lg p-4 border-l-4 shadow-sm transition-all duration-200",
          column.borderColor,
          column.gradient,
          isOver && "shadow-md scale-[1.02]"
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {column.label}
          </h3>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300">
            {tasks.length}
          </span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Drag cards to move
        </p>
      </div>

      {/* Tasks Container */}
      <div
        className={cn(
          "space-y-2 flex-1 min-h-[200px] rounded-lg p-2 transition-all duration-200",
          isOver && column.dropHighlight
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * BoardView - Kanban board with drag-and-drop task management
 *
 * Features:
 * - Drag tasks between status columns (todo/doing/review/done)
 * - Visual feedback during drag (drop zone highlighting)
 * - Optimistic UI updates with error recovery
 * - Keyboard accessible (via dnd-kit KeyboardSensor)
 * - Touch device support
 */
export function BoardView({
  projectId,
  tasks,
  onEditTask,
  onDeleteTask,
  onArchiveTask,
}: BoardViewProps) {
  const { updateTask, fetchTasks } = useTaskStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Configure drag sensors with activation constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Get task by ID
  const getTask = (id: string) => tasks.find((t) => t.id === id);

  // Get tasks by status column
  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((task) => task.status === status);

  // Memoize tasks by column for performance
  const tasksByColumn = useMemo(() => {
    return COLUMNS.reduce((acc, col) => {
      acc[col.id] = getTasksByStatus(col.id);
      return acc;
    }, {} as Record<TaskStatus, Task[]>);
  }, [tasks]);

  // Handle status change (both drag-drop and button click)
  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    // Optimistic update - immediately update UI
    await updateTask(task.id, { status: newStatus });
    // Refresh tasks from server
    await fetchTasks({ project_id: projectId, include_closed: true, per_page: 1000 });
  };

  // Drag event handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const activeTask = getTask(active.id as string);
    if (!activeTask) return;

    // Determine target column
    let targetStatus: TaskStatus | null = null;

    // Check if dropped over a column directly
    if (COLUMNS.some((col) => col.id === over.id)) {
      targetStatus = over.id as TaskStatus;
    }
    // Check if dropped over another task
    else {
      const overTask = getTask(over.id as string);
      if (overTask) {
        targetStatus = overTask.status as TaskStatus;
      }
    }

    // If status changed, update the task
    if (targetStatus && targetStatus !== activeTask.status) {
      await handleStatusChange(activeTask, targetStatus);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  // Get the active task for the drag overlay
  const activeTask = activeId ? getTask(activeId) : null;

  // Determine which column is being hovered
  const getIsColumnOver = (columnId: TaskStatus): boolean => {
    if (!overId) return false;
    // Direct column drop
    if (overId === columnId) return true;
    // Dropped over a task in this column
    const overTask = getTask(overId);
    return overTask?.status === columnId;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((column) => {
          const columnTasks = tasksByColumn[column.id];
          const isOver = getIsColumnOver(column.id);

          return (
            <SortableContext
              key={column.id}
              id={column.id}
              items={columnTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <DroppableColumn
                column={column}
                tasks={columnTasks}
                isOver={isOver}
              >
                {columnTasks.length === 0 ? (
                  <EmptyColumnDropZone columnId={column.id} isOver={isOver} />
                ) : (
                  columnTasks.map((task) => (
                    <DraggableTaskCard
                      key={task.id}
                      task={task}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onArchive={onArchiveTask}
                      onStatusChange={handleStatusChange}
                    />
                  ))
                )}
              </DroppableColumn>
            </SortableContext>
          );
        })}
      </div>

      {/* Drag Overlay - Shows the task being dragged */}
      <DragOverlay>
        {activeTask && (
          <div className="opacity-90 rotate-3 scale-105 shadow-2xl">
            <TaskCard
              task={activeTask}
              onEdit={() => {}}
              onDelete={() => {}}
              onArchive={() => {}}
              onStatusChange={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
