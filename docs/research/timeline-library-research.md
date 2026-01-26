# Timeline Library Research - Phase 3.6
**Date:** 2026-01-25
**Sprint:** Sprint 1 - Enhanced Views
**Researcher:** library-researcher agent
**Status:** Complete

## Executive Summary

After comprehensive research of React timeline/Gantt libraries for Archon's PM system, **SVAR React Gantt** is recommended as the primary choice for free open-source solution, with **react-calendar-timeline** as an alternative for simpler timeline needs.

## Requirements Analysis

Based on Phase 3 Enhanced Views requirements:
- ✅ Timeline/Gantt visualization for tasks and sprints
- ✅ Drag-and-drop task scheduling
- ✅ Zoom levels (hour/day/week/month)
- ✅ Task dependencies visualization
- ✅ Performance with 500+ tasks
- ✅ Theme integration (existing Archon theme)
- ✅ TypeScript support
- ✅ React 18+ compatibility

---

## Library Comparison Matrix

| Feature | SVAR React Gantt | react-calendar-timeline | frappe-gantt-react | Bryntum | Syncfusion |
|---------|-----------------|------------------------|-------------------|---------|-----------|
| **Weekly Downloads** | Growing | 74k | 35k (vanilla) | N/A | N/A |
| **GitHub Stars** | ~400 | 2.1k | 5.8k (vanilla) | N/A | N/A |
| **License** | MIT (Free) + PRO ($524) | MIT (Free) | MIT (Free) | Commercial ($940) | Commercial (Custom) |
| **React Native** | ✅ Pure React | ✅ Pure React | ❌ Wrapper | ❌ Wrapper | ❌ Wrapper |
| **React 19 Support** | ✅ | ⚠️ 18 only | ❌ | ✅ | ✅ |
| **TypeScript** | ✅ Full | ✅ Good | ⚠️ Limited | ✅ Excellent | ✅ Excellent |
| **Drag & Drop** | ✅ Built-in | ✅ Built-in | ✅ Built-in | ✅ Advanced | ✅ Advanced |
| **Dependencies** | ✅ Hierarchical | ✅ Groups | ⚠️ Basic | ✅ Advanced | ✅ Advanced |
| **Critical Path** | ✅ (PRO) | ❌ | ❌ | ✅ | ✅ |
| **Resource View** | ❌ | ✅ Groups | ❌ | ✅ | ✅ |
| **Export** | ❌ | ❌ | ❌ | ✅ PDF/PNG/Excel | ✅ PDF/CSV/Excel |
| **Bundle Size** | Medium (~150kb) | Small (~100kb) | Tiny (~40kb) | Large (~500kb) | Large (~600kb) |
| **Performance** | 10k tasks (demo) | 1k+ tasks | 500 tasks | 100k+ tasks | 50k+ tasks |
| **Learning Curve** | Moderate | Low | Very Low | Steep | Steep |
| **Documentation** | Good | Excellent | Basic | Excellent | Excellent |
| **Customization** | High | Very High | Low | Very High | High |
| **Mobile Support** | ✅ | ✅ | ⚠️ Limited | ✅ | ✅ |

---

## Detailed Analysis

### 1. SVAR React Gantt (⭐ RECOMMENDED)

**npm:** `@svar-ui/react-gantt`
**License:** MIT (Free) + PRO Edition ($524 one-time)
**Maintained:** Very Active (React 19 support added Dec 2025)

#### Pros ✅
- **Pure React:** Native React implementation, not a wrapper
- **Modern Stack:** React 18 & 19 compatible, full TypeScript support
- **Drag & Drop:** Intuitive interface for task scheduling
- **Dependencies:** Visual dependency management (timeline + popup form)
- **Hierarchical Tasks:** Subtask organization out-of-box
- **Performance:** Optimized for 10k+ tasks (demo proven)
- **Customization:** Custom HTML in grid cells, configurable scales
- **Themes:** Built-in light/dark themes
- **Features:** Progress indicators, tooltips, keyboard shortcuts, localization
- **MIT License:** Free for commercial use
- **Bundle Size:** Medium (~150kb), acceptable
- **Active Development:** Regular updates, React 19 support

#### Cons ❌
- **New Library:** Less battle-tested than competitors (~400 stars vs 2k+)
- **Limited Export:** No PDF/Excel export in free version
- **No Resource View:** Lacks multi-resource timeline (not needed for Archon)
- **PRO Features:** Some advanced features behind paywall (critical path, auto-scheduling, undo/redo)
- **Documentation:** Good but less comprehensive than commercial options

#### Installation
```bash
npm install @svar-ui/react-gantt
```

```tsx
import { Gantt } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";

const tasks = [
  { id: 1, text: "Task 1", start: "2026-01-25", duration: 5, progress: 50, parent: 0 },
  { id: 2, text: "Task 2", start: "2026-01-28", duration: 3, progress: 0, parent: 0 }
];

const links = [
  { id: 1, source: 1, target: 2, type: "e2s" }
];

<Gantt tasks={tasks} links={links} scales={scales} />
```

#### Integration Effort: **2-3 hours**
- Install and configure: 30 min
- Create TimelineView wrapper: 1 hour
- Integrate with Archon theme: 1 hour
- Connect to task/sprint APIs: 30 min

---

### 2. react-calendar-timeline (Strong Alternative)

**npm:** `react-calendar-timeline`
**License:** MIT (Completely Free)
**Maintained:** Active (74k weekly downloads)

#### Pros ✅
- **Pure React:** Native React component
- **Mature:** 2.1k stars, battle-tested
- **Highly Customizable:** Custom renderers for items/groups
- **Resource Management:** Built-in group support (team members)
- **Flexible Zoom:** 1 hour to 5 years granularity
- **Features:** Draggable, resizable, synchronized scrolling
- **Tree View:** Group hierarchies supported
- **Bundle Size:** Small (~100kb)
- **Documentation:** Excellent with CodeSandbox examples
- **No Paywall:** All features free

#### Cons ❌
- **Not Gantt-Specific:** More generic timeline than project management tool
- **No Dependencies:** Doesn't visualize task dependencies (need custom implementation)
- **No Critical Path:** Lacks PM-specific features
- **Styling Required:** More manual styling work
- **React 18 Only:** No React 19 support yet

#### Installation
```bash
npm install react-calendar-timeline
```

```tsx
import Timeline from 'react-calendar-timeline'
import 'react-calendar-timeline/lib/Timeline.css'

const groups = [{ id: 1, title: 'Sprint 1' }]
const items = [
  {
    id: 1,
    group: 1,
    title: 'Task 1',
    start_time: moment(),
    end_time: moment().add(1, 'day')
  }
]

<Timeline
  groups={groups}
  items={items}
  defaultTimeStart={moment().add(-12, 'hour')}
  defaultTimeEnd={moment().add(12, 'hour')}
/>
```

#### Integration Effort: **3-4 hours**
- Install and configure: 30 min
- Create TimelineView wrapper: 1.5 hours
- Custom dependency rendering: 1 hour
- Integrate with Archon theme: 1 hour

---

### 3. frappe-gantt-react (Simplest Option)

**npm:** `frappe-gantt` + wrapper
**License:** MIT (Free)
**Maintained:** Vanilla library active (5.8k stars)

#### Pros ✅
- **Lightweight:** Tiny bundle (~40kb)
- **Simple API:** Easiest to integrate
- **Drag & Drop:** Basic task rescheduling
- **Dependencies:** Simple dependency arrows
- **Zoom Levels:** Day/week/month/quarter views
- **Free:** MIT license, no premium tiers

#### Cons ❌
- **Wrapper Required:** Not native React (uses frappe-gantt-react wrapper)
- **Limited Features:** No progress indicators, no resource view, no critical path
- **Basic Styling:** Limited customization
- **Performance:** Designed for <500 tasks
- **TypeScript:** Limited support
- **React Integration:** Wrapper pattern adds complexity

#### Integration Effort: **2 hours**
- Install and configure: 20 min
- Create wrapper component: 40 min
- Basic theme integration: 40 min
- Connect to APIs: 20 min

---

### 4. Commercial Options (Not Recommended)

#### Bryntum React Gantt ($940/dev)
- Most feature-rich, best performance (100k+ tasks)
- PDF/PNG/Excel export, resource timeline, critical path
- Excellent documentation
- **Too expensive for open-source project**

#### Syncfusion React Gantt (Custom pricing)
- Enterprise features, comprehensive
- PDF/CSV/Excel export, resource management
- **License cost not justified**

#### DevExtreme React Gantt ($899.99/dev)
- Good features, mobile support
- **Premium pricing for features we don't need**

---

## Recommendation Decision Matrix

### Choose SVAR React Gantt if:
- ✅ Need modern Gantt chart for PM (Google Project/Jira-style)
- ✅ Want pure React implementation (no wrappers)
- ✅ Require task dependencies visualization
- ✅ Need 500+ task performance
- ✅ Value React 18/19 + TypeScript support
- ✅ Want hierarchical task organization
- ✅ Budget: $0 (MIT) or $524 (PRO features)

### Choose react-calendar-timeline if:
- ⚠️ Need resource/team member view more than Gantt features
- ⚠️ Prefer battle-tested library (74k downloads)
- ⚠️ Want maximum customization flexibility
- ⚠️ Don't need dependency visualization
- ⚠️ Comfortable implementing custom PM features

### Choose frappe-gantt-react if:
- ⚠️ Have <500 tasks (small projects only)
- ⚠️ Want minimal bundle size (~40kb)
- ⚠️ Need simple timeline only
- ⚠️ Don't need advanced PM features

---

## Final Recommendation: SVAR React Gantt

**Decision:** **SVAR React Gantt** is the optimal choice for Archon PM system.

### Justification:
1. **PM-Specific:** Built for project management (Gantt/timeline hybrid)
2. **Modern Stack:** Pure React (not wrapper), React 19 + TypeScript
3. **Dependencies:** Visual dependency management (critical for PM)
4. **Performance:** 10k+ tasks (exceeds 500+ requirement)
5. **Features:** Progress bars, subtasks, drag-drop, zoom - all needed
6. **Cost:** MIT license (free) vs $940+ for Bryntum/Syncfusion
7. **Bundle Size:** 150kb (reasonable vs 500kb+ commercial)
8. **Active Development:** React 19 support shows commitment

### Implementation Plan:
1. ✅ **Phase 3.6 (Current):** Research complete - SVAR React Gantt selected
2. **Phase 3.7 (Create):** Build TimelineView component wrapper
   - Install @svar-ui/react-gantt
   - Create `TimelineView.tsx` with zoom controls
   - Map `archon_tasks` + `archon_sprints` to Gantt data
   - Integrate Archon theme colors via CSS
   - Add responsive container
3. **Phase 3.8:** Integrate timeline data fetching with APIs
   - Fetch tasks by sprint/project
   - Fetch task dependencies
   - Transform to SVAR format
   - Real-time updates via WebSocket (future)
4. **Phase 3.9:** Polish timeline UI with milestones and dependencies
   - Add sprint milestones
   - Visualize task dependencies
   - Custom progress indicators
   - Tooltip customization
5. **Phase 3.10:** Timeline testing and performance optimization
   - Load testing with 1000+ tasks
   - Interaction testing (drag-drop, zoom)
   - Keyboard navigation
6. **Phase 3.11:** Optimize timeline performance for large datasets
   - Implement pagination
   - Lazy loading
   - Virtual scrolling (if needed)
   - Caching strategies

---

## Alternative Scenarios

### If Simpler Timeline Needed:
Consider **react-calendar-timeline** if:
- Focus on resource scheduling (team member timelines)
- Don't need task dependencies
- Want maximum customization
- Prefer mature, well-documented library

### If Budget Available ($524):
Upgrade to **SVAR PRO** for:
- Critical path analysis
- Auto-scheduling
- Work calendars (holidays, weekends)
- Baselines (planned vs actual)
- Split tasks
- Undo/redo functionality

### If Enterprise Budget ($940+):
Consider **Bryntum Gantt** for:
- 100k+ task performance
- Resource timelines (capacity planning)
- PDF/Excel export
- Advanced scheduling algorithms
- Official support

---

## Dependencies

### SVAR React Gantt
```json
{
  "dependencies": {
    "@svar-ui/react-gantt": "^2.3.0"
  }
}
```

### Bundle Impact
- @svar-ui/react-gantt: ~150kb gzipped
- No additional dependencies required
- **Total New:** ~150kb

---

## Theme Integration Strategy

### CSS Customization
```css
/* archon-ui-nextjs/styles/gantt-theme.css */

/* Override SVAR default colors with Archon theme */
.gantt-container {
  --wx-background: #ffffff;
  --wx-border: #e5e7eb;          /* Archon gray-200 */
  --wx-primary: #3b82f6;         /* Archon primary-500 */
  --wx-primary-hover: #2563eb;   /* Archon primary-600 */
  --wx-text: #1f2937;            /* Archon gray-800 */
  --wx-text-secondary: #6b7280;  /* Archon gray-500 */
  font-family: 'Inter', sans-serif;
}

/* Task bar colors by status */
.gantt-task[data-status="todo"] {
  background-color: #9ca3af;  /* Archon gray-400 */
}

.gantt-task[data-status="doing"] {
  background-color: #3b82f6;  /* Archon primary-500 */
}

.gantt-task[data-status="review"] {
  background-color: #f59e0b;  /* Archon warning-500 */
}

.gantt-task[data-status="done"] {
  background-color: #10b981;  /* Archon success-500 */
}

/* Sprint milestone styling */
.gantt-milestone {
  color: #8b5cf6;  /* Archon purple-500 */
}

/* Dependency line colors */
.gantt-link {
  stroke: #6b7280;  /* Archon gray-500 */
}
```

---

## Performance Considerations

### Optimization Strategy (Phase 3.11)
- **Date Range Filtering:** Load only visible timeline range
- **Pagination:** 500 tasks per page
- **Lazy Loading:** Load tasks on-demand as user scrolls
- **Memoization:** Wrap data transformation with `useMemo`
- **Virtual Scrolling:** SVAR handles this internally

### Expected Performance
- **100 tasks:** Instant rendering (<50ms)
- **500 tasks:** Smooth (100-200ms)
- **1000 tasks:** Good (200-500ms)
- **5000 tasks:** Acceptable with pagination (500ms-1s)
- **10,000 tasks:** SVAR demo proven, need date filtering

---

## Testing Strategy (Phase 3.10)

### Unit Tests
- Task rendering with various statuses
- Dependency line rendering
- Zoom level changes
- Date navigation

### Integration Tests
- API data fetching and transformation
- Drag-drop task rescheduling
- Sprint filtering
- Task detail modal integration

### Performance Tests
- Load 1000 tasks benchmark
- Zoom/pan performance
- Drag-drop responsiveness
- Memory leak detection

### Accessibility Tests
- Keyboard navigation
- Screen reader support
- ARIA labels
- Focus management

---

## Comparison: Calendar vs Timeline

| Feature | react-big-calendar | SVAR React Gantt |
|---------|-------------------|------------------|
| **Purpose** | Event scheduling | Task timeline |
| **Views** | Month/Week/Day/Agenda | Gantt/Timeline |
| **Dependencies** | ❌ No | ✅ Yes |
| **Duration** | ⚠️ Day-level | ✅ Hour-level |
| **Drag-Drop** | ✅ Event move | ✅ Task schedule |
| **Use Case** | Calendar events, due dates | Project timeline, sprints |

**Strategy:** Use **both**
- **Calendar:** For task due dates, sprint planning, team availability
- **Timeline:** For task dependencies, project roadmap, sprint Gantt

---

## References

- [SVAR React Gantt GitHub](https://github.com/svar-widgets/react-gantt)
- [SVAR React Gantt Docs](https://svar.dev/react/gantt/)
- [SVAR Blog: Top 5 React Gantt Charts 2026](https://svar.dev/blog/top-react-gantt-charts/)
- [react-calendar-timeline GitHub](https://github.com/namespace-ee/react-calendar-timeline)
- [LogRocket: React Timeline Libraries Comparison](https://blog.logrocket.com/comparing-best-react-timeline-libraries/)
- [NPM Trends: Timeline Library Comparison](https://npmtrends.com/frappe-gantt-vs-react-calendar-timeline)

---

## Next Steps

1. ✅ **Complete Phase 3.6:** Update Archon task with findings
2. **Start Phase 3.7 (not in sprint):** Create TimelineView component
3. **Install Dependencies:** `npm install @svar-ui/react-gantt`
4. **Create Wrapper:** Build `TimelineView.tsx` in `archon-ui-nextjs/src/features/projects/components/`
5. **Theme Integration:** Create `gantt-theme.css`
6. **API Integration:** Map tasks/sprints to SVAR format
7. **Documentation:** Add usage guide to Archon docs

---

**Research completed:** 2026-01-25
**Time spent:** 1.5 hours
**Confidence level:** High (90%)
**Recommendation:** SVAR React Gantt (MIT, Free, React 19, TypeScript, 10k tasks)
**Alternative:** react-calendar-timeline (for resource-focused timelines)
