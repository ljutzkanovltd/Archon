# Data Retention Policy for Task History

## Overview

This document outlines the data retention strategy for the `archon_task_history` table to prevent unbounded growth while preserving important historical data.

## Current Implementation Status

**Phase 0 (Completed):**
- ✅ Task history tracking via PostgreSQL triggers
- ✅ Archive functionality for projects and tasks
- ✅ History API endpoints (`/api/tasks/{id}/history`)
- ✅ UI timeline component for viewing history

**Phase 1 (Future Enhancement):**
- ⏳ Automated cleanup based on retention policy
- ⏳ Configuration via `archon_settings` table
- ⏳ Manual purge functionality

## Proposed Configuration

### Settings Table Entries

Add to `archon_settings` table:

```sql
INSERT INTO archon_settings (key, value, category, description) VALUES
('TASK_HISTORY_RETENTION_DAYS', '365', 'data_management', 'Number of days to retain task history for non-archived tasks (default: 365)'),
('TASK_HISTORY_AUTO_CLEANUP', 'false', 'data_management', 'Enable automatic cleanup of old task history records'),
('TASK_HISTORY_KEEP_ARCHIVED_INDEFINITELY', 'true', 'data_management', 'Keep history for archived tasks indefinitely regardless of retention period');
```

### Retention Rules

1. **Active Tasks**: Keep history for `TASK_HISTORY_RETENTION_DAYS` (default: 365 days)
2. **Archived Tasks**: Keep history indefinitely (regardless of age)
3. **Significant Events**: Always preserve history for:
   - Task creation
   - Task completion (status → done)
   - Task archival
   - Task unarchival

## Implementation Plan

### 1. PostgreSQL Function for Cleanup

```sql
CREATE OR REPLACE FUNCTION purge_old_task_history(
    retention_days INTEGER DEFAULT 365,
    keep_archived BOOLEAN DEFAULT TRUE,
    dry_run BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    deleted_count INTEGER,
    oldest_deleted TIMESTAMPTZ,
    newest_deleted TIMESTAMPTZ
) AS $$
DECLARE
    cutoff_date TIMESTAMPTZ;
    result_count INTEGER;
    oldest_ts TIMESTAMPTZ;
    newest_ts TIMESTAMPTZ;
BEGIN
    cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;

    -- Count records that would be deleted
    SELECT COUNT(*), MIN(changed_at), MAX(changed_at)
    INTO result_count, oldest_ts, newest_ts
    FROM archon_task_history h
    WHERE changed_at < cutoff_date
      AND (NOT keep_archived OR NOT EXISTS (
          SELECT 1 FROM archon_tasks t
          WHERE t.id = h.task_id AND t.archived = true
      ))
      -- Preserve significant events
      AND NOT (field_name = 'status' AND new_value = 'done')
      AND NOT (field_name = 'archived' AND new_value = 'true');

    -- Delete if not dry run
    IF NOT dry_run THEN
        DELETE FROM archon_task_history h
        WHERE changed_at < cutoff_date
          AND (NOT keep_archived OR NOT EXISTS (
              SELECT 1 FROM archon_tasks t
              WHERE t.id = h.task_id AND t.archived = true
          ))
          AND NOT (field_name = 'status' AND new_value = 'done')
          AND NOT (field_name = 'archived' AND new_value = 'true');
    END IF;

    RETURN QUERY SELECT result_count, oldest_ts, newest_ts;
END;
$$ LANGUAGE plpgsql;
```

### 2. Python Service Method

Add to `task_service.py`:

```python
def purge_old_task_history(
    self,
    retention_days: int = 365,
    keep_archived: bool = True,
    dry_run: bool = False
) -> tuple[bool, dict[str, Any]]:
    """
    Purge old task history records based on retention policy.

    Args:
        retention_days: Number of days to retain history (default: 365)
        keep_archived: Keep history for archived tasks indefinitely (default: True)
        dry_run: Preview what would be deleted without actually deleting (default: False)

    Returns:
        Tuple of (success, result_dict) with deletion statistics
    """
    try:
        result = self.supabase_client.rpc(
            "purge_old_task_history",
            {
                "retention_days": retention_days,
                "keep_archived": keep_archived,
                "dry_run": dry_run
            }
        ).execute()

        if result.data:
            stats = result.data[0] if result.data else {}
            return True, {
                "deleted_count": stats.get("deleted_count", 0),
                "oldest_deleted": stats.get("oldest_deleted"),
                "newest_deleted": stats.get("newest_deleted"),
                "dry_run": dry_run
            }
        else:
            return False, {"error": "Failed to purge task history"}

    except Exception as e:
        logger.error(f"Error purging task history: {e}")
        return False, {"error": str(e)}
```

### 3. Cron Job (Optional)

For automated cleanup, create a cron job or use a task scheduler:

```bash
# Run monthly at 2 AM on the 1st
0 2 1 * * cd /app && python -m src.server.services.projects.task_service --purge-history
```

Or use systemd timer:

```ini
# /etc/systemd/system/archon-history-cleanup.timer
[Unit]
Description=Archon Task History Cleanup Timer

[Timer]
OnCalendar=monthly
Persistent=true

[Install]
WantedBy=timers.target
```

### 4. API Endpoint

Add to `projects_api.py`:

```python
@router.post("/admin/purge-task-history")
async def purge_task_history(
    retention_days: int = 365,
    dry_run: bool = True
):
    """
    Purge old task history records (admin only).

    Args:
        retention_days: Number of days to retain
        dry_run: Preview mode (default: true for safety)
    """
    task_service = TaskService()
    success, result = task_service.purge_old_task_history(
        retention_days=retention_days,
        keep_archived=True,
        dry_run=dry_run
    )

    if not success:
        raise HTTPException(status_code=500, detail=result.get("error"))

    return result
```

## Monitoring & Alerts

### Metrics to Track

1. **Table Size**: Monitor `archon_task_history` table size
2. **Growth Rate**: Track daily/weekly growth in record count
3. **Cleanup Stats**: Log deletion counts and dates

### Query for Monitoring

```sql
-- Check table size and record counts
SELECT
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE changed_at > NOW() - INTERVAL '30 days') as last_30_days,
    COUNT(*) FILTER (WHERE changed_at > NOW() - INTERVAL '365 days') as last_year,
    MIN(changed_at) as oldest_record,
    MAX(changed_at) as newest_record,
    pg_size_pretty(pg_total_relation_size('archon_task_history')) as table_size
FROM archon_task_history;
```

## Migration Path

### Step 1: Add Settings (Immediate)
```bash
# Run SQL to add retention settings to archon_settings
psql -d archon -f migrations/add_retention_settings.sql
```

### Step 2: Create Purge Function (Immediate)
```bash
# Deploy PostgreSQL function
psql -d archon -f migrations/create_purge_function.sql
```

### Step 3: Manual Testing (Before Automation)
```bash
# Test with dry_run=true
curl -X POST http://localhost:8181/api/admin/purge-task-history?dry_run=true&retention_days=365
```

### Step 4: Enable Automation (Optional)
```bash
# Configure cron job or systemd timer
sudo systemctl enable archon-history-cleanup.timer
sudo systemctl start archon-history-cleanup.timer
```

## Best Practices

1. **Always Start with Dry Run**: Test purge logic before actual deletion
2. **Backup Before Purge**: Take database snapshot before first purge
3. **Monitor Table Growth**: Set up alerts if table grows beyond expected size
4. **Preserve Significant Events**: Never delete completion/archival history
5. **Document Retention Policy**: Include in operational runbook

## Rollback Plan

If purge causes issues:

1. Disable auto-cleanup: `UPDATE archon_settings SET value='false' WHERE key='TASK_HISTORY_AUTO_CLEANUP'`
2. Restore from backup if data was incorrectly deleted
3. Adjust retention period: `UPDATE archon_settings SET value='730' WHERE key='TASK_HISTORY_RETENTION_DAYS'`

## Future Enhancements

- **Archival to Cold Storage**: Move old history to cheaper storage (S3, etc.)
- **Compression**: Compress old history records
- **Analytics**: Export history for business intelligence before purge
- **User Preferences**: Allow per-project retention policies

---

**Status**: Phase 0 Complete (Infrastructure Ready) | Phase 1 Pending (Automated Cleanup)
**Last Updated**: 2025-12-21
**Owner**: Platform Team
