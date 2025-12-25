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
  { id: "todo", label: "To Do", color: "bg-gray-100 dark:bg-gray-800" },
  { id: "doing", label: "In Progress", color: "bg-blue-100 dark:bg-blue-900/20" },
  { id: "review", label: "Review", color: "bg-yellow-100 dark:bg-yellow-900/20" },
  { id: "done", label: "Done", color: "bg-green-100 dark:bg-green-900/20" },
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
          <div key={column.id} className="flex flex-col">
            {/* Column Header - Compact */}
            <div
              className={`mb-2 rounded-lg p-2 ${column.color}`}
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {column.label}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {columnTasks.length} {columnTasks.length === 1 ? "task" : "tasks"}
              </p>
            </div>

            {/* Tasks - Reduced spacing */}
            <div className="space-y-2 flex-1">
              {columnTasks.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-3 text-center dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No tasks
                  </p>
                </div>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onArchive={onArchiveTask}
                    onStatusChange={handleStatusChange}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
