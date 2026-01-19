# Gantt/Timeline Library Evaluation for Sprint Timeline View

**Date:** 2026-01-19
**Author:** Library Research Agent
**Purpose:** Evaluate timeline/Gantt chart libraries for Jira-like sprint visualization

---

## Executive Summary

After evaluating 7 timeline/Gantt chart libraries for React, **SVAR React Gantt** emerges as the recommended solution for sprint timeline visualization due to its:
- MIT open-source license (no licensing costs)
- Modern architecture (React 18/19, TypeScript, minimal bundle)
- Strong performance with large datasets (10,000+ tasks)
- Active maintenance (2025 updates)
- Sprint planning optimization
- Comprehensive drag-and-drop support

**Runner-up:** `react-calendar-timeline` (beta with TypeScript rewrite, good for simpler timelines)

---

## Comparison Table

| Library | License | Bundle Size | TypeScript | Performance (100+ tasks) | Last Updated | Stars/Downloads | Maintenance |
|---------|---------|-------------|------------|-------------------------|--------------|-----------------|-------------|
| **SVAR React Gantt** | MIT | ~50-80KB (minimal) | ✅ Full (v2.3+) | ✅ Excellent (10K+ tasks) | 2025 | New library | ✅ Active |
| **react-calendar-timeline** | MIT | ~250KB + deps | ⚠️ Beta only | ⚠️ Degrades at 50+ items | 2025 | 2.1K stars, 88K/week | ⚠️ Needs help |
| **gantt-task-react** | MIT | 620KB | ✅ Yes | ⚠️ Moderate | 2023 | 1K stars, 24K/week | ⚠️ Stale |
| **@wamra/gantt-task-react** | MIT | 620KB | ✅ Enhanced | ✅ Optimized | 2024 | Fork (active) | ✅ Active |
| **frappe-gantt-react** | MIT | ~100KB | ⚠️ Via @types | ❌ Basic only | 2019 | 30K/week | ❌ Abandoned |
| **@dhtmlx/trial-react-gantt** | Commercial | Large | ✅ Yes | ✅ Excellent (30K+ tasks) | 2025 | N/A | ✅ Active |
| **react-timeline-scheduler** | MIT | Unknown | ✅ Yes | ✅ Good | 2024 | New library | ✅ Active |

---

## Detailed Evaluation

### 1. ⭐ SVAR React Gantt (RECOMMENDED)

**Installation:**
```bash
npm install @svar-ui/react-gantt
```

**Pros:**
- ✅ **MIT License** - Free for commercial use
- ✅ **Modern Stack** - React 18/19, full TypeScript support (v2.3+)
- ✅ **Excellent Performance** - Optimized rendering, handles 10,000+ tasks smoothly
- ✅ **Sprint Planning Optimized** - Designed for agile workflows, sprint tracking, milestone tracking
- ✅ **Minimal Bundle** - Small footprint compared to competitors
- ✅ **Comprehensive Features:**
  - Drag-and-drop task scheduling
  - Task dependencies (end-to-start, start-to-start, etc.)
  - Summary tasks, milestones, subtasks
  - In-cell editing
  - Zoom levels (day/week/month)
  - Light/dark mode
  - Mobile-friendly
  - Localization support
- ✅ **Active Maintenance** - Recent 2025 updates
- ✅ **Good Documentation** - Live demos, GitHub examples
- ✅ **PRO Edition Available** - Advanced features like auto-scheduling, baselines (optional paid upgrade)

**Cons:**
- ⚠️ Newer library (less battle-tested than older alternatives)
- ⚠️ Smaller community compared to established libraries
- ⚠️ Sprint lanes not explicitly shown in docs (may need custom implementation)

**Performance:**
- Live demo with 10,000 tasks shows consistent performance
- Optimized for large datasets with dynamic loading
- Minimal bundle size design

**Code Example:**
```tsx
import { Gantt } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/dist/style.css";

const tasks = [
  {
    id: 1,
    text: "Sprint 1",
    start: "2025-01-01",
    end: "2025-01-15",
    type: "summary", // Use for sprint lanes
    open: true
  },
  {
    id: 2,
    parent: 1,
    text: "Task 1",
    start: "2025-01-02",
    end: "2025-01-05",
    progress: 50
  },
  {
    id: 3,
    parent: 1,
    text: "Task 2",
    start: "2025-01-06",
    end: "2025-01-10",
    progress: 0
  }
];

const links = [
  { id: 1, source: 2, target: 3, type: 0 } // end-to-start
];

export default function SprintTimeline() {
  return (
    <Gantt
      tasks={tasks}
      links={links}
      scales={[
        { unit: "week", step: 1, format: "Week #W" },
        { unit: "day", step: 1, format: "D" }
      ]}
      columns={[
        { name: "text", label: "Task name", width: "100%" }
      ]}
    />
  );
}
```

**Sprint Lanes Implementation Strategy:**
1. Use `type: "summary"` tasks for sprint rows
2. Nest sprint tasks under summary tasks using `parent` property
3. Use `open: true` to keep sprint lanes expanded
4. Customize row styling to highlight sprint boundaries
5. Add custom columns for sprint metadata

**Resources:**
- NPM: https://www.npmjs.com/package/@svar-ui/react-gantt
- GitHub: https://github.com/svar-widgets/react-gantt
- Demos: https://github.com/svar-widgets/react-gantt-demos
- Docs: https://svar.dev/react/gantt/

---

### 2. react-calendar-timeline

**Installation:**
```bash
# Stable (JavaScript)
npm install react-calendar-timeline

# Beta (TypeScript rewrite - RECOMMENDED)
npm install react-calendar-timeline@beta

# Type definitions for stable version
npm install --save-dev @types/react-calendar-timeline
```

**Pros:**
- ✅ **MIT License** - Free for commercial use
- ✅ **TypeScript Beta** - Full TypeScript rewrite (v0.30.0-beta.5)
- ✅ **Established Library** - 2.1K GitHub stars, 88K weekly downloads
- ✅ **Good for Timeline Views** - Horizontal scrolling canvas design
- ✅ **Customization** - Flexible rendering options
- ✅ **Responsive** - Works well on different screen sizes
- ✅ **Zoom Levels** - Built-in zoom functionality

**Cons:**
- ❌ **Performance Issues** - Degrades significantly at 50+ items (reported GitHub issue #247)
- ❌ **Maintenance Concerns** - "HELP WANTED" in README, 233 open issues, 33 PRs
- ⚠️ **TypeScript Beta Only** - Stable version lacks TypeScript
- ⚠️ **Large Bundle** - ~250KB + dependencies (moment.js, interactjs)
- ⚠️ **Not Gantt-specific** - More generic timeline, needs customization for sprint lanes
- ⚠️ **Heavy Dependencies** - Requires moment.js (consider date-fns migration)

**Performance:**
- **Critical Issue:** Performance drops significantly around 50+ items with `fullUpdate=true`
- For 100 tasks: Expect performance challenges
- Workarounds: Disable horizontal lines, optimize rendering, use `fullUpdate=false`

**Code Example:**
```tsx
import Timeline from "react-calendar-timeline";
import "react-calendar-timeline/lib/Timeline.css";

const groups = [
  { id: "sprint-1", title: "Sprint 1" },
  { id: "sprint-2", title: "Sprint 2" }
];

const items = [
  {
    id: 1,
    group: "sprint-1",
    title: "Task 1",
    start_time: moment("2025-01-02"),
    end_time: moment("2025-01-05")
  },
  {
    id: 2,
    group: "sprint-1",
    title: "Task 2",
    start_time: moment("2025-01-06"),
    end_time: moment("2025-01-10")
  }
];

export default function SprintTimeline() {
  return (
    <Timeline
      groups={groups}
      items={items}
      defaultTimeStart={moment().add(-7, "day")}
      defaultTimeEnd={moment().add(7, "day")}
    />
  );
}
```

**Resources:**
- NPM: https://www.npmjs.com/package/react-calendar-timeline
- GitHub: https://github.com/namespace-ee/react-calendar-timeline
- Docs: Available in README

**Recommendation:** Wait for TypeScript beta to stabilize, or only use for <50 items.

---

### 3. gantt-task-react

**Installation:**
```bash
npm install gantt-task-react
```

**Pros:**
- ✅ **MIT License** - Free for commercial use
- ✅ **TypeScript Native** - Built with TypeScript
- ✅ **Simple API** - Easy to get started
- ✅ **Good Documentation** - Clear examples, CodeSandbox demos
- ✅ **Gantt-specific** - Designed for Gantt charts

**Cons:**
- ❌ **No Native Drag-and-Drop Between Lanes** - SVG limitations (GitHub issue #29)
- ❌ **Stale Maintenance** - Last publish ~2023
- ⚠️ **Large Bundle** - 620KB package size
- ⚠️ **Moderate Performance** - Not optimized for very large datasets
- ⚠️ **Limited Drag-and-Drop** - Only date dragging on taskbar, not full task reordering

**Performance:**
- Moderate - Works for 100+ tasks but not optimized
- Better than react-calendar-timeline for Gantt views
- Consider @wamra fork for performance improvements

**Code Example:**
```tsx
import { Gantt, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";

const tasks: Task[] = [
  {
    start: new Date(2025, 0, 1),
    end: new Date(2025, 0, 15),
    name: "Sprint 1",
    id: "sprint-1",
    type: "project",
    progress: 45,
    isDisabled: true,
    styles: { progressColor: "#4f46e5", progressSelectedColor: "#4338ca" }
  },
  {
    start: new Date(2025, 0, 2),
    end: new Date(2025, 0, 5),
    name: "Task 1",
    id: "task-1",
    type: "task",
    progress: 50,
    project: "sprint-1"
  }
];

export default function SprintGantt() {
  return (
    <Gantt
      tasks={tasks}
      viewMode={ViewMode.Day}
      onDateChange={(task, start, end) => console.log("Date changed", task, start, end)}
      onProgressChange={(task, progress) => console.log("Progress changed", task, progress)}
      listCellWidth="155px"
      columnWidth={60}
    />
  );
}
```

**Resources:**
- NPM: https://www.npmjs.com/package/gantt-task-react
- GitHub: https://github.com/MaTeMaTuK/gantt-task-react
- Demos: https://codesandbox.io/examples/package/gantt-task-react

---

### 4. @wamra/gantt-task-react (Enhanced Fork)

**Installation:**
```bash
npm install @wamra/gantt-task-react
```

**Pros:**
- ✅ **All gantt-task-react Pros** - Plus enhancements
- ✅ **Performance Optimized** - Improved rendering for large datasets
- ✅ **Enhanced TypeScript** - Better type definitions
- ✅ **Better Mobile Support** - Improved touch handling
- ✅ **More Customization** - Enhanced task styling options
- ✅ **Active Maintenance** - Fork actively maintained

**Cons:**
- ⚠️ **Still Large Bundle** - 620KB (same as original)
- ⚠️ **Fork Dependency** - Not the original maintained package
- ⚠️ **Same Drag-and-Drop Limitations** - SVG constraints remain

**Recommendation:** Use this over original gantt-task-react if you need better performance.

**Resources:**
- NPM: https://www.npmjs.com/package/@wamra/gantt-task-react
- GitHub: https://github.com/wamra/gantt-task-react

---

### 5. frappe-gantt-react

**Installation:**
```bash
npm install frappe-gantt-react
# Or
npm install react-frappe-gantt
```

**Pros:**
- ✅ **MIT License** - Free
- ✅ **Lightweight** - ~100KB
- ✅ **Simple** - Easy to implement
- ✅ **Vanilla JS Base** - frappe-gantt is well-known

**Cons:**
- ❌ **Abandoned** - Last publish 5-7 years ago
- ❌ **No TypeScript Native** - Uses @types package
- ❌ **Limited Features** - Basic Gantt only
- ❌ **No Sprint Lanes** - Not designed for sprint planning
- ❌ **Poor React Integration** - Just a wrapper

**Recommendation:** ❌ Do not use - Too outdated, better alternatives exist.

---

### 6. @dhtmlx/trial-react-gantt (Commercial)

**Installation:**
```bash
npm install @dhtmlx/trial-react-gantt
```

**Pros:**
- ✅ **Enterprise-Grade** - Production-ready
- ✅ **Excellent Performance** - Renders 30,000+ tasks in milliseconds
- ✅ **Feature-Rich** - Auto-scheduling, baselines, critical path, resource management
- ✅ **TypeScript Support** - Full TypeScript definitions
- ✅ **Active Maintenance** - Professional support
- ✅ **Advanced Drag-and-Drop** - Full task reordering, multi-task selection

**Cons:**
- ❌ **Commercial License** - $599+ per developer (ongoing cost)
- ❌ **Large Bundle** - Heavyweight library
- ⚠️ **Overkill for Basic Sprints** - More features than needed

**Recommendation:** Only consider if budget allows and you need enterprise features.

**Resources:**
- Website: https://dhtmlx.com/docs/products/dhtmlxGantt-for-React/
- Pricing: From $599/developer

---

### 7. react-timeline-scheduler

**Installation:**
```bash
npm install react-timeline-scheduler
```

**Pros:**
- ✅ **Modern** - Recently developed (2024)
- ✅ **TypeScript** - Built with TypeScript
- ✅ **Performance Focused** - Optimized for large datasets
- ✅ **Theme Support** - Light/dark mode, customizable
- ✅ **Accessibility** - Keyboard nav, screen reader support
- ✅ **Touch Support** - Mobile-friendly

**Cons:**
- ⚠️ **New Library** - Less proven than alternatives
- ⚠️ **Limited Documentation** - Newer, smaller community
- ⚠️ **Unknown Bundle Size** - Not documented
- ⚠️ **More Scheduler Than Gantt** - Better for resource scheduling

**Recommendation:** Good alternative for scheduling views, but less suitable for traditional sprint Gantt charts.

**Resources:**
- GitHub: https://github.com/LuciferDIot/react-timeline-scheduler

---

## Final Recommendation

### Primary Recommendation: SVAR React Gantt

**Why SVAR React Gantt:**
1. **Cost-Effective** - MIT license, no licensing fees (vs $599+ for DHTMLX)
2. **Performance** - Handles 10,000+ tasks (vs react-calendar-timeline degrading at 50+)
3. **Modern** - React 18/19, full TypeScript, minimal bundle (vs 620KB gantt-task-react)
4. **Sprint Optimized** - Designed for agile workflows, sprint planning
5. **Active Maintenance** - 2025 updates, responsive maintainers
6. **Feature-Rich** - Drag-and-drop, dependencies, zoom, themes, mobile support
7. **Small Bundle** - ~50-80KB (vs 250KB+ for react-calendar-timeline with deps)

**Implementation Approach for Sprint Lanes:**
```tsx
// Sprint as summary task with nested sprint tasks
const sprintData = [
  {
    id: "sprint-1",
    text: "Sprint 1 (Jan 1-15)",
    start: "2025-01-01",
    end: "2025-01-15",
    type: "summary", // Sprint lane
    open: true,
    color: "#e0f2fe" // Custom sprint color
  },
  {
    id: "task-1",
    parent: "sprint-1", // Belongs to Sprint 1
    text: "ARCH-123: User authentication",
    start: "2025-01-02",
    end: "2025-01-05",
    progress: 50,
    type: "task"
  },
  // ... more tasks
];

// Render with custom columns for sprint metadata
<Gantt
  tasks={sprintData}
  links={dependencies}
  scales={[
    { unit: "week", step: 1, format: "Week #W" },
    { unit: "day", step: 1, format: "D" }
  ]}
  columns={[
    { name: "text", label: "Task", width: "250px" },
    { name: "start", label: "Start", width: "100px" },
    { name: "end", label: "End", width: "100px" }
  ]}
/>
```

### Alternative: react-calendar-timeline (Beta)

**When to use:**
- Simpler timeline visualization (not full Gantt)
- <50 tasks only (performance constraint)
- Want horizontal lanes instead of hierarchical structure
- TypeScript beta acceptable for your risk tolerance

**Wait for:** Beta stabilization, performance improvements

---

## Installation Instructions (SVAR React Gantt)

### Step 1: Install Package

```bash
cd /home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs
npm install @svar-ui/react-gantt
```

### Step 2: Create Sprint Timeline Component

```tsx
// src/features/sprints/components/SprintTimeline.tsx
"use client";

import { Gantt } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/dist/style.css";
import { Sprint, Task } from "@/lib/types";
import { useMemo } from "react";

interface SprintTimelineProps {
  sprints: Sprint[];
  tasks: Task[];
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
}

export function SprintTimeline({ sprints, tasks, onTaskUpdate }: SprintTimelineProps) {
  const ganttData = useMemo(() => {
    const ganttTasks = [];
    const ganttLinks = [];

    // Add sprints as summary tasks
    sprints.forEach((sprint) => {
      ganttTasks.push({
        id: `sprint-${sprint.id}`,
        text: `${sprint.name} (${sprint.goal || "No goal"})`,
        start: new Date(sprint.start_date).toISOString().split("T")[0],
        end: new Date(sprint.end_date).toISOString().split("T")[0],
        type: "summary",
        open: sprint.status === "active", // Auto-expand active sprints
        color: sprint.status === "active" ? "#dbeafe" : "#f3f4f6"
      });

      // Add tasks belonging to this sprint
      const sprintTasks = tasks.filter((task) => task.sprint_id === sprint.id);
      sprintTasks.forEach((task) => {
        ganttTasks.push({
          id: task.id,
          parent: `sprint-${sprint.id}`,
          text: task.title,
          start: task.start_date || sprint.start_date,
          end: task.end_date || sprint.end_date,
          progress: task.progress || 0,
          type: "task"
        });
      });
    });

    return { tasks: ganttTasks, links: ganttLinks };
  }, [sprints, tasks]);

  return (
    <div className="h-[600px] w-full">
      <Gantt
        tasks={ganttData.tasks}
        links={ganttData.links}
        scales={[
          { unit: "week", step: 1, format: "Week #W" },
          { unit: "day", step: 1, format: "d" }
        ]}
        columns={[
          { name: "text", label: "Task", width: "250px" },
          { name: "start", label: "Start", width: "100px" },
          { name: "end", label: "End", width: "100px" }
        ]}
        onTaskUpdate={(id, task) => {
          if (!id.startsWith("sprint-")) {
            onTaskUpdate?.(id, {
              start_date: task.start,
              end_date: task.end,
              progress: task.progress
            });
          }
        }}
      />
    </div>
  );
}
```

### Step 3: Integrate into Sprint View

```tsx
// src/features/sprints/views/SprintTimelineView.tsx
"use client";

import { SprintTimeline } from "../components/SprintTimeline";
import { useSprintQueries } from "../hooks/useSprintQueries";
import { useTaskStore } from "@/store/useTaskStore";

export function SprintTimelineView({ projectId }: { projectId: string }) {
  const { data: sprints, isLoading: sprintsLoading } = useSprintQueries.useSprints(projectId);
  const { tasks, updateTask } = useTaskStore();

  if (sprintsLoading) return <div>Loading timeline...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Sprint Timeline</h2>
      <SprintTimeline
        sprints={sprints || []}
        tasks={tasks}
        onTaskUpdate={(taskId, updates) => updateTask(taskId, updates)}
      />
    </div>
  );
}
```

### Step 4: Add Routing

```tsx
// src/app/(dashboard)/projects/[id]/timeline/page.tsx
import { SprintTimelineView } from "@/features/sprints/views/SprintTimelineView";

export default function ProjectTimelinePage({ params }: { params: { id: string } }) {
  return <SprintTimelineView projectId={params.id} />;
}
```

---

## Bundle Size Comparison

| Library | Minified | Gzipped | Dependencies |
|---------|----------|---------|--------------|
| SVAR React Gantt | ~50-80KB | ~20-30KB | None (peer: React) |
| react-calendar-timeline | ~250KB | ~80KB | moment.js, interactjs |
| gantt-task-react | 620KB | ~200KB | None |
| @wamra/gantt-task-react | 620KB | ~200KB | None |
| frappe-gantt-react | ~100KB | ~35KB | frappe-gantt |
| DHTMLX Gantt | ~500KB+ | ~150KB+ | Many |

**Note:** Bundle sizes are approximate. Actual impact depends on tree-shaking and shared dependencies.

---

## Potential Issues & Limitations

### SVAR React Gantt
- **Sprint Lanes Not Native** - Need to use summary tasks + parent relationships
- **Drag Between Sprints** - May need custom logic to prevent/allow dragging tasks between sprint lanes
- **New Library** - Less Stack Overflow content, smaller community
- **Customization Learning Curve** - Documentation shows examples but may need exploration

### react-calendar-timeline
- **Performance Critical** - Will struggle with 100+ tasks
- **Beta Instability** - TypeScript version still in beta (testing incomplete)
- **Maintenance Risk** - "HELP WANTED" signal indicates maintainer burnout
- **Heavy Dependencies** - moment.js is large and outdated (date-fns preferred)

### gantt-task-react / @wamra fork
- **Large Bundle** - 620KB is significant for a single component
- **No Lane Switching** - Cannot drag tasks between sprint lanes (SVG limitation)
- **Static Structure** - Less flexible than SVAR for custom sprint layouts

### DHTMLX Gantt
- **Cost** - Licensing fees compound over team growth
- **Vendor Lock-in** - Commercial dependency
- **Bundle Size** - Large footprint

---

## Performance Testing Recommendations

Before final decision, test with production-scale data:

1. **Load Test:** 100 tasks across 5 sprints
2. **Stress Test:** 500+ tasks to verify smooth scrolling
3. **Interaction Test:** Drag-and-drop responsiveness
4. **Mobile Test:** Touch interactions on tablet/phone
5. **Bundle Analysis:** Actual build impact

```bash
# Test SVAR React Gantt with sample data
npm install @svar-ui/react-gantt
# Create test component with 100+ tasks
# Measure render time, interaction lag, bundle impact
```

---

## Migration Path (if switching libraries later)

1. **Abstraction Layer:** Create `<SprintGanttChart>` wrapper component
2. **Adapter Pattern:** Convert internal task data to library-specific format
3. **Feature Flags:** Test new library alongside old one
4. **Gradual Rollout:** Switch one view at a time

```tsx
// Abstraction example
interface GanttAdapter {
  convertToLibraryFormat(sprints: Sprint[], tasks: Task[]): any;
  convertFromLibraryFormat(data: any): { sprints: Sprint[], tasks: Task[] };
}

// Swap implementations without changing consumer code
```

---

## Conclusion

**Recommended:** Install `@svar-ui/react-gantt` and build sprint timeline using summary tasks for sprint lanes.

**Why:** Best balance of performance, features, cost, maintenance, and TypeScript support for Jira-like sprint visualization.

**Next Steps:**
1. Install SVAR React Gantt
2. Create SprintTimeline component with sprint lanes using summary tasks
3. Test with 100+ tasks to validate performance
4. Customize styling to match Archon design system
5. Add drag-and-drop handlers with sprint validation (prevent dragging out of sprint if needed)
6. Implement zoom controls and filter options

---

## Additional Resources

**SVAR React Gantt:**
- Docs: https://docs.svar.dev/react/gantt/
- Demos: https://github.com/svar-widgets/react-gantt-demos
- GitHub: https://github.com/svar-widgets/react-gantt

**Alternative Resources (if needed):**
- react-calendar-timeline: https://github.com/namespace-ee/react-calendar-timeline
- gantt-task-react: https://github.com/MaTeMaTuK/gantt-task-react
- Comparison articles: https://svar.dev/blog/top-react-gantt-charts/

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
**Status:** Ready for implementation
