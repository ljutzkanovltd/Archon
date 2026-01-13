#!/bin/bash
# Test registration endpoint

echo "=========================================="
echo "Testing POST /api/auth/register"
echo "=========================================="

# Test 1: Successful registration
echo -e "\n1. Testing successful registration..."
curl -X POST http://localhost:8181/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.user@example.com",
    "password": "TestP@ss123!",
    "full_name": "Test User"
  }' | jq '.'

# Test 2: Duplicate email (should fail with 409)
echo -e "\n\n2. Testing duplicate email (should fail)..."
curl -X POST http://localhost:8181/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.user@example.com",
    "password": "AnotherP@ss123!",
    "full_name": "Another User"
  }' | jq '.'

# Test 3: Weak password (should fail with 400)
echo -e "\n\n3. Testing weak password (should fail)..."
curl -X POST http://localhost:8181/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "weak@example.com",
    "password": "weak",
    "full_name": "Weak Password User"
  }' | jq '.'

# Test 4: Disposable email (should fail with 400)
echo -e "\n\n4. Testing disposable email (should fail)..."
curl -X POST http://localhost:8181/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@mailinator.com",
    "password": "StrongP@ss123!",
    "full_name": "Disposable Email User"
  }' | jq '.'

echo -e "\n\n=========================================="
echo "Tests completed!"
echo "=========================================="
