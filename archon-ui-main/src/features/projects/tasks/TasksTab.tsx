import { Archive, LayoutGrid, Plus, Table } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DeleteConfirmModal } from "../../ui/components/DeleteConfirmModal";
import { Button, Card } from "../../ui/primitives";
import { cn, glassmorphism } from "../../ui/primitives/styles";
import { TaskEditModal } from "./components/TaskEditModal";
import { useArchiveTask, useDeleteTask, useProjectTasks, useUnarchiveTask, useUpdateTask } from "./hooks";
import type { Task } from "./types";
import { getReorderTaskOrder, ORDER_INCREMENT, validateTaskOrder } from "./utils";
import { BoardView, TableView } from "./views";

interface TasksTabProps {
  projectId: string;
}

export const TasksTab = ({ projectId }: TasksTabProps) => {
  const [viewMode, setViewMode] = useState<"table" | "board">("board");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Fetch tasks using TanStack Query
  const { data: allTasks = [], isLoading: isLoadingTasks } = useProjectTasks(projectId);

  // Filter tasks based on archived state
  const tasks = useMemo(() => {
    return (allTasks as Task[]).filter((task) => (showArchived ? task.archived : !task.archived));
  }, [allTasks, showArchived]);

  // Mutations for task operations
  const updateTaskMutation = useUpdateTask(projectId);
  const deleteTaskMutation = useDeleteTask(projectId);
  const archiveTaskMutation = useArchiveTask(projectId);
  const unarchiveTaskMutation = useUnarchiveTask(projectId);

  // Modal management functions
  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingTask(null);
    setIsModalOpen(false);
  };

  // Delete modal management functions
  const openDeleteModal = (task: Task) => {
    setTaskToDelete(task);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setTaskToDelete(null);
    setShowDeleteModal(false);
  };

  const confirmDeleteTask = () => {
    if (!taskToDelete) return;

    deleteTaskMutation.mutate(taskToDelete.id, {
      onSuccess: () => {
        closeDeleteModal();
      },
      onError: (error) => {
        console.error("Failed to delete task:", error);
      },
    });
  };

  // Archive task
  const handleArchiveTask = useCallback(
    (task: Task) => {
      archiveTaskMutation.mutate(
        { taskId: task.id, archivedBy: "User" },
        {
          onError: (error) => {
            console.error("Failed to archive task:", error);
          },
        },
      );
    },
    [archiveTaskMutation],
  );

  // Unarchive task
  const handleUnarchiveTask = useCallback(
    (task: Task) => {
      unarchiveTaskMutation.mutate(task.id, {
        onError: (error) => {
          console.error("Failed to unarchive task:", error);
        },
      });
    },
    [unarchiveTaskMutation],
  );

  // Get default order for new tasks in a status
  const getDefaultTaskOrder = useCallback((statusTasks: Task[]) => {
    if (statusTasks.length === 0) return ORDER_INCREMENT;
    const maxOrder = Math.max(...statusTasks.map((t) => t.task_order));
    return maxOrder + ORDER_INCREMENT;
  }, []);

  // Task reordering - immediate update
  const handleTaskReorder = useCallback(
    async (taskId: string, targetIndex: number, status: Task["status"]) => {
      // Get all tasks in the target status, sorted by current order
      const statusTasks = (tasks as Task[])
        .filter((task) => task.status === status)
        .sort((a, b) => a.task_order - b.task_order);

      const movingTaskIndex = statusTasks.findIndex((task) => task.id === taskId);
      if (movingTaskIndex === -1 || targetIndex < 0 || targetIndex > statusTasks.length) return;
      if (movingTaskIndex === targetIndex) return;

      // Calculate new position using battle-tested utility
      const newPosition = getReorderTaskOrder(statusTasks, taskId, targetIndex);

      // Update immediately with optimistic updates
      try {
        await updateTaskMutation.mutateAsync({
          taskId,
          updates: {
            task_order: newPosition,
          },
        });
      } catch (error) {
        console.error("Failed to reorder task:", error, {
          taskId,
          newPosition,
        });
        // Error toast handled by mutation
      }
    },
    [tasks, updateTaskMutation],
  );

  // Move task to different status
  const moveTask = useCallback(
    async (taskId: string, newStatus: Task["status"]) => {
      const movingTask = (tasks as Task[]).find((task) => task.id === taskId);
      if (!movingTask || movingTask.status === newStatus) return;

      try {
        // Calculate position for new status
        const tasksInNewStatus = (tasks as Task[]).filter((t) => t.status === newStatus);
        const newOrder = getDefaultTaskOrder(tasksInNewStatus);

        // Update via mutation (handles optimistic updates)
        await updateTaskMutation.mutateAsync({
          taskId,
          updates: {
            status: newStatus,
            task_order: newOrder,
          },
        });

        // Success handled by mutation
      } catch (error) {
        console.error("Failed to move task:", error, { taskId, newStatus });
        // Error toast handled by mutation
      }
    },
    [tasks, updateTaskMutation, getDefaultTaskOrder],
  );

  const completeTask = useCallback(
    (taskId: string) => {
      moveTask(taskId, "done");
    },
    [moveTask],
  );

  // Inline update for task fields
  const updateTaskInline = async (taskId: string, updates: Partial<Task>) => {
    try {
      // Validate task_order if present (ensures integer precision)
      const processedUpdates = { ...updates };
      if (processedUpdates.task_order !== undefined) {
        processedUpdates.task_order = validateTaskOrder(processedUpdates.task_order);
      }

      await updateTaskMutation.mutateAsync({
        taskId,
        updates: processedUpdates,
      });
    } catch (error) {
      console.error("Failed to update task:", error, { taskId, updates });
      // Error toast handled by mutation
    }
  };

  if (isLoadingTasks) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-[70vh] relative">
        {/* Main content - Table or Board view */}
        <div className="relative h-[calc(100vh-220px)] overflow-auto">
          {viewMode === "table" ? (
            <TableView
              tasks={tasks as Task[]}
              projectId={projectId}
              onTaskView={openEditModal}
              onTaskComplete={completeTask}
              onTaskDelete={openDeleteModal}
              onTaskArchive={handleArchiveTask}
              onTaskUnarchive={handleUnarchiveTask}
              onTaskReorder={handleTaskReorder}
              onTaskUpdate={updateTaskInline}
            />
          ) : (
            <BoardView
              tasks={tasks as Task[]}
              projectId={projectId}
              onTaskMove={moveTask}
              onTaskReorder={handleTaskReorder}
              onTaskEdit={openEditModal}
              onTaskDelete={openDeleteModal}
              onTaskArchive={handleArchiveTask}
              onTaskUnarchive={handleUnarchiveTask}
            />
          )}
        </div>

        {/* Fixed View Controls using Radix primitives */}
        <ViewControls
          viewMode={viewMode}
          onViewChange={setViewMode}
          onAddTask={openCreateModal}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
        />

        {/* Edit/Create Task Modal */}
        <TaskEditModal isModalOpen={isModalOpen} editingTask={editingTask} projectId={projectId} onClose={closeModal} />

        {/* Delete Task Modal */}
        <DeleteConfirmModal
          open={showDeleteModal}
          itemName={taskToDelete?.title || ""}
          onConfirm={confirmDeleteTask}
          onCancel={closeDeleteModal}
          onOpenChange={setShowDeleteModal}
          type="task"
          size="compact"
        />
      </div>
    </DndProvider>
  );
};

// Extracted ViewControls component using Radix primitives
interface ViewControlsProps {
  viewMode: "table" | "board";
  onViewChange: (mode: "table" | "board") => void;
  onAddTask: () => void;
  showArchived: boolean;
  onShowArchivedChange: (show: boolean) => void;
}

const ViewControls = ({ viewMode, onViewChange, onAddTask, showArchived, onShowArchivedChange }: ViewControlsProps) => {
  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <div className="flex items-center gap-4">
        {/* Show Archived Toggle Button */}
        <Button
          onClick={() => onShowArchivedChange(!showArchived)}
          variant="outline"
          className={cn(
            "pointer-events-auto relative",
            glassmorphism.background.subtle,
            glassmorphism.border.default,
            glassmorphism.shadow.elevated,
            showArchived
              ? "text-gray-600 dark:text-gray-400"
              : "text-gray-500 dark:text-gray-500 opacity-60",
            "hover:text-gray-700 dark:hover:text-gray-300",
            "transition-all duration-300",
          )}
          aria-label={showArchived ? "Hide archived tasks" : "Show archived tasks"}
          aria-pressed={showArchived}
        >
          <Archive className="w-4 h-4 mr-2" />
          <span>{showArchived ? "Hide Archived" : "Show Archived"}</span>
          {/* Glow effect when active */}
          {showArchived && (
            <span
              className={cn(
                "absolute bottom-0 left-0 right-0 h-[2px]",
                "bg-gradient-to-r from-transparent via-gray-500 to-transparent",
                "shadow-[0_0_10px_2px_rgba(156,163,175,0.4)]",
                "dark:shadow-[0_0_20px_5px_rgba(156,163,175,0.7)]",
              )}
            />
          )}
        </Button>

        {/* Add Task Button with Glassmorphism */}
        <Button
          onClick={onAddTask}
          variant="outline"
          className={cn(
            "pointer-events-auto relative",
            glassmorphism.background.subtle,
            glassmorphism.border.default,
            glassmorphism.shadow.elevated,
            "text-cyan-600 dark:text-cyan-400",
            "hover:text-cyan-700 dark:hover:text-cyan-300",
            "transition-all duration-300",
          )}
        >
          <Plus className="w-4 h-4 mr-2" />
          <span>Add Task</span>
          {/* Glow effect */}
          <span
            className={cn(
              "absolute bottom-0 left-0 right-0 h-[2px]",
              "bg-gradient-to-r from-transparent via-cyan-500 to-transparent",
              "shadow-[0_0_10px_2px_rgba(34,211,238,0.4)]",
              "dark:shadow-[0_0_20px_5px_rgba(34,211,238,0.7)]",
            )}
          />
        </Button>

        {/* View Toggle Controls with Glassmorphism */}
        <Card
          blur="lg"
          transparency="medium"
          size="none"
          className="flex items-center overflow-hidden pointer-events-auto rounded-lg"
        >
          <button
            type="button"
            onClick={() => onViewChange("table")}
            aria-label="Switch to table view"
            aria-pressed={viewMode === "table"}
            className={cn(
              "px-5 py-2.5 flex items-center gap-2 relative transition-all duration-300",
              viewMode === "table"
                ? "text-cyan-600 dark:text-cyan-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300",
            )}
          >
            <Table className="w-4 h-4" aria-hidden="true" />
            <span>Table</span>
            {viewMode === "table" && (
              <span
                className={cn(
                  "absolute bottom-0 left-[15%] right-[15%] w-[70%] mx-auto h-[2px]",
                  "bg-cyan-500",
                  "shadow-[0_0_10px_2px_rgba(34,211,238,0.4)]",
                  "dark:shadow-[0_0_20px_5px_rgba(34,211,238,0.7)]",
                )}
              />
            )}
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700" />
          <button
            type="button"
            onClick={() => onViewChange("board")}
            aria-label="Switch to board view"
            aria-pressed={viewMode === "board"}
            className={cn(
              "px-5 py-2.5 flex items-center gap-2 relative transition-all duration-300",
              viewMode === "board"
                ? "text-purple-600 dark:text-purple-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300",
            )}
          >
            <LayoutGrid className="w-4 h-4" aria-hidden="true" />
            <span>Board</span>
            {viewMode === "board" && (
              <span
                className={cn(
                  "absolute bottom-0 left-[15%] right-[15%] w-[70%] mx-auto h-[2px]",
                  "bg-purple-500",
                  "shadow-[0_0_10px_2px_rgba(168,85,247,0.4)]",
                  "dark:shadow-[0_0_20px_5px_rgba(168,85,247,0.7)]",
                )}
              />
            )}
          </button>
        </Card>
      </div>
    </div>
  );
};
