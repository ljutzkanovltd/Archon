# Archon User Management System v1 - Implementation Plan

**Project ID**: `76c28d89-ed2b-436f-b3a1-e09426074c58`
**Status**: In Planning
**Timeline**: 13-15 weeks (200-250 hours)
**Last Updated**: 2026-01-12

---

## Executive Summary

Complete user management system for Archon aligned with SportERP authentication patterns. Implements JWT-based auth, multi-tenant organizations, magic link invitations, and RBAC.

**Decisions Applied**:
- ✅ Separate user bases (no SportERP SSO in v1)
- ✅ Email/password authentication only (Google OAuth deferred to v2)
- ✅ No 2FA in v1 (deferred to v2)
- ✅ Magic link invitations (modern, simple UX)

**Key Alignments with SportERP**:
- JWT authentication architecture (dual-token system)
- Token storage strategy (encrypted cookies + localStorage)
- Organization/member hierarchy patterns
- UI components reusability: 85-95%
- Security patterns (rate limiting, RLS policies)

**Key Simplifications**:
- Flat organization structure (no nested companies)
- 4 predefined roles (Owner, Admin, Member, Viewer)
- Single-step registration (no multi-step wizard)
- No subscription/billing logic

---

## Stage 1: Foundation & Database Schema (Weeks 1-3, 30-40 hours)

**Status**: ✅ Tasks Created (9 tasks)

### Phase 1.1: Database Schema Design (Week 1, 12 hours)

**Task 1**: Design Core User Tables (6h) - `database-expert`
- Create `archon_users` table (id, email, hashed_password, full_name, is_active, created_at, updated_at)
- Create `archon_user_profiles` table (user_id FK, avatar_url, phone, timezone, theme_preference)
- Align with SportERP contact detail structure
- Create SQL migration script

**Task 2**: Design Organization Tables (4h) - `database-expert`
- Create `archon_organizations` table (id, name, slug, owner_id FK, created_at)
- Create `archon_organization_members` table (org_id FK, user_id FK, role ENUM, joined_at)
- Implement role enum: Owner, Admin, Member, Viewer
- Flat hierarchy (no nested companies)
- Add unique constraint on (org_id, user_id)

**Task 3**: Design Invitation System (2h) - `database-expert`
- Create `archon_invitations` table (id, org_id FK, email, role, token UUID, invited_by FK, expires_at, accepted_at, created_at)
- Magic link tokens, 7-day expiration
- Add unique constraint on (org_id, email, accepted_at IS NULL)

### Phase 1.2: Indexes, Constraints & RLS Policies (Week 1-2, 10 hours)

**Task 4**: Add Database Indexes & Constraints (2h) - `database-expert`
- Add indexes on email, user_id, org_id foreign keys
- Add unique constraints (email in users, slug in organizations)
- Add check constraints (email format, role values)

**Task 5**: Implement Row Level Security (RLS) Policies (6h) - `database-expert`
- Enable RLS on all tables
- Policy: Users can read/update own profile
- Policy: Org members can read org data
- Policy: Owners/Admins can manage members
- Test policies with different user roles

**Task 6**: Create Database Migration Script (2h) - `database-expert`
- Alembic or SQL migration file
- Test migration on dev Supabase database
- Document rollback procedure
- Seed test data (1 owner, 1 org, 2 members)

### Phase 1.3: Backend Models & JWT Setup (Week 2-3, 12 hours)

**Task 7**: Create SQLAlchemy/Pydantic Models (6h) - `backend-api-expert`
- Define User, UserProfile, Organization, OrganizationMember, Invitation models
- Add password hashing utilities (bcrypt cost factor 12)
- Add email validation (regex + DNS MX lookup)
- Create Pydantic schemas for API validation

**Task 8**: Implement JWT Token Utilities (5h) - `backend-api-expert`
- Token structure: `{sub: user_id, email, org_id, role, environment, public: false, scope: PRIVATE, exp, iat}`
- HS256 algorithm, 8-hour expiration (internal tool)
- Align with SportERP JWT structure
- Token validation with expiry check

**Task 9**: Create JWT Validation Middleware (1h) - `backend-api-expert`
- FastAPI dependency `get_current_user`
- HTTPBearer security
- Extract user_id from token, fetch user from database
- Handle token expiration and invalid token errors

---

## Stage 2: Core Authentication (Weeks 4-6, 30-40 hours)

**Status**: ⏳ Pending Task Creation (10 tasks)

### Phase 2.1: Login & Logout Endpoints (Week 4, 12 hours)

**Task 10**: Create POST /auth/login Endpoint (6h) - `backend-api-expert`
- Request: `{email, password}` (client-side encrypted)
- Decrypt password, verify bcrypt hash
- Generate JWT token
- Return: `{user, token, organization}`

**Task 11**: Create POST /auth/logout Endpoint (2h) - `backend-api-expert`
- Token blacklist (optional)
- Clear cookies
- Return success response

**Task 12**: Add Client-Side Password Encryption (2h) - `ui-implementation-expert`
- CryptoJS AES encryption (match SportERP)
- Encryption key from environment

**Task 13**: Add Rate Limiting (2h) - `backend-api-expert`
- Use `slowapi` library
- 5 login attempts per 15 minutes per IP

### Phase 2.2: Registration Flow (Week 5, 10 hours)

**Task 14**: Create POST /auth/register Endpoint (6h) - `backend-api-expert`
- Request: `{email, password, full_name}`
- Validate email not already registered
- Hash password (bcrypt)
- Create user + default organization (auto-named "{User}'s Workspace")
- Assign user as Owner role
- Generate JWT token
- Return: `{user, token, organization}`

**Task 15**: Add Email Validation (2h) - `backend-api-expert`
- Email format (regex)
- DNS MX records (verify domain exists)
- Block disposable email domains

**Task 16**: Add Password Strength Validation (2h) - `backend-api-expert`
- Minimum 8 characters
- At least 1 uppercase, 1 lowercase, 1 number, 1 special character
- Use `zxcvbn` for password strength scoring

### Phase 2.3: Password Reset Flow (Week 5-6, 10 hours)

**Task 17**: Create POST /auth/forgot-password Endpoint (4h) - `backend-api-expert`
- Generate password reset token (UUID, 1-hour expiration)
- Store in `password_reset_tokens` table
- Send email with reset link
- Return generic success message

**Task 18**: Create POST /auth/reset-password Endpoint (4h) - `backend-api-expert`
- Validate token (exists, not expired, not used)
- Decrypt and hash new password
- Update user's password
- Mark token as used
- Send confirmation email

**Task 19**: Setup Email Service (2h) - `backend-api-expert`
- Use Resend or SendGrid API
- Create email templates (welcome, password reset, invitation)

---

## Stage 3: Multi-Tenant Organizations (Weeks 7-9, 35-45 hours)

**Status**: ⏳ Pending Task Creation (10 tasks)

### Phase 3.1: Organization CRUD (Week 7, 14 hours)

**Task 20**: Create POST /organizations Endpoint (4h)
**Task 21**: Create GET /organizations/{org_id} Endpoint (2h)
**Task 22**: Create PUT /organizations/{org_id} Endpoint (4h)
**Task 23**: Create GET /organizations/{org_id}/members Endpoint (4h)

### Phase 3.2: Magic Link Invitation System (Week 8, 14 hours)

**Task 24**: Create POST /organizations/{org_id}/invitations Endpoint (6h)
**Task 25**: Create GET /invitations/{token} Endpoint (2h)
**Task 26**: Create POST /invitations/{token}/accept Endpoint (6h)

### Phase 3.3: Member & Role Management (Week 9, 10 hours)

**Task 27**: Create PUT /organizations/{org_id}/members/{user_id}/role Endpoint (4h)
**Task 28**: Create DELETE /organizations/{org_id}/members/{user_id} Endpoint (4h)
**Task 29**: Create Permission Checking Utilities (2h)

---

## Stage 4: User Management UI (Weeks 10-13, 70-80 hours)

**Status**: ⏳ Pending Task Creation (14 tasks)

### Phase 4.1: Login & Registration Pages (Week 10, 14 hours)

**Task 30**: Create Login Page Component (8h) - `ui-implementation-expert`
- Email/password form with Yup validation
- "Forgot password" and "Sign up" links
- Error handling with toast notifications
- **Reuse**: 95% from SportERP's SignInForm.tsx

**Task 31**: Create Registration Page Component (6h) - `ui-implementation-expert`
- Single-step form (email, password, full name, confirm password)
- Auto-login after registration
- Redirect to onboarding wizard

### Phase 4.2: Password Reset & Invitation Pages (Week 10-11, 10 hours)

**Task 32**: Create Forgot Password Page (3h)
**Task 33**: Create Reset Password Page (3h)
**Task 34**: Create Accept Invitation Page (4h)

### Phase 4.3: User Profile & Settings (Week 11-12, 16 hours)

**Task 35**: Create User Profile Page (8h)
**Task 36**: Create Change Password Component (4h)
**Task 37**: Add Avatar Upload Component (4h)

### Phase 4.4: Organization Management Pages (Week 12-13, 20 hours)

**Task 38**: Create Organization Settings Page (8h)
**Task 39**: Create Member Invitation Modal (6h)
**Task 40**: Create Member Management Table (6h)

### Phase 4.5: Auth State & Route Protection (Week 13, 18 hours)

**Task 41**: Create useAuthStore (Zustand) (8h)
- State: user, token, loading, error
- Actions: login, logout, register, updateProfile, changePassword
- Encrypted localStorage persistence (CryptoJS)
- HTTP-only cookie for token
- **Reuse**: 85% from SportERP's useAuthStore.ts

**Task 42**: Create Next.js Middleware (6h)
- Route protection logic
- Redirect unauthenticated users to /login
- Validate JWT token expiration
- **Reuse**: 90% from SportERP's middleware.ts

**Task 43**: Create Protected Layout Component (4h)
- Fetch user data on mount
- Show loading spinner during auth check
- Redirect if not authenticated

---

## Stage 5: Security & Testing (Weeks 14-15, 35-45 hours)

**Status**: ⏳ Pending Task Creation (9 tasks)

### Phase 5.1: Security Hardening (Week 14, 18 hours)

**Task 44**: Implement Rate Limiting (4h)
**Task 45**: Add CSRF Protection (4h)
**Task 46**: Implement Security Headers (2h)
**Task 47**: Audit RLS Policies (4h)
**Task 48**: Add Input Sanitization (2h)
**Task 49**: Setup HTTPS in Production (2h)

### Phase 5.2: Testing (Week 15, 22 hours)

**Task 50**: Backend Unit Tests (Pytest) (8h)
**Task 51**: Backend Integration Tests (8h)
**Task 52**: Frontend E2E Tests (Playwright) (6h)

---

## Task Summary

| Stage | Tasks | Hours | Status |
|-------|-------|-------|--------|
| Stage 1: Foundation & Database | 9 | 30-40 | ✅ Created |
| Stage 2: Core Authentication | 10 | 30-40 | ⏳ Pending |
| Stage 3: Multi-Tenant Organizations | 10 | 35-45 | ⏳ Pending |
| Stage 4: User Management UI | 14 | 70-80 | ⏳ Pending |
| Stage 5: Security & Testing | 9 | 35-45 | ⏳ Pending |
| **TOTAL** | **52 tasks** | **200-250 hours** | **9/52 created** |

---

## V2 Roadmap (Deferred Features)

### Stage 6: Advanced Features (Future, 7 weeks, 55-75 hours)

**Phase 6.1: Google OAuth** (2 weeks, 15-20 hours)
- Setup Google OAuth2 in Google Console
- Create `/auth/google` endpoint
- Update login page with "Sign in with Google" button

**Phase 6.2: Two-Factor Authentication** (2 weeks, 20-25 hours)
- TOTP-based 2FA setup flow
- QR code generation for authenticator apps
- Backup codes generation
- 2FA verification on login

**Phase 6.3: SportERP Integration** (3 weeks, 20-30 hours)
- Shared JWT secret for SSO
- SSO redirect flow (SportERP → Archon)
- User provisioning (auto-create Archon users from SportERP)

---

## Database Schema

### archon_users
```sql
CREATE TABLE archon_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  full_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### archon_user_profiles
```sql
CREATE TABLE archon_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES archon_users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  phone VARCHAR(50),
  timezone VARCHAR(50) DEFAULT 'UTC',
  theme_preference VARCHAR(20) DEFAULT 'light',
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### archon_organizations
```sql
CREATE TABLE archon_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  owner_id UUID REFERENCES archon_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### archon_organization_members
```sql
CREATE TABLE archon_organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES archon_organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES archon_users(id) ON DELETE CASCADE,
  role VARCHAR(20) CHECK (role IN ('Owner', 'Admin', 'Member', 'Viewer')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);
```

### archon_invitations
```sql
CREATE TABLE archon_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES archon_organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('Admin', 'Member', 'Viewer')),
  token VARCHAR(255) UNIQUE NOT NULL,
  invited_by UUID REFERENCES archon_users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_pending_invitation UNIQUE(org_id, email, accepted_at)
);
```

### archon_password_reset_tokens
```sql
CREATE TABLE archon_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES archon_users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## JWT Token Structure

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "org_id": "org-uuid",
  "role": "Owner",
  "environment": "PROD",
  "public": false,
  "scope": "PRIVATE",
  "exp": 1735200000,
  "iat": 1735171200
}
```

**Algorithm**: HS256
**Expiration**: 8 hours (28800 seconds)
**Secret**: Environment variable `JWT_SECRET_KEY`

---

## Success Criteria

- ✅ Users can register, login, manage profiles
- ✅ Organizations support multi-user collaboration
- ✅ Magic link invitations work for new and existing users
- ✅ RBAC enforces permissions correctly (Owner > Admin > Member > Viewer)
- ✅ Security audit passes (no critical vulnerabilities)
- ✅ Test coverage >80% for auth code
- ✅ RLS policies prevent unauthorized data access

---

## Risk Analysis

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| JWT Secret Leak | Critical | Low | Environment variables, quarterly rotation, 256-bit secret |
| RLS Policy Bypass | High | Medium | Thorough testing with different roles, audit logs |
| Password Leak | High | Low | Bcrypt cost factor 12, strong password policy |
| Invitation Token Reuse | Medium | Medium | Single-use tokens, 7-day expiration, mark as used |
| Rate Limiting Bypass | Medium | Medium | slowapi with Redis, monitor for spikes |

---

## Next Steps

1. ✅ Create Archon project (Project ID: `76c28d89-ed2b-436f-b3a1-e09426074c58`)
2. ✅ Create Stage 1 tasks (9 tasks)
3. ⏳ Create Stage 2-5 tasks (43 tasks)
4. ⏳ Begin Stage 1 implementation (database schema)

**Confidence Level**: 98%

**Last Updated**: 2026-01-12 by Claude Code
