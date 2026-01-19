"use client";

import { useState, useMemo } from "react";
import { Button, Badge, Select, Label, TextInput, Card, Checkbox } from "flowbite-react";
import {
  HiSearch,
  HiFilter,
  HiChevronUp,
  HiChevronDown,
  HiViewGrid,
  HiViewList,
} from "react-icons/hi";
import { Task } from "@/lib/types";
import { TaskCard } from "@/components/Tasks/TaskCard";
import { SprintSelector } from "../components/SprintSelector";
import { useTaskStore } from "@/store/useTaskStore";
import { toast } from "react-hot-toast";

interface SprintBacklogViewProps {
  projectId: string;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onArchiveTask: (task: Task) => void;
}

type ViewMode = "list" | "cards";
type SortBy = "priority" | "created_at" | "title";
type FilterBy = "all" | "high_priority" | "has_assignee";

/**
 * SprintBacklogView - View for managing unassigned tasks (sprint backlog)
 *
 * Features:
 * - Shows tasks without sprint_id (backlog tasks)
 * - Assign individual tasks to sprints
 * - Bulk assign multiple tasks to a sprint
 * - Sort by priority, creation date, or title
 * - Filter by priority or assignee
 * - Search by title/description
 * - Toggle between list and card view
 * - Displays task count and statistics
 *
 * Usage:
 * ```tsx
 * <SprintBacklogView
 *   projectId={projectId}
 *   tasks={allTasks}
 *   onEditTask={handleEditTask}
 *   onDeleteTask={handleDeleteTask}
 *   onArchiveTask={handleArchiveTask}
 * />
 * ```
 */
export function SprintBacklogView({
  projectId,
  tasks,
  onEditTask,
  onDeleteTask,
  onArchiveTask,
}: SprintBacklogViewProps) {
  const { updateTask, fetchTasks } = useTaskStore();

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortBy, setSortBy] = useState<SortBy>("priority");
  const [filterBy, setFilterBy] = useState<FilterBy>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkSprintId, setBulkSprintId] = useState<string>("");

  // Filter tasks to only backlog (no sprint_id)
  const backlogTasks = useMemo(() => {
    return tasks.filter((task) => !task.sprint_id && !task.archived);
  }, [tasks]);

  // Apply search filter
  const searchedTasks = useMemo(() => {
    if (!searchQuery.trim()) return backlogTasks;

    const query = searchQuery.toLowerCase();
    return backlogTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.feature?.toLowerCase().includes(query)
    );
  }, [backlogTasks, searchQuery]);

  // Apply additional filters
  const filteredTasks = useMemo(() => {
    if (filterBy === "all") return searchedTasks;

    if (filterBy === "high_priority") {
      return searchedTasks.filter(
        (task) => task.priority === "high" || task.priority === "urgent"
      );
    }

    if (filterBy === "has_assignee") {
      return searchedTasks.filter((task) => task.assignee);
    }

    return searchedTasks;
  }, [searchedTasks, filterBy]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];

    if (sortBy === "priority") {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      sorted.sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      );
    } else if (sortBy === "created_at") {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sortBy === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }

    return sorted;
  }, [filteredTasks, sortBy]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = backlogTasks.length;
    const highPriority = backlogTasks.filter(
      (t) => t.priority === "high" || t.priority === "urgent"
    ).length;
    const unassigned = backlogTasks.filter((t) => !t.assignee).length;

    return { total, highPriority, unassigned };
  }, [backlogTasks]);

  // Handle individual task sprint assignment
  const handleAssignSprint = async (taskId: string, sprintId: string | undefined) => {
    try {
      await updateTask(taskId, { sprint_id: sprintId });
      await fetchTasks({ project_id: projectId, include_closed: true, per_page: 1000 });
      toast.success(sprintId ? "Task assigned to sprint" : "Task unassigned from sprint");
    } catch (error: any) {
      toast.error(error.message || "Failed to assign task to sprint");
    }
  };

  // Handle bulk assignment
  const handleBulkAssign = async () => {
    if (!bulkSprintId) {
      toast.error("Please select a sprint for bulk assignment");
      return;
    }

    if (selectedTaskIds.size === 0) {
      toast.error("Please select at least one task");
      return;
    }

    try {
      // Update all selected tasks
      await Promise.all(
        Array.from(selectedTaskIds).map((taskId) =>
          updateTask(taskId, { sprint_id: bulkSprintId })
        )
      );

      await fetchTasks({ project_id: projectId, include_closed: true, per_page: 1000 });
      toast.success(`${selectedTaskIds.size} tasks assigned to sprint`);
      setSelectedTaskIds(new Set());
      setBulkSprintId("");
    } catch (error: any) {
      toast.error(error.message || "Failed to bulk assign tasks");
    }
  };

  // Toggle task selection
  const toggleTaskSelection = (taskId: string) => {
    const newSelection = new Set(selectedTaskIds);
    if (newSelection.has(taskId)) {
      newSelection.delete(taskId);
    } else {
      newSelection.add(taskId);
    }
    setSelectedTaskIds(newSelection);
  };

  // Select all filtered tasks
  const handleSelectAll = () => {
    if (selectedTaskIds.size === sortedTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(sortedTasks.map((t) => t.id)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sprint Backlog
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage unassigned tasks and plan upcoming sprints
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            color={viewMode === "cards" ? "blue" : "gray"}
            onClick={() => setViewMode("cards")}
          >
            <HiViewGrid className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            color={viewMode === "list" ? "blue" : "gray"}
            onClick={() => setViewMode("list")}
          >
            <HiViewList className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Total Backlog
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.total}
              </p>
            </div>
            <Badge color="gray" size="sm">
              {sortedTasks.length} shown
            </Badge>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                High Priority
              </p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.highPriority}
              </p>
            </div>
            <Badge color="failure" size="sm">
              Urgent/High
            </Badge>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Unassigned
              </p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.unassigned}
              </p>
            </div>
            <Badge color="warning" size="sm">
              No assignee
            </Badge>
          </div>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedTaskIds.size > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-4">
            <Badge color="info" size="lg">
              {selectedTaskIds.size} selected
            </Badge>

            <div className="flex-1">
              <Label htmlFor="bulk-sprint" value="Assign to Sprint" />
              <SprintSelector
                projectId={projectId}
                value={bulkSprintId}
                onChange={(sprintId) => setBulkSprintId(sprintId || "")}
                label=""
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleBulkAssign} disabled={!bulkSprintId}>
                Assign {selectedTaskIds.size} Tasks
              </Button>
              <Button color="gray" onClick={() => setSelectedTaskIds(new Set())}>
                Clear Selection
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-end">
        {/* Search */}
        <div className="flex-1">
          <Label htmlFor="search" value="Search Tasks" />
          <TextInput
            id="search"
            icon={HiSearch}
            placeholder="Search by title, description, or feature..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter */}
        <div className="w-full sm:w-48">
          <Label htmlFor="filter" value="Filter" />
          <Select
            id="filter"
            icon={HiFilter}
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as FilterBy)}
          >
            <option value="all">All Tasks</option>
            <option value="high_priority">High Priority</option>
            <option value="has_assignee">Has Assignee</option>
          </Select>
        </div>

        {/* Sort */}
        <div className="w-full sm:w-48">
          <Label htmlFor="sort" value="Sort By" />
          <Select
            id="sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="priority">Priority</option>
            <option value="created_at">Recently Added</option>
            <option value="title">Title (A-Z)</option>
          </Select>
        </div>

        {/* Select All */}
        <Button color="gray" onClick={handleSelectAll}>
          {selectedTaskIds.size === sortedTasks.length ? "Deselect All" : "Select All"}
        </Button>
      </div>

      {/* Task List */}
      {sortedTasks.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
              {searchQuery || filterBy !== "all"
                ? "No tasks match your filters"
                : "No backlog tasks"}
            </p>
            <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
              {searchQuery || filterBy !== "all"
                ? "Try adjusting your search or filters"
                : "All tasks are assigned to sprints"}
            </p>
          </div>
        </Card>
      ) : (
        <div
          className={
            viewMode === "cards"
              ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
              : "space-y-3"
          }
        >
          {sortedTasks.map((task) => (
            <div key={task.id} className="relative">
              {/* Selection Checkbox */}
              <div className="absolute left-2 top-2 z-10">
                <Checkbox
                  checked={selectedTaskIds.has(task.id)}
                  onChange={() => toggleTaskSelection(task.id)}
                />
              </div>

              {/* Task Card */}
              <div className="pl-8">
                <TaskCard
                  task={task}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  onArchive={onArchiveTask}
                  onStatusChange={() => {}}
                />

                {/* Sprint Assignment Dropdown */}
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                  <SprintSelector
                    projectId={projectId}
                    value={task.sprint_id}
                    onChange={(sprintId) => handleAssignSprint(task.id, sprintId)}
                    label="Assign to Sprint"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Count */}
      {sortedTasks.length > 0 && (
        <div className="flex justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {sortedTasks.length} of {backlogTasks.length} backlog tasks
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>
      )}
    </div>
  );
}
