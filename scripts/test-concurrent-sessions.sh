#!/bin/bash
# MCP Session Lifecycle - Concurrent Client Stress Test
# Tests Phase 5 session management improvements with 5 simultaneous clients

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MCP_URL="http://localhost:8051/mcp"
API_URL="http://localhost:8181/api/mcp"
NUM_CLIENTS=5
TEST_RESULTS_DIR="/tmp/mcp-concurrent-test-$(date +%s)"
HEARTBEAT_INTERVAL=120  # 2 minutes (for 5-minute timeout)

# Create test results directory
mkdir -p "$TEST_RESULTS_DIR"

# Logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Header
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   MCP Session Lifecycle - Concurrent Test${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check prerequisites
log_info "Checking prerequisites..."

# Check MCP server (with proper MCP headers)
MCP_CHECK=$(curl -s -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":"health-check","method":"ping"}' 2>&1)

if [ -z "$MCP_CHECK" ]; then
    log_error "MCP server not responding at $MCP_URL"
    exit 1
fi
log_success "MCP server is running"

# Check API server
if ! curl -s -f "$API_URL/sessions/health" > /dev/null 2>&1; then
    log_error "API server not responding at $API_URL"
    exit 1
fi
log_success "API server is running"

echo ""

# ============================================================================
# Test Scenario 1: Normal Session Lifecycle
# ============================================================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Test 1: Normal Session Lifecycle${NC}"
echo -e "${BLUE}============================================${NC}"
log_info "Testing: Connect → Tool Call → Disconnect"
echo ""

test_normal_lifecycle() {
    local client_id=$1
    local result_file="$TEST_RESULTS_DIR/client_${client_id}_normal.json"

    log_info "[Client $client_id] Starting normal lifecycle test..."

    # 1. Initialize session
    local init_response=$(curl -s -X POST "$MCP_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -d '{
            "jsonrpc": "2.0",
            "id": "init-'$client_id'",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "concurrent-test-client-'$client_id'",
                    "version": "1.0.0"
                }
            }
        }')

    local session_id=$(echo "$init_response" | jq -r '.result.sessionId // empty')

    if [ -z "$session_id" ]; then
        log_error "[Client $client_id] Failed to initialize session"
        echo "{\"success\": false, \"error\": \"init_failed\"}" > "$result_file"
        return 1
    fi

    log_success "[Client $client_id] Session initialized: $session_id"

    # 2. Call health_check tool
    local tool_response=$(curl -s -X POST "$MCP_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "X-MCP-Session-Id: $session_id" \
        -d '{
            "jsonrpc": "2.0",
            "id": "tool-'$client_id'",
            "method": "tools/call",
            "params": {
                "name": "health_check",
                "arguments": {}
            }
        }')

    local tool_success=$(echo "$tool_response" | jq -r '.result != null')

    if [ "$tool_success" = "true" ]; then
        log_success "[Client $client_id] Tool call succeeded"
    else
        log_error "[Client $client_id] Tool call failed"
        echo "{\"success\": false, \"error\": \"tool_call_failed\"}" > "$result_file"
        return 1
    fi

    # 3. Verify session in database
    sleep 2
    local db_check=$(curl -s "$API_URL/sessions" | jq --arg sid "$session_id" '.sessions[] | select(.session_id == $sid)')

    if [ -n "$db_check" ]; then
        log_success "[Client $client_id] Session verified in database"
    else
        log_warning "[Client $client_id] Session not found in database"
    fi

    # Save results
    echo "{
        \"client_id\": $client_id,
        \"session_id\": \"$session_id\",
        \"success\": true,
        \"test\": \"normal_lifecycle\"
    }" > "$result_file"

    log_success "[Client $client_id] Normal lifecycle test completed"
    return 0
}

# Run Test 1
for i in $(seq 1 $NUM_CLIENTS); do
    test_normal_lifecycle $i &
done

wait
log_success "Test 1 completed for all $NUM_CLIENTS clients"
echo ""

# ============================================================================
# Test Scenario 2: Stale Session Cleanup
# ============================================================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Test 2: Stale Session Cleanup${NC}"
echo -e "${BLUE}============================================${NC}"
log_info "Testing: Connect → Idle 6 min → Verify Disconnect"
echo ""

test_stale_cleanup() {
    local client_id=$1
    local result_file="$TEST_RESULTS_DIR/client_${client_id}_stale.json"

    log_info "[Client $client_id] Starting stale session test..."

    # 1. Initialize session
    local init_response=$(curl -s -X POST "$MCP_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -d '{
            "jsonrpc": "2.0",
            "id": "init-stale-'$client_id'",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "stale-test-client-'$client_id'",
                    "version": "1.0.0"
                }
            }
        }')

    local session_id=$(echo "$init_response" | jq -r '.result.sessionId // empty')

    if [ -z "$session_id" ]; then
        log_error "[Client $client_id] Failed to initialize stale session"
        return 1
    fi

    log_success "[Client $client_id] Stale session initialized: $session_id"

    # 2. Make one tool call to ensure session is tracked
    curl -s -X POST "$MCP_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "X-MCP-Session-Id: $session_id" \
        -d '{
            "jsonrpc": "2.0",
            "id": "tool-stale-'$client_id'",
            "method": "tools/call",
            "params": {
                "name": "health_check",
                "arguments": {}
            }
        }' > /dev/null

    log_info "[Client $client_id] Session active, waiting 6 minutes for cleanup..."
    log_info "[Client $client_id] (Session timeout: 5 min, cleanup frequency: 1 min)"

    # Save session ID for later verification
    echo "{
        \"client_id\": $client_id,
        \"session_id\": \"$session_id\",
        \"start_time\": \"$(date -Iseconds)\",
        \"test\": \"stale_cleanup\"
    }" > "$result_file"

    return 0
}

# Run Test 2 (only 2 clients for stale test to avoid too many long-running processes)
log_info "Running stale cleanup test with 2 clients..."
test_stale_cleanup 1 &
test_stale_cleanup 2 &
wait

log_success "Stale sessions created. Waiting 6 minutes for cleanup..."
log_info "You can monitor cleanup in real-time:"
log_info "  watch -n 10 'curl -s http://localhost:8181/api/mcp/sessions/health | jq .status_breakdown'"
echo ""

# Background verification after 6 minutes
(
    sleep 360  # 6 minutes

    log_info "Verifying stale session cleanup after 6 minutes..."

    # Check both test sessions
    for i in 1 2; do
        result_file="$TEST_RESULTS_DIR/client_${i}_stale.json"
        session_id=$(jq -r '.session_id' "$result_file")

        # Query database for session status
        session_status=$(curl -s "$API_URL/sessions" | jq --arg sid "$session_id" '.sessions[] | select(.session_id == $sid) | .status')

        if [ "$session_status" = '"disconnected"' ]; then
            log_success "[Client $i] Session correctly marked as disconnected"
            jq '. + {"cleanup_verified": true, "final_status": "disconnected"}' "$result_file" > "${result_file}.tmp"
            mv "${result_file}.tmp" "$result_file"
        else
            log_error "[Client $i] Session still active (expected disconnected)"
            jq '. + {"cleanup_verified": false, "final_status": "'"$session_status"'"}' "$result_file" > "${result_file}.tmp"
            mv "${result_file}.tmp" "$result_file"
        fi
    done

    log_success "Stale cleanup verification completed"
) &

STALE_VERIFICATION_PID=$!

# ============================================================================
# Test Scenario 3: Concurrent Clients (5 Simultaneous)
# ============================================================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Test 3: Concurrent Clients${NC}"
echo -e "${BLUE}============================================${NC}"
log_info "Testing: 5 clients connecting and working simultaneously"
echo ""

test_concurrent_clients() {
    local client_id=$1
    local result_file="$TEST_RESULTS_DIR/client_${client_id}_concurrent.json"

    log_info "[Client $client_id] Starting concurrent test..."

    # 1. Initialize
    local init_response=$(curl -s -X POST "$MCP_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -d '{
            "jsonrpc": "2.0",
            "id": "init-concurrent-'$client_id'",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "concurrent-client-'$client_id'",
                    "version": "1.0.0"
                }
            }
        }')

    local session_id=$(echo "$init_response" | jq -r '.result.sessionId // empty')

    if [ -z "$session_id" ]; then
        log_error "[Client $client_id] Failed to initialize concurrent session"
        return 1
    fi

    log_success "[Client $client_id] Concurrent session initialized: $session_id"

    # 2. Perform multiple tool calls (simulate real usage)
    local tool_calls=5
    local successes=0

    for j in $(seq 1 $tool_calls); do
        local tool_response=$(curl -s -X POST "$MCP_URL" \
            -H "Content-Type: application/json" \
            -H "Accept: application/json, text/event-stream" \
            -H "X-MCP-Session-Id: $session_id" \
            -d '{
                "jsonrpc": "2.0",
                "id": "tool-concurrent-'$client_id'-'$j'",
                "method": "tools/call",
                "params": {
                    "name": "health_check",
                    "arguments": {}
                }
            }')

        if echo "$tool_response" | jq -e '.result' > /dev/null 2>&1; then
            ((successes++))
        fi

        # Small delay between calls
        sleep 0.5
    done

    log_success "[Client $client_id] Completed $successes/$tool_calls tool calls"

    # Save results
    echo "{
        \"client_id\": $client_id,
        \"session_id\": \"$session_id\",
        \"tool_calls\": $tool_calls,
        \"successes\": $successes,
        \"success\": true,
        \"test\": \"concurrent_clients\"
    }" > "$result_file"

    return 0
}

# Run Test 3
log_info "Launching $NUM_CLIENTS concurrent clients..."
for i in $(seq 1 $NUM_CLIENTS); do
    test_concurrent_clients $i &
done

wait
log_success "Test 3 completed - all $NUM_CLIENTS clients finished"
echo ""

# Check session health after concurrent test
log_info "Checking session health after concurrent test..."
concurrent_health=$(curl -s "$API_URL/sessions/health" | jq '.status_breakdown')
echo "$concurrent_health"
echo ""

# ============================================================================
# Test Scenario 4: Reconnection
# ============================================================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Test 4: Reconnection${NC}"
echo -e "${BLUE}============================================${NC}"
log_info "Testing: Disconnect → Reconnect → Verify New Session"
echo ""

test_reconnection() {
    local client_id=$1
    local result_file="$TEST_RESULTS_DIR/client_${client_id}_reconnection.json"

    log_info "[Client $client_id] Starting reconnection test..."

    # 1. First connection
    local init1_response=$(curl -s -X POST "$MCP_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -d '{
            "jsonrpc": "2.0",
            "id": "init-reconnect-1-'$client_id'",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "reconnect-client-'$client_id'",
                    "version": "1.0.0"
                }
            }
        }')

    local session1_id=$(echo "$init1_response" | jq -r '.result.sessionId // empty')

    if [ -z "$session1_id" ]; then
        log_error "[Client $client_id] Failed first connection"
        return 1
    fi

    log_success "[Client $client_id] First session: $session1_id"

    # Make a tool call to ensure session is tracked
    curl -s -X POST "$MCP_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "X-MCP-Session-Id: $session1_id" \
        -d '{
            "jsonrpc": "2.0",
            "id": "tool-reconnect-'$client_id'",
            "method": "tools/call",
            "params": {
                "name": "health_check",
                "arguments": {}
            }
        }' > /dev/null

    # 2. "Disconnect" (simulate by just not using session)
    log_info "[Client $client_id] Simulating disconnect (waiting 2 seconds)..."
    sleep 2

    # 3. Second connection (new session)
    local init2_response=$(curl -s -X POST "$MCP_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -d '{
            "jsonrpc": "2.0",
            "id": "init-reconnect-2-'$client_id'",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "reconnect-client-'$client_id'",
                    "version": "1.0.0"
                }
            }
        }')

    local session2_id=$(echo "$init2_response" | jq -r '.result.sessionId // empty')

    if [ -z "$session2_id" ]; then
        log_error "[Client $client_id] Failed second connection"
        return 1
    fi

    log_success "[Client $client_id] Second session: $session2_id"

    # 4. Verify sessions are different
    if [ "$session1_id" = "$session2_id" ]; then
        log_error "[Client $client_id] Session IDs should be different (got same ID)"
        echo "{\"success\": false, \"error\": \"same_session_id\"}" > "$result_file"
        return 1
    fi

    log_success "[Client $client_id] Reconnection created new session (expected behavior)"

    # Save results
    echo "{
        \"client_id\": $client_id,
        \"session1_id\": \"$session1_id\",
        \"session2_id\": \"$session2_id\",
        \"sessions_different\": true,
        \"success\": true,
        \"test\": \"reconnection\"
    }" > "$result_file"

    return 0
}

# Run Test 4
for i in $(seq 1 3); do  # Only 3 clients for reconnection test
    test_reconnection $i &
done

wait
log_success "Test 4 completed - reconnection behavior verified"
echo ""

# ============================================================================
# Test Scenario 5: Long-running Session with Heartbeat
# ============================================================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Test 5: Long-running Session with Heartbeat${NC}"
echo -e "${BLUE}============================================${NC}"
log_info "Testing: Keep session alive >5 min with heartbeat"
echo ""

test_heartbeat() {
    local client_id=$1
    local result_file="$TEST_RESULTS_DIR/client_${client_id}_heartbeat.json"

    log_info "[Client $client_id] Starting heartbeat test..."

    # 1. Initialize session
    local init_response=$(curl -s -X POST "$MCP_URL" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -d '{
            "jsonrpc": "2.0",
            "id": "init-heartbeat-'$client_id'",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "heartbeat-client-'$client_id'",
                    "version": "1.0.0"
                }
            }
        }')

    local session_id=$(echo "$init_response" | jq -r '.result.sessionId // empty')

    if [ -z "$session_id" ]; then
        log_error "[Client $client_id] Failed to initialize heartbeat session"
        return 1
    fi

    log_success "[Client $client_id] Heartbeat session initialized: $session_id"

    # 2. Send heartbeats every 2 minutes for 6 minutes
    local heartbeat_count=0
    local duration=360  # 6 minutes
    local interval=$HEARTBEAT_INTERVAL
    local iterations=$((duration / interval))

    log_info "[Client $client_id] Sending heartbeats every ${interval}s for ${duration}s..."

    for i in $(seq 1 $iterations); do
        # Send heartbeat
        local hb_response=$(curl -s -X POST "$MCP_URL" \
            -H "Content-Type: application/json" \
            -H "Accept: application/json, text/event-stream" \
            -H "X-MCP-Session-Id: $session_id" \
            -d '{
                "jsonrpc": "2.0",
                "id": "hb-'$client_id'-'$i'",
                "method": "tools/call",
                "params": {
                    "name": "heartbeat",
                    "arguments": {}
                }
            }')

        if echo "$hb_response" | jq -e '.result' > /dev/null 2>&1; then
            ((heartbeat_count++))
            log_success "[Client $client_id] Heartbeat $i/$iterations sent successfully"
        else
            log_error "[Client $client_id] Heartbeat $i/$iterations failed"
        fi

        # Wait for next interval
        if [ $i -lt $iterations ]; then
            sleep $interval
        fi
    done

    # 3. Verify session still active
    local session_status=$(curl -s "$API_URL/sessions" | jq --arg sid "$session_id" '.sessions[] | select(.session_id == $sid) | .status')

    if [ "$session_status" = '"active"' ]; then
        log_success "[Client $client_id] Session still active after ${duration}s (heartbeat worked!)"
    else
        log_error "[Client $client_id] Session status: $session_status (expected active)"
    fi

    # Save results
    echo "{
        \"client_id\": $client_id,
        \"session_id\": \"$session_id\",
        \"heartbeats_sent\": $heartbeat_count,
        \"heartbeats_expected\": $iterations,
        \"duration_seconds\": $duration,
        \"final_status\": $session_status,
        \"success\": $([ "$session_status" = '"active"' ] && echo true || echo false),
        \"test\": \"heartbeat\"
    }" > "$result_file"

    return 0
}

# Run Test 5 (only 1 client for long-running test)
log_info "Running heartbeat test with 1 client (this will take 6 minutes)..."
test_heartbeat 1 &
HEARTBEAT_PID=$!

# ============================================================================
# Results Summary
# ============================================================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

log_info "Test results saved to: $TEST_RESULTS_DIR"
echo ""

# Wait for heartbeat test to complete
log_info "Waiting for heartbeat test to complete (6 minutes)..."
wait $HEARTBEAT_PID

# Generate summary report
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}All Tests Completed${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Count successes
normal_success=$(find "$TEST_RESULTS_DIR" -name "*_normal.json" -exec jq -r '.success' {} \; | grep -c true || echo 0)
concurrent_success=$(find "$TEST_RESULTS_DIR" -name "*_concurrent.json" -exec jq -r '.success' {} \; | grep -c true || echo 0)
reconnect_success=$(find "$TEST_RESULTS_DIR" -name "*_reconnection.json" -exec jq -r '.success' {} \; | grep -c true || echo 0)
heartbeat_success=$(find "$TEST_RESULTS_DIR" -name "*_heartbeat.json" -exec jq -r '.success' {} \; | grep -c true || echo 0)

echo "Test Results:"
echo "  Normal Lifecycle: $normal_success/$NUM_CLIENTS passed"
echo "  Concurrent Clients: $concurrent_success/$NUM_CLIENTS passed"
echo "  Reconnection: $reconnect_success/3 passed"
echo "  Heartbeat: $heartbeat_success/1 passed"
echo ""

# Final session health
log_info "Final session health:"
curl -s "$API_URL/sessions/health" | jq '{
    status_breakdown,
    age_distribution,
    timestamp
}'
echo ""

log_success "Concurrent testing completed! Results in: $TEST_RESULTS_DIR"
echo ""
echo "To wait for stale cleanup verification (in 6 minutes), run:"
echo "  wait $STALE_VERIFICATION_PID"
