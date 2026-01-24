# User Management API Reference

**Version:** 1.0.0
**Base URL:** `http://localhost:8181/api`
**Last Updated:** 2026-01-24

---

## Table of Contents

1. [Authentication](#authentication)
2. [User Management (Admin)](#user-management-admin)
3. [Profile Management (All Users)](#profile-management-all-users)
4. [Response Formats](#response-formats)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Examples](#examples)

---

## Authentication

All authenticated endpoints require a valid JWT token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### POST `/auth/login`

Password-based authentication.

**Request:**
```http
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=SecurePass123!
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "admin",
    "permissions": ["manage_users", "database_sync"],
    "is_active": true,
    "is_verified": true
  }
}
```

**Error Responses:**
- `401` - Invalid credentials
- `403` - Account locked (too many failed attempts)
- `429` - Rate limit exceeded (5 attempts per 15 minutes)

---

### POST `/auth/magic-link`

Request magic link for passwordless authentication.

**Request:**
```http
POST /api/auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Magic link sent to user@example.com",
  "expires_in": 900
}
```

---

### GET `/auth/verify-magic-link`

Verify magic link token and log in user.

**Request:**
```http
GET /api/auth/verify-magic-link?token=abc123...
```

**Response (302 Redirect):**
```
Location: /dashboard?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Error Responses:**
- `400` - Invalid or expired token
- `404` - User not found

---

### POST `/auth/logout`

End user session.

**Request:**
```http
POST /api/auth/logout
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### GET `/auth/me`

Get current authenticated user information.

**Request:**
```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "admin",
  "permissions": ["manage_users", "database_sync"],
  "is_active": true,
  "is_verified": true,
  "created_at": "2024-01-15T10:30:00Z",
  "last_login": "2024-01-24T14:22:00Z"
}
```

---

## User Management (Admin)

### GET `/admin/users`

List all users (admin only).

**Request:**
```http
GET /api/admin/users?page=1&per_page=10&role=admin&is_active=true
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `per_page` (integer, default: 10, max: 100) - Items per page
- `role` (string, optional) - Filter by role (admin, member, viewer)
- `is_active` (boolean, optional) - Filter by active status
- `q` (string, optional) - Search by email or name

**Response (200 OK):**
```json
{
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@example.com",
      "full_name": "Admin User",
      "role": "admin",
      "permissions": ["manage_users", "database_sync"],
      "is_active": true,
      "is_verified": true,
      "created_at": "2024-01-15T10:30:00Z",
      "last_login": "2024-01-24T14:22:00Z",
      "failed_login_attempts": 0,
      "locked_until": null
    }
  ],
  "total": 25,
  "page": 1,
  "per_page": 10,
  "total_pages": 3
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient permissions (not admin)

---

### POST `/admin/users/invite`

Invite a new user (admin only).

**Request:**
```http
POST /api/admin/users/invite
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "full_name": "New User",
  "role": "member",
  "permissions": ["view_agent_work_orders"],
  "send_invite_email": true
}
```

**Request Body:**
- `email` (string, required) - Valid email address
- `full_name` (string, required) - User's full name
- `role` (enum, required) - One of: admin, member, viewer
- `permissions` (array, optional) - Custom permissions
- `send_invite_email` (boolean, default: true) - Send invitation email

**Response (201 Created):**
```json
{
  "success": true,
  "user": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "email": "newuser@example.com",
    "full_name": "New User",
    "role": "member",
    "permissions": ["view_agent_work_orders"],
    "is_active": true,
    "is_verified": false
  },
  "invite_token": "abc123...",
  "invite_link": "http://localhost:3738/auth/verify?token=abc123..."
}
```

**Error Responses:**
- `400` - Invalid email format or role
- `401` - Not authenticated
- `403` - Insufficient permissions
- `409` - User already exists

---

### GET `/admin/users/{user_id}`

Get user details (admin only).

**Request:**
```http
GET /api/admin/users/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_token>
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "member",
  "permissions": ["view_agent_work_orders"],
  "is_active": true,
  "is_verified": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-20T08:15:00Z",
  "last_login": "2024-01-24T14:22:00Z",
  "failed_login_attempts": 0,
  "locked_until": null,
  "activity_summary": {
    "projects_created": 5,
    "tasks_completed": 42,
    "last_active": "2024-01-24T14:22:00Z"
  }
}
```

**Error Responses:**
- `401` - Not authenticated
- `403` - Insufficient permissions
- `404` - User not found

---

### PUT `/admin/users/{user_id}`

Update user information (admin only).

**Request:**
```http
PUT /api/admin/users/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "full_name": "John Updated Doe",
  "role": "admin",
  "is_active": true
}
```

**Request Body (all optional):**
- `full_name` (string) - User's full name
- `role` (enum) - One of: admin, member, viewer
- `is_active` (boolean) - Active status

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "full_name": "John Updated Doe",
    "role": "admin",
    "is_active": true,
    "updated_at": "2024-01-24T15:30:00Z"
  }
}
```

**Error Responses:**
- `400` - Invalid role value
- `401` - Not authenticated
- `403` - Insufficient permissions
- `404` - User not found

---

### PUT `/admin/users/{user_id}/permissions`

Update user permissions (admin only).

**Request:**
```http
PUT /api/admin/users/550e8400-e29b-41d4-a716-446655440000/permissions
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "permissions": [
    "manage_users",
    "view_agent_work_orders",
    "database_sync"
  ]
}
```

**Available Permissions:**
- `manage_users` - User management access
- `database_sync` - Database sync tools
- `view_mcp_inspector` - MCP inspector access
- `view_agent_work_orders` - Agent work orders access
- `manage_all_projects` - Full project management
- `manage_all_tasks` - Full task management

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "permissions": [
      "manage_users",
      "view_agent_work_orders",
      "database_sync"
    ]
  }
}
```

---

### POST `/admin/users/{user_id}/deactivate`

Deactivate user account (admin only).

**Request:**
```http
POST /api/admin/users/550e8400-e29b-41d4-a716-446655440000/deactivate
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "User left organization"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User deactivated successfully",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "is_active": false,
    "deactivated_at": "2024-01-24T15:45:00Z"
  }
}
```

---

### POST `/admin/users/{user_id}/activate`

Reactivate user account (admin only).

**Request:**
```http
POST /api/admin/users/550e8400-e29b-41d4-a716-446655440000/activate
Authorization: Bearer <admin_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User activated successfully",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "is_active": true,
    "activated_at": "2024-01-24T15:50:00Z"
  }
}
```

---

## Profile Management (All Users)

### GET `/auth/users/me/profile`

Get own profile information.

**Request:**
```http
GET /api/auth/users/me/profile
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "full_name": "John Doe",
  "bio": "Software Engineer",
  "company": "Acme Corp",
  "job_title": "Senior Developer",
  "location": "San Francisco, CA",
  "timezone": "America/Los_Angeles",
  "theme_preference": "dark",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

---

### PUT `/auth/users/me/profile`

Update own profile information.

**Request:**
```http
PUT /api/auth/users/me/profile
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "full_name": "John Updated Doe",
  "bio": "Senior Software Engineer",
  "company": "Acme Corporation",
  "job_title": "Senior Developer",
  "location": "San Francisco, CA",
  "timezone": "America/Los_Angeles",
  "theme_preference": "dark"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "full_name": "John Updated Doe",
    "bio": "Senior Software Engineer",
    "updated_at": "2024-01-24T16:00:00Z"
  }
}
```

---

### PUT `/auth/users/me/password`

Change own password.

**Request:**
```http
PUT /api/auth/users/me/password
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "current_password": "OldPassword123!",
  "new_password": "NewSecurePass456!",
  "confirm_password": "NewSecurePass456!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

**Error Responses:**
- `400` - Passwords don't match or too weak
- `401` - Current password incorrect
- `422` - Validation error

---

## Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "detail": "Error description",
  "status_code": 400,
  "error_code": "INVALID_INPUT"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET/PUT/DELETE |
| 201 | Created | Successful POST (resource created) |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions or account locked |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Common Error Codes

```json
{
  "detail": "User with this email already exists",
  "status_code": 409,
  "error_code": "USER_EXISTS"
}
```

**Error Codes:**
- `INVALID_CREDENTIALS` - Login failed
- `ACCOUNT_LOCKED` - Too many failed attempts
- `TOKEN_EXPIRED` - JWT token expired
- `INSUFFICIENT_PERMISSIONS` - Not authorized
- `USER_NOT_FOUND` - User doesn't exist
- `USER_EXISTS` - Email already registered
- `INVALID_INPUT` - Validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## Rate Limiting

### Limits by Endpoint

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 5 requests | 15 minutes |
| `/auth/magic-link` | 3 requests | 15 minutes |
| `/admin/users/*` | 100 requests | 1 minute |
| All other endpoints | 1000 requests | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1706198400
```

### Rate Limit Response (429)

```json
{
  "detail": "Rate limit exceeded. Try again in 10 minutes.",
  "status_code": 429,
  "retry_after": 600
}
```

---

## Examples

### Complete Login Flow

```bash
# 1. Login
curl -X POST http://localhost:8181/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com&password=SecurePass123!"

# Response
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": { ... }
}

# 2. Use token for authenticated requests
curl -X GET http://localhost:8181/api/auth/me \
  -H "Authorization: Bearer eyJhbGc..."

# 3. List users (admin only)
curl -X GET http://localhost:8181/api/admin/users?page=1&per_page=10 \
  -H "Authorization: Bearer eyJhbGc..."
```

### Invite New User

```bash
curl -X POST http://localhost:8181/api/admin/users/invite \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "full_name": "New User",
    "role": "member",
    "permissions": ["view_agent_work_orders"]
  }'
```

### Update User Profile

```bash
curl -X PUT http://localhost:8181/api/auth/users/me/profile \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Updated Name",
    "bio": "Software Engineer",
    "theme_preference": "dark"
  }'
```

---

## SDKs & Client Libraries

### JavaScript/TypeScript

```typescript
import { ArchonClient } from '@archon/client';

const client = new ArchonClient({
  baseURL: 'http://localhost:8181',
  token: 'your-jwt-token'
});

// Login
const { user, access_token } = await client.auth.login({
  email: 'user@example.com',
  password: 'password123'
});

// List users (admin)
const { users, total } = await client.admin.listUsers({
  page: 1,
  per_page: 10
});

// Update profile
await client.profile.update({
  full_name: 'New Name',
  bio: 'Software Engineer'
});
```

### Python

```python
from archon_client import ArchonClient

client = ArchonClient(
    base_url='http://localhost:8181',
    token='your-jwt-token'
)

# Login
response = client.auth.login(
    email='user@example.com',
    password='password123'
)

# List users (admin)
users = client.admin.list_users(page=1, per_page=10)

# Update profile
client.profile.update(
    full_name='New Name',
    bio='Software Engineer'
)
```

---

**API Version:** 1.0.0
**Last Updated:** 2026-01-24
**Support:** Submit issues to GitHub repository
