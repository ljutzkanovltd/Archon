#!/bin/bash
# Validate Phase 1 Implementation
# Tests database, API endpoints, and services

set -e

API_BASE="http://localhost:8181/api"
TOKEN=""  # Add your auth token here if needed

echo "========================================="
echo "Phase 1 Validation Suite"
echo "========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASS=0
FAIL=0

# Helper function to test
test_check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((PASS++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((FAIL++))
    fi
}

# ==========================================
# DATABASE VALIDATION
# ==========================================
echo "-------------------------------------------"
echo "1. DATABASE VALIDATION"
echo "-------------------------------------------"
echo ""

echo "Checking Phase 1 tables exist..."

# Check each table
TABLES=(
    "archon_project_types"
    "archon_workflows"
    "archon_workflow_stages"
    "archon_sprints"
    "archon_time_logs"
    "archon_project_hierarchy"
    "archon_teams"
    "archon_team_members"
    "archon_knowledge_links"
)

for table in "${TABLES[@]}"; do
    EXISTS=$(docker exec supabase-ai-db psql -U postgres -d postgres -tAc \
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='$table');")

    if [ "$EXISTS" = "t" ]; then
        test_check 0 "Table $table exists"
    else
        test_check 1 "Table $table missing"
    fi
done

echo ""

# Check ltree extension
echo "Checking ltree extension..."
LTREE=$(docker exec supabase-ai-db psql -U postgres -d postgres -tAc \
    "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='ltree');")
test_check $([ "$LTREE" = "t" ] && echo 0 || echo 1) "ltree extension installed"

echo ""

# Check enhanced archon_tasks columns
echo "Checking enhanced archon_tasks columns..."
COLUMNS=("sprint_id" "workflow_stage_id" "story_points")
for col in "${COLUMNS[@]}"; do
    COL_EXISTS=$(docker exec supabase-ai-db psql -U postgres -d postgres -tAc \
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_name='archon_tasks' AND column_name='$col');")
    test_check $([ "$COL_EXISTS" = "t" ] && echo 0 || echo 1) "archon_tasks.$col column exists"
done

echo ""

# ==========================================
# SERVICE FILE VALIDATION
# ==========================================
echo "-------------------------------------------"
echo "2. SERVICE FILE VALIDATION"
echo "-------------------------------------------"
echo ""

SERVICES=(
    "src/server/services/projects/workflow_service.py"
    "src/server/services/projects/sprint_service.py"
    "src/server/services/projects/team_service.py"
    "src/server/services/projects/project_hierarchy_service.py"
    "src/server/services/knowledge_linking_service.py"
    "src/server/services/reporting_service.py"
    "src/server/services/casbin_service.py"
)

for service in "${SERVICES[@]}"; do
    if [ -f "$service" ]; then
        LINES=$(wc -l < "$service")
        test_check 0 "$(basename $service) exists ($LINES lines)"
    else
        test_check 1 "$(basename $service) missing"
    fi
done

echo ""

# ==========================================
# API ROUTE VALIDATION
# ==========================================
echo "-------------------------------------------"
echo "3. API ROUTE VALIDATION"
echo "-------------------------------------------"
echo ""

API_ROUTES=(
    "src/server/api_routes/workflows.py"
    "src/server/api_routes/sprints.py"
    "src/server/api_routes/knowledge_links.py"
    "src/server/api_routes/reports.py"
)

for route in "${API_ROUTES[@]}"; do
    if [ -f "$route" ]; then
        ENDPOINTS=$(grep -c "^@router\." "$route" || echo 0)
        test_check 0 "$(basename $route) exists ($ENDPOINTS endpoints)"
    else
        test_check 1 "$(basename $route) missing"
    fi
done

echo ""

# ==========================================
# API ENDPOINT TESTING
# ==========================================
echo "-------------------------------------------"
echo "4. API ENDPOINT TESTING (Live)"
echo "-------------------------------------------"
echo ""

# Check if backend is running
echo "Checking if backend is running..."
if curl -s http://localhost:8181/health > /dev/null 2>&1; then
    test_check 0 "Backend is running on port 8181"

    # Test OpenAPI docs
    echo ""
    echo "Testing API documentation..."
    OPENAPI=$(curl -s http://localhost:8181/docs 2>&1)
    test_check $? "OpenAPI docs accessible at /docs"

    # Check for Phase 1 endpoints in OpenAPI
    echo ""
    echo "Checking Phase 1 endpoints in OpenAPI spec..."
    SPEC=$(curl -s http://localhost:8181/openapi.json)

    # Check for sprint endpoints
    echo "$SPEC" | grep -q "/api/sprints" && test_check 0 "Sprint endpoints registered" || test_check 1 "Sprint endpoints missing"

    # Check for workflow endpoints
    echo "$SPEC" | grep -q "/api/workflows" && test_check 0 "Workflow endpoints registered" || test_check 1 "Workflow endpoints missing"

    # Check for knowledge link endpoints
    echo "$SPEC" | grep -q "knowledge" && test_check 0 "Knowledge endpoints registered" || test_check 1 "Knowledge endpoints missing"

    # Check for report endpoints
    echo "$SPEC" | grep -q "/api.*report" && test_check 0 "Report endpoints registered" || test_check 1 "Report endpoints missing"

else
    test_check 1 "Backend not running (start with ./start-archon.sh)"
    echo -e "${YELLOW}⚠️  Skipping API endpoint tests${NC}"
fi

echo ""

# ==========================================
# MCP TOOL VALIDATION
# ==========================================
echo "-------------------------------------------"
echo "5. MCP TOOL VALIDATION"
echo "-------------------------------------------"
echo ""

# Check MCP server file for Phase 1 tools
MCP_FILE="src/mcp_server/mcp_server.py"
if [ -f "$MCP_FILE" ]; then
    grep -q "link_knowledge" "$MCP_FILE" && test_check 0 "link_knowledge MCP tool exists" || test_check 1 "link_knowledge MCP tool missing"
    grep -q "suggest_knowledge" "$MCP_FILE" && test_check 0 "suggest_knowledge MCP tool exists" || test_check 1 "suggest_knowledge MCP tool missing"
    grep -q "get_linked_knowledge" "$MCP_FILE" && test_check 0 "get_linked_knowledge MCP tool exists" || test_check 1 "get_linked_knowledge MCP tool missing"
else
    test_check 1 "MCP server file not found"
fi

echo ""

# ==========================================
# RESULTS SUMMARY
# ==========================================
echo "========================================="
echo "VALIDATION RESULTS"
echo "========================================="
echo ""
echo -e "${GREEN}✅ PASSED:${NC} $PASS"
echo -e "${RED}❌ FAILED:${NC} $FAIL"
echo ""

TOTAL=$((PASS + FAIL))
PERCENTAGE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)
echo "Success Rate: $PERCENTAGE%"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 All Phase 1 validations passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test creating a sprint via API"
    echo "2. Test workflow transitions"
    echo "3. Test knowledge linking"
    echo "4. Review API docs at http://localhost:8181/docs"
    exit 0
else
    echo -e "${RED}⚠️  Some validations failed. Review errors above.${NC}"
    exit 1
fi
