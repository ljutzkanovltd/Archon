# Workflow Configuration User Guide

**Version:** 1.0
**Last Updated:** 2026-01-22
**Applies to:** Archon PM v2.0+

## Table of Contents

1. [Overview](#overview)
2. [Understanding Workflows](#understanding-workflows)
3. [Project Types & Default Workflows](#project-types--default-workflows)
4. [Creating a Project with Workflow](#creating-a-project-with-workflow)
5. [Workflow Stages](#workflow-stages)
6. [Customizing Workflows (Admin)](#customizing-workflows-admin)
7. [Changing Project Workflow](#changing-project-workflow)
8. [Task Assignment to Agents](#task-assignment-to-agents)
9. [Workflow Analytics](#workflow-analytics)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Overview

Workflows define how tasks move through different stages from start to completion. Archon provides pre-configured workflows tailored to different project types, ensuring teams follow best practices for their specific work.

### What is a Workflow?

A workflow is a sequence of **stages** that represent the lifecycle of a task:

```
Backlog → In Progress → Review → Done
```

Each stage represents a distinct state, and tasks transition between stages as work progresses.

### Why Use Workflows?

- **Consistency** - Standardized process across all projects of same type
- **Visibility** - Clear understanding of where each task stands
- **Bottleneck Detection** - Identify stages where work gets stuck
- **Process Improvement** - Analyze transition patterns to optimize flow
- **Team Alignment** - Everyone follows the same process

---

## Understanding Workflows

### Workflow Components

1. **Project Type** - Category of project (e.g., Software Development, Marketing)
2. **Workflow** - Set of stages for that project type
3. **Stages** - Individual steps in the workflow
4. **Stage Order** - Sequence of stages (0, 1, 2, 3...)
5. **Transition Rules** - Allowed movements between stages

### Workflow vs. Sprint

| Aspect | Workflow | Sprint |
|--------|----------|--------|
| **Purpose** | Defines task lifecycle | Defines time-boxed iteration |
| **Scope** | All tasks in project | Subset of tasks |
| **Duration** | Permanent | Temporary (1-4 weeks) |
| **Changes** | Rarely (project type change) | Frequently (new sprint each iteration) |

### Stage Properties

Each stage has:

- **Name** - Display name (e.g., "In Progress", "QA Testing")
- **Order** - Position in workflow (0-indexed)
- **Color** - Visual indicator on board
- **Type** - Functional category (todo, in_progress, review, done)
- **Description** - Purpose and entry/exit criteria

---

## Project Types & Default Workflows

Archon provides 4 pre-configured project types, each with an optimized workflow.

### 1. Software Development

**Use Case:** Feature development, bug fixes, technical projects

**Workflow:** Agile Software Development

| Stage | Order | Description | Typical Duration |
|-------|-------|-------------|------------------|
| **Backlog** | 0 | Prioritized work queue | - |
| **In Progress** | 1 | Actively being developed | 1-3 days |
| **Code Review** | 2 | Peer review of changes | 4-8 hours |
| **QA Testing** | 3 | Quality assurance validation | 4-8 hours |
| **Done** | 4 | Deployed to production | - |

**Best For:**
- Web/mobile app development
- API development
- Infrastructure projects
- DevOps automation

**Example Tasks:**
- "Implement user registration endpoint"
- "Fix password reset bug"
- "Add caching layer to API"

---

### 2. Marketing Campaign

**Use Case:** Marketing initiatives, content creation, campaigns

**Workflow:** Marketing Process

| Stage | Order | Description | Typical Duration |
|-------|-------|-------------|------------------|
| **Idea** | 0 | Campaign concepts/brainstorming | - |
| **Planning** | 1 | Strategy and resource allocation | 1-2 days |
| **Creative** | 2 | Content creation (copy, design) | 2-5 days |
| **Review** | 3 | Stakeholder approval | 1-2 days |
| **Launched** | 4 | Campaign is live | - |
| **Analysis** | 5 | Post-campaign metrics review | 1-2 days |

**Best For:**
- Social media campaigns
- Email marketing
- Content marketing
- Product launches

**Example Tasks:**
- "Create Q1 email campaign"
- "Design Instagram ad creative"
- "Write product launch blog post"

---

### 3. Research Project

**Use Case:** Experiments, investigations, exploratory work

**Workflow:** Research Process

| Stage | Order | Description | Typical Duration |
|-------|-------|-------------|------------------|
| **Hypothesis** | 0 | Research question/goal | - |
| **Planning** | 1 | Design experiment/study | 1-3 days |
| **Data Collection** | 2 | Gather data/run experiments | 3-14 days |
| **Analysis** | 3 | Analyze results | 2-7 days |
| **Review** | 4 | Peer review findings | 2-5 days |
| **Published** | 5 | Results documented/shared | - |

**Best For:**
- User research
- A/B testing
- Data analysis projects
- Academic research

**Example Tasks:**
- "Conduct user interview study on checkout flow"
- "Analyze correlation between features and retention"
- "Test 3 headline variations"

---

### 4. Bug Tracking

**Use Case:** Bug fixes, incidents, defect resolution

**Workflow:** Bug Lifecycle

| Stage | Order | Description | Typical Duration |
|-------|-------|-------------|------------------|
| **Reported** | 0 | Bug submitted | - |
| **Triaged** | 1 | Severity/priority assigned | <1 hour |
| **In Progress** | 2 | Being fixed | 2-8 hours |
| **Fixed** | 3 | Code deployed | - |
| **Verified** | 4 | QA confirmed resolution | 1-2 hours |
| **Closed** | 5 | Issue resolved | - |

**Best For:**
- Production bugs
- Customer-reported issues
- Quality assurance
- Maintenance work

**Example Tasks:**
- "P0: Payment processing failing"
- "UI bug: Button not clickable on mobile"
- "Investigate slow query on dashboard"

---

## Creating a Project with Workflow

### Step 1: Start Project Creation

1. Click **"New Project"** button
2. Fill in project details:
   - **Title** - Project name
   - **Description** - Project goals and scope

### Step 2: Select Project Type

The **Project Type** selector appears as radio buttons or cards:

```
┌─────────────────────────────────────────────┐
│ Select Project Type                         │
├─────────────────────────────────────────────┤
│                                             │
│ ○ Software Development                      │
│   Agile workflow: Backlog → In Progress →  │
│   Code Review → QA → Done                   │
│                                             │
│ ● Marketing Campaign                        │
│   Campaign workflow: Idea → Planning →     │
│   Creative → Review → Launched → Analysis  │
│                                             │
│ ○ Research Project                          │
│   Research workflow: Hypothesis → Planning │
│   → Data Collection → Analysis → Published │
│                                             │
│ ○ Bug Tracking                              │
│   Bug lifecycle: Reported → Triaged →      │
│   In Progress → Fixed → Verified → Closed  │
│                                             │
└─────────────────────────────────────────────┘
```

**Each option shows:**
- Project type name
- Default workflow name
- Preview of workflow stages

### Step 3: Review Workflow Preview

When you select a project type, a workflow preview appears:

```
┌────────────────────────────────────────────┐
│ Workflow Preview: Marketing Process        │
├────────────────────────────────────────────┤
│                                            │
│  [1] Idea → [2] Planning → [3] Creative → │
│  [4] Review → [5] Launched → [6] Analysis  │
│                                            │
│  This workflow includes:                   │
│  • 6 stages                                │
│  • Creative-focused process                │
│  • Stakeholder approval step               │
│  • Post-launch analysis                    │
│                                            │
└────────────────────────────────────────────┘
```

### Step 4: Create Project

1. Click **"Create Project"**
2. Project is created with selected workflow
3. All tasks in project will use this workflow

**Note:** You can change the workflow later (see "Changing Project Workflow" section).

---

## Workflow Stages

### Understanding Stage Order

Stages are numbered starting from 0:

```
Stage 0: Backlog  (start)
Stage 1: In Progress
Stage 2: Review
Stage 3: Done  (end)
```

**Why this matters:**

- Stages appear on board from left to right (or top to bottom)
- Tasks typically flow from lower to higher numbers
- Burndown charts track movement toward final stage

### Stage Types

Stages are categorized by function:

| Type | Purpose | Examples |
|------|---------|----------|
| **Initial** | Starting point for new tasks | Backlog, Idea, Reported |
| **In Progress** | Active work | In Progress, Development, Creative |
| **Review** | Quality checks | Code Review, QA, Approval |
| **Blocked** | Work stopped | Blocked, On Hold |
| **Final** | Completed work | Done, Deployed, Closed |

### Task Transitions

Tasks can move between stages:

**Forward Movement** (most common):
```
Backlog → In Progress → Review → Done
```

**Backward Movement** (revisions):
```
Review → In Progress  (needs changes)
QA → Code Review      (found issues)
```

**Skip Stages** (flexible workflows):
```
Backlog → Done  (quick fix, no review needed)
```

**Blocked/Unblocked:**
```
In Progress → Blocked → In Progress
```

---

## Customizing Workflows (Admin)

**Note:** Workflow customization requires **Admin** role.

### When to Customize

Consider customizing workflows when:

- ✅ Default workflow doesn't match your process
- ✅ You need additional stages (e.g., "Legal Review")
- ✅ You want to rename stages for your terminology
- ✅ You need to enforce specific transition rules

**Warning:** Changing workflows affects all existing tasks. Plan carefully.

### How to Customize (Admin Only)

1. Navigate to **Admin → Workflow Management**
2. Select workflow to customize
3. Click **"Edit Workflow"**

### Adding a Stage

1. Click **"Add Stage"** button
2. Fill in stage details:
   - Name (e.g., "Legal Review")
   - Description
   - Stage order (position in workflow)
   - Color (hex code or picker)
3. Click **"Save Stage"**
4. Reorder other stages if needed

### Removing a Stage

**⚠️ WARNING:** Removing stages moves tasks to adjacent stage.

1. Click **"Edit"** on stage
2. Click **"Delete Stage"** button
3. Confirm deletion
4. Choose migration strategy:
   - **Option A:** Move tasks to previous stage
   - **Option B:** Move tasks to next stage
   - **Option C:** Move all tasks to default stage

### Renaming Stages

Safe operation (no data migration needed):

1. Click **"Edit"** on stage
2. Change **Name** field
3. Click **"Save"**
4. All task cards update immediately

### Reordering Stages

Drag-and-drop interface:

1. In workflow edit view, grab stage card
2. Drag to new position
3. Drop in desired order
4. Click **"Save Changes"**
5. Board updates to match new order

---

## Changing Project Workflow

You can change a project's workflow after creation.

**Use Cases:**
- Project scope changed (marketing → software)
- Workflow wasn't optimal for team
- Merging projects with different workflows

### Change Workflow Steps

1. Open project
2. Navigate to **Settings** tab
3. Find **"Workflow"** section
4. Click **"Change Workflow"** button
5. Modal appears:

```
┌──────────────────────────────────────────┐
│ Change Project Workflow?            [X]  │
├──────────────────────────────────────────┤
│ Current: Software Development            │
│ Tasks: 47 tasks across 4 stages          │
│                                          │
│ Select New Workflow:                     │
│ ○ Software Development (current)         │
│ ● Marketing Campaign                     │
│ ○ Research Project                       │
│ ○ Bug Tracking                           │
│                                          │
│ ⚠️ Impact:                               │
│ • All 47 tasks will be remapped          │
│ • Stages matched by order/type           │
│ • Some tasks may move stages             │
│ • Board layout will change               │
│                                          │
│      [Cancel]  [Preview Changes]         │
└──────────────────────────────────────────┘
```

6. Click **"Preview Changes"**
7. Review task migration plan:

```
┌──────────────────────────────────────────┐
│ Task Migration Preview                   │
├──────────────────────────────────────────┤
│ From: Backlog (12 tasks)                 │
│ To: Idea (12 tasks)                      │
│                                          │
│ From: In Progress (8 tasks)              │
│ To: Planning (8 tasks)                   │
│                                          │
│ From: Code Review (5 tasks)              │
│ To: Creative (5 tasks)                   │
│                                          │
│ From: QA Testing (3 tasks)               │
│ To: Review (3 tasks)                     │
│                                          │
│ From: Done (19 tasks)                    │
│ To: Launched (19 tasks)                  │
│                                          │
│        [Cancel]  [Apply Workflow Change] │
└──────────────────────────────────────────┘
```

8. Click **"Apply Workflow Change"**
9. Workflow updates, tasks remapped
10. Notification confirms completion

### Migration Logic

Tasks are remapped using **stage order matching**:

```
Old Workflow          New Workflow
─────────────         ────────────
Backlog (0)     →     Idea (0)
In Progress (1) →     Planning (1)
Review (2)      →     Creative (2)
Done (3)        →     Launched (4)
```

**If stage counts differ:**
- Extra stages collapse into nearest match
- Missing stages use default (usually first or last)

---

## Task Assignment to Agents

Workflows can be configured with **recommended agents** for each stage.

### What are Agents?

Agents are specialized roles or team members responsible for work at each stage:

| Stage | Recommended Agent | Rationale |
|-------|------------------|-----------|
| **Backlog** | Product Manager | Prioritization decisions |
| **In Progress** | Developer | Implementation work |
| **Code Review** | Senior Developer | Code quality review |
| **QA Testing** | QA Engineer | Testing and validation |
| **Done** | (none) | Completed work |

### Auto-Assignment Rules

When a task moves to a stage, it can be auto-assigned based on:

1. **Stage default agent** - Configured per workflow
2. **Round-robin** - Distribute evenly across team
3. **Workload balancing** - Assign to least busy person
4. **Skills matching** - Based on task labels/tags

### Configuring Auto-Assignment (Admin)

1. Go to **Admin → Workflow Management**
2. Select workflow
3. Click **"Edit Stages"**
4. For each stage, set:
   - **Default Assignee** - Team member or role
   - **Auto-assign?** - Enable/disable
   - **Assignment Rule** - Round-robin, workload, skills
5. Save changes

**Example Configuration:**

```
Stage: Code Review
├─ Default Assignee: code-review-team
├─ Auto-assign: ✓ Enabled
├─ Rule: Round-robin
└─ Members: [@alice, @bob, @charlie]
```

When task moves to Code Review:
1. System checks who reviewed least recently
2. Assigns task to that person
3. Notifies assignee

---

## Workflow Analytics

Track workflow efficiency and identify bottlenecks.

### Accessing Analytics

1. Navigate to **Admin → Workflow Analytics**
2. Or: Project → Reports → Workflow Tab

### Key Metrics

**Cycle Time by Stage:**

```
Stage             Avg Time    % of Total
─────────────     ────────    ──────────
Backlog           2.3 days    15%
In Progress       4.7 days    31%
Code Review       1.2 days    8%
QA Testing        0.9 days    6%
Done              -           -

Total: 9.1 days
```

**Bottleneck Detection:**

```
⚠️ BOTTLENECK DETECTED: In Progress

• 23% of tasks spend >5 days here
• 32% above average time
• Recommendation: Add more dev capacity
```

**Transition Analysis:**

```
Most Common Flows:
1. Backlog → In Progress → Done         (65%)
2. Backlog → In Progress → Review → Done (28%)
3. Review → In Progress (rework)         (15%)

Unusual Flows:
⚠️ In Progress → Backlog (5 tasks)
   - Tasks being deprioritized mid-work
```

---

## Best Practices

### Choosing the Right Workflow

**Ask:**

1. **What type of work are we doing?**
   - Building software → Software Development
   - Marketing activities → Marketing Campaign
   - Investigating/analyzing → Research
   - Fixing issues → Bug Tracking

2. **How many review/approval steps?**
   - One review → Simple workflow
   - Multiple stakeholders → Add approval stages

3. **What's our team structure?**
   - Cross-functional → Flexible workflow
   - Specialized roles → Stage-specific workflows

### Workflow Hygiene

**Do:**

- ✅ Keep tasks moving (no stagnation)
- ✅ Update task status daily
- ✅ Use correct stage for each state
- ✅ Document why tasks move backward
- ✅ Review workflow metrics monthly

**Don't:**

- ❌ Skip stages without reason
- ❌ Let tasks sit in one stage for weeks
- ❌ Change workflows frequently (max 1x/quarter)
- ❌ Create too many stages (6-8 max recommended)

### Stage Naming Conventions

Use clear, action-oriented names:

✅ **Good:**
- "In Development"
- "Awaiting Review"
- "QA Testing"

❌ **Avoid:**
- "Stage 2"
- "Stuff"
- "Things to do"

### Workflow Optimization

**Red Flags:**

- More than 30% of tasks in one stage (bottleneck)
- Average cycle time increasing over sprints
- Frequent backward movements
- Stages with <5% of tasks (unused stage)

**Optimization Steps:**

1. **Identify bottleneck stage**
   - Check workflow analytics
   - Look for high task concentration

2. **Analyze root cause**
   - Insufficient resources?
   - Unclear entry/exit criteria?
   - External dependencies?

3. **Apply fix**
   - Add capacity (more people)
   - Split stage into smaller steps
   - Remove unnecessary stage
   - Improve handoff process

4. **Measure improvement**
   - Track cycle time weekly
   - Compare before/after metrics

---

## Troubleshooting

### "Cannot move task to that stage"

**Problem:** Workflow has transition restrictions.

**Solution:**
- Check allowed transitions for current stage
- Move task to intermediate stage first
- Contact admin to update transition rules

### "Workflow change failed"

**Problem:** Tasks couldn't be migrated.

**Solution:**
1. Ensure no tasks are being edited during change
2. Check all tasks have valid workflow stages
3. Try again in off-peak hours
4. Contact support if persists

### "Tasks disappeared after workflow change"

**Problem:** Tasks were migrated to unexpected stage.

**Solution:**
1. Check all stages in new workflow
2. Look in final stage (many tasks may be there)
3. Use search: `workflow_stage:*`
4. Contact admin for stage remapping

### "Board looks wrong after workflow change"

**Problem:** Browser cache showing old board layout.

**Solution:**
1. Hard refresh page: Ctrl+Shift+R (Cmd+Shift+R on Mac)
2. Clear browser cache
3. Try incognito/private window

---

## Advanced Topics

### Custom Workflow Creation (Enterprise)

Enterprise plans can create entirely custom workflows:

1. Navigate to **Admin → Workflows**
2. Click **"Create Custom Workflow"**
3. Name workflow
4. Add stages one by one
5. Define transition rules
6. Assign to project type or specific projects

### Workflow Templates

Save your customizations as templates:

1. Edit workflow to desired configuration
2. Click **"Save as Template"**
3. Name template
4. Share with team or keep private
5. Reuse for future projects

### API Access

Workflows are accessible via API for automation:

```bash
# Get project workflow
GET /api/projects/{id}/workflow

# Get workflow stages
GET /api/workflows/{id}/stages

# Change project workflow
PUT /api/projects/{id}/workflow
{
  "workflow_id": "new-workflow-id"
}
```

---

## Quick Reference

### Workflow Comparison

| Feature | Software Dev | Marketing | Research | Bug Tracking |
|---------|--------------|-----------|----------|--------------|
| Stages | 5 | 6 | 6 | 6 |
| Review Steps | 2 | 1 | 1 | 1 |
| Best For | Engineering | Creative | Analysis | Support |
| Avg Cycle Time | 5-10 days | 10-15 days | 14-21 days | 1-3 days |

### Common Workflows by Industry

- **SaaS/Tech:** Software Development
- **Agencies:** Marketing Campaign
- **Startups:** Software Development or Custom
- **Support Teams:** Bug Tracking
- **Data Science:** Research Project

---

**Questions or feedback?** Email docs@archon.dev

**Version History:**
- v1.0 (2026-01-22): Initial release
