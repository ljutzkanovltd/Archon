# RBAC API Reference

**Version**: 1.0.0
**Base URL**: `http://localhost:8181`
**Authentication**: Bearer Token (JWT)

---

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [User Management Endpoints](#user-management-endpoints)
3. [Permission Management](#permission-management)
4. [Project Access Control](#project-access-control)
5. [Response Formats](#response-formats)
6. [Error Codes](#error-codes)

---

## Authentication Endpoints

### POST /api/auth/login

**Description**: Authenticate user and receive JWT token with permissions.

**Request**:
```http
POST /api/auth/login HTTP/1.1
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=SecurePassword123!
```

**Response** (Success - 200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "full_name": "John Doe",
    "is_verified": true,
    "role": "member",
    "permissions": [
      "view_agent_work_orders",
      "view_mcp_inspector"
    ]
  }
}
```

**Response** (Error - 401):
```json
{
  "detail": "Incorrect email or password"
}
```

**RBAC Notes**:
- `permissions` array contains all active permissions from `archon_user_permissions` table
- `role` field: `"admin"` or `"member"`
- Admin users receive all available permissions
- JWT token includes `permissions` array for stateless validation

---

### GET /api/auth/users/me

**Description**: Get current authenticated user profile with permissions.

**Request**:
```http
GET /api/auth/users/me HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (Success - 200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://...",
  "is_active": true,
  "is_verified": true,
  "role": "member",
  "permissions": [
    "view_agent_work_orders"
  ],
  "last_login_at": "2026-01-19T15:30:00Z",
  "created_at": "2026-01-01T00:00:00Z"
}
```

**Response** (Error - 401):
```json
{
  "detail": "Invalid token: expired"
}
```

**RBAC Notes**:
- Permissions are reloaded from database on every request
- Use this endpoint to refresh user permissions without re-login
- Returns `permissions` array matching `archon_user_permissions` table

---

## User Management Endpoints

### GET /api/admin/users

**Description**: List all users (admin only).

**Required Permission**: `manage_users` OR `role = 'admin'`

**Request**:
```http
GET /api/admin/users HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `page` | integer | Page number (1-indexed) | 1 |
| `per_page` | integer | Items per page (max 100) | 50 |
| `search` | string | Search by email or name | - |
| `role` | string | Filter by role (`admin`, `member`) | - |
| `is_active` | boolean | Filter by active status | - |

**Response** (Success - 200):
```json
{
  "success": true,
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "member",
      "is_active": true,
      "is_verified": true,
      "permissions_count": 2,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "per_page": 50
}
```

**Response** (Error - 403):
```json
{
  "detail": "Admin access required. You do not have permission to manage users."
}
```

---

### GET /api/admin/users/{user_id}

**Description**: Get detailed user information including permissions.

**Required Permission**: `manage_users` OR `role = 'admin'`

**Request**:
```http
GET /api/admin/users/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (Success - 200):
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "member",
    "is_active": true,
    "is_verified": true,
    "permissions": [
      {
        "permission_key": "view_agent_work_orders",
        "is_active": true,
        "granted_at": "2026-01-15T10:00:00Z",
        "granted_by_email": "admin@archon.dev"
      }
    ],
    "projects_access": [
      {
        "project_id": "abc-123",
        "project_title": "My Project",
        "access_level": "member"
      }
    ],
    "created_at": "2026-01-01T00:00:00Z",
    "last_login_at": "2026-01-19T15:30:00Z"
  }
}
```

---

### PUT /api/admin/users/{user_id}

**Description**: Update user profile and role (admin only).

**Required Permission**: `manage_users` OR `role = 'admin'`

**Request**:
```http
PUT /api/admin/users/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "full_name": "Jane Doe",
  "role": "admin",
  "is_active": true
}
```

**Response** (Success - 200):
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "full_name": "Jane Doe",
    "role": "admin",
    "is_active": true,
    "updated_at": "2026-01-19T15:35:00Z"
  }
}
```

**RBAC Notes**:
- Changing `role` to `admin` automatically grants all permissions
- Changing from `admin` to `member` does NOT revoke permissions (manual cleanup required)
- Use permission endpoints to manage granular permissions

---

## Permission Management

### GET /api/admin/users/{user_id}/permissions

**Description**: Get all permissions for a specific user.

**Required Permission**: `manage_users` OR `role = 'admin'`

**Request**:
```http
GET /api/admin/users/550e8400-e29b-41d4-a716-446655440000/permissions HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (Success - 200):
```json
{
  "success": true,
  "permissions": [
    {
      "id": "perm-123",
      "permission_key": "view_agent_work_orders",
      "is_active": true,
      "granted_at": "2026-01-15T10:00:00Z",
      "granted_by": "admin@archon.dev",
      "revoked_at": null,
      "revoked_by": null
    }
  ],
  "total": 1
}
```

---

### POST /api/admin/users/{user_id}/permissions

**Description**: Grant a permission to a user.

**Required Permission**: `manage_users` OR `role = 'admin'`

**Request**:
```http
POST /api/admin/users/550e8400-e29b-41d4-a716-446655440000/permissions HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "permission_key": "view_mcp_inspector"
}
```

**Response** (Success - 201):
```json
{
  "success": true,
  "permission": {
    "id": "perm-456",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "permission_key": "view_mcp_inspector",
    "is_active": true,
    "granted_at": "2026-01-19T15:40:00Z",
    "granted_by": "admin@archon.dev"
  },
  "message": "Permission granted successfully"
}
```

**Available Permission Keys**:
- `manage_users` - User management access
- `database_sync` - Database sync access
- `view_mcp_inspector` - MCP Inspector access
- `view_test_foundation` - Test Foundation access
- `view_agent_work_orders` - Agent Work Orders access

---

### DELETE /api/admin/users/{user_id}/permissions/{permission_key}

**Description**: Revoke a permission from a user.

**Required Permission**: `manage_users` OR `role = 'admin'`

**Request**:
```http
DELETE /api/admin/users/550e8400-e29b-41d4-a716-446655440000/permissions/view_mcp_inspector HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (Success - 200):
```json
{
  "success": true,
  "message": "Permission revoked successfully"
}
```

**RBAC Notes**:
- Performs soft delete (sets `is_active = FALSE`)
- User must logout/login to see permission changes (or refresh via `/api/auth/users/me`)
- Cannot revoke permissions from admin role users (they bypass checks)

---

## Project Access Control

### GET /api/projects

**Description**: List projects (filtered by user access).

**Required Permission**: Authenticated user

**Request**:
```http
GET /api/projects HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Query Parameters**:
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `include_content` | boolean | Include full project data | true |
| `include_archived` | boolean | Include archived projects | false |

**Response** (Admin - sees all):
```json
{
  "projects": [
    {
      "id": "proj-1",
      "title": "Project Alpha",
      "description": "...",
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "proj-2",
      "title": "Project Beta",
      "description": "...",
      "created_at": "2026-01-02T00:00:00Z"
    }
  ],
  "count": 2
}
```

**Response** (Member - filtered by access):
```json
{
  "projects": [
    {
      "id": "proj-1",
      "title": "Project Alpha",
      "description": "...",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

**RBAC Notes**:
- Admin users see ALL projects (no filtering)
- Member users see only projects in `archon_user_project_access` table
- Anonymous requests return all projects (backward compatibility)
- Use `UserAccessService.get_user_accessible_project_ids()` for filtering

---

### GET /api/admin/projects/{project_id}/members

**Description**: Get all members with access to a project.

**Required Permission**: `manage_users` OR `role = 'admin'`

**Request**:
```http
GET /api/admin/projects/proj-1/members HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (Success - 200):
```json
{
  "success": true,
  "project_id": "proj-1",
  "members": [
    {
      "user_id": "user-1",
      "email": "admin@archon.dev",
      "full_name": "Admin User",
      "access_level": "owner",
      "is_admin": true,
      "added_at": "2026-01-01T00:00:00Z"
    },
    {
      "user_id": "user-2",
      "email": "member@archon.dev",
      "full_name": "Member User",
      "access_level": "member",
      "is_admin": false,
      "added_at": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 2
}
```

---

### POST /api/admin/projects/{project_id}/members

**Description**: Add a user to a project.

**Required Permission**: `manage_users` OR `role = 'admin'`

**Request**:
```http
POST /api/admin/projects/proj-1/members HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "access_level": "member"
}
```

**Access Levels**:
- `owner` - Full access, can manage project
- `member` - Read/write access to tasks

**Response** (Success - 201):
```json
{
  "success": true,
  "message": "User added to project successfully",
  "access": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "project_id": "proj-1",
    "access_level": "member",
    "added_at": "2026-01-19T15:45:00Z",
    "added_by": "admin@archon.dev"
  }
}
```

---

### DELETE /api/admin/projects/{project_id}/members/{user_id}

**Description**: Remove a user from a project.

**Required Permission**: `manage_users` OR `role = 'admin'`

**Request**:
```http
DELETE /api/admin/projects/proj-1/members/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (Success - 200):
```json
{
  "success": true,
  "message": "User removed from project successfully"
}
```

**RBAC Notes**:
- Cannot remove admin users from projects (they have access to all)
- Soft delete: User removed from `archon_user_project_access` table
- User immediately loses access to project (no logout required)

---

## Response Formats

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "detail": "Error description"
}
```

**Or for validation errors**:

```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## Error Codes

| HTTP Status | Error Type | Description | Solution |
|-------------|------------|-------------|----------|
| 400 | Bad Request | Invalid request format or parameters | Check request body/params |
| 401 | Unauthorized | Missing or invalid JWT token | Login again, check token expiry |
| 403 | Forbidden | Insufficient permissions | Check user role and permissions |
| 404 | Not Found | Resource doesn't exist | Verify resource ID |
| 409 | Conflict | Resource already exists (e.g., duplicate permission) | Check existing data |
| 422 | Unprocessable Entity | Validation error | Fix request data validation |
| 500 | Internal Server Error | Server error | Check logs, contact support |

---

## Permission Checking Flow

### Backend Flow

```python
# 1. Extract JWT token from Authorization header
token = request.headers.get("Authorization").replace("Bearer ", "")

# 2. Verify and decode JWT
payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

# 3. Fetch user from database
user = await db.fetchrow("SELECT * FROM archon_users WHERE id = $1", user_id)

# 4. Load permissions from database
permissions = await db.fetch(
    "SELECT permission_key FROM archon_user_permissions WHERE user_id = $1 AND is_active = TRUE",
    user_id
)

# 5. Check permission
if user["role"] == "admin":
    # Admin bypasses all checks
    return True
elif required_permission in permissions:
    # User has specific permission
    return True
else:
    # Access denied
    raise HTTPException(status_code=403, detail="Permission denied")
```

### Frontend Flow

```typescript
// 1. Load user from Zustand store (persisted in localStorage)
const user = useUser();

// 2. Extract permissions
const userPermissions = user?.permissions || [];

// 3. Check permission
const hasPermission = (key: string) => userPermissions.includes(key);

// 4. Return access flag
const canManageUsers = user?.role === "admin" || hasPermission("manage_users");

// 5. Component renders based on permission
if (!canManageUsers) {
  return <AccessDenied />;
}
```

---

## Rate Limiting

**Current Status**: Not implemented

**Recommended Limits**:
- Login: 5 requests per minute per IP
- Permission check: 100 requests per minute per user
- Admin endpoints: 50 requests per minute per user

---

## Changelog

### Version 1.0.0 (2026-01-19)

**Initial Release**:
- JWT-based authentication with permissions
- User role management (admin/member)
- Granular permission system
- Project access control
- Admin-only endpoints with `require_admin` dependency

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-19
**Maintainer**: SportERP Team
