# Settings Persistence Requirements for User Management System

**Document Version:** 1.0
**Date:** 2026-01-15
**Status:** Requirements Ready for Implementation
**Target Agent:** User Management System Implementation Team
**Related Migration:** `033_add_user_management_system.sql`

---

## Executive Summary

**Problem:** User settings (feature toggles) are currently stored globally in `archon_settings` table with no user association. When users toggle settings, all users see the same state. Settings reset to default when users re-login.

**Solution:** Implement per-user settings persistence using new user management system tables (migration 033).

**Impact:**
- 9 feature toggles need per-user storage
- Database schema changes required
- API service layer updates needed
- Frontend context remains unchanged (transparent to UI)

**Estimated Complexity:** Medium (2-3 days)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Requirements](#requirements)
3. [Database Schema Design](#database-schema-design)
4. [API Changes](#api-changes)
5. [Migration Strategy](#migration-strategy)
6. [Testing Requirements](#testing-requirements)
7. [Acceptance Criteria](#acceptance-criteria)

---

## Current State Analysis

### Problem Description

**User Report:**
> "When I go to settings and activate any of those toggles, the next time I re-log in with the user, I have to reactivate them. It seems that the toggle settings have not been saved."

**Root Cause:**

1. **Global Settings Table (`archon_settings`)**
   - Location: `python/src/server/services/credential_service.py`
   - Schema: No `user_id` column
   - Behavior: Settings stored globally, affecting all users
   - When User A enables "Projects", all users see it enabled
   - Settings persist across sessions, but are shared globally

2. **Current Table Structure:**
   ```sql
   CREATE TABLE archon_settings (
       id UUID PRIMARY KEY,
       key VARCHAR(255) UNIQUE NOT NULL,  -- e.g., "PROJECTS_ENABLED"
       value TEXT,
       encrypted_value TEXT,
       is_encrypted BOOLEAN DEFAULT FALSE,
       category VARCHAR(100),              -- e.g., "features", "rag_strategy"
       description TEXT,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
       -- ❌ NO user_id column!
   );
   ```

3. **Current Data Flow:**
   ```
   Frontend (FeaturesTab.tsx)
   ↓ Toggle clicked
   SettingsContext.setProjectsEnabled(true)
   ↓ Calls
   credentialsService.updateCredential("PROJECTS_ENABLED", true)
   ↓ HTTP POST to
   /api/credentials
   ↓ Backend
   credential_service.set_credential()
   ↓ Writes to
   archon_settings (GLOBAL, no user_id)
   ❌ Result: All users see same setting
   ```

### Affected Features

**9 Feature Toggles in Settings UI:**

| Setting Key | Description | Current Category | User-Specific? |
|------------|-------------|------------------|----------------|
| `PROJECTS_ENABLED` | Projects & Tasks functionality | features | ✅ Should be per-user |
| `STYLE_GUIDE_ENABLED` | UI style guide in navigation | features | ✅ Should be per-user |
| `AGENT_WORK_ORDERS_ENABLED` | Automated workflows | features | ✅ Should be per-user |
| `LOGFIRE_ENABLED` | Pydantic Logfire observability | features | ✅ Should be per-user |
| `DISCONNECT_SCREEN_ENABLED` | Disconnect screen visibility | features | ✅ Should be per-user |
| `TASKS_ENABLED` | Tasks menu in sidebar | features | ✅ Should be per-user |
| `KNOWLEDGE_BASE_ENABLED` | Knowledge Base in sidebar | features | ✅ Should be per-user |
| `MCP_SERVER_DASHBOARD_ENABLED` | MCP Server menu in sidebar | features | ✅ Should be per-user |
| `DARK_MODE_ENABLED` | Dark mode theme | features | ✅ Should be per-user |

**Note:** RAG settings (`rag_strategy` category) should remain global/admin-only as they affect system-wide AI behavior.

### Files to Modify

**Backend:**
- `python/src/server/services/credential_service.py` (lines 140-299, 348-394)
- `python/src/server/routers/credentials.py` (API endpoints)
- Migration file to create `archon_user_preferences` table

**Frontend:** (No changes needed - transparent to UI)
- `archon-ui-nextjs/src/contexts/SettingsContext.tsx` (reads from API)
- `archon-ui-nextjs/src/app/(dashboard)/settings/components/FeaturesTab.tsx` (renders toggles)

---

## Requirements

### Functional Requirements

**FR-1: Per-User Settings Storage**
- Each user must have isolated settings that persist across sessions
- Settings must be specific to the logged-in user
- Default values must be provided for first-time users

**FR-2: Backward Compatibility**
- Existing global `archon_settings` table must remain for system-wide settings
- RAG strategy settings (`category = 'rag_strategy'`) must remain global
- Admin-level settings must remain global

**FR-3: Settings Categories**

Two distinct categories:

| Category | Storage | Scope | Examples |
|----------|---------|-------|----------|
| **Global Settings** | `archon_settings` | System-wide, admin-managed | RAG strategy, API keys, system features |
| **User Preferences** | `archon_user_preferences` | Per-user, user-managed | Feature toggles, UI preferences, theme |

**FR-4: Migration Path**
- Existing settings in `archon_settings` should provide defaults for new users
- No data loss during migration

### Non-Functional Requirements

**NFR-1: Performance**
- Settings lookup must remain fast (< 50ms)
- Cache user preferences in memory/session

**NFR-2: Security**
- User can only read/write their own preferences
- Admin users can view all user preferences (for debugging)
- Row-level security (RLS) policies must enforce user isolation

**NFR-3: Data Integrity**
- Foreign key constraints to `archon_users` table
- Cascade delete when user is deleted
- Unique constraint on (user_id, preference_key)

---

## Database Schema Design

### New Table: `archon_user_preferences`

**Purpose:** Store per-user settings separate from global system settings.

```sql
-- User-specific preferences table
CREATE TABLE archon_user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User association (from migration 033)
    user_id UUID NOT NULL REFERENCES archon_users(id) ON DELETE CASCADE,

    -- Preference key-value
    preference_key VARCHAR(255) NOT NULL,  -- e.g., "PROJECTS_ENABLED"
    preference_value TEXT,                 -- Stored as string (parse as needed)

    -- Metadata
    category VARCHAR(100) DEFAULT 'features',
    description TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_user_preference UNIQUE (user_id, preference_key)
);

-- Indexes for fast lookups
CREATE INDEX idx_user_preferences_user_id ON archon_user_preferences(user_id);
CREATE INDEX idx_user_preferences_category ON archon_user_preferences(category);
CREATE INDEX idx_user_preferences_key ON archon_user_preferences(preference_key);

-- Trigger for auto-updating timestamps
CREATE TRIGGER update_user_preferences_timestamp
    BEFORE UPDATE ON archon_user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on archon_user_preferences
ALTER TABLE archon_user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own preferences
CREATE POLICY user_preferences_select_own
    ON archon_user_preferences
    FOR SELECT
    USING (user_id = auth.uid());  -- auth.uid() from JWT token

-- Policy: Users can only insert their own preferences
CREATE POLICY user_preferences_insert_own
    ON archon_user_preferences
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy: Users can only update their own preferences
CREATE POLICY user_preferences_update_own
    ON archon_user_preferences
    FOR UPDATE
    USING (user_id = auth.uid());

-- Policy: Users can only delete their own preferences
CREATE POLICY user_preferences_delete_own
    ON archon_user_preferences
    FOR DELETE
    USING (user_id = auth.uid());

-- Admin policy: Service role can access all preferences (for debugging)
CREATE POLICY user_preferences_admin_all
    ON archon_user_preferences
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
```

### Migration File Structure

Create: `migrations/034_add_user_preferences.sql`

```sql
-- =============================================================================
-- Migration 034: Add User Preferences Table
-- =============================================================================
-- Date: 2026-01-15
-- Depends On: 033_add_user_management_system.sql
-- Description: Per-user settings storage for feature toggles and UI preferences
-- =============================================================================

-- [Insert table creation SQL above]

-- Migration to populate defaults from global settings
INSERT INTO archon_user_preferences (user_id, preference_key, preference_value, category, description)
SELECT
    u.id AS user_id,
    gs.key AS preference_key,
    gs.value AS preference_value,
    gs.category,
    gs.description
FROM archon_users u
CROSS JOIN (
    SELECT key, value, category, description
    FROM archon_settings
    WHERE category = 'features' AND key IN (
        'PROJECTS_ENABLED',
        'STYLE_GUIDE_ENABLED',
        'AGENT_WORK_ORDERS_ENABLED',
        'LOGFIRE_ENABLED',
        'DISCONNECT_SCREEN_ENABLED',
        'TASKS_ENABLED',
        'KNOWLEDGE_BASE_ENABLED',
        'MCP_SERVER_DASHBOARD_ENABLED',
        'DARK_MODE_ENABLED'
    )
) gs
ON CONFLICT (user_id, preference_key) DO NOTHING;

-- Rollback:
-- DROP TABLE IF EXISTS archon_user_preferences CASCADE;
```

---

## API Changes

### Backend Service Layer

**File:** `python/src/server/services/credential_service.py`

#### New Methods to Add

```python
class CredentialService:
    # ... existing methods ...

    async def get_user_preference(
        self,
        user_id: str,
        key: str,
        default: Any = None
    ) -> Any:
        """
        Get a user-specific preference.

        Args:
            user_id: User UUID
            key: Preference key (e.g., "PROJECTS_ENABLED")
            default: Default value if not found

        Returns:
            Preference value or default
        """
        try:
            supabase = self._get_supabase_client()

            result = supabase.table("archon_user_preferences").select("*").eq(
                "user_id", user_id
            ).eq("preference_key", key).execute()

            if result.data and len(result.data) > 0:
                return result.data[0]["preference_value"]

            # Fallback to global setting if user preference doesn't exist
            return await self.get_credential(key, default)

        except Exception as e:
            logger.error(f"Error getting user preference {key} for user {user_id}: {e}")
            return default

    async def set_user_preference(
        self,
        user_id: str,
        key: str,
        value: str,
        category: str = "features",
        description: str = None,
    ) -> bool:
        """
        Set a user-specific preference.

        Args:
            user_id: User UUID
            key: Preference key
            value: Preference value
            category: Category (default: "features")
            description: Optional description

        Returns:
            True if successful, False otherwise
        """
        try:
            supabase = self._get_supabase_client()

            data = {
                "user_id": user_id,
                "preference_key": key,
                "preference_value": value,
                "category": category,
                "description": description,
            }

            # Upsert to handle updates
            result = supabase.table("archon_user_preferences").upsert(
                data,
                on_conflict="user_id,preference_key"
            ).execute()

            # Verify write succeeded
            if hasattr(result, 'error') and result.error:
                logger.error(f"Failed to set user preference {key}: {result.error}")
                return False

            logger.info(f"Successfully set user preference {key} for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error setting user preference {key}: {e}")
            return False

    async def get_all_user_preferences(
        self,
        user_id: str,
        category: str = None
    ) -> dict[str, Any]:
        """
        Get all preferences for a user.

        Args:
            user_id: User UUID
            category: Optional category filter

        Returns:
            Dict of preference_key -> preference_value
        """
        try:
            supabase = self._get_supabase_client()

            query = supabase.table("archon_user_preferences").select("*").eq(
                "user_id", user_id
            )

            if category:
                query = query.eq("category", category)

            result = query.execute()

            preferences = {}
            for item in result.data:
                preferences[item["preference_key"]] = item["preference_value"]

            return preferences

        except Exception as e:
            logger.error(f"Error getting all user preferences for {user_id}: {e}")
            return {}
```

#### Modified Methods

**Update `get_credential()` to check user preferences first:**

```python
async def get_credential(
    self,
    key: str,
    default: Any = None,
    decrypt: bool = True,
    user_id: str = None  # NEW PARAMETER
) -> Any:
    """Get a credential value by key."""

    # NEW: Check user preferences first if user_id provided
    if user_id and key in USER_PREFERENCE_KEYS:
        user_pref = await self.get_user_preference(user_id, key, default)
        if user_pref is not None:
            return user_pref

    # Fall back to global settings
    if not self._cache_initialized:
        await self.load_all_credentials()

    value = self._cache.get(key, default)

    # ... rest of existing logic ...
```

**Update `set_credential()` to route to user preferences:**

```python
async def set_credential(
    self,
    key: str,
    value: str,
    is_encrypted: bool = False,
    category: str = None,
    description: str = None,
    user_id: str = None  # NEW PARAMETER
) -> bool:
    """Set a credential value."""

    # NEW: Route user preferences to separate table
    if user_id and key in USER_PREFERENCE_KEYS:
        return await self.set_user_preference(
            user_id, key, value, category or "features", description
        )

    # Global settings remain in archon_settings
    try:
        supabase = self._get_supabase_client()
        # ... rest of existing logic ...
```

**Define user preference keys:**

```python
# At top of file
USER_PREFERENCE_KEYS = {
    "PROJECTS_ENABLED",
    "STYLE_GUIDE_ENABLED",
    "AGENT_WORK_ORDERS_ENABLED",
    "LOGFIRE_ENABLED",
    "DISCONNECT_SCREEN_ENABLED",
    "TASKS_ENABLED",
    "KNOWLEDGE_BASE_ENABLED",
    "MCP_SERVER_DASHBOARD_ENABLED",
    "DARK_MODE_ENABLED",
}
```

### API Endpoint Changes

**File:** `python/src/server/routers/credentials.py`

#### Modify Existing Endpoints

**Update GET `/api/credentials` endpoint:**

```python
@router.get("/credentials")
async def get_credentials(
    current_user: dict = Depends(get_current_user)  # NEW: Require auth
):
    """Get all credentials for current user."""
    user_id = current_user["sub"]  # Extract user ID from JWT

    # Get user preferences
    user_prefs = await credential_service.get_all_user_preferences(user_id)

    # Get global settings (only non-sensitive ones)
    global_settings = await credential_service.get_credentials_by_category("features")

    # Merge with user preferences taking precedence
    all_settings = {**global_settings, **user_prefs}

    return {
        "success": True,
        "credentials": all_settings,
        "source": "user_preferences"  # NEW: Indicate source
    }
```

**Update POST `/api/credentials` endpoint:**

```python
@router.post("/credentials")
async def set_credential_endpoint(
    request: SetCredentialRequest,
    current_user: dict = Depends(get_current_user)  # NEW: Require auth
):
    """Set a credential value for current user."""
    user_id = current_user["sub"]

    success = await credential_service.set_credential(
        key=request.key,
        value=request.value,
        is_encrypted=request.is_encrypted or False,
        category=request.category,
        description=request.description,
        user_id=user_id  # NEW: Pass user_id
    )

    return {
        "success": success,
        "message": f"User preference '{request.key}' updated successfully"
    }
```

#### Add Authentication Dependency

```python
from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError

async def get_current_user(authorization: str = Header(None)):
    """Extract user from JWT token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = authorization.replace("Bearer ", "")

    try:
        # Decode JWT (use your secret key from env)
        payload = jwt.decode(
            token,
            os.getenv("JWT_SECRET_KEY"),
            algorithms=["HS256"]
        )
        return payload  # Contains {"sub": user_id, "email": email, ...}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
```

---

## Migration Strategy

### Phase 1: Preparation (Pre-Deployment)

**Step 1: Apply User Management Migration**
```bash
# Apply migration 033 first (if not already applied)
psql $DATABASE_URI -f migrations/033_add_user_management_system.sql
```

**Step 2: Create User Preferences Migration**
```bash
# Create and apply migration 034
psql $DATABASE_URI -f migrations/034_add_user_preferences.sql
```

**Step 3: Verify Tables Created**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('archon_users', 'archon_user_preferences');

-- Check RLS policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'archon_user_preferences';

-- Verify indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'archon_user_preferences';
```

### Phase 2: Code Deployment

**Step 1: Update Backend Service**
- Add new methods to `credential_service.py`
- Update existing methods to check user context
- Add `USER_PREFERENCE_KEYS` constant

**Step 2: Update API Endpoints**
- Add authentication to `/api/credentials` endpoints
- Implement JWT token parsing
- Add user_id parameter routing

**Step 3: Testing**
- Unit tests for new service methods
- Integration tests for API endpoints
- Manual testing with multiple users

### Phase 3: Data Migration

**Default Values Strategy:**

```sql
-- Option A: Copy current global settings as defaults for all users
INSERT INTO archon_user_preferences (user_id, preference_key, preference_value, category)
SELECT
    u.id,
    'PROJECTS_ENABLED',
    COALESCE(
        (SELECT value FROM archon_settings WHERE key = 'PROJECTS_ENABLED'),
        'false'
    ),
    'features'
FROM archon_users u
ON CONFLICT (user_id, preference_key) DO NOTHING;

-- Repeat for all 9 feature toggles...

-- Option B: Set smart defaults based on user role
INSERT INTO archon_user_preferences (user_id, preference_key, preference_value, category)
SELECT
    u.id,
    'PROJECTS_ENABLED',
    CASE
        WHEN u.is_admin THEN 'true'  -- Admins get all features
        ELSE 'false'                 -- Regular users start with defaults off
    END,
    'features'
FROM archon_users u
ON CONFLICT (user_id, preference_key) DO NOTHING;
```

**Recommended:** Option A (copy global settings) for smooth transition.

### Phase 4: Cleanup (Optional)

**Remove feature toggles from `archon_settings`:**

```sql
-- Archive global feature toggle settings (keep for audit trail)
UPDATE archon_settings
SET category = 'deprecated_features',
    description = CONCAT('DEPRECATED - Moved to user preferences. ', description)
WHERE key IN (
    'PROJECTS_ENABLED',
    'STYLE_GUIDE_ENABLED',
    'AGENT_WORK_ORDERS_ENABLED',
    'LOGFIRE_ENABLED',
    'DISCONNECT_SCREEN_ENABLED',
    'TASKS_ENABLED',
    'KNOWLEDGE_BASE_ENABLED',
    'MCP_SERVER_DASHBOARD_ENABLED',
    'DARK_MODE_ENABLED'
);

-- OR delete them entirely (not recommended)
-- DELETE FROM archon_settings WHERE key IN (...);
```

---

## Testing Requirements

### Unit Tests

**Test File:** `python/tests/services/test_credential_service.py`

```python
@pytest.mark.asyncio
async def test_get_user_preference_returns_user_value():
    """User preference overrides global setting."""
    user_id = "test-user-123"

    # Set global setting
    await credential_service.set_credential("PROJECTS_ENABLED", "false")

    # Set user preference
    await credential_service.set_user_preference(
        user_id, "PROJECTS_ENABLED", "true"
    )

    # Should return user preference
    result = await credential_service.get_credential(
        "PROJECTS_ENABLED", user_id=user_id
    )
    assert result == "true"

@pytest.mark.asyncio
async def test_user_preferences_isolated():
    """Different users have isolated preferences."""
    user1 = "user-1"
    user2 = "user-2"

    await credential_service.set_user_preference(user1, "TASKS_ENABLED", "true")
    await credential_service.set_user_preference(user2, "TASKS_ENABLED", "false")

    result1 = await credential_service.get_user_preference(user1, "TASKS_ENABLED")
    result2 = await credential_service.get_user_preference(user2, "TASKS_ENABLED")

    assert result1 == "true"
    assert result2 == "false"

@pytest.mark.asyncio
async def test_fallback_to_global_setting():
    """Falls back to global setting if user preference not set."""
    user_id = "new-user"

    await credential_service.set_credential("STYLE_GUIDE_ENABLED", "true")

    # User has no preference set
    result = await credential_service.get_user_preference(
        user_id, "STYLE_GUIDE_ENABLED", default="false"
    )

    # Should return global setting
    assert result == "true"
```

### Integration Tests

**Test File:** `python/tests/routers/test_credentials_api.py`

```python
@pytest.mark.asyncio
async def test_api_requires_authentication():
    """Credentials endpoints require valid JWT."""
    response = await client.get("/api/credentials")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_api_sets_user_preference():
    """POST /api/credentials saves to user preferences."""
    token = generate_test_jwt(user_id="test-user")

    response = await client.post(
        "/api/credentials",
        json={"key": "PROJECTS_ENABLED", "value": "true"},
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200

    # Verify saved to user_preferences table
    result = await db.fetch_one(
        "SELECT * FROM archon_user_preferences WHERE user_id = $1 AND preference_key = $2",
        "test-user",
        "PROJECTS_ENABLED"
    )
    assert result["preference_value"] == "true"

@pytest.mark.asyncio
async def test_rls_policies_enforce_isolation():
    """User can only access their own preferences."""
    user1_token = generate_test_jwt(user_id="user-1")
    user2_token = generate_test_jwt(user_id="user-2")

    # User 1 sets preference
    await client.post(
        "/api/credentials",
        json={"key": "DARK_MODE_ENABLED", "value": "true"},
        headers={"Authorization": f"Bearer {user1_token}"}
    )

    # User 2 retrieves preferences
    response = await client.get(
        "/api/credentials",
        headers={"Authorization": f"Bearer {user2_token}"}
    )

    # Should not see user 1's preference
    assert "DARK_MODE_ENABLED" not in response.json()["credentials"]
```

### Manual Testing Checklist

- [ ] **Test 1:** User A enables Projects, logs out, logs back in → Projects still enabled
- [ ] **Test 2:** User B has Projects disabled while User A has it enabled → Isolated settings
- [ ] **Test 3:** New user sees default settings (from global settings)
- [ ] **Test 4:** Toggle all 9 features, logout, login → All persist correctly
- [ ] **Test 5:** RAG settings (global) affect all users regardless of user preferences
- [ ] **Test 6:** User deletes account → User preferences cascade deleted
- [ ] **Test 7:** Settings page loads quickly (< 1 second)
- [ ] **Test 8:** Invalid JWT returns 401 Unauthorized
- [ ] **Test 9:** Two browser tabs (same user) sync settings changes

---

## Acceptance Criteria

**AC-1: Per-User Persistence ✅**
- Given a logged-in user
- When they enable a feature toggle
- Then it persists across logout/login sessions
- And other users don't see the change

**AC-2: Backward Compatibility ✅**
- Given existing global settings
- When the new system is deployed
- Then RAG settings remain global
- And admin settings remain global
- And no data is lost

**AC-3: Default Values ✅**
- Given a new user
- When they first access settings
- Then they see sensible defaults (from global settings)
- And can immediately customize them

**AC-4: Performance ✅**
- Settings page loads in < 1 second
- Toggle changes reflect immediately (< 500ms)
- Database queries use indexed lookups

**AC-5: Security ✅**
- User can only access their own preferences
- RLS policies enforce isolation
- JWT authentication required
- Service role can access all (for admin debugging)

**AC-6: Testing ✅**
- Unit tests cover all new service methods (>80% coverage)
- Integration tests verify API endpoints
- Manual testing checklist completed

**AC-7: Documentation ✅**
- Migration file includes rollback instructions
- API changes documented in code comments
- Database schema documented
- This requirements document serves as implementation guide

---

## Implementation Notes

### Considerations

**1. JWT Token Format**

Ensure JWT tokens include user ID in standard claim:

```json
{
  "sub": "a41ab933-b205-4be5-a642-42e2b866c1bb",  // User UUID
  "email": "user@example.com",
  "full_name": "John Doe",
  "exp": 1736933442
}
```

**2. Cache Strategy**

Consider caching user preferences in memory:

```python
class CredentialService:
    def __init__(self):
        self._user_prefs_cache: dict[str, dict[str, Any]] = {}  # user_id -> prefs
        self._user_cache_ttl = 300  # 5 minutes
```

**3. Settings Sync Across Tabs**

Use WebSocket or polling to sync settings across browser tabs:

```typescript
// Frontend: Poll for settings changes every 30s
useEffect(() => {
  const interval = setInterval(() => {
    fetchSettings();
  }, 30000);
  return () => clearInterval(interval);
}, []);
```

**4. Migration 033 Dependency**

This implementation **requires** migration 033 (`add_user_management_system.sql`) to be applied first. Verify:

```sql
SELECT COUNT(*) FROM archon_users;  -- Should return >= 0 (table exists)
```

**5. Feature Flag vs User Preference**

Future consideration: Some settings might need 3 levels:

1. **System Default** (in code)
2. **Global Admin Setting** (`archon_settings`)
3. **User Preference** (`archon_user_preferences`)

Example: Admin sets `PROJECTS_ENABLED=true` globally, but users can individually disable it.

---

## References

### Related Files

- **Migration 033:** `/migrations/033_add_user_management_system.sql`
- **Credential Service:** `/python/src/server/services/credential_service.py`
- **API Router:** `/python/src/server/routers/credentials.py`
- **Settings Context:** `/archon-ui-nextjs/src/contexts/SettingsContext.tsx`
- **Features Tab:** `/archon-ui-nextjs/src/app/(dashboard)/settings/components/FeaturesTab.tsx`

### Similar Patterns

- **SportERP:** `/sporterp-apps/app.sporterp.co.uk/src/lib/auth/user-context.ts`
- **Supabase RLS:** https://supabase.com/docs/guides/auth/row-level-security

---

## Appendix: Complete Migration File

**File:** `migrations/034_add_user_preferences.sql`

```sql
-- =============================================================================
-- Migration 034: Add User Preferences Table
-- =============================================================================
-- Date: 2026-01-15
-- Depends On: 033_add_user_management_system.sql
-- Description: Per-user settings storage for feature toggles and UI preferences
--
-- Tables Created:
--   - archon_user_preferences: Per-user settings (feature toggles, UI prefs)
--
-- Security:
--   - Row Level Security (RLS) policies ensure user isolation
--   - Users can only access their own preferences
--   - Service role can access all for admin debugging
--
-- Rollback:
--   DROP TABLE IF EXISTS archon_user_preferences CASCADE;
-- =============================================================================

-- =============================================================================
-- TABLE: archon_user_preferences
-- =============================================================================

CREATE TABLE archon_user_preferences (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User association
    user_id UUID NOT NULL REFERENCES archon_users(id) ON DELETE CASCADE,

    -- Preference key-value
    preference_key VARCHAR(255) NOT NULL,
    preference_value TEXT,

    -- Metadata
    category VARCHAR(100) DEFAULT 'features',
    description TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_user_preference UNIQUE (user_id, preference_key)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_user_preferences_user_id ON archon_user_preferences(user_id);
CREATE INDEX idx_user_preferences_category ON archon_user_preferences(category);
CREATE INDEX idx_user_preferences_key ON archon_user_preferences(preference_key);
CREATE INDEX idx_user_preferences_user_category ON archon_user_preferences(user_id, category);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_user_preferences_timestamp
    BEFORE UPDATE ON archon_user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE archon_user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can SELECT their own preferences
CREATE POLICY user_preferences_select_own
    ON archon_user_preferences
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can INSERT their own preferences
CREATE POLICY user_preferences_insert_own
    ON archon_user_preferences
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can UPDATE their own preferences
CREATE POLICY user_preferences_update_own
    ON archon_user_preferences
    FOR UPDATE
    USING (user_id = auth.uid());

-- Users can DELETE their own preferences
CREATE POLICY user_preferences_delete_own
    ON archon_user_preferences
    FOR DELETE
    USING (user_id = auth.uid());

-- Service role can access all preferences (admin debugging)
CREATE POLICY user_preferences_admin_all
    ON archon_user_preferences
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- DATA MIGRATION: Populate default preferences for existing users
-- =============================================================================

-- Copy current global feature toggle settings as defaults for all users
INSERT INTO archon_user_preferences (user_id, preference_key, preference_value, category, description)
SELECT
    u.id AS user_id,
    gs.key AS preference_key,
    COALESCE(gs.value, 'false') AS preference_value,
    'features' AS category,
    gs.description
FROM archon_users u
CROSS JOIN (
    SELECT key, value, description
    FROM archon_settings
    WHERE category = 'features'
      AND key IN (
          'PROJECTS_ENABLED',
          'STYLE_GUIDE_ENABLED',
          'AGENT_WORK_ORDERS_ENABLED',
          'LOGFIRE_ENABLED',
          'DISCONNECT_SCREEN_ENABLED',
          'TASKS_ENABLED',
          'KNOWLEDGE_BASE_ENABLED',
          'MCP_SERVER_DASHBOARD_ENABLED',
          'DARK_MODE_ENABLED'
      )
) gs
ON CONFLICT (user_id, preference_key) DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check table created
-- SELECT COUNT(*) FROM archon_user_preferences;

-- Check indexes created
-- SELECT indexname FROM pg_indexes WHERE tablename = 'archon_user_preferences';

-- Check RLS policies
-- SELECT policyname FROM pg_policies WHERE tablename = 'archon_user_preferences';

-- Check default preferences populated
-- SELECT user_id, COUNT(*) as pref_count
-- FROM archon_user_preferences
-- GROUP BY user_id;

-- =============================================================================
-- END OF MIGRATION 034
-- =============================================================================
```

---

**END OF DOCUMENT**

**Next Steps:**
1. Review this requirements document with team
2. Apply migration 033 if not already applied
3. Create and test migration 034
4. Implement backend service changes
5. Update API endpoints with authentication
6. Run test suite
7. Deploy to staging environment
8. Manual testing with multiple users
9. Deploy to production
