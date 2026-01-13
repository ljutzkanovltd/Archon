# SportERP Authentication & User Management Architecture Analysis

**Date**: 2026-01-13
**Purpose**: Inform Archon User Management System design based on SportERP patterns
**Database Expert Agent**: Research & Schema Design

---

## Executive Summary

SportERP implements a **multi-tenant organization structure** with JWT-based authentication, OAuth integration, and complex role-based access control. The architecture separates concerns between:

1. **Authentication Layer** (JWT tokens, OAuth2, Google integration)
2. **User Layer** (res.users, res.partner - Odoo core models)
3. **Organization Layer** (organisation.organisation, organisation.user - custom models)
4. **Access Control** (subscription codes, privilege groups, access rules)

**Key Insight**: SportERP uses a **dual identity system** - Odoo's native `res.users`/`res.partner` for authentication + custom `organisation.user` for business logic and multi-tenancy.

---

## 1. SportERP Database Structure (Discovered Patterns)

### 1.1 Core Odoo Models (Inherited)

**res.users** (Odoo core, extended)
- `id` (Integer, PK)
- `login` (VARCHAR, email-based, unique)
- `password` (VARCHAR, hashed)
- `partner_id` (Many2one → res.partner)
- `company_id` (Many2one → res.company)
- `company_ids` (Many2many → res.company)
- `groups_id` (Many2many → res.groups)
- `tz` (VARCHAR, timezone)
- `active` (Boolean)
- Created automatically by Odoo ORM

**res.partner** (Odoo core, extended)
- `id` (Integer, PK)
- `name` (VARCHAR, first name)
- `last_name` (VARCHAR)
- `email` (VARCHAR, unique)
- `phone` (VARCHAR)
- `mobile` (VARCHAR)
- `image_1920` (Binary, avatar)
- `street`, `street2`, `city`, `zip` (Address fields)
- `state_id` (Many2one → res.country.state)
- `country_id` (Many2one → res.country)
- `dob` (Date, date of birth)
- `age` (Integer, computed)
- `gender` (Selection: male, female, undisclosed)
- `company_ids` (Many2many → res.company)
- `is_company` (Boolean)
- `parent_id` (Many2one → res.partner, for hierarchies)
- `is_2fa_enabled` (Boolean)
- `otp_email`, `otp_time`, `otp_value`, `otp_unique_value` (OTP fields)
- `biography`, `job_title` (Profile fields)
- `website` (VARCHAR)
- `write_date`, `create_date` (Timestamps, automatic)

### 1.2 Custom Organization Models

**organisation.organisation**
- `id` (Integer, PK)
- `name` (VARCHAR, organization name)
- `organisation_code` (VARCHAR, generated code like "SPO", "BAD")
- `partner_id` (Many2one → res.partner, organization contact)
- `company_id` (Many2one → res.company, owning company)
- `stage_id` (Many2one → organisation.stage)
- `active` (Boolean, default True)
- `organisation_logo` (Binary image)
- `primary_color`, `secondary_color` (VARCHAR, branding)
- `phone`, `email` (Related from partner_id)
- `tag_ids` (Many2many → organisation.tag)
- `product_ids` (Many2many → product.product, subscribed products)
- `onboard_users` (Boolean, default True)
- `is_default_organisation` (Boolean)
- `is_home_gallery` (Boolean)
- `customer_bool`, `supplier_bool` (Boolean)
- `organisation_type` (Selection: Customer, Supplier)
- `country_id`, `dashboard_default_country_id` (Many2one → res.country)
- `org_user_ids` (One2many → organisation.user)
- `subscription_code_ids` (One2many → organisation.subscription_code)
- `role_privilege_ids` (Many2many → role.privilege)
- `component_ids` (Many2many → service.component, available services)
- `user_group_ids` (One2many → user.groups)
- `document_ids` (One2many → resource.document)

**organisation.user** (Bridge between res.partner and organisation)
- `id` (Integer, PK)
- `name` (VARCHAR, related from partner_id.name)
- `partner_id` (Many2one → res.partner, **required**, the actual person)
- `organisation_id` (Many2one → organisation.organisation, **required**)
- `company_id` (Many2one → res.company)
- `user_id` (Many2one → res.users, portal/login user)
- `active` (Boolean, default True)
- `org_group_user_type` (Many2one → res.groups, legacy role)
- `privilege_group_id` (Many2one → organisation.subscription_code, **new role system**)
- `phone`, `email` (Related from partner_id)
- `tag_ids` (Many2many → organisation.tag)
- `is_confirmed` (Boolean, admin approval)
- `confirmed_by` (Many2one → res.partner)
- `confirmed_date` (Date)
- `subordinate_ids` (Many2many → res.partner, reporting hierarchy)
- `parent_ids` (Many2many → organisation.user, computed)
- `show_welcome_msg` (Boolean, default True)
- `employee_id` (Many2one → hr.employee, optional HR integration)
- `component_ids` (Many2many → service.component, user-specific services)
- `document_ids` (Many2many → resource.document)

**organisation.subscription_code** (Role/Group system)
- `id` (Integer, PK)
- `group_name` (VARCHAR, e.g., "Administrator", "Coach", "Fan")
- `subscription_code` (VARCHAR, unique, format: "ORG-AD-1234")
- `organisation_id` (Many2one → organisation.organisation)
- `company_id` (Many2one → res.company)
- `is_administrator` (Boolean)
- `is_org_dashboard` (Boolean, dashboard access)
- `component_ids` (Many2many → service.component, group permissions)
- `access_control_ids` (One2many → subscription.access.control)
- `accessible_group_ids` (Many2many → organisation.subscription_code, hierarchy)

### 1.3 JWT Token Payload (Current Implementation)

From `/src/app/v1/middleware/jwt_token.py`:

```python
token_data = {
    "sub": username,                    # User email/login
    "environment": environment,          # DEV_ENV, PROD_ENV, etc.
    "organisation_id": organisation_id,  # Organisation ID (integer)
    "company_id": company_id,           # Company subdomain
    "access_domain": access_domain,      # app.sporterp-dev.co.uk
    "user_id": user_id,                 # res.users.id
    "org_user_id": org_user_id,         # organisation.user.id (CRITICAL)
    "contact_id": contact_id,           # res.partner.id
    "public": public,                   # Boolean (public vs private token)
    "scope": " ".join(scope),           # "PRIVATE,DEV_ENV"
    "exp": expiry_timestamp             # Expiration
}
```

**Critical IDs in Token**:
- `user_id` → `res.users.id`
- `org_user_id` → `organisation.user.id` (most important for business logic)
- `contact_id` → `res.partner.id`
- `organisation_id` → `organisation.organisation.id`
- `company_id` → Company subdomain (string, not ID)

---

## 2. Authentication Patterns

### 2.1 JWT Authentication Flow

1. **Token Generation** (`JWT.generate_token()`)
   - Validates username/password via Odoo backend
   - Creates JWT with HS256 algorithm
   - Default timeout: configurable per environment
   - Supports public/private token scopes

2. **Token Validation** (`JWT.validate_token()`)
   - Validates JWT signature
   - Checks expiration
   - Validates public/private scope
   - Returns decoded payload

3. **OAuth2 Password Bearer**
   - Uses FastAPI `OAuth2PasswordBearer`
   - Token passed as `Authorization: Bearer <token>`

### 2.2 Google OAuth Flow

From `/src/app/v1/middleware/authentication.py`:

1. **Frontend sends**: Authorization code + redirect URI
2. **Backend exchanges**: Code for Google access token
3. **Fetch user info**: `https://www.googleapis.com/oauth2/v3/userinfo`
4. **Extract data**: `email`, `name`, `picture`
5. **Sign-in or Sign-up**:
   - Existing user → Generate JWT, return access_token
   - New user → Return `3312` status code with `google_user_data` for signup

**Identity Data Structure**:
```python
identity_data = {
    'identity_token': access_token,
    'identity_type': 'GOOGLE',
    'name_on_identity': name,
    'picture_on_identity': picture
}
```

### 2.3 Password Handling

- **Encrypted in transit**: `DataTransformer.decrypt_password(encrypted_password, config)`
- **Hashed at rest**: Odoo handles password hashing (PBKDF2/SHA256)
- **No plaintext storage**: Passwords never stored unencrypted

### 2.4 Two-Factor Authentication (2FA)

- `partner.is_2fa_enabled` (Boolean)
- OTP fields: `otp_email`, `otp_time`, `otp_value`, `otp_unique_value`
- OTP confirmation endpoint: `/api/user/onboard/sign-in/confirm-otp`

---

## 3. Multi-Tenant Organization Structure

### 3.1 Entity Relationships

```
res.company (Tenant root)
    ↓ (1:N)
organisation.organisation (Business entities)
    ↓ (1:N)
organisation.user (User memberships)
    ↓ (references)
res.partner (Person identity)
    ↓ (1:1 optional)
res.users (Login credentials)
```

### 3.2 Multi-Tenant Patterns

**Company Isolation**:
- Every model has `company_id` field
- Supabase RLS equivalent: Domain filters `[('company_id', '=', user.company_id.id)]`

**Organization Membership**:
- Users belong to **one organization** via `organisation.user.organisation_id`
- Organizations belong to **one company**
- Users can be members of **multiple organizations** via multiple `organisation.user` records

**Access Control Hierarchy**:
1. **Company level**: Base isolation (res.company)
2. **Organization level**: Business entity (organisation.organisation)
3. **Subscription group level**: Role-based (organisation.subscription_code)
4. **User level**: Individual permissions (organisation.user.component_ids)

### 3.3 Invitation System (Inferred)

No explicit invitation table found, but onboarding patterns suggest:

1. **Subscription Codes** serve dual purpose:
   - Group membership identifier
   - Invitation mechanism (code-based signup)

2. **Onboarding Flow**:
   - Admin creates subscription code: `"BAD-CO-4567"`
   - Code shared with invitee
   - Invitee signs up with code
   - `organisation.user` created with `privilege_group_id` set

---

## 4. Comparison: SportERP vs Archon Design Decisions

| Aspect | SportERP Pattern | Archon Design | Rationale |
|--------|------------------|---------------|-----------|
| **User Identity** | Dual model (`res.partner` + `organisation.user`) | Single table (`archon_users`) | Archon doesn't need Odoo's ERP complexity |
| **Organization** | `organisation.organisation` (Odoo model) | `archon_organizations` (PostgreSQL table) | Direct PostgreSQL, no ORM overhead |
| **Membership** | `organisation.user` (bridge table with rich fields) | `archon_organization_members` (lean bridge) | Simpler, focused on essentials |
| **Roles** | `organisation.subscription_code` (complex access control) | `role` ENUM (owner, admin, member) | Sufficient for Archon's scope |
| **Authentication** | JWT with 9 fields, public/private scopes | JWT with 5 fields (simpler) | Archon doesn't need multi-environment |
| **OAuth** | Google OAuth with identity_data JSONB | Support multiple providers (Google, GitHub, etc.) | Future-proof design |
| **Invitations** | Implicit via subscription codes | Explicit `archon_invitations` table | Clearer, audit trail |
| **Multi-Tenancy** | Company → Organization → User (3 levels) | Organization → User (2 levels) | Simpler, sufficient |
| **Profile Data** | Extended `res.partner` with 30+ fields | Separate `archon_user_profiles` table | Cleaner separation |
| **Timestamps** | Odoo automatic (`create_date`, `write_date`) | Explicit (`created_at`, `updated_at`) | PostgreSQL triggers |

---

## 5. Key Takeaways for Archon Schema

### 5.1 Adopt from SportERP

✅ **JWT-based authentication** with sub, organisation_id, user_id, org_user_id
✅ **OAuth integration pattern** (store provider + provider_user_id)
✅ **Multi-tenant organization structure** (organizations own users)
✅ **Role-based access** (simplified to owner/admin/member)
✅ **Soft deletes** via `active` field (Archon uses `is_active`)
✅ **Write timestamps** for optimistic locking
✅ **Email uniqueness** per organization (not global)

### 5.2 Simplify vs SportERP

🔧 **Remove** 3-level tenancy (Company → Org → User) → Keep 2-level (Org → User)
🔧 **Remove** subscription codes (complexity) → Use simple ENUM roles
🔧 **Remove** service components (ERP-specific) → Not needed for Archon
🔧 **Remove** Odoo ORM patterns → Use PostgreSQL native features
🔧 **Simplify** JWT payload (9 fields → 5 fields)
🔧 **Simplify** profile fields (30+ → 10 essential fields)

### 5.3 Add to Archon (Missing in SportERP)

➕ **Explicit invitations table** (`archon_invitations` with tokens)
➕ **Email verification** (`is_verified` field + verification tokens)
➕ **Multiple OAuth providers** (Google, GitHub, GitLab)
➕ **Password reset tokens** (time-limited, single-use)
➕ **User profile preferences** (theme, language, timezone)
➕ **Audit logging** (login history, IP tracking)

---

## 6. SportERP Database Limitations (Avoided in Archon)

### 6.1 Performance Issues

❌ **No composite indexes**: SportERP relies on Odoo's automatic indexing
❌ **N+1 query patterns**: `related` fields cause performance issues
❌ **No query optimization**: Odoo ORM handles all SQL
❌ **Large JSONB fields**: `identity_data`, `access_control` stored as JSONB without indexes

### 6.2 Data Integrity Issues

❌ **Weak foreign keys**: Many2one relations not enforced at DB level
❌ **No CHECK constraints**: Validation done in Python, not database
❌ **Nullable required fields**: `partner_id` should be NOT NULL but isn't
❌ **No unique constraints**: Email uniqueness enforced in application logic

### 6.3 Scalability Issues

❌ **Integer primary keys**: Sequential IDs leak information
❌ **No partitioning**: All data in single tables
❌ **No RLS**: Multi-tenancy enforced via application logic
❌ **Heavy ORM**: Every query goes through Python ORM layer

---

## 7. Recommendations for Archon Schema

### 7.1 Primary Keys
✅ **Use UUIDs** (`gen_random_uuid()`) instead of integers
✅ **Prevents** information leakage, enumeration attacks
✅ **Enables** distributed systems, horizontal scaling

### 7.2 Foreign Keys
✅ **Always use ON DELETE CASCADE/SET NULL**
✅ **Index all foreign keys** for join performance
✅ **NOT NULL for required relationships**

### 7.3 Timestamps
✅ **created_at, updated_at on ALL tables**
✅ **PostgreSQL triggers** for auto-update
✅ **TIMESTAMPTZ** (timezone-aware)

### 7.4 Indexes
✅ **Composite indexes** for common query patterns:
   - `(organization_id, user_id)` on `archon_organization_members`
   - `(email, organization_id)` on `archon_users` (if scoped per org)
   - `(token)` on `archon_invitations`
✅ **Partial indexes** for performance:
   - `WHERE is_active = TRUE` (filter inactive users)
   - `WHERE accepted_at IS NULL` (pending invitations)

### 7.5 Constraints
✅ **CHECK constraints** for data validation:
   - `CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')`
   - `CHECK (role IN ('owner', 'admin', 'member'))`
✅ **UNIQUE constraints**:
   - `UNIQUE (email)` globally OR `UNIQUE (email, organization_id)` per org
   - `UNIQUE (organization_id, slug)`

### 7.6 Row Level Security (RLS)
✅ **Enable RLS on all tables**
✅ **Policies for multi-tenancy**:
   - Users can only see data from their organizations
   - Owners/admins can manage organization settings
   - Members can only read data

---

## 8. Next Steps

1. **Finalize schema design** (Section 9 below)
2. **Create migration script** (Alembic + raw SQL)
3. **Implement RLS policies** (Supabase-compatible)
4. **Add indexes and constraints**
5. **Test with SportERP-like workload**

---

## 9. References

- SportERP API: `/home/ljutzkanov/Documents/Projects/sporterp-apps/api.sporterp.co.uk/src`
- JWT implementation: `src/app/v1/middleware/jwt_token.py`
- Auth flow: `src/app/v1/middleware/authentication.py`
- User models: `src/app/v1/api/user/model/user_profile.py`
- Organization model: `web.sporterp.co.uk/extra_addons/sporterp/organisation/models/organisation.py`
- Org user model: `web.sporterp.co.uk/extra_addons/sporterp/organisation/models/org_user.py`
- Partner model: `web.sporterp.co.uk/extra_addons/sporterp/organisation/models/res_partner.py`

---

**Document Version**: 1.0
**Last Updated**: 2026-01-13 12:45 UTC
**Next Document**: `archon_user_management_schema.sql`
