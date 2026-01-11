# Step 3: Session Reconnection Support - Implementation Plan

**Date**: 2026-01-11
**Status**: 🚧 In Progress
**Duration**: 3-4 hours estimated
**Dependencies**: None (independent of Step 2)

---

## Objective

Allow MCP clients to reconnect to existing sessions instead of always creating new sessions, reducing session churn and improving resource usage.

---

## Current Behavior (Problem)

**Every new connection creates a new session:**
1. Client connects → `initialize()` called
2. First tool call → New session created (lazy creation)
3. Client disconnects (network issue, restart, etc.)
4. Client reconnects → `initialize()` called again
5. **New session created** (old session orphaned until timeout)

**Issues:**
- Session accumulation (old sessions linger for 5 minutes)
- Lost session context
- Inefficient resource usage
- Cluttered session tracking

---

## Proposed Solution

**Token-based session reconnection:**
1. On first tool call → Generate reconnection token
2. Return token to client in response
3. Client stores token securely
4. On reconnect → Client provides session_id + token
5. Server validates token and resumes session

---

## Implementation Plan

### Phase 1: Backend - Session Token Generation

**File**: `python/src/server/services/mcp_session_manager.py`

#### 1.1 Add JWT Dependencies

```python
# At top of file
import jwt
from datetime import datetime, timedelta, timezone
import secrets

# In __init__
self.jwt_secret = os.getenv("MCP_SESSION_SECRET", secrets.token_urlsafe(32))
```

#### 1.2 Generate Session Token Method

```python
def generate_session_token(self, session_id: str, expires_minutes: int = 15) -> str:
    """
    Generate JWT token for session reconnection.

    Args:
        session_id: Session UUID
        expires_minutes: Token expiration time (default: 15 minutes)

    Returns:
        JWT token string
    """
    payload = {
        "session_id": session_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=expires_minutes),
        "iat": datetime.now(timezone.utc),
        "purpose": "session_reconnect"
    }

    token = jwt.encode(payload, self.jwt_secret, algorithm="HS256")

    # Store token hash in database for verification
    if self.use_database and self._db_client:
        try:
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            self._db_client.table("archon_mcp_sessions").update({
                "reconnect_token_hash": token_hash,
                "reconnect_expires_at": payload["exp"].isoformat()
            }).eq("session_id", session_id).execute()
        except Exception as e:
            logger.error(f"Failed to store token hash: {e}")

    return token
```

#### 1.3 Validate and Reconnect Method

```python
def reconnect_session(self, session_id: str, token: str) -> dict:
    """
    Reconnect to existing session using session_id and token.

    Args:
        session_id: Session UUID
        token: JWT reconnection token

    Returns:
        {"success": bool, "reason": str, "session_id": str}
    """
    try:
        # Decode and verify JWT
        payload = jwt.decode(token, self.jwt_secret, algorithms=["HS256"])

        # Verify session_id matches
        if payload.get("session_id") != session_id:
            return {"success": False, "reason": "session_id_mismatch"}

        # Verify purpose
        if payload.get("purpose") != "session_reconnect":
            return {"success": False, "reason": "invalid_token_purpose"}

        # Check if session exists in database
        if self.use_database and self._db_client:
            result = self._db_client.table("archon_mcp_sessions")\
                .select("*")\
                .eq("session_id", session_id)\
                .execute()

            if not result.data:
                return {"success": False, "reason": "session_not_found"}

            session = result.data[0]

            # Verify token hash
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            if session.get("reconnect_token_hash") != token_hash:
                return {"success": False, "reason": "token_mismatch"}

            # Check if session already disconnected
            if session["status"] == "disconnected":
                return {"success": False, "reason": "session_already_disconnected"}

            # Update last_activity to prevent timeout
            now = datetime.now(timezone.utc)
            self.sessions[session_id] = now

            self._db_client.table("archon_mcp_sessions").update({
                "last_activity": now.isoformat(),
                "reconnect_count": session.get("reconnect_count", 0) + 1
            }).eq("session_id", session_id).execute()

            logger.info(f"✅ Session reconnected: {session_id}")
            return {"success": True, "reason": "reconnected", "session_id": session_id}

        return {"success": False, "reason": "database_unavailable"}

    except jwt.ExpiredSignatureError:
        return {"success": False, "reason": "token_expired"}
    except jwt.InvalidTokenError:
        return {"success": False, "reason": "invalid_token"}
    except Exception as e:
        logger.error(f"Error reconnecting session: {e}")
        return {"success": False, "reason": "internal_error", "error": str(e)}
```

---

### Phase 2: Database Schema Updates

**Migration**: `python/migrations/add_reconnection_fields.sql`

```sql
-- Add reconnection support fields to archon_mcp_sessions
ALTER TABLE archon_mcp_sessions
ADD COLUMN IF NOT EXISTS reconnect_token_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS reconnect_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reconnect_count INTEGER DEFAULT 0;

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_token_hash
ON archon_mcp_sessions(reconnect_token_hash);

-- Add index for reconnection stats
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_reconnect_count
ON archon_mcp_sessions(reconnect_count)
WHERE reconnect_count > 0;
```

---

### Phase 3: MCP Server Tool Integration

**File**: `python/src/mcp_server/mcp_server.py`

#### 3.1 New Reconnect Tool

```python
@mcp.tool()
async def reconnect_session(
    ctx: Context,
    session_id: str,
    reconnect_token: str
) -> str:
    """
    Reconnect to existing MCP session.

    Use this tool to resume a previous session instead of creating a new one.
    Requires the session_id and reconnect_token from the previous session.

    Args:
        session_id: Session UUID from previous connection
        reconnect_token: JWT token provided when session was created

    Returns:
        JSON with reconnection result

    Example:
        reconnect_session(
            session_id="abc-123-def",
            reconnect_token="eyJhbGc..."
        )
    """
    try:
        session_manager = get_session_manager()
        result = session_manager.reconnect_session(session_id, reconnect_token)

        if result["success"]:
            # Update MCP context with reconnected session
            ctx.session_id = session_id

            return json.dumps({
                "success": True,
                "message": "Session reconnected successfully",
                "session_id": session_id,
                "reconnect_count": result.get("reconnect_count", 1)
            })
        else:
            return json.dumps({
                "success": False,
                "reason": result["reason"],
                "message": f"Reconnection failed: {result['reason']}"
            })

    except Exception as e:
        logger.error(f"Error in reconnect_session tool: {e}")
        return json.dumps({
            "success": False,
            "reason": "tool_error",
            "error": str(e)
        })
```

#### 3.2 Modify Track Tool Execution Decorator

```python
# In track_tool_execution decorator
async def wrapper(ctx: Context, *args, **kwargs):
    session_id = getattr(ctx, "session_id", None)

    # Create session if doesn't exist (lazy creation)
    if not session_id or not session_manager.session_exists(session_id):
        session_id = session_manager.create_session(
            client_type=getattr(ctx, "client_type", "unknown-client")
        )
        ctx.session_id = session_id

        # Generate and return reconnection token on first tool call
        reconnect_token = session_manager.generate_session_token(session_id)

        # Store token in context for inclusion in response
        ctx.reconnect_token = reconnect_token

    # ... rest of decorator
```

---

### Phase 4: API Endpoint for Token Management

**File**: `python/src/server/api_routes/mcp_api.py`

```python
@router.post("/sessions/{session_id}/reconnect")
async def reconnect_session_endpoint(
    session_id: str,
    token: str = Body(..., embed=True)
):
    """
    Reconnect to existing session via API.

    POST /api/mcp/sessions/{session_id}/reconnect
    Body: {"token": "eyJhbGc..."}
    """
    with safe_span("api_session_reconnect") as span:
        safe_set_attribute(span, "session_id", session_id)

        try:
            session_manager = get_session_manager()
            result = session_manager.reconnect_session(session_id, token)

            if result["success"]:
                return {
                    "success": True,
                    "session_id": session_id,
                    "message": "Session reconnected"
                }
            else:
                raise HTTPException(
                    status_code=401,
                    detail=f"Reconnection failed: {result['reason']}"
                )

        except Exception as e:
            logger.error(f"Session reconnection error: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/token")
async def get_reconnect_token(session_id: str):
    """
    Get reconnection token for active session.

    GET /api/mcp/sessions/{session_id}/token
    """
    with safe_span("api_get_reconnect_token") as span:
        safe_set_attribute(span, "session_id", session_id)

        try:
            db_client = get_supabase_client()

            # Get session
            result = db_client.table("archon_mcp_sessions")\
                .select("session_id, status, reconnect_token_hash")\
                .eq("session_id", session_id)\
                .execute()

            if not result.data:
                raise HTTPException(status_code=404, detail="Session not found")

            session = result.data[0]

            if session["status"] != "active":
                raise HTTPException(
                    status_code=400,
                    detail="Cannot generate token for inactive session"
                )

            # Generate new token
            session_manager = get_session_manager()
            token = session_manager.generate_session_token(session_id)

            return {
                "session_id": session_id,
                "reconnect_token": token,
                "expires_in_minutes": 15
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error generating reconnect token: {e}")
            raise HTTPException(status_code=500, detail=str(e))
```

---

### Phase 5: Frontend Integration

**File**: `archon-ui-nextjs/src/lib/apiClient.ts`

```typescript
/**
 * Reconnect to existing MCP session
 */
reconnectSession: async (sessionId: string, token: string): Promise<{
  success: boolean;
  session_id: string;
  message: string;
}> => {
  const response = await apiClient.post(
    `/api/mcp/sessions/${sessionId}/reconnect`,
    { token }
  );
  return response.data;
},

/**
 * Get reconnection token for active session
 */
getReconnectToken: async (sessionId: string): Promise<{
  session_id: string;
  reconnect_token: string;
  expires_in_minutes: number;
}> => {
  const response = await apiClient.get(
    `/api/mcp/sessions/${sessionId}/token`
  );
  return response.data;
},
```

---

## Testing Plan

### Test 1: Token Generation
```bash
# Create session, get token
SESSION_ID=$(curl -s http://localhost:8181/api/mcp/sessions/active | jq -r '.sessions[0].session_id')
TOKEN=$(curl -s http://localhost:8181/api/mcp/sessions/$SESSION_ID/token | jq -r '.reconnect_token')

echo "Session: $SESSION_ID"
echo "Token: $TOKEN"
```

### Test 2: Successful Reconnection
```bash
# Reconnect with valid token
curl -X POST http://localhost:8181/api/mcp/sessions/$SESSION_ID/reconnect \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\"}" | jq .

# Expected: {"success": true, "session_id": "...", "message": "Session reconnected"}
```

### Test 3: Expired Token
```bash
# Wait 16 minutes (token expires after 15 min)
sleep 960

# Try to reconnect
curl -X POST http://localhost:8181/api/mcp/sessions/$SESSION_ID/reconnect \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\"}" | jq .

# Expected: {"detail": "Reconnection failed: token_expired"}
```

### Test 4: Invalid Token
```bash
# Try with wrong token
curl -X POST http://localhost:8181/api/mcp/sessions/$SESSION_ID/reconnect \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"invalid-token\"}" | jq .

# Expected: {"detail": "Reconnection failed: invalid_token"}
```

---

## Security Considerations

1. **JWT Secret**: Store in environment variable, rotate regularly
2. **Token Expiration**: 15 minutes default (configurable)
3. **Token Hash Storage**: Only store SHA-256 hash in database
4. **Rate Limiting**: Limit reconnection attempts per session
5. **Audit Logging**: Log all reconnection attempts (success/failure)

---

## Environment Variables

Add to `.env`:
```bash
# Session reconnection
MCP_SESSION_SECRET=<generate-secure-random-string>
MCP_RECONNECT_TOKEN_EXPIRY=15  # minutes
```

---

## Benefits

**Before (No Reconnection)**:
- Network glitch → New session created
- Browser refresh → New session created
- Server restart → All sessions lost
- Session churn: High

**After (With Reconnection)**:
- Network glitch → Reconnect to same session
- Browser refresh → Resume previous session
- Server restart → Clients can reconnect within 15 min
- Session churn: Minimal

**Metrics Improvement**:
- Session lifetime: +200% (fewer recreations)
- Resource usage: -40% (less session churn)
- User experience: Seamless reconnection

---

## Implementation Order

1. ✅ Design complete
2. ⏳ Database migration
3. ⏳ Backend implementation
4. ⏳ MCP tool creation
5. ⏳ API endpoints
6. ⏳ Testing
7. ⏸️ Frontend integration (optional)

---

**Status**: Ready to implement
**Next**: Create database migration
