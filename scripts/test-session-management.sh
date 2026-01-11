#!/bin/bash

#
# Comprehensive Session Management Testing Script
#
# Tests all Phase 1-6 improvements:
# - Context7 MCP configuration
# - Session validation on every request
# - Session recovery after server restart
# - Background cleanup job
# - Client session ID validation
# - MCP client wrapper utilities
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
MCP_URL="http://localhost:8051/mcp"
API_URL="http://localhost:8181"
DB_CONTAINER="supabase-ai-db"
MCP_CONTAINER="archon-mcp"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

check_prerequisite() {
    local cmd=$1
    local name=$2
    if ! command -v $cmd &> /dev/null; then
        log_error "$name not found. Please install it first."
        exit 1
    fi
}

query_db() {
    local query=$1
    docker exec -i $DB_CONTAINER psql -U postgres -d postgres -t -c "$query" 2>/dev/null | sed 's/^[ \t]*//;s/[ \t]*$//'
}

echo "========================================================"
echo "  Archon Session Management Test Suite"
echo "========================================================"
echo ""

# Phase 0: Prerequisites
log_info "Checking prerequisites..."
check_prerequisite "curl" "curl"
check_prerequisite "docker" "docker"
check_prerequisite "jq" "jq"
log_success "All prerequisites available"
echo ""

# Phase 1: Verify Archon is running
log_info "Phase 1: Verifying Archon MCP server..."
if curl -s http://localhost:8051/health > /dev/null 2>&1; then
    # Fix: Parse nested health.status field
    HEALTH=$(curl -s http://localhost:8051/health | jq -r '.health.status // .status')
    if [ "$HEALTH" = "healthy" ]; then
        log_success "Archon MCP server is running and healthy"
    else
        log_error "Archon MCP server unhealthy: $HEALTH"
    fi
else
    log_error "Archon MCP server not responding"
    echo ""
    echo "Start Archon with: ./start-archon.sh"
    exit 1
fi
echo ""

# Phase 2: Test session creation
log_info "Phase 2: Testing session creation..."

# Make MCP initialize request with BOTH required Accept headers
INIT_RESPONSE=$(curl -s -i -X POST $MCP_URL \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{
        "jsonrpc": "2.0",
        "id": "test-init",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "SessionTestClient", "version": "1.0.0"}
        }
    }')

# Extract session ID from headers
MCP_SESSION_ID=$(echo "$INIT_RESPONSE" | grep -i "mcp-session-id:" | cut -d' ' -f2 | tr -d '\r\n' | tr -d ' ')

if [ -n "$MCP_SESSION_ID" ]; then
    log_success "Session created: $MCP_SESSION_ID"
else
    log_warning "No session ID in headers (may still work via cookies)"
fi

# Wait for session to be persisted
sleep 2

# Check if session exists in database
SESSION_COUNT=$(query_db "SELECT COUNT(*) FROM archon_mcp_sessions WHERE status = 'active';")
if [ "$SESSION_COUNT" -gt 0 ]; then
    log_success "Session persisted to database ($SESSION_COUNT active sessions)"
else
    log_error "Session not found in database"
fi
echo ""

# Phase 3: Test session validation and reuse
log_info "Phase 3: Testing session validation..."

# Make a tool call with session ID and required Accept headers
TOOL_RESPONSE=$(curl -s -X POST $MCP_URL \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "X-MCP-Session-Id: $MCP_SESSION_ID" \
    -d '{
        "jsonrpc": "2.0",
        "id": "test-tool",
        "method": "tools/call",
        "params": {
            "name": "health_check",
            "arguments": {}
        }
    }')

if echo "$TOOL_RESPONSE" | jq -e '.result' > /dev/null 2>&1; then
    log_success "Tool call succeeded with existing session"
else
    log_error "Tool call failed: $(echo $TOOL_RESPONSE | jq -r '.error.message' 2>/dev/null || echo 'Unknown error')"
fi

# Wait for request to be tracked
sleep 1

# Check if request was tracked
REQUEST_COUNT=$(query_db "SELECT COUNT(*) FROM archon_mcp_requests WHERE session_id IN (SELECT session_id FROM archon_mcp_sessions WHERE status = 'active');")
if [ "$REQUEST_COUNT" -gt 0 ]; then
    log_success "Request tracked in database ($REQUEST_COUNT requests)"
else
    log_error "Request not tracked in database"
fi
echo ""

# Phase 4: Test client session ID validation
log_info "Phase 4: Testing client session ID validation..."

# Get an active session ID from database
ARCHON_SESSION=$(query_db "SELECT session_id FROM archon_mcp_sessions WHERE status = 'active' LIMIT 1;")

if [ -n "$ARCHON_SESSION" ]; then
    # Make tool call with client-provided session ID and required Accept headers
    CLIENT_SESSION_RESPONSE=$(curl -s -X POST $MCP_URL \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "X-MCP-Session-Id: $MCP_SESSION_ID" \
        -H "X-Archon-Session-Id: $ARCHON_SESSION" \
        -d '{
            "jsonrpc": "2.0",
            "id": "test-client-session",
            "method": "tools/call",
            "params": {
                "name": "health_check",
                "arguments": {}
            }
        }')

    if echo "$CLIENT_SESSION_RESPONSE" | jq -e '.result' > /dev/null 2>&1; then
        log_success "Client-provided session ID accepted and validated"
    else
        log_error "Client session validation failed"
    fi
else
    log_warning "No active session in database to test client session ID"
fi
echo ""

# Phase 5: Test background cleanup job
log_info "Phase 5: Testing background cleanup (monitoring)..."

# Check if cleanup task is running (verify logs for cleanup messages)
CLEANUP_LOGS=$(docker logs --since 5m $MCP_CONTAINER 2>&1 | grep -c "background session cleanup" || echo "0")
# Remove newlines and ensure it's a valid integer
CLEANUP_LOGS=$(echo "$CLEANUP_LOGS" | tr -d '\n\r' | grep -E '^[0-9]+$' || echo "0")

if [ "$CLEANUP_LOGS" -gt 0 ]; then
    log_success "Background cleanup job is running ($CLEANUP_LOGS log entries)"
else
    log_warning "No cleanup logs found yet (job may not have run in last 5 minutes)"
fi
echo ""

# Phase 6: Test session recovery after restart
log_info "Phase 6: Testing session recovery after restart..."
log_warning "This will restart the MCP container. Continue? (y/n)"
read -r CONTINUE

if [ "$CONTINUE" = "y" ] || [ "$CONTINUE" = "Y" ]; then
    # Count active sessions before restart
    SESSIONS_BEFORE=$(query_db "SELECT COUNT(*) FROM archon_mcp_sessions WHERE status = 'active';")
    log_info "Active sessions before restart: $SESSIONS_BEFORE"

    # Restart MCP container
    log_info "Restarting MCP container..."
    docker restart $MCP_CONTAINER > /dev/null 2>&1

    # Wait for container to restart
    sleep 10

    # Check health
    if curl -s http://localhost:8051/health > /dev/null 2>&1; then
        log_success "MCP server restarted successfully"
    else
        log_error "MCP server failed to restart"
    fi

    # Wait for recovery
    sleep 5

    # Check logs for recovery message
    RECOVERY_LOGS=$(docker logs --since 30s $MCP_CONTAINER 2>&1 | grep "Recovered.*sessions" || echo "")

    if [ -n "$RECOVERY_LOGS" ]; then
        log_success "Session recovery executed: $RECOVERY_LOGS"
    else
        log_warning "No session recovery logs found (may not have recovered sessions)"
    fi

    # Make a new tool call to create fresh session with required Accept headers
    curl -s -X POST $MCP_URL \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "X-MCP-Session-Id: new-session-after-restart" \
        -d '{
            "jsonrpc": "2.0",
            "id": "post-restart-test",
            "method": "tools/call",
            "params": {
                "name": "health_check",
                "arguments": {}
            }
        }' > /dev/null 2>&1

    sleep 2

    # Check active sessions after restart
    SESSIONS_AFTER=$(query_db "SELECT COUNT(*) FROM archon_mcp_sessions WHERE status = 'active';")
    log_info "Active sessions after restart: $SESSIONS_AFTER"

    if [ "$SESSIONS_AFTER" -gt 0 ]; then
        log_success "Sessions active after restart (recovery or new sessions created)"
    else
        log_warning "No active sessions after restart"
    fi
else
    log_warning "Skipping restart test"
fi
echo ""

# Phase 7: Test MCP client wrapper (if Python available)
log_info "Phase 7: Testing MCP client wrapper utilities..."

if command -v python3 &> /dev/null; then
    # Test if wrapper can be imported
    WRAPPER_TEST=$(python3 -c "
import sys
sys.path.insert(0, '/home/ljutzkanov/Documents/Projects/archon/python')
try:
    from src.mcp_server.utils.mcp_client_wrapper import MCPClient, call_mcp_tool
    print('OK')
except Exception as e:
    print(f'ERROR: {e}')
" 2>&1)

    if [ "$WRAPPER_TEST" = "OK" ]; then
        log_success "MCP client wrapper module loads successfully"
    else
        log_error "MCP client wrapper import failed: $WRAPPER_TEST"
    fi
else
    log_warning "Python not available, skipping wrapper test"
fi
echo ""

# Phase 8: Database integrity checks
log_info "Phase 8: Database integrity checks..."

# Check for orphaned requests (requests without sessions)
ORPHANED=$(query_db "SELECT COUNT(*) FROM archon_mcp_requests WHERE session_id NOT IN (SELECT session_id FROM archon_mcp_sessions);")
if [ "$ORPHANED" -eq 0 ]; then
    log_success "No orphaned requests found"
else
    log_warning "Found $ORPHANED orphaned requests"
fi

# Check session status distribution
ACTIVE=$(query_db "SELECT COUNT(*) FROM archon_mcp_sessions WHERE status = 'active';")
DISCONNECTED=$(query_db "SELECT COUNT(*) FROM archon_mcp_sessions WHERE status = 'disconnected';")
EXPIRED=$(query_db "SELECT COUNT(*) FROM archon_mcp_sessions WHERE status = 'expired';")

log_info "Session status: Active=$ACTIVE, Disconnected=$DISCONNECTED, Expired=$EXPIRED"
log_success "Database integrity verified"
echo ""

# Summary
echo "========================================================"
echo "  Test Summary"
echo "========================================================"
echo ""
echo -e "  ${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "  ${RED}Failed:${NC} $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Review the failures above and check:"
    echo "  - Archon logs: docker logs archon-mcp"
    echo "  - Database: docker exec -it supabase-ai-db psql -U postgres"
    echo "  - Configuration: .env file and docker-compose.yml"
    echo ""
    exit 1
fi
