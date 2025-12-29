"use client";

import { Task } from "@/lib/types";
import { TaskCard } from "@/components/Tasks/TaskCard";
import { useTaskStore } from "@/store/useTaskStore";

interface BoardViewProps {
  projectId: string;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onArchiveTask: (task: Task) => void;
}

const COLUMNS = [
  {
    id: "todo",
    label: "To Do",
    color: "bg-gray-100 dark:bg-gray-800",
    borderColor: "border-l-gray-400 dark:border-l-gray-500",
    gradient: "bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900"
  },
  {
    id: "doing",
    label: "In Progress",
    color: "bg-blue-100 dark:bg-blue-900/20",
    borderColor: "border-l-blue-500 dark:border-l-blue-400",
    gradient: "bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30"
  },
  {
    id: "review",
    label: "Review",
    color: "bg-yellow-100 dark:bg-yellow-900/20",
    borderColor: "border-l-yellow-500 dark:border-l-yellow-400",
    gradient: "bg-gradient-to-b from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-900/30"
  },
  {
    id: "done",
    label: "Done",
    color: "bg-green-100 dark:bg-green-900/20",
    borderColor: "border-l-green-500 dark:border-l-green-400",
    gradient: "bg-gradient-to-b from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/30"
  },
];

export function BoardView({ projectId, tasks, onEditTask, onDeleteTask, onArchiveTask }: BoardViewProps) {
  const { updateTask, fetchTasks } = useTaskStore();

  const getTasksByStatus = (status: string) => {
    return tasks.filter((task) => task.status === status);
  };

  const handleStatusChange = async (task: Task, newStatus: Task["status"]) => {
    await updateTask(task.id, { status: newStatus });
    // Refresh tasks (fetch all with high per_page to avoid pagination)
    await fetchTasks({ project_id: projectId, include_closed: true, per_page: 1000 });
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((column) => {
        const columnTasks = getTasksByStatus(column.id);

        return (
          <div key={column.id} className="flex flex-col group">
            {/* Column Header - Enhanced Visual Hierarchy */}
            <div
              className={`mb-3 rounded-lg p-4 border-l-4 ${column.borderColor} ${column.gradient} shadow-sm transition-shadow duration-200 hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {column.label}
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300">
                  {columnTasks.length}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                Drag cards to move
              </p>
            </div>

            {/* Tasks - With transition animations */}
            <div className="space-y-2 flex-1 min-h-[200px]">
              {columnTasks.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center dark:border-gray-700 transition-colors duration-200 hover:border-gray-400 dark:hover:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No tasks yet
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Drag cards here
                  </p>
                </div>
              ) : (
                columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className="animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    <TaskCard
                      task={task}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onArchive={onArchiveTask}
                      onStatusChange={handleStatusChange}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
