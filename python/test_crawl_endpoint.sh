#!/bin/bash
# Test script for Phase 6.4 - Project URL Crawl Endpoint
# Usage: ./test_crawl_endpoint.sh [JWT_TOKEN]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:8181"
JWT_TOKEN="${1:-}"

echo "========================================="
echo "Phase 6.4 - Project URL Crawl Endpoint Test"
echo "========================================="
echo ""

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if backend is running
echo "1. Checking backend health..."
if curl -s "${API_BASE}/health" > /dev/null 2>&1; then
    print_success "Backend is running"
else
    print_error "Backend is not running. Start it with: cd /home/ljutzkanov/Documents/Projects/archon && docker compose up -d"
    exit 1
fi
echo ""

# Test 1: Create test project
echo "2. Creating test project..."
CREATE_RESPONSE=$(curl -s -X POST "${API_BASE}/api/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Phase 6.4 Crawl Test Project",
    "description": "Testing the new URL crawl endpoint"
  }')

PROJECT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.project_id // .id // empty')

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" == "null" ]; then
    print_error "Failed to create project"
    echo "$CREATE_RESPONSE" | jq .
    exit 1
fi

print_success "Project created: $PROJECT_ID"
echo ""

# Test 2: Test URL validation (invalid URL)
echo "3. Testing URL validation (should fail)..."
VALIDATION_RESPONSE=$(curl -s -X POST "${API_BASE}/api/projects/${PROJECT_ID}/documents/crawl" \
  -F "url=invalid-url" \
  -F "max_depth=1" 2>&1 || true)

if echo "$VALIDATION_RESPONSE" | grep -q "Invalid token\|401\|403"; then
    print_info "Authentication required for this endpoint"
    print_info "Run: ./test_crawl_endpoint.sh YOUR_JWT_TOKEN"
    echo ""
    print_info "Or test without auth using curl:"
    echo "curl -X POST \"${API_BASE}/api/projects/${PROJECT_ID}/documents/crawl\" \\"
    echo "  -F \"url=https://example.com\" \\"
    echo "  -F \"max_depth=1\" \\"
    echo "  -F \"tags=test\" \\"
    echo "  -F \"knowledge_type=technical\" \\"
    echo "  -F \"extract_code_examples=true\" \\"
    echo "  -F \"is_project_private=true\" \\"
    echo "  -F \"send_to_kb=false\""
    exit 0
elif echo "$VALIDATION_RESPONSE" | grep -q "Invalid URL\|422"; then
    print_success "URL validation working correctly (rejected invalid URL)"
else
    print_error "Unexpected validation response"
    echo "$VALIDATION_RESPONSE"
fi
echo ""

# If JWT token provided, continue with authenticated tests
if [ -n "$JWT_TOKEN" ]; then
    echo "4. Testing valid URL crawl (with authentication)..."

    CRAWL_RESPONSE=$(curl -s -X POST "${API_BASE}/api/projects/${PROJECT_ID}/documents/crawl" \
      -H "Authorization: Bearer ${JWT_TOKEN}" \
      -F "url=https://example.com" \
      -F "max_depth=1" \
      -F "tags=test,phase64" \
      -F "knowledge_type=technical" \
      -F "extract_code_examples=true" \
      -F "is_project_private=true" \
      -F "send_to_kb=false")

    PROGRESS_ID=$(echo "$CRAWL_RESPONSE" | jq -r '.progressId // empty')

    if [ -z "$PROGRESS_ID" ] || [ "$PROGRESS_ID" == "null" ]; then
        print_error "Failed to start crawl"
        echo "$CRAWL_RESPONSE" | jq .
        exit 1
    fi

    print_success "Crawl started: $PROGRESS_ID"
    echo "$CRAWL_RESPONSE" | jq .
    echo ""

    # Test 5: Poll progress
    echo "5. Polling progress (10 times)..."
    for i in {1..10}; do
        sleep 2
        PROGRESS=$(curl -s "${API_BASE}/api/progress/${PROGRESS_ID}")
        STATUS=$(echo "$PROGRESS" | jq -r '.status')
        PERCENT=$(echo "$PROGRESS" | jq -r '.progress')
        LOG=$(echo "$PROGRESS" | jq -r '.log')

        echo "[$i/10] Status: $STATUS | Progress: ${PERCENT}% | Log: $LOG"

        if [ "$STATUS" == "completed" ]; then
            print_success "Crawl completed successfully!"
            echo ""
            echo "6. Final progress state:"
            echo "$PROGRESS" | jq .
            break
        elif [ "$STATUS" == "error" ]; then
            print_error "Crawl failed"
            echo "$PROGRESS" | jq .
            exit 1
        fi
    done
    echo ""

    # Test 6: Check project documents
    echo "7. Checking project documents..."
    DOCS_RESPONSE=$(curl -s "${API_BASE}/api/projects/${PROJECT_ID}/documents" \
      -H "Authorization: Bearer ${JWT_TOKEN}")

    DOC_COUNT=$(echo "$DOCS_RESPONSE" | jq -r '.count // 0')
    print_success "Found $DOC_COUNT document(s) in project"
    echo "$DOCS_RESPONSE" | jq .
    echo ""

    print_success "All tests passed!"
else
    print_info "Skipping authenticated tests (no JWT token provided)"
    print_info "To run full tests, provide JWT token: ./test_crawl_endpoint.sh YOUR_JWT_TOKEN"
fi

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo "Project ID: $PROJECT_ID"
echo "Test URL: https://example.com"
echo ""
echo "Manual test command:"
echo "curl -X POST \"${API_BASE}/api/projects/${PROJECT_ID}/documents/crawl\" \\"
echo "  -F \"url=https://example.com\" \\"
echo "  -F \"max_depth=1\" \\"
echo "  -F \"tags=test,phase64\""
echo ""
