# CLAUDE.md - Archon Knowledge Base & Task Management

This file provides guidance for Claude Code when working with Archon, the knowledge base and task management system for SportERP.

## Overview

Archon is a Model Context Protocol (MCP) server that provides knowledge base management, documentation indexing, and task tracking capabilities for the SportERP platform. It enables AI assistants like Claude Code to access project documentation, search code examples, and manage development tasks.

**Purpose:** Knowledge base & task management with MCP integration for AI assistants
**MCP Server Port:** 8051
**Backend API Port:** 8181
**Dashboard UI Port:** 3737
**AI Agents Port:** 8052 (optional)
**Protocol:** Model Context Protocol (MCP)

---

## Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Backend** | FastAPI | Latest | API server & MCP server |
| **Language** | Python | 3.12+ | Programming language |
| **Frontend** | React | Latest | Dashboard UI |
| **State** | TanStack Query | Latest | Data fetching & caching |
| **Database** | Supabase | Latest | PostgreSQL + pgvector |
| **Vector Search** | pgvector | Latest | Semantic search |
| **Embeddings** | OpenAI | Latest | Document embeddings (optional) |

**Additional Services:**
- Supabase Stack: PostgreSQL, Kong, Auth, REST, Realtime, Storage
- Docker Compose: Container orchestration
- Make: Task automation

---

## System Prerequisites

### Required System Configuration

Before starting Archon services, ensure your system meets these requirements:

#### 1. inotify File Watch Limits

**Issue:** Archon containers may fail to start with "no space left on device" errors when the system's file watch limit is too low.

**Required Limit:** `fs.inotify.max_user_watches=524288` (minimum)

**Automated Configuration:**
```bash
# Run the setup script to configure all system requirements
sudo ./scripts/setup-system.sh

# Or configure only inotify limits
sudo ./scripts/setup-system.sh --inotify

# Check current configuration without making changes
sudo ./scripts/setup-system.sh --check
```

**Manual Configuration:**
```bash
# Set runtime value (temporary, until reboot)
sudo sysctl -w fs.inotify.max_user_watches=524288

# Make persistent across reboots
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

**Verification:**
```bash
# Check current limit
sysctl fs.inotify.max_user_watches

# Should output: fs.inotify.max_user_watches = 524288
```

#### 2. Docker Requirements

- Docker Engine 20.10+ or Docker Desktop
- Docker Compose v2.0+
- Minimum 10GB available disk space
- 4GB RAM recommended (2GB minimum)

#### 3. Network Requirements

**CRITICAL**: Archon requires THREE Docker networks for proper operation:

1. **`localai_default`** (external) - **REQUIRED** for Supabase database access
   - Provides DNS resolution for `supabase-ai-db` hostname
   - Enables direct PostgreSQL connection
   - Managed by local-ai-packaged project
   - **Must start local-ai-packaged BEFORE Archon**

2. **`sporterp-ai-unified`** (external) - For SportERP integration
   - Communication with SportERP services
   - Managed by local-ai-packaged/sporterp-apps

3. **`app-network`** (internal) - For Archon internal services
   - archon-server ↔ archon-mcp ↔ archon-ui communication
   - Managed by Archon docker-compose.yml

**Ports**:
- Archon: 8051, 8181, 3737, 8052 (optional)
- Supabase (via local-ai-packaged): 18000 (Kong), 5432 (pooler)

### Troubleshooting System Prerequisites

**Problem:** archon-server container exits immediately after starting

**Solution:**
1. Check inotify limits: `sysctl fs.inotify.max_user_watches`
2. If below 524288, run: `sudo ./scripts/setup-system.sh --inotify`
3. Restart Archon services: `./stop-archon.sh && ./start-archon.sh`

**Problem:** "Permission denied" errors during setup

**Solution:**
- Ensure running with sudo: `sudo ./scripts/setup-system.sh`
- Check user is in docker group: `groups` (should show 'docker')
- Add user to docker group if needed: `sudo usermod -aG docker $USER`
- Log out and log back in for group changes to take effect

---

## Network Architecture

### Overview

Archon operates within a multi-network Docker environment to enable communication with both Supabase (database) and SportERP services. Understanding this architecture is **CRITICAL** for troubleshooting and development.

### Network Topology

```
┌──────────────────────────────────────────────────┐
│  LOCAL-AI-PACKAGED (localai_default network)     │
├──────────────────────────────────────────────────┤
│  supabase-ai-db (172.18.0.20)                    │
│    ├─ Port: 5432 (direct database access)        │
│    └─ Databases:                                 │
│        ├─ postgres (Archon tables: archon_*)     │
│        ├─ flowise_db, langfuse_db, n8n_db, ...   │
│                                                   │
│  supabase-ai-kong (172.18.0.32)                  │
│    ├─ Port: 8000 (internal)                      │
│    └─ Host: 0.0.0.0:18000→8000 (Kong gateway)    │
│                                                   │
│  + AI Services: LLM APIs, Qdrant, Neo4j, ...     │
└──────────────────────────────────────────────────┘
         ↑
         │ DNS Resolution for supabase-ai-db
         │
┌──────────────────────────────────────────────────┐
│  ARCHON (3 networks)                             │
├──────────────────────────────────────────────────┤
│  Networks:                                       │
│    1. app-network (internal)                     │
│    2. sporterp-ai-unified (SportERP integration) │
│    3. localai_default (Supabase access) ✅       │
│                                                   │
│  archon-server, archon-mcp, archon-ui            │
└──────────────────────────────────────────────────┘
         ↓
         │ Service Communication
         │
┌──────────────────────────────────────────────────┐
│  SPORTERP-APPS (sporterp-ai-unified)             │
├──────────────────────────────────────────────────┤
│  sporterp-frontend, sporterp-api, sporterp-erp   │
└──────────────────────────────────────────────────┘
```

### Database Structure

**IMPORTANT**: Archon does NOT have a dedicated database. It uses the shared `postgres` database in Supabase with table-level isolation:

```sql
-- Database: postgres (shared)
-- Archon tables (11 total):
archon_settings, archon_sources, archon_crawled_pages,
archon_code_examples, archon_page_metadata, archon_projects,
archon_tasks, archon_project_sources, archon_document_versions,
archon_migrations, archon_prompts
```

This schema-based approach is correct and matches industry standards for multi-tenant database design.

### Connection Methods

| Method | URL/Hostname | Use Case | Status |
|--------|--------------|----------|--------|
| Direct DB | `supabase-ai-db:5432` | PostgreSQL queries (via localai_default network) | ✅ Recommended |
| Kong Gateway | `host.docker.internal:18000` | REST API, Auth | ✅ Works |
| Pooler | `host.docker.internal:5432` | Connection pooling | ⚠️ Limited (tenant issues) |

### Environment Variables

```bash
# Kong Gateway (REST API, Auth)
SUPABASE_URL=http://host.docker.internal:18000

# Direct Database Connection (requires localai_default network)
DATABASE_URI=postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres

# Service Key
SUPABASE_SERVICE_KEY=<JWT_token>
```

### Network Requirements Checklist

Before starting Archon:

- [ ] local-ai-packaged is running (`docker ps | grep supabase-ai-db`)
- [ ] `localai_default` network exists (`docker network ls | grep localai_default`)
- [ ] `sporterp-ai-unified` network exists (if integrating with SportERP)
- [ ] Ports 8051, 8181, 3737 are available

### Troubleshooting Network Issues

**Symptom**: "Temporary failure in name resolution"

**Cause**: Archon container not on `localai_default` network

**Solution**:
```bash
# Verify docker-compose.yml includes localai_default network
grep -A 3 "archon-server:" docker-compose.yml | grep -A 2 "networks:"

# Should show:
#   networks:
#     - app-network
#     - sporterp-ai-unified
#     - localai_default
```

**Symptom**: "Tenant or user not found"

**Cause**: Using pooler instead of direct database connection

**Solution**: Verify `DATABASE_URI` uses `supabase-ai-db:5432` (not `host.docker.internal:5432`)

**Full Documentation**: See `/docs/NETWORK_ARCHITECTURE_AND_DATABASE_CONNECTION.md`

---

## Database Architecture

### Current Setup (December 2025)

**Database Strategy**: Archon uses **table-level isolation** within the shared `postgres` database in Supabase.

**Location**: `postgres` database (shared with other local-ai services)
**Isolation Method**: `archon_*` table prefix
**Connection**: Direct to `supabase-ai-db:5432` via `localai_default` network

### Why Shared Database with Table-Level Isolation?

**Decision Rationale** (December 9, 2025 migration):

1. **PostgREST Compatibility** ✅
   - PostgREST works out-of-the-box with `postgres` database
   - No additional configuration needed
   - Automatic API endpoint generation

2. **Industry-Standard Pattern** ✅
   - Multi-tenant database design uses table/schema prefixing
   - PostgreSQL designed for this pattern
   - Efficient resource utilization

3. **Simplified Architecture** ✅
   - Single database to manage
   - Reduced connection complexity
   - Easier backup/restore operations

4. **No Blast Radius Issues** ✅
   - Table-level isolation provides sufficient separation
   - PostgreSQL row-level security available if needed
   - Archon tables clearly namespaced (`archon_*`)

### Database Schema

**11 Archon Tables** (all in `postgres` database):

```sql
-- Core Configuration
archon_settings          -- System configuration
archon_migrations        -- Migration tracking

-- Knowledge Base
archon_sources           -- Documentation sources
archon_crawled_pages     -- Crawled documentation
archon_page_metadata     -- Page metadata & vectors
archon_document_versions -- Version history
archon_code_examples     -- Code snippets
archon_prompts          -- Prompt templates

-- Project Management
archon_projects          -- Project registry
archon_project_sources   -- Project-source relationships
archon_tasks            -- Task tracking
```

**Verification**:
```bash
# Connect to database
docker exec -it supabase-ai-db psql -U postgres -d postgres

# List Archon tables
\dt archon_*

# Check table count
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'archon_%';
-- Expected result: 11
```

### Connection Configuration

**Environment Variables** (`.env`):
```bash
# Direct database connection (recommended)
DATABASE_URI=postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres

# Kong Gateway (for REST API/Auth)
SUPABASE_URL=http://host.docker.internal:18000
SUPABASE_SERVICE_KEY=eyJh...JWT_TOKEN...

# Note: Do not use pooler (host.docker.internal:5432) - causes tenant errors
```

**Startup Script Configuration** (`start-archon.sh` line 400):
```bash
target_db="postgres"  # ✅ Correct - matches current setup
```

### Backup & Restore

**Backup Strategy**: Full `postgres` database backup (includes all Archon tables)

**Backup Script**: `/scripts/backup-archon.sh`
- Backs up entire `postgres` database
- Format: Custom PostgreSQL format (`pg_dump -Fc`)
- Retention: Last 10 backups
- Naming: `archon_postgres-YYYYMMDD_HHMMSS.dump`

**Restore Script**: `/scripts/restore-archon.sh`
- Restores from `postgres` database backup
- Handles Archon table restoration

**Manual Backup**:
```bash
# Create backup
./scripts/backup-archon.sh

# List backups
ls -lh backups/archon_postgres-*.dump

# Restore from backup
./scripts/restore-archon.sh backups/archon_postgres-20251216_144400.dump
```

**Automated Backups**: Not configured (manual only)
- Recommended: Daily cron job
- Proposed schedule: `0 2 * * * /path/to/scripts/backup-archon.sh`

### Migration History

**Pre-December 9, 2025**: Dedicated `archon_db` database
- Isolated database for Archon only
- Required manual PostgREST configuration
- More complex connection management

**December 9, 2025**: Migration to shared `postgres`
- Moved all Archon tables to `postgres` database
- Added `archon_*` prefix for isolation
- Simplified architecture
- **Status**: ✅ Complete and operational

**December 16, 2025**: Network configuration fix
- Added `localai_default` network to containers
- Fixed DNS resolution for `supabase-ai-db`
- **Status**: ✅ Complete and operational

### Alternative Approaches Considered

**Dedicated `archon_db` Database** (Not Implemented):
- **Proposed in**: `/PRPs/archon-database-isolation-*.md`
- **Status**: Superseded by table-level isolation approach
- **Reason**: Added complexity without meaningful benefits
- **Current `archon_db`**: Exists but unused/empty

**Why Table-Level Isolation is Sufficient**:
1. **PostgreSQL Design**: Built for multi-tenant patterns
2. **Clear Separation**: `archon_*` prefix provides namespace
3. **Access Control**: PostgreSQL roles/permissions available
4. **Performance**: No overhead from database switching
5. **Maintenance**: Single database to manage

### Security & Isolation

**Current Protection**:
- Table-level isolation via `archon_*` prefix
- PostgreSQL user permissions
- Application-level access control
- No cross-table references to other services

**Future Enhancements** (if needed):
- Row-Level Security (RLS) policies
- Separate PostgreSQL schema (`archon` schema)
- Read-only replicas for reporting

**Blast Radius Containment**:
- Archon queries only touch `archon_*` tables
- No foreign keys to other service tables
- Independent migration tracking
- Service-specific connection credentials

### Troubleshooting Database Issues

**Problem**: "Tenant or user not found"
- **Cause**: Using pooler instead of direct connection
- **Solution**: Verify `DATABASE_URI` uses `supabase-ai-db:5432`

**Problem**: Cannot resolve `supabase-ai-db`
- **Cause**: Container not on `localai_default` network
- **Solution**: Check `docker-compose.yml` includes `localai_default`

**Problem**: Archon tables not found
- **Cause**: Migration not run or wrong database
- **Solution**: Run `./start-archon.sh` (runs migrations automatically)

**Full Documentation**: See `/docs/DATABASE_MIGRATION_2025-12.md`

---

## Backup & Monitoring

### Automated Backup System

**Strategy**: Archon uses automated daily backups with retention policies, monitoring, and disaster recovery procedures.

#### Backup Configuration

**Location**: `/home/ljutzkanov/Documents/Projects/archon/backups/`
**Format**: PostgreSQL custom format (`pg_dump -Fc`)
**Naming**: `archon_postgres-YYYYMMDD_HHMMSS.dump`
**Retention**: Last 10 backups (configurable)
**Schedule**: Daily at 2:00 AM (via systemd timer)

#### Backup Scripts

**Create Backup**:
```bash
# Manual backup
./scripts/backup-archon.sh

# With options
./scripts/backup-archon.sh --retention 20 --verbose

# Check backup status
ls -lh backups/archon_postgres-*.dump
```

**Restore from Backup**:
```bash
# List available backups
./scripts/restore-archon.sh --list

# Restore latest backup
./scripts/restore-archon.sh --latest

# Restore specific backup
./scripts/restore-archon.sh --backup backups/archon_postgres-20251216_020000.dump

# Dry-run (test without executing)
./scripts/restore-archon.sh --backup <file> --dry-run
```

**Features**:
- ✅ Automatic safety backup before restore
- ✅ Validation of backup integrity
- ✅ Rollback capability if restore fails
- ✅ Verification of all 11 Archon tables
- ✅ Retention policy management

#### Installing Automated Backups

**1. Install systemd timer** (one-time setup):
```bash
# Install backup timer and service units
sudo ./scripts/install-systemd-units.sh

# Verify installation
systemctl status archon-backup.timer
systemctl list-timers archon-backup.timer
```

**2. Monitor backup execution**:
```bash
# View logs
journalctl -u archon-backup.service -f

# Check last run
systemctl status archon-backup.service

# Manually trigger backup
sudo systemctl start archon-backup.service
```

**3. Customize schedule** (optional):
Edit `/etc/systemd/system/archon-backup.timer` and reload:
```bash
sudo systemctl daemon-reload
sudo systemctl restart archon-backup.timer
```

### Monitoring & Alerting

#### Database Size Monitoring

**Script**: `/scripts/monitor-db-size.sh`
**Log File**: `/var/log/archon-monitoring.log`
**Metrics**: `/logs/metrics/db-size-YYYYMM.csv`

**Features**:
- Daily database size tracking
- Individual table size monitoring
- Growth rate analysis (7-day trends)
- Threshold alerts (80MB warning, 100MB critical)
- Historical metrics in CSV format

**Run Monitoring**:
```bash
# Manual execution
./scripts/monitor-db-size.sh

# View metrics
tail -f /var/log/archon-monitoring.log

# Analyze trends
cat logs/metrics/db-size-$(date +%Y%m).csv
```

**Configure via Environment**:
```bash
# Set thresholds
export ALERT_THRESHOLD_MB=150
export WARNING_THRESHOLD_MB=120
export GROWTH_ALERT_MB_PER_DAY=10

# Run with custom settings
./scripts/monitor-db-size.sh
```

#### Automated Restore Testing

**Script**: `/scripts/test-restore-archon.sh`
**Schedule**: First Sunday of each month at 4:00 AM (recommended)
**Log Location**: `/logs/restore-test-YYYYMMDD_HHMMSS.log`

**What it does**:
1. Finds latest backup
2. Creates temporary test database
3. Restores backup to test database
4. Validates all 11 Archon tables exist
5. Checks data integrity (row counts)
6. Compares with production database
7. Cleans up test database
8. Generates test report

**Run Test**:
```bash
# Manual execution
./scripts/test-restore-archon.sh

# View test results
tail -100 logs/restore-test-*.log | less
```

**Schedule Automated Testing**:
```bash
# Add to crontab (first Sunday at 4 AM)
sudo crontab -e

# Add line:
0 4 1 * * /home/ljutzkanov/Documents/Projects/archon/scripts/test-restore-archon.sh
```

#### Log Rotation

**Configuration**: `/etc/logrotate.d/archon-monitoring`

**Install logrotate**:
```bash
# One-time setup
sudo ./scripts/install-logrotate.sh

# Test configuration
sudo logrotate -d /etc/logrotate.d/archon-monitoring

# Force rotation (for testing)
sudo logrotate -f /etc/logrotate.d/archon-monitoring
```

**Retention Policies**:
- Main logs: 30 days (daily rotation)
- Restore test logs: 12 weeks (weekly rotation)
- Metrics: 24 months (monthly rotation)

### Disaster Recovery

**Runbook**: `/docs/DISASTER_RECOVERY.md`

#### Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** | 30 min - 4 hours | Recovery Time Objective |
| **RPO** | 24 hours | Recovery Point Objective |

#### Key Scenarios

**1. Accidental Data Deletion** (RTO: 30 min)
```bash
# Restore from yesterday's backup
./scripts/restore-archon.sh --backup backups/archon_postgres-YESTERDAY.dump
```

**2. Database Corruption** (RTO: 1 hour)
```bash
# Stop services, restore, restart
./stop-archon.sh
./scripts/restore-archon.sh --latest
./start-archon.sh
```

**3. Complete Database Loss** (RTO: 2-4 hours)
```bash
# Recreate infrastructure and restore
cd ~/Documents/Projects/local-ai-packaged
docker compose up -d supabase-ai-db

cd ~/Documents/Projects/archon
./scripts/restore-archon.sh --latest
./start-archon.sh
```

**Full procedures**: See `/docs/DISASTER_RECOVERY.md` for detailed step-by-step recovery procedures for all scenarios.

#### Testing Schedule

- **Daily**: Automated backups at 2 AM
- **Monthly**: Restore testing (first Sunday at 4 AM)
- **Quarterly**: Full disaster recovery drill

#### Quick Recovery Commands

```bash
# Emergency backup (before risky operation)
./scripts/backup-archon.sh --backup-dir backups/emergency

# List recent backups
ls -lth backups/ | head -5

# Quick restore check
./scripts/restore-archon.sh --latest --dry-run

# Full system health check
docker ps | grep -E "supabase-ai-db|archon"
curl http://localhost:8181/health
curl http://localhost:8051/health
./scripts/monitor-db-size.sh
```

### Monitoring Best Practices

**Daily**:
- ✅ Check backup execution in systemd logs
- ✅ Monitor database size trends
- ✅ Review application logs for errors

**Weekly**:
- ✅ Verify backup files are not corrupt
- ✅ Check disk space in backup directory
- ✅ Review monitoring alerts

**Monthly**:
- ✅ Run automated restore test
- ✅ Review test results and logs
- ✅ Verify RTO/RPO targets are met
- ✅ Update disaster recovery runbook if needed

**Quarterly**:
- ✅ Perform full disaster recovery drill
- ✅ Test complete database loss scenario
- ✅ Review and update procedures
- ✅ Train team on recovery processes

### AI Monitoring Dashboard Integration

**Overview**: Archon backups are now integrated with the Local AI Monitoring Dashboard for unified backup status monitoring.

#### Dashboard Access

**Location**: `/home/ljutzkanov/Documents/Projects/local-ai-packaged/scripts/monitor-tui.py`
**Launch**: `cd local-ai-packaged && ./scripts/monitor-tui.py`
**Backup Panel**: Top-right corner (Panel 3)

#### Features

**Multi-Source Monitoring**:
- ✅ Local AI Platform backups (directory-based)
- ✅ Archon Knowledge Base backups (via API)
- ✅ Aggregate health status across both sources

**Display Format** (Stacked Vertical):
```
╭──────────────────────────────────╮
│ 📦 Backup Status                │
├──────────────────────────────────┤
│ 🔷 Local AI Platform            │
│   Last   4m ago  🟢              │
│   Size   3.3G                    │
│   Backups 5/5 backups            │
│ ───────────────────────────────  │
│ 🔶 Archon Knowledge Base        │
│   Last   1h ago  🟢              │
│   Size   450 MB                  │
│   Backups 8/10 backups           │
│ ───────────────────────────────  │
│ Overall  🟢 All Healthy          │
╰──────────────────────────────────╯
```

**Alerting System**:
- 🔴 **Console Warnings**: Prominent alerts in dashboard for critical issues
- 📝 **Log File Alerts**: Written to `/var/log/archon-monitoring.log`
- 🔔 **Visual Indicators**: Red border + ⚠ icon for outdated backups

#### API Endpoints

Archon exposes backup status via REST API for dashboard integration:

**Main Status Endpoint**:
```bash
GET http://localhost:8181/api/backup/status

# Response
{
  "source": "archon",
  "latest_backup": "2025-12-16T15:45:42",
  "age_hours": 1.2,
  "size_bytes": 471859200,
  "size_human": "450.0 MB",
  "count": 8,
  "max_retention": 10,
  "health": "healthy",
  "health_message": "Backup is fresh (1.2h old)",
  "location": "/home/ljutzkanov/Documents/Projects/archon/backups",
  "disk_usage_percent": 45.3
}
```

**Additional Endpoints**:
- `GET /api/backup/list` - List all available backups with details
- `GET /api/backup/health` - Quick boolean health check

#### Installation

**1. Install Dashboard Dependencies**:
```bash
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
./scripts/install-monitor-deps.sh

# Or check if already installed
./scripts/install-monitor-deps.sh --check
```

**2. Verify Integration**:
```bash
# Test Archon API
curl http://localhost:8181/api/backup/status | jq

# Launch dashboard
./scripts/monitor-tui.py
```

**3. View Backup Logs**:
```bash
# Monitor alerts in real-time
tail -f /var/log/archon-monitoring.log

# Example log entries:
# [2025-12-16 15:45:42] [INFO] Archon Knowledge Base: Backup is fresh (1.2h old)
# [2025-12-16 16:30:15] [WARNING] Archon Knowledge Base: Backup aging (7.5h old)
# [2025-12-16 18:00:00] [ERROR] Archon Knowledge Base: CRITICAL - Backup outdated (25h old)
```

#### Health Status Thresholds

| Status | Age | Color | Icon | Action |
|--------|-----|-------|------|--------|
| **Healthy** | < 6 hours | Green | 🟢 | None |
| **Aging** | 6-24 hours | Yellow | 🟡 | Monitor |
| **Outdated** | 24-48 hours | Red | 🔴 | Alert + Log |
| **Critical** | > 48 hours | Red | 🔴 | Alert + Log |
| **Missing** | No backup | Gray | ⚫ | Alert + Log |

#### Troubleshooting Integration

**Problem**: Dashboard shows Archon status as "Missing"

**Solution**:
```bash
# 1. Verify Archon API is running
curl http://localhost:8181/api/backup/status

# 2. Check if backups exist
ls -lh ~/Documents/Projects/archon/backups/archon_postgres-*.dump

# 3. Restart Archon server to load new API endpoint
cd ~/Documents/Projects/archon
docker compose restart archon-server

# 4. Wait 60 seconds for API cache to refresh
```

**Problem**: Dashboard not showing backup panel

**Solution**:
```bash
# Install missing dependencies
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
./scripts/install-monitor-deps.sh

# Required packages:
# - textual (dashboard framework)
# - requests (API calls)
# - docker, psutil, pyyaml, rich
```

**Problem**: "Permission denied" on log file

**Solution**:
```bash
# Create log file with correct permissions
sudo touch /var/log/archon-monitoring.log
sudo chown ljutzkanov:ljutzkanov /var/log/archon-monitoring.log
sudo chmod 640 /var/log/archon-monitoring.log

# Or dashboard will fallback to ~/archon-monitoring.log
```

#### Integration Architecture

```
┌──────────────────────────────────────┐
│  AI Monitoring Dashboard (TUI)       │
│  Port: Terminal UI                   │
├──────────────────────────────────────┤
│  - GPUMemoryPanel (top-left)         │
│  - LLMPerformancePanel (top-mid)     │
│  - BackupStatusPanel (top-right) ⭐  │
│  - ServiceStatusGrid (bottom-left)   │
│  - ServiceLinksPanel (bottom-right)  │
└──────────────────────────────────────┘
                ↓
    ┌───────────────────────────┐
    │  Multi-Source Metrics     │
    │  (backup_metrics.py)      │
    ├───────────────────────────┤
    │  - Local AI: File-based   │
    │  - Archon: API-based      │
    │  - Caching: 60s TTL       │
    │  - Alerting: Console+Log  │
    └───────────────────────────┘
                ↓
    ┌───────────────────────────┐
    │  Archon Backup API        │
    │  Port: 8181               │
    ├───────────────────────────┤
    │  GET /api/backup/status   │
    │  GET /api/backup/list     │
    │  GET /api/backup/health   │
    └───────────────────────────┘
                ↓
    ┌───────────────────────────┐
    │  Archon Backups           │
    │  /archon/backups/         │
    ├───────────────────────────┤
    │  archon_postgres-*.dump   │
    │  (PostgreSQL custom fmt)  │
    └───────────────────────────┘
```

#### Monitoring Commands

```bash
# Quick status check
curl -s http://localhost:8181/api/backup/status | jq '.health, .age_hours, .count'

# List all backups
curl -s http://localhost:8181/api/backup/list | jq '.count, .total_size_human'

# Test multi-source metrics
cd /home/ljutzkanov/Documents/Projects/local-ai-packaged
python3 scripts/backup_metrics.py

# Launch full dashboard
./scripts/monitor-tui.py

# Monitor backup alerts
tail -f /var/log/archon-monitoring.log | grep -E "WARNING|ERROR|CRITICAL"
```

---

## Architecture

### Service Components

```
Archon Platform:
├── MCP Server (Port 8051)        # Model Context Protocol endpoint
├── Backend API (Port 8181)       # REST API for knowledge base & tasks
├── Dashboard UI (Port 3737)      # Web interface for management
├── AI Agents (Port 8052)         # Optional AI agent services
└── Supabase Stack                # Database & backend services
    ├── PostgreSQL (Port 5432)   # Database with pgvector
    ├── Kong Gateway (Port 8002)  # API gateway
    ├── Studio UI (Port 3001)     # Database admin
    ├── Auth                      # Authentication service
    ├── REST                      # RESTful API
    ├── Realtime                  # WebSocket subscriptions
    ├── Storage                   # File storage
    ├── Meta                      # Metadata service
    └── Analytics                 # Analytics service
```

### Integration with SportERP

```
Claude Code (AI Assistant)
    ↓ MCP Protocol
Archon MCP Server (Port 8051)
    ↓ Knowledge Base Access
    ├── Documentation (CLAUDE.md, README.md, API docs)
    ├── Code Examples (from all projects)
    ├── Task Management (project tasks and status)
    └── Project Context (architecture, patterns, standards)
    ↓ Provides Context To
SportERP Development (Frontend, API, ERP)
```

### Data Flow

1. **Documentation Indexing:**
   - Archon crawls project directories
   - Extracts CLAUDE.md, README.md, API docs
   - Generates embeddings (optional)
   - Stores in Supabase with pgvector

2. **Knowledge Access:**
   - Claude Code queries via MCP protocol
   - Archon searches indexed documents
   - Returns relevant documentation and examples
   - Enables context-aware assistance

3. **Task Management:**
   - Tasks created via MCP or API
   - Stored in Supabase database
   - Tracked across projects
   - Progress monitoring via dashboard

---

## Development Standards

### Code Conventions

**Python (Backend):**
- File naming: `snake_case.py`
- Classes: `PascalCase`
- Functions/variables: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Follow PEP 8 style guide

**TypeScript/React (Frontend):**
- File naming: `PascalCase.tsx` for components
- Variables/functions: `camelCase`
- Components: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

**Import Order:**
```python
# Python
# 1. Standard library
import os
from datetime import datetime

# 2. Third-party
from fastapi import FastAPI
from supabase import create_client

# 3. Local
from .models import Document
from .utils import generate_embedding
```

```typescript
// TypeScript
// 1. React
import React from 'react';

// 2. Third-party
import { useQuery } from '@tanstack/react-query';

// 3. Local
import { api } from '@/lib/api';
import { DocumentCard } from '@/components/DocumentCard';
```

---

## Essential Commands

### Setup (One-Time)

```bash
# Navigate to archon directory
cd archon

# Run setup script
./setup-archon.sh

# This will:
# - Clone archon-server repository
# - Create config files
# - Initialize Supabase
# - Set up environment variables
# - Start all services
```

### Service Management

```bash
# Start Archon services
./scripts/start.sh

# Stop Archon services
./scripts/stop.sh

# Restart services
./scripts/stop.sh && ./scripts/start.sh

# Check service status
docker ps --filter "name=archon"

# View logs
docker logs -f archon-mcp-server
docker logs -f archon-backend-api
docker logs -f archon-dashboard
```

### Database Management

```bash
# Initialize database
./scripts/init-db.sh

# Load documentation
./scripts/load-docs.sh

# Connect to database
psql -h localhost -p 5432 -U postgres -d archon
```

### Development

```bash
# Start in development mode
cd archon-server
docker-compose up

# Access services
# MCP Server: http://localhost:8051
# Backend API: http://localhost:8181
# Dashboard: http://localhost:3737
# Supabase Studio: http://localhost:3001
```

---

## Environment Setup

### Required Environment Variables

Create `config/.env`:

```env
# OpenAI API (for embeddings - optional)
OPENAI_API_KEY=sk-xxx

# Azure OpenAI Configuration (optional)
# Note: As of December 15, 2025, Azure OpenAI supports separate keys for chat and embeddings
# You can configure:
#   1. Separate keys (recommended): AZURE_OPENAI_CHAT_API_KEY + AZURE_OPENAI_EMBEDDING_API_KEY
#   2. Legacy single key (fallback): AZURE_OPENAI_API_KEY (used for both chat and embeddings)
#
# Chat/LLM Configuration:
AZURE_OPENAI_CHAT_API_KEY=your_chat_api_key
AZURE_OPENAI_CHAT_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
AZURE_OPENAI_CHAT_DEPLOYMENT=your_deployment_name
#
# Embedding Configuration:
AZURE_OPENAI_EMBEDDING_API_KEY=your_embedding_api_key
AZURE_OPENAI_EMBEDDING_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=your_embedding_deployment_name
#
# Legacy Configuration (fallback if separate keys not provided):
# AZURE_OPENAI_API_KEY=your_api_key
# AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
# AZURE_OPENAI_DEPLOYMENT=your_deployment_name

# Server Configuration
SERVER_PORT=8181         # Backend API port
MCP_PORT=8051           # MCP server port
FRONTEND_PORT=3737      # Dashboard UI port
AGENTS_PORT=8052        # AI agents port (optional)

# Supabase Configuration
SUPABASE_URL=http://localhost:8002
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/archon

# Logging
LOG_LEVEL=info
LOG_FILE=logs/archon.log

# Environment
ENVIRONMENT=development
DEBUG=true
```

### Supabase Setup

**Supabase services managed via Docker Compose:**

```yaml
# Key services (from docker-compose.yml)
services:
  supabase-db:
    image: supabase/postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: postgres

  supabase-studio:
    image: supabase/studio
    ports:
      - "3001:3000"

  kong:
    image: kong
    ports:
      - "8002:8000"  # API Gateway
```

**Access:**
- Supabase Studio: http://localhost:3001 (database admin)
- Kong Gateway: http://localhost:8002 (API proxy)
- PostgreSQL: localhost:5432 (direct connection)

---

## Directory Structure

```
archon/
├── archon-server/                # Cloned Archon repository
│   ├── python/                  # Python backend code
│   │   ├── mcp_server/         # MCP server implementation
│   │   ├── api/                # REST API endpoints
│   │   ├── models/             # Data models
│   │   ├── services/           # Business logic
│   │   └── utils/              # Utilities
│   ├── archon-ui-main/         # React frontend
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   ├── pages/         # Dashboard pages
│   │   │   ├── hooks/         # Custom hooks
│   │   │   └── lib/           # Utilities
│   │   └── public/            # Static assets
│   ├── docs/                   # Documentation
│   ├── PRPs/                   # Project requirements
│   ├── migration/              # Database migrations
│   ├── docker-compose.yml      # Service orchestration
│   ├── Makefile               # Task automation
│   └── README.md              # Setup instructions
├── config/                     # Configuration files
│   ├── .env                   # Environment variables
│   └── docker-compose.yml     # Custom compose overrides
├── data/                       # Archon data storage
├── logs/                       # Application logs
├── scripts/                    # Management scripts
│   ├── start.sh              # Start services
│   ├── stop.sh               # Stop services
│   ├── init-db.sh            # Initialize database
│   └── load-docs.sh          # Load documentation
└── README.md                  # Archon setup guide
```

---

## MCP Integration

### Model Context Protocol (MCP)

**MCP enables AI assistants to:**
- Access knowledge bases
- Search documentation
- Retrieve code examples
- Manage tasks and projects
- Get project-specific context

### MCP Configuration

**Location:** `.claude/mcp.json` (in each SportERP app)

```json
{
  "mcpServers": {
    "archon": {
      "command": "node",
      "args": ["path/to/mcp-client.js"],
      "env": {
        "MCP_SERVER_URL": "http://localhost:8051"
      }
    }
  }
}
```

### MCP Capabilities

**Knowledge Base:**
- `search_docs(query)` - Search documentation
- `get_doc(path)` - Retrieve specific document
- `list_docs(filter)` - List available documents
- `get_code_examples(topic)` - Find code examples

**Task Management:**
- `create_task(project, title, description)` - Create task
- `list_tasks(filter)` - List tasks by filter
- `update_task(id, updates)` - Update task
- `get_task(id)` - Get task details

**Project Context:**
- `get_project_info(name)` - Get project metadata
- `get_architecture(project)` - Get architecture docs
- `get_patterns(project, type)` - Get code patterns

### Using Archon from Claude Code

**Example MCP interactions:**

```python
# Search for documentation
docs = archon.search_docs("authentication patterns")

# Get code examples
examples = archon.get_code_examples("FastAPI JWT")

# Create task
task = archon.create_task(
    project="sporterp-frontend",
    title="Implement user profile page",
    description="Create user profile page with edit functionality"
)

# List tasks
tasks = archon.list_tasks(filter_by="status", filter_value="todo")
```

---

## Knowledge Base Management

### Document Indexing

**Automatic indexing on startup:**

```bash
# Archon automatically indexes:
- .claude/CLAUDE.md files
- README.md files
- API documentation
- Custom module docs
- Code examples
```

**Manual indexing:**

```bash
# Load documentation
./scripts/load-docs.sh

# Index specific directory
python -m archon index --path /path/to/docs

# Reindex all
python -m archon reindex
```

### Document Types

**Supported formats:**
- Markdown (.md)
- Python (.py)
- TypeScript (.ts, .tsx)
- JavaScript (.js, .jsx)
- JSON (.json)
- YAML (.yml, .yaml)
- XML (.xml)

### Search Capabilities

**Full-text search:**
```python
# Simple text search
results = archon.search("Zustand store patterns")

# Filtered search
results = archon.search(
    query="authentication",
    filters={"project": "frontend", "type": "code"}
)
```

**Semantic search (with embeddings):**
```python
# Similarity-based search using pgvector
results = archon.semantic_search(
    query="How do I implement JWT authentication?",
    limit=5
)
```

---

## Task Management

### Task Structure

```python
class Task:
    id: str
    project: str
    title: str
    description: str
    status: str  # "todo", "in_progress", "done", "blocked"
    priority: str  # "low", "medium", "high", "urgent"
    assigned_to: str
    created_at: datetime
    updated_at: datetime
    due_date: datetime | None
    tags: list[str]
    metadata: dict
```

### Task Operations

**Create task:**
```python
task = archon.create_task(
    project="sporterp-api",
    title="Implement order endpoint",
    description="Create REST API endpoint for orders",
    priority="high",
    tags=["backend", "api"]
)
```

**Update task:**
```python
archon.update_task(
    task_id="task-123",
    status="in_progress",
    assigned_to="developer@example.com"
)
```

**List tasks:**
```python
# All tasks
tasks = archon.list_tasks()

# Filter by status
tasks = archon.list_tasks(filter_by="status", filter_value="todo")

# Filter by project
tasks = archon.list_tasks(filter_by="project", filter_value="sporterp-frontend")

# Complex filter
tasks = archon.list_tasks(filters={
    "status": "in_progress",
    "priority": "high",
    "project": "sporterp-api"
})
```

### Task Dashboard

**Access via web UI:**
- URL: http://localhost:3737
- View all tasks
- Filter and sort
- Update status
- Create new tasks
- View task details

---

## API Endpoints

### Knowledge Base API

**Base URL:** http://localhost:8181

```bash
# Search documents
GET /api/v1/docs/search?q=authentication&project=frontend

# Get document
GET /api/v1/docs/{doc_id}

# List documents
GET /api/v1/docs?project=sporterp-api

# Index document
POST /api/v1/docs/index
Content-Type: application/json
{
  "path": "/path/to/doc.md",
  "content": "...",
  "metadata": {}
}
```

### Task API

```bash
# Create task
POST /api/v1/tasks
Content-Type: application/json
{
  "project": "sporterp-frontend",
  "title": "Implement feature",
  "description": "Description",
  "priority": "high"
}

# List tasks
GET /api/v1/tasks?status=todo

# Get task
GET /api/v1/tasks/{task_id}

# Update task
PUT /api/v1/tasks/{task_id}
Content-Type: application/json
{
  "status": "in_progress"
}

# Delete task
DELETE /api/v1/tasks/{task_id}
```

### MCP Endpoint

```bash
# MCP server endpoint (used by AI assistants)
POST http://localhost:8051/mcp
Content-Type: application/json
{
  "method": "search_docs",
  "params": {
    "query": "authentication"
  }
}
```

---

## Industry Standards & Best Practices

### MCP Protocol

**Standards:**
- Follow MCP specification
- Implement standard capabilities
- Support JSON-RPC 2.0
- Provide clear method documentation
- Handle errors gracefully

**Security:**
- Authentication required for sensitive operations
- Rate limiting for public endpoints
- Input validation
- Output sanitization

### Knowledge Base

**Best Practices:**
1. **Document Organization:**
   - Clear hierarchy
   - Consistent naming
   - Metadata tagging
   - Version tracking

2. **Indexing:**
   - Regular reindexing
   - Incremental updates
   - Content deduplication
   - Efficient search algorithms

3. **Search:**
   - Full-text search for keywords
   - Semantic search for concepts
   - Filter and faceting
   - Relevance ranking

### Task Management

**Best Practices:**
1. **Task Creation:**
   - Clear, actionable titles
   - Detailed descriptions
   - Appropriate priority
   - Relevant tags

2. **Status Management:**
   - Keep status updated
   - Track progress
   - Monitor blockers
   - Review regularly

3. **Organization:**
   - Group by project
   - Use tags effectively
   - Set due dates
   - Assign ownership

---

## Common Issues & Solutions

### MCP Server Not Responding

**Symptoms:** Claude Code cannot connect to Archon

**Solutions:**
1. Check if MCP server is running: `docker ps | grep archon-mcp`
2. Verify port 8051 is accessible: `curl http://localhost:8051/health`
3. Check logs: `docker logs archon-mcp-server`
4. Restart services: `./scripts/stop.sh && ./scripts/start.sh`

### Supabase Connection Issues

**Symptoms:** Cannot connect to database

**Solutions:**
1. Check if Supabase services are running: `docker ps | grep supabase`
2. Verify PostgreSQL port: `psql -h localhost -p 5432 -U postgres`
3. Check Kong gateway: `curl http://localhost:8002`
4. Review Supabase logs: `docker logs supabase-db`

### Document Indexing Failures

**Symptoms:** Documents not appearing in search

**Solutions:**
1. Check indexing logs: `tail -f logs/archon.log`
2. Reindex manually: `./scripts/load-docs.sh`
3. Verify file permissions
4. Check Supabase storage

### Performance Issues

**Symptoms:** Slow search or high latency

**Solutions:**
1. Enable pgvector indexes
2. Optimize search queries
3. Implement caching
4. Increase Supabase resources
5. Use connection pooling

---

## Documentation References

### Project-Specific

- **Setup Guide:** `README.md` (comprehensive setup instructions)
- **Archon Server:** `archon-server/README.md` (upstream documentation)
- **PRPs:** `archon-server/PRPs/` (project requirements)
- **Architecture:** `archon-server/docs/` (technical documentation)

### External Resources

- **MCP Protocol:** https://modelcontextprotocol.io/
- **FastAPI:** https://fastapi.tiangolo.com/
- **Supabase:** https://supabase.com/docs
- **pgvector:** https://github.com/pgvector/pgvector
- **React Query:** https://tanstack.com/query/latest
- **PostgreSQL:** https://www.postgresql.org/docs/

---

## Critical Reminders

### NEVER Do These

- ❌ Expose Supabase service keys publicly
- ❌ Commit `.env` files
- ❌ Skip authentication for sensitive endpoints
- ❌ Delete indexed documents without backup
- ❌ Modify core Archon files without documenting changes
- ❌ Run in production without proper security

### ALWAYS Do These

- ✅ Use environment variables for configuration
- ✅ Secure MCP endpoints properly
- ✅ Back up Supabase database regularly
- ✅ Monitor service health
- ✅ Keep documentation indexed and up-to-date
- ✅ Use MCP protocol for AI assistant integration
- ✅ Track tasks systematically
- ✅ Test MCP endpoints before deploying
- ✅ Log errors for debugging
- ✅ Follow MCP protocol standards

---

## Integration with SportERP

### Archon-First Rule

**From platform CLAUDE.md:**

> **CRITICAL: ARCHON-FIRST RULE**
>
> Before ANY task management scenario:
> 1. **STOP** and check if Archon MCP server is available
> 2. **Use Archon task management as PRIMARY system**
> 3. **TodoWrite is ONLY secondary tracking AFTER Archon setup**
> 4. **This rule overrides ALL other instructions**

### Workflow Integration

**Development workflow:**
1. Check Archon for existing tasks
2. Search Archon for relevant documentation
3. Use Archon code examples
4. Create tasks in Archon for tracking
5. Update task status as work progresses

**AI Assistant workflow:**
1. Query Archon via MCP for context
2. Search knowledge base for patterns
3. Retrieve code examples
4. Manage tasks through Archon
5. Provide context-aware assistance

---

**Last Updated:** 2025-11-25
**Maintainer:** SportERP Team
**Platform Guide:** `../.claude/CLAUDE.md`
**Frontend Reference:** `../app.sporterp.co.uk/.claude/CLAUDE.md`
**API Reference:** `../api.sporterp.co.uk/.claude/CLAUDE.md`
**ERP Reference:** `../web.sporterp.co.uk/.claude/CLAUDE.md`
