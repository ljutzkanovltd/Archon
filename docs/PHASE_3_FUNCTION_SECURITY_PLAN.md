# Phase 3: Function Security Fixes - Planning Document

**Date:** 2026-01-12
**Status:** Planning
**Priority:** HIGH (Week 1)
**Estimated Duration:** 2-3 hours

---

## Executive Summary

**Objective:** Fix 32 PostgreSQL functions with mutable search_path vulnerability (SQL injection risk)

**Current Risk Level:** 🟡 **MEDIUM** - Requires schema creation permissions to exploit

**Impact if Not Fixed:**
- Privilege escalation via malicious schema/function hijacking
- Data exfiltration through operator overloading
- Function behavior manipulation

**Approach:**
- Add `SET search_path = ''` to all vulnerable functions
- Staged rollout: Test local → Deploy remote
- Comprehensive verification at each step

---

## Vulnerability Details

### What is search_path Vulnerability?

**Definition:** PostgreSQL functions without explicit search_path can be tricked into using attacker-controlled schemas.

**Attack Scenario:**
```sql
-- Step 1: Attacker creates malicious schema
CREATE SCHEMA attacker;

-- Step 2: Attacker overrides operators
CREATE FUNCTION attacker.=(text, text) RETURNS bool AS $$
BEGIN
  -- Log sensitive data to attacker's table
  INSERT INTO attacker.stolen_data VALUES (current_user, $1, $2);
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Attacker sets search_path
SET search_path = attacker, public;

-- Step 4: When vulnerable function runs, it uses attacker's = operator
-- Original: WHERE user_id = 'admin'
-- Hijacked: Uses attacker.=() instead of pg_catalog.=()
```

**Risk Level:**
- Likelihood: MEDIUM (requires schema creation permissions)
- Impact: HIGH (privilege escalation, data theft)
- Overall: 🟡 **MEDIUM-HIGH**

---

## Functions Requiring Fix (32 Total)

### Category 1: Session Management (4 functions)
1. `update_session_status`
2. `get_disconnected_sessions`
3. `get_active_mcp_clients`
4. `get_user_sessions`

### Category 2: Task Management (5 functions)
5. `log_task_changes`
6. `get_recently_completed_tasks`
7. `set_task_completed`
8. `get_task_history`
9. `get_project_completion_stats`

### Category 3: Vector Search (8 functions)
10. `hybrid_search_archon_code_examples`
11. `match_archon_code_examples`
12. `hybrid_search_archon_crawled_pages`
13. `match_archon_crawled_pages`
14. `hybrid_search_archon_code_examples_multi`
15. `match_archon_code_examples_multi`
16. `hybrid_search_archon_crawled_pages_multi`
17. `match_archon_crawled_pages_multi`

### Category 4: Project/Archive Management (4 functions)
18. `archive_project_and_tasks`
19. `archive_task`
20. `unarchive_project_and_tasks`
21. `purge_old_task_history`

### Category 5: MCP Analytics (4 functions)
22. `calculate_request_cost`
23. `get_mcp_usage_by_tool`
24. `get_mcp_usage_summary`
25. `get_user_activity_summary`

### Category 6: Utility/Helper Functions (7 functions)
26. `get_sync_stats`
27. `get_embedding_column_name`
28. `detect_embedding_dimension`
29. `get_latest_sync`
30. `update_updated_at_column`
31. `update_sync_history_updated_at`
32. `update_crawl_state_updated_at`

---

## Fix Strategy

### The Fix (Applied to ALL 32 functions)

**Pattern:**
```sql
CREATE OR REPLACE FUNCTION function_name(...)
RETURNS return_type
LANGUAGE plpgsql
SET search_path = ''  -- 🔒 FIX: Lock search_path to empty
AS $$
BEGIN
  -- Function body remains unchanged
  -- All operators/functions now use pg_catalog only
END;
$$;
```

**Why `SET search_path = ''` Works:**
- Forces all unqualified references to use `pg_catalog` schema
- Prevents attacker schemas from hijacking operators
- No performance impact (resolved at function creation time)
- Recommended by PostgreSQL security best practices

---

## Migration Strategy

### Phase 3.1: Local Testing (Estimated: 1 hour)

**Steps:**
1. Create migration `031_fix_function_search_path.sql`
2. Apply to local Supabase database
3. Verify all 32 functions updated
4. Test critical functionality:
   - Vector search operations
   - Task CRUD operations
   - Session management
   - MCP tool calls
5. Check for SQL errors in logs
6. Performance benchmark (ensure no degradation)

**Success Criteria:**
- ✅ Migration applies cleanly (no errors)
- ✅ All 32 functions show `SET search_path = ''` in definition
- ✅ All tests pass (backend, MCP, frontend)
- ✅ Zero SQL errors in logs
- ✅ Performance within 5% of baseline

---

### Phase 3.2: Remote Deployment (Estimated: 30 minutes)

**Prerequisites:**
- ✅ Phase 3.1 completed successfully
- ✅ All local tests passed
- ✅ Backup created within last hour (automatic via scheduled backup)

**Steps:**
1. Verify backup exists and is healthy
2. Apply migration to remote Supabase Cloud
3. Verify all 32 functions updated on remote
4. Re-run Supabase security advisors
5. Monitor for 15 minutes post-deployment

**Expected Result:**
- Before: 32 WARNING-level issues
- After: 0 function search_path vulnerabilities
- Remaining: 8 WARNING-level issues (extensions + overly permissive RLS)

---

### Phase 3.3: Verification (Estimated: 30 minutes)

**Verification Queries:**

```sql
-- 1. Count functions with mutable search_path
SELECT COUNT(*)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'update_session_status', 'get_sync_stats', ...
  )
  AND p.proconfig IS NULL;  -- NULL = no search_path set

-- Expected: 0 (all should have search_path set)

-- 2. Verify search_path is set to empty string
SELECT
  p.proname AS function_name,
  p.proconfig AS config_settings
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('update_session_status', ...)
ORDER BY p.proname;

-- Expected: config_settings = '{"search_path="}' for all functions
```

**Functional Testing:**
```bash
# Test vector search (most complex functions)
curl -X POST http://localhost:8181/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query":"authentication patterns","limit":5}'

# Test task management
curl -X POST http://localhost:8181/api/tasks \
  -d '{"project_id":"...","title":"Test task","status":"todo"}'

# Test MCP tool calls
# Use Claude Code to call: list_tasks, get_task_history, etc.
```

---

## Risk Analysis

### Risk of NOT Fixing

**Security Risks:**
- 🟡 SQL injection via schema hijacking (MEDIUM likelihood)
- 🟡 Privilege escalation (MEDIUM impact)
- 🟡 Data exfiltration (HIGH impact if exploited)

**Compliance:**
- ⚠️ PostgreSQL security best practices violation
- ⚠️ Supabase advisor flagged as WARNING

**Overall Risk:** 🟡 **MEDIUM** - Should fix within 1 week

---

### Risk of Fixing

**Potential Issues:**
- 🟢 Function behavior change (LOW - search_path rarely relied upon)
- 🟢 Performance impact (VERY LOW - no runtime overhead)
- 🟢 Syntax errors (LOW - simple ALTER FUNCTION)

**Mitigation:**
- ✅ Test on local first
- ✅ Comprehensive test suite
- ✅ Rollback procedure documented
- ✅ Can revert in <2 minutes if issues

**Overall Risk:** 🟢 **LOW** - Safe to proceed

---

## Performance Impact

**Expected Change:** <1% overhead (negligible)

**Reason:**
- `SET search_path = ''` is resolved at function **creation time**
- No runtime search path resolution needed
- Actually **improves** performance slightly (fewer schema lookups)

**Benchmark Plan:**
```sql
-- Before fix
EXPLAIN ANALYZE SELECT * FROM hybrid_search_archon_code_examples('test', 5);

-- After fix
EXPLAIN ANALYZE SELECT * FROM hybrid_search_archon_code_examples('test', 5);

-- Compare: Planning time, Execution time
```

---

## Rollback Procedure

**If migration causes issues:**

```sql
BEGIN;

-- For each function, remove search_path constraint:
ALTER FUNCTION update_session_status(...) RESET search_path;
ALTER FUNCTION get_sync_stats(...) RESET search_path;
-- ... (repeat for all 32 functions)

COMMIT;
```

**Rollback Time:** <2 minutes (automated script available)

**Data Loss:** None (DDL only, no data changes)

---

## Timeline

### Week 1 (Immediate)

**Day 1 (Today):**
- [x] Phase 3 planning document (this file)
- [ ] Create migration file
- [ ] Apply to local database
- [ ] Run comprehensive tests
- [ ] **⚠️ STOP: Request user approval for Phase 3.2 deployment**

**Day 2 (Tomorrow):**
- [ ] Apply to remote database (if Phase 3.1 passed)
- [ ] Verify security advisors (32 → 0 function warnings)
- [ ] Monitor for 15 minutes
- [ ] Create Phase 3 completion report

---

## Success Criteria

**Phase 3.1 (Local) - Must Pass ALL:**
- [ ] Migration applies without errors
- [ ] All 32 functions have `SET search_path = ''`
- [ ] Backend health check passes
- [ ] MCP health check passes
- [ ] Vector search operations work
- [ ] Task CRUD operations work
- [ ] Session management works
- [ ] Zero SQL errors in logs
- [ ] Performance within 5% of baseline

**Phase 3.2 (Remote) - Must Pass ALL:**
- [ ] Migration applies to remote without errors
- [ ] All 32 functions updated on remote
- [ ] Supabase advisors show 0 function warnings
- [ ] Backend/MCP remain healthy
- [ ] Zero SQL errors for 15 minutes
- [ ] All functionality verified

---

## Next Steps After Phase 3

### Phase 4: RLS Policy Refinement (Week 2)

**Objective:** Replace `USING (true)` policies with granular access control

**Affected Tables (6):**
1. `archon_crawl_state` - 2 policies
2. `archon_project_sources` - 1 policy
3. `archon_projects` - 1 policy
4. `archon_settings` - 1 policy
5. `archon_tasks` - 1 policy

**Approach:**
- Implement user-based filtering where applicable
- Maintain service_role full access
- Test with authenticated user context

---

## References

- **PostgreSQL Security:** https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY
- **Supabase Advisor 0011:** https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- **Phase 1 Results:** `docs/PHASE_1_LOCAL_TESTING_RESULTS.md`
- **Phase 2 Results:** `docs/PHASE_2_REMOTE_DEPLOYMENT_RESULTS.md`

---

**Created By:** Archon System Administrator
**Date:** 2026-01-12
**Status:** ✅ **READY FOR IMPLEMENTATION**
**Next Action:** Create migration file `031_fix_function_search_path.sql`
