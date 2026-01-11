#!/bin/bash

#
# Launch MCP Inspector for Archon Debugging
#
# This script:
# 1. Verifies Archon MCP server is running
# 2. Launches MCP Inspector with correct configuration
# 3. Provides connection instructions
#

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
MCP_SERVER_URL="http://localhost:8051"
MCP_ENDPOINT="${MCP_SERVER_URL}/mcp"
INSPECTOR_PORT="${MCP_INSPECTOR_PORT:-5173}"

echo "================================================"
echo "  MCP Inspector Launcher for Archon"
echo "================================================"
echo ""

# Step 1: Check if Archon MCP server is running
echo -n "Checking Archon MCP server... "
if curl -s "${MCP_SERVER_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo ""
    echo "Archon MCP server is not running!"
    echo "Start it with: ./start-archon.sh"
    echo ""
    exit 1
fi

# Step 2: Display server information
echo ""
echo "Server Information:"
echo "  URL: ${MCP_SERVER_URL}"
echo "  MCP Endpoint: ${MCP_ENDPOINT}"
echo "  Health: $(curl -s ${MCP_SERVER_URL}/health | jq -r '.status' 2>/dev/null || echo 'unknown')"
echo ""

# Step 3: Check if npx is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx not found${NC}"
    echo "Install Node.js and npm first:"
    echo "  https://nodejs.org/"
    exit 1
fi

# Step 4: Display connection instructions
echo "================================================"
echo "  Connection Instructions"
echo "================================================"
echo ""
echo "Once MCP Inspector opens in your browser:"
echo ""
echo "  1. Server URL: ${MCP_ENDPOINT}"
echo "  2. Transport: HTTP"
echo "  3. Click 'Connect'"
echo ""
echo "You can then:"
echo "  - View available tools"
echo "  - Test tool calls interactively"
echo "  - Inspect request/response messages"
echo "  - Monitor session management"
echo ""
echo "================================================"
echo ""

# Step 5: Launch MCP Inspector
echo -e "${YELLOW}Launching MCP Inspector...${NC}"
echo "Press Ctrl+C to stop Inspector when done"
echo ""

# Export environment variables for Inspector
export MCP_INSPECTOR_PORT="${INSPECTOR_PORT}"

# Launch Inspector (this will block until user exits)
npx @modelcontextprotocol/inspector

echo ""
echo -e "${GREEN}MCP Inspector closed${NC}"
echo ""
