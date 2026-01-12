#!/bin/bash
# Database Sync UI - Quick Automated Tests
# Tests basic API endpoints and system readiness

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

test_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
    ((TESTS_TOTAL++))
}

test_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo -e "  ${YELLOW}Details: $2${NC}"
    ((TESTS_FAILED++))
    ((TESTS_TOTAL++))
}

test_skip() {
    echo -e "${YELLOW}⊘ SKIP${NC}: $1"
}

# Configuration
API_URL="${API_URL:-http://localhost:8181}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3738}"
DB_CONTAINER="${DB_CONTAINER:-supabase-ai-db}"

print_header "Database Sync UI - Automated Test Suite"

echo "Configuration:"
echo "  API URL: $API_URL"
echo "  Frontend URL: $FRONTEND_URL"
echo "  DB Container: $DB_CONTAINER"
echo ""

# Test 1: API Health Check
print_header "Test 1: API Health Check"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    HEALTH_RESPONSE=$(curl -s "$API_URL/health" 2>/dev/null)
    if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
        test_pass "API is healthy and responding"
    else
        test_fail "API responded but status is not healthy" "$HEALTH_RESPONSE"
    fi
else
    test_fail "API health check failed" "HTTP Code: $HTTP_CODE"
fi

# Test 2: Frontend Accessibility
print_header "Test 2: Frontend Accessibility"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
    test_pass "Frontend is accessible"
else
    test_fail "Frontend not accessible" "HTTP Code: $HTTP_CODE"
fi

# Test 3: Database Connectivity
print_header "Test 3: Database Connectivity"

if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    if docker exec "$DB_CONTAINER" psql -U postgres -d postgres -c "SELECT 1" > /dev/null 2>&1; then
        test_pass "Database is accessible and responding"
    else
        test_fail "Database connection failed" "Cannot execute queries"
    fi
else
    test_fail "Database container not running" "Container: $DB_CONTAINER"
fi

# Test 4: Sync History Table Exists
print_header "Test 4: Sync History Table"

if docker exec "$DB_CONTAINER" psql -U postgres -d postgres -c "\dt archon_sync_history" 2>/dev/null | grep -q "archon_sync_history"; then
    test_pass "archon_sync_history table exists"

    # Check table structure
    COLUMNS=$(docker exec "$DB_CONTAINER" psql -U postgres -d postgres -t -c "
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'archon_sync_history'
    ORDER BY ordinal_position;
    " 2>/dev/null | tr -d ' ' | grep -v '^$')

    REQUIRED_COLUMNS=("id" "sync_id" "direction" "status" "started_at")
    MISSING_COLUMNS=()

    for col in "${REQUIRED_COLUMNS[@]}"; do
        if ! echo "$COLUMNS" | grep -q "^${col}$"; then
            MISSING_COLUMNS+=("$col")
        fi
    done

    if [ ${#MISSING_COLUMNS[@]} -eq 0 ]; then
        test_pass "All required columns present in archon_sync_history"
    else
        test_fail "Missing columns in archon_sync_history" "Missing: ${MISSING_COLUMNS[*]}"
    fi
else
    test_fail "archon_sync_history table does not exist" "Run migrations first"
fi

# Test 5: Sync History API Endpoint
print_header "Test 5: Sync History API Endpoint"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/database/sync/history" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    HISTORY_RESPONSE=$(curl -s "$API_URL/api/database/sync/history" 2>/dev/null)

    if echo "$HISTORY_RESPONSE" | grep -q '"success":true'; then
        test_pass "Sync history API endpoint working"

        # Check response structure
        if echo "$HISTORY_RESPONSE" | grep -q '"records"' && echo "$HISTORY_RESPONSE" | grep -q '"total"'; then
            test_pass "Sync history response has correct structure"
        else
            test_fail "Sync history response missing fields" "Response: $HISTORY_RESPONSE"
        fi
    else
        test_fail "Sync history API returned error" "$HISTORY_RESPONSE"
    fi
else
    test_fail "Sync history API endpoint not accessible" "HTTP Code: $HTTP_CODE"
fi

# Test 6: Preflight Check Endpoint
print_header "Test 6: Preflight Check Endpoint"

PREFLIGHT_PAYLOAD='{"direction":"local-to-remote"}'
PREFLIGHT_RESPONSE=$(curl -s -X POST "$API_URL/api/database/sync/preflight" \
    -H "Content-Type: application/json" \
    -d "$PREFLIGHT_PAYLOAD" 2>/dev/null)

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/database/sync/preflight" \
    -H "Content-Type: application/json" \
    -d "$PREFLIGHT_PAYLOAD" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$PREFLIGHT_RESPONSE" | grep -q '"success":true'; then
        test_pass "Preflight check endpoint working"

        # Check for expected fields
        if echo "$PREFLIGHT_RESPONSE" | grep -q '"database_connectivity"' && \
           echo "$PREFLIGHT_RESPONSE" | grep -q '"disk_space"' && \
           echo "$PREFLIGHT_RESPONSE" | grep -q '"schema_version"'; then
            test_pass "Preflight check returns all required checks"
        else
            test_fail "Preflight check missing required fields" "$PREFLIGHT_RESPONSE"
        fi
    else
        test_fail "Preflight check returned error" "$PREFLIGHT_RESPONSE"
    fi
else
    test_fail "Preflight check endpoint not accessible" "HTTP Code: $HTTP_CODE"
fi

# Test 7: Database Sync Script Exists
print_header "Test 7: Sync Script Availability"

SYNC_SCRIPT="./scripts/sync-databases.sh"

if [ -f "$SYNC_SCRIPT" ]; then
    test_pass "sync-databases.sh script exists"

    if [ -x "$SYNC_SCRIPT" ]; then
        test_pass "sync-databases.sh is executable"
    else
        test_fail "sync-databases.sh is not executable" "Run: chmod +x $SYNC_SCRIPT"
    fi
else
    test_fail "sync-databases.sh script not found" "Expected location: $SYNC_SCRIPT"
fi

# Test 8: Environment Variables
print_header "Test 8: Environment Configuration"

REQUIRED_ENV_VARS=(
    "DATABASE_URI"
    "SUPABASE_URL"
    "SUPABASE_SERVICE_KEY"
)

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    test_pass ".env file exists"

    MISSING_VARS=()
    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE"; then
            MISSING_VARS+=("$var")
        fi
    done

    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
        test_pass "All required environment variables present"
    else
        test_fail "Missing environment variables" "Missing: ${MISSING_VARS[*]}"
    fi
else
    test_fail ".env file not found" "Create from .env.example"
fi

# Test 9: Docker Services
print_header "Test 9: Docker Services Status"

REQUIRED_SERVICES=(
    "archon-api"
    "supabase-ai-db"
)

MISSING_SERVICES=()
for service in "${REQUIRED_SERVICES[@]}"; do
    if ! docker ps --format '{{.Names}}' | grep -q "$service"; then
        MISSING_SERVICES+=("$service")
    fi
done

if [ ${#MISSING_SERVICES[@]} -eq 0 ]; then
    test_pass "All required Docker services are running"
else
    test_fail "Missing Docker services" "Not running: ${MISSING_SERVICES[*]}"
fi

# Test 10: Backup Script
print_header "Test 10: Backup System"

BACKUP_SCRIPT="./scripts/pre-dangerous-operation-backup.sh"

if [ -f "$BACKUP_SCRIPT" ]; then
    test_pass "Backup script exists"

    if [ -x "$BACKUP_SCRIPT" ]; then
        test_pass "Backup script is executable"
    else
        test_fail "Backup script is not executable" "Run: chmod +x $BACKUP_SCRIPT"
    fi
else
    test_fail "Backup script not found" "Expected: $BACKUP_SCRIPT"
fi

# Summary
print_header "Test Summary"

echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo "Tests Total:  $TESTS_TOTAL"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Next Steps:"
    echo "  1. Manual testing: Follow docs/database-sync/TESTING_GUIDE.md"
    echo "  2. Start a test sync: http://localhost:3738/database-sync"
    echo "  3. Check sync history: http://localhost:3738/database-sync/history"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Please fix the failures above before proceeding."
    echo "Refer to: docs/database-sync/TESTING_GUIDE.md"
    exit 1
fi
