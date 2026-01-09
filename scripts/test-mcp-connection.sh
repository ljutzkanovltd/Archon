#!/bin/bash
# Test Archon MCP Connection
# Tests basic connectivity and MCP protocol handshake

set -e

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
    echo "   Server: $(echo "$INIT_RESPONSE" | grep -o '"name":"[^"]*"' | head -1)"
else
    echo "✗ MCP initialize failed"
    echo "   Response: $INIT_RESPONSE"
    exit 1
fi

echo ""

# Step 3: Send initialized notification
echo "3. Sending initialized notification..."
curl -s -X POST http://localhost:8051/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "method":"notifications/initialized",
    "params":{
      "clientInfo":{
        "name":"test-client",
        "version":"1.0.0"
      }
    }
  }' > /dev/null

echo "✓ Initialized notification sent"

echo ""

# Step 4: List tools (requires valid session after handshake)
echo "4. Testing tools/list..."
TOOLS_RESPONSE=$(curl -s -X POST http://localhost:8051/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/list",
    "params":{}
  }')

if echo "$TOOLS_RESPONSE" | grep -q "tools"; then
    TOOL_COUNT=$(echo "$TOOLS_RESPONSE" | grep -o '"name"' | wc -l)
    echo "✓ Found $TOOL_COUNT tools"

    # Show first 5 tools
    echo ""
    echo "   Sample tools:"
    echo "$TOOLS_RESPONSE" | grep -o '"name":"[^"]*"' | head -5 | sed 's/"name":"/   - /' | sed 's/"$//'
else
    echo "✗ Tools list failed"
    echo "   Response: $TOOLS_RESPONSE"
fi

echo ""

# Step 5: Check backend API connectivity
echo "5. Testing backend API connectivity..."
API_HEALTH=$(curl -s http://localhost:8181/api/health)
if [ $? -eq 0 ]; then
    echo "✓ Backend API accessible"
    echo "   Response: $API_HEALTH"
else
    echo "✗ Backend API failed"
fi

echo ""

# Step 6: Check database connectivity
echo "6. Testing database connectivity..."
DB_CHECK=$(docker exec supabase-ai-db psql -U postgres -d postgres -t -c "SELECT 1" 2>/dev/null || echo "error")
if [ "$DB_CHECK" == " 1" ]; then
    echo "✓ Database accessible"
else
    echo "✗ Database connection failed"
fi

echo ""
echo "====================================="
echo "Connection test complete!"
echo "====================================="
echo ""
echo "Next steps:"
echo "1. Configure your IDE using docs/MCP_CLIENT_SETUP.md"
echo "2. Restart your IDE after configuration"
echo "3. Test MCP tools from your IDE chat/assistant"
echo ""
echo "Dashboard: http://localhost:3737"
echo "API Docs:  http://localhost:8181/docs"
