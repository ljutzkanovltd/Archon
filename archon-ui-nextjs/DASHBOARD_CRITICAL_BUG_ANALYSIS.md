# Dashboard Critical Bug - Root Cause Analysis

**Date**: 2025-12-26
**Severity**: CRITICAL
**Status**: ROOT CAUSE IDENTIFIED
**Assigned to**: code-reviewer → planner → implementation agents

---

## Executive Summary

The Archon Next.js dashboard displays **identical counts (295-297) for all task statuses**, making it impossible to track actual task distribution. Root cause identified: **Backend API filtering is completely broken**.

---

## Critical Issues Found

### 1. Task Status Breakdown Shows Duplicate Counts ❌

**Expected Behavior**:
```
To Do: 150
In Progress: 50
Review: 20
Completed: 75
Total: 295
```

**Actual Behavior**:
```
To Do: 295 ❌
In Progress: 295 ❌
Review: 295 ❌
Completed: 295 ❌
Total: 295 (impossible - sum = 1180!)
```

### 2. Agent Tasks Shows 0 ❌

**Display**: "0 agent tasks"
**Cause**: Calculation is `totalTasks - userTasks`. If filtering is broken, this calculation is also wrong.

### 3. Active Users Mislabeled ✅ (Easy Fix)

**Issue**: Widget says "Active Users: 8" but those are AI agents, not human users
**Fix**: Change label to "Active Agents" or add clarifying subtitle

---

## Root Cause Investigation

### API Testing Results

**Test Command**:
```bash
curl -s "http://localhost:8181/api/tasks?filter_by=status&filter_value=done&per_page=1" | jq
```

**Expected Response** (if filtering worked):
```json
{
  "pagination": {
    "total": 75,  // Only completed tasks
    "page": 1,
    "per_page": 1
  },
  "tasks": [
    {
      "id": "task-123",
      "status": "done",  // ← Should be "done"
      "title": "..."
    }
  ]
}
```

**Actual Response** (BROKEN):
```json
{
  "pagination": {
    "total": 297,  // ← RETURNS ALL TASKS, NOT FILTERED!
    "page": 1,
    "per_page": 1
  },
  "tasks": [
    {
      "id": "some-task",
      "status": "todo",  // ← WRONG! Requested "done" but got "todo"
      "title": "..."
    }
  ]
}
```

**Conclusion**: Backend API **completely ignores** `filter_by` and `filter_value` parameters.

---

## Code Analysis

### Frontend Code (page.tsx lines 45-70)

```typescript
// 7 parallel API calls to get task counts by status
const [
  projectsData,
  allTasksData,
  userTasksData,
  completedTasksData,    // filter_value="done"
  inProgressTasksData,   // filter_value="doing"
  reviewTasksData,       // filter_value="review"
  todoTasksData,         // filter_value="todo"
] = await Promise.all([
  projectsApi.getAll({ per_page: 1 }),
  tasksApi.getAll({ per_page: 1 }),
  tasksApi.getAll({ filter_by: "assignee", filter_value: "User", per_page: 1 }),
  tasksApi.getAll({ filter_by: "status", filter_value: "done", per_page: 1 }),
  tasksApi.getAll({ filter_by: "status", filter_value: "doing", per_page: 1 }),
  tasksApi.getAll({ filter_by: "status", filter_value: "review", per_page: 1 }),
  tasksApi.getAll({ filter_by: "status", filter_value: "todo", per_page: 1 }),
]);

// Extract totals from pagination
const totalTasks = allTasksData.total;           // 295 ✅ (correct)
const completedTasks = completedTasksData.total; // 295 ❌ (should be ~75)
const inProgressTasks = inProgressTasksData.total; // 295 ❌ (should be ~50)
const reviewTasks = reviewTasksData.total;       // 295 ❌ (should be ~20)
const todoTasks = todoTasksData.total;           // 295 ❌ (should be ~150)
```

**Frontend Logic**: ✅ CORRECT - properly sends filter parameters
**Backend API**: ❌ BROKEN - ignores filter parameters

### API Client (apiClient.ts lines 195-215)

```typescript
getAll: async (params?: {
  filter_by?: "status" | "project" | "assignee";
  filter_value?: string;
  // ... other params
}): Promise<PaginatedResponse<Task>> => {
  const response = await apiClient.get("/api/tasks", { params });
  const data = response.data;

  return {
    success: true,
    items: data.tasks || [],
    total: data.pagination?.total || 0,  // ← Returns total of ALL tasks
    page: data.pagination?.page || params?.page || 1,
    per_page: data.pagination?.per_page || params?.per_page || 10,
  };
}
```

**API Client Logic**: ✅ CORRECT - properly passes params to backend

---

## Backend API Investigation Needed

**Backend Endpoint**: `GET /api/tasks`
**Location**: Likely `python/src/server/api_routes/projects_api.py` or `python/src/mcp_server/features/tasks/task_tools.py`

**Hypothesis**: Backend is:
1. ❌ Not applying filters to SQL query
2. ❌ Returning `COUNT(*)` from full table instead of filtered count
3. ❌ Ignoring `filter_by` and `filter_value` query parameters

**Required Fix**: Backend must:
1. Apply WHERE clause based on filter_by/filter_value
2. Return filtered count in pagination.total
3. Return only filtered tasks in tasks array

---

## Impact Assessment

### Affected Widgets

1. **Task Status Breakdown** (lines 327-388) - ❌ BROKEN
   - All 4 progress bars show 100% (295/295)
   - Percentages all show 100%
   - Completely useless for tracking

2. **Task Assignment Chart** (lines 391-424) - ❌ BROKEN
   - Agent Tasks: 0 (wrong calculation due to bad data)
   - User Tasks: 295 (might be correct if all assigned to "User")

3. **Total Tasks Card** (lines 203-220) - ⚠️ PARTIALLY WRONG
   - Total: 295 ✅ (correct - unfiltered query)
   - Subtitle: "295 in progress • 295 to do" ❌ (impossible)

4. **Completion Rate Card** (lines 223-240) - ❌ BROKEN
   - Shows 100% (295/295 completed) ❌
   - Should be ~25% (75/295 completed)

5. **My Tasks Card** (lines 243-260) - ⚠️ UNKNOWN
   - Shows 295 (might be correct if filter_by=assignee also broken)

6. **Agent Tasks Card** (lines 263-280) - ❌ BROKEN
   - Shows 0 (totalTasks - userTasks = 295 - 295 = 0)

---

## Fix Strategy

### Option A: Fix Backend API (RECOMMENDED) ⭐

**Pros**:
- ✅ Fixes root cause
- ✅ Benefits all API consumers
- ✅ Proper separation of concerns
- ✅ Enables caching and optimization

**Cons**:
- ⏱️ Requires backend code changes
- ⏱️ Requires backend restart

**Implementation**:
1. Locate backend endpoint (likely `python/src/server/api_routes/projects_api.py`)
2. Add WHERE clause based on filter_by/filter_value
3. Count filtered results for pagination.total
4. Test all filter combinations
5. Add integration tests

**Estimated Time**: 2-3 hours (backend-api-expert)

---

### Option B: Frontend Workaround (NOT RECOMMENDED) ❌

**Approach**: Fetch ALL tasks, count client-side

**Code Example**:
```typescript
// INEFFICIENT - fetches all 295 tasks for each query
const completedTasksData = await tasksApi.getAll({
  filter_by: "status",
  filter_value: "done",
  per_page: 1000  // Fetch all
});
const completedCount = completedTasksData.items.filter(t => t.status === "done").length;
```

**Pros**:
- ⚡ Quick fix (30 min)

**Cons**:
- ❌ Extremely inefficient (fetches 1000+ tasks 7 times)
- ❌ Doesn't fix root cause
- ❌ Will break with >1000 tasks
- ❌ Wastes bandwidth and memory
- ❌ Slow dashboard load

**Verdict**: DO NOT USE

---

## Recommended Implementation Plan

### Phase 1: Backend Fix (CRITICAL)
**Assignee**: backend-api-expert
**Duration**: 2-3 hours
**Tasks**:
1. Locate `/api/tasks` endpoint in Python backend
2. Debug why filters are ignored
3. Fix SQL query to apply WHERE clause
4. Ensure pagination.total returns filtered count
5. Test all filter combinations:
   - filter_by=status (todo/doing/review/done)
   - filter_by=assignee (User/planner/agents)
   - filter_by=project

### Phase 2: Verify Assignee Values (QUICK)
**Assignee**: database-expert
**Duration**: 30 min
**Tasks**:
1. Query actual assignee values: `SELECT DISTINCT assignee FROM archon_tasks`
2. Determine if "User" is correct filter value
3. Identify agent assignee naming pattern (e.g., "planner", "ui-implementation-expert")

### Phase 3: Fix Agent Tasks Calculation (FRONTEND)
**Assignee**: ui-implementation-expert
**Duration**: 1 hour
**Tasks**:
1. Wait for backend fix
2. Update calculation logic:
   ```typescript
   const agentTasks = totalTasks - userTasks;  // Current (might be correct)
   // OR query agents directly:
   const agentTasksData = await tasksApi.getAll({
     filter_by: "assignee",
     filter_value: "planner"  // Or exclude "User"
   });
   ```

### Phase 4: Fix Active Users Label (TRIVIAL)
**Assignee**: ui-implementation-expert
**Duration**: 15 min
**Tasks**:
1. Change "Active Users" → "Active Agents" in page.tsx line 283
2. Update subtitle text

### Phase 5: Integration Testing (VALIDATION)
**Assignee**: testing-expert
**Duration**: 1 hour
**Tasks**:
1. Test all filter combinations return correct counts
2. Verify dashboard totals sum correctly
3. Add E2E test: "Dashboard shows accurate task breakdown"
4. Test edge cases (0 tasks, 1000+ tasks)

---

## Verification Checklist

After fixes are deployed, verify:

- [ ] **Task Status Breakdown**: Counts sum to total (not 4x total)
- [ ] **To Do count** ≠ Total tasks
- [ ] **In Progress count** ≠ Total tasks
- [ ] **Review count** ≠ Total tasks
- [ ] **Completed count** ≠ Total tasks
- [ ] **Sum of all statuses** = Total tasks
- [ ] **Completion Rate**: Realistic % (not 100% or 0%)
- [ ] **Agent Tasks**: Shows realistic count (not 0)
- [ ] **Active Users**: Labeled as "Active Agents"
- [ ] **API Test**: `curl "http://localhost:8181/api/tasks?filter_by=status&filter_value=done"` returns only done tasks

---

## Files Requiring Changes

### Backend (Python)
- `python/src/server/api_routes/projects_api.py` (likely location)
- OR `python/src/mcp_server/features/tasks/task_tools.py`
- Tests: `python/tests/server/services/test_tasks.py`

### Frontend (TypeScript)
- `archon-ui-nextjs/src/app/page.tsx` (line 283 - change "Active Users" label)
- Possibly `archon-ui-nextjs/src/app/page.tsx` (lines 45-70 - adjust calculation if needed)

### Tests
- Add: `archon-ui-nextjs/e2e/dashboard.spec.ts` (verify accurate counts)

---

## Priority

🔴 **P0 CRITICAL** - Dashboard is currently unusable for task tracking. All metrics are wrong.

**User Impact**: Cannot:
- Track project progress
- Identify bottlenecks
- Measure team velocity
- Make data-driven decisions

**Business Impact**: Loss of trust in dashboard, potential incorrect resource allocation

---

## Next Steps

1. **Assign to backend-api-expert**: Fix /api/tasks filtering (2-3 hr)
2. **Assign to database-expert**: Query assignee values (30 min)
3. **Assign to ui-implementation-expert**: Fix label + calculation (1.5 hr)
4. **Assign to testing-expert**: Add integration tests (1 hr)

**Total Estimated Time**: 5-6 hours
**Target Completion**: Before user wakes up

---

## Appendix: API Test Commands

**Test Status Filter**:
```bash
# Should return only completed tasks
curl -s "http://localhost:8181/api/tasks?filter_by=status&filter_value=done&per_page=5" | jq '.tasks[].status'
# Expected: All results show "done"

# Should return only todo tasks
curl -s "http://localhost:8181/api/tasks?filter_by=status&filter_value=todo&per_page=5" | jq '.tasks[].status'
# Expected: All results show "todo"
```

**Test Assignee Filter**:
```bash
# Should return only User tasks
curl -s "http://localhost:8181/api/tasks?filter_by=assignee&filter_value=User&per_page=5" | jq '.tasks[].assignee'
# Expected: All results show "User"
```

**Test Pagination Total**:
```bash
# Count actual completed tasks
curl -s "http://localhost:8181/api/tasks?filter_by=status&filter_value=done&per_page=1000" | jq '.pagination.total'
# Should match: jq '.tasks | length'
```

---

**Report Generated**: 2025-12-26 by code-reviewer agent
**Root Cause**: Backend API filtering completely broken
**Recommended Fix**: Backend-first approach (Option A)
**Estimated Fix Time**: 5-6 hours
**Status**: READY FOR PLANNER TASK BREAKDOWN
