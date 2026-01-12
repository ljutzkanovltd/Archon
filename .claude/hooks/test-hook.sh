#!/bin/bash
# Test script for dangerous-operations.sh hook
# Tests various dangerous patterns to ensure hook works correctly

set -eo pipefail

HOOK_SCRIPT=".claude/hooks/dangerous-operations.sh"
PASSED=0
FAILED=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Testing Dangerous Operations Hook"
echo "=================================="
echo ""

# Test function
test_hook() {
  local test_name="$1"
  local tool_name="$2"
  local tool_input="$3"
  local expected_decision="$4"  # allow, deny, or ask

  echo -n "Testing: $test_name... "

  # Create JSON input
  local json_input=$(cat <<EOF
{
  "session_id": "test-session",
  "transcript_path": "/tmp/test-transcript.jsonl",
  "cwd": "/tmp",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "$tool_name",
  "tool_input": $tool_input,
  "tool_use_id": "toolu_test123"
}
EOF
)

  # Run hook and capture output
  local output
  local exit_code=0
  local stderr_output
  stderr_output=$(mktemp)
  output=$(echo "$json_input" | bash "$HOOK_SCRIPT" 2>"$stderr_output") || exit_code=$?

  # Parse decision from output
  local actual_decision="error"
  if [ -n "$output" ]; then
    actual_decision=$(echo "$output" | jq -r '.hookSpecificOutput.permissionDecision // "error"' 2>/dev/null || echo "error")
  fi

  # Clean up temp file
  rm -f "$stderr_output"

  if [ "$actual_decision" = "$expected_decision" ]; then
    echo -e "${GREEN}✓ PASS${NC} (decision: $actual_decision)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} (expected: $expected_decision, got: $actual_decision)"
    FAILED=$((FAILED + 1))
  fi
}

# Test 1: Safe Bash command should be allowed
test_hook \
  "Safe Bash command" \
  "Bash" \
  '{"command":"ls -la","description":"List files"}' \
  "allow"

# Test 2: DROP SCHEMA CASCADE should be denied
test_hook \
  "DROP SCHEMA CASCADE" \
  "Bash" \
  '{"command":"psql -c \"DROP SCHEMA public CASCADE;\"","description":"Drop schema"}' \
  "deny"

# Test 3: TRUNCATE CASCADE should be denied
test_hook \
  "TRUNCATE CASCADE" \
  "Bash" \
  '{"command":"psql -c \"TRUNCATE TABLE users CASCADE;\"","description":"Truncate table"}' \
  "deny"

# Test 4: rm -rf / should be denied
test_hook \
  "rm -rf /" \
  "Bash" \
  '{"command":"rm -rf /","description":"Remove root"}' \
  "deny"

# Test 5: git push --force to main should be denied
test_hook \
  "git push --force main" \
  "Bash" \
  '{"command":"git push --force origin main","description":"Force push"}' \
  "deny"

# Test 6: docker-compose down -v should be denied
test_hook \
  "docker-compose down -v" \
  "Bash" \
  '{"command":"docker-compose down -v","description":"Remove volumes"}' \
  "deny"

# Test 7: DELETE FROM should ask for approval
test_hook \
  "DELETE FROM table" \
  "Bash" \
  '{"command":"psql -c \"DELETE FROM users WHERE id=1;\"","description":"Delete user"}' \
  "ask"

# Test 8: UPDATE SET should ask for approval
test_hook \
  "UPDATE SET" \
  "Bash" \
  '{"command":"psql -c \"UPDATE users SET email='test@example.com';\"","description":"Update user"}' \
  "ask"

# Test 9: Safe file write should be allowed
test_hook \
  "Safe file write" \
  "Write" \
  '{"file_path":"/tmp/test.txt","content":"test content"}' \
  "allow"

# Test 10: Safe edit should be allowed
test_hook \
  "Safe edit" \
  "Edit" \
  '{"file_path":"/tmp/test.txt","old_string":"old","new_string":"new"}' \
  "allow"

echo ""
echo "=================================="
echo "Test Results:"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
