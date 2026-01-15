#!/bin/bash
# Test Phase 1 Features - Interactive Demo
# Shows sprint creation, workflow transitions, knowledge linking

API_BASE="http://localhost:8181/api"

echo "========================================="
echo "Phase 1 Feature Testing Demo"
echo "========================================="
echo ""
echo "This script demonstrates Phase 1 features:"
echo "- Creating sprints"
echo "- Workflow transitions"
echo "- Knowledge linking"
echo "- Generating reports"
echo ""

# Color codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ==========================================
# TEST 1: Create a Sprint
# ==========================================
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}TEST 1: Create Sprint${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# Get a project ID (use first project)
PROJECT_ID=$(curl -s "$API_BASE/projects?per_page=1" | jq -r '.projects[0].id' 2>/dev/null)

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
    echo -e "${YELLOW}⚠️  No projects found. Creating a test project...${NC}"

    PROJECT_RESPONSE=$(curl -s -X POST "$API_BASE/projects" \
        -H "Content-Type: application/json" \
        -d '{
            "title": "Phase 1 Test Project",
            "description": "Testing sprint and workflow features"
        }')

    PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.project.id')
    echo "✅ Created project: $PROJECT_ID"
fi

echo "Using project: $PROJECT_ID"
echo ""

# Create sprint
echo "Creating sprint..."
SPRINT_RESPONSE=$(curl -s -X POST "$API_BASE/projects/$PROJECT_ID/sprints" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Sprint 1",
        "start_date": "2026-01-15",
        "end_date": "2026-01-29",
        "goal": "Deliver Phase 1 features"
    }')

SPRINT_ID=$(echo "$SPRINT_RESPONSE" | jq -r '.sprint.id // .id' 2>/dev/null)

if [ -n "$SPRINT_ID" ] && [ "$SPRINT_ID" != "null" ]; then
    echo -e "${GREEN}✅ Sprint created successfully!${NC}"
    echo "$SPRINT_RESPONSE" | jq '.'
else
    echo -e "❌ Failed to create sprint"
    echo "$SPRINT_RESPONSE" | jq '.'
fi

echo ""
read -p "Press Enter to continue..."
echo ""

# ==========================================
# TEST 2: List Workflows
# ==========================================
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}TEST 2: List Workflows${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

echo "Fetching available workflows..."
WORKFLOWS=$(curl -s "$API_BASE/workflows")

echo "$WORKFLOWS" | jq '.'
echo ""

WORKFLOW_ID=$(echo "$WORKFLOWS" | jq -r '.workflows[0].id // empty' 2>/dev/null)
if [ -n "$WORKFLOW_ID" ]; then
    echo "Sample workflow ID: $WORKFLOW_ID"
    echo ""

    echo "Fetching workflow stages..."
    curl -s "$API_BASE/workflows/$WORKFLOW_ID/stages" | jq '.'
fi

echo ""
read -p "Press Enter to continue..."
echo ""

# ==========================================
# TEST 3: Assign Task to Sprint
# ==========================================
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}TEST 3: Assign Task to Sprint${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# Get a task
TASK_ID=$(curl -s "$API_BASE/tasks?project_id=$PROJECT_ID&per_page=1" | jq -r '.tasks[0].id // empty' 2>/dev/null)

if [ -z "$TASK_ID" ] || [ "$TASK_ID" = "null" ]; then
    echo -e "${YELLOW}⚠️  No tasks found. Creating a test task...${NC}"

    TASK_RESPONSE=$(curl -s -X POST "$API_BASE/tasks" \
        -H "Content-Type: application/json" \
        -d "{
            \"project_id\": \"$PROJECT_ID\",
            \"title\": \"Test task for sprint assignment\",
            \"description\": \"This task will be assigned to Sprint 1\",
            \"status\": \"todo\"
        }")

    TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.task.id // .id')
    echo "✅ Created task: $TASK_ID"
fi

echo "Assigning task $TASK_ID to sprint $SPRINT_ID..."
ASSIGN_RESPONSE=$(curl -s -X PUT "$API_BASE/tasks/$TASK_ID/sprint" \
    -H "Content-Type: application/json" \
    -d "{\"sprint_id\": \"$SPRINT_ID\"}")

echo "$ASSIGN_RESPONSE" | jq '.'
echo ""
read -p "Press Enter to continue..."
echo ""

# ==========================================
# TEST 4: Knowledge Suggestions
# ==========================================
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}TEST 4: AI Knowledge Suggestions${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

echo "Getting AI-powered knowledge suggestions for project..."
SUGGESTIONS=$(curl -s "$API_BASE/projects/$PROJECT_ID/knowledge/suggestions?limit=3")

echo "$SUGGESTIONS" | jq '.'
echo ""
read -p "Press Enter to continue..."
echo ""

# ==========================================
# TEST 5: Sprint Report
# ==========================================
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}TEST 5: Sprint Report${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

echo "Generating sprint report..."
REPORT=$(curl -s "$API_BASE/sprints/$SPRINT_ID/report")

echo "$REPORT" | jq '.'
echo ""

# ==========================================
# TEST 6: Project Health Report
# ==========================================
echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}TEST 6: Project Health Report${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

echo "Generating project health report..."
HEALTH=$(curl -s "$API_BASE/projects/$PROJECT_ID/health")

echo "$HEALTH" | jq '.'
echo ""

# ==========================================
# SUMMARY
# ==========================================
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✅ Phase 1 Feature Test Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Features demonstrated:"
echo "✅ Sprint creation"
echo "✅ Workflow querying"
echo "✅ Task assignment to sprints"
echo "✅ AI knowledge suggestions"
echo "✅ Sprint reporting"
echo "✅ Project health metrics"
echo ""
echo "Explore more at: http://localhost:8181/docs"
echo ""
