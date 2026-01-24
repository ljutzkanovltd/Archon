# Test User Credentials

**Created:** 2026-01-24
**Purpose:** RBAC Phase 5 Testing & Validation
**Status:** ✅ Active

---

## Test Accounts

### 1. Admin Account
- **Email:** `testadmin@archon.dev`
- **Password:** `Admin123!`
- **Role:** `admin`
- **Permissions:** Full system access
- **Use Case:** Test admin-only features (user management, settings, all pages)

### 2. Member Account
- **Email:** `testmember@archon.dev`
- **Password:** `Member123!`
- **Role:** `member`
- **Permissions:** Standard user access
- **Use Case:** Test member restrictions (no /users page, limited settings)

### 3. Viewer Account
- **Email:** `testviewer@archon.dev`
- **Password:** `Viewer123!`
- **Role:** `viewer`
- **Permissions:** Read-only access
- **Use Case:** Test viewer restrictions (read-only, no edits)

---

## Expected Access Matrix

| Feature/Page | Admin | Member | Viewer |
|--------------|-------|--------|--------|
| Dashboard | ✅ | ✅ | ✅ |
| Projects | ✅ | ✅ | ✅ (read-only) |
| Tasks | ✅ | ✅ | ✅ (read-only) |
| Agent Work Orders | ✅ | ✅ | ❌ |
| Knowledge Base | ✅ | ✅ | ✅ (read-only) |
| MCP Inspector | ✅ | ❌ | ❌ |
| MCP Server | ✅ | ❌ | ❌ |
| Users Management | ✅ | ❌ | ❌ |
| Settings | ✅ (full) | ✅ (profile only) | ✅ (profile only) |
| Database Sync | ✅ | ❌ | ❌ |

---

## Testing Checklist

### Admin Testing (`testadmin@archon.dev`)
- [ ] Can login successfully
- [ ] All 11 pages visible in sidebar
- [ ] Can access /users page
- [ ] Can invite new users
- [ ] Can edit user roles
- [ ] Can edit user permissions
- [ ] Can activate/deactivate users
- [ ] Database Sync accessible in Settings

### Member Testing (`testmember@archon.dev`)
- [ ] Can login successfully
- [ ] Only permitted pages visible in sidebar
- [ ] Cannot access /users page (403 Forbidden)
- [ ] Cannot access admin pages by direct URL
- [ ] Cannot see Database Sync in settings
- [ ] Can edit own profile
- [ ] Can view assigned tasks

### Viewer Testing (`testviewer@archon.dev`)
- [ ] Can login successfully
- [ ] Read-only access to content
- [ ] Cannot create/edit/delete items
- [ ] Cannot access admin features
- [ ] Can view dashboards and reports

---

## Security Notes

- All passwords use bcrypt with cost factor 12
- Account lockout after 5 failed attempts (30-minute lock)
- Failed attempt counters reset on successful login
- All accounts start with `is_active=true`, `is_verified=true`

---

## Maintenance

**Reset Failed Attempts:**
```sql
UPDATE archon_users
SET failed_login_attempts = 0, locked_until = NULL
WHERE email LIKE 'test%@archon.dev';
```

**Reset Passwords:**
```bash
# Use backend container to generate hashes
docker exec archon-server python3 -c "
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
print(pwd_context.hash('NewPassword123!'))
"
```

---

**Last Updated:** 2026-01-24
**Maintained By:** testing-expert agent
