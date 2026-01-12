# Security Remediation Risk Analysis

**Date:** 2026-01-12
**Subject:** RLS Migration & Security Fixes - Risk Assessment
**Status:** Pre-Implementation Review

---

## Executive Summary

**Current State:** 🔴 **CRITICAL SECURITY RISK** - 7 tables exposed via API without protection

**Proposed Action:** Enable RLS + Create policies

**Risk Analysis:**
- **Risk of NOT fixing:** 🔴 **HIGH** - Active data exposure, compliance violations
- **Risk of fixing:** 🟡 **MEDIUM** - Potential application breakage if backend misconfigured
- **Recommendation:** ✅ **FIX IMMEDIATELY** with staged testing approach

---

## 1. Current State Risks (NO RLS)

### 🔴 CRITICAL - Active Security Vulnerabilities

#### Vulnerability 1: Unrestricted API Access
**Current State:** Any authenticated user can access these tables via PostgREST API

**Attack Scenario:**
```bash
# Attacker with ANY valid auth token can:

# 1. Read all work orders
curl https://your-project.supabase.co/rest/v1/archon_agent_work_orders \
  -H "Authorization: Bearer <stolen_token>" \
  -H "apikey: <anon_key>"

# 2. Delete task history (cover tracks)
curl -X DELETE https://your-project.supabase.co/rest/v1/archon_task_history?id=eq.123 \
  -H "Authorization: Bearer <stolen_token>"

# 3. Modify repository configurations
curl -X PATCH https://your-project.supabase.co/rest/v1/archon_configured_repositories?id=eq.456 \
  -d '{"repository_url": "https://github.com/attacker/malicious-repo"}' \
  -H "Authorization: Bearer <stolen_token>"

# 4. Read session IDs (privacy violation)
curl https://your-project.supabase.co/rest/v1/archon_mcp_error_logs?select=session_id \
  -H "Authorization: Bearer <stolen_token>"
```

**Impact:**
- ❌ Complete data breach of work orders, alerts, error logs
- ❌ Audit trail tampering (task history deletion)
- ❌ Repository hijacking (modify configs)
- ❌ Privacy violations (session ID tracking)
- ❌ Zero accountability (no row-level filtering)

**Likelihood:** HIGH (if PostgREST API is exposed)
**Impact:** CRITICAL
**Overall Risk:** 🔴 **CRITICAL**

#### Vulnerability 2: Sensitive Data Exposure

**Exposed Columns:**
- `archon_agent_work_order_steps.session_id` - Agent session tracking
- `archon_mcp_error_logs.session_id` - User session correlation

**Privacy Implications:**
- GDPR Article 4(1) - session_id qualifies as personal data
- Cross-session correlation attacks possible
- User tracking without consent
- No data minimization principle applied

**Compliance Risk:** 🔴 **HIGH** (GDPR, CCPA violations)

#### Vulnerability 3: SQL Injection via Functions

**32 functions without search_path protection:**

**Attack Scenario:**
```sql
-- Attacker creates malicious schema
CREATE SCHEMA attacker;
CREATE FUNCTION attacker.=(text, text) RETURNS bool AS $$
BEGIN
  -- Log sensitive data to attacker table
  INSERT INTO attacker.stolen_data VALUES (current_user, $1, $2);
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Set search_path to include attacker schema
SET search_path = attacker, public;

-- Now when vulnerable function runs:
SELECT * FROM update_session_status('active');
-- Uses attacker's = operator, leaks data
```

**Impact:**
- ❌ Privilege escalation
- ❌ Data exfiltration
- ❌ Function behavior manipulation

**Likelihood:** MEDIUM (requires schema creation permissions)
**Impact:** HIGH
**Overall Risk:** 🟡 **HIGH**

---

## 2. Remediation Risks (Applying RLS)

### 🟡 MEDIUM - Application Compatibility Risks

#### Risk 1: Backend API Connection Misconfiguration

**Scenario:** Backend not using service_role connection

**Symptoms:**
```
Error: 403 Forbidden
new row violates row-level security policy for table "archon_mcp_alerts"
```

**Current Backend Check Needed:**
```python
# Check backend .env configuration
DATABASE_URI=postgresql://postgres:<service_role_key>@...

# vs. (WRONG - would break with RLS)
DATABASE_URI=postgresql://postgres:<anon_key>@...
```

**Mitigation:**
✅ Backend uses `SUPABASE_SERVICE_KEY` for database operations
✅ Migration includes service_role policies with `USING (true)`
✅ Testing on local database first

**Likelihood:** LOW (backend typically uses service key)
**Impact:** HIGH (backend breaks completely)
**Overall Risk:** 🟡 **MEDIUM** (mitigated by testing)

#### Risk 2: MCP Server Connection Permissions

**Scenario:** MCP server connects with insufficient privileges

**Check Required:**
```python
# MCP server connection string
# Should use service_role, not anon key
supabase = create_client(
    supabase_url,
    supabase_service_key  # ✅ Correct
    # supabase_anon_key  # ❌ Would break with RLS
)
```

**Migration Policy:**
```sql
-- Service role gets full access
CREATE POLICY "Service role full access to MCP alerts"
  ON archon_mcp_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Mitigation:**
✅ Service role policies allow unrestricted access
✅ No changes needed if already using service_role

**Likelihood:** LOW
**Impact:** MEDIUM
**Overall Risk:** 🟢 **LOW**

#### Risk 3: Frontend Data Access Breakage

**Scenario:** Frontend queries tables directly via PostgREST

**If frontend uses authenticated user role:**
```javascript
// Frontend code (currently unrestricted)
const { data, error } = await supabase
  .from('archon_mcp_alerts')
  .select('*')
  .eq('status', 'active');

// After RLS (read-only access maintained)
// ✅ Still works - authenticated users have SELECT policy
```

**Migration Policy:**
```sql
-- Authenticated users get read access
CREATE POLICY "Authenticated users can read MCP alerts"
  ON archon_mcp_alerts
  FOR SELECT
  TO authenticated
  USING (true);
```

**Mitigation:**
✅ Migration includes read-only policies for authenticated users
✅ Frontend can still query data
✅ Only write operations would be blocked (likely already goes through backend)

**Likelihood:** LOW (frontend typically reads only)
**Impact:** MEDIUM
**Overall Risk:** 🟢 **LOW**

#### Risk 4: Migration Transaction Failure

**Scenario:** Migration fails mid-way, leaving partial state

**Failure Points:**
- RLS enable fails on one table
- Policy creation fails
- Verification query fails

**Protection:**
```sql
BEGIN;
-- All operations here...
COMMIT;
-- If ANY operation fails, entire transaction rolls back
```

**Mitigation:**
✅ Migration wrapped in transaction
✅ Verification queries included
✅ Rollback procedure documented

**Likelihood:** LOW (DDL operations are transactional)
**Impact:** MEDIUM (would need rollback)
**Overall Risk:** 🟢 **LOW**

---

### 🟢 LOW - Performance Risks

#### Risk 5: Query Performance Degradation

**RLS Overhead:**
```sql
-- Without RLS
SELECT * FROM archon_mcp_alerts WHERE status = 'active';
-- Query plan: Seq Scan on archon_mcp_alerts

-- With RLS USING (true)
SELECT * FROM archon_mcp_alerts WHERE status = 'active';
-- Query plan: Seq Scan on archon_mcp_alerts
--   Filter: (true) AND (status = 'active')
-- Overhead: Minimal (true predicate optimized out)
```

**Benchmark Expectation:**
- Simple `USING (true)` policies: <1% overhead
- Complex policies with joins: 5-20% overhead
- Our migration uses `USING (true)`: Minimal impact

**Mitigation:**
✅ Using simple `USING (true)` predicates
✅ No complex joins or subqueries
✅ Can benchmark before/after on local

**Likelihood:** LOW
**Impact:** LOW
**Overall Risk:** 🟢 **VERY LOW**

---

## 3. Risk Comparison Matrix

| Risk Category | Current State (No RLS) | After Remediation |
|---------------|------------------------|-------------------|
| **Data Breach** | 🔴 CRITICAL (active) | 🟢 PROTECTED |
| **Privacy Violation** | 🔴 HIGH (session IDs exposed) | 🟢 PROTECTED |
| **Compliance** | 🔴 HIGH (GDPR/CCPA violations) | 🟢 COMPLIANT |
| **Backend Breakage** | 🟢 NONE | 🟡 LOW (if service_role) |
| **Frontend Breakage** | 🟢 NONE | 🟢 MINIMAL (read still works) |
| **Performance** | 🟢 OPTIMAL | 🟢 MINIMAL IMPACT |
| **SQL Injection** | 🟡 HIGH (32 functions) | 🟡 HIGH (separate fix) |

**Conclusion:** Risks of NOT fixing >> Risks of fixing

---

## 4. Mitigation Strategy (Staged Rollout)

### Phase 1: LOCAL TESTING (Low Risk)

**Objective:** Validate migration without production impact

**Steps:**
```bash
# 1. Apply migration to LOCAL Supabase
cd ~/Documents/Projects/archon
psql -h localhost -U postgres -d postgres \
  -f migrations/030_enable_rls_security_critical.sql

# 2. Restart backend with local database
./stop-archon.sh
./start-archon.sh

# 3. Test all critical operations
curl http://localhost:8181/health
curl http://localhost:8181/api/mcp/sessions
curl http://localhost:8051/health

# 4. Test frontend
curl http://localhost:3737
# Check browser console for errors

# 5. Test MCP tools
# Use Claude Code to call MCP tools
# Verify no RLS-related errors
```

**Success Criteria:**
- ✅ Backend health check passes
- ✅ MCP health check passes
- ✅ Frontend loads without 500 errors
- ✅ Can create/read tasks via API
- ✅ Can query alerts/error logs
- ✅ No "row-level security policy" errors

**If Tests Fail:**
```bash
# Rollback on local
psql -h localhost -U postgres -d postgres <<EOF
BEGIN;
-- Drop all policies
DROP POLICY IF EXISTS "Service role full access to work orders"
  ON archon_agent_work_orders;
-- ... (see migration rollback section)
-- Disable RLS
ALTER TABLE archon_agent_work_orders DISABLE ROW LEVEL SECURITY;
-- ... (all 7 tables)
COMMIT;
EOF

# Fix configuration issue
# Retry
```

**Risk:** 🟢 **MINIMAL** (local only, no production impact)

---

### Phase 2: REMOTE PRODUCTION DEPLOYMENT (Controlled Risk)

**Prerequisites:**
- ✅ Local testing completed successfully
- ✅ Backend confirmed using service_role
- ✅ Backup created within last hour
- ✅ Rollback procedure tested

**Deployment Window:**
- Off-peak hours (low user activity)
- Have SSH/database access ready
- Monitor for 15-30 minutes post-deployment

**Steps:**
```bash
# 1. Verify backup exists
bash scripts/pre-dangerous-operation-backup.sh

# 2. Apply migration to REMOTE
psql -h aws-1-eu-west-2.pooler.supabase.com -p 6543 \
  -U postgres.jnjarcdwwwycjgiyddua -d postgres \
  -f migrations/030_enable_rls_security_critical.sql

# 3. Immediate verification
psql -h aws-1-eu-west-2.pooler.supabase.com -p 6543 \
  -U postgres.jnjarcdwwwycjgiyddua -d postgres \
  -c "SELECT tablename, rowsecurity FROM pg_tables
      WHERE schemaname = 'public' AND tablename LIKE 'archon_%'
      ORDER BY tablename;"

# 4. Test backend (if connected to remote)
curl https://your-backend.com/health
curl https://your-backend.com/api/mcp/sessions

# 5. Monitor error logs for 15 minutes
psql -h aws-1-eu-west-2.pooler.supabase.com -p 6543 \
  -U postgres.jnjarcdwwwycjgiyddua -d postgres \
  -c "SELECT COUNT(*) FROM archon_mcp_error_logs
      WHERE timestamp > NOW() - INTERVAL '15 minutes'
      AND error_message LIKE '%row-level security%';"
```

**Rollback Trigger:**
- Any "row-level security policy" errors
- Backend health check fails
- Unable to create/read data via API
- Error count spike (>10 RLS errors in 5 minutes)

**Risk:** 🟡 **CONTROLLED** (can rollback within minutes)

---

## 5. Recommended Testing Checklist

### Backend API Tests

```bash
# 1. Health check
curl http://localhost:8181/health
# Expected: {"status":"healthy","service":"archon-api"}

# 2. Create task (write operation)
curl -X POST http://localhost:8181/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"project_id":"...","title":"Test task","status":"todo"}'
# Expected: Task created successfully

# 3. Read tasks (read operation)
curl http://localhost:8181/api/tasks
# Expected: Task list returned

# 4. Create MCP alert (write to protected table)
curl -X POST http://localhost:8181/api/mcp/alerts \
  -H "Content-Type: application/json" \
  -d '{"alert_type":"test","severity":"low","title":"Test"}'
# Expected: Alert created (tests service_role access)

# 5. Read error logs (sensitive table)
curl http://localhost:8181/api/mcp/error-logs
# Expected: Error logs returned
```

### MCP Server Tests

```bash
# 1. MCP health check
curl http://localhost:8051/health
# Expected: {"status":"healthy","service":"archon-mcp"}

# 2. MCP session info
curl http://localhost:8051/mcp/session-info
# Expected: Session count returned

# 3. Test MCP tool via Claude Code
# Use Claude Code to call any MCP tool
# Example: list_tasks, get_task_history
# Expected: No RLS errors
```

### Frontend Tests

```bash
# 1. Load dashboard
curl http://localhost:3737
# Expected: 200 OK, no 500 errors

# 2. Check browser console
# Open http://localhost:3737 in browser
# Expected: No "row-level security" errors in console

# 3. Test data fetching
# Navigate to tasks page, projects page, alerts page
# Expected: Data loads successfully
```

---

## 6. Risk Acceptance Decision

### Option A: Apply Remediation NOW (RECOMMENDED)

**Pros:**
- ✅ Eliminates CRITICAL security vulnerabilities immediately
- ✅ Achieves GDPR/CCPA compliance
- ✅ Prevents data breach risk
- ✅ Protects session ID privacy
- ✅ Can be tested locally first (low risk)

**Cons:**
- ⚠️ Requires testing time (1-2 hours)
- ⚠️ Small risk of backend misconfiguration
- ⚠️ May need rollback if issues found

**Risk Level:** 🟡 **MEDIUM** (controlled, testable, reversible)

**Recommendation:** ✅ **PROCEED** with staged testing approach

---

### Option B: Delay Remediation (NOT RECOMMENDED)

**Pros:**
- ✅ No immediate deployment risk
- ✅ More time for testing

**Cons:**
- ❌ Active CRITICAL security vulnerabilities remain
- ❌ Data breach risk continues
- ❌ GDPR/CCPA compliance violations persist
- ❌ Session ID privacy exposure ongoing
- ❌ Audit trail remains unprotected
- ❌ Risk INCREASES over time (more exposure)

**Risk Level:** 🔴 **CRITICAL** (active vulnerabilities)

**Recommendation:** ❌ **DO NOT DELAY**

---

## 7. Final Recommendation

### ✅ PROCEED WITH REMEDIATION

**Approach:** Staged rollout with local testing first

**Timeline:**
1. **Today:** Local testing (1-2 hours)
2. **Today/Tomorrow:** Remote deployment (if local tests pass)
3. **This Week:** Monitor for issues, apply function security fixes

**Risk Summary:**
- **Current state risk:** 🔴 CRITICAL (active vulnerabilities)
- **Remediation risk:** 🟡 MEDIUM (controlled, testable)
- **Net risk reduction:** 🟢 SIGNIFICANT IMPROVEMENT

**Decision:** The risk of NOT fixing far exceeds the risk of fixing.

---

## 8. Emergency Contacts & Procedures

### If Migration Breaks Production

**Immediate Actions:**
1. Check error logs for specific RLS errors
2. Identify which table/operation is failing
3. Execute rollback procedure (see migration file)
4. Restore from backup if needed
5. Fix configuration issue
6. Retry migration

**Rollback Time:** <5 minutes
**Recovery Time:** <15 minutes (with backup)

### Monitoring Commands

```bash
# Monitor RLS errors (run every 5 minutes)
watch -n 300 'psql -h REMOTE_HOST -p 6543 -U USER -d postgres \
  -c "SELECT COUNT(*) FROM archon_mcp_error_logs
      WHERE timestamp > NOW() - INTERVAL \"5 minutes\"
      AND error_message LIKE \"%row-level security%\";"'

# Check backend health
watch -n 60 'curl -s http://localhost:8181/health | jq'
```

---

## 9. Sign-Off

**Risk Analysis Completed By:** Archon System Administrator
**Date:** 2026-01-12
**Recommendation:** ✅ **APPROVE REMEDIATION** with staged testing

**Approvals Required:**
- [ ] Technical Lead - Security Review
- [ ] System Administrator - Deployment Approval
- [ ] User Acceptance - Post-deployment verification

**Next Step:** Begin Phase 1 (Local Testing)
