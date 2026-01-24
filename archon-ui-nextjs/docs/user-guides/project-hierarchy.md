# Project Hierarchy User Guide

**Version:** 1.0
**Last Updated:** 2026-01-22
**Applies to:** Archon PM v2.0+

## Table of Contents

1. [Overview](#overview)
2. [Understanding Project Hierarchy](#understanding-project-hierarchy)
3. [Creating Subprojects](#creating-subprojects)
4. [Navigation & Breadcrumbs](#navigation--breadcrumbs)
5. [ltree Path System](#ltree-path-system)
6. [Managing Hierarchies](#managing-hierarchies)
7. [Task Inheritance](#task-inheritance)
8. [Hierarchy Visualization](#hierarchy-visualization)
9. [Use Cases & Examples](#use-cases--examples)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Overview

Project Hierarchy allows you to organize projects in a parent-child structure, creating multi-level project trees. This helps manage complex initiatives with multiple components, phases, or teams.

### What is Project Hierarchy?

A hierarchical structure where projects can contain subprojects:

```
Enterprise Platform (Root)
├── Frontend Development
│   ├── Web Application
│   └── Mobile App
├── Backend Services
│   ├── API Gateway
│   ├── Auth Service
│   └── Data Pipeline
└── DevOps & Infrastructure
    ├── CI/CD Setup
    └── Monitoring & Alerts
```

### Key Benefits

- **Organization** - Group related projects logically
- **Visibility** - See entire project structure at a glance
- **Delegation** - Assign subprojects to different teams
- **Aggregation** - Roll up metrics from all subprojects
- **Context** - Understand how work fits in bigger picture

---

## Understanding Project Hierarchy

### Hierarchy Terminology

| Term | Definition | Example |
|------|------------|---------|
| **Root Project** | Top-level project (no parent) | "Q1 Product Launch" |
| **Parent Project** | Project that contains subprojects | "Frontend Development" |
| **Subproject** | Child of another project | "Web Application" |
| **Sibling Projects** | Projects with same parent | "Web App" & "Mobile App" |
| **Leaf Project** | Project with no children | "Authentication Module" |
| **Depth** | Level in hierarchy (0 = root) | "Auth Service" = depth 2 |

### Hierarchy Constraints

- **Maximum Depth:** 10 levels (configurable)
- **Maximum Children:** Unlimited per parent
- **Circular Prevention:** Cannot create loops
- **Deletion:** Cannot delete parent with children (must delete children first or reassign)

### ltree Path Structure

Archon uses PostgreSQL's `ltree` extension for hierarchical data:

```
Root Project:     [project-id]
Level 1:          [root-id].[child-id]
Level 2:          [root-id].[child-id].[grandchild-id]
```

Example:
```
enterprise_platform
├── enterprise_platform.frontend
│   └── enterprise_platform.frontend.web_app
└── enterprise_platform.backend
```

---

## Creating Subprojects

### Method 1: From Parent Project

1. Open the parent project
2. Navigate to **Overview** or **Subprojects** tab
3. Click **"Add Subproject"** button
4. Fill in subproject details:
   - **Title** - Subproject name
   - **Description** - Goals and scope
   - **Project Type** - Workflow to use
   - **Parent** - Auto-filled (current project)
5. Click **"Create Subproject"**

**Screenshot Reference:**
```
┌────────────────────────────────────────┐
│ Create Subproject                  [X] │
├────────────────────────────────────────┤
│ Parent Project: Enterprise Platform    │
│ Path: enterprise_platform              │
│                                        │
│ Subproject Title*                      │
│ [Frontend Development             ]    │
│                                        │
│ Description                            │
│ [All frontend components including]    │
│ [web and mobile applications      ]    │
│                                        │
│ Project Type*                          │
│ ● Software Development                 │
│ ○ Marketing Campaign                   │
│ ○ Research Project                     │
│ ○ Bug Tracking                         │
│                                        │
│      [Cancel]  [Create Subproject]     │
└────────────────────────────────────────┘
```

### Method 2: During Project Creation

1. Click **"New Project"** (global)
2. Fill project details
3. Check **"This is a subproject"** checkbox
4. Select **Parent Project** from dropdown:

```
┌────────────────────────────────────────┐
│ ☑ This is a subproject                 │
│                                        │
│ Parent Project*                        │
│ [▼ Select parent...          ]         │
│   ┌──────────────────────────────┐     │
│   │ Enterprise Platform          │     │
│   │ ├─ Frontend Development      │     │
│   │ ├─ Backend Services          │     │
│   │ └─ DevOps Infrastructure     │     │
│   │                              │     │
│   │ Q2 Marketing Launch          │     │
│   │ ├─ Content Creation          │     │
│   │                              │     │
│   └──────────────────────────────┘     │
└────────────────────────────────────────┘
```

5. Create project as normal

### Automatic Inheritance

When creating a subproject, it inherits:

- ✅ **Workflow** - Same workflow as parent (changeable)
- ✅ **Team Members** - Parent's team (can add more)
- ✅ **Settings** - Some configuration options
- ❌ **Tasks** - NOT inherited (each project has own tasks)
- ❌ **Sprints** - NOT inherited

---

## Navigation & Breadcrumbs

### Breadcrumb Trail

Every subproject shows its location in hierarchy:

```
Home > Enterprise Platform > Frontend Development > Web Application
  ↑          ↑                      ↑                      ↑
Root    Parent Level 1         Parent Level 2       Current Project
```

**Clicking breadcrumbs:**
- Each level is clickable link
- Navigate to any ancestor project
- Breadcrumbs update as you navigate

### Project Navigation Menu

Subprojects appear in left sidebar:

```
Projects
├─ 📁 Enterprise Platform
│  ├─ 🖥️ Frontend Development ◄── You are here
│  │  ├─ 🌐 Web Application
│  │  └─ 📱 Mobile App
│  ├─ ⚙️ Backend Services
│  │  ├─ 🔌 API Gateway
│  │  ├─ 🔐 Auth Service
│  │  └─ 📊 Data Pipeline
│  └─ 🛠️ DevOps Infrastructure
│     ├─ 🚀 CI/CD Setup
│     └─ 📈 Monitoring
```

**Navigation Actions:**
- Click project → Open project detail
- Click arrow (▼) → Expand/collapse children
- Hover → Show quick info tooltip

### Quick Navigation Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + ↑` | Go to parent project |
| `Alt + ←` | Previous sibling |
| `Alt + →` | Next sibling |
| `Alt + ↓` | First child project |
| `Ctrl + /` | Search projects |

---

## ltree Path System

### What is ltree?

ltree is a PostgreSQL data type for hierarchical data:

- **Path format:** Labels separated by dots
- **Example:** `enterprise.frontend.web_app`
- **Queries:** Efficient ancestor/descendant searches

### Viewing ltree Paths

1. Open project → Settings tab
2. Find **"Hierarchy Information"** section:

```
┌──────────────────────────────────────┐
│ Hierarchy Information                │
├──────────────────────────────────────┤
│ Project ID: abc123                   │
│ ltree Path: enterprise.frontend.web  │
│                                      │
│ Depth: 2 (3rd level)                 │
│ Parent: Frontend Development         │
│ Children: 0                          │
│ Siblings: 1 (Mobile App)             │
│                                      │
│ Ancestors:                           │
│ • Enterprise Platform (root)         │
│ • Frontend Development               │
└──────────────────────────────────────┘
```

### ltree Query Examples

**For developers/admins:**

```sql
-- Get all descendants of project
SELECT * FROM projects
WHERE ltree_path <@ 'enterprise.frontend';

-- Get all ancestors of project
SELECT * FROM projects
WHERE ltree_path @> 'enterprise.frontend.web';

-- Get siblings (same parent)
SELECT * FROM projects
WHERE ltree_path ~ 'enterprise.frontend.*{1}';

-- Get depth
SELECT nlevel(ltree_path) AS depth
FROM projects
WHERE id = 'project-id';
```

---

## Managing Hierarchies

### Moving Projects

You can change a project's parent (reparenting):

1. Open project → Settings
2. Find **"Parent Project"** section
3. Click **"Change Parent"**
4. Select new parent from dropdown:

```
┌────────────────────────────────────────┐
│ Change Parent Project?            [X]  │
├────────────────────────────────────────┤
│ Current Parent: Frontend Development   │
│ Current Path: enterprise.frontend.web  │
│                                        │
│ New Parent:                            │
│ [▼ Select new parent...       ]        │
│   Backend Services                     │
│   DevOps Infrastructure                │
│   ─────────────────────                │
│   (none) - Make root project           │
│                                        │
│ New Path Preview:                      │
│ enterprise.backend.web                 │
│                                        │
│ ⚠️ Impact:                             │
│ • Path will update                     │
│ • All descendants will update          │
│ • Breadcrumbs will change              │
│ • No tasks affected                    │
│                                        │
│      [Cancel]  [Change Parent]         │
└────────────────────────────────────────┘
```

5. Confirm change
6. ltree paths update automatically

### Preventing Circular References

System prevents circular hierarchies:

❌ **Invalid Operations:**

```
# Cannot make parent a child of its own descendant
Enterprise Platform (root)
└── Frontend
    └── Web App

# This would create a loop:
Web App → parent = Enterprise Platform
```

**Error message:**
```
⛔ Cannot create circular reference

The selected parent is a descendant of this project.
This would create an infinite loop in the hierarchy.

Current: enterprise.frontend.web
Attempted Parent: enterprise (ancestor)

Please select a different parent.
```

### Deleting Projects with Children

**Option 1: Delete Children First**

1. Navigate to parent project
2. Delete all child projects first
3. Then delete parent

**Option 2: Cascade Delete (Admin Only)**

1. Attempt to delete parent
2. Warning appears:

```
┌────────────────────────────────────────┐
│ ⚠️ Delete Project with Subprojects? [X]│
├────────────────────────────────────────┤
│ Project: Frontend Development          │
│ Subprojects: 2 (Web App, Mobile App)   │
│ Total Descendants: 5                   │
│                                        │
│ Deleting this project will:            │
│ • Delete ALL 5 descendant projects     │
│ • Delete 127 tasks across all projects │
│ • Delete 18 sprints                    │
│                                        │
│ This action CANNOT be undone.          │
│                                        │
│ Type project name to confirm:          │
│ [                              ]       │
│                                        │
│      [Cancel]  [Delete Everything]     │
└────────────────────────────────────────┘
```

3. Type project name to confirm
4. All descendants deleted recursively

---

## Task Inheritance

Tasks are NOT inherited, but can be filtered by hierarchy.

### Viewing All Tasks in Hierarchy

**See tasks from all subprojects:**

1. Open root/parent project
2. Go to Tasks tab
3. Enable **"Include subproject tasks"** toggle:

```
Tasks                    [☑ Include subprojects]

Showing 347 tasks from 6 projects
─────────────────────────────────────────
[Web App] Task #123 - Fix login bug
[Mobile App] Task #124 - Add dark mode
[API Gateway] Task #125 - Rate limiting
```

**Filtering:**
- Filter by subproject using dropdown
- Tasks show project badge
- Clicking task opens in original project

### Task Summary Rollup

Parent project shows summary of all child tasks:

```
┌──────────────────────────────────────┐
│ Frontend Development                 │
│ 2 subprojects • 89 total tasks       │
├──────────────────────────────────────┤
│ Tasks Breakdown:                     │
│                                      │
│ Web Application:        56 tasks     │
│ ├─ Done:               34 (61%)     │
│ ├─ In Progress:        12 (21%)     │
│ └─ Backlog:            10 (18%)     │
│                                      │
│ Mobile App:            33 tasks      │
│ ├─ Done:               18 (55%)     │
│ ├─ In Progress:         8 (24%)     │
│ └─ Backlog:             7 (21%)     │
│                                      │
│ Overall Completion: 58%  ████████░░  │
└──────────────────────────────────────┘
```

---

## Hierarchy Visualization

### Tree View

Visual representation of project structure:

```
📁 Enterprise Platform
│
├─ 🖥️ Frontend Development (23 tasks, 67% done)
│  │
│  ├─ 🌐 Web Application (12 tasks, 75% done)
│  │  └─ 🧩 Component Library (5 tasks, 100% done)
│  │
│  └─ 📱 Mobile App (11 tasks, 58% done)
│     ├─ 🍎 iOS App (6 tasks, 67% done)
│     └─ 🤖 Android App (5 tasks, 50% done)
│
├─ ⚙️ Backend Services (45 tasks, 51% done)
│  │
│  ├─ 🔌 API Gateway (15 tasks, 60% done)
│  ├─ 🔐 Auth Service (20 tasks, 45% done)
│  └─ 📊 Data Pipeline (10 tasks, 50% done)
│
└─ 🛠️ DevOps Infrastructure (18 tasks, 83% done)
   ├─ 🚀 CI/CD Setup (10 tasks, 90% done)
   └─ 📈 Monitoring (8 tasks, 75% done)
```

### Indented List View

Compact view showing hierarchy with indentation:

```
Projects (8 total)

┌─────────────────────────────────────────┐
│ □ Enterprise Platform            (root) │
│   □ Frontend Development         ├─     │
│     □ Web Application            │ ├─   │
│       ☑ Component Library        │ │ └─ │
│     □ Mobile App                 │ ├─   │
│       □ iOS App                  │ │ ├─ │
│       □ Android App              │ │ └─ │
│   □ Backend Services             ├─     │
│     □ API Gateway                │ ├─   │
│     ☑ Auth Service               │ ├─   │
│     □ Data Pipeline              │ └─   │
│   ☑ DevOps Infrastructure        └─     │
│     ☑ CI/CD Setup                  ├─   │
│     ☑ Monitoring                   └─   │
└─────────────────────────────────────────┘

Legend:
□ Active project
☑ Completed/archived
```

### Gantt View with Hierarchy

Timeline view respecting hierarchy:

```
Project                 Jan    Feb    Mar    Apr
──────────────────────────────────────────────────
Enterprise Platform     ═══════════════════════════
 ├─ Frontend            ═══════════════
 │  ├─ Web App          ════════
 │  └─ Mobile App           ═══════
 ├─ Backend                  ══════════════
 │  ├─ API Gateway           ══════
 │  └─ Auth Service              ═══════
 └─ DevOps                              ════════
    ├─ CI/CD                            ═════
    └─ Monitoring                          ════

═══ Timeline bar
```

---

## Use Cases & Examples

### Use Case 1: Product with Multiple Components

**Scenario:** Building a SaaS platform with web, mobile, and API.

**Hierarchy:**

```
SaaS Platform (Root)
├── Web Dashboard
├── Mobile App
│   ├── iOS
│   └── Android
├── API Services
│   ├── Core API
│   ├── Analytics API
│   └── Notifications API
└── Infrastructure
    └── Database Setup
```

**Benefits:**
- Each team owns a subproject
- Parent shows overall progress
- Can report to stakeholders on entire platform

---

### Use Case 2: Multi-Phase Project

**Scenario:** Project divided into phases/milestones.

**Hierarchy:**

```
Q1 Product Launch (Root)
├── Phase 1: Research & Planning
│   ├── User Research
│   ├── Competitor Analysis
│   └── Technical Spec
├── Phase 2: Development
│   ├── Backend Implementation
│   ├── Frontend Implementation
│   └── Integration Testing
├── Phase 3: Beta Testing
│   └── User Acceptance Testing
└── Phase 4: Launch Preparation
    ├── Marketing Materials
    ├── Documentation
    └── Deployment
```

**Benefits:**
- Clear phase separation
- Phase dependencies visible
- Can complete phases sequentially

---

### Use Case 3: Department/Team Structure

**Scenario:** Engineering department with specialized teams.

**Hierarchy:**

```
Engineering Department (Root)
├── Frontend Team
│   ├── Web Team
│   └── Mobile Team
├── Backend Team
│   ├── API Team
│   └── Data Team
├── DevOps Team
└── QA Team
```

**Benefits:**
- Mirrors org structure
- Team autonomy with visibility
- Cross-team coordination easier

---

### Use Case 4: Client Projects (Agency)

**Scenario:** Agency managing multiple clients and projects.

**Hierarchy:**

```
Acme Corp (Client)
├── Website Redesign
│   ├── Design Phase
│   └── Development Phase
├── Marketing Campaign Q1
│   ├── Content Creation
│   └── Social Media
└── Mobile App Development
    ├── iOS App
    └── Android App

Beta Inc (Client)
├── Brand Refresh
└── E-commerce Site
```

**Benefits:**
- Client-level reporting
- Isolate client work
- Billing by client/project

---

## Best Practices

### Hierarchy Design Principles

**Keep it Shallow:**
- ✅ Aim for 2-4 levels maximum
- ❌ Avoid > 5 levels (too complex)
- Flat structures easier to navigate

**Logical Grouping:**
- ✅ Group by: Component, Phase, Team, Feature
- ❌ Don't group arbitrarily
- Structure should make sense to all team members

**Consistent Naming:**
- ✅ Use consistent prefixes/patterns
- Example: "[Team] - [Component]"
- "Frontend - Web Dashboard"
- "Frontend - Mobile App"

**Ownership:**
- Assign clear owner to each level
- Owner responsible for subproject health
- Delegate subtasks to team members

### When to Use Hierarchies

**Good Use Cases:**

- ✅ Large projects with distinct components
- ✅ Multi-phase initiatives
- ✅ Different teams working on related work
- ✅ Portfolio management

**When NOT to Use:**

- ❌ Small projects (< 50 tasks)
- ❌ Single-team projects
- ❌ Short-term (< 1 month) projects
- ❌ Simple workflows

**Alternative:** Use labels/tags instead of hierarchy for simple categorization.

### Performance Considerations

**Impact of Deep Hierarchies:**

- Database queries become more complex
- UI rendering slows with many levels
- Breadcrumb trails get long

**Optimization:**

- Cache hierarchy paths
- Lazy-load children (don't show all at once)
- Use pagination for large child lists

---

## Troubleshooting

### "Cannot create subproject - parent not found"

**Problem:** Parent project was deleted or you lost access.

**Solution:**
1. Verify parent still exists (search for it)
2. Check your permissions on parent
3. Contact admin if parent is restricted

### "ltree path too long"

**Problem:** Path exceeds maximum length (255 characters).

**Solution:**
- Reduce project name length
- Flatten hierarchy (reduce depth)
- Use abbreviations in project names

### "Circular reference detected"

**Problem:** Trying to create a loop in hierarchy.

**Solution:**
1. Review current project path
2. Ensure new parent is NOT a descendant
3. Draw hierarchy diagram if confused
4. Choose different parent

### "Cannot delete project with children"

**Problem:** Project has subprojects.

**Solution:**
1. Delete all children first (or move them)
2. Or: Use cascade delete (admin only)
3. Or: Reparent children to different project

### "Hierarchy not updating in UI"

**Problem:** Browser cache showing old structure.

**Solution:**
1. Hard refresh: Ctrl+Shift+R
2. Clear browser cache
3. Check browser console for errors
4. Verify ltree paths in database (admin)

---

## Advanced Topics

### API Access to Hierarchy

```bash
# Get project hierarchy
GET /api/projects/{id}/hierarchy
Response:
{
  "project": {...},
  "parent": {...},
  "children": [...],
  "siblings": [...],
  "ancestors": [...],
  "descendants": [...]
}

# Create subproject
POST /api/projects
{
  "title": "New Subproject",
  "parent_project_id": "parent-id"
}

# Move project (reparent)
PUT /api/projects/{id}
{
  "parent_project_id": "new-parent-id"
}
```

### Bulk Operations

**Reparent multiple projects:**

1. Select projects in list view (checkboxes)
2. Click **"Change Parent"** bulk action
3. Choose new parent
4. Confirm changes
5. All selected projects reparented

**Export hierarchy:**

```bash
GET /api/projects/{id}/export?format=tree
```

Returns hierarchical JSON or CSV.

---

## Quick Reference

### Hierarchy Depth Limits

| Plan | Max Depth | Max Children | Notes |
|------|-----------|--------------|-------|
| Free | 3 levels | 10 per parent | For small teams |
| Pro | 5 levels | 50 per parent | Most common |
| Enterprise | 10 levels | Unlimited | Large organizations |

### Common Hierarchy Patterns

**Product Structure:**
```
Product → Component → Subcomponent
```

**Phase-Based:**
```
Project → Phase → Deliverable
```

**Team-Based:**
```
Department → Team → Initiative
```

**Client-Based:**
```
Client → Project → Workstream
```

---

**Questions or feedback?** Email docs@archon.dev

**Version History:**
- v1.0 (2026-01-22): Initial release
