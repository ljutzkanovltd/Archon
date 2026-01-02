# Agent Work Orders Feature - Next.js Port
## Project Plan & Task Breakdown

**Date:** 2025-12-29
**Project ID:** `34b54640-60c6-4153-a786-2ba758c9faad`
**Status:** ✅ Planning Complete - Ready for Implementation

---

## 📊 Project Overview

### Source Analysis
- **Location:** `/archon-ui-main/src/features/agent-work-orders/`
- **Total Code:** ~4,500 lines across 35+ files
- **Components:** 11 React components
- **State Management:** Zustand with 4 slices
- **Backend:** Fully implemented Python API
- **Architecture:** React/Vite → Next.js App Router migration

### Target Architecture
- **Pages:** Next.js App Router (`/app/agent-work-orders/`)
- **Features:** Feature-based structure (`/src/features/agent-work-orders/`)
- **Data Fetching:** TanStack Query v5
- **State:** Zustand with persistence
- **Real-Time:** Server-Sent Events (SSE)

---

## 🎯 Task Summary

**Total Tasks:** 20
**Total Estimated Hours:** 48.5 hours
**Phases:** 8
**Agents:** 6 specialists

### Distribution by Agent

| Agent | Tasks | Hours | Percentage |
|-------|-------|-------|------------|
| **ui-implementation-expert** | 10 | 24.5 | 50.5% |
| **testing-expert** | 3 | 7.5 | 15.5% |
| **backend-api-expert** | 2 | 6.0 | 12.4% |
| **documentation-expert** | 2 | 4.0 | 8.2% |
| **integration-expert** | 1 | 3.5 | 7.2% |
| **codebase-analyst** | 1 | 2.0 | 4.1% |
| **TOTAL** | **20** | **48.5** | **100%** |

---

## 📋 Complete Task List

### Phase 1: Foundation & Architecture (3.0 hrs)

#### Task 1.1: Analyze original architecture (2.0 hrs)
- **ID:** `bb7e9b0a-48c1-4c23-91e8-4cea4a176671`
- **Assignee:** codebase-analyst
- **Deliverables:**
  - Architecture analysis document
  - Component dependency graph
  - Type definitions catalog
  - SSE integration patterns

#### Task 1.2: Set up Next.js file structure (1.0 hr)
- **ID:** `a8b2ee25-4c30-4e02-90b2-ddc63d520f98`
- **Assignee:** ui-implementation-expert
- **Deliverables:**
  - `/app/agent-work-orders/` directory
  - `/app/agent-work-orders/[id]/` directory
  - `/src/features/agent-work-orders/` structure
  - Barrel exports configured

---

### Phase 2: Core Services & State (10.5 hrs)

#### Task 2.1: Port TypeScript types (1.5 hrs)
- **ID:** `d6407c5e-52d6-487c-8e17-5919161a6951`
- **Assignee:** ui-implementation-expert
- **Files:**
  - `types/index.ts` (AgentWorkOrder, WorkflowStep, SandboxType)
  - `types/repository.ts` (ConfiguredRepository, CreateRepositoryRequest)

#### Task 2.2: Port API services (2.5 hrs)
- **ID:** `092cf0de-d536-4e63-b590-096952102cb1`
- **Assignee:** backend-api-expert
- **Files:**
  - `services/agentWorkOrdersService.ts`
  - `services/repositoryService.ts`

#### Task 2.3: Port Zustand store with 4 slices (3.0 hrs)
- **ID:** `426524c9-178f-4a39-9d5b-e7a61fcb2887`
- **Assignee:** ui-implementation-expert
- **Files:**
  - `state/agentWorkOrdersStore.ts`
  - `state/slices/uiPreferencesSlice.ts`
  - `state/slices/modalsSlice.ts`
  - `state/slices/filtersSlice.ts`
  - `state/slices/sseSlice.ts`

#### Task 2.4: Port TanStack Query hooks (3.5 hrs)
- **ID:** `8a158aa9-0124-428f-bbfb-832a95490619`
- **Assignee:** backend-api-expert
- **Files:**
  - `hooks/useAgentWorkOrderQueries.ts`
  - `hooks/useRepositoryQueries.ts`

---

### Phase 3: Pages & Routing (7.5 hrs)

#### Task 3.1: Create main page (4.0 hrs)
- **ID:** `2e8defcd-37d2-4d21-86e0-fb43d7b7f438`
- **Assignee:** ui-implementation-expert
- **File:** `/app/agent-work-orders/page.tsx`
- **Features:**
  - Horizontal and sidebar layout modes
  - Repository search
  - Modal integration
  - URL-based repository selection

#### Task 3.2: Create detail page (3.5 hrs)
- **ID:** `f6474b8a-3884-4ea3-9041-abcb63b347ce`
- **Assignee:** ui-implementation-expert
- **File:** `/app/agent-work-orders/[id]/page.tsx`
- **Features:**
  - Work order detail view
  - SSE real-time updates
  - Execution logs
  - Step history

---

### Phase 4: Modal Components (5.5 hrs)

#### Task 4.1: Port repository modals (2.5 hrs)
- **ID:** `48cf8b45-6d80-40a2-89ea-6b2a45f04b9f`
- **Assignee:** ui-implementation-expert
- **Components:**
  - AddRepositoryModal.tsx
  - EditRepositoryModal.tsx

#### Task 4.2: Port CreateWorkOrderModal (3.0 hrs)
- **ID:** `07b4dc22-fd26-42a0-9fc8-f0ded1f0ecc0`
- **Assignee:** ui-implementation-expert
- **Component:** CreateWorkOrderModal.tsx
- **Features:**
  - Multi-step form
  - Workflow step selection
  - GitHub issue linking

---

### Phase 5: Data Display Components (10.5 hrs)

#### Task 5.1: Port repository cards (2.0 hrs)
- **ID:** `e220dfb9-6c24-4b44-9d15-ac46d215f6a3`
- **Assignee:** ui-implementation-expert
- **Components:**
  - RepositoryCard.tsx (horizontal layout)
  - SidebarRepositoryCard.tsx (sidebar layout)

#### Task 5.2: Port work order table (3.0 hrs)
- **ID:** `2fcc5658-067c-43a6-87ef-39c61d6a0147`
- **Assignee:** ui-implementation-expert
- **Components:**
  - WorkOrderTable.tsx
  - WorkOrderRow.tsx (expandable)

#### Task 5.3: Port real-time monitoring (2.5 hrs)
- **ID:** `59b33594-85aa-451e-a9fe-e4b758b4541c`
- **Assignee:** ui-implementation-expert
- **Components:**
  - RealTimeStats.tsx (progress, current step)
  - StepHistoryCard.tsx (execution results)

#### Task 5.4: Port execution logging (3.0 hrs)
- **ID:** `a1c89856-5751-4f07-897f-93c4cc8fc94e`
- **Assignee:** ui-implementation-expert
- **Components:**
  - ExecutionLogs.tsx (log viewer)
  - WorkflowStepButton.tsx (step controls)

---

### Phase 6: Real-Time Features (3.5 hrs)

#### Task 6.1: Implement SSE integration (3.5 hrs)
- **ID:** `87e36b28-8300-42aa-98b3-cd8b8b759cbe`
- **Assignee:** integration-expert
- **Features:**
  - SSE connection lifecycle
  - Auto-reconnect logic
  - Live log streaming
  - Progress updates

---

### Phase 7: Testing (7.5 hrs)

#### Task 7.1: Repository management flow testing (2.5 hrs)
- **ID:** `90a4a043-5b35-4756-a0dc-ea1b9da49100`
- **Assignee:** testing-expert
- **Coverage:**
  - CRUD operations
  - Repository selection
  - Search filtering
  - Stats calculation

#### Task 7.2: Work order lifecycle testing (3.0 hrs)
- **ID:** `57780528-a138-4ae1-8a20-9bfd5f78d6c3`
- **Assignee:** testing-expert
- **Coverage:**
  - Create → Start → Monitor → Complete
  - SSE real-time updates
  - Status transitions
  - Error handling

#### Task 7.3: Layout modes and UI testing (2.0 hrs)
- **ID:** `a3b5f5d7-01eb-4480-8e57-25f3a47c92df`
- **Assignee:** testing-expert
- **Coverage:**
  - Horizontal/sidebar layouts
  - Sidebar collapse/expand
  - Keyboard navigation
  - Accessibility (WCAG 2.1 AA)

---

### Phase 8: Documentation (4.0 hrs)

#### Task 8.1: Architecture documentation (2.5 hrs)
- **ID:** `022deb7c-da60-4b49-90a6-3c78afa0139b`
- **Assignee:** documentation-expert
- **Deliverables:**
  - ARCHITECTURE.md
  - API.md
  - SSE.md
  - ZUSTAND.md
  - Developer guide

#### Task 8.2: User guide documentation (1.5 hrs)
- **ID:** `4f572521-2daa-4260-bce7-93802adffb02`
- **Assignee:** documentation-expert
- **Deliverables:**
  - USER_GUIDE.md
  - FEATURES.md
  - FAQ.md
  - Screenshots/diagrams

---

## 🔄 Execution Timeline

### Sequential Dependencies

**Critical Path:**
```
Phase 1.1 → Phase 1.2 → Phase 2 → Phase 3 → Phase 5 → Phase 6 → Phase 7
```

**Parallel Opportunities:**
- Phase 2.1 + 2.2 (types vs services)
- Phase 4.1 + 4.2 (different modals)
- Phase 5 tasks (different component sets)
- Phase 7 tasks (different test suites)

### Estimated Timelines

| Scenario | Duration | Notes |
|----------|----------|-------|
| **Optimistic** | 4-5 days | Parallel work, no blockers |
| **Realistic** | 6-8 days | Sequential with reviews |
| **Conservative** | 10-12 days | Includes rework/blockers |

---

## 🎯 Feature Scope

### Components to Port (11 total)

1. **AddRepositoryModal.tsx** - Repository creation form
2. **CreateWorkOrderModal.tsx** - Work order creation with workflow steps
3. **EditRepositoryModal.tsx** - Repository editing form
4. **ExecutionLogs.tsx** - Scrollable log viewer with filtering
5. **RealTimeStats.tsx** - Live progress display
6. **RepositoryCard.tsx** - Horizontal layout card
7. **SidebarRepositoryCard.tsx** - Compact sidebar card
8. **StepHistoryCard.tsx** - Step execution history
9. **WorkflowStepButton.tsx** - Step trigger buttons
10. **WorkOrderRow.tsx** - Expandable table row
11. **WorkOrderTable.tsx** - Main work order listing

### Key Technical Features

1. **Repository Management**
   - CRUD operations for GitHub repos
   - Display name, owner, URL configuration
   - Stats tracking (total, active, done work orders)

2. **Work Order Lifecycle**
   - Create with natural language requests
   - Select workflow steps (6 available)
   - Start/monitor/complete workflow
   - GitHub issue linking

3. **Real-Time Monitoring**
   - SSE for live log streaming
   - Progress bar with current step
   - Step execution history
   - Live stats updates

4. **Multi-Layout Support**
   - Horizontal cards layout
   - Collapsible sidebar layout
   - Persistent UI preferences

5. **State Management**
   - Zustand for UI state (layout, modals, filters, SSE)
   - TanStack Query for server state
   - URL params as source of truth for selection

6. **Workflow Steps** (6 configurable)
   - create-branch
   - planning
   - execute
   - commit
   - create-pr
   - prp-review

---

## ✅ Validation Results

**All tasks meet Archon requirements:**
- ✅ Project ID included in all tasks (crash recovery)
- ✅ Granularity: 0.5-4.0 hours per task
- ✅ Clear acceptance criteria
- ✅ Appropriate agent assignments
- ✅ Logical phase breakdown
- ✅ Dependencies specified where applicable

---

## 🚀 Next Steps

### Immediate Actions
1. **Review this plan** - Ensure alignment with expectations
2. **Test RAG settings** - Complete remaining work from Settings Alignment project
3. **Schedule implementation** - Determine start date for Agent Work Orders port

### Implementation Start (When Ready)
1. Begin with **Phase 1.1** - codebase-analyst reviews original implementation
2. Progress through phases sequentially
3. Use Archon task tracking for progress monitoring
4. Implement parallel work where possible

---

## 📍 Project Access

**Archon Dashboard:** http://localhost:3737
**Project ID:** `34b54640-60c6-4153-a786-2ba758c9faad`
**Source Code:** `/home/ljutzkanov/Documents/Projects/archon/archon-ui-main/src/features/agent-work-orders/`
**Target Code:** `/home/ljutzkanov/Documents/Projects/archon/archon-ui-nextjs/src/`

---

**Plan Created:** 2025-12-29
**Created By:** Planner Agent (Archon Agentic Workflow)
**Status:** ✅ Complete and Validated
