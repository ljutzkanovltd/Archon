# Archon Database Migration - Project Tracking

**Project ID**: `ea6a11ed-0eaa-4712-b96a-f086cd90fb54`
**Created**: 2026-01-10
**Status**: In Progress (45% complete - 5/11 tasks done)

---

## Quick Access

- **Next.js Dashboard**: http://localhost:3738/projects/ea6a11ed-0eaa-4712-b96a-f086cd90fb54
- **React Dashboard**: http://localhost:3737/projects/ea6a11ed-0eaa-4712-b96a-f086cd90fb54
- **API**: `curl http://localhost:8181/api/projects/ea6a11ed-0eaa-4712-b96a-f086cd90fb54`
- **Migration Guide**: `MIGRATION_CONFIG_SUMMARY.md`

---

## Project Overview

Migrate Archon knowledge base from Supabase Cloud (218k rows) to local Supabase instance with bidirectional sync capability. Includes configuration updates for dual-mode operation (local/remote), interactive database selection, and automated sync setup.

### Goals
- ✅ Enable MODE-based switching between local and remote Supabase
- ⏳ Migrate 218,318 rows from remote to local database
- ⏳ Create vector indexes locally (1536-dimensional embeddings)
- ⏳ Set up periodic sync for backup/consistency
- ✅ Ensure zero disruption to sporterp-apps services (ports 8000, 8069, 3000)

### Architecture
- **Local**: supabase-ai-kong:8000 → localhost:18000, supabase-ai-db:5432
- **Remote**: jnjarcdwwwycjgiyddua.supabase.co (eu-west-2)
- **Network**: sporterp-ai-unified bridge

---

## Task Progress

### ✅ Completed (5 tasks)

**Phase 1: Git Conflict Resolution**
- Task ID: `d406dd74-921b-4b1c-bfa7-5d971f45bfd9`
- Fixed 4 git merge conflicts in docker-compose.yml causing YAML parsing errors

**Phase 2-3: Dual-Mode Configuration**
- Task ID: `e1852e97-dedb-4662-aff7-f1f44ee4b8e4`
- Updated .env with LOCAL_*/REMOTE_* structure
- Added MODE-based auto-selection to start-archon.sh

**Phase 4: Interactive Database Selection**
- Task ID: `81e6917e-6f42-4634-9521-75a53d7b066d`
- Implemented interactive prompt for local/remote choice at startup

**Documentation**
- Task ID: `cb1f43d1-8eb4-4ce8-90cd-e9045c669cba`
- Created comprehensive MIGRATION_CONFIG_SUMMARY.md

**Bugfix: MODE Declaration**
- Task ID: `2d41b241-f0db-47ee-bad8-f7121f2c3d72`
- Removed duplicate MODE declaration from .env

---

### ⏳ Pending (6 tasks)

**Phase 5a: Verify Local Mode Startup**
- Task ID: `3f753f2a-bde6-40ef-9a13-6555b10f0ca4`
- Test startup with interactive database selection
- Verify configuration output

**Phase 5b: Test Local Supabase Connectivity**
- Task ID: `59bbfa44-d081-4480-868f-64ece587923d`
- Verify MCP, API, and database connectivity
- Test Kong API Gateway

**Phase 5c: Verify SportERP Ports Intact**
- Task ID: `3a34d578-1b1b-489e-8246-f4cc20800f60`
- Confirm no port conflicts with FastAPI (8000), Odoo (8069), Next.js (3000)

**Phase 5d: Execute Full Database Migration**
- Task ID: `d3d724a9-9eae-479c-9c88-5c179a631862`
- Clear existing local data (212k old rows)
- Run migrate-cloud-to-local.sh
- Expected: 218,318 rows + 1.7GB vector index

**Phase 5e: Verify Migration Success**
- Task ID: `5cc9fc6b-cbbb-47cc-bb77-a0b138feeab3`
- Validate row counts match
- Confirm vector index exists
- Test search performance (<200ms)

**Phase 6: Set Up Periodic Sync**
- Task ID: `db993e88-e34a-4bc4-a70a-d14321994b0d`
- Test sync-local-to-cloud.sh
- Create cron job for weekly sync
- Document rollback procedure

---

## Next Actions

### 1. Start Archon with Interactive Selection

```bash
cd /home/ljutzkanov/Documents/Projects/archon
./start-archon.sh --skip-nextjs
```

You'll see this prompt:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Database Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current MODE from .env: local

Choose database to use:
  1) local  - Local Supabase (from local-ai-packaged)
  2) remote - Remote Supabase Cloud (eu-west-2)

Enter choice [1-2] (press Enter to keep current):
```

### 2. Verify Services

```bash
# MCP health
curl http://localhost:8051/health

# API health
curl http://localhost:8181/api/health

# Database connection
docker exec archon-server psql -U postgres -h supabase-ai-db -d postgres -c 'SELECT 1'
```

### 3. Verify SportERP Ports

```bash
# These MUST all work to prove no port conflicts
curl http://localhost:8000/health   # FastAPI
curl http://localhost:8069/          # Odoo
curl http://localhost:3000/          # Next.js
```

### 4. Execute Migration (after verification)

```bash
cd /home/ljutzkanov/Documents/Projects/archon
./scripts/migrate-cloud-to-local.sh
```

---

## Key Files

| File | Purpose |
|------|---------|
| `.env` | Dual-mode configuration (LOCAL_*/REMOTE_*) |
| `start-archon.sh` | Interactive database selection + auto-selection |
| `.env.remote-backup` | Backup of original remote-only config |
| `MIGRATION_CONFIG_SUMMARY.md` | Complete migration guide |
| `scripts/migrate-cloud-to-local.sh` | One-time full migration |
| `scripts/sync-local-to-cloud.sh` | Periodic backup sync |

---

## Port Architecture

**Local Supabase** (no conflicts with sporterp-apps):
- Kong internal: `supabase-ai-kong:8000` (container network)
- Kong external: `localhost:18000` (host access)
- PostgreSQL: `supabase-ai-db:5432` → `localhost:54323`

**SportERP Apps** (preserved):
- FastAPI: `localhost:8000` (host)
- Odoo: `localhost:8069` (host)
- Next.js: `localhost:3000` (host)

**Why No Conflict**: Kong uses port 8000 INSIDE its Docker container (for inter-container communication) but maps to 18000 externally on the host. FastAPI uses 8000 on the HOST. Different network spaces = no conflict.

---

## Task Management Commands

### View All Tasks

```bash
curl -s "http://localhost:8181/api/tasks?project_id=ea6a11ed-0eaa-4712-b96a-f086cd90fb54" | jq '.tasks[] | {title: .title, status: .status}'
```

### Update Task Status

```bash
# Mark task as in progress
curl -X PUT "http://localhost:8181/api/tasks/<TASK_ID>" \
  -H "Content-Type: application/json" \
  -d '{"status": "doing"}'

# Mark task as done
curl -X PUT "http://localhost:8181/api/tasks/<TASK_ID>" \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

### View Task Details

```bash
curl -s "http://localhost:8181/api/tasks/<TASK_ID>" | jq '.'
```

---

## Progress Tracking

**Run this for a quick status summary**:

```bash
/tmp/project-summary.sh
```

Or view in Archon Dashboard:
1. Start Archon services
2. Open http://localhost:3738 (Next.js) or http://localhost:3737 (React)
3. Navigate to Projects
4. Click on "Archon Database Migration - Local to Remote Sync"

---

## Rollback Procedure

If issues occur during migration:

```bash
# 1. Stop Archon
./stop-archon.sh

# 2. Restore original .env
cp .env.remote-backup .env

# 3. Switch back to remote
sed -i 's/MODE=.*/MODE=remote/' .env

# 4. Restart
./start-archon.sh --skip-nextjs
```

---

**Last Updated**: 2026-01-10
**Maintainer**: SportERP Team
**Status**: Ready for Phase 5 Testing
