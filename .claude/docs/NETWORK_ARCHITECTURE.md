# Network Architecture - Archon Knowledge Base

Complete Docker network architecture, topology, and troubleshooting for Archon multi-network environment.

---

## Overview

Archon operates within a multi-network Docker environment to enable communication with both Supabase (database) and SportERP services. Understanding this architecture is **CRITICAL** for troubleshooting and development.

---

## Network Topology

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

---

## Three Required Networks

### 1. `local ai_default` (External) - **REQUIRED**

**Purpose**: Supabase database access
- Provides DNS resolution for `supabase-ai-db` hostname
- Enables direct PostgreSQL connection
- Managed by local-ai-packaged project
- **Must start local-ai-packaged BEFORE Archon**

**Network Details:**
- Bridge driver
- Subnet: 172.18.0.0/16 (typical)
- Gateway: 172.18.0.1

**Verification:**
```bash
# Check network exists
docker network ls | grep localai_default

# Inspect network
docker network inspect localai_default

# Check Archon containers on network
docker network inspect localai_default | grep -E "archon-server|archon-mcp"
```

### 2. `sporterp-ai-unified` (External)

**Purpose**: SportERP integration
- Communication with SportERP services
- Managed by local-ai-packaged/sporterp-apps

**Verification:**
```bash
# Check network exists
docker network ls | grep sporterp-ai-unified

# Check connected services
docker network inspect sporterp-ai-unified | grep -E "archon|sporterp"
```

### 3. `app-network` (Internal)

**Purpose**: Archon internal services communication
- archon-server ↔ archon-mcp ↔ archon-ui communication
- Managed by Archon docker-compose.yml
- Created automatically when Archon starts

**Verification:**
```bash
# Check network exists (after Archon starts)
docker network ls | grep app-network

# Check Archon services on network
docker network inspect app-network | grep -E "archon-server|archon-mcp|archon-ui"
```

---

## Database Structure

**IMPORTANT**: Archon does NOT have a dedicated database. It uses the shared `postgres` database in Supabase with table-level isolation.

### 11 Archon Tables

```sql
-- Database: postgres (shared)
-- Archon tables (11 total):
archon_settings, archon_sources, archon_crawled_pages,
archon_code_examples, archon_page_metadata, archon_projects,
archon_tasks, archon_project_sources, archon_document_versions,
archon_migrations, archon_prompts
```

**Design**: This schema-based approach is correct and matches industry standards for multi-tenant database design.

**See**: `@.claude/docs/DATABASE_CONFIG.md` for complete database architecture

---

## Connection Methods

| Method | URL/Hostname | Use Case | Status | Notes |
|--------|--------------|----------|--------|-------|
| **Direct DB** | `supabase-ai-db:5432` | PostgreSQL queries | ✅ Recommended | Requires `localai_default` network |
| **Kong Gateway** | `host.docker.internal:18000` | REST API, Auth | ✅ Works | For Supabase API calls |
| **Pooler** | `host.docker.internal:5432` | Connection pooling | ⚠️ Avoid | Causes "tenant not found" errors |

### Why Direct DB is Recommended

1. **Performance**: No proxy overhead
2. **Reliability**: Direct TCP connection
3. **Compatibility**: Works with all PostgreSQL clients
4. **DNS Resolution**: Uses Docker network DNS

### Environment Variables

```bash
# Kong Gateway (REST API, Auth)
SUPABASE_URL=http://host.docker.internal:18000

# Direct Database Connection (requires localai_default network)
DATABASE_URI=postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres

# Service Key
SUPABASE_SERVICE_KEY=<JWT_token>
```

---

## Network Requirements Checklist

Before starting Archon, verify:

- [ ] local-ai-packaged is running (`docker ps | grep supabase-ai-db`)
- [ ] `localai_default` network exists (`docker network ls | grep localai_default`)
- [ ] `sporterp-ai-unified` network exists (if integrating with SportERP)
- [ ] Ports 8051, 8181, 3737 are available (`lsof -i :8051,8181,3737`)

### Startup Dependency

```
1. Start local-ai-packaged
   └─ Creates localai_default network
   └─ Starts supabase-ai-db

2. Start Archon
   └─ Joins localai_default network
   └─ Resolves supabase-ai-db via DNS
   └─ Connects to PostgreSQL

3. (Optional) Start SportERP
   └─ Uses sporterp-ai-unified network
```

---

## Troubleshooting Network Issues

### Problem: "Temporary failure in name resolution"

**Symptoms:**
- archon-server fails to start
- Logs show "could not translate host name supabase-ai-db"
- Database connection errors

**Cause**: Archon container not on `localai_default` network

**Solution:**
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
#
# networks:
#   localai_default:
#     external: true

# 3. Restart Archon services
./stop-archon.sh && ./start-archon.sh

# 4. Verify container joined network
docker network inspect localai_default | grep archon-server
```

### Problem: "Tenant or user not found"

**Symptoms:**
- Database queries fail with tenant error
- Connection works but queries return "tenant not found"
- Pooler-related errors

**Cause**: Using pooler instead of direct database connection

**Solution:**
```bash
# 1. Check DATABASE_URI in .env
grep DATABASE_URI .env

# 2. Should use supabase-ai-db (NOT host.docker.internal)
# Correct: DATABASE_URI=postgresql://postgres:PASSWORD@supabase-ai-db:5432/postgres
# Wrong:   DATABASE_URI=postgresql://postgres:PASSWORD@host.docker.internal:5432/postgres

# 3. Update if needed
sed -i 's/host.docker.internal:5432/supabase-ai-db:5432/g' .env

# 4. Restart services
./stop-archon.sh && ./start-archon.sh
```

### Problem: Network not found

**Symptoms:**
- "network localai_default not found" error
- docker-compose fails to start
- Cannot join external network

**Cause**: local-ai-packaged not started or network name mismatch

**Solution:**
```bash
# 1. Check if local-ai-packaged is running
cd ~/Documents/Projects/local-ai-packaged
docker ps | grep supabase-ai-db

# 2. If not running, start it
python start_services.py --profile gpu-amd --amd-backend llamacpp-vulkan

# 3. Verify network exists
docker network ls | grep localai_default

# 4. If network has different name, update docker-compose.yml
docker network ls | grep local  # Find actual name

# 5. Start Archon
cd ~/Documents/Projects/archon
./start-archon.sh
```

### Problem: Cannot connect to Kong Gateway

**Symptoms:**
- HTTP requests to `localhost:18000` fail
- "Connection refused" errors
- Supabase API calls timeout

**Cause**: Kong Gateway not started or port not exposed

**Solution:**
```bash
# 1. Check if Kong is running
docker ps | grep kong

# 2. Check port mapping
docker port $(docker ps -q -f name=kong) 8000

# Should show: 8000/tcp -> 0.0.0.0:18000

# 3. Test connection
curl http://localhost:18000/health

# 4. If fails, restart local-ai-packaged
cd ~/Documents/Projects/local-ai-packaged
docker compose restart kong
```

---

## Advanced Network Configuration

### Custom Network Subnet

If IP ranges conflict, modify `docker-compose.yml`:

```yaml
networks:
  app-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16
          gateway: 172.25.0.1
```

### Network Isolation

For production, isolate networks:

```yaml
networks:
  app-network:
    internal: true  # No external access
  localai_default:
    external: true  # Managed externally
```

### DNS Configuration

For custom DNS resolution:

```yaml
services:
  archon-server:
    dns:
      - 172.18.0.1  # localai_default gateway
      - 8.8.8.8     # Fallback
```

---

## Port Allocation

### Archon Ports

| Port | Service | Purpose |
|------|---------|---------|
| 8051 | archon-mcp | MCP Server |
| 8181 | archon-server | Backend API |
| 3737 | archon-ui | Dashboard UI |
| 8052 | archon-agents | AI Agents (optional) |

### Supabase Ports (via local-ai-packaged)

| Port | Service | Purpose |
|------|---------|---------|
| 18000 | Kong Gateway | API proxy |
| 5432 | PostgreSQL Pooler | Connection pooling |
| 8000 | Kong (internal) | Internal routing |

### Checking Port Availability

```bash
# Check if ports are available
lsof -i :8051,8181,3737,8052 || echo "All Archon ports available"

# Check specific port
netstat -tlnp | grep 8051

# Find process using port
fuser 8051/tcp
```

---

## Network Diagram (Detailed)

```
┌─────────────────────────────────────────────────────────────┐
│  Host Machine (0.0.0.0)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Docker Networks:                                            │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  localai_default (172.18.0.0/16)                      │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │  supabase-ai-db:5432 ─────┐                           │ │
│  │  supabase-ai-kong:8000     │                           │ │
│  │  ollama:11434              │ DNS Resolution            │ │
│  │  qdrant:6333               │                           │ │
│  │                            ▼                           │ │
│  │  archon-server ───────► supabase-ai-db                │ │
│  │  archon-mcp                (PostgreSQL)                │ │
│  │  archon-ui                                             │ │
│  │                                                        │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  sporterp-ai-unified (172.19.0.0/16)                  │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │  archon-server ◄──────► sporterp-api                  │ │
│  │  archon-mcp              sporterp-frontend             │ │
│  │                          sporterp-erp                  │ │
│  │                                                        │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  app-network (172.20.0.0/16)                          │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │  archon-server ◄──────► archon-mcp ◄──────► archon-ui │ │
│  │                                                        │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                              │
│  Port Mappings:                                              │
│    0.0.0.0:8051 → archon-mcp:8051                           │
│    0.0.0.0:8181 → archon-server:8181                        │
│    0.0.0.0:3737 → archon-ui:3000                            │
│    0.0.0.0:18000 → kong:8000                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

**Related Documentation**:
- Main CLAUDE.md: `@.claude/CLAUDE.md`
- Database Config: `@.claude/docs/DATABASE_CONFIG.md`
- System Setup: `@.claude/docs/SYSTEM_SETUP.md`
- Full Architecture: `/docs/NETWORK_ARCHITECTURE_AND_DATABASE_CONNECTION.md`
