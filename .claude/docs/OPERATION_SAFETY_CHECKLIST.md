# Operation Safety Checklist

**Version:** 1.0.0
**Last Updated:** 2026-01-13
**Purpose:** Prevent dangerous operations without proper safeguards

---

## Quick Reference: Before ANY Command

### Step 1: Scan for Trigger Keywords

Does your command contain ANY of these?

**Database Operations:**
- `DELETE`, `TRUNCATE`, `DROP`, `ALTER TABLE`, `UPDATE` (with broad WHERE)

**Docker Operations:**
- `docker restart`, `docker stop`, `docker-compose down`, `docker rm`, `docker volume rm`

**Filesystem Operations:**
- `rm -rf` (>10 files), `chmod -R`, `chown -R`

**Git Operations:**
- `git push --force`, `git reset --hard`, `git rebase`, `git clean -fdx`

**If YES → Go to Step 2**
**If NO → Safe to proceed (read-only operations)**

---

### Step 2: Complete Mandatory Checklist

**ALL checkboxes must be checked before executing:**

```
DANGEROUS OPERATION CHECKLIST

Command to execute: _________________________________

[ ] 1. Classified operation risk level (CRITICAL/HIGH/SAFE)
[ ] 2. Created backup using scripts/pre-dangerous-operation-backup.sh
[ ] 3. Verified backup file exists and size > 0
[ ] 4. Documented what will be modified/deleted/restarted
[ ] 5. Identified recovery procedure if operation fails
[ ] 6. Described operation to user with approval template
[ ] 7. Received EXPLICIT user approval (saw "YES" or "APPROVED")
[ ] 8. For CRITICAL: Got SECOND approval after re-stating operation

Status: [ ] APPROVED TO PROCEED  [ ] BLOCKED - Missing checklist items
```

---

### Step 3: Use Approval Template

**Copy-paste this template to user:**

```
⚠️ DANGEROUS OPERATION APPROVAL REQUIRED

**Operation:** [DELETE FROM/docker restart/rm -rf/etc]
**Command:** [exact command to be executed]
**Risk Level:** [CRITICAL ⛔ / HIGH RISK ⚠️]
**What will be affected:**
  - [e.g., "5 test user records in archon_users table"]
  - [e.g., "archon-server container will restart (15 sec downtime)"]

**Backup Status:**
  - Location: /tmp/archon-backup/pre-op-20260113_152030.sql.gz
  - Size: 45 MB
  - Created: 2026-01-13 15:20:30

**Recovery Procedure:**
  - If operation fails: [steps to restore]
  - Restore command: [e.g., gunzip < backup.sql.gz | docker exec -i supabase-ai-db psql -U postgres]

**Do you approve this operation? (YES/NO required)**
```

**Wait for explicit "YES" or "APPROVED" response before proceeding.**

---

## Operation Classification Guide

### ⛔ CRITICAL (Backup + Double Approval)

**Characteristics:**
- Affects production data permanently
- Cascading deletions (CASCADE keyword)
- System-wide impacts
- Difficult/impossible to recover without backup

**Examples:**
```bash
# Database - CRITICAL
DROP TABLE archon_users CASCADE;
TRUNCATE archon_projects CASCADE;
DELETE FROM archon_users WHERE created_at < NOW();  # Broad WHERE

# Docker - CRITICAL
docker-compose down -v  # Removes volumes
docker system prune --volumes  # System-wide cleanup

# Git - CRITICAL
git push --force origin main  # Force push to protected branch
git reset --hard HEAD~10  # Lose 10 commits permanently

# Filesystem - CRITICAL
rm -rf ~/Documents/Projects  # Mass deletion
rm -rf /  # System-wide deletion
```

**Protocol:**
1. Create backup
2. Get first approval with full details
3. Re-state operation and get SECOND approval
4. Only then execute

---

### ⚠️ HIGH RISK (Backup + Single Approval)

**Characteristics:**
- Affects specific data/services
- Recoverable but requires effort
- Service interruption (restarts)
- Specific WHERE clauses (limited scope)

**Examples:**
```bash
# Database - HIGH RISK
DELETE FROM archon_users WHERE email = 'test@example.com';  # Specific WHERE
UPDATE archon_tasks SET status = 'done' WHERE project_id = 'xxx';  # >100 rows
ALTER TABLE archon_users ADD COLUMN test_col VARCHAR(50);  # Schema change

# Docker - HIGH RISK
docker restart archon-server  # Service restart (downtime)
docker stop archon-mcp  # Stop specific service
docker volume rm archon_data  # Remove specific volume

# Git - HIGH RISK
git push --force origin feature-branch  # Force push non-protected
git rebase main  # Rebase on shared branch
git clean -fdx  # Clean working directory

# Filesystem - HIGH RISK
rm -rf /tmp/archon-test-data/*  # Delete 50+ test files
chmod -R 777 ~/Documents/Projects/archon  # Mass permission change
```

**Protocol:**
1. Create backup
2. Get single approval with full details
3. Execute

---

### ✅ SAFE (No Approval Needed)

**Characteristics:**
- Read-only operations
- No state modification
- No service interruption
- Easily reversible

**Examples:**
```bash
# Database - SAFE
SELECT * FROM archon_users WHERE email = 'test@example.com';
SELECT COUNT(*) FROM archon_projects;

# Docker - SAFE
docker ps
docker logs archon-server
docker stats archon-mcp

# Git - SAFE
git status
git log --oneline -10
git diff HEAD~1

# Filesystem - SAFE
ls -lah /tmp/archon-backup/
cat README.md
grep "CRITICAL" CLAUDE.md
```

**Protocol:** Proceed immediately

---

## Backup Commands

### Full Archon Backup (Recommended)

```bash
cd ~/Documents/Projects/archon
bash scripts/pre-dangerous-operation-backup.sh

# This creates:
# - Full database dump
# - Timestamped filename
# - Compressed with gzip
# - Location: /tmp/archon-backup/pre-op-YYYYMMDD_HHMMSS.sql.gz
```

### Quick Manual Backup

```bash
BACKUP_FILE="/tmp/archon-backup/pre-op-$(date +%Y%m%d_%H%M%S).sql"
mkdir -p /tmp/archon-backup
docker exec supabase-ai-db pg_dump -U postgres -d postgres | gzip > "$BACKUP_FILE.gz"
ls -lh "$BACKUP_FILE.gz"  # Verify size > 0
echo "Backup created: $BACKUP_FILE.gz"
```

### Verify Backup

```bash
# Check file exists and size
ls -lh /tmp/archon-backup/pre-op-*.sql.gz

# Check content (first 10 lines)
gunzip -c /tmp/archon-backup/pre-op-20260113_152030.sql.gz | head -10

# Expected: Should see PostgreSQL dump header
```

---

## Recovery Procedures

### Restore from Backup

```bash
# Find latest backup
ls -lt /tmp/archon-backup/

# Restore full database
gunzip -c /tmp/archon-backup/pre-op-20260113_152030.sql.gz | \
  docker exec -i supabase-ai-db psql -U postgres -d postgres

# Verify restoration
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_users;"
```

### Restart Services After Recovery

```bash
cd ~/Documents/Projects/archon
docker restart archon-server archon-mcp archon-ui
sleep 5
docker ps --filter "name=archon"  # Verify all healthy
```

---

## Common Scenarios & Examples

### Scenario 1: Delete Test User

**Incorrect (VIOLATION):**
```bash
# ❌ NO BACKUP
# ❌ NO APPROVAL
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "DELETE FROM archon_users WHERE email = 'test@example.com';"
```

**Correct:**
```bash
# ✅ Step 1: Create backup
cd ~/Documents/Projects/archon
bash scripts/pre-dangerous-operation-backup.sh
# Output: Backup created at /tmp/archon-backup/pre-op-20260113_152030.sql.gz (45 MB)

# ✅ Step 2: Request approval from user
# [Present approval template with details]

# ✅ Step 3: Wait for "YES" or "APPROVED"

# ✅ Step 4: Only after approval, execute
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "DELETE FROM archon_users WHERE email = 'test@example.com';"
```

---

### Scenario 2: Restart Docker Service

**Incorrect (VIOLATION):**
```bash
# ❌ NO APPROVAL
docker restart archon-server
```

**Correct:**
```bash
# ✅ Step 1: Create backup
bash scripts/pre-dangerous-operation-backup.sh

# ✅ Step 2: Request approval
# [Present template]

# ✅ Step 3: After approval
docker restart archon-server
sleep 5
docker ps --filter "name=archon-server"  # Verify healthy
```

---

### Scenario 3: Clean Test Data (Multiple Tables)

**Incorrect (VIOLATION):**
```bash
# ❌ NO BACKUP
# ❌ NO APPROVAL
# ❌ CASCADING DELETES
docker exec supabase-ai-db psql -U postgres -d postgres -c "
DELETE FROM archon_organization_members WHERE user_id IN (...);
DELETE FROM archon_user_profiles WHERE user_id IN (...);
DELETE FROM archon_organizations WHERE owner_id IN (...);
DELETE FROM archon_users WHERE email LIKE '%test%';
"
```

**Correct:**
```bash
# ✅ Step 1: Backup
bash scripts/pre-dangerous-operation-backup.sh

# ✅ Step 2: Document operation
# Operation: DELETE test users and related data (4 tables)
# Risk: HIGH RISK (specific WHERE, multiple tables)
# Impact: ~5 test users + profiles + orgs + memberships

# ✅ Step 3: Request approval with template

# ✅ Step 4: After approval, execute
docker exec supabase-ai-db psql -U postgres -d postgres -c "
BEGIN;
DELETE FROM archon_organization_members WHERE user_id IN (
  SELECT id FROM archon_users WHERE email LIKE '%test%'
);
DELETE FROM archon_user_profiles WHERE user_id IN (
  SELECT id FROM archon_users WHERE email LIKE '%test%'
);
DELETE FROM archon_organizations WHERE owner_id IN (
  SELECT id FROM archon_users WHERE email LIKE '%test%'
);
DELETE FROM archon_users WHERE email LIKE '%test%';
COMMIT;
"

# ✅ Step 5: Verify success
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) FROM archon_users WHERE email LIKE '%test%';"
# Expected: 0
```

---

## Testing the Protocol

### Self-Test: Before Running Command

Ask yourself these questions:

1. **Does my command modify state?**
   - Changes database? → YES, dangerous
   - Restarts service? → YES, dangerous
   - Reads only? → NO, safe

2. **Did I create a backup?**
   - YES → Continue
   - NO → STOP, create backup first

3. **Did I get user approval?**
   - YES with explicit "YES/APPROVED" → Continue
   - NO → STOP, request approval

4. **Can I recover if this fails?**
   - YES, I have backup & restore procedure → Continue
   - NO → STOP, document recovery first

**If ALL answers are correct → Safe to proceed**

---

## Protocol Enforcement

### How to Enforce This Protocol

1. **Read CLAUDE.md Section**: The improved dangerous operations section includes the checklist trigger keywords
2. **Before EVERY command**: Mentally scan for trigger keywords
3. **When triggered**: Stop, complete checklist, request approval
4. **No exceptions**: Even for "test data" or "development" environments

### Why This Matters

**Real incident that established this protocol:**
- Production database was dropped without backup
- Caused several hours of downtime
- Lost development work
- Required emergency recovery procedures

**This protocol prevents:**
- Data loss
- Service interruption without warning
- Difficult recovery situations
- User frustration

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│           OPERATION SAFETY QUICK REFERENCE                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  TRIGGER KEYWORDS (STOP if you see these):                   │
│  • DELETE, DROP, TRUNCATE, UPDATE (broad)                    │
│  • docker restart, docker stop, docker-compose down          │
│  • rm -rf (>10 files), chmod -R                              │
│  • git push --force, git reset --hard                        │
│                                                               │
│  MANDATORY BEFORE PROCEEDING:                                │
│  1. Create backup: bash scripts/pre-dangerous-operation...   │
│  2. Verify backup: ls -lh /tmp/archon-backup/*.sql.gz        │
│  3. Describe operation to user (use template)                │
│  4. Get EXPLICIT approval ("YES" or "APPROVED")              │
│  5. For CRITICAL: Get SECOND approval                        │
│                                                               │
│  APPROVAL TEMPLATE:                                          │
│    ⚠️ DANGEROUS OPERATION APPROVAL REQUIRED                  │
│    Operation: [what]                                         │
│    Command: [exact command]                                  │
│    Risk: [CRITICAL/HIGH RISK]                                │
│    Backup: [location + size]                                 │
│    Do you approve? (YES/NO)                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

**Related Documentation:**
- `@.claude/CLAUDE.md` - Main protocol section
- `@.claude/docs/DANGEROUS_OPERATIONS.md` - Complete examples & hooks
- `@.claude/docs/BACKUP_PROCEDURES.md` - Backup automation & recovery

**Version History:**
- v1.0.0 (2026-01-13) - Initial checklist creation after protocol violations
