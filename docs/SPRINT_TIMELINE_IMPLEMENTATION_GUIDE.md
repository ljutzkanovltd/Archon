# Sprint Timeline Implementation Guide - SVAR React Gantt

**Date:** 2026-01-19
**Library:** SVAR React Gantt v2.4+
**Project:** Archon UI (archon-ui-nextjs)

---

## Quick Start

### Installation

```bash
cd /home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs
npm install @svar-ui/react-gantt
```

**Package Info:**
- License: MIT
- Size: ~50-80KB minified
- TypeScript: Full support (v2.3+)
- React: 18 & 19 compatible

---

## Implementation Steps

### Step 1: Create SprintTimeline Component

Create `/home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs/src/features/sprints/components/SprintTimeline.tsx`:

```tsx
"use client";

import { Gantt, type GanttTask, type GanttLink } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/dist/style.css";
import { Sprint, Task } from "@/lib/types";
import { useMemo, useCallback } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";

interface SprintTimelineProps {
  sprints: Sprint[];
  tasks: Task[];
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onTaskMove?: (taskId: string, newSprintId: string) => Promise<void>;
  className?: string;
}

/**
 * SprintTimeline - Gantt chart visualization for sprints and tasks
 *
 * Features:
 * - Sprint lanes as summary rows
 * - Tasks nested under sprints
 * - Drag-and-drop date editing
 * - Progress visualization
 * - Zoom levels (day/week/month)
 * - Responsive layout
 *
 * Usage:
 * ```tsx
 * <SprintTimeline
 *   sprints={sprints}
 *   tasks={tasks}
 *   onTaskUpdate={handleTaskUpdate}
 *   onTaskMove={handleTaskMove}
 * />
 * ```
 */
export function SprintTimeline({
  sprints,
  tasks,
  onTaskUpdate,
  onTaskMove,
  className = "",
}: SprintTimelineProps) {
  // Convert sprint/task data to Gantt format
  const ganttData = useMemo(() => {
    const ganttTasks: GanttTask[] = [];
    const ganttLinks: GanttLink[] = [];

    // Sort sprints by start date
    const sortedSprints = [...sprints].sort(
      (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    sortedSprints.forEach((sprint) => {
      // Add sprint as summary task (lane)
      ganttTasks.push({
        id: `sprint-${sprint.id}`,
        text: `${sprint.name}${sprint.goal ? ` - ${sprint.goal}` : ""}`,
        start: format(new Date(sprint.start_date), "yyyy-MM-dd"),
        end: format(new Date(sprint.end_date), "yyyy-MM-dd"),
        type: "summary",
        open: sprint.status === "active" || sprint.status === "planned", // Auto-expand active/planned
        // Custom styling based on sprint status
        color:
          sprint.status === "active"
            ? "#dbeafe" // Blue for active
            : sprint.status === "completed"
            ? "#d1fae5" // Green for completed
            : "#f3f4f6", // Gray for planned
      });

      // Add tasks belonging to this sprint
      const sprintTasks = tasks.filter((task) => task.sprint_id === sprint.id);
      sprintTasks.forEach((task) => {
        ganttTasks.push({
          id: task.id,
          parent: `sprint-${sprint.id}`,
          text: task.title,
          start: task.start_date
            ? format(new Date(task.start_date), "yyyy-MM-dd")
            : format(new Date(sprint.start_date), "yyyy-MM-dd"),
          end: task.end_date
            ? format(new Date(task.end_date), "yyyy-MM-dd")
            : format(new Date(sprint.end_date), "yyyy-MM-dd"),
          progress: task.progress || 0,
          type: "task",
        });

        // Add task dependencies if they exist
        if (task.dependencies && task.dependencies.length > 0) {
          task.dependencies.forEach((depId, index) => {
            ganttLinks.push({
              id: `${task.id}-${depId}-${index}`,
              source: depId,
              target: task.id,
              type: 0, // end-to-start dependency
            });
          });
        }
      });
    });

    // Add backlog sprint for unassigned tasks
    const backlogTasks = tasks.filter((task) => !task.sprint_id);
    if (backlogTasks.length > 0) {
      ganttTasks.push({
        id: "sprint-backlog",
        text: "Backlog (Unassigned)",
        start: format(new Date(), "yyyy-MM-dd"),
        end: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), // 30 days from now
        type: "summary",
        open: true,
        color: "#fef3c7", // Yellow for backlog
      });

      backlogTasks.forEach((task) => {
        ganttTasks.push({
          id: task.id,
          parent: "sprint-backlog",
          text: task.title,
          start: task.start_date
            ? format(new Date(task.start_date), "yyyy-MM-dd")
            : format(new Date(), "yyyy-MM-dd"),
          end: task.end_date
            ? format(new Date(task.end_date), "yyyy-MM-dd")
            : format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"), // 7 days default
          progress: task.progress || 0,
          type: "task",
        });
      });
    }

    return { tasks: ganttTasks, links: ganttLinks };
  }, [sprints, tasks]);

  // Handle task updates (date changes, progress)
  const handleTaskUpdate = useCallback(
    async (id: string, ganttTask: GanttTask) => {
      // Ignore sprint summary updates
      if (id.startsWith("sprint-")) {
        return;
      }

      try {
        await onTaskUpdate?.(id, {
          start_date: ganttTask.start,
          end_date: ganttTask.end,
          progress: ganttTask.progress,
        });
        toast.success("Task updated successfully");
      } catch (error) {
        toast.error("Failed to update task");
        console.error("Task update error:", error);
      }
    },
    [onTaskUpdate]
  );

  // Handle task parent change (moving between sprints)
  const handleTaskMove = useCallback(
    async (id: string, ganttTask: GanttTask) => {
      // Ignore if not a task or no parent change
      if (id.startsWith("sprint-") || !ganttTask.parent) {
        return;
      }

      // Extract sprint ID from parent
      const newSprintId = ganttTask.parent.replace("sprint-", "");

      // Handle backlog
      if (newSprintId === "backlog") {
        try {
          await onTaskMove?.(id, null as any); // null means unassigned
          toast.success("Task moved to backlog");
        } catch (error) {
          toast.error("Failed to move task");
          console.error("Task move error:", error);
        }
        return;
      }

      try {
        await onTaskMove?.(id, newSprintId);
        toast.success("Task moved to new sprint");
      } catch (error) {
        toast.error("Failed to move task");
        console.error("Task move error:", error);
      }
    },
    [onTaskMove]
  );

  return (
    <div className={`h-[600px] w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <Gantt
        tasks={ganttData.tasks}
        links={ganttData.links}
        // Time scales (zoom levels)
        scales={[
          { unit: "week", step: 1, format: "Week #W" },
          { unit: "day", step: 1, format: "d" },
        ]}
        // Grid columns
        columns={[
          { name: "text", label: "Task", width: "250px" },
          { name: "start", label: "Start", width: "100px" },
          { name: "end", label: "End", width: "100px" },
          { name: "progress", label: "Progress", width: "80px" },
        ]}
        // Event handlers
        onTaskUpdate={handleTaskUpdate}
        onTaskMove={handleTaskMove}
        // Configuration
        taskHeight={40}
        rowHeight={44}
        // Styling (adjust for dark mode if needed)
        className="dark:bg-gray-900"
      />
    </div>
  );
}
```

---

### Step 2: Create SprintTimelineView Page

Create `/home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs/src/features/sprints/views/SprintTimelineView.tsx`:

```tsx
"use client";

import { SprintTimeline } from "../components/SprintTimeline";
import { useSprintQueries } from "../hooks/useSprintQueries";
import { useTaskStore } from "@/store/useTaskStore";
import { Card } from "flowbite-react";
import { HiCalendar, HiViewBoards } from "react-icons/hi";
import { useState } from "react";

interface SprintTimelineViewProps {
  projectId: string;
}

/**
 * SprintTimelineView - Page view for sprint Gantt chart
 *
 * Shows all sprints and tasks in a timeline/Gantt chart visualization.
 * Provides controls for filtering, zoom, and view options.
 */
export function SprintTimelineView({ projectId }: SprintTimelineViewProps) {
  const { data: sprints, isLoading: sprintsLoading } = useSprintQueries.useSprints(projectId);
  const { tasks, updateTask } = useTaskStore();
  const [showCompleted, setShowCompleted] = useState(false);

  // Filter tasks for this project
  const projectTasks = tasks.filter((task) => task.project_id === projectId);

  // Filter sprints based on settings
  const filteredSprints = showCompleted
    ? sprints || []
    : (sprints || []).filter((sprint) => sprint.status !== "completed");

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    await updateTask(taskId, updates);
  };

  const handleTaskMove = async (taskId: string, newSprintId: string | null) => {
    await updateTask(taskId, { sprint_id: newSprintId });
  };

  if (sprintsLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HiCalendar className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sprint Timeline</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Visualize sprints and tasks in a Gantt chart view
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show completed sprints
          </label>
        </div>
      </div>

      {/* Stats Card */}
      <Card>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Sprints</div>
            <div className="text-2xl font-bold">{filteredSprints.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Tasks</div>
            <div className="text-2xl font-bold">{projectTasks.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Sprint</div>
            <div className="text-2xl font-bold">
              {filteredSprints.filter((s) => s.status === "active").length}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Unassigned</div>
            <div className="text-2xl font-bold">
              {projectTasks.filter((t) => !t.sprint_id).length}
            </div>
          </div>
        </div>
      </Card>

      {/* Timeline */}
      <Card>
        <SprintTimeline
          sprints={filteredSprints}
          tasks={projectTasks}
          onTaskUpdate={handleTaskUpdate}
          onTaskMove={handleTaskMove}
        />
      </Card>

      {/* Legend */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold">Legend</h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-blue-200" />
            <span>Active Sprint</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-gray-200" />
            <span>Planned Sprint</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-200" />
            <span>Completed Sprint</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-yellow-200" />
            <span>Backlog</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
```

---

### Step 3: Add Route

Create `/home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs/src/app/(dashboard)/projects/[id]/timeline/page.tsx`:

```tsx
import { SprintTimelineView } from "@/features/sprints/views/SprintTimelineView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sprint Timeline | Archon",
  description: "Gantt chart view of sprints and tasks",
};

export default function ProjectTimelinePage({ params }: { params: { id: string } }) {
  return <SprintTimelineView projectId={params.id} />;
}
```

---

### Step 4: Add Navigation Link

Update navigation to include timeline link (e.g., in project detail layout):

```tsx
// In your project navigation component
const tabs = [
  { name: "Board", href: `/projects/${projectId}/board`, icon: HiViewBoards },
  { name: "Timeline", href: `/projects/${projectId}/timeline`, icon: HiCalendar },
  { name: "List", href: `/projects/${projectId}/tasks`, icon: HiViewList },
  // ... other tabs
];
```

---

## Customization Options

### Zoom Levels

```tsx
// Add zoom control buttons
const [zoomLevel, setZoomLevel] = useState<"day" | "week" | "month">("week");

const scales = {
  day: [
    { unit: "day", step: 1, format: "MMM d" },
    { unit: "hour", step: 6, format: "HH:mm" },
  ],
  week: [
    { unit: "week", step: 1, format: "Week #W" },
    { unit: "day", step: 1, format: "d" },
  ],
  month: [
    { unit: "month", step: 1, format: "MMMM yyyy" },
    { unit: "week", step: 1, format: "W" },
  ],
};

<Gantt scales={scales[zoomLevel]} {...otherProps} />
```

### Custom Columns

```tsx
// Add custom columns for task metadata
columns={[
  { name: "text", label: "Task", width: "250px" },
  { name: "start", label: "Start", width: "100px" },
  { name: "end", label: "End", width: "100px" },
  { name: "assignee", label: "Assignee", width: "120px" }, // Custom field
  { name: "priority", label: "Priority", width: "80px" }, // Custom field
  { name: "progress", label: "Progress", width: "80px" },
]}
```

### Dark Mode Support

```tsx
// Add dark mode styling
<Gantt
  {...props}
  className="dark:bg-gray-900 dark:text-gray-100"
  // Additional dark mode configuration via CSS variables
/>

// In your CSS file
:root {
  --gantt-bg: #ffffff;
  --gantt-text: #1f2937;
}

.dark {
  --gantt-bg: #111827;
  --gantt-text: #f9fafb;
}
```

### Task Filtering

```tsx
// Filter tasks by status, assignee, etc.
const [filters, setFilters] = useState({
  status: "all",
  assignee: "all",
});

const filteredTasks = tasks.filter((task) => {
  if (filters.status !== "all" && task.status !== filters.status) return false;
  if (filters.assignee !== "all" && task.assignee !== filters.assignee) return false;
  return true;
});

<SprintTimeline tasks={filteredTasks} {...otherProps} />
```

---

## Type Definitions

Add types to `/home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs/src/lib/types.ts`:

```typescript
// Extend existing Task type
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assignee?: string;
  project_id: string;
  sprint_id?: string | null; // Sprint assignment
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
  progress?: number; // 0-100
  dependencies?: string[]; // Array of task IDs
  created_at: string;
  updated_at: string;
}

// Extend existing Sprint type
export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  project_id: string;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  status: "planned" | "active" | "completed";
  velocity?: number;
  created_at: string;
  updated_at: string;
}
```

---

## Testing

### Unit Tests

Create `/home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs/src/features/sprints/__tests__/SprintTimeline.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { SprintTimeline } from "../components/SprintTimeline";
import { Sprint, Task } from "@/lib/types";

const mockSprints: Sprint[] = [
  {
    id: "sprint-1",
    name: "Sprint 1",
    goal: "Complete auth",
    project_id: "proj-1",
    start_date: "2025-01-01",
    end_date: "2025-01-15",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

const mockTasks: Task[] = [
  {
    id: "task-1",
    title: "Implement login",
    status: "doing",
    project_id: "proj-1",
    sprint_id: "sprint-1",
    start_date: "2025-01-02",
    end_date: "2025-01-05",
    progress: 50,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
  },
];

describe("SprintTimeline", () => {
  it("renders sprint lanes", () => {
    render(<SprintTimeline sprints={mockSprints} tasks={mockTasks} />);
    expect(screen.getByText(/Sprint 1/)).toBeInTheDocument();
  });

  it("renders tasks under sprints", () => {
    render(<SprintTimeline sprints={mockSprints} tasks={mockTasks} />);
    expect(screen.getByText("Implement login")).toBeInTheDocument();
  });

  it("shows backlog for unassigned tasks", () => {
    const unassignedTask: Task = { ...mockTasks[0], sprint_id: null };
    render(<SprintTimeline sprints={mockSprints} tasks={[unassignedTask]} />);
    expect(screen.getByText(/Backlog/)).toBeInTheDocument();
  });
});
```

---

## Performance Optimization

### Virtualization for Large Datasets

SVAR Gantt handles this internally, but you can optimize data loading:

```tsx
// Lazy load tasks by sprint
const [loadedSprintIds, setLoadedSprintIds] = useState<string[]>([]);

const visibleTasks = tasks.filter((task) =>
  loadedSprintIds.includes(task.sprint_id || "backlog")
);

// Load sprint tasks when sprint is expanded
const handleSprintExpand = (sprintId: string) => {
  if (!loadedSprintIds.includes(sprintId)) {
    setLoadedSprintIds([...loadedSprintIds, sprintId]);
  }
};
```

### Memoization

```tsx
// Memoize expensive computations
const ganttData = useMemo(() => {
  // ... complex data transformation
}, [sprints, tasks]); // Only recompute when inputs change

const handleTaskUpdate = useCallback(
  async (taskId: string, updates: Partial<Task>) => {
    // ... handler logic
  },
  [onTaskUpdate]
);
```

---

## Troubleshooting

### Issue: Gantt not rendering

**Solution:** Ensure CSS is imported and container has explicit height:
```tsx
import "@svar-ui/react-gantt/dist/style.css";

<div className="h-[600px]"> {/* Explicit height required */}
  <Gantt {...props} />
</div>
```

### Issue: Dark mode styling issues

**Solution:** Add dark mode class to wrapper and customize CSS variables:
```tsx
<div className="dark:bg-gray-900">
  <Gantt className="dark:text-white" {...props} />
</div>
```

### Issue: Tasks not updating

**Solution:** Ensure `onTaskUpdate` is properly async and handles errors:
```tsx
const handleTaskUpdate = useCallback(async (id: string, task: GanttTask) => {
  try {
    await onTaskUpdate?.(id, { start_date: task.start, end_date: task.end });
  } catch (error) {
    console.error("Update failed:", error);
    toast.error("Failed to update task");
  }
}, [onTaskUpdate]);
```

---

## Next Steps

1. **Install package:** `npm install @svar-ui/react-gantt`
2. **Create component:** Follow Step 1 above
3. **Add routing:** Follow Step 3 above
4. **Test with sample data:** Create mock sprints/tasks
5. **Customize styling:** Match Archon design system
6. **Add filters:** Status, assignee, date range
7. **Implement zoom controls:** Day/week/month views
8. **Add export:** PDF/PNG export functionality (if needed)

---

## Resources

- **SVAR Docs:** https://docs.svar.dev/react/gantt/
- **Demos:** https://github.com/svar-widgets/react-gantt-demos
- **GitHub:** https://github.com/svar-widgets/react-gantt
- **Evaluation Doc:** `/docs/GANTT_TIMELINE_LIBRARY_EVALUATION.md`

---

**Status:** Ready for implementation
**Estimated Time:** 2-4 hours for basic implementation
**Last Updated:** 2026-01-19
