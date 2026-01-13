#!/bin/bash

# Test script for Archon Authentication API
# Tests login, authenticated endpoints, and logout

set -e

BASE_URL="http://localhost:8181"
TEST_EMAIL="admin@archon.dev"
TEST_PASSWORD="password123"

echo "=== Archon Authentication API Tests ==="
echo ""

# Test 1: Login with correct credentials
echo "Test 1: Login with correct credentials"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$TEST_EMAIL&password=$TEST_PASSWORD")

echo "Response: $LOGIN_RESPONSE"
echo ""

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token"
  exit 1
fi

echo "✅ Login successful! Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# Test 2: Get current user info
echo "Test 2: Get current user info"
USER_INFO=$(curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $USER_INFO"
echo ""

USER_EMAIL=$(echo "$USER_INFO" | jq -r '.email')
if [ "$USER_EMAIL" == "$TEST_EMAIL" ]; then
  echo "✅ User info retrieved successfully"
else
  echo "❌ User email mismatch"
  exit 1
fi
echo ""

# Test 3: Refresh token
echo "Test 3: Refresh token"
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/refresh" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $REFRESH_RESPONSE"
NEW_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.access_token')

if [ "$NEW_TOKEN" == "null" ] || [ -z "$NEW_TOKEN" ]; then
  echo "❌ Failed to refresh token"
  exit 1
fi

echo "✅ Token refreshed successfully"
echo ""

# Test 4: Logout
echo "Test 4: Logout"
LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $LOGOUT_RESPONSE"
echo "✅ Logout successful"
echo ""

# Test 5: Login with incorrect password
echo "Test 5: Login with incorrect password (should fail)"
ERROR_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$TEST_EMAIL&password=wrongpassword")

echo "Response: $ERROR_RESPONSE"

ERROR_DETAIL=$(echo "$ERROR_RESPONSE" | jq -r '.detail')
if [[ "$ERROR_DETAIL" == *"Incorrect email or password"* ]]; then
  echo "✅ Correctly rejected incorrect password"
else
  echo "❌ Expected error for incorrect password"
  exit 1
fi
echo ""

# Test 6: Access protected endpoint without token
echo "Test 6: Access protected endpoint without token (should fail)"
UNAUTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "$BASE_URL/api/auth/me")

HTTP_STATUS=$(echo "$UNAUTH_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
if [ "$HTTP_STATUS" == "401" ]; then
  echo "✅ Correctly rejected request without token"
else
  echo "❌ Expected 401 status for unauthorized request"
  exit 1
fi
echo ""

echo "=== All tests passed! ==="
