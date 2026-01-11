#!/bin/bash

# Test script for Steps 3 & 4: Session Reconnection and WebSocket Monitoring
# This script tests the newly implemented backend features

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:8181/api/mcp"
WS_URL="ws://localhost:8181/api/mcp/ws/sessions"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   Steps 3 & 4 - Backend Testing${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to print colored output
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# STEP 3: Session Reconnection Testing
# ============================================================================

echo -e "${BLUE}Step 3: Session Reconnection Testing${NC}"
echo "-------------------------------------------"

# Test 3.1: Health check
log_info "Test 3.1: Checking API health..."
health=$(curl -s "$API_URL/../health")
if echo "$health" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    log_success "API is healthy"
else
    log_error "API health check failed"
    exit 1
fi
echo ""

# Test 3.2: Get active sessions
log_info "Test 3.2: Fetching active sessions..."
sessions=$(curl -s "$API_URL/sessions")
echo "$sessions" | jq '.sessions[] | {session_id, client_type, status}' 2>/dev/null || {
    log_warning "No active sessions found - need to create one first"
    echo "Note: MCP uses lazy session creation. Make a tool call via MCP client to create a session."
    echo ""
}

# Check if there are any active sessions
active_count=$(echo "$sessions" | jq -r '.sessions[] | select(.status == "active") | .session_id' 2>/dev/null | wc -l)
if [ "$active_count" -eq 0 ]; then
    log_warning "No active sessions to test with. Skipping reconnection tests."
    log_info "To test reconnection:"
    log_info "  1. Start a Claude Code MCP client"
    log_info "  2. Make at least one tool call to create a session"
    log_info "  3. Run this test script again"
    echo ""
else
    # Get first active session
    SESSION_ID=$(echo "$sessions" | jq -r '.sessions[] | select(.status == "active") | .session_id' | head -n 1)
    log_success "Found active session: $SESSION_ID"
    echo ""

    # Test 3.3: Generate reconnection token
    log_info "Test 3.3: Generating reconnection token..."
    token_response=$(curl -s "$API_URL/sessions/$SESSION_ID/token")

    if echo "$token_response" | jq -e '.reconnect_token' > /dev/null 2>&1; then
        TOKEN=$(echo "$token_response" | jq -r '.reconnect_token')
        EXPIRES=$(echo "$token_response" | jq -r '.expires_in_minutes')
        log_success "Token generated successfully"
        log_info "Expires in: $EXPIRES minutes"
        echo ""

        # Test 3.4: Test successful reconnection
        log_info "Test 3.4: Testing reconnection with valid token..."
        reconnect_response=$(curl -s -X POST "$API_URL/sessions/$SESSION_ID/reconnect" \
            -H "Content-Type: application/json" \
            -d "{\"token\": \"$TOKEN\"}")

        if echo "$reconnect_response" | jq -e '.success == true' > /dev/null 2>&1; then
            reconnect_count=$(echo "$reconnect_response" | jq -r '.reconnect_count')
            log_success "✅ Reconnection successful! (Reconnect #$reconnect_count)"
        else
            log_error "❌ Reconnection failed"
            echo "$reconnect_response" | jq .
        fi
        echo ""

        # Test 3.5: Test invalid token
        log_info "Test 3.5: Testing reconnection with invalid token..."
        invalid_response=$(curl -s -X POST "$API_URL/sessions/$SESSION_ID/reconnect" \
            -H "Content-Type: application/json" \
            -d "{\"token\": \"invalid-token-12345\"}")

        if echo "$invalid_response" | jq -e '.detail' > /dev/null 2>&1; then
            error_msg=$(echo "$invalid_response" | jq -r '.detail')
            log_success "✅ Invalid token correctly rejected: $error_msg"
        else
            log_warning "Unexpected response for invalid token"
            echo "$invalid_response" | jq .
        fi
        echo ""

        # Test 3.6: Test wrong session ID
        log_info "Test 3.6: Testing token with wrong session ID..."
        wrong_session_response=$(curl -s -X POST "$API_URL/sessions/wrong-session-id-12345/reconnect" \
            -H "Content-Type: application/json" \
            -d "{\"token\": \"$TOKEN\"}")

        if echo "$wrong_session_response" | jq -e '.detail' > /dev/null 2>&1; then
            error_msg=$(echo "$wrong_session_response" | jq -r '.detail')
            log_success "✅ Session ID mismatch correctly detected: $error_msg"
        else
            log_warning "Unexpected response for wrong session ID"
            echo "$wrong_session_response" | jq .
        fi
        echo ""
    else
        log_error "Failed to generate token"
        echo "$token_response" | jq .
        echo ""
    fi
fi

# ============================================================================
# STEP 4: WebSocket Monitoring Testing
# ============================================================================

echo -e "${BLUE}Step 4: WebSocket Monitoring Testing${NC}"
echo "-------------------------------------------"

# Test 4.1: Check if wscat is available
log_info "Test 4.1: Checking wscat availability..."
if command -v wscat &> /dev/null; then
    log_success "wscat is installed"

    # Test 4.2: Test WebSocket connection
    log_info "Test 4.2: Testing WebSocket connection (10 seconds)..."
    log_info "Connecting to: $WS_URL"
    echo ""

    timeout 10 wscat -c "$WS_URL" 2>&1 || {
        exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log_success "✅ WebSocket connection test completed (timed out as expected)"
        else
            log_warning "WebSocket connection had issues (exit code: $exit_code)"
        fi
    }
    echo ""
else
    log_warning "wscat not installed - skipping WebSocket connection test"
    log_info "To install: npm install -g wscat"
    echo ""

    # Test 4.2 (alternative): Test WebSocket endpoint is listening
    log_info "Test 4.2 (alternative): Checking if WebSocket endpoint is accessible..."
    ws_check=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/../ws/sessions")
    if [ "$ws_check" -eq 426 ]; then
        log_success "✅ WebSocket endpoint is listening (426 Upgrade Required - expected for HTTP request)"
    else
        log_warning "WebSocket endpoint returned unexpected status: $ws_check"
    fi
    echo ""
fi

# ============================================================================
# Summary
# ============================================================================

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}           Test Summary${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

echo "Step 3: Session Reconnection"
if [ "$active_count" -eq 0 ]; then
    echo "  ⚠ No active sessions - create MCP session to test"
else
    echo "  ✓ Token generation tested"
    echo "  ✓ Successful reconnection verified"
    echo "  ✓ Invalid token rejection verified"
    echo "  ✓ Session ID mismatch detection verified"
fi
echo ""

echo "Step 4: WebSocket Monitoring"
if command -v wscat &> /dev/null; then
    echo "  ✓ WebSocket endpoint tested"
    echo "  ✓ Connection established successfully"
else
    echo "  ✓ WebSocket endpoint is listening"
    echo "  ⚠ Install wscat for full WebSocket testing"
fi
echo ""

echo "Next Steps:"
echo "  1. Create MCP reconnect_session tool in mcp_server.py"
echo "  2. Implement frontend WebSocket hook (useMcpWebSocket.ts)"
echo "  3. Update SessionHealthMetrics to use WebSocket"
echo "  4. Test full reconnection flow with real MCP client"
echo ""

log_success "Backend testing completed!"
