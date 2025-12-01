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

- Ports must be available: 8051, 8181, 3737, 8052 (optional), 8000-8002 (Supabase)
- Access to Supabase cloud (if using cloud instance) or local-ai-packaged services
- Bridge network `sporterp-ai-unified` (created by local-ai-packaged)

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
