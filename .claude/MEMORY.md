# Archon Development Memory

**Purpose**: Long-term memory and guidelines for AI assistants working on Archon
**Last Updated**: December 15, 2025

---

## Documentation Guidelines

### Primary Rule: All Documentation Goes in `/docs`

**CRITICAL**: When creating documentation for Archon:

1. **Location**: ALWAYS create documentation files in `/home/ljutzkanov/Documents/Projects/archon/docs/`
   - ❌ NOT in project root
   - ❌ NOT in `.claude/` directory
   - ❌ NOT in subdirectories unless specifically structured
   - ✅ ALWAYS in `/docs/` folder

2. **File Naming Conventions**:
   - Use UPPERCASE for major documentation: `AZURE_OPENAI_CONFIGURATION.md`, `TROUBLESHOOTING.md`
   - Use descriptive, specific names: `AZURE_OPENAI_SETTINGS_PERSISTENCE_FIX.md` (not just `FIX.md`)
   - Include version info in document header, not filename

3. **Document Structure**:
   - Always include document version, last updated date, author
   - Use clear table of contents for documents > 200 lines
   - Include "Related Documents" section linking to other relevant docs
   - End with changelog section tracking major updates

4. **Types of Documentation**:
   - **Configuration Guides**: How to set up features (e.g., `AZURE_OPENAI_CONFIGURATION.md`)
   - **Fix Documentation**: Detailed problem/solution/testing (e.g., `AZURE_OPENAI_SETTINGS_PERSISTENCE_FIX.md`)
   - **Architecture**: System design and patterns (e.g., `ARCHITECTURE.md`)
   - **Troubleshooting**: Common issues and solutions (e.g., `TROUBLESHOOTING_STARTUP_FIXES.md`)
   - **Feature Guides**: User-facing feature documentation (e.g., `FEATURES_AND_USAGE.md`)

5. **Cross-Referencing**:
   - Link related documents: `See also: [Azure OpenAI Configuration](./AZURE_OPENAI_CONFIGURATION.md)`
   - Reference code locations: `` `credentialsService.ts:214-220` ``
   - Include file paths for implementation: `python/src/server/api_routes/knowledge_api.py`

6. **Testing Sections**:
   - All fix documentation MUST include comprehensive testing guide
   - Provide step-by-step test procedures
   - Include expected outputs and success criteria
   - Add troubleshooting section for common test failures

### Documentation Updates

When implementing fixes or new features:

1. **During Development**:
   - Document the issue/requirement clearly
   - Track root cause analysis
   - Note all files modified with line numbers

2. **After Implementation**:
   - Create or update documentation in `/docs`
   - Include before/after code snippets
   - Provide comprehensive testing guide
   - Link to related documentation

3. **PR/Commit Process**:
   - Include documentation path in commit message
   - Reference documentation file in PR description
   - Update changelog section in the document

---

## Recent Fixes and Patterns

### Flowbite Button Purple Color Fix (Jan 26, 2026) - CORRECTED

**Problem**: "Link from Global KB" button crashes with "Element type is invalid: expected a string... but got: undefined"

**Root Cause**:
1. TypeScript errors in LinkFromGlobalKBModal (toast.warning, Set<string> type inference)
2. **CRITICAL ERROR**: Mixing `color="info"` with custom purple `className` causes Flowbite Button to fail
3. **DISCOVERY**: `color="purple"` IS SUPPORTED in Flowbite React v0.12.13+!

**Fix Journey** (3 iterations):
1. ❌ First attempt: Used `color="info"` + custom className → Still crashed
2. ❌ Second attempt: Removed `color` prop entirely → Crashed worse (no theme initialization)
3. ✅ **Final solution**: Used `color="purple"` (built-in, fully supported)

**Corrected Files**:
- `LinkFromGlobalKBModal.tsx:362-366` - Changed to `color="purple"` (2 buttons)
- `LinkFromGlobalKBModal.tsx:384-387` - Changed to `color="purple"` (modal footer)
- `ProjectDocumentsTab.tsx:261-265` - Changed to `color="purple"` (trigger button)
- Fixed TypeScript errors: toast.warning → toast.error, explicit Set<string>

**Documentation**:
- `.claude/docs/UI_DESIGN_SYSTEM.md` - Updated with CORRECT purple pattern
- Research doc: `docs/research/flowbite-button-purple-research.md`
- Linked to CLAUDE.md and MEMORY.md

**CRITICAL LEARNING**:
```tsx
// ✅ CORRECT - Purple is built-in!
<Button color="purple" onClick={handleClick}>
  Purple Button
</Button>

// ❌ WRONG - Causes "Element type is invalid" error
<Button className="bg-purple-600 hover:bg-purple-700">
  Broken Button
</Button>

// ❌ WRONG - Mixing color with custom className breaks component
<Button color="info" className="bg-purple-600">
  Broken Button
</Button>
```

**Why Broken Patterns Fail**:
- Flowbite Button REQUIRES `color` prop to initialize internal theme
- Without `color`, theme resolver accesses `theme.button.color[undefined]` → returns `undefined`
- React receives `undefined` component type → "Element type is invalid" error

**Available Colors**: blue, purple, pink, gray, green, red, cyan, yellow, dark, light, indigo, lime, teal, alternative

### Azure OpenAI Settings Persistence (Dec 15, 2025)

**Problem**: Configuration fields not persisting across page reloads
**Root Cause**: Missing fields in default object for three-part persistence system
**Fix**: Added 6 Azure fields to `credentialsService.ts:214-220` default object
**Documentation**: `/docs/AZURE_OPENAI_SETTINGS_PERSISTENCE_FIX.md`

**Key Learning**: Three-part frontend persistence requires:
1. TypeScript interface definition
2. String whitelist for loading
3. **Default object initialization** ← CRITICAL for `if (key in settings)` check

### Azure OpenAI Recrawl Validation (Dec 15, 2025)

**Problem**: Knowledge item refresh failed with "Invalid provider name" for Azure OpenAI
**Root Cause**: Hardcoded validation list missing "azure-openai"
**Fix**: Added "azure-openai" to `knowledge_api.py:72` allowed_providers set
**Documentation**: `/docs/AZURE_OPENAI_SETTINGS_PERSISTENCE_FIX.md` (combined doc)

**Key Learning**: When adding new providers, search ALL validation lists:
```bash
git grep "allowed_providers\|provider.*set\|provider.*list"
```

### Provider Addition Checklist

When adding new LLM providers, update:

**Frontend**:
- [ ] TypeScript interface (`credentialsService.ts`)
- [ ] Default object with ALL fields (`credentialsService.ts:214-220`)
- [ ] String whitelist (`credentialsService.ts:247-254`)
- [ ] UI components (`RAGSettings.tsx`)

**Backend**:
- [ ] Validation lists (`knowledge_api.py:72` and others)
- [ ] Credential service mappings (`credential_service.py`)
- [ ] LLM provider service (`llm_provider_service.py`)
- [ ] Embedding service (`embedding_service.py`)

**Database**:
- [ ] Migration SQL file
- [ ] Verify settings created

**Testing**:
- [ ] Settings persistence (save → reload → verify)
- [ ] Initial crawl
- [ ] Recrawl/refresh
- [ ] API tests

**Documentation**:
- [ ] Create or update provider configuration guide in `/docs`
- [ ] Update fix documentation if issues found
- [ ] Add testing guide

---

## Code Patterns to Remember

### Frontend: Flowbite UI Component Pattern

**Location**: All frontend components
**Documentation**: `.claude/docs/UI_DESIGN_SYSTEM.md`

**Key Rules**:
1. **Use Flowbite React components** (Button, Badge, Modal, etc.) - NEVER use native HTML elements for UI components
2. **Supported colors ONLY**: blue, gray, success, failure, info, warning, dark, light, alternative
3. **For custom colors** (purple, pink, etc.): Use base color + className override

**Purple Button Pattern**:
```tsx
import { Button } from "flowbite-react";

// ✅ CORRECT - Use built-in purple color
<Button
  color="purple"  // Built-in support in Flowbite React v0.12.13+
  onClick={handleClick}
  size="sm"
>
  <HiIcon className="mr-2 h-4 w-4" />
  Button Text
</Button>

// ❌ WRONG - Never omit color prop
<Button className="bg-purple-600" onClick={handleClick}>
  Broken Button (causes "Element type is invalid" error)
</Button>
```

**Toast Notification Pattern**:
```tsx
import toast from "react-hot-toast";

// ✅ CORRECT
toast.success("Success message");
toast.error("Error message");
toast.error("Warning message", { icon: '⚠️', duration: 5000 });

// ❌ WRONG - toast.warning doesn't exist
toast.warning("Warning message");
```

**Dark Mode Support**:
```tsx
// ALWAYS include dark mode variants
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
```

### Frontend: Settings Persistence Pattern

**Location**: `archon-ui-main/src/services/credentialsService.ts`

The three-part system for settings persistence:

```typescript
// 1. Interface - Type definition (lines 27-34)
export interface RagSettings {
  SETTING_NAME?: string;
}

// 2. String Whitelist - Loading filter (lines 247-254)
if ([
  "SETTING_NAME",
  // ... other settings
].includes(cred.key)) {
  (settings as any)[cred.key] = cred.value || "";
}

// 3. Default Object - Initialization (lines 214-220)
const settings: RagSettings = {
  SETTING_NAME: "",  // ← MUST be here for persistence!
  // ... other defaults
};

// Critical check at line 234
if (cred.key in settings) {  // ← Requires field in defaults
  // Load from database
}
```

**Rule**: ALL new settings MUST be in all three places.

### Backend: Provider Validation Pattern

**Location**: `python/src/server/api_routes/knowledge_api.py:72`

```python
# Centralized validation list
allowed_providers = {
    "openai",
    "azure-openai",
    "google",
    "anthropic",
    "grok",
    "openrouter",
    "ollama"
}

if provider not in allowed_providers:
    raise HTTPException(status_code=400, detail={
        "error": "Invalid provider name",
        "message": f"Provider '{provider}' not supported",
        "error_type": "validation_error"
    })
```

**Rule**: Search for similar validation lists when adding providers: `git grep "allowed_providers"`

---

## Testing Patterns

### Settings Persistence Test Pattern

1. **Clear existing configuration** (database)
2. **Configure via UI** (save settings)
3. **Verify database storage** (SQL query)
4. **Hard reload browser** (Ctrl+F5)
5. **Check console logs** (load messages)
6. **Verify fields populated** (UI inspection)
7. **Full browser restart** (close/reopen)
8. **Re-verify fields** (should still be populated)

**Success Criteria**: Fields persist across all reload types

### Recrawl/Refresh Test Pattern

1. **Create knowledge source** (initial crawl)
2. **Verify initial success** (chunks created)
3. **Trigger refresh** (click refresh button)
4. **Monitor console** (check for errors)
5. **Verify recrawl completes** (status updates)
6. **Check embeddings generated** (SQL query)
7. **Review backend logs** (no exceptions)

**Success Criteria**: Refresh completes without "Invalid provider name" error

---

## Known Issues and Workarounds

### None Currently

All documented issues have been resolved as of December 15, 2025.

---

## Future Improvements

### Centralized Provider Configuration

**Problem**: Provider lists scattered across codebase
**Proposed Solution**: Create `python/src/server/config/providers.py` with provider enum

**Benefits**:
- Single source of truth
- Type-safe provider references
- Easier to add new providers
- Impossible to forget validation lists

**Implementation**: See `/docs/AZURE_OPENAI_SETTINGS_PERSISTENCE_FIX.md` Prevention Guidelines section

### Integration Tests for Settings Persistence

**Current State**: Manual testing only
**Proposed**: Automated tests for:
- Settings save/load cycle
- Provider configuration persistence
- Knowledge item refresh with all providers

---

## Contributing Notes

### When Working on Archon

1. **Before implementing**: Search `/docs` for related documentation
2. **During implementation**: Track files modified and line numbers
3. **After implementation**: Create/update documentation in `/docs`
4. **Before committing**: Run linters and tests
5. **In PR**: Reference documentation file created/updated

### Documentation Workflow

```
Fix Implemented
     ↓
Comprehensive Testing
     ↓
Create Documentation in /docs
     ↓
Cross-Reference Related Docs
     ↓
Commit with Doc Reference
     ↓
Update This Memory File
```

---

**End of Memory File**
