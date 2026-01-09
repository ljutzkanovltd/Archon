#!/bin/bash
# Test MCP Session Tracking
# Tests the complete MCP handshake: initialize + initialized notification

set -e

echo "======================================"
echo "  MCP Session Tracking Test"
echo "======================================"
echo ""

MCP_URL="http://localhost:8051/mcp"

# Step 1: Send initialize request
echo "Step 1: Sending initialize request..."
INIT_RESPONSE=$(curl -s -X POST "$MCP_URL" \
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
        "name":"test-client-tracking",
        "version":"1.0.0"
      }
    }
  }')

echo "✓ Initialize response received"
echo ""

# Step 2: Send initialized notification (this triggers session creation)
echo "Step 2: Sending initialized notification..."
NOTIF_RESPONSE=$(curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "method":"notifications/initialized",
    "params":{
      "clientInfo":{
        "name":"test-client-tracking",
        "version":"1.0.0"
      }
    }
  }')

echo "✓ Initialized notification sent"
echo ""

# Step 3: Wait for session creation
echo "Step 3: Waiting for session creation (2 seconds)..."
sleep 2

# Step 4: Check database for session
echo "Step 4: Checking database for session..."
docker exec supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT session_id, client_type, status, connected_at FROM archon_mcp_sessions ORDER BY connected_at DESC LIMIT 1;"

echo ""

# Step 5: Check MCP server logs
echo "Step 5: Checking MCP server logs..."
docker logs archon-mcp 2>&1 | grep -E "MCP client connected|session:" | tail -3

echo ""
echo "======================================"
echo "  Test Complete"
echo "======================================"
