# Settings Alignment Analysis
## Original Dashboard vs New Next.js Dashboard

**Date**: December 23, 2025
**Purpose**: Compare original Archon dashboard settings with new Next.js dashboard to ensure feature parity

---

## Executive Summary

The new Next.js dashboard (archon-ui-nextjs) has a **completely different settings structure** from the original React dashboard (archon-ui-main). The new dashboard has generic settings while the original has Archon-specific features and configurations.

### Critical Findings

❌ **Missing Features**: RAG Settings, Code Extraction Settings, Features toggles, Version status, Database Migrations
❌ **Different Structure**: Tab-based vs Card-based layout
❌ **Different Data Models**: Generic settings vs Archon-specific settings
⚠️ **Partial Alignment**: API Keys section exists but may differ in implementation

---

## Original Dashboard Settings Structure

### Layout: Two-Column Card-Based Layout

**File**: `/archon-ui-main/src/pages/SettingsPage.tsx`

#### Left Column

1. **Features Card** (Default Expanded)
   - Icon: Palette
   - Accent: Purple
   - Storage Key: `features`
   - Component: `FeaturesSection`

2. **Version & Updates Card** (Default Expanded)
   - Icon: Info
   - Accent: Blue
   - Storage Key: `version-status`
   - Component: `VersionStatusCard`

3. **Database Migrations Card** (Default Collapsed)
   - Icon: Database
   - Accent: Purple
   - Storage Key: `migration-status`
   - Component: `MigrationStatusCard`

4. **IDE Global Rules Card** (Default Expanded, Conditional)
   - Icon: FileCode
   - Accent: Pink
   - Storage Key: `ide-rules`
   - Component: `IDEGlobalRules`
   - **Condition**: Only shown if `projectsEnabled === true`

#### Right Column

1. **API Keys (Advanced) Card** (Default Collapsed)
   - Icon: Key
   - Accent: Pink
   - Storage Key: `api-keys`
   - Component: `APIKeysSection`
   - **Warning Banner**: "API keys can now be configured directly in RAG Settings"

2. **RAG Settings Card** (Default Expanded)
   - Icon: Brain
   - Accent: Green
   - Storage Key: `rag-settings`
   - Component: `RAGSettings`

3. **Code Extraction Card** (Default Expanded)
   - Icon: Code
   - Accent: Orange
   - Storage Key: `code-extraction`
   - Component: `CodeExtractionSettings`

4. **Bug Reporting Card** (Default Collapsed)
   - Icon: Bug
   - Icon Color: Red
   - Border Color: Red
   - Component: Bug report form

#### Bottom Section

- **Button Playground** (Collapsible toggle)

---

## Original Dashboard Settings Data Models

### 1. Features Section (`FeaturesSection.tsx`)

**Toggles** (6 total):

| Setting | Storage Key | Default | Category | Description | Provider |
|---------|------------|---------|----------|-------------|----------|
| **Dark Mode** | N/A (ThemeContext) | false | UI | Switch between light/dark themes | ThemeContext |
| **Projects** | `PROJECTS_ENABLED` | true | features | Enable Projects and Tasks functionality | credentialsService |
| **Style Guide** | `STYLE_GUIDE_ENABLED` | false | features | Show UI style guide in navigation | credentialsService |
| **Agent Work Orders** | `AGENT_WORK_ORDERS_ENABLED` | false | features | Enable automated development workflows | credentialsService |
| **Pydantic Logfire** | `LOGFIRE_ENABLED` | false | monitoring | Structured logging and observability | credentialsService |
| **Disconnect Screen** | `DISCONNECT_SCREEN_ENABLED` | true | N/A | Show disconnect screen when server disconnects | serverHealthService |

**Features**:
- Grid layout (2 columns)
- Each toggle has icon, title, description
- Color-coded with gradients (purple, blue, cyan, green, orange, green)
- Loads settings on mount from backend
- Saves changes to backend immediately
- Shows toast notifications on changes
- **Projects toggle**: Disabled if projects schema is invalid
- **Projects toggle**: Shows error message if schema check fails

**Special Logic**:
- Projects schema health check: `GET /api/projects/health`
- If schema invalid, disables Projects toggle and shows error

### 2. RAG Settings (`RAGSettings.tsx`)

**Configuration Fields** (6 fields):

| Field | Type | Default | Description | Storage |
|-------|------|---------|-------------|---------|
| `USE_CONTEXTUAL_EMBEDDINGS` | boolean | false | Enable contextual embeddings | Backend |
| `CONTEXTUAL_EMBEDDINGS_MAX_WORKERS` | number | 3 | Max workers for contextual embeddings | Backend |
| `USE_HYBRID_SEARCH` | boolean | true | Enable hybrid search (keyword + semantic) | Backend |
| `USE_AGENTIC_RAG` | boolean | true | Enable agentic RAG workflows | Backend |
| `USE_RERANKING` | boolean | true | Enable result reranking | Backend |
| `MODEL_CHOICE` | string | "gpt-4.1-nano" | LLM model for RAG | Backend |

**Supported Providers** (7 total):
- OpenAI (`openai`)
- Azure OpenAI (`azure-openai`)
- Google (`google`)
- Anthropic (`anthropic`)
- Grok (`grok`)
- OpenRouter (`openrouter`)
- Ollama (`ollama`)

**Provider Configuration**:
- Each provider has: API key, chat model, embedding model
- Embedding models only for: OpenAI, Azure OpenAI, Google, OpenRouter, Ollama
- Provider-specific defaults stored in localStorage
- Color-coded provider cards (green, teal, blue, orange, yellow, cyan, purple)

**API Key Management**:
- Test API key functionality
- Hide/show API keys
- Provider-specific model discovery (Ollama only)
- Provider-specific validation

**Data Source**: `credentialsService.getRagSettings()`
**Save Method**: `credentialsService.updateRagSettings(ragSettings)`

### 3. Code Extraction Settings (`CodeExtractionSettings.tsx`)

**Configuration Fields** (12 fields):

| Field | Type | Default | Min | Max | Description |
|-------|------|---------|-----|-----|-------------|
| `MIN_CODE_BLOCK_LENGTH` | number | 250 | 50 | 2000 | Minimum code block length (chars) |
| `MAX_CODE_BLOCK_LENGTH` | number | 5000 | 1000 | 20000 | Maximum code block length (chars) |
| `ENABLE_COMPLETE_BLOCK_DETECTION` | boolean | true | - | - | Extend blocks to natural boundaries |
| `ENABLE_LANGUAGE_SPECIFIC_PATTERNS` | boolean | true | - | - | Use language-specific patterns |
| `ENABLE_PROSE_FILTERING` | boolean | true | - | - | Filter prose content |
| `MAX_PROSE_RATIO` | number | 0.15 | 0 | 1 | Max percentage of prose (0-1) |
| `MIN_CODE_INDICATORS` | number | 3 | 1 | 10 | Required code patterns |
| `ENABLE_DIAGRAM_FILTERING` | boolean | true | - | - | Exclude diagram formats |
| `ENABLE_CONTEXTUAL_LENGTH` | boolean | true | - | - | Adjust length based on context |
| `CODE_EXTRACTION_MAX_WORKERS` | number | 3 | 1 | 10 | Parallel processing workers |
| `CONTEXT_WINDOW_SIZE` | number | 1000 | 100 | 5000 | Context chars before/after blocks |
| `ENABLE_CODE_SUMMARIES` | boolean | true | - | - | Generate AI summaries |

**Layout**:
- Section 1: Code Block Length (2 number inputs)
- Section 2: Detection Features (3 checkboxes)
- Section 3: Content Filtering (3 checkboxes)
- Section 4: Advanced Settings (4 number inputs in 2x2 grid)
- Save button at top

**Data Source**: `credentialsService.getCodeExtractionSettings()`
**Save Method**: `credentialsService.updateCodeExtractionSettings(settings)`

### 4. Version & Updates (`VersionStatusCard`)

- Shows current version
- Check for updates functionality
- Update notifications

### 5. Database Migrations (`MigrationStatusCard`)

- Shows migration status
- Database schema version
- Migration history

### 6. API Keys Section (`APIKeysSection`)

- API key management for various services
- Create, update, delete API keys
- Key categories and descriptions

### 7. IDE Global Rules (`IDEGlobalRules`)

- Global rules for IDE integration
- Only shown if Projects feature is enabled

---

## New Dashboard Settings Structure

### Layout: Tab-Based Layout

**File**: `/archon-ui-nextjs/src/app/settings/page.tsx`

#### Tabs (6 total)

1. **General Tab** (Default)
   - Icon: HiCog
   - Component: `GeneralSettings`

2. **API Keys Tab**
   - Icon: HiKey
   - Component: `ApiKeySettings`

3. **Crawl Settings Tab**
   - Icon: HiGlobe
   - Component: `CrawlSettings`

4. **Display Tab**
   - Icon: HiEye
   - Component: `DisplaySettings`

5. **MCP Integration Tab**
   - Icon: HiCode
   - Component: `McpSettings`

6. **Notifications Tab**
   - Icon: HiBell
   - Component: `NotificationSettings`

---

## New Dashboard Settings Data Models

### 1. General Settings (`GeneralSettings.tsx`)

**Fields** (5 fields):

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `site_name` | string | "" | Site name |
| `site_url` | string | "" | Site URL |
| `admin_email` | string | "" | Admin email |
| `timezone` | string | "UTC" | Timezone |
| `language` | string | "en" | Language |

**Data Source**: `useSettingsStore().settings.general`
**Save Method**: `updateSettings({ section: "general", data: formData })`

### 2-6. Other Tabs

Not yet analyzed (need to read component files)

---

## Data Flow Comparison

### Original Dashboard

1. **Load Settings**:
   ```typescript
   // On mount
   const ragSettings = await credentialsService.getRagSettings();
   const codeSettings = await credentialsService.getCodeExtractionSettings();

   // Features loaded via SettingsContext
   const { projectsEnabled, styleGuideEnabled, agentWorkOrdersEnabled } = useSettings();
   ```

2. **Save Settings**:
   ```typescript
   // Individual saves
   await credentialsService.updateRagSettings(ragSettings);
   await credentialsService.updateCodeExtractionSettings(codeSettings);
   await credentialsService.createCredential({ key, value, category });
   ```

3. **Data Persistence**:
   - Backend API via `credentialsService`
   - Settings stored in database (Supabase)
   - Some settings in SettingsContext (React Context)
   - Provider models in localStorage

### New Dashboard

1. **Load Settings**:
   ```typescript
   // On mount
   const { settings, fetchSettings } = useSettingsStore();
   useEffect(() => { fetchSettings(); }, [fetchSettings]);
   ```

2. **Save Settings**:
   ```typescript
   await updateSettings({ section: "general", data: formData });
   ```

3. **Data Persistence**:
   - Zustand store (`useSettingsStore`)
   - Backend API integration (needs verification)
   - Settings structure is generic, not Archon-specific

---

## API Endpoints Comparison

### Original Dashboard APIs

**Base URL**: Backend API (port 8181)

| Endpoint | Method | Purpose | Component |
|----------|--------|---------|-----------|
| `/api/credentials` | GET | Get credential by key | Features, RAG, API Keys |
| `/api/credentials` | POST | Create/update credential | Features, RAG, API Keys |
| `/api/rag-settings` | GET | Get RAG settings | RAG Settings |
| `/api/rag-settings` | PUT | Update RAG settings | RAG Settings |
| `/api/code-extraction-settings` | GET | Get code extraction settings | Code Extraction |
| `/api/code-extraction-settings` | PUT | Update code extraction settings | Code Extraction |
| `/api/projects/health` | GET | Check projects schema | Features |
| `/api/server-health/settings` | PUT | Update health settings | Features (disconnect screen) |

### New Dashboard APIs

**Base URL**: Backend API (port 8181)

| Endpoint | Method | Purpose | Component |
|----------|--------|---------|-----------|
| `/api/settings` | GET | Get all settings | General, All tabs |
| `/api/settings` | PATCH | Update settings | General, All tabs |
| `/api/settings/reset` | POST | Reset settings | (Not used yet) |
| `/api/settings/test-api-key` | POST | Test API key | (Not used yet) |

**Note**: The new dashboard uses a generic `/api/settings` endpoint that was created during Phase 5.1. This is different from the original dashboard's specific endpoints.

---

## Gap Analysis

### Missing Features in New Dashboard

1. ❌ **Features Section** - All 6 feature toggles
   - Dark Mode toggle
   - Projects toggle
   - Style Guide toggle
   - Agent Work Orders toggle
   - Logfire toggle
   - Disconnect Screen toggle

2. ❌ **RAG Settings** - Complete RAG configuration
   - 6 RAG configuration fields
   - 7 provider configurations (OpenAI, Azure, Google, Anthropic, Grok, OpenRouter, Ollama)
   - Provider-specific model selection
   - API key management per provider
   - Model discovery for Ollama

3. ❌ **Code Extraction Settings** - All 12 fields
   - Length settings (min/max)
   - Detection features (3 checkboxes)
   - Content filtering (3 checkboxes)
   - Advanced settings (4 number inputs)

4. ❌ **Version & Updates** - Version status card

5. ❌ **Database Migrations** - Migration status card

6. ❌ **IDE Global Rules** - IDE integration rules

7. ❌ **Bug Reporting** - Bug report functionality

### Different Implementations

1. ⚠️ **API Keys Section**
   - Original: Advanced section with provider-specific keys in RAG Settings
   - New: Generic API key management tab
   - **Action**: Need to verify if new implementation matches original functionality

2. ⚠️ **Layout**
   - Original: Two-column card-based with collapsible cards
   - New: Single-column tab-based
   - **Action**: Consider if tab-based layout can accommodate all features

### New Features (Not in Original)

1. ✅ **General Settings**
   - Site name, URL, admin email, timezone, language
   - **Action**: May not be needed if not in original

2. ✅ **Crawl Settings**
   - Crawl configuration
   - **Action**: Verify if this exists in original elsewhere

3. ✅ **Display Settings**
   - Display preferences
   - **Action**: May overlap with Dark Mode toggle

4. ✅ **MCP Integration**
   - MCP settings
   - **Action**: Verify if needed (original has MCP Inspector)

5. ✅ **Notifications**
   - Notification preferences
   - **Action**: Verify if needed

---

## Alignment Strategy

### Phase 1: Core Features Migration (High Priority)

**Goal**: Migrate essential Archon-specific settings from original to new dashboard

#### Task 1.1: Features Section
- [ ] Create `FeaturesTab` component
- [ ] Implement 6 feature toggles with original styling
- [ ] Integrate with backend credentials API
- [ ] Add projects schema health check
- [ ] Test all toggles with backend

#### Task 1.2: RAG Settings Section
- [ ] Create `RagSettingsTab` component
- [ ] Implement 6 RAG configuration fields
- [ ] Implement 7 provider configurations
- [ ] Add provider-specific model selection
- [ ] Add API key management per provider
- [ ] Add Ollama model discovery
- [ ] Integrate with `credentialsService.getRagSettings()`
- [ ] Integrate with `credentialsService.updateRagSettings()`
- [ ] Test with backend API

#### Task 1.3: Code Extraction Settings
- [ ] Create `CodeExtractionTab` component
- [ ] Implement all 12 configuration fields
- [ ] Match original layout (sections)
- [ ] Integrate with `credentialsService.getCodeExtractionSettings()`
- [ ] Integrate with `credentialsService.updateCodeExtractionSettings()`
- [ ] Test with backend API

### Phase 2: Status & Monitoring (Medium Priority)

#### Task 2.1: Version & Updates
- [ ] Create `VersionTab` or card component
- [ ] Implement version status display
- [ ] Add update check functionality
- [ ] Test version detection

#### Task 2.2: Database Migrations
- [ ] Create `MigrationsTab` or card component
- [ ] Implement migration status display
- [ ] Add migration history
- [ ] Test migration status endpoint

### Phase 3: Advanced Features (Lower Priority)

#### Task 3.1: IDE Global Rules
- [ ] Create `IDEGlobalRulesTab` component
- [ ] Implement rules editor
- [ ] Add conditional rendering based on projectsEnabled
- [ ] Test rules functionality

#### Task 3.2: Bug Reporting
- [ ] Create `BugReportTab` or modal component
- [ ] Implement bug report form
- [ ] Integrate with GitHub Issues API
- [ ] Test bug submission

### Phase 4: API Keys Alignment

#### Task 4.1: Verify Current API Keys Implementation
- [ ] Read `ApiKeySettings.tsx` component
- [ ] Compare with original `APIKeysSection.tsx`
- [ ] Identify gaps and differences

#### Task 4.2: Update API Keys Section
- [ ] Align with original functionality
- [ ] Add warning banner about RAG Settings
- [ ] Test API key CRUD operations

### Phase 5: Remove/Refactor New-Only Features

#### Task 5.1: Evaluate New Features
- [ ] General Settings - Determine if needed
- [ ] Crawl Settings - Check if in original
- [ ] Display Settings - May overlap with Dark Mode
- [ ] MCP Integration - Verify necessity (MCP Inspector exists)
- [ ] Notifications - Verify necessity

#### Task 5.2: Remove or Refactor
- [ ] Remove unnecessary tabs
- [ ] Refactor overlapping features
- [ ] Clean up unused code

### Phase 6: Layout Alignment (Optional)

#### Task 6.1: Consider Layout Change
- [ ] Evaluate tab-based vs card-based layout
- [ ] User testing for preferred layout
- [ ] Implementation decision

**Options**:
1. Keep tab-based layout (easier navigation for many settings)
2. Switch to card-based layout (matches original exactly)
3. Hybrid: Tabs with cards inside each tab

---

## Testing Checklist

### Settings Load Tests

- [ ] All settings load correctly from backend
- [ ] Default values applied when no backend data
- [ ] Loading states work correctly
- [ ] Error states display properly

### Settings Save Tests

- [ ] All settings save to backend correctly
- [ ] Toast notifications appear on save
- [ ] Error handling works for failed saves
- [ ] Optimistic updates revert on error

### Feature Toggle Tests

- [ ] Dark Mode toggle works
- [ ] Projects toggle works (with schema check)
- [ ] Style Guide toggle shows/hides menu item
- [ ] Agent Work Orders toggle shows/hides menu item
- [ ] Logfire toggle enables/disables logging
- [ ] Disconnect Screen toggle works

### RAG Settings Tests

- [ ] All 6 RAG fields update correctly
- [ ] Provider selection works
- [ ] Model selection per provider works
- [ ] API key save/test works per provider
- [ ] Ollama model discovery works
- [ ] Settings persist after page reload

### Code Extraction Tests

- [ ] All 12 fields update correctly
- [ ] Number inputs respect min/max
- [ ] Checkboxes toggle correctly
- [ ] Settings save to backend
- [ ] Settings persist after page reload

### API Integration Tests

- [ ] `/api/credentials` GET works
- [ ] `/api/credentials` POST works
- [ ] `/api/rag-settings` GET works
- [ ] `/api/rag-settings` PUT works
- [ ] `/api/code-extraction-settings` GET works
- [ ] `/api/code-extraction-settings` PUT works
- [ ] `/api/projects/health` GET works

---

## Backend API Requirements

### Existing Endpoints (Original Dashboard)

All these endpoints must be available and working:

1. **Credentials API**
   - `GET /api/credentials?key={key}` - Get credential by key
   - `POST /api/credentials` - Create/update credential

2. **RAG Settings API**
   - `GET /api/rag-settings` - Get RAG settings
   - `PUT /api/rag-settings` - Update RAG settings

3. **Code Extraction API**
   - `GET /api/code-extraction-settings` - Get code extraction settings
   - `PUT /api/code-extraction-settings` - Update code extraction settings

4. **Projects Health API**
   - `GET /api/projects/health` - Check projects schema

5. **Server Health API**
   - `PUT /api/server-health/settings` - Update health settings

### New Endpoints (New Dashboard)

Currently implemented in Phase 5.1:

1. **Settings API**
   - `GET /api/settings` - Get all settings
   - `PATCH /api/settings` - Update settings
   - `POST /api/settings/reset` - Reset settings
   - `POST /api/settings/test-api-key` - Test API key

**Action**: Verify these new endpoints can coexist with original endpoints, or refactor to use original endpoints exclusively.

---

## Services Comparison

### Original Dashboard Services

1. **`credentialsService`** (`services/credentialsService.ts`)
   - `getCredential(key)` - Get single credential
   - `createCredential(data)` - Create/update credential
   - `getRagSettings()` - Get RAG settings
   - `updateRagSettings(settings)` - Update RAG settings
   - `getCodeExtractionSettings()` - Get code extraction settings
   - `updateCodeExtractionSettings(settings)` - Update code extraction settings

2. **`serverHealthService`** (`services/serverHealthService.ts`)
   - `updateSettings(disconnectScreenEnabled)` - Update health settings

3. **`SettingsContext`** (`contexts/SettingsContext.tsx`)
   - State: `projectsEnabled`, `styleGuideEnabled`, `agentWorkOrdersEnabled`
   - Actions: `setProjectsEnabled`, `setStyleGuideEnabled`, `setAgentWorkOrdersEnabled`

### New Dashboard Services

1. **`useSettingsStore`** (Zustand store)
   - State: `settings`, `isLoading`, `error`
   - Actions: `fetchSettings`, `updateSettings`, `resetSettings`, `testApiKey`

**Action**: Need to integrate original services or refactor Zustand store to use original API structure.

---

## Context Management

### Original Dashboard

1. **SettingsContext** - Feature toggles
   - `projectsEnabled`
   - `styleGuideEnabled`
   - `agentWorkOrdersEnabled`
   - Persisted to backend via `credentialsService`

2. **ThemeContext** - Dark mode
   - `theme` (light/dark)
   - `setTheme`
   - Persisted to localStorage

### New Dashboard

1. **useSettingsStore** (Zustand) - All settings
   - Generic settings structure
   - No specific context for features

**Action**: Consider creating SettingsContext in new dashboard or extending Zustand store.

---

## Recommendations

### Immediate Actions (High Priority)

1. **Create `credentialsService` in new dashboard**
   - Port from original dashboard
   - Use original API endpoints
   - Ensure compatibility

2. **Create `SettingsContext` in new dashboard**
   - Match original structure
   - Integrate with Zustand store if needed

3. **Implement Features Tab**
   - Highest priority - affects entire app
   - Needed for Projects, Style Guide, Agent Work Orders toggles

4. **Implement RAG Settings Tab**
   - Core Archon functionality
   - Most complex settings section

5. **Implement Code Extraction Tab**
   - Core Archon functionality
   - Relatively straightforward

### Medium-Term Actions

1. **Implement Version & Migrations**
   - Important for monitoring
   - Can be cards or tabs

2. **Align API Keys Section**
   - Verify and align with original

3. **Implement IDE Global Rules**
   - Conditional feature
   - Requires Projects enabled

### Long-Term Actions

1. **Evaluate New Features**
   - Determine if General, Crawl, Display, MCP Integration, Notifications are needed
   - Remove or refactor as appropriate

2. **Layout Decision**
   - User testing
   - Performance considerations
   - Accessibility

---

## Success Criteria

### Feature Parity

- [ ] All 6 feature toggles working
- [ ] RAG Settings fully functional with all 7 providers
- [ ] Code Extraction Settings fully functional
- [ ] Version status displayed correctly
- [ ] Database migrations status displayed correctly
- [ ] API Keys section aligned with original
- [ ] IDE Global Rules working (when Projects enabled)
- [ ] Bug reporting functional

### Data Integrity

- [ ] All settings persist to backend correctly
- [ ] Settings load correctly on page refresh
- [ ] No data loss on setting updates
- [ ] Error handling prevents bad states

### User Experience

- [ ] Loading states clear and responsive
- [ ] Toast notifications informative
- [ ] Error messages helpful
- [ ] Layout intuitive and accessible
- [ ] Dark mode works correctly

### Technical Quality

- [ ] Code follows Next.js 15 patterns
- [ ] TypeScript strict mode compliance
- [ ] No console errors or warnings
- [ ] Performance optimized
- [ ] Accessibility standards met

---

## Next Steps

1. **Read remaining component files** to complete analysis:
   - `ApiKeySettings.tsx`
   - `CrawlSettings.tsx`
   - `DisplaySettings.tsx`
   - `McpSettings.tsx`
   - `NotificationSettings.tsx`

2. **Test current settings functionality** with backend API

3. **Create implementation plan** with estimated effort

4. **Begin Phase 1 implementation** (Features, RAG, Code Extraction)

---

**Status**: Analysis Complete
**Next Action**: Test current implementation and begin alignment work
