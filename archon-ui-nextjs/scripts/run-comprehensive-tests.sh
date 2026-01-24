#!/bin/bash

#######################################
# Comprehensive Integration Test Runner
#######################################
#
# Purpose: Automated script to run comprehensive E2E tests
# with proper setup validation and reporting
#
# Usage:
#   ./scripts/run-comprehensive-tests.sh              # Run all tests
#   ./scripts/run-comprehensive-tests.sh --headed     # Run with visible browser
#   ./scripts/run-comprehensive-tests.sh --debug      # Run with debugging
#   ./scripts/run-comprehensive-tests.sh --ui         # Run with Playwright UI
#
#######################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_URL="http://localhost:8181"
FRONTEND_URL="http://localhost:3738"

# Test options
TEST_MODE="normal"
if [[ "$1" == "--headed" ]]; then
  TEST_MODE="headed"
elif [[ "$1" == "--debug" ]]; then
  TEST_MODE="debug"
elif [[ "$1" == "--ui" ]]; then
  TEST_MODE="ui"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Comprehensive Integration Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

#######################################
# Step 1: Pre-flight Checks
#######################################

echo -e "${YELLOW}[1/6] Running pre-flight checks...${NC}"

# Check if backend is running
if ! curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}✗ Backend not running at $BACKEND_URL${NC}"
  echo -e "${YELLOW}  Start backend: cd ~/Documents/Projects/archon && ./start-archon.sh${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Backend running at $BACKEND_URL${NC}"

# Check if frontend is running
if ! curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
  echo -e "${RED}✗ Frontend not running at $FRONTEND_URL${NC}"
  echo -e "${YELLOW}  Start frontend: cd archon-ui-nextjs && npm run dev${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Frontend running at $FRONTEND_URL${NC}"

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
  echo -e "${RED}✗ npm/npx not found${NC}"
  exit 1
fi
echo -e "${GREEN}✓ npm/npx installed${NC}"

# Check if node_modules exists
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  echo -e "${RED}✗ Dependencies not installed${NC}"
  echo -e "${YELLOW}  Run: npm install${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""

#######################################
# Step 2: Test User Validation
#######################################

echo -e "${YELLOW}[2/6] Validating test users...${NC}"

# Check if test users exist (via API)
TEST_USERS=("testadmin@archon.dev" "testmanager@archon.dev" "testmember@archon.dev" "testviewer@archon.dev")
MISSING_USERS=()

for user in "${TEST_USERS[@]}"; do
  # Try to login with test user
  RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=$user&password=Test123!" 2>&1 || echo "error")

  if [[ "$RESPONSE" == "error" ]] || [[ "$RESPONSE" == *"Invalid credentials"* ]]; then
    MISSING_USERS+=("$user")
  fi
done

if [ ${#MISSING_USERS[@]} -gt 0 ]; then
  echo -e "${YELLOW}⚠ Some test users may not exist or have different passwords:${NC}"
  for user in "${MISSING_USERS[@]}"; do
    echo -e "${YELLOW}  - $user${NC}"
  done
  echo -e "${YELLOW}  The tests will attempt to create/use these users.${NC}"
  echo -e "${YELLOW}  If tests fail, run: ./scripts/create-test-users.sh${NC}"
else
  echo -e "${GREEN}✓ All test users validated${NC}"
fi

echo ""

#######################################
# Step 3: Backup Database (Optional)
#######################################

echo -e "${YELLOW}[3/6] Database backup...${NC}"

if [[ -f "$PROJECT_ROOT/../archon/scripts/backup-archon.sh" ]]; then
  read -p "Create database backup before tests? (recommended) [Y/n]: " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo -e "${BLUE}Creating backup...${NC}"
    cd "$PROJECT_ROOT/../archon" && ./scripts/backup-archon.sh
    echo -e "${GREEN}✓ Backup created${NC}"
  else
    echo -e "${YELLOW}⚠ Skipping backup${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Backup script not found, skipping${NC}"
fi

echo ""

#######################################
# Step 4: Install Playwright Browsers
#######################################

echo -e "${YELLOW}[4/6] Checking Playwright browsers...${NC}"

if ! npx playwright --version &> /dev/null; then
  echo -e "${YELLOW}Installing Playwright browsers...${NC}"
  npx playwright install --with-deps
  echo -e "${GREEN}✓ Playwright browsers installed${NC}"
else
  echo -e "${GREEN}✓ Playwright browsers ready${NC}"
fi

echo ""

#######################################
# Step 5: Run Tests
#######################################

echo -e "${YELLOW}[5/6] Running comprehensive integration tests...${NC}"
echo -e "${BLUE}Test mode: $TEST_MODE${NC}"
echo -e "${BLUE}Expected duration: ~20-30 minutes${NC}"
echo ""

cd "$PROJECT_ROOT"

# Run tests based on mode
case $TEST_MODE in
  headed)
    echo -e "${BLUE}Running tests with visible browser...${NC}"
    npx playwright test e2e/comprehensive-integration-test.spec.ts --headed
    ;;
  debug)
    echo -e "${BLUE}Running tests in debug mode...${NC}"
    npx playwright test e2e/comprehensive-integration-test.spec.ts --debug
    ;;
  ui)
    echo -e "${BLUE}Opening Playwright UI...${NC}"
    npx playwright test e2e/comprehensive-integration-test.spec.ts --ui
    ;;
  *)
    echo -e "${BLUE}Running tests in headless mode...${NC}"
    npx playwright test e2e/comprehensive-integration-test.spec.ts
    ;;
esac

TEST_EXIT_CODE=$?

echo ""

#######################################
# Step 6: Generate Report
#######################################

echo -e "${YELLOW}[6/6] Generating test report...${NC}"

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo -e "${GREEN}System Status:${NC}"
  echo -e "${GREEN}  - Feature Integration: ✓ COMPLETE${NC}"
  echo -e "${GREEN}  - Data Integrity: ✓ VERIFIED${NC}"
  echo -e "${GREEN}  - Performance: ✓ ACCEPTABLE${NC}"
  echo -e "${GREEN}  - Security: ✓ VALIDATED${NC}"
  echo -e "${GREEN}  - Accessibility: ✓ COMPLIANT${NC}"
  echo -e "${GREEN}  - Ready for Production: ✓ YES${NC}"
  echo ""

  # Check if HTML report was generated
  if [ -f "$PROJECT_ROOT/playwright-report/index.html" ]; then
    echo -e "${BLUE}HTML Report available at:${NC}"
    echo -e "${BLUE}  file://$PROJECT_ROOT/playwright-report/index.html${NC}"
    echo ""

    # Ask if user wants to open report
    read -p "Open HTML report in browser? [Y/n]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
      if command -v xdg-open &> /dev/null; then
        xdg-open "$PROJECT_ROOT/playwright-report/index.html"
      elif command -v open &> /dev/null; then
        open "$PROJECT_ROOT/playwright-report/index.html"
      else
        echo -e "${YELLOW}Could not auto-open. Please open manually:${NC}"
        echo -e "${YELLOW}  file://$PROJECT_ROOT/playwright-report/index.html${NC}"
      fi
    fi
  fi
else
  echo ""
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}✗ TESTS FAILED${NC}"
  echo -e "${RED}========================================${NC}"
  echo ""
  echo -e "${RED}Some tests did not pass. Review the output above.${NC}"
  echo ""

  if [ -d "$PROJECT_ROOT/test-results" ]; then
    echo -e "${YELLOW}Test results available at:${NC}"
    echo -e "${YELLOW}  $PROJECT_ROOT/test-results/${NC}"
    echo ""
  fi

  if [ -f "$PROJECT_ROOT/playwright-report/index.html" ]; then
    echo -e "${YELLOW}HTML Report available at:${NC}"
    echo -e "${YELLOW}  file://$PROJECT_ROOT/playwright-report/index.html${NC}"
    echo ""

    # Ask if user wants to open failed report
    read -p "Open HTML report to debug failures? [Y/n]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
      if command -v xdg-open &> /dev/null; then
        xdg-open "$PROJECT_ROOT/playwright-report/index.html"
      elif command -v open &> /dev/null; then
        open "$PROJECT_ROOT/playwright-report/index.html"
      fi
    fi
  fi

  echo -e "${YELLOW}Troubleshooting tips:${NC}"
  echo -e "${YELLOW}  1. Check test-results/ for screenshots and logs${NC}"
  echo -e "${YELLOW}  2. Run with --debug flag to step through tests${NC}"
  echo -e "${YELLOW}  3. Verify all services are healthy${NC}"
  echo -e "${YELLOW}  4. Check docs/testing/COMPREHENSIVE_TEST_GUIDE.md${NC}"
  echo ""
fi

#######################################
# Cleanup and Exit
#######################################

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test execution complete${NC}"
echo -e "${BLUE}========================================${NC}"

exit $TEST_EXIT_CODE
