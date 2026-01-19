#!/bin/bash
# Sprint Organization Script for Jira-Like PM Upgrade Project
#
# This script helps batch-assign tasks to sprints based on phase prefix
# Run after creating sprints via UI

set -e

PROJECT_ID="ec21abac-6631-4a5d-bbf1-e7eca9dfe833"
API_BASE="http://localhost:8181/api"

echo "======================================"
echo " Sprint Organization Script"
echo " Project: Jira-Like PM Upgrade"
echo "======================================"
echo ""

# Step 1: Fetch all sprints
echo "📋 Fetching sprints..."
SPRINTS_JSON=$(curl -s "$API_BASE/projects/$PROJECT_ID/sprints")
SPRINT_COUNT=$(echo "$SPRINTS_JSON" | jq -r '.count // 0')

if [ "$SPRINT_COUNT" -eq 0 ]; then
    echo "❌ No sprints found. Please create sprints via UI first:"
    echo ""
    echo "  1. Navigate to http://localhost:3738/projects/$PROJECT_ID"
    echo "  2. Click 'New Sprint' button (or press Cmd+Shift+S)"
    echo "  3. Create 7 sprints with the following names:"
    echo "     - Sprint 1: Foundation & Database"
    echo "     - Sprint 2: Workflow System UI"
    echo "     - Sprint 3: Sprint Management & UX"
    echo "     - Sprint 4: Enhanced Views"
    echo "     - Sprint 5: Teams & Knowledge"
    echo "     - Sprint 6: Analytics & Reports"
    echo "     - Sprint 7: Polish & Admin"
    echo ""
    echo "  4. Re-run this script after creating sprints"
    exit 1
fi

echo "✅ Found $SPRINT_COUNT sprint(s)"
echo ""

# Extract sprint IDs by name matching
SPRINT1_ID=$(echo "$SPRINTS_JSON" | jq -r '.sprints[] | select(.name | contains("Sprint 1")) | .id')
SPRINT2_ID=$(echo "$SPRINTS_JSON" | jq -r '.sprints[] | select(.name | contains("Sprint 2")) | .id')
SPRINT3_ID=$(echo "$SPRINTS_JSON" | jq -r '.sprints[] | select(.name | contains("Sprint 3")) | .id')
SPRINT4_ID=$(echo "$SPRINTS_JSON" | jq -r '.sprints[] | select(.name | contains("Sprint 4")) | .id')
SPRINT5_ID=$(echo "$SPRINTS_JSON" | jq -r '.sprints[] | select(.name | contains("Sprint 5")) | .id')
SPRINT6_ID=$(echo "$SPRINTS_JSON" | jq -r '.sprints[] | select(.name | contains("Sprint 6")) | .id')
SPRINT7_ID=$(echo "$SPRINTS_JSON" | jq -r '.sprints[] | select(.name | contains("Sprint 7")) | .id')

echo "Sprint IDs:"
[ -n "$SPRINT1_ID" ] && echo "  Sprint 1: $SPRINT1_ID"
[ -n "$SPRINT2_ID" ] && echo "  Sprint 2: $SPRINT2_ID"
[ -n "$SPRINT3_ID" ] && echo "  Sprint 3: $SPRINT3_ID"
[ -n "$SPRINT4_ID" ] && echo "  Sprint 4: $SPRINT4_ID"
[ -n "$SPRINT5_ID" ] && echo "  Sprint 5: $SPRINT5_ID"
[ -n "$SPRINT6_ID" ] && echo "  Sprint 6: $SPRINT6_ID"
[ -n "$SPRINT7_ID" ] && echo "  Sprint 7: $SPRINT7_ID"
echo ""

# Fetch all tasks
echo "📋 Fetching tasks..."
ALL_TASKS_JSON=$(curl -s "$API_BASE/tasks?project_id=$PROJECT_ID&per_page=1000")
TOTAL_TASKS=$(echo "$ALL_TASKS_JSON" | jq -r '.pagination.total // 0')
echo "✅ Found $TOTAL_TASKS task(s)"
echo ""

# Function to assign tasks to sprint
assign_tasks_to_sprint() {
    local sprint_id="$1"
    local sprint_name="$2"
    local phase_patterns="$3"  # Regex pattern for task titles
    local feature_tag="$4"

    echo "🔧 Assigning tasks to $sprint_name..."

    # Get matching task IDs
    local task_ids=$(echo "$ALL_TASKS_JSON" | jq -r ".tasks[] | select(.title | test(\"$phase_patterns\")) | .id")
    local count=0

    for task_id in $task_ids; do
        # Update task sprint_id and feature tag
        curl -s -X PUT "$API_BASE/tasks/$task_id" \
            -H "Content-Type: application/json" \
            -d "{\"sprint_id\": \"$sprint_id\", \"feature\": \"$feature_tag\"}" > /dev/null
        ((count++))
    done

    echo "  ✅ Assigned $count task(s) to $sprint_name"
}

# Assign tasks to each sprint based on phase prefix
if [ -n "$SPRINT1_ID" ]; then
    # Sprint 1: Phase 1.1-1.9 + backend infrastructure
    assign_tasks_to_sprint "$SPRINT1_ID" "Sprint 1: Foundation & Database" \
        "^Phase 1\.[1-9]: |Create archon_(sprints|workflows|project_types|teams|knowledge|hierarchy)|Install PostgreSQL ltree|Enhance archon_tasks|Implement (Sprint|Workflow|Team|ProjectHierarchy|Reporting|KnowledgeLinking)Service|Create API endpoints|Integrate Casbin|Add Casbin permission" \
        "Sprint 1: Foundation"
fi

if [ -n "$SPRINT2_ID" ]; then
    # Sprint 2: Phase 2.1-2.18
    assign_tasks_to_sprint "$SPRINT2_ID" "Sprint 2: Workflow System UI" \
        "^Phase 2\.(1[0-8]?|[1-9]):" \
        "Sprint 2: Workflow UI"
fi

if [ -n "$SPRINT3_ID" ]; then
    # Sprint 3: Phase 1.10-1.23 + Phase 3.1-3.7 (Sprint UX + Timeline start)
    assign_tasks_to_sprint "$SPRINT3_ID" "Sprint 3: Sprint Management & UX" \
        "^Phase 1\.(1[0-9]|2[0-3]):|^Phase 3\.[1-7]:" \
        "Sprint 3: Sprint UX"
fi

if [ -n "$SPRINT4_ID" ]; then
    # Sprint 4: Phase 3.6-3.28 (Enhanced Views - Timeline, Hierarchy, Calendar, Summary, Knowledge View)
    assign_tasks_to_sprint "$SPRINT4_ID" "Sprint 4: Enhanced Views" \
        "^Phase 3\.([6-9]|1[0-9]|2[0-8]):" \
        "Sprint 4: Enhanced Views"
fi

if [ -n "$SPRINT5_ID" ]; then
    # Sprint 5: Phase 4.1-4.18 (Teams & Knowledge)
    assign_tasks_to_sprint "$SPRINT5_ID" "Sprint 5: Teams & Knowledge" \
        "^Phase 4\.(1[0-8]?|[1-9]):" \
        "Sprint 5: Teams & Knowledge"
fi

if [ -n "$SPRINT6_ID" ]; then
    # Sprint 6: Phase 5.1-5.15 (Analytics & Reports)
    assign_tasks_to_sprint "$SPRINT6_ID" "Sprint 6: Analytics & Reports" \
        "^Phase 5\.(1[0-5]?|[1-9]):" \
        "Sprint 6: Analytics & Reports"
fi

if [ -n "$SPRINT7_ID" ]; then
    # Sprint 7: Phase 6.1-6.23 (Polish, Performance, Documentation)
    assign_tasks_to_sprint "$SPRINT7_ID" "Sprint 7: Polish & Admin" \
        "^Phase 6\.(1[0-9]|2[0-3]?|[1-9]):" \
        "Sprint 7: Polish & Admin"
fi

echo ""
echo "======================================"
echo " ✅ Sprint Organization Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. View organized tasks in Kanban view (group by sprint)"
echo "  2. View timeline in Timeline view (sprints as lanes)"
echo "  3. Start Sprint 3 (currently active work)"
echo ""
echo "Documentation: docs/SPRINT_ORGANIZATION_STRATEGY.md"
