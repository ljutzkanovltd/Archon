#!/bin/bash

# Update tasks to review status
# Phase 1.2-1.4 KB-Project Bidirectional Linking

API_BASE="http://localhost:8181"

echo "Updating tasks to 'review' status..."

# Task 1: Phase 1.2 - Backlinks Endpoint
curl -X PUT "$API_BASE/api/tasks/f20bbac5-87d4-4422-95ac-f965f505894b" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "review"
  }'
echo ""

# Task 2: Phase 1.3 - Link/Unlink Endpoints
curl -X PUT "$API_BASE/api/tasks/9dab761d-2b2d-424c-a135-f0790c22d83a" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "review"
  }'
echo ""

# Task 3: Phase 1.4 - Enhanced AI Suggestions
curl -X PUT "$API_BASE/api/tasks/b98142a1-ab03-44c5-b9bf-cc0168849fc0" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "review"
  }'
echo ""

echo "✅ All tasks updated to 'review' status"
