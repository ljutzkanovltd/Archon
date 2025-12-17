# Archon Network Architecture & Database Connection

**Date**: 2025-12-16
**Issue**: archon-server container failing with DNS resolution error
**Resolution**: Added `localai_default` network to Archon containers for direct Supabase access

---

## Problem Summary

After adding the `DATABASE_URI` environment variable on Dec 15, 2025 (commit 05d7982), the archon-server container failed to start with the error:

```
socket.gaierror: [Errno -3] Temporary failure in name resolution
```

The container was trying to connect to `postgresql://postgres:Postgress.8201@supabase-ai-db:5432/postgres` but could not resolve the `supabase-ai-db` hostname.

---

## Root Cause

**Network Isolation**: Archon containers were on `app-network` and `sporterp-ai-unified` networks, but Supabase containers (including `supabase-ai-db`) are on the `localai_default` network. Docker's embedded DNS cannot resolve hostnames across different networks.

### Timeline

| Date | Event | Impact |
|------|-------|--------|
| Nov 2, 2025 | Archon services only on `app-network` | Working (no DATABASE_URI yet) |
| Dec 1, 2025 | Added `sporterp-ai-unified` network | Still working (no DATABASE_URI yet) |
| Dec 5, 2025 | Database backups created | **PROOF: System was working** |
| Dec 15, 2025 | **Added DATABASE_URI env var** | **BREAKING: DNS resolution fails** |
| Dec 16, 2025 | Added `localai_default` network | **FIXED** |

---

## Database Structure

### Archon Does NOT Have a Dedicated Database

Archon uses the **shared `postgres` database** in the Supabase container with table-level isolation using the `archon_*` prefix:

```sql
-- Database: postgres (shared)
-- Archon tables (11 total):
archon_settings
archon_sources
archon_crawled_pages
archon_code_examples
archon_page_metadata
archon_projects
archon_tasks
archon_project_sources
archon_document_versions
archon_migrations
archon_prompts
```

This is the CORRECT approach - using schema-based isolation within a shared database, similar to how other services (Flowise, Langfuse, n8n, Odoo) have their own dedicated databases in the same Supabase instance.

---

## Network Architecture

### Complete Network Topology

```
┌─────────────────────────────────────────────────────────┐
│         LOCAL-AI-PACKAGED (localai_default network)     │
├─────────────────────────────────────────────────────────┤
│  supabase-ai-db (172.18.0.20)                           │
│    ├─ Port: 5432 (internal)                             │
│    └─ Databases: postgres, flowise_db, langfuse_db,     │
│                   n8n_db, odoo_db                        │
│                                                          │
│  supabase-ai-kong (172.18.0.32)                         │
│    ├─ Port: 8000 (internal)                             │
│    └─ Host binding: 0.0.0.0:18000→8000                  │
│                                                          │
│  supabase-ai-pooler (172.18.0.31)                       │
│    └─ Host bindings: 0.0.0.0:5432, 0.0.0.0:6543         │
│                                                          │
│  + AI Services: llamacpp-vulkan, qdrant, n8n, etc.      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  ARCHON (app-network + sporterp-ai-unified +            │
│          localai_default networks)                      │
├─────────────────────────────────────────────────────────┤
│  archon-server (172.19.0.6 on sporterp-ai-unified)      │
│    ├─ Port: 8181                                        │
│    ├─ SUPABASE_URL: http://host.docker.internal:18000   │
│    └─ DATABASE_URI: postgresql://...@supabase-ai-db:... │
│                                                          │
│  archon-mcp (Port: 8051)                                │
│  archon-ui (Port: 3737)                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│         SPORTERP-APPS (sporterp-ai-unified network)     │
├─────────────────────────────────────────────────────────┤
│  sporterp-frontend (Port: 3000)                         │
│  sporterp-api (Port: 8000)                              │
│  sporterp-erp (Port: 8069)                              │
└─────────────────────────────────────────────────────────┘
```

### Network Membership

**After Fix** (Current Configuration):

| Service | Networks |
|---------|----------|
| archon-server | app-network, sporterp-ai-unified, **localai_default** ✅ |
| archon-mcp | app-network, sporterp-ai-unified, **localai_default** ✅ |
| archon-ui | app-network, sporterp-ai-unified, **localai_default** ✅ |
| archon-agents | app-network, sporterp-ai-unified, **localai_default** ✅ |
| archon-agent-work-orders | app-network, sporterp-ai-unified, **localai_default** ✅ |
| supabase-ai-db | localai_default |
| supabase-ai-* (all services) | localai_default |
| sporterp-* | sporterp-ai-unified |

---

## Solution Implemented

### Changes Made

1. **Updated `docker-compose.yml`**:
   - Added `localai_default` network definition (external)
   - Added `localai_default` to all Archon services' network lists

2. **Environment Variables** (`.env`):
   ```bash
   SUPABASE_URL=http://host.docker.internal:18000  # Kong gateway
   DATABASE_URI=postgresql://postgres:Postgress.8201@supabase-ai-db:5432/postgres  # Direct DB
   ```

### Why This Works

- **Direct DNS Resolution**: Archon containers can now resolve `supabase-ai-db` hostname via Docker's embedded DNS
- **Best Performance**: Direct database connection (no pooler overhead)
- **Architecturally Correct**: Archon IS part of the local-ai infrastructure and should be on that network
- **Future-Proof**: Enables access to other local-ai services (Qdrant, LLM APIs, etc.)

---

## Connection Paths

| Connection Method | Status | Use Case |
|-------------------|--------|----------|
| `supabase-ai-db:5432` (via localai_default DNS) | ✅ WORKS | Direct database (recommended) |
| `host.docker.internal:18000` (via Kong) | ✅ WORKS | REST API, Auth services |
| `host.docker.internal:5432` (via pooler) | ⚠️ Limited | Connection pooling (tenant issues) |
| `host.docker.internal:54323` (direct DB port) | ❌ FAILS | Port bound to 127.0.0.1 only |

---

## Verification

### Successful Startup Indicators

```bash
# Check all services are healthy
docker compose ps
# All should show "(healthy)"

# Check health endpoints
curl http://localhost:8181/health
# Returns: {"status":"healthy","service":"archon-backend",...}

curl http://localhost:8051
# MCP server responds

curl http://localhost:3737
# Dashboard UI loads

# Check logs for success messages
docker compose logs archon-server | grep "✅"
# Should show: ✅ Credentials initialized
#              ✅ Using polling for real-time updates
#              ✅ Prompt service initialized
```

### No More Errors

**Before Fix**:
```
socket.gaierror: [Errno -3] Temporary failure in name resolution
```

**After Fix**:
```
✅ All services healthy
✅ Database connection successful
✅ No DNS resolution errors
```

---

## Best Practices

### Network Design Principles

1. **Service Grouping**: Services that need to communicate should be on the same network
2. **DNS-Based Discovery**: Use hostnames (not IPs) for service communication
3. **Network Isolation**: Use multiple networks for security/logical separation
4. **External Networks**: Declare shared networks as `external: true`

### Archon-Specific Guidelines

1. **Always use `localai_default` network** for Supabase database access
2. **Use `sporterp-ai-unified` network** for SportERP integration
3. **Use `app-network`** for internal Archon service communication
4. **Document network changes** in this file and CLAUDE.md

---

## Related Documentation

- **Docker Compose**: `/home/ljutzkanov/Documents/Projects/archon/docker-compose.yml`
- **Environment**: `/home/ljutzkanov/Documents/Projects/archon/.env`
- **CLAUDE.md**: `/home/ljutzkanov/Documents/Projects/archon/.claude/CLAUDE.md`
- **Supabase Setup**: `/home/ljutzkanov/Documents/Projects/local-ai-packaged/supabase/`

---

## Troubleshooting

### If archon-server Fails to Start

1. **Check Network Exists**:
   ```bash
   docker network ls | grep localai_default
   ```
   If missing, start local-ai-packaged first.

2. **Check Database Connectivity**:
   ```bash
   docker exec archon-server ping -c 1 supabase-ai-db
   ```
   Should resolve to 172.18.0.20

3. **Check Database Access**:
   ```bash
   docker exec archon-server psql -h supabase-ai-db -U postgres -d postgres -c "SELECT COUNT(*) FROM archon_settings;"
   ```
   Should return count without errors.

4. **Check Logs**:
   ```bash
   docker compose logs archon-server --tail=50
   ```
   Look for DNS, connection, or authentication errors.

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| "network localai_default not found" | local-ai-packaged not running | Start local-ai-packaged first |
| "Temporary failure in name resolution" | Not on localai_default network | Verify docker-compose.yml includes network |
| "Tenant or user not found" | Using pooler with wrong config | Use direct DB connection (supabase-ai-db:5432) |
| "Connection refused" | Supabase not running | Check `docker ps | grep supabase` |

---

## Maintenance Notes

### When Updating Docker Compose

- **Always preserve** `localai_default` network in all Archon services
- **Test connectivity** after changes: `docker exec archon-server ping supabase-ai-db`
- **Document changes** in this file

### When Adding New Archon Services

- **Include networks**: `app-network`, `sporterp-ai-unified`, `localai_default`
- **Test database access** if service needs Supabase
- **Update this document** with new service details

---

**Last Updated**: 2025-12-16
**Maintainer**: SportERP Team
**Status**: ✅ RESOLVED - All services healthy and operational
