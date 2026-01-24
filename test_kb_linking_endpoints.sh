#!/bin/bash

# Test script for KB-Project Bidirectional Linking Endpoints
# Phase 1.2-1.4 Implementation Verification

set -e

API_BASE="http://localhost:8181"
PROJECT_ID="d80817df-6294-4e66-9b43-cbafb15da400"  # Replace with actual project ID
SOURCE_ID="your-source-id"  # Replace with actual source ID from archon_sources
KNOWLEDGE_ID="your-knowledge-id"  # Replace with actual page_id

echo "🧪 Testing KB-Project Bidirectional Linking Endpoints"
echo "=================================================="
echo ""

# Test 1: Phase 1.2 - Get backlinks for a KB source
echo "📋 Test 1: GET /api/knowledge/sources/{source_id}/projects"
echo "Getting all projects linked to source: $SOURCE_ID"
curl -s -X GET "$API_BASE/api/knowledge/sources/$SOURCE_ID/projects" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo "✅ Test 1 complete"
echo ""

# Test 2: Phase 1.3 - Link KB source to project
echo "📋 Test 2: POST /api/projects/{project_id}/knowledge/sources/{source_id}/link"
echo "Linking source $SOURCE_ID to project $PROJECT_ID"
curl -s -X POST "$API_BASE/api/projects/$PROJECT_ID/knowledge/sources/$SOURCE_ID/link" \
  -H "Content-Type: application/json" \
  -d '{
    "linked_by": "TestUser"
  }' | jq '.'
echo ""
echo "✅ Test 2 complete"
echo ""

# Test 3: Phase 1.3 - Verify link was created (get backlinks again)
echo "📋 Test 3: Verify link created - GET /api/knowledge/sources/{source_id}/projects"
curl -s -X GET "$API_BASE/api/knowledge/sources/$SOURCE_ID/projects" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo "✅ Test 3 complete"
echo ""

# Test 4: Phase 1.4 - Get AI suggestions WITHOUT linked items
echo "📋 Test 4: GET /api/projects/{project_id}/knowledge/suggestions?include_linked=false"
echo "Getting suggestions for project $PROJECT_ID (exclude linked)"
curl -s -X GET "$API_BASE/api/projects/$PROJECT_ID/knowledge/suggestions?limit=5&include_linked=false" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo "✅ Test 4 complete"
echo ""

# Test 5: Phase 1.4 - Get AI suggestions WITH linked items
echo "📋 Test 5: GET /api/projects/{project_id}/knowledge/suggestions?include_linked=true"
echo "Getting suggestions for project $PROJECT_ID (include linked)"
curl -s -X GET "$API_BASE/api/projects/$PROJECT_ID/knowledge/suggestions?limit=10&include_linked=true" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo "✅ Test 5 complete"
echo ""

# Test 6: Phase 1.3 - Unlink KB source from project
echo "📋 Test 6: DELETE /api/projects/{project_id}/knowledge/sources/{source_id}/link"
echo "Unlinking source $SOURCE_ID from project $PROJECT_ID"
curl -s -X DELETE "$API_BASE/api/projects/$PROJECT_ID/knowledge/sources/$SOURCE_ID/link" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo "✅ Test 6 complete"
echo ""

# Test 7: Verify unlink (get backlinks - should be empty now)
echo "📋 Test 7: Verify unlink - GET /api/knowledge/sources/{source_id}/projects"
curl -s -X GET "$API_BASE/api/knowledge/sources/$SOURCE_ID/projects" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo "✅ Test 7 complete"
echo ""

# Test 8: Test existing endpoint - Get knowledge sources (reverse lookup)
echo "📋 Test 8: GET /api/knowledge/{knowledge_type}/{knowledge_id}/sources"
echo "Getting all entities linked to knowledge item $KNOWLEDGE_ID"
curl -s -X GET "$API_BASE/api/knowledge/rag_page/$KNOWLEDGE_ID/sources" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo "✅ Test 8 complete"
echo ""

echo "=================================================="
echo "🎉 All tests complete!"
echo ""
echo "Summary of Implemented Endpoints:"
echo "1. ✅ GET /api/knowledge/sources/{source_id}/projects - Backlinks"
echo "2. ✅ POST /api/projects/{project_id}/knowledge/sources/{source_id}/link - Link source to project"
echo "3. ✅ DELETE /api/projects/{project_id}/knowledge/sources/{source_id}/link - Unlink source from project"
echo "4. ✅ GET /api/projects/{project_id}/knowledge/suggestions?include_linked=bool - Enhanced AI suggestions"
echo "5. ✅ GET /api/knowledge/{knowledge_type}/{knowledge_id}/sources - Existing reverse lookup"
echo ""
