# Dangerous Operations Protocol - Complete Implementation Guide

This document provides comprehensive implementation details for the Dangerous Operations Protocol. For quick reference, see the condensed rules in the main CLAUDE.md file.

---

## Overview: Why This Protocol Exists

This protocol was established after a critical incident where the remote Supabase Cloud database schema was dropped without backup or approval, causing production downtime and data loss.

**The incident revealed**:
- Dangerous operations were documented but not enforced in tooling
- Backup procedures existed but weren't mandatory
- Approval workflows were suggested but not required
- Recovery procedures were untested

**This protocol is MANDATORY** - violations are unacceptable and trigger immediate review.

---

## RULE 1: BACKUP FIRST - NO EXCEPTIONS

### Core Principle

**BEFORE executing ANY dangerous operation, you MUST**:
1. Create a timestamped backup
2. Verify backup integrity
3. Document backup location

### Backup Procedures by Operation Type

#### Database Operations (HIGHEST PRIORITY)

**Recommended: Unified Backup System**
```bash
# MANDATORY before any DROP/TRUNCATE/DELETE operation
# Use the unified backup system (includes ALL databases, volumes, configs)
cd ~/Documents/Projects/archon
bash scripts/pre-dangerous-operation-backup.sh

# This script will:
# 1. Check if a recent backup exists (<1 hour old)
# 2. If not, trigger a new unified backup from local-ai-packaged
# 3. Verify backup integrity (gzip test, size check)
# 4. Return backup path and recovery commands

# Example output:
# BACKUP_PATH=/path/to/backups/unified-backup-20260112-114946
# POSTGRES_BACKUP=/path/to/backups/unified-backup-20260112-114946/databases/postgres.sql.gz
# BACKUP_SIZE=27262976 (27M)
```

**Alternative: Quick Archon-only Backup**
```bash
# For rapid testing or if unified backup is unavailable
BACKUP_FILE="/tmp/archon-backup/pre-operation-$(date +%Y%m%d_%H%M%S).sql"
mkdir -p /tmp/archon-backup
docker exec supabase-ai-db pg_dump -U postgres -d postgres | gzip > "$BACKUP_FILE.gz"
ls -lh "$BACKUP_FILE.gz"  # Verify backup exists and has reasonable size
echo "✅ Backup created: $BACKUP_FILE.gz"
```

**Full Database Backup**
```bash
# Complete database backup with schema and data
BACKUP_DIR="/tmp/archon-backup"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec supabase-ai-db pg_dump -U postgres -d postgres \
  --clean --if-exists > "$BACKUP_DIR/full-backup-$TIMESTAMP.sql"

# Verify backup integrity
ls -lh "$BACKUP_DIR/full-backup-$TIMESTAMP.sql"
head -20 "$BACKUP_DIR/full-backup-$TIMESTAMP.sql"  # Check it's valid SQL
wc -l "$BACKUP_DIR/full-backup-$TIMESTAMP.sql"     # Line count
```

**Specific Table Backup**
```bash
# Faster for single table operations
docker exec supabase-ai-db pg_dump -U postgres -d postgres \
  -t archon_tasks > "$BACKUP_DIR/table-backup-$TIMESTAMP.sql"

# Multiple tables
docker exec supabase-ai-db pg_dump -U postgres -d postgres \
  -t archon_tasks -t archon_projects > "$BACKUP_DIR/tables-backup-$TIMESTAMP.sql"
```

**Schema-Only Backup**
```bash
# For schema changes without data
docker exec supabase-ai-db pg_dump -U postgres -d postgres \
  --schema-only > "$BACKUP_DIR/schema-backup-$TIMESTAMP.sql"
```

#### File System Operations

**Archive Before Deletion**
```bash
# Create compressed archive
BACKUP_DIR="/tmp/archon-backup"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
tar -czf "$BACKUP_DIR/files-backup-$TIMESTAMP.tar.gz" /path/to/files

# Verify archive integrity
tar -tzf "$BACKUP_DIR/files-backup-$TIMESTAMP.tar.gz" | head -20
tar -tzf "$BACKUP_DIR/files-backup-$TIMESTAMP.tar.gz" | wc -l
ls -lh "$BACKUP_DIR/files-backup-$TIMESTAMP.tar.gz"
```

**Incremental Backups**
```bash
# For large directories, use incremental backups
rsync -av --backup --backup-dir="$BACKUP_DIR/incremental-$TIMESTAMP" \
  /source/path/ /backup/path/
```

#### Git Operations

**Backup Branch Before Force Push**
```bash
# Create timestamped backup branch
BACKUP_BRANCH="backup-$(date +%Y%m%d-%H%M%S)"
git branch $BACKUP_BRANCH
git push origin $BACKUP_BRANCH

echo "✅ Backup branch created: $BACKUP_BRANCH"
echo "Recovery: git reset --hard origin/$BACKUP_BRANCH"
```

**Stash Before Reset**
```bash
# Create stash with descriptive message
git stash push -m "Pre-reset backup $(date +%Y%m%d-%H%M%S)" --include-untracked

# List stashes
git stash list

echo "✅ Stash created"
echo "Recovery: git stash apply stash@{0}"
```

#### Docker Operations

**Backup Volumes Before Deletion**
```bash
# Export volume to tarball
VOLUME_NAME="archon-data"
BACKUP_DIR="/tmp/archon-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

docker run --rm \
  -v $VOLUME_NAME:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/volume-$VOLUME_NAME-$TIMESTAMP.tar.gz /data

# Verify backup
ls -lh "$BACKUP_DIR/volume-$VOLUME_NAME-$TIMESTAMP.tar.gz"
```

**Container Export**
```bash
# Export container state
CONTAINER_NAME="archon-mcp-server"
docker export $CONTAINER_NAME > "$BACKUP_DIR/container-$CONTAINER_NAME-$TIMESTAMP.tar"
```

---

## RULE 2: DOUBLE APPROVAL - ASK TWICE

### Approval Workflow

**BEFORE executing ANY dangerous operation:**

1. **First Approval Request** - Full disclosure
2. **Second Approval Request** - Final confirmation
3. **Only proceed after TWO explicit approvals**

### First Approval Template

```
🚨 DANGEROUS OPERATION DETECTED

I need to execute: [OPERATION DESCRIPTION]

This will:
- ❌ [Impact 1]
- ❌ [Impact 2]
- ❌ [Impact 3]
- ❌ [Production impact if applicable]

Backup created:
✅ [BACKUP_PATH] ([SIZE])

Recovery procedure:
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Verification]

Do you approve this operation? (First approval - I will ask again for confirmation)
```

### Second Approval Template

```
⚠️ FINAL CONFIRMATION REQUIRED

Operation: [OPERATION IN BOLD]

Risks:
- [Risk 1]
- [Risk 2]
- [Risk 3]

This action is IRREVERSIBLE without restore.

Are you CERTAIN you want to proceed? (Type 'YES, PROCEED' to confirm)
```

### Example: Database Schema Drop

```
🚨 DANGEROUS OPERATION DETECTED

I need to execute: DROP SCHEMA public CASCADE on remote Supabase Cloud database

This will:
- ❌ Delete ALL tables in the public schema
- ❌ Delete ALL data in those tables (PERMANENT DATA LOSS)
- ❌ Delete ALL indexes, constraints, and functions
- ❌ Affect production services immediately

Backup created:
✅ /tmp/archon-backup/pre-drop-20260112_105800.sql (104 MB)

Recovery procedure:
1. Stop affected services: ./stop-archon.sh
2. Restore database: psql < /tmp/archon-backup/pre-drop-20260112_105800.sql
3. Restart services: ./start-archon.sh
4. Verify data integrity: SELECT COUNT(*) FROM archon_tasks

Do you approve this operation? (First approval - I will ask again for confirmation)

[WAIT FOR USER RESPONSE]

---

⚠️ FINAL CONFIRMATION REQUIRED

Operation: DROP SCHEMA public CASCADE on production database

Risks:
- Permanent data loss if backup fails
- Service downtime during recovery (estimated 10-15 minutes)
- Potential data inconsistency if partial recovery

This action is IRREVERSIBLE without restore.

Are you CERTAIN you want to proceed? (Type 'YES, PROCEED' to confirm)
```

---

## RULE 3: DANGEROUS OPERATIONS REGISTRY

### Database Operations (HIGHEST RISK)

**⛔ CRITICAL - Always Require Backup + Double Approval**:
- `DROP SCHEMA ... CASCADE`
- `DROP DATABASE`
- `DROP TABLE ... CASCADE`
- `TRUNCATE ... CASCADE`
- `DELETE FROM ... WHERE` (without very specific WHERE clause)

**⚠️ HIGH RISK - Require Backup + Single Approval**:
- `UPDATE ... SET` (affecting >100 rows)
- `ALTER TABLE` (schema changes in production)
- `CREATE INDEX CONCURRENTLY` (can lock tables)
- `REINDEX` (locks table)
- `VACUUM FULL` (locks table)

**Examples of Safe vs Unsafe**:
```sql
-- UNSAFE (requires protocol)
DELETE FROM archon_tasks;
DELETE FROM archon_tasks WHERE status = 'done';

-- SAFE (specific WHERE)
DELETE FROM archon_tasks WHERE id = 'abc-123-def';

-- UNSAFE (affects many rows)
UPDATE archon_tasks SET status = 'todo';

-- SAFE (single row)
UPDATE archon_tasks SET status = 'doing' WHERE id = 'abc-123-def';
```

### File System Operations

**⛔ CRITICAL**:
- `rm -rf /` or `rm -rf /*`
- `rm -rf ~` or `rm -rf ~/Documents`
- `rm -rf ~/Documents/Projects` (workspace root)

**⚠️ HIGH RISK**:
- `rm -rf` (any directory with >100 files)
- `rm` (production data directories: /var/lib, /opt, etc.)
- Deletion of `.env` files or configuration
- `chmod -R 777` (security risk)
- `chown -R` (can break permissions)

**Examples**:
```bash
# UNSAFE (requires protocol)
rm -rf ~/Documents/Projects/archon/.claude

# SAFE (specific file)
rm ~/Documents/Projects/archon/.claude/CLAUDE.md.bak

# UNSAFE (many files)
find . -name "*.log" -delete  # If >100 files

# SAFE (specific pattern, few files)
rm archon-*.log  # If <10 files
```

### Git Operations

**⛔ CRITICAL**:
- `git push --force` to main/master/production branches
- `git reset --hard` (uncommitted changes exist)
- `git clean -fdx` (untracked files exist)

**⚠️ HIGH RISK**:
- `git rebase` on shared branches
- `git push --force` to any branch
- `git filter-branch` or `git filter-repo`

**Safe Alternatives**:
```bash
# Instead of: git push --force origin main
git push --force-with-lease origin main  # Safer

# Instead of: git reset --hard HEAD~1
git reset --soft HEAD~1  # Preserves changes

# Instead of: git clean -fdx
git clean -n  # Dry run first
```

### Docker Operations

**⛔ CRITICAL**:
- `docker-compose down -v` (deletes volumes permanently)
- `docker system prune -a --volumes`
- `docker volume rm` (production volumes)

**⚠️ HIGH RISK**:
- `docker-compose down` (production services)
- `docker rm -f` (running production containers)
- `docker network rm` (active networks)

**Examples**:
```bash
# UNSAFE (deletes all volumes)
docker-compose down -v

# SAFE (stops but preserves data)
docker-compose stop

# UNSAFE (removes everything)
docker system prune -a --volumes

# SAFER (interactive confirmation)
docker system prune  # Without --volumes
```

### System Operations

**⛔ CRITICAL**:
- `killall` or `pkill` (can affect other services)
- `systemctl stop docker` (affects all containers)
- Modification of `/etc` config files

**⚠️ HIGH RISK**:
- Service restarts during business hours
- Firewall rule changes
- Network interface changes

---

## RULE 4: Backup Verification

### Verification Checklist

After creating backup, ALWAYS verify:

```bash
# 1. File exists and has content
ls -lh "$BACKUP_FILE"
# Should show size > 0

# 2. File is readable
head -20 "$BACKUP_FILE"
# Should show valid content (SQL, tar listing, etc.)

# 3. Backup location is persistent
df -h "$BACKUP_DIR"
# Should NOT be /tmp for critical operations (cleared on reboot)

# 4. For SQL: Check it's valid
grep -c "CREATE TABLE" "$BACKUP_FILE"  # Should show table count
grep -c "INSERT INTO" "$BACKUP_FILE"   # Should show data inserts

# 5. For archives: Check integrity
tar -tzf "$BACKUP_FILE.tar.gz" | wc -l  # Should show file count
gzip -t "$BACKUP_FILE.gz"               # Should exit 0 (no errors)
```

### Backup Location Best Practices

**For testing/development**:
- `/tmp/archon-backup/` - OK for quick operations
- Auto-cleanup: Cleared on reboot

**For production/critical**:
- `~/Documents/Projects/backups/` - Persistent
- External drive: `/mnt/backup/`
- Cloud storage: `s3://backups/`

---

## RULE 5: RECOVERY PROCEDURES

### Database Recovery

#### From Unified Backup (RECOMMENDED)

```bash
# Stop services to prevent partial state
cd ~/Documents/Projects/archon
./stop-archon.sh

# Restore from unified backup
BACKUP_PATH="/path/to/backups/unified-backup-TIMESTAMP"  # From pre-dangerous-operation-backup.sh
gunzip -c "${BACKUP_PATH}/databases/postgres.sql.gz" | \
  docker exec -i supabase-ai-db psql -U postgres -d postgres

# Verify restoration
docker exec supabase-ai-db psql -U postgres -d postgres -c "\dt" | grep archon | wc -l
# Should show ~22 archon tables

docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_tasks"
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_projects"

# Restart services
./start-archon.sh

# Verify functionality
curl http://localhost:8181/health
# Expected: {"status":"healthy","service":"archon-api"}

curl http://localhost:8051/health
# Expected: {"status":"healthy","service":"archon-mcp"}

# Test database connectivity
docker exec supabase-ai-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_settings"
# Should return setting count (e.g., 81 rows)
```

#### From Quick Backup

```bash
# If using quick Archon-only backup
./stop-archon.sh

# Restore
gunzip -c /tmp/archon-backup/pre-operation-TIMESTAMP.sql.gz | \
  docker exec -i supabase-ai-db psql -U postgres -d postgres

# Verification steps (same as above)
./start-archon.sh
curl http://localhost:8181/health
```

#### Partial Recovery (Specific Tables)

```bash
# Extract specific table from backup
pg_restore -U postgres -d postgres -t archon_tasks /path/to/backup.sql

# Or from SQL dump
grep -A 1000 "CREATE TABLE archon_tasks" backup.sql > tasks-only.sql
psql -U postgres -d postgres < tasks-only.sql
```

### File System Recovery

```bash
# Extract backup archive
tar -xzf /tmp/archon-backup/files-backup-TIMESTAMP.tar.gz -C /target/directory

# Verify restoration
ls -la /target/directory
diff -r /target/directory /original/directory  # Compare if original still exists

# Restore permissions if needed
chmod -R 755 /target/directory
chown -R user:group /target/directory
```

### Git Recovery

#### From Backup Branch

```bash
# Fetch backup branch
git fetch origin backup-TIMESTAMP

# Option 1: Hard reset (loses uncommitted work)
git reset --hard origin/backup-TIMESTAMP

# Option 2: Merge backup (preserves work)
git merge origin/backup-TIMESTAMP

# Verify
git log -3  # Check recent commits
git status  # Check working tree
```

#### From Stash

```bash
# List stashes
git stash list

# Apply most recent
git stash apply stash@{0}

# Or pop (removes from stash list)
git stash pop

# Verify
git status
git diff
```

### Docker Recovery

#### Volume Restoration

```bash
# Restore volume from backup
docker run --rm \
  -v archon-data:/data \
  -v /tmp/archon-backup:/backup \
  alpine sh -c "cd /data && tar xzf /backup/volume-archon-data-TIMESTAMP.tar.gz --strip 1"

# Verify
docker run --rm -v archon-data:/data alpine ls -la /data
```

#### Container Recreation

```bash
# Recreate from backup if needed
docker-compose down
docker-compose up -d

# Or from exported container
docker import container-backup-TIMESTAMP.tar new-container-name
```

---

## RULE 6: SCRIPT CREATION PROTOCOL

### Required Integration Checklist

All scripts that perform dangerous operations MUST:

1. **Pre-Operation Backup Hook**
   - Call `pre-dangerous-operation-backup.sh`
   - Verify backup exists and is valid
   - Fail if backup creation fails

2. **Double Approval Mechanism**
   - Implement two separate approval prompts
   - NO `--skip-confirm` or `--force` flags that bypass BOTH approvals
   - MAY provide `--skip-first-confirm` but MUST require final confirmation

3. **Dangerous Pattern Detection**
   - Check for patterns in RULE 3 registry
   - Block execution without proper backup
   - Log all dangerous operations

4. **Recovery Documentation**
   - Output recovery commands if operation fails
   - Document backup location prominently
   - Provide rollback instructions

5. **Dry-Run Mode**
   - Provide `--dry-run` flag that WORKS
   - Show what would execute without executing
   - Thoroughly test dry-run mode

### Bash Script Template

```bash
#!/bin/bash
# dangerous-operation-template.sh
# Template for scripts that perform dangerous operations

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Script metadata
SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Configuration
BACKUP_DIR="/tmp/archon-backup"
DRY_RUN=false
SKIP_FIRST_CONFIRM=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Usage function
usage() {
  cat << EOF
Usage: $SCRIPT_NAME [OPTIONS]

Perform dangerous operation with safety checks.

OPTIONS:
  --dry-run              Show what would be executed without executing
  --skip-first-confirm   Skip first approval (still requires final confirmation)
  -h, --help             Show this help message

SAFETY:
  - Creates timestamped backup before execution
  - Requires double approval (cannot be skipped)
  - Verifies backup integrity
  - Provides recovery instructions
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-first-confirm)
      SKIP_FIRST_CONFIRM=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

# Logging functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup with verification
create_backup_with_verification() {
  log_info "Creating backup..."

  # Call unified backup script
  if [[ -f "$SCRIPT_DIR/pre-dangerous-operation-backup.sh" ]]; then
    bash "$SCRIPT_DIR/pre-dangerous-operation-backup.sh"
    if [[ $? -ne 0 ]]; then
      log_error "Backup failed - aborting operation"
      exit 1
    fi
  else
    # Fallback: Create quick backup
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/pre-$SCRIPT_NAME-$TIMESTAMP.sql"

    docker exec supabase-ai-db pg_dump -U postgres -d postgres | gzip > "$BACKUP_FILE.gz"

    # Verify backup
    if [[ ! -f "$BACKUP_FILE.gz" ]] || [[ ! -s "$BACKUP_FILE.gz" ]]; then
      log_error "Backup verification failed - file missing or empty"
      exit 1
    fi

    # Test gzip integrity
    if ! gzip -t "$BACKUP_FILE.gz" 2>/dev/null; then
      log_error "Backup verification failed - corrupted gzip"
      exit 1
    fi

    BACKUP_SIZE=$(stat -f%z "$BACKUP_FILE.gz" 2>/dev/null || stat -c%s "$BACKUP_FILE.gz")
    log_info "Backup created: $BACKUP_FILE.gz ($BACKUP_SIZE bytes)"
  fi
}

# First approval request
request_first_approval() {
  if [[ "$SKIP_FIRST_CONFIRM" == "true" ]]; then
    log_warning "Skipping first approval (--skip-first-confirm)"
    return 0
  fi

  echo ""
  echo "🚨 DANGEROUS OPERATION DETECTED"
  echo ""
  echo "I need to execute: [DESCRIBE OPERATION HERE]"
  echo ""
  echo "This will:"
  echo "- ❌ [Impact 1]"
  echo "- ❌ [Impact 2]"
  echo "- ❌ [Impact 3]"
  echo ""
  echo "Backup created:"
  echo "✅ $BACKUP_FILE.gz ($BACKUP_SIZE bytes)"
  echo ""
  echo "Recovery procedure:"
  echo "1. Stop services: ./stop-archon.sh"
  echo "2. Restore: gunzip -c $BACKUP_FILE.gz | docker exec -i supabase-ai-db psql -U postgres -d postgres"
  echo "3. Restart: ./start-archon.sh"
  echo ""

  read -p "First approval - Continue? (yes/no): " response
  if [[ "$response" != "yes" ]]; then
    log_info "Operation cancelled by user"
    exit 0
  fi
}

# Second approval request (MANDATORY - cannot be skipped)
request_final_approval() {
  echo ""
  echo "⚠️  FINAL CONFIRMATION REQUIRED"
  echo ""
  echo "Operation: [OPERATION IN BOLD]"
  echo ""
  echo "Risks:"
  echo "- Permanent data loss if backup fails"
  echo "- Service downtime during recovery"
  echo "- Potential data inconsistency"
  echo ""
  echo "This action is IRREVERSIBLE without restore."
  echo ""

  read -p "Are you CERTAIN? Type 'I UNDERSTAND THE RISK': " response
  if [[ "$response" != "I UNDERSTAND THE RISK" ]]; then
    log_info "Operation cancelled - confirmation not received"
    exit 0
  fi
}

# Execute dangerous operation
execute_dangerous_operation() {
  if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY RUN] Would execute:"
    echo "  docker exec supabase-ai-db psql -U postgres -d postgres -c 'DROP SCHEMA public CASCADE'"
    return 0
  fi

  log_info "Executing dangerous operation..."

  # REPLACE THIS WITH ACTUAL OPERATION
  # docker exec supabase-ai-db psql -U postgres -d postgres -c "DROP SCHEMA public CASCADE"

  if [[ $? -eq 0 ]]; then
    log_info "Operation completed successfully"
  else
    log_error "Operation failed!"
    echo ""
    echo "Recovery instructions:"
    echo "1. ./stop-archon.sh"
    echo "2. gunzip -c $BACKUP_FILE.gz | docker exec -i supabase-ai-db psql -U postgres -d postgres"
    echo "3. ./start-archon.sh"
    exit 1
  fi
}

# Main execution
main() {
  log_info "Starting $SCRIPT_NAME"

  if [[ "$DRY_RUN" == "true" ]]; then
    log_warning "DRY RUN MODE - no changes will be made"
  fi

  # Always create backup (even in dry-run for testing)
  create_backup_with_verification

  # Always get approvals
  request_first_approval
  request_final_approval

  # Execute operation
  execute_dangerous_operation

  log_info "Script completed"
}

# Run main
main "$@"
```

### Python Script Template

```python
#!/usr/bin/env python3
"""
Dangerous operation template for Python scripts.
Implements full Dangerous Operations Protocol.
"""

import os
import sys
import subprocess
import argparse
from datetime import datetime
from pathlib import Path

class DangerousOperationScript:
    """Template for scripts that perform dangerous operations."""

    def __init__(self, dry_run=False, skip_first_confirm=False):
        self.dry_run = dry_run
        self.skip_first_confirm = skip_first_confirm
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.backup_dir = Path("/tmp/archon-backup")
        self.backup_file = None

    def create_backup(self):
        """Create and verify backup."""
        print("ℹ️  Creating backup...")

        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.backup_file = self.backup_dir / f"pre-operation-{self.timestamp}.sql.gz"

        # Create backup
        cmd = [
            "docker", "exec", "supabase-ai-db",
            "pg_dump", "-U", "postgres", "-d", "postgres"
        ]

        try:
            with open(self.backup_file, "wb") as f:
                proc = subprocess.run(cmd, stdout=subprocess.PIPE, check=True)
                subprocess.run(["gzip"], input=proc.stdout, stdout=f, check=True)
        except subprocess.CalledProcessError as e:
            print(f"❌ Backup failed: {e}")
            sys.exit(1)

        # Verify backup
        if not self.backup_file.exists() or self.backup_file.stat().st_size == 0:
            print("❌ Backup verification failed - file missing or empty")
            sys.exit(1)

        # Test gzip integrity
        try:
            subprocess.run(["gzip", "-t", str(self.backup_file)], check=True)
        except subprocess.CalledProcessError:
            print("❌ Backup verification failed - corrupted gzip")
            sys.exit(1)

        size = self.backup_file.stat().st_size
        print(f"✅ Backup created: {self.backup_file} ({size} bytes)")

    def request_first_approval(self):
        """Request first approval from user."""
        if self.skip_first_confirm:
            print("⚠️  Skipping first approval (--skip-first-confirm)")
            return

        print("\n🚨 DANGEROUS OPERATION DETECTED\n")
        print("I need to execute: [DESCRIBE OPERATION]\n")
        print("This will:")
        print("- ❌ [Impact 1]")
        print("- ❌ [Impact 2]")
        print("- ❌ [Impact 3]\n")
        print(f"Backup created:\n✅ {self.backup_file}\n")
        print("Recovery procedure:")
        print("1. Stop services: ./stop-archon.sh")
        print(f"2. Restore: gunzip -c {self.backup_file} | docker exec -i supabase-ai-db psql -U postgres -d postgres")
        print("3. Restart: ./start-archon.sh\n")

        response = input("First approval - Continue? (yes/no): ")
        if response != "yes":
            print("Operation cancelled by user")
            sys.exit(0)

    def request_final_approval(self):
        """Request final approval (MANDATORY)."""
        print("\n⚠️  FINAL CONFIRMATION REQUIRED\n")
        print("Operation: [OPERATION IN BOLD]\n")
        print("Risks:")
        print("- Permanent data loss if backup fails")
        print("- Service downtime during recovery")
        print("- Potential data inconsistency\n")
        print("This action is IRREVERSIBLE without restore.\n")

        response = input("Are you CERTAIN? Type 'I UNDERSTAND THE RISK': ")
        if response != "I UNDERSTAND THE RISK":
            print("Operation cancelled - confirmation not received")
            sys.exit(0)

    def execute_operation(self):
        """Execute the dangerous operation."""
        if self.dry_run:
            print("ℹ️  [DRY RUN] Would execute:")
            print("  [OPERATION DESCRIPTION]")
            return

        print("ℹ️  Executing dangerous operation...")

        # REPLACE WITH ACTUAL OPERATION
        try:
            # Example: subprocess.run(["docker", "exec", ...], check=True)
            pass
        except subprocess.CalledProcessError as e:
            print(f"❌ Operation failed: {e}\n")
            print("Recovery instructions:")
            print("1. ./stop-archon.sh")
            print(f"2. gunzip -c {self.backup_file} | docker exec -i supabase-ai-db psql -U postgres -d postgres")
            print("3. ./start-archon.sh")
            sys.exit(1)

        print("✅ Operation completed successfully")

    def run(self):
        """Main execution flow."""
        if self.dry_run:
            print("⚠️  DRY RUN MODE - no changes will be made")

        self.create_backup()
        self.request_first_approval()
        self.request_final_approval()
        self.execute_operation()


def main():
    parser = argparse.ArgumentParser(
        description="Dangerous operation script with safety checks"
    )
    parser.add_argument("--dry-run", action="store_true",
                       help="Show what would be executed without executing")
    parser.add_argument("--skip-first-confirm", action="store_true",
                       help="Skip first approval (still requires final confirmation)")

    args = parser.parse_args()

    script = DangerousOperationScript(
        dry_run=args.dry_run,
        skip_first_confirm=args.skip_first_confirm
    )
    script.run()


if __name__ == "__main__":
    main()
```

---

## Hook System Implementation

### Hook Structure

Location: `.claude/hooks/`

**Pre-tool-use hooks**:
- `dangerous-operations.sh` - Blocks dangerous patterns
- `backup-verification.sh` - Verifies backup exists
- `approval-tracking.sh` - Enforces double approval

### Hook Configuration

File: `.claude/hooks/config.json`

```json
{
  "hooks": {
    "pre-bash": {
      "enabled": true,
      "script": ".claude/hooks/dangerous-operations.sh",
      "description": "Blocks dangerous bash commands"
    },
    "pre-tool-use": {
      "enabled": true,
      "script": ".claude/hooks/backup-verification.sh",
      "description": "Verifies backup before dangerous operations"
    }
  },
  "dangerous_patterns": {
    "database": [
      "DROP SCHEMA.*CASCADE",
      "DROP DATABASE",
      "TRUNCATE.*CASCADE",
      "DELETE FROM .* WHERE .*"
    ],
    "filesystem": [
      "rm -rf /",
      "rm -rf ~",
      "rm -rf .*Documents/Projects"
    ],
    "git": [
      "git push --force.*main",
      "git push --force.*master",
      "git reset --hard"
    ],
    "docker": [
      "docker-compose down -v",
      "docker system prune.*--volumes"
    ]
  }
}
```

### Example Hook: dangerous-operations.sh

```bash
#!/bin/bash
# .claude/hooks/dangerous-operations.sh
# Pre-tool-use hook to block dangerous operations

COMMAND="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# Load dangerous patterns from config
PATTERNS=$(jq -r '.dangerous_patterns | to_entries[] | .value[]' "$CONFIG_FILE")

# Check if command matches any dangerous pattern
while IFS= read -r pattern; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "🚨 DANGEROUS OPERATION BLOCKED"
    echo ""
    echo "Pattern matched: $pattern"
    echo "Command: $COMMAND"
    echo ""
    echo "This operation requires:"
    echo "1. Create backup first"
    echo "2. Get double approval"
    echo "3. Document recovery procedure"
    echo ""
    echo "See: .claude/docs/DANGEROUS_OPERATIONS.md"
    exit 1
  fi
done <<< "$PATTERNS"

# Allow command if no dangerous patterns matched
exit 0
```

---

## Enforcement & Compliance

### Consequences of Non-Compliance

- ❌ Scripts that bypass this protocol are **REJECTED**
- ❌ Incidents caused by non-compliant scripts trigger immediate protocol review
- ❌ All automation scripts must be audited for compliance

### Audit Checklist

For any script that performs dangerous operations:

- [ ] Calls `pre-dangerous-operation-backup.sh` or creates verified backup
- [ ] Implements double approval (cannot bypass both)
- [ ] Checks for dangerous patterns
- [ ] Provides recovery documentation
- [ ] Has working `--dry-run` mode
- [ ] Logs operations to audit trail
- [ ] Documents backup location
- [ ] Verifies backup integrity
- [ ] Exits with error if backup fails
- [ ] Provides rollback instructions

---

**Last Updated:** 2026-01-12
**Version:** 1.0.0
**Maintainer:** SportERP Team

**Related Documentation:**
- Main CLAUDE.md: `../.claude/CLAUDE.md`
- Backup Procedures: `.claude/docs/BACKUP_PROCEDURES.md`
- Best Practices: `.claude/docs/BEST_PRACTICES.md`
