# System Setup - Archon Knowledge Base

Complete system prerequisite configuration for Archon services.

---

## Required System Configuration

Before starting Archon services, ensure your system meets these requirements.

### 1. inotify File Watch Limits

**Issue:** Archon containers may fail to start with "no space left on device" errors when the system's file watch limit is too low.

**Required Limit:** `fs.inotify.max_user_watches=524288` (minimum)

#### Automated Configuration

```bash
# Run the setup script to configure all system requirements
sudo ./scripts/setup-system.sh

# Or configure only inotify limits
sudo ./scripts/setup-system.sh --inotify

# Check current configuration without making changes
sudo ./scripts/setup-system.sh --check
```

#### Manual Configuration

```bash
# Set runtime value (temporary, until reboot)
sudo sysctl -w fs.inotify.max_user_watches=524288

# Make persistent across reboots
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### Verification

```bash
# Check current limit
sysctl fs.inotify.max_user_watches

# Should output: fs.inotify.max_user_watches = 524288
```

### 2. Docker Requirements

**Minimum Requirements:**
- Docker Engine 20.10+ or Docker Desktop
- Docker Compose v2.0+
- Minimum 10GB available disk space
- 4GB RAM recommended (2GB minimum)

**Verification:**
```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker compose version

# Check available disk space
df -h /var/lib/docker

# Check available memory
free -h
```

### 3. Network Requirements

**CRITICAL**: Archon requires THREE Docker networks for proper operation:

#### Network 1: `localai_default` (External)

**Purpose**: **REQUIRED** for Supabase database access
- Provides DNS resolution for `supabase-ai-db` hostname
- Enables direct PostgreSQL connection
- Managed by local-ai-packaged project
- **Must start local-ai-packaged BEFORE Archon**

**Verification:**
```bash
# Check if network exists
docker network ls | grep localai_default

# Check if supabase-ai-db is on network
docker network inspect localai_default | grep supabase-ai-db
```

#### Network 2: `sporterp-ai-unified` (External)

**Purpose**: For SportERP integration
- Communication with SportERP services
- Managed by local-ai-packaged/sporterp-apps

**Verification:**
```bash
# Check if network exists
docker network ls | grep sporterp-ai-unified
```

#### Network 3: `app-network` (Internal)

**Purpose**: For Archon internal services
- archon-server ↔ archon-mcp ↔ archon-ui communication
- Managed by Archon docker-compose.yml
- Created automatically when Archon starts

**Verification:**
```bash
# Check if network exists (after Archon starts)
docker network ls | grep app-network

# Check Archon containers on network
docker network inspect app-network | grep -E "archon-server|archon-mcp|archon-ui"
```

### 4. Port Requirements

**Archon Ports:**
- 8051 - MCP Server
- 8181 - Backend API
- 3737 - Dashboard UI
- 8052 - AI Agents (optional)

**Supabase Ports (via local-ai-packaged):**
- 18000 - Kong Gateway
- 5432 - PostgreSQL Pooler

**Verification:**
```bash
# Check if ports are available
lsof -i :8051,8181,3737,8052 || echo "All Archon ports available"

# Check if Supabase ports are in use (should be in use if local-ai running)
lsof -i :18000,5432
```

---

## Troubleshooting System Prerequisites

### Problem: archon-server container exits immediately after starting

**Symptoms:**
- Container starts and immediately exits
- `docker ps` shows no archon containers running
- `docker logs archon-server` shows "no space left on device" error

**Solution:**
```bash
# 1. Check inotify limits
sysctl fs.inotify.max_user_watches

# 2. If below 524288, configure inotify
sudo ./scripts/setup-system.sh --inotify

# 3. Restart Archon services
./stop-archon.sh && ./start-archon.sh
```

### Problem: "Permission denied" errors during setup

**Symptoms:**
- Setup script fails with permission errors
- Docker commands require sudo
- Cannot write to /etc/sysctl.conf

**Solution:**
```bash
# 1. Ensure running with sudo
sudo ./scripts/setup-system.sh

# 2. Check user is in docker group
groups

# Should output: ... docker ...

# 3. Add user to docker group if needed
sudo usermod -aG docker $USER

# 4. Log out and log back in for group changes to take effect
# (or run: newgrp docker)
```

### Problem: Network not found errors

**Symptoms:**
- "network localai_default not found" error
- Archon containers cannot connect to Supabase
- DNS resolution fails for supabase-ai-db

**Solution:**
```bash
# 1. Verify local-ai-packaged is running
cd ~/Documents/Projects/local-ai-packaged
docker compose ps | grep supabase-ai-db

# 2. If not running, start local-ai-packaged
python start_services.py --profile gpu-amd --amd-backend llamacpp-vulkan

# 3. Verify network exists
docker network ls | grep localai_default

# 4. Restart Archon to join network
cd ~/Documents/Projects/archon
./stop-archon.sh && ./start-archon.sh
```

### Problem: Port already in use

**Symptoms:**
- "port is already allocated" error
- Services fail to start
- Conflicting applications

**Solution:**
```bash
# 1. Find process using the port
lsof -i :8051  # Replace with actual port

# 2. Option A: Stop the conflicting process
kill -9 <PID>

# 2. Option B: Change Archon port in docker-compose.yml
# Edit docker-compose.yml:
# ports:
#   - "8052:8051"  # Use different host port

# 3. Restart Archon
./stop-archon.sh && ./start-archon.sh
```

---

## Pre-Start Checklist

Before starting Archon for the first time, verify:

- [ ] inotify limit set to 524288 (`sysctl fs.inotify.max_user_watches`)
- [ ] Docker Engine 20.10+ installed (`docker --version`)
- [ ] Docker Compose v2.0+ installed (`docker compose version`)
- [ ] At least 10GB disk space available (`df -h /var/lib/docker`)
- [ ] At least 2GB RAM available (`free -h`)
- [ ] User in docker group (`groups | grep docker`)
- [ ] local-ai-packaged running (`docker ps | grep supabase-ai-db`)
- [ ] `localai_default` network exists (`docker network ls | grep localai_default`)
- [ ] Ports 8051, 8181, 3737 available (`lsof -i :8051,8181,3737`)

---

## Automated Setup Script

The `./scripts/setup-system.sh` script automates all system configuration.

**Usage:**
```bash
# Configure all requirements
sudo ./scripts/setup-system.sh

# Configure only inotify
sudo ./scripts/setup-system.sh --inotify

# Check configuration without changes
sudo ./scripts/setup-system.sh --check

# Verbose output
sudo ./scripts/setup-system.sh --verbose
```

**What it does:**
1. Checks and sets inotify limits
2. Verifies Docker installation
3. Checks user permissions
4. Validates network requirements
5. Verifies port availability
6. Creates persistent configuration

**Script Location:** `/home/ljutzkanov/Documents/Projects/archon/scripts/setup-system.sh`

---

**Related Documentation**:
- Main CLAUDE.md: `@.claude/CLAUDE.md`
- Network Architecture: `@.claude/docs/NETWORK_ARCHITECTURE.md`
- Database Config: `@.claude/docs/DATABASE_CONFIG.md`
- Backup Procedures: `@.claude/docs/BACKUP_PROCEDURES.md`
