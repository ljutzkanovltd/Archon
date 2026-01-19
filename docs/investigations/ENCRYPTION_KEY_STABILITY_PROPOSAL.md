# Encryption Key Stability Proposal

**Date**: 2026-01-16
**Issue**: Credentials become undecryptable when SUPABASE_SERVICE_KEY changes
**Status**: PROPOSAL

## Problem

Current implementation derives encryption key from `SUPABASE_SERVICE_KEY`:

```python
def _get_encryption_key(self) -> bytes:
    service_key = os.getenv("SUPABASE_SERVICE_KEY", "default-key-for-development")
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"static_salt_for_credentials",
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(service_key.encode()))
    return key
```

**Problem**: When `SUPABASE_SERVICE_KEY` changes (mode switch, rotation, etc.), all encrypted credentials become undecryptable.

## Proposed Solution

### Option A: Dedicated ENCRYPTION_KEY Environment Variable (RECOMMENDED)

**Implementation:**

```python
def _get_encryption_key(self) -> bytes:
    # Try dedicated encryption key first
    encryption_key = os.getenv("ARCHON_ENCRYPTION_KEY")

    if encryption_key:
        # Use dedicated key (stable across modes)
        if len(encryption_key) != 44:  # Fernet key must be 32 bytes base64-encoded = 44 chars
            raise ValueError("ARCHON_ENCRYPTION_KEY must be 44 characters (32 bytes base64)")
        return encryption_key.encode()

    # Fallback to Supabase key for backward compatibility
    service_key = os.getenv("SUPABASE_SERVICE_KEY", "default-key-for-development")
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"static_salt_for_credentials",
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(service_key.encode()))
    return key
```

**Setup Steps:**

1. Generate stable encryption key:
   ```bash
   python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

2. Add to `.env`:
   ```bash
   # Encryption key for credentials (stable across Supabase modes)
   # CRITICAL: Back this up! If lost, encrypted credentials are unrecoverable.
   ARCHON_ENCRYPTION_KEY=<generated-key-here>
   ```

3. Add to `docker-compose.yml`:
   ```yaml
   services:
     archon-server:
       environment:
         - ARCHON_ENCRYPTION_KEY=${ARCHON_ENCRYPTION_KEY}
   ```

**Pros:**
- ✅ Stable encryption key regardless of Supabase mode
- ✅ Credentials survive mode switches
- ✅ Backward compatible (falls back to old method)
- ✅ Industry standard practice

**Cons:**
- ⚠️ Requires careful key backup (if lost, credentials unrecoverable)
- ⚠️ Need to document backup procedures

---

### Option B: Per-Mode Encryption Keys

Store separate encrypted credentials for local vs remote modes.

**Pros:**
- ✅ No breaking changes
- ✅ Mode-specific security

**Cons:**
- ❌ Need to configure credentials twice (local + remote)
- ❌ More complex
- ❌ Doesn't solve key rotation issue

---

### Option C: Key Migration Tool

Build tool to re-encrypt credentials when key changes.

**Pros:**
- ✅ Can recover from key changes
- ✅ Supports key rotation

**Cons:**
- ❌ Requires old key to be available
- ❌ Complex implementation
- ❌ Doesn't prevent the problem

---

## Recommendation

**Implement Option A (Dedicated ENCRYPTION_KEY)** immediately:

1. It's the industry standard approach
2. Prevents future credential loss
3. Simple to implement and maintain
4. Backward compatible

**Implementation Priority:** HIGH
**Estimated Effort:** 30 minutes
**Risk:** LOW (has fallback to current method)

## Migration Plan for Existing Users

1. **Add ARCHON_ENCRYPTION_KEY support** (code changes)
2. **Document the issue** (this document)
3. **Provide migration instructions**:
   - Generate new encryption key
   - Add to `.env`
   - Restart services
   - Reconfigure credentials via Settings UI
   - Verify credentials decrypt correctly

## Testing Requirements

Before deploying:

1. ✅ Test encryption with dedicated key
2. ✅ Test decryption with dedicated key
3. ✅ Test fallback to SUPABASE_SERVICE_KEY (backward compat)
4. ✅ Test container restart preserves decryption
5. ✅ Test mode switch (local ↔ remote) doesn't break decryption

## Documentation Updates Required

1. **README.md**: Add ARCHON_ENCRYPTION_KEY setup instructions
2. **.env.example**: Add ARCHON_ENCRYPTION_KEY with example
3. **SYSTEM_SETUP.md**: Add encryption key generation steps
4. **FAQ**: Add "Why can't my credentials be decrypted?"

---

**Status**: Ready for implementation
**Assignee**: backend-api-expert
**Next Step**: Create PR with Option A implementation
