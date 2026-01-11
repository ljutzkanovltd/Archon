# MCP Session Management - Executive Summary

**Task**: Research MCP Session Management Architecture
**Agent**: codebase-analyst
**Status**: Complete - Ready for Implementation
**Date**: 2026-01-10

---

## 🎯 Problem Statement

MCP clients are receiving **HTTP 400: "Bad Request: No valid session ID provided"** errors because:

1. **Archon creates a global session** in `mcp_server.py` lifespan (lines 175-180)
2. This session is stored in **SimplifiedSessionManager** and **Supabase database**
3. But it's **NOT registered** in FastMCP's **StreamableHTTPSessionManager._server_instances**
4. When MCP client sends request with that session ID, **FastMCP rejects it**

---

## 🔍 Root Cause

**Two independent session management systems with zero integration:**

```
FastMCP StreamableHTTPSessionManager     Archon SimplifiedSessionManager
    (_server_instances dict)                 (self.sessions dict)
           |                                          |
           |                                          |
    ❌ NO CONNECTION ❌                              |
           |                                          |
    Validates session IDs                   Stores session IDs
    Returns HTTP 400 if not found           + Supabase persistence
```

**Why pre-creating sessions doesn't work:**
- FastMCP expects sessions to be created **during HTTP request processing**
- FastMCP has **no public API** to register external sessions
- `_server_instances` is a **private attribute** (accessing it = architectural hack)

---

## 💡 Recommended Solution: **Option A - Remove Global Session Creation**

### What to Do

**DELETE** global session creation and let FastMCP handle session lifecycle:

1. Remove lines 175-180 from `mcp_server.py` (lifespan function)
2. Remove lines 657-672 from `mcp_server.py` (main function)
3. Remove lines 692-701 from `mcp_server.py` (cleanup logic)
4. Update `@track_tool_execution` decorator to create Archon session **on first tool call**

### How It Works

```
┌─ Server Startup ───────────────────────────┐
│ 1. FastMCP starts                          │
│ 2. No session creation                     │
│ 3. Server ready                            │
└────────────────────────────────────────────┘

┌─ First MCP Client Request ────────────────┐
│ 1. Client connects (no session ID)        │
│ 2. FastMCP creates session automatically  │
│ 3. @track_tool_execution decorator runs   │
│ 4. Archon session created for tracking    │
│ 5. Session ID stored in context           │
│ 6. Request tracked in database            │
└────────────────────────────────────────────┘

┌─ Subsequent Requests ──────────────────────┐
│ 1. Client includes FastMCP session ID      │
│ 2. FastMCP validates successfully          │
│ 3. Archon uses existing session           │
│ 4. Request tracked with same session ID    │
└────────────────────────────────────────────┘
```

### Why This Works

✅ **Aligns with FastMCP design** - Works with the framework, not against it
✅ **Simple** - Delete code instead of adding complexity
✅ **Maintainable** - No private API access or hacks
✅ **Future-proof** - Won't break with FastMCP updates
✅ **Clean separation** - Archon tracks, FastMCP manages protocol

---

## ❌ Why Not Other Options?

### Option B: Stateless Mode
- ❌ New session per request = database bloat
- ❌ No session context = poor analytics
- ❌ Multi-user migration becomes harder

### Option C: Bridge Systems (Register Global Session)
- ❌ **EXTREMELY FRAGILE** - relies on private `_server_instances` attribute
- ❌ **WILL BREAK** with FastMCP updates
- ❌ Requires mocking MCP protocol objects
- ❌ Violates encapsulation
- ❌ Not recommended by FastMCP maintainers

---

## 📋 Implementation Summary

### Phase 1: Code Changes (1 hour)
Remove global session creation from 3 locations in `mcp_server.py`

### Phase 2: Decorator Update (1 hour)
Modify `@track_tool_execution` to create session on first tool call

### Phase 3: Context Update (30 min)
Update `ArchonContext` dataclass to reflect new lifecycle

### Phase 4: Testing (2 hours)
Verify session creation, request tracking, and dashboard functionality

### Phase 5: Documentation (1 hour)
Update guides and architecture docs

**Total Time**: ~5.5 hours

---

## ✅ Success Criteria

Implementation succeeds when:

1. ✅ No HTTP 400 errors from MCP clients
2. ✅ Sessions created on first tool call (verified in logs)
3. ✅ Requests tracked in database with session ID
4. ✅ Dashboard displays session info after first activity
5. ✅ Multiple tool calls use same session
6. ✅ All MCP tools functional (RAG, tasks, projects, documents)
7. ✅ Clean shutdown with session cleanup

---

## 📊 Impact Assessment

| Aspect | Impact | Notes |
|--------|--------|-------|
| **Breaking Changes** | None | Transparent to MCP clients |
| **Database Schema** | None | Archon tables unchanged |
| **API Compatibility** | None | Same MCP tools available |
| **Dashboard** | Minor | Session appears after first tool call (not startup) |
| **Multi-User Migration** | Easier | Session-per-connection pattern already established |
| **Code Complexity** | Reduced | Deleted ~30 lines of problematic code |

---

## 🔗 References

**Full Analysis**: `/docs/MCP_SESSION_LIFECYCLE_ANALYSIS.md` (26KB, comprehensive)

**Key Files**:
- `/python/src/mcp_server/mcp_server.py` - Main MCP server
- `/python/src/mcp_server/utils/session_tracking.py` - Session decorator
- `/python/src/server/services/mcp_session_manager.py` - Session manager

**GitHub Issues**:
- [FastMCP #480](https://github.com/jlowin/fastmcp/issues/480) - Session manager access
- [MCP SDK #1180](https://github.com/modelcontextprotocol/python-sdk/issues/1180) - Streamable HTTP sessions
- [MCP SDK #880](https://github.com/modelcontextprotocol/python-sdk/issues/880) - Horizontal scaling

---

## 🚀 Next Steps

1. **Review this analysis** with planner agent
2. **Create implementation tasks** (5 phases above)
3. **Assign to implementation expert** (backend-api-expert)
4. **Test in development** environment
5. **Deploy to production** after verification

---

**Prepared by**: codebase-analyst agent
**For review by**: planner agent
**Task ID**: 2462c8ff-f360-4088-bf38-16bb596b2419
**Project ID**: 52ccc5f6-c416-4965-ac91-fbd7339aa9ff

