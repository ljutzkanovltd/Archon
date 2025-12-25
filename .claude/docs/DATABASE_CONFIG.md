# Database Configuration - Archon Knowledge Base

Complete database architecture, configuration, and migration history for Archon.

---

## Current Setup (December 2025)

**Database Strategy**: Archon uses **table-level isolation** within the shared `postgres` database in Supabase.

**Location**: `postgres` database (shared with other local-ai services)
**Isolation Method**: `archon_*` table prefix
**Connection**: Direct to `supabase-ai-db:5432` via `localai_default` network

---

## Why Shared Database with Table-Level Isolation?

**Decision Rationale** (December 9, 2025 migration):

### 1. PostgREST Compatibility ✅
- PostgREST works out-of-the-box with `postgres` database
- No additional configuration needed
- Automatic API endpoint generation

### 2. Industry-Standard Pattern ✅
- Multi-tenant database design uses table/schema prefixing
- PostgreSQL designed for this pattern
- Efficient resource utilization

### 3. Simplified Architecture ✅
- Single database to manage
- Reduced connection complexity
- Easier backup/restore operations

### 4. No Blast Radius Issues ✅
- Table-level isolation provides sufficient separation
- PostgreSQL row-level security available if needed
- Archon tables clearly namespaced (`archon_*`)

---

## Database Schema

### 11 Archon Tables

All tables in `postgres` database:

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

### Verification

```bash
# Connect to database
docker exec -it supabase-ai-db psql -U postgres -d postgres

# List Archon tables
\dt archon_*

# Check table count
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'archon_%';
-- Expected result: 11

# Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'archon_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Connection Configuration

### Environment Variables

**`.env` file configuration**:

```bash
# Direct database connection (recommended)
DATABASE_URI=postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres

# Kong Gateway (for REST API/Auth)
SUPABASE_URL=http://host.docker.internal:18000
SUPABASE_SERVICE_KEY=eyJh...JWT_TOKEN...

# Note: Do not use pooler (host.docker.internal:5432) - causes tenant errors
```

### Startup Script Configuration

**`start-archon.sh` line 400**:
```bash
target_db="postgres"  # ✅ Correct - matches current setup
```

### Connection Methods Comparison

| Method | URL | Purpose | Status | Notes |
|--------|-----|---------|--------|-------|
| **Direct DB** | `supabase-ai-db:5432` | PostgreSQL queries | ✅ Recommended | Requires `localai_default` network |
| **Kong Gateway** | `host.docker.internal:18000` | REST API, Auth | ✅ Works | For Supabase API calls |
| **Pooler** | `host.docker.internal:5432` | Connection pooling | ⚠️ Avoid | Causes "tenant not found" errors |

---

## Backup & Restore

### Backup Strategy

**Full `postgres` database backup** (includes all Archon tables)

**Backup Script**: `/scripts/backup-archon.sh`
- Backs up entire `postgres` database
- Format: Custom PostgreSQL format (`pg_dump -Fc`)
- Retention: Last 10 backups
- Naming: `archon_postgres-YYYYMMDD_HHMMSS.dump`

**Restore Script**: `/scripts/restore-archon.sh`
- Restores from `postgres` database backup
- Handles Archon table restoration

### Manual Backup Operations

```bash
# Create backup
./scripts/backup-archon.sh

# List backups
ls -lh backups/archon_postgres-*.dump

# Restore from specific backup
./scripts/restore-archon.sh backups/archon_postgres-20251216_144400.dump

# Restore latest backup
./scripts/restore-archon.sh --latest

# Test restore without executing
./scripts/restore-archon.sh --latest --dry-run
```

### Automated Backups

**Current Status**: Manual backups only (not configured for automation)

**Recommended Setup**:
- Daily automated backups at 2:00 AM
- Schedule: `0 2 * * * /path/to/scripts/backup-archon.sh`

**See**: `@.claude/docs/BACKUP_PROCEDURES.md` for complete automation setup

---

## Migration History

### Timeline

#### Pre-December 9, 2025: Dedicated `archon_db` Database
- Isolated database for Archon only
- Required manual PostgREST configuration
- More complex connection management

#### December 9, 2025: Migration to Shared `postgres`
- Moved all Archon tables to `postgres` database
- Added `archon_*` prefix for isolation
- Simplified architecture
- **Status**: ✅ Complete and operational

#### December 16, 2025: Network Configuration Fix
- Added `localai_default` network to containers
- Fixed DNS resolution for `supabase-ai-db`
- **Status**: ✅ Complete and operational

### Migration Documentation

**Full Details**: See `/docs/DATABASE_MIGRATION_2025-12.md` for detailed migration procedures and rationale.

---

## Alternative Approaches Considered

### Dedicated `archon_db` Database (Not Implemented)

**Proposed in**: `/PRPs/archon-database-isolation-*.md`
**Status**: Superseded by table-level isolation approach
**Reason**: Added complexity without meaningful benefits
**Current `archon_db`**: Exists but unused/empty

### Why Table-Level Isolation is Sufficient

1. **PostgreSQL Design**: Built for multi-tenant patterns
2. **Clear Separation**: `archon_*` prefix provides namespace
3. **Access Control**: PostgreSQL roles/permissions available
4. **Performance**: No overhead from database switching
5. **Maintenance**: Single database to manage

### Comparison

| Aspect | Dedicated `archon_db` | Table-Level Isolation (Current) |
|--------|----------------------|----------------------------------|
| **Complexity** | High (manual PostgREST config) | Low (automatic) |
| **Blast Radius** | Lower (separate DB) | Sufficient (namespaced tables) |
| **Backup** | Separate backup process | Single backup process |
| **Performance** | Separate connection pool | Shared connection pool |
| **Maintenance** | 2 databases to manage | 1 database to manage |
| **PostgREST** | Manual configuration | Works out-of-the-box |

---

## Security & Isolation

### Current Protection

- **Table-level isolation** via `archon_*` prefix
- **PostgreSQL user permissions** (postgres user)
- **Application-level access control** (API authentication)
- **No cross-table references** to other services

### Future Enhancements (if needed)

- **Row-Level Security (RLS) policies** - Fine-grained access control
- **Separate PostgreSQL schema** - `archon` schema instead of `public`
- **Read-only replicas** - For reporting and analytics

### Blast Radius Containment

- ✅ Archon queries only touch `archon_*` tables
- ✅ No foreign keys to other service tables
- ✅ Independent migration tracking
- ✅ Service-specific connection credentials

**Risk Assessment**: **LOW** - Table-level isolation provides sufficient separation for development/local deployment.

---

## Troubleshooting Database Issues

### Problem: "Tenant or user not found"

**Cause**: Using pooler instead of direct database connection

**Solution**:
```bash
# 1. Check DATABASE_URI in .env
grep DATABASE_URI .env

# Should show: DATABASE_URI=postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres
# NOT: DATABASE_URI=postgresql://postgres:PASSWORD@host.docker.internal:5432/postgres

# 2. If using pooler, update to direct connection
sed -i 's/host.docker.internal:5432/supabase-ai-db:5432/g' .env

# 3. Restart Archon services
./stop-archon.sh && ./start-archon.sh
```

### Problem: Cannot resolve `supabase-ai-db`

**Cause**: Container not on `localai_default` network

**Solution**:
```bash
# 1. Verify docker-compose.yml includes localai_default network
grep -A 3 "archon-server:" docker-compose.yml | grep -A 2 "networks:"

# Should show:
#   networks:
#     - app-network
#     - sporterp-ai-unified
#     - localai_default

# 2. If missing, add to docker-compose.yml:
# services:
#   archon-server:
#     networks:
#       - app-network
#       - sporterp-ai-unified
#       - localai_default

# 3. Restart services
./stop-archon.sh && ./start-archon.sh
```

### Problem: Archon tables not found

**Cause**: Migration not run or connected to wrong database

**Solution**:
```bash
# 1. Check current database
docker exec -it supabase-ai-db psql -U postgres -c "SELECT current_database();"
# Should show: postgres

# 2. List Archon tables
docker exec -it supabase-ai-db psql -U postgres -d postgres -c "\dt archon_*"

# 3. If no tables found, run migrations
./start-archon.sh
# Migrations run automatically on startup

# 4. Verify table count
docker exec -it supabase-ai-db psql -U postgres -d postgres -c "
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'archon_%';"
# Expected result: 11
```

### Problem: Permission denied on database operations

**Cause**: Incorrect PostgreSQL user or credentials

**Solution**:
```bash
# 1. Verify SUPABASE_SERVICE_KEY is set
grep SUPABASE_SERVICE_KEY .env

# 2. Test database connection
docker exec -it supabase-ai-db psql -U postgres -d postgres -c "SELECT version();"

# 3. Check archon-server logs for auth errors
docker logs archon-server | grep -i "permission denied\|auth"

# 4. Regenerate service key if needed (see Supabase dashboard)
```

---

## Database Maintenance

### Regular Maintenance Tasks

**Weekly**:
```bash
# Vacuum analyze Archon tables
docker exec -it supabase-ai-db psql -U postgres -d postgres -c "
VACUUM ANALYZE archon_crawled_pages;
VACUUM ANALYZE archon_page_metadata;
VACUUM ANALYZE archon_code_examples;"
```

**Monthly**:
```bash
# Check table bloat
docker exec -it supabase-ai-db psql -U postgres -d postgres -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE tablename LIKE 'archon_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Performance Tuning

**Check query performance**:
```sql
-- Find slow queries on Archon tables
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%archon_%'
ORDER BY mean_time DESC
LIMIT 10;
```

**Create indexes** (if needed):
```sql
-- Example: Index on frequently searched columns
CREATE INDEX idx_archon_pages_title ON archon_crawled_pages(title);
CREATE INDEX idx_archon_metadata_embedding ON archon_page_metadata USING ivfflat(embedding);
```

---

**Related Documentation**:
- Main CLAUDE.md: `@.claude/CLAUDE.md`
- Network Architecture: `@.claude/docs/NETWORK_ARCHITECTURE.md`
- Backup Procedures: `@.claude/docs/BACKUP_PROCEDURES.md`
- System Setup: `@.claude/docs/SYSTEM_SETUP.md`
- Migration Details: `/docs/DATABASE_MIGRATION_2025-12.md`
