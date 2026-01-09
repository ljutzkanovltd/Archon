#!/bin/bash
# Test script for single-user MCP session tracking
# Created: 2026-01-09

set -e

echo "========================================="
echo " MCP Single-User Session Tracking Test"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if MCP server is running
echo "1. Checking MCP server status..."
if docker ps | grep -q "archon-mcp"; then
    echo -e "${GREEN}✓${NC} MCP server is running"
else
    echo -e "${RED}✗${NC} MCP server is not running!"
    echo "   Run: docker compose up archon-mcp"
    exit 1
fi
echo ""

# Step 2: Check if session was created on startup
echo "2. Checking for active sessions..."
SESSIONS=$(docker exec -i supabase-ai-db psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM archon_mcp_sessions WHERE status='active';")

if [ "$SESSIONS" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Active sessions: $SESSIONS"
else
    echo -e "${YELLOW}⚠${NC} No active sessions yet (expected if no MCP client connected)"
    echo "   Session will be created on first MCP tool call"
fi
echo ""

# Step 3: Check for tracked requests
echo "3. Checking for tracked tool requests..."
REQUESTS=$(docker exec -i supabase-ai-db psql -U postgres -d postgres -tAc \
  "SELECT COUNT(*) FROM archon_mcp_requests;")

if [ "$REQUESTS" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Tracked requests: $REQUESTS"
else
    echo -e "${YELLOW}⚠${NC} No requests tracked yet"
    echo "   Make an MCP tool call from Claude Code to test tracking"
fi
echo ""

# Step 4: Display session details (if any exist)
echo "4. Session Details:"
echo "==================="
SESSION_DATA=$(docker exec -i supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT session_id, client_type, status, user_email, connected_at FROM archon_mcp_sessions ORDER BY connected_at DESC LIMIT 1;" 2>&1)

if echo "$SESSION_DATA" | grep -q "0 rows"; then
    echo -e "${YELLOW}No sessions found${NC}"
else
    echo "$SESSION_DATA"
fi
echo ""

# Step 5: Display recent requests (if any exist)
echo "5. Recent Tool Requests:"
echo "========================"
REQUEST_DATA=$(docker exec -i supabase-ai-db psql -U postgres -d postgres -c \
  "SELECT tool_name, status, duration_ms, timestamp FROM archon_mcp_requests ORDER BY timestamp DESC LIMIT 5;" 2>&1)

if echo "$REQUEST_DATA" | grep -q "0 rows"; then
    echo -e "${YELLOW}No requests found${NC}"
else
    echo "$REQUEST_DATA"
fi
echo ""

# Step 6: Check MCP server logs for session creation
echo "6. Checking MCP server logs..."
echo "==============================="
if docker logs archon-mcp 2>&1 | grep -q "Global MCP session created"; then
    SESSION_ID=$(docker logs archon-mcp 2>&1 | grep "Global MCP session created" | tail -1 | awk -F': ' '{print $NF}')
    echo -e "${GREEN}✓${NC} Found global session creation in logs"
    echo "   Session ID: $SESSION_ID"
else
    echo -e "${YELLOW}⚠${NC} No global session creation log found"
    echo "   This may mean the lifespan hasn't been triggered yet"
    echo "   Try making an MCP tool call to trigger initialization"
fi
echo ""

# Final summary
echo "========================================="
echo " Test Summary"
echo "========================================="

SUCCESS_COUNT=0
TOTAL_CHECKS=3

# Check 1: Server running
if docker ps | grep -q "archon-mcp"; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
fi

# Check 2: Sessions exist OR logs show creation
if [ "$SESSIONS" -gt 0 ] || docker logs archon-mcp 2>&1 | grep -q "Global MCP session created"; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo -e "${GREEN}✓${NC} Session tracking infrastructure: READY"
else
    echo -e "${YELLOW}⚠${NC} Session tracking infrastructure: PENDING (needs MCP connection)"
fi

# Check 3: Requests tracked
if [ "$REQUESTS" -gt 0 ]; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo -e "${GREEN}✓${NC} Request tracking: WORKING"
else
    echo -e "${YELLOW}⚠${NC} Request tracking: PENDING (needs tool calls)"
fi

echo ""
if [ "$SUCCESS_COUNT" -eq "$TOTAL_CHECKS" ]; then
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN} ✅ SUCCESS: All checks passed!${NC}"
    echo -e "${GREEN}=========================================${NC}"
    exit 0
elif [ "$SUCCESS_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}=========================================${NC}"
    echo -e "${YELLOW} ⚠ PARTIAL: $SUCCESS_COUNT/$TOTAL_CHECKS checks passed${NC}"
    echo -e "${YELLOW} Next step: Make an MCP tool call to trigger session creation${NC}"
    echo -e "${YELLOW}=========================================${NC}"
    exit 0
else
    echo -e "${RED}=========================================${NC}"
    echo -e "${RED} ❌ FAILED: No checks passed${NC}"
    echo -e "${RED} Check MCP server logs for errors${NC}"
    echo -e "${RED}=========================================${NC}"
    exit 1
fi
