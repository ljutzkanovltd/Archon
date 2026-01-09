# MCP Client Setup Guide

**Purpose**: Configure IDE/editor MCP clients to connect to Archon MCP server
**Last Updated**: 2026-01-09
**MCP Server**: http://localhost:8051/mcp
**Protocol**: Model Context Protocol (MCP) with StreamableHTTP transport

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Claude Desktop Setup](#claude-desktop-setup)
- [Cursor Setup](#cursor-setup)
- [Windsurf Setup](#windsurf-setup)
- [Cline (VSCode Extension) Setup](#cline-vscode-extension-setup)
- [Testing Your Connection](#testing-your-connection)
- [Troubleshooting](#troubleshooting)
- [Available MCP Tools](#available-mcp-tools)

---

## Overview

The Archon MCP server provides 19 tools for:
- **Knowledge Base**: Search documentation, code examples, and pages
- **Task Management**: Create, update, and track development tasks
- **Project Management**: Manage projects and features
- **Document Management**: Handle project documentation and versions

All IDEs/editors that support the Model Context Protocol can connect to Archon.

---

## Prerequisites

### 1. Archon MCP Server Running

Verify the MCP server is running:

```bash
# Check MCP server health
curl http://localhost:8051/health

# Expected response:
# {"status":"healthy","service":"archon-mcp"}
```

If not running, start Archon:

```bash
cd ~/Documents/Projects/archon
./start-archon.sh
```

### 2. Network Accessibility

The MCP server runs on `http://localhost:8051/mcp`. Ensure:
- Port 8051 is not blocked by firewall
- Docker containers are running
- No port conflicts with other services

```bash
# Check if port is listening
lsof -i :8051

# Check MCP container
docker ps | grep archon-mcp
```

---

## Claude Desktop Setup

### Configuration File Location

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

### Configuration

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "archon": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "http://localhost:8051/mcp",
        "-H", "Content-Type: application/json",
        "-H", "Accept: application/json, text/event-stream",
        "-d", "@-"
      ],
      "env": {
        "MCP_SERVER_NAME": "archon-mcp-server"
      }
    }
  }
}
```

### Alternative: Using Node.js Bridge (Recommended)

For better stability, use a Node.js bridge script:

**1. Create bridge script** (`~/.config/Claude/archon-mcp-bridge.js`):

```javascript
#!/usr/bin/env node
const http = require('http');

const MCP_URL = 'http://localhost:8051/mcp';

process.stdin.on('data', (data) => {
  const request = http.request(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    }
  }, (res) => {
    res.pipe(process.stdout);
  });

  request.on('error', (error) => {
    console.error('MCP Connection Error:', error);
    process.exit(1);
  });

  request.write(data);
  request.end();
});
```

**2. Make executable**:

```bash
chmod +x ~/.config/Claude/archon-mcp-bridge.js
```

**3. Update configuration**:

```json
{
  "mcpServers": {
    "archon": {
      "command": "node",
      "args": [
        "/home/YOUR_USERNAME/.config/Claude/archon-mcp-bridge.js"
      ],
      "env": {
        "MCP_SERVER_NAME": "archon-mcp-server"
      }
    }
  }
}
```

### Restart Claude Desktop

After configuration:
1. Quit Claude Desktop completely
2. Restart application
3. Check MCP connection in settings

---

## Cursor Setup

### Configuration File Location

**macOS**: `~/Library/Application Support/Cursor/User/globalStorage/mcp-config.json`
**Windows**: `%APPDATA%\Cursor\User\globalStorage\mcp-config.json`
**Linux**: `~/.config/Cursor/User/globalStorage/mcp-config.json`

### Configuration

Create or edit `mcp-config.json`:

```json
{
  "mcpServers": {
    "archon": {
      "url": "http://localhost:8051/mcp",
      "transport": "http",
      "headers": {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      "metadata": {
        "name": "Archon Knowledge Base",
        "description": "Task management and knowledge base for SportERP"
      }
    }
  }
}
```

### Enable MCP in Cursor

1. Open Cursor settings (Cmd/Ctrl + ,)
2. Search for "Model Context Protocol"
3. Enable "MCP Support"
4. Restart Cursor

### Verify Connection

Open Cursor's MCP panel:
1. Click MCP icon in sidebar
2. Check if "archon" server shows as connected
3. Verify tools list shows 19 Archon tools

---

## Windsurf Setup

### Configuration File Location

**macOS**: `~/Library/Application Support/Windsurf/mcp_servers.json`
**Windows**: `%APPDATA%\Windsurf\mcp_servers.json`
**Linux**: `~/.config/Windsurf/mcp_servers.json`

### Configuration

Create or edit `mcp_servers.json`:

```json
{
  "servers": [
    {
      "name": "Archon MCP",
      "url": "http://localhost:8051/mcp",
      "protocol": "http-sse",
      "enabled": true,
      "auth": {
        "type": "none"
      },
      "headers": {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      "metadata": {
        "description": "Archon knowledge base and task management",
        "version": "1.0.0"
      }
    }
  ]
}
```

### Enable in Windsurf

1. Open Windsurf settings
2. Navigate to Extensions → MCP
3. Click "Refresh Servers"
4. Enable "Archon MCP" server
5. Restart Windsurf

---

## Cline (VSCode Extension) Setup

### Installation

1. Open VSCode/Cursor
2. Install "Cline" extension from marketplace
3. Open Cline settings (Cmd/Ctrl + Shift + P → "Cline: Open Settings")

### Configuration

In Cline settings, add MCP server:

**Method 1: Via Settings UI**
1. Open Cline settings panel
2. Click "Add MCP Server"
3. Fill in:
   - **Name**: Archon
   - **URL**: http://localhost:8051/mcp
   - **Transport**: HTTP-SSE
   - **Headers**: `{"Accept": "application/json, text/event-stream"}`

**Method 2: Via settings.json**

Add to VSCode `settings.json`:

```json
{
  "cline.mcpServers": [
    {
      "name": "Archon",
      "url": "http://localhost:8051/mcp",
      "transport": "http-sse",
      "headers": {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      "enabled": true
    }
  ]
}
```

### Verify Connection

1. Open Cline chat panel
2. Type `/mcp` to see available servers
3. Verify "Archon" appears with status "Connected"
4. Type `/tools` to see available Archon tools

---

## Testing Your Connection

### Quick Test Script

Create `test-mcp-connection.sh`:

```bash
#!/bin/bash
# Test Archon MCP Connection

echo "Testing Archon MCP Server Connection"
echo "====================================="
echo ""

# Step 1: Health check
echo "1. Testing health endpoint..."
HEALTH=$(curl -s http://localhost:8051/health)
if [ $? -eq 0 ]; then
    echo "✓ Health endpoint accessible"
    echo "   Response: $HEALTH"
else
    echo "✗ Health endpoint failed"
    exit 1
fi

echo ""

# Step 2: MCP initialize
echo "2. Testing MCP initialize..."
INIT_RESPONSE=$(curl -s -X POST http://localhost:8051/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"initialize",
    "params":{
      "protocolVersion":"2024-11-05",
      "capabilities":{},
      "clientInfo":{
        "name":"test-client",
        "version":"1.0.0"
      }
    }
  }')

if echo "$INIT_RESPONSE" | grep -q "archon-mcp-server"; then
    echo "✓ MCP initialize successful"
else
    echo "✗ MCP initialize failed"
    echo "   Response: $INIT_RESPONSE"
    exit 1
fi

echo ""

# Step 3: List tools
echo "3. Testing tools/list..."
TOOLS_RESPONSE=$(curl -s -X POST http://localhost:8051/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/list",
    "params":{}
  }')

TOOL_COUNT=$(echo "$TOOLS_RESPONSE" | grep -o '"name"' | wc -l)
echo "✓ Found $TOOL_COUNT tools"

echo ""
echo "====================================="
echo "Connection test complete!"
echo "====================================="
```

Make executable and run:

```bash
chmod +x test-mcp-connection.sh
./test-mcp-connection.sh
```

### Manual Test in IDE

Once configured, test in your IDE:

1. **Open chat/assistant panel**
2. **Ask**: "What MCP servers are connected?"
3. **Expected**: Should show "archon" or "Archon MCP"
4. **Ask**: "List available Archon tools"
5. **Expected**: Should list 19 tools (rag_search_knowledge_base, find_tasks, etc.)
6. **Test a tool**: "Use Archon to search for 'authentication' in the knowledge base"

---

## Troubleshooting

### Issue 1: "Connection Refused" Error

**Symptoms**: IDE cannot connect to MCP server

**Diagnosis**:
```bash
# Check if MCP server is running
curl http://localhost:8051/health

# Check Docker containers
docker ps | grep archon-mcp

# Check port availability
lsof -i :8051
```

**Solutions**:
1. Start Archon: `cd ~/Documents/Projects/archon && ./start-archon.sh`
2. Restart MCP container: `docker compose restart archon-mcp`
3. Check logs: `docker logs archon-mcp`

---

### Issue 2: "Bad Request: Not Acceptable" (400 Error)

**Symptoms**: Connection works but tool calls fail with 400 error

**Root Cause**: Missing required headers

**Solution**: Ensure configuration includes both headers:
```json
{
  "Content-Type": "application/json",
  "Accept": "application/json, text/event-stream"
}
```

The `text/event-stream` header is **required** for StreamableHTTP transport.

---

### Issue 3: "Bad Request: Missing session ID"

**Symptoms**: Tool calls fail with "Missing session ID" error

**Root Cause**: MCP handshake not completed properly

**Solution**: Ensure your MCP client:
1. Sends `initialize` request first
2. Waits for initialize response
3. Sends `notifications/initialized` notification
4. Then makes tool calls

Most MCP clients handle this automatically. If using curl/custom client, follow the MCP protocol handshake.

---

### Issue 4: Tools Not Appearing in IDE

**Symptoms**: IDE connects but shows 0 tools

**Diagnosis**:
```bash
# Check MCP server logs
docker logs archon-mcp | grep "modules registered"

# Expected: "Total modules registered: 6"
```

**Solutions**:
1. Restart MCP server: `docker compose restart archon-mcp`
2. Check for errors in logs: `docker logs archon-mcp | grep ERROR`
3. Verify backend API is running: `curl http://localhost:8181/api/health`

---

### Issue 5: Session Tracking Not Working

**Symptoms**: Dashboard shows no connected clients despite using MCP

**Diagnosis**:
```bash
# Check session database
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) FROM archon_mcp_sessions;"

# Check request tracking
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT COUNT(*) FROM archon_mcp_requests;"
```

**Expected Behavior**:
- Sessions created on first tool call (lazy creation)
- Each tool call tracked in `archon_mcp_requests`

**Solutions**:
1. Wait a few seconds after tool call for database write
2. Check MCP logs for session creation: `docker logs archon-mcp | grep "session created"`
3. Verify database connectivity: `docker exec archon-mcp env | grep DATABASE`

---

### Issue 6: Slow Response Times

**Symptoms**: Tool calls take >5 seconds

**Diagnosis**:
```bash
# Check Docker resource usage
docker stats archon-mcp

# Check network latency
time curl http://localhost:8051/health
```

**Solutions**:
1. Increase Docker memory limits (docker-compose.yml)
2. Check database performance (pgvector queries can be slow)
3. Enable caching for frequently accessed data
4. Review MCP logs for slow HTTP calls to backend API

---

### Debug Checklist

When MCP connection fails, check in order:

- [ ] Archon services running: `docker ps | grep archon`
- [ ] MCP server health: `curl http://localhost:8051/health`
- [ ] Backend API health: `curl http://localhost:8181/api/health`
- [ ] Database connectivity: `docker exec supabase-ai-db psql -U postgres -c "SELECT 1"`
- [ ] Port 8051 accessible: `lsof -i :8051`
- [ ] Configuration file correct path and syntax
- [ ] Headers include `text/event-stream`
- [ ] IDE MCP support enabled
- [ ] IDE restarted after configuration change
- [ ] MCP logs show no errors: `docker logs archon-mcp`

---

## Available MCP Tools

### Knowledge Base Tools (5)

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `rag_get_available_sources` | List all knowledge sources | "What documentation sources are available?" |
| `rag_search_knowledge_base` | Search docs with semantic search | "Search for authentication patterns" |
| `rag_search_code_examples` | Find code examples | "Find React component examples" |
| `rag_list_pages_for_source` | List pages in a source | "Show all pages in Supabase docs" |
| `rag_read_full_page` | Read complete page content | "Read the page about vector search" |

### Task Management Tools (5)

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `find_tasks` | Search and list tasks | "Show all TODO tasks for project X" |
| `manage_task` | Create/update/delete tasks | "Create a task to fix authentication bug" |
| `get_task_history` | View task change log | "Show history for task 123" |
| `get_completion_stats` | Get completion metrics | "How many tasks were completed this week?" |
| `get_task_versions` | View task field versions | "Show version history for task description" |

### Project Management Tools (2)

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `find_projects` | Search projects | "List all active projects" |
| `manage_project` | Create/update/delete projects | "Create project for dark mode feature" |

### Document Management Tools (2)

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `find_documents` | Search project documents | "Find API specifications" |
| `manage_document` | Create/update/delete docs | "Create design doc for auth system" |

### Version Management Tools (2)

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `find_versions` | List document versions | "Show version history for API spec" |
| `manage_version` | Create/restore versions | "Restore version 3 of PRD" |

### Feature Management Tools (1)

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `get_project_features` | List project features | "What features are in project X?" |

### System Tools (2)

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `health_check` | Check MCP server health | "Check if Archon is healthy" |
| `session_info` | Get session information | "How many active MCP sessions?" |

---

## Best Practices

### 1. Query Optimization

**Knowledge Base Searches**:
- ✅ Use 2-5 keywords: "React hooks useState"
- ❌ Avoid long sentences: "How do I use React hooks with useState and functional components"

**Task Searches**:
- Use `filter_by` parameter for efficient queries
- Specify `project_id` to narrow results
- Set reasonable `per_page` limits (default: 10)

### 2. Session Management

- MCP server tracks sessions automatically
- Sessions created on first tool call
- Dashboard shows active connections: http://localhost:3737

### 3. Error Handling

- Always check tool response for `success: false`
- Tool errors include detailed error messages
- Check MCP logs for debugging: `docker logs archon-mcp`

### 4. Performance

- Cache frequently accessed knowledge base results
- Use specific queries instead of broad searches
- Monitor dashboard for slow queries
- Set appropriate timeouts in IDE configuration (30-60 seconds)

---

## Support

### Documentation

- **Main README**: `/home/ljutzkanov/Documents/Projects/archon/README.md`
- **MCP Architecture**: `/home/ljutzkanov/Documents/Projects/archon/docs/NETWORK_ARCHITECTURE.md`
- **API Reference**: `/home/ljutzkanov/Documents/Projects/archon/docs/API_REFERENCE.md`
- **Session Tracking**: `/home/ljutzkanov/Documents/Projects/archon/docs/MCP_SESSION_TRACKING_IMPLEMENTATION_SUMMARY.md`

### Monitoring

- **MCP Dashboard**: http://localhost:3737
- **Backend API**: http://localhost:8181
- **Health Endpoint**: http://localhost:8051/health

### Logs

```bash
# MCP server logs
docker logs -f archon-mcp

# Backend API logs
docker logs -f archon-server

# Database logs
docker logs -f supabase-ai-db

# All Archon logs
docker compose logs -f
```

---

## Advanced Configuration

### Custom Timeouts

```json
{
  "mcpServers": {
    "archon": {
      "url": "http://localhost:8051/mcp",
      "timeout": 60000,
      "retries": 3,
      "retryDelay": 1000
    }
  }
}
```

### Environment Variables

Set in IDE or shell before starting:

```bash
export MCP_SERVER_URL="http://localhost:8051/mcp"
export MCP_TIMEOUT="60000"
export MCP_DEBUG="true"
```

### Proxy Configuration

If behind corporate proxy:

```json
{
  "mcpServers": {
    "archon": {
      "url": "http://localhost:8051/mcp",
      "proxy": "http://proxy.company.com:8080",
      "proxyAuth": {
        "username": "user",
        "password": "pass"
      }
    }
  }
}
```

---

## Security Notes

### Current Security

- ✅ MCP server runs on localhost only (not exposed publicly)
- ✅ No authentication required (single-user development mode)
- ✅ Session tracking for audit trail
- ✅ No sensitive data in logs

### Future Security (Multi-User)

- 🔒 JWT authentication
- 🔒 Per-user session isolation
- 🔒 Rate limiting
- 🔒 HTTPS for remote connections

---

**Last Updated**: 2026-01-09
**Version**: 1.0.0
**Maintainer**: SportERP Team
**MCP Protocol**: 2024-11-05
