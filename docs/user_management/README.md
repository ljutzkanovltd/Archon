# Archon User Management System - Database Design

**Database Expert Agent** | **Research & Schema Design Complete**

**Date**: 2026-01-13
**Status**: ✅ **Ready for Implementation**

---

## 📋 Executive Summary

This directory contains the complete database schema design for Archon's User Management System, informed by in-depth analysis of SportERP's authentication and user management architecture.

**Key Deliverables**:
1. ✅ SportERP architecture analysis (41 pages)
2. ✅ Complete PostgreSQL schema (640 lines SQL)
3. ✅ Detailed comparison table (SportERP vs Archon)
4. ✅ Migration-ready SQL script
5. ✅ Row Level Security (RLS) policies

---

## 📁 Files in This Directory

### 1. `sporterp_analysis.md` (41 pages)
**Comprehensive research document covering**:
- SportERP's database structure (res.users, res.partner, organisation.organisation, organisation.user)
- JWT authentication patterns (9 token fields, public/private scopes)
- Google OAuth integration flow
- Multi-tenant organization structure (3-level tenancy)
- Role-based access control (subscription codes, privilege groups)
- Key takeaways for Archon (what to adopt, simplify, add)

**Key Findings**:
- SportERP uses **dual identity system** (res.users + res.partner)
- **Complex role system** via subscription codes (simplified to owner/admin/member in Archon)
- **No explicit invitation system** (uses subscription codes, Archon adds archon_invitations table)
- **Application-level multi-tenancy** (Archon uses database RLS instead)

### 2. `archon_user_management_schema.sql` (640 lines)
**Complete PostgreSQL schema including**:
- **5 core tables**: users, user_profiles, organizations, organization_members, invitations
- **3 ENUMs**: organization_member_role, invitation_status, oauth_provider
- **20+ indexes**: Composite and partial indexes for performance
- **6 triggers**: Auto-update updated_at, auto-create profiles, expire invitations
- **15+ RLS policies**: Database-enforced multi-tenancy security
- **Sample data**: Test users, organizations, memberships, invitations

**Schema Overview**:
```
archon_users (core identity)
    ↓ 1:1
archon_user_profiles (extended profile)

archon_organizations (tenants)
    ↓ M:N (via archon_organization_members)
archon_users (users)

archon_invitations (token-based invitations)
    ↓ references
archon_organizations + archon_users
```

### 3. `sporterp_vs_archon_comparison.md` (28 pages)
**Detailed comparison covering**:
- High-level design decisions (14 wins for Archon, 0 for SportERP, 2 ties)
- Table-by-table analysis (users, profiles, organizations, memberships, invitations)
- Index strategy comparison (SportERP automatic vs Archon hand-optimized)
- RLS policy comparison (application logic vs database enforcement)
- Migration readiness checklist

**Key Metrics**:
- **Security**: Archon wins (UUID PKs, database RLS, email verification, account lockout)
- **Performance**: Archon wins (single user table, composite indexes, partial indexes)
- **Simplicity**: Archon wins (2-level tenancy vs 3-level, simple roles vs complex)
- **Maintainability**: Archon wins (typed columns, CHECK constraints, audit trail)

### 4. `README.md` (this file)
**Navigation and quick reference**

---

## 🎯 Design Highlights

### What We Adopted from SportERP

✅ **JWT-based authentication** with rich payload (sub, organisation_id, user_id, org_user_id)
✅ **OAuth integration pattern** (store provider + provider_user_id)
✅ **Multi-tenant organization structure** (organizations own users)
✅ **Role-based access** (simplified to owner/admin/member)
✅ **Soft deletes** via is_active/deleted_at fields
✅ **Write timestamps** for optimistic locking

### What We Simplified vs SportERP

🔧 **Removed 3-level tenancy** (Company → Org → User) → **2-level** (Org → User)
🔧 **Removed subscription codes** (complex) → **Simple ENUM roles** (owner/admin/member)
🔧 **Removed service components** (ERP-specific) → Not needed for Archon
🔧 **Removed Odoo ORM patterns** → Native PostgreSQL features
🔧 **Simplified JWT payload** (9 fields → 5 fields)
🔧 **Simplified profile** (30+ fields → 10 essential fields)

### What We Added (Missing in SportERP)

➕ **Explicit invitations table** (archon_invitations with secure tokens)
➕ **Email verification** (is_verified field + verification flow)
➕ **Multiple OAuth providers** (Google, GitHub, GitLab, Microsoft)
➕ **Password reset tokens** (time-limited, single-use)
➕ **User preferences** (theme, language, timezone, notifications)
➕ **Account lockout** (failed_login_attempts, locked_until)
➕ **Database RLS** (multi-tenancy enforced at database level)

---

## 📊 Schema Statistics

| Metric | Count | Notes |
|--------|-------|-------|
| **Tables** | 5 | users, profiles, orgs, members, invitations |
| **ENUMs** | 3 | roles, invitation_status, oauth_provider |
| **Indexes** | 22 | Composite + partial indexes |
| **Triggers** | 6 | Auto-update timestamps, auto-create profiles |
| **RLS Policies** | 16 | Multi-tenancy security |
| **Foreign Keys** | 10 | With CASCADE/SET NULL |
| **CHECK Constraints** | 18 | Email format, slug format, etc. |
| **Lines of SQL** | 640 | Complete schema + sample data |

---

## 🗄️ Table Details

### archon_users (Core Identity)
- **Purpose**: User authentication (password OR OAuth)
- **Primary Key**: UUID (prevents enumeration)
- **Unique Constraints**: email (globally unique)
- **Key Features**:
  - Password OR OAuth authentication
  - Email verification (is_verified)
  - Account lockout (failed_login_attempts, locked_until)
  - Last login tracking (last_login_at, last_login_ip)
  - OAuth provider support (google, github, gitlab, microsoft)
  - Soft delete (deleted_at)

### archon_user_profiles (Extended Profile)
- **Purpose**: User profile data and preferences
- **Relationship**: 1:1 with archon_users (auto-created)
- **Key Features**:
  - Contact info (phone_number)
  - Profile fields (bio, job_title, website, location)
  - User preferences (timezone, language, theme)
  - Notification preferences (email, desktop)

### archon_organizations (Tenants)
- **Purpose**: Multi-tenant organization structure
- **Primary Key**: UUID
- **Unique Constraints**: slug (URL-friendly, e.g., "acme-corp")
- **Key Features**:
  - Owner (owner_id, required, cannot be deleted)
  - Branding (logo_url, primary_color, secondary_color)
  - Member limit (max_members, for free/paid tiers)
  - Soft delete (deleted_at)

### archon_organization_members (M:N Bridge)
- **Purpose**: User-Organization membership with roles
- **Relationship**: M:N (users ↔ organizations)
- **Key Features**:
  - Role (owner/admin/member ENUM)
  - Invitation tracking (invited_by, invited_at, joined_at)
  - Active status (is_active, can deactivate without deleting)
  - Unique constraint (organization_id, user_id)

### archon_invitations (Invitation System)
- **Purpose**: Token-based invitation workflow
- **Key Features**:
  - Secure token (64-char SHA256 hex)
  - Expiration (expires_at, typically 7 days)
  - Status tracking (pending/accepted/expired/revoked)
  - Acceptance audit (accepted_at, accepted_by)
  - Revocation support (revoked_at, revoked_by, reason)
  - Duplicate prevention (UNIQUE INDEX on org+email+pending)

---

## 🚀 Quick Start

### 1. Create Schema
```bash
cd /home/ljutzkanov/Documents/Projects/archon
psql -U postgres -d postgres < docs/user_management/archon_user_management_schema.sql
```

### 2. Verify Creation
```sql
-- Count tables (expected: 5)
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'archon_%';

-- Count indexes (expected: 22+)
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname = 'public' AND tablename LIKE 'archon_%';

-- Count RLS policies (expected: 16+)
SELECT COUNT(*) FROM pg_policies
WHERE schemaname = 'public' AND tablename LIKE 'archon_%';
```

### 3. Test RLS Policies
```sql
-- Simulate authenticated user
SET app.current_user_id = '550e8400-e29b-41d4-a716-446655440001';

-- Test: User can read own data
SELECT * FROM archon_users WHERE id = current_setting('app.current_user_id')::UUID;
-- Should return 1 row

-- Test: User cannot read other users
SELECT * FROM archon_users WHERE id != current_setting('app.current_user_id')::UUID;
-- Should return 0 rows (RLS blocks)
```

### 4. Sample Data
Schema includes sample data:
- **Users**: Alice (password), Bob (Google OAuth)
- **Organization**: Acme Corp (Alice = owner)
- **Members**: Alice (owner), Bob (member)
- **Invitation**: Charlie invited to Acme Corp

---

## 📈 Performance Characteristics

### Index Strategy

**Composite Indexes** (for common query patterns):
```sql
-- Fast: "Is user member of org?"
CREATE INDEX idx_members_org_user
ON archon_organization_members(organization_id, user_id);

-- Fast: "Get all admins of org"
CREATE INDEX idx_members_role
ON archon_organization_members(organization_id, role);
```

**Partial Indexes** (for active records only):
```sql
-- Fast: "List active users"
CREATE INDEX idx_users_active
ON archon_users(is_active)
WHERE is_active = TRUE AND deleted_at IS NULL;

-- Fast: "List pending invitations"
CREATE INDEX idx_invitations_token
ON archon_invitations(token)
WHERE status = 'pending';
```

**Expected Performance**:
- User lookup: **< 1ms** (indexed email/UUID)
- Org membership check: **< 1ms** (composite index)
- List org members: **< 5ms** (composite index)
- Invitation acceptance: **< 2ms** (partial index on token)

---

## 🔒 Security Features

### Row Level Security (RLS)

**Multi-Tenancy Enforcement**:
- Users can only read organizations they're members of
- Only owners can update/delete organizations
- Owners/admins can manage members
- Invited users can read their invitations (by token)

**Cannot Be Bypassed**:
- Database enforces policies (vs application logic)
- SQL injection doesn't help attackers
- Works across all clients (API, CLI, psql)

### Account Security

✅ **Email Verification** (is_verified, email_verified_at)
✅ **Account Lockout** (failed_login_attempts, locked_until)
✅ **Last Login Tracking** (last_login_at, last_login_ip)
✅ **2FA Support** (is_2fa_enabled, totp_secret)
✅ **Password Change Tracking** (password_changed_at)

### Invitation Security

✅ **Token-Based** (64-char SHA256 hex, impossible to guess)
✅ **Time-Limited** (expires_at, typically 7 days)
✅ **Single-Use** (status changes to 'accepted' after use)
✅ **Revocable** (status can be 'revoked' by admin)

---

## 🏗️ Next Steps

### Immediate (Database Setup)
1. ✅ **Schema Created** (archon_user_management_schema.sql)
2. ⏭️ **Deploy to Supabase** (test environment)
3. ⏭️ **Create Alembic Migration** (for production)

### Backend Implementation
4. ⏭️ **Pydantic Models** (UserCreate, UserResponse, OrgCreate, etc.)
5. ⏭️ **SQLAlchemy ORM Models** (match schema)
6. ⏭️ **FastAPI Endpoints** (CRUD operations)
7. ⏭️ **Authentication Service** (JWT, OAuth, password hashing)
8. ⏭️ **Email Service** (verification, invitations, password reset)

### Testing
9. ⏭️ **Unit Tests** (pytest, 80%+ coverage)
10. ⏭️ **Integration Tests** (test RLS policies)
11. ⏭️ **Load Tests** (1000+ concurrent users)

### Documentation
12. ⏭️ **API Documentation** (OpenAPI/Swagger)
13. ⏭️ **User Guide** (for frontend developers)

---

## 📚 References

### SportERP Source Files Analyzed
- JWT: `/api.sporterp.co.uk/src/app/v1/middleware/jwt_token.py`
- Auth: `/api.sporterp.co.uk/src/app/v1/middleware/authentication.py`
- User Models: `/api.sporterp.co.uk/src/app/v1/api/user/model/user_profile.py`
- Org Models: `/web.sporterp.co.uk/extra_addons/sporterp/organisation/models/organisation.py`
- Org User: `/web.sporterp.co.uk/extra_addons/sporterp/organisation/models/org_user.py`
- Partner: `/web.sporterp.co.uk/extra_addons/sporterp/organisation/models/res_partner.py`

### Archon Documentation
- Main PRP: `/archon/PRPs/user_management_system.md`
- Schema: `/archon/docs/user_management/archon_user_management_schema.sql`
- Analysis: `/archon/docs/user_management/sporterp_analysis.md`
- Comparison: `/archon/docs/user_management/sporterp_vs_archon_comparison.md`

### External Resources
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Supabase Auth: https://supabase.com/docs/guides/auth
- FastAPI Auth: https://fastapi.tiangolo.com/tutorial/security/
- JWT Best Practices: https://tools.ietf.org/html/rfc8725

---

## 🤝 Credits

**Database Expert Agent** - Research & Schema Design
**Project**: Archon User Management System
**Date**: 2026-01-13
**Status**: ✅ Ready for Implementation

---

**End of README**
