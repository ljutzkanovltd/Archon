# Sprint Management User Guide

**Version:** 1.0
**Last Updated:** 2026-01-22
**Applies to:** Archon PM v2.0+

## Table of Contents

1. [Overview](#overview)
2. [Sprint Basics](#sprint-basics)
3. [Creating a Sprint](#creating-a-sprint)
4. [Managing Sprint Backlog](#managing-sprint-backlog)
5. [Starting a Sprint](#starting-a-sprint)
6. [Working with Sprint Board](#working-with-sprint-board)
7. [Tracking Sprint Progress](#tracking-sprint-progress)
8. [Completing a Sprint](#completing-a-sprint)
9. [Sprint Metrics & Burndown](#sprint-metrics--burndown)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Overview

Sprints are time-boxed iterations where teams focus on delivering a specific set of tasks. Archon's sprint management system helps teams plan, execute, and track work in an organized, predictable manner.

### Key Features

- **Sprint Lifecycle Management** - Create, start, complete sprints with state validation
- **Sprint Board** - Kanban-style board filtered by sprint with drag-and-drop
- **Burndown Charts** - Visual progress tracking with story points
- **Velocity Tracking** - Historical performance metrics across sprints
- **Sprint Reports** - Completion rates, task distribution, team productivity

### Sprint States

```
planned → active → completed
              ↓
          cancelled (optional)
```

| State | Description | Allowed Actions |
|-------|-------------|-----------------|
| **Planned** | Sprint created, not yet started | Edit, Delete, Start, Add/Remove Tasks |
| **Active** | Sprint in progress | Complete, Add/Remove Tasks, Move Tasks |
| **Completed** | Sprint finished | View Only, Generate Report |
| **Cancelled** | Sprint terminated early | View Only |

---

## Sprint Basics

### What is a Sprint?

A sprint is a fixed time period (typically 1-4 weeks) during which a team commits to completing specific tasks. Sprints provide:

- **Focus** - Clear goals for a defined period
- **Predictability** - Regular delivery cadence
- **Adaptability** - Frequent checkpoints to adjust plans
- **Accountability** - Committed work with visibility

### Sprint Components

1. **Name** - Descriptive sprint identifier (e.g., "Sprint 23 - Q1 Features")
2. **Duration** - Start and end dates (recommended: 1-2 weeks)
3. **Goal** - High-level objective for the sprint
4. **Tasks** - Collection of work items to complete
5. **Capacity** - Total story points or hours available

### Recommended Sprint Durations

| Team Type | Recommended Duration | Reasoning |
|-----------|---------------------|-----------|
| New/Small Teams | 1 week | Faster feedback, easier planning |
| Established Teams | 2 weeks | Balance planning overhead with flexibility |
| Mature Teams | 3-4 weeks | Reduce ceremony, stable velocity |
| Research Projects | Flexible | Based on experiment cycles |

---

## Creating a Sprint

### Step 1: Navigate to Sprints View

1. Open your project
2. Click the **"Sprints"** tab in the navigation
3. You'll see a list of existing sprints grouped by status:
   - Active Sprints (top)
   - Planned Sprints
   - Completed Sprints (bottom)

### Step 2: Click "New Sprint"

Click the **"New Sprint"** button (top right of sprints list).

A modal will appear with the sprint creation form.

### Step 3: Fill Sprint Details

**Required Fields:**

- **Sprint Name**
  - Format: "Sprint [Number]" or descriptive name
  - Examples: "Sprint 1", "Q1 Release Sprint", "Bug Bash Week"
  - Keep it concise (20-40 characters)

- **Start Date**
  - Default: Today
  - Best Practice: Start sprints on Monday or Tuesday
  - Cannot be in the past

- **End Date**
  - Default: 2 weeks from start date
  - Must be after start date
  - Recommended: 7-14 days

**Optional Fields:**

- **Sprint Goal**
  - High-level objective for the sprint
  - Examples:
    - "Complete user authentication flow"
    - "Fix all P0 bugs from production"
    - "Implement MVP features for beta launch"
  - Keep it focused (1-2 sentences)

### Step 4: Create Sprint

1. Review your entries
2. Click **"Create Sprint"**
3. Wait for success notification
4. Sprint appears in "Planned" section

**Screenshot Reference:**
```
[Create Sprint Modal]
┌─────────────────────────────────────┐
│ Create New Sprint            [X]    │
├─────────────────────────────────────┤
│ Sprint Name*                        │
│ [Sprint 12 - Payment Features  ]    │
│                                     │
│ Start Date*          End Date*      │
│ [2026-01-22    ]  [2026-02-05   ]   │
│                                     │
│ Sprint Goal (optional)              │
│ [Implement Stripe payment      ]    │
│ [integration and checkout flow ]    │
│                                     │
│         [Cancel]  [Create Sprint]   │
└─────────────────────────────────────┘
```

### Common Errors During Creation

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "End date must be after start date" | Invalid date range | Adjust end date to be later |
| "Sprint name already exists" | Duplicate name | Choose unique name |
| "Cannot create sprint in the past" | Start date < today | Set start date to today or future |

---

## Managing Sprint Backlog

The sprint backlog is the collection of tasks committed to a sprint.

### Adding Tasks to Sprint

**Method 1: From Task Modal**

1. Open any task (click task card or "Edit Task")
2. Find **"Sprint"** dropdown
3. Select target sprint from list
   - Only active and planned sprints shown
4. Click "Save"

**Method 2: Drag and Drop** (Sprint Planning View)

1. Navigate to project → Sprints tab
2. Click sprint to open detail view
3. Unassigned tasks shown in left sidebar
4. Drag tasks from sidebar → sprint task list
5. Tasks automatically assigned to sprint

**Method 3: Bulk Assignment**

1. Go to Tasks tab
2. Select multiple tasks (checkboxes)
3. Click "Assign to Sprint" action
4. Choose sprint from dropdown
5. Confirm assignment

### Removing Tasks from Sprint

**Before Sprint Starts:**

1. Open task detail
2. Set sprint dropdown to "None" or different sprint
3. Save changes

**During Active Sprint:**

⚠️ **Warning:** Removing tasks from active sprint affects burndown calculations and velocity metrics. Document reason for removal.

1. Open task detail
2. Change sprint to "None"
3. System prompts: "This sprint is active. Are you sure?"
4. Confirm removal
5. Task moved back to backlog

### Reordering Tasks

Tasks within a sprint can be prioritized:

1. Open sprint detail view
2. Drag task cards up/down to reorder
3. Order persists for team reference
4. No impact on workflow stage

---

## Starting a Sprint

### Prerequisites

Before starting a sprint:

- [ ] Sprint has at least one task assigned
- [ ] Sprint start date is today or in the past
- [ ] Team has reviewed and committed to tasks
- [ ] Sprint goal is clearly defined

### Starting Process

1. Navigate to Sprints tab
2. Find sprint in "Planned" section
3. Click sprint card to expand details
4. Click **"Start Sprint"** button
5. Confirmation dialog appears:

```
┌──────────────────────────────────────┐
│ Start Sprint?                   [X]  │
├──────────────────────────────────────┤
│ Sprint: Sprint 12                    │
│ Duration: Jan 22 - Feb 05 (14 days)  │
│ Tasks: 18 tasks (89 story points)    │
│                                      │
│ Starting the sprint will:            │
│ • Lock the sprint dates              │
│ • Begin burndown tracking            │
│ • Make sprint active for the team    │
│                                      │
│ Are you sure you want to start?      │
│                                      │
│       [Cancel]  [Yes, Start Sprint]  │
└──────────────────────────────────────┘
```

6. Click **"Yes, Start Sprint"**
7. Sprint moves to "Active" section
8. Sprint board becomes available

### What Happens When Sprint Starts

- Sprint status changes from `planned` → `active`
- Sprint dates are locked (cannot edit)
- Burndown tracking begins
- Sprint appears in active sprint filter
- Team receives notification (if configured)
- Sprint board is enabled for task management

### Sprint Start Rules

- ✅ Only one sprint can be active per project at a time (configurable)
- ✅ Cannot start sprint with end date in the past
- ✅ Can start sprint early (before start date)
- ❌ Cannot start completed or cancelled sprint
- ❌ Cannot edit dates after starting

---

## Working with Sprint Board

The sprint board is a Kanban-style view showing all tasks in the active sprint, organized by workflow stage.

### Accessing Sprint Board

**Method 1: Direct Navigation**

1. Go to project → Board tab
2. Sprint filter automatically set to active sprint
3. Board shows only sprint tasks

**Method 2: From Sprint List**

1. Go to Sprints tab
2. Click active sprint card
3. Click "View Board" button
4. Board opens filtered to sprint

### Board Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Sprint 12 - Payment Features            [Active] 8 days left │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Backlog (5)  │  In Progress (3)  │  Review (2)  │  Done (8) │
│ ┌───────────┐ │ ┌───────────┐    │ ┌──────────┐ │ ┌───────┐│
│ │Task #143  │ │ │Task #127  │    │ │Task #95  │ │ │Task #3││
│ │3 pts      │ │ │5 pts      │    │ │8 pts     │ │ │2 pts  ││
│ └───────────┘ │ └───────────┘    │ └──────────┘ │ └───────┘│
│               │                  │              │           │
│ ┌───────────┐ │ ┌───────────┐    │ ┌──────────┐ │ ┌───────┐│
│ │Task #144  │ │ │Task #128  │    │ │Task #96  │ │ │Task #4││
│ │2 pts      │ │ │3 pts      │    │              │ │...    ││
│ └───────────┘ │ └───────────┘    │              │           │
│    ...        │     ...          │              │           │
└─────────────────────────────────────────────────────────────┘
```

### Moving Tasks Between Stages

**Drag and Drop:**

1. Click and hold task card
2. Drag to target column
3. Drop in desired position
4. Task updates immediately
5. Optimistic UI update (reverts on error)

**Manual Update:**

1. Click task card to open detail
2. Change workflow stage dropdown
3. Save task
4. Task moves to new column

### Board Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Arrow Keys` | Navigate between task cards |
| `Enter` | Open selected task |
| `Space` | Quick-view task details |
| `n` | Create new task |
| `f` | Focus search box |
| `b` | Toggle board/list view |

### Board Filters

Additional filters available on sprint board:

- **Assignee** - Show only tasks assigned to specific person
- **Priority** - Filter by P0, P1, P2, P3
- **Labels** - Filter by task labels/tags
- **Story Points** - Filter by point range

---

## Tracking Sprint Progress

### Real-Time Metrics

Sprint detail view shows live metrics:

```
┌────────────────────────────────────┐
│ Sprint 12 - Payment Features       │
│ Active • 8 days remaining          │
├────────────────────────────────────┤
│ Progress: ████████░░░░ 67%        │
│                                    │
│ Tasks: 12/18 completed             │
│ Story Points: 60/89 completed      │
│ Velocity: 6.7 pts/day (on track)   │
│                                    │
│ Est. Completion: Feb 03 (on time)  │
└────────────────────────────────────┘
```

### Metrics Explained

**Completion Rate (%):**
- Formula: `(completed_tasks / total_tasks) * 100`
- Target: Should match % of sprint elapsed
- Example: Day 7 of 14-day sprint should be ~50% complete

**Velocity (points/day):**
- Formula: `completed_story_points / days_elapsed`
- Used for: Predicting completion date
- Ideal: Steady velocity throughout sprint

**Estimated Completion:**
- Formula: `today + (remaining_points / current_velocity)`
- Indicators:
  - 🟢 Green: On track to finish on time
  - 🟡 Yellow: At risk (within 1-2 days)
  - 🔴 Red: Behind schedule (>2 days late)

---

## Completing a Sprint

### When to Complete a Sprint

Complete a sprint when:

- ✅ Sprint end date reached
- ✅ All planned tasks completed (ideal)
- ✅ Team agrees sprint goals met

**Note:** It's normal to have incomplete tasks. These should be moved to next sprint or backlog.

### Completion Process

1. **Review Incomplete Tasks**
   - Open sprint detail
   - Check "Backlog" and "In Progress" columns
   - For each incomplete task, choose:
     - Move to next sprint
     - Move back to backlog
     - Mark as "Won't Do" with reason

2. **Click "Complete Sprint"**
   - Button appears in sprint detail header
   - Only visible for active sprints

3. **Review Summary Dialog**

```
┌──────────────────────────────────────┐
│ Complete Sprint?                [X]  │
├──────────────────────────────────────┤
│ Sprint: Sprint 12                    │
│ Duration: Jan 22 - Feb 05            │
│                                      │
│ Summary:                             │
│ • Total Tasks: 18                    │
│ • Completed: 15 (83%)                │
│ • Incomplete: 3                      │
│                                      │
│ • Total Story Points: 89             │
│ • Completed: 78 (88%)                │
│ • Velocity: 5.9 pts/day              │
│                                      │
│ ⚠️ 3 tasks are not complete:         │
│   • Task #127 (In Progress)          │
│   • Task #144 (Backlog)              │
│   • Task #145 (Review)               │
│                                      │
│ These tasks will remain assigned     │
│ to this sprint for reporting.        │
│                                      │
│       [Cancel]  [Complete Sprint]    │
└──────────────────────────────────────┘
```

4. **Confirm Completion**
   - Click "Complete Sprint"
   - Sprint status → `completed`
   - Sprint moves to "Completed" section
   - Sprint report is generated

### Post-Completion

After completing a sprint:

- ✅ Sprint becomes read-only
- ✅ Cannot add/remove tasks
- ✅ Cannot change sprint dates
- ✅ Sprint report available for analysis
- ✅ Velocity added to project metrics
- ✅ Can view burndown chart (historical)

### Handling Incomplete Tasks

**Best Practice:**

1. During sprint review, decide fate of each incomplete task:
   - **Continue:** Add to next sprint if work started
   - **Defer:** Move to backlog if not critical
   - **Cancel:** Mark as "Won't Do" if no longer needed

2. Document reason for incompletion:
   - Underestimated complexity
   - Blocked by dependency
   - Changed priorities
   - Team capacity reduced

3. Update estimates if task continues:
   - Adjust story points based on work done
   - Add comments about what's left

---

## Sprint Metrics & Burndown

### Burndown Chart

The burndown chart shows remaining work (story points) over time.

**Accessing Burndown:**

1. Open sprint detail
2. Click "Burndown" tab
3. Chart displays remaining points by day

**Chart Components:**

```
Story Points
 90┼
   │╲
 80┼ ╲        Ideal Burndown (gray dashed)
   │  ╲
 70┼   ╲
   │    ╲____
 60┼         ╲___  Actual Burndown (blue solid)
   │             ╲__
 50┼                ╲__
   │                   ╲_
 40┼                     ╲__
   │                        ╲_
 30┼                          ╲
   │                           ╲
 20┼                            ╲
   │                             ╲
 10┼                              ╲
   │                               ╲
  0┼────────────────────────────────╲──
   Jan22      Jan29      Feb05

  Legend:
  - - -  Ideal burndown (straight line)
  ──── Actual burndown (cumulative completed)
```

**Interpreting Burndown:**

| Pattern | Meaning | Action |
|---------|---------|--------|
| **Above ideal line** | Behind schedule | Reduce scope or increase capacity |
| **Below ideal line** | Ahead of schedule | Good! Continue current pace |
| **Flat line** | No progress | Identify blockers, reassign work |
| **Steep drop** | Burst of completions | Verify quality, watch for burnout |

### Velocity Chart

Shows completed story points per sprint over time.

**Accessing Velocity:**

1. Go to project → Reports tab
2. Click "Velocity Chart"
3. See bar chart of last 10 sprints

**Example:**

```
Points
 100┼     ██
    │     ██
  90┼     ██ ██
    │     ██ ██
  80┼ ██  ██ ██     ██
    │ ██  ██ ██  ██ ██
  70┼ ██  ██ ██  ██ ██ ██
    │ ██  ██ ██  ██ ██ ██
  60┼ ██  ██ ██  ██ ██ ██  ██
    │ ██  ██ ██  ██ ██ ██  ██
  50┼ ██  ██ ██  ██ ██ ██  ██
    └───────────────────────────
     S8  S9 S10 S11 S12 S13 S14

  Average Velocity: 78 pts/sprint
  Trend: Increasing (+5%)
```

**Using Velocity for Planning:**

- Calculate team's average velocity (last 3-5 sprints)
- Use average to plan next sprint capacity
- Example: Avg = 75 pts → Plan 70-80 pts next sprint
- Leave 10-15% buffer for unknowns

### Sprint Report

Comprehensive report generated on sprint completion.

**Report Sections:**

1. **Overview**
   - Sprint name, dates, duration
   - Goal and outcome
   - Completion rate

2. **Task Summary**
   - Total tasks: planned vs completed
   - Task breakdown by workflow stage
   - Task breakdown by assignee

3. **Story Points**
   - Total points committed
   - Points completed
   - Points carried over

4. **Velocity Metrics**
   - Actual velocity
   - Comparison to team average
   - Trend analysis

5. **Timeline**
   - Key events during sprint
   - Blockers and resolutions
   - Scope changes

**Exporting Report:**

- Click "Export Report" button
- Formats available: PDF, CSV, JSON
- Use for retrospectives and stakeholder updates

---

## Best Practices

### Sprint Planning

**Do:**

- ✅ Involve entire team in planning
- ✅ Define clear, measurable sprint goal
- ✅ Estimate all tasks (story points or hours)
- ✅ Leave 20% capacity buffer for unknowns
- ✅ Review dependencies before committing
- ✅ Ensure tasks are small enough (< 3 days work)

**Don't:**

- ❌ Overcommit capacity (avoid 100%+ utilization)
- ❌ Change sprint goal mid-sprint
- ❌ Add large tasks without removing others
- ❌ Plan sprints longer than 4 weeks
- ❌ Skip sprint goal definition

### During Sprint

**Daily Practices:**

- Update task status daily
- Move completed tasks to "Done" immediately
- Flag blockers using labels or comments
- Communicate scope changes to team
- Check burndown chart regularly

**When to Add/Remove Tasks:**

- **Add:** Only if critical and swap out equal points
- **Remove:** If blocker is permanent or task no longer needed
- **Document:** All scope changes with reason

### Sprint Retrospective

After each sprint, conduct a retrospective:

1. **What went well?**
   - Celebrate wins
   - Identify practices to continue

2. **What didn't go well?**
   - Discuss challenges
   - No blame, focus on process

3. **Action items**
   - Concrete improvements for next sprint
   - Assign owners and deadlines

**Using Archon for Retros:**

- Create "Retrospective" tasks
- Tag with `#retro-action`
- Track completion in next sprint

---

## Troubleshooting

### Common Issues

#### "Cannot start sprint - another sprint is active"

**Problem:** Only one sprint can be active per project.

**Solution:**
1. Complete or cancel current active sprint
2. Or: Enable concurrent sprints in project settings (Admin only)

#### "Tasks not showing on sprint board"

**Problem:** Board filter might be misconfigured.

**Solution:**
1. Check sprint filter dropdown (top of board)
2. Verify tasks are assigned to correct sprint
3. Clear any additional filters (assignee, labels)
4. Refresh page (F5)

#### "Burndown chart not updating"

**Problem:** Chart updates every 4 hours or on page reload.

**Solution:**
1. Refresh page to force update
2. Check that tasks have story points assigned
3. Verify tasks are being marked as "Done"

#### "Sprint velocity seems wrong"

**Problem:** Velocity calculation requires story points.

**Solution:**
1. Ensure all completed tasks have story points
2. Velocity = completed points ÷ days elapsed
3. Check sprint start/end dates are correct
4. Recalculate by refreshing sprint detail

#### "Cannot complete sprint with unfinished tasks"

**This is not an error.** You can complete sprints with unfinished tasks.

**Action:**
1. Review unfinished tasks before completing
2. Move them to next sprint or backlog
3. Complete sprint as normal
4. Tasks remain in sprint for reporting

### Getting Help

- **Documentation:** `/docs/user-guides/`
- **Support:** help@archon.dev
- **Community:** https://community.archon.dev
- **Report Bug:** GitHub Issues

---

## Quick Reference Card

### Sprint States & Transitions

```
CREATE → [planned] → START → [active] → COMPLETE → [completed]
                                   ↓
                              CANCEL → [cancelled]
```

### Key Shortcuts

| Action | Shortcut |
|--------|----------|
| New Sprint | `Alt + S` |
| Start Sprint | `Alt + Shift + S` |
| Complete Sprint | `Alt + Shift + C` |
| View Burndown | `Alt + B` |
| View Board | `Alt + K` |

### Recommended Workflow

1. **Monday:** Create and start sprint
2. **Daily:** Update task statuses, check burndown
3. **Mid-Sprint:** Review progress, adjust if needed
4. **Last Day:** Complete remaining tasks
5. **Friday:** Complete sprint, run retrospective
6. **Next Monday:** Repeat!

---

**Questions or feedback?** Email docs@archon.dev

**Version History:**
- v1.0 (2026-01-22): Initial release
