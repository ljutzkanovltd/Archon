# Archon RBAC (Role-Based Access Control) Guide

**Version**: 1.0.0
**Status**: Production Ready
**Last Updated**: 2026-01-19

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Permission System](#permission-system)
4. [User Roles](#user-roles)
5. [Permission Keys](#permission-keys)
6. [Implementation Details](#implementation-details)
7. [Usage Examples](#usage-examples)
8. [Testing](#testing)
9. [Security Considerations](#security-considerations)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Archon implements a granular Role-Based Access Control (RBAC) system that provides:

- **User Roles**: Admin vs Member classification
- **Granular Permissions**: Specific permission keys for features
- **Hybrid Checking**: Role-based + permission-based access control
- **Stateless Validation**: Permissions embedded in JWT tokens
- **Frontend Caching**: Permissions stored in localStorage

### Key Features

✅ **Database-driven**: Permissions stored in `archon_user_permissions` table
✅ **Stateless**: Permissions included in JWT for backend validation
✅ **Cached**: Frontend stores permissions in Zustand + localStorage
✅ **Backward Compatible**: Falls back to role-based checks (admin = all permissions)
✅ **Secure**: Validated on every request via `get_current_user` dependency

---

## Architecture

### System Flow

```
┌──────────────┐
│  User Login  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Backend: Load Permissions from DB    │
│ Query: archon_user_permissions table │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Create JWT with permissions array    │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Return: { access_token, user: {...}} │
│   user.permissions: ["perm1", ...]   │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Frontend: Store in Zustand + Storage │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ usePermissions Hook: Check Access    │
│ isAdmin || hasPermission('key')      │
└──────────────────────────────────────┘
```

### Database Schema

**Table: `archon_user_permissions`**

```sql
CREATE TABLE archon_user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES archon_users(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    granted_at TIMESTAMP DEFAULT NOW(),
    granted_by UUID REFERENCES archon_users(id),
    revoked_at TIMESTAMP,
    revoked_by UUID REFERENCES archon_users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, permission_key)
);

CREATE INDEX idx_user_permissions_user_id ON archon_user_permissions(user_id);
CREATE INDEX idx_user_permissions_active ON archon_user_permissions(user_id, is_active);
```

**Table: `archon_users`** (relevant fields)

```sql
ALTER TABLE archon_users ADD COLUMN role TEXT DEFAULT 'member';
-- Possible values: 'admin', 'member'
```

---

## Permission System

### Permission Checking Logic

Archon uses a **hybrid permission system**:

1. **Admin Role**: Bypass all permission checks (has all permissions)
2. **Permission Keys**: Check specific permission in `permissions` array
3. **Core Features**: Available to all authenticated users (Projects, Tasks, Knowledge Base)

**Formula**: `canAccess = isAdmin || hasPermission(permissionKey) || isCoreFeature`

### Permission Loading Flow

#### Backend (Login)

```python
# 1. Load permissions from database
permissions_query = """
    SELECT permission_key
    FROM archon_user_permissions
    WHERE user_id = $1 AND is_active = TRUE
    ORDER BY permission_key
"""
permissions_rows = await conn.fetch(permissions_query, user_id)
permissions = [row["permission_key"] for row in permissions_rows]

# 2. Include in JWT
access_token = create_access_token(
    data={
        "sub": str(user["id"]),
        "email": user["email"],
        "permissions": permissions,  # Stateless validation
    }
)

# 3. Return in response
return {
    "access_token": access_token,
    "user": {
        "permissions": permissions,  # Frontend caching
    }
}
```

#### Backend (Authentication)

```python
# Every authenticated request loads permissions
async def get_current_user(token: str):
    # ... validate token, fetch user ...

    # Load permissions
    permissions_query = """
        SELECT permission_key
        FROM archon_user_permissions
        WHERE user_id = $1 AND is_active = TRUE
        ORDER BY permission_key
    """
    permissions_rows = await conn.fetch(permissions_query, user_id)
    user["permissions"] = [row["permission_key"] for row in permissions_rows]

    return user
```

#### Frontend (Zustand Store)

```typescript
// User interface includes permissions
interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  permissions?: string[];  // RBAC Phase 4
}

// Login handler extracts permissions
const user: User = {
  // ... other fields ...
  permissions: data.user.permissions || [],
};
```

#### Frontend (Permission Hook)

```typescript
export function usePermissions(): Permissions {
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const userPermissions = user?.permissions || [];
  const hasPermission = (permission: string) =>
    userPermissions.includes(permission);

  return {
    // Admin features: admin role OR specific permission
    canManageUsers: isAdmin || hasPermission('manage_users'),
    canAccessDatabaseSync: isAdmin || hasPermission('database_sync'),

    // Core features: all authenticated users
    canViewProjects: !!user,
    canViewTasks: !!user,
  };
}
```

---

## User Roles

### Admin Role

**Characteristics**:
- `role = 'admin'` in `archon_users` table
- Has access to ALL features (bypasses permission checks)
- Can manage users, permissions, system settings
- Can access admin-only pages: `/users`, `/mcp-inspector`, `/test-foundation`

**Default Admin**: `admin@archon.dev`

### Member Role

**Characteristics**:
- `role = 'member'` in `archon_users` table (default)
- Requires specific permissions in `archon_user_permissions` table
- Has access to core features by default (Projects, Tasks, Knowledge Base)
- Can be granted additional permissions individually

**Default Access**:
- ✅ Dashboard
- ✅ Projects
- ✅ Tasks
- ✅ Knowledge Base
- ✅ Settings (own profile)
- ❌ Users (unless `manage_users` permission)
- ❌ MCP Inspector (unless `view_mcp_inspector` permission)
- ❌ Database Sync (unless `database_sync` permission)

---

## Permission Keys

### Available Permissions

| Permission Key | Description | Default Role |
|----------------|-------------|--------------|
| `manage_users` | Can view and edit users, invite new users, assign permissions | Admin |
| `database_sync` | Can access Database Sync feature in Settings | Admin |
| `view_mcp_inspector` | Can access MCP Inspector page for debugging | Admin |
| `view_test_foundation` | Can access Test Foundation page for testing | Admin |
| `view_agent_work_orders` | Can view and manage Agent Work Orders | Admin |

### Core Features (No Permission Required)

These features are available to **all authenticated users**:

- Dashboard (`/`)
- Projects (`/projects`)
- Tasks (`/tasks`)
- Knowledge Base (`/knowledge-base`)
- Settings (own profile) (`/settings`)

### Permission Naming Convention

- **Verb + Noun**: `view_`, `manage_`, `edit_`, `delete_`
- **Snake Case**: `view_mcp_inspector`, `manage_users`
- **Descriptive**: Clear what the permission grants access to

---

## Implementation Details

### Backend Implementation

#### 1. Login Endpoint (`auth_api.py`)

```python
@router.post("/api/auth/login")
async def login(form_data: OAuth2PasswordRequestForm):
    # ... authenticate user ...

    # Load permissions
    permissions_query = """
        SELECT permission_key
        FROM archon_user_permissions
        WHERE user_id = $1 AND is_active = TRUE
        ORDER BY permission_key
    """
    permissions_rows = await conn.fetch(permissions_query, user["id"])
    permissions = [row["permission_key"] for row in permissions_rows]

    # Create JWT with permissions
    access_token = create_access_token(
        data={
            "sub": str(user["id"]),
            "email": user["email"],
            "permissions": permissions,
        }
    )

    return {
        "access_token": access_token,
        "user": {
            "permissions": permissions,
        }
    }
```

#### 2. Authentication Dependency (`dependencies.py`)

```python
async def get_current_user(token: str):
    # ... verify token, fetch user ...

    # Load permissions on every request
    permissions_query = """
        SELECT permission_key
        FROM archon_user_permissions
        WHERE user_id = $1 AND is_active = TRUE
        ORDER BY permission_key
    """
    permissions_rows = await conn.fetch(permissions_query, user_id)
    user["permissions"] = [row["permission_key"] for row in permissions_rows]

    return user
```

#### 3. Admin-Only Dependency

```python
async def require_admin(current_user: dict = Depends(get_current_user)):
    # Check if user has 'manage_users' permission
    conn = await get_direct_db_connection()
    try:
        query = """
            SELECT user_has_permission($1::uuid, 'manage_users')
        """
        has_permission = await conn.fetchval(query, user_id)

        if not has_permission:
            raise HTTPException(status_code=403, detail="Admin access required")

        return current_user
    finally:
        await conn.close()
```

### Frontend Implementation

#### 1. User Interface (`useAuthStore.ts`)

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  permissions?: string[];  // RBAC Phase 4
}
```

#### 2. Login Handler

```typescript
const data = await response.json();

const user: User = {
  id: data.user.id,
  email: data.user.email,
  name: data.user.full_name,
  role: data.user.role || "member",
  permissions: data.user.permissions || [],  // Extract from backend
};
```

#### 3. Permission Hook (`usePermissions.ts`)

```typescript
export function usePermissions(): Permissions {
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const userPermissions = user?.permissions || [];

  const hasPermission = (permission: string) =>
    userPermissions.includes(permission);

  return {
    canManageUsers: isAdmin || hasPermission('manage_users'),
    canAccessDatabaseSync: isAdmin || hasPermission('database_sync'),
    canViewMCPInspector: isAdmin || hasPermission('view_mcp_inspector'),
    // ... more permissions ...
  };
}
```

#### 4. Usage in Components

```typescript
import { usePermissions } from "@/hooks/usePermissions";

export function AdminOnlyFeature() {
  const { canManageUsers } = usePermissions();

  if (!canManageUsers) {
    return <div>Access Denied</div>;
  }

  return <div>Admin Content</div>;
}
```

---

## Usage Examples

### Grant Permission to User

```sql
-- Grant 'view_agent_work_orders' to user
INSERT INTO archon_user_permissions (user_id, permission_key, is_active, granted_by)
VALUES (
  (SELECT id FROM archon_users WHERE email = 'user@example.com'),
  'view_agent_work_orders',
  TRUE,
  (SELECT id FROM archon_users WHERE email = 'admin@archon.dev')
);
```

### Revoke Permission from User

```sql
-- Soft delete: Mark permission as inactive
UPDATE archon_user_permissions
SET is_active = FALSE, revoked_at = NOW(), revoked_by = (SELECT id FROM archon_users WHERE email = 'admin@archon.dev')
WHERE user_id = (SELECT id FROM archon_users WHERE email = 'user@example.com')
  AND permission_key = 'view_agent_work_orders';

-- Hard delete: Remove permission entirely
DELETE FROM archon_user_permissions
WHERE user_id = (SELECT id FROM archon_users WHERE email = 'user@example.com')
  AND permission_key = 'view_agent_work_orders';
```

### Check User Permissions

```sql
-- Get all active permissions for a user
SELECT permission_key
FROM archon_user_permissions
WHERE user_id = (SELECT id FROM archon_users WHERE email = 'user@example.com')
  AND is_active = TRUE
ORDER BY permission_key;
```

### Create Test User with Permissions

```bash
# See /tmp/create-test-users.sh for complete script
./create-test-users.sh
```

---

## Testing

### Manual Testing

#### 1. Create Test Users

```bash
cd /tmp
chmod +x create-test-users.sh
./create-test-users.sh
```

Creates:
- `testadmin@archon.dev` - Admin role
- `testmember@archon.dev` - Member + `view_agent_work_orders`
- `testviewer@archon.dev` - Member (no extra permissions)
- `testmanager@archon.dev` - Member + 3 permissions

All users have password: `TestUser123!`

#### 2. Run Automated Tests

```bash
cd /tmp
chmod +x test-rbac-permissions.sh
./test-rbac-permissions.sh
```

Tests 19 scenarios:
- User login & token validation
- Permission loading
- API endpoint access control
- Core feature access
- Project filtering
- Token security

#### 3. Frontend Testing

1. Login as `testadmin@archon.dev`
   - Verify all sidebar items visible
   - Can access `/users` page
   - Can access MCP Inspector

2. Login as `testviewer@archon.dev`
   - Verify limited sidebar items
   - Cannot access `/users` (403 shown)
   - Cannot access admin-only pages by direct URL

### Unit Tests

```bash
cd /home/ljutzkanov/Documents/Projects/archon/python
pytest tests/test_rbac_permissions.py -v
```

Tests:
- Permission loading on login
- Admin vs member access control
- Token validation and expiry
- Permission inheritance

### Integration Tests

```bash
# Run full integration test suite (TODO: create)
pytest tests/integration/test_rbac_integration.py -v
```

---

## Security Considerations

### ✅ Implemented

1. **Stateless Validation**: Permissions in JWT for backend validation
2. **Database Validation**: Permissions loaded from DB on every request
3. **Inactive Account Check**: `is_active = FALSE` users rejected (403)
4. **Token Expiry**: JWT tokens expire after configured time
5. **Permission Filtering**: Only `is_active = TRUE` permissions loaded

### 🔒 Recommended Next Steps

1. **Permission Refresh**: Implement mechanism to refresh permissions without re-login
2. **Audit Logging**: Track permission changes in `archon_user_permissions_history` table
3. **Permission Expiry**: Add `expires_at` field for temporary permissions
4. **Revocation Check**: Invalidate JWT when critical permissions change
5. **Rate Limiting**: Limit permission check queries to prevent DoS

### ⚠️ Security Warnings

- **Never expose `archon_user_permissions` table to public API**
- **Always validate permissions on backend** (don't trust frontend)
- **Use HTTPS in production** to protect JWT tokens
- **Rotate SECRET_KEY regularly** for JWT signing
- **Log permission changes** for audit trail

---

## Troubleshooting

### User has permission but still denied access

**Symptoms**: User has permission in database but frontend denies access

**Causes**:
1. User hasn't logged out and back in (permissions cached)
2. Permission marked as `is_active = FALSE`
3. Frontend `usePermissions` hook not checking correct permission key

**Solutions**:
```bash
# 1. Check database permissions
docker exec supabase-ai-db psql -U postgres -d postgres -c "
SELECT permission_key, is_active
FROM archon_user_permissions
WHERE user_id = (SELECT id FROM archon_users WHERE email = 'user@example.com');
"

# 2. Check user role
docker exec supabase-ai-db psql -U postgres -d postgres -c "
SELECT email, role FROM archon_users WHERE email = 'user@example.com';
"

# 3. Ask user to logout and login again
# 4. Check browser localStorage: localStorage.getItem('archon-auth-storage')
```

### Admin user denied access to admin features

**Symptoms**: Admin user cannot access `/users` or other admin pages

**Causes**:
1. `role` field not set to `'admin'` in database
2. `require_admin` dependency not using correct permission check

**Solutions**:
```bash
# Set user role to admin
docker exec supabase-ai-db psql -U postgres -d postgres -c "
UPDATE archon_users SET role = 'admin' WHERE email = 'admin@archon.dev';
"

# Grant manage_users permission
docker exec supabase-ai-db psql -U postgres -d postgres -c "
INSERT INTO archon_user_permissions (user_id, permission_key, is_active)
SELECT id, 'manage_users', TRUE
FROM archon_users WHERE email = 'admin@archon.dev'
ON CONFLICT (user_id, permission_key) DO UPDATE SET is_active = TRUE;
"
```

### Permissions not loading on login

**Symptoms**: Login response doesn't include `permissions` array

**Causes**:
1. Backend not loading permissions from database
2. Database query failing silently
3. `archon_user_permissions` table doesn't exist

**Solutions**:
```bash
# 1. Check backend logs
docker logs archon-server | grep -i permission

# 2. Verify table exists
docker exec supabase-ai-db psql -U postgres -d postgres -c "\dt archon_user_permissions"

# 3. Test login response
curl -X POST http://localhost:8181/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@archon.dev&password=YourPassword" | jq .user.permissions
```

---

## Appendix

### Database Functions

#### `user_has_permission(user_id UUID, permission_key TEXT)`

```sql
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_permission_key TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM archon_user_permissions
        WHERE user_id = p_user_id
          AND permission_key = p_permission_key
          AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE;
```

### Migration Script

```sql
-- RBAC Phase 4 & 5: Add role field and user_permissions table

-- 1. Add role field to users table
ALTER TABLE archon_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';

-- 2. Create user_permissions table
CREATE TABLE IF NOT EXISTS archon_user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES archon_users(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    granted_at TIMESTAMP DEFAULT NOW(),
    granted_by UUID REFERENCES archon_users(id),
    revoked_at TIMESTAMP,
    revoked_by UUID REFERENCES archon_users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, permission_key)
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON archon_user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_active ON archon_user_permissions(user_id, is_active);

-- 4. Create helper function
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM archon_user_permissions
        WHERE user_id = p_user_id AND permission_key = p_permission_key AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Set existing admin users
UPDATE archon_users SET role = 'admin'
WHERE email IN ('admin@archon.dev', 'ljutzkanov@sporterp.co.uk');
```

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-19
**Maintainer**: SportERP Team
**Feedback**: Create GitHub issue or contact team
