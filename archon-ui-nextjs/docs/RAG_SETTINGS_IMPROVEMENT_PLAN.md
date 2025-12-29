# RAG Settings Tab - Improvement Plan

## Executive Summary

This document outlines the comprehensive plan to upgrade the RAG Settings Tab in the Next.js dashboard to achieve full feature parity with the original Archon dashboard, implementing the superior UX/UI pattern for LLM provider configuration.

**Created**: 2025-12-23
**Status**: Design Phase
**Estimated Lines of Code**: ~1,200 lines (RAGSettingsTab.tsx enhanced version)

---

## 🎯 Core Problem Statement

The current Next.js RAG Settings Tab is missing critical functionality:

1. **No Chat vs Embedding Selection** - Cannot independently select providers for chat and embeddings
2. **Missing Azure Configuration** - No Azure OpenAI endpoint/deployment configuration UI
3. **No Provider-Specific Models** - Models reset when switching providers
4. **No Test Connection** - Cannot validate provider credentials
5. **Single Provider Mode** - Forces same provider for both chat and embeddings

**User Requirement**:
> "I need to be able to select chat first, then the provider, then configure Azure settings, and test the connection - exactly like the original dashboard."

---

## 📊 Original Dashboard Architecture Analysis

### Key Features Identified

#### 1. **Dual Selection Mode** (Lines 255, 1788-1816)
```typescript
const [activeSelection, setActiveSelection] = useState<'chat' | 'embedding'>('chat');

// Two-button toggle at the top
<Button>Chat Provider</Button>
<Button>Embedding Provider</Button>
```

**UX Flow**:
- User clicks "Chat Provider" → Shows chat-specific settings
- User clicks "Embedding Provider" → Shows embedding-specific settings
- Each mode has independent provider selection

#### 2. **Independent Provider State** (Lines 248-254)
```typescript
const [chatProvider, setChatProvider] = useState<ProviderKey>('openai');
const [embeddingProvider, setEmbeddingProvider] = useState<ProviderKey>('openai');
```

**Critical**: Chat and Embedding can have **different providers simultaneously**:
- Chat: Azure OpenAI
- Embedding: Google
- Or any combination

#### 3. **Provider Grid with Context Awareness** (Lines 1820-1875)
```typescript
<label>Select {activeSelection === 'chat' ? 'Chat' : 'Embedding'} Provider</label>

<div className={`grid gap-3 ${
  activeSelection === 'chat' ? 'grid-cols-7' : 'grid-cols-4'  // Embedding only shows 4 providers
}`}>
```

**Providers**:
- **Chat**: OpenAI, Azure, Google, OpenRouter, Ollama, Anthropic, Grok (7 total)
- **Embedding**: OpenAI, Azure, Google, OpenRouter, Ollama (5 total - filtered)

**Visual**:
- Selected provider: Colored border + shadow glow
- Available providers: Gray border
- Each has provider logo image

#### 4. **Azure OpenAI Separate Configuration** (Lines 2415-2630)

**Separate Chat and Embedding Configs**:

**Chat Configuration**:
- `AZURE_OPENAI_CHAT_API_KEY`
- `AZURE_OPENAI_CHAT_ENDPOINT` (e.g., `https://my-resource.openai.azure.com`)
- `AZURE_OPENAI_CHAT_API_VERSION` (default: `2024-02-01`)
- `AZURE_OPENAI_CHAT_DEPLOYMENT` (e.g., `gpt-4o-mini`)

**Embedding Configuration**:
- `AZURE_OPENAI_EMBEDDING_API_KEY`
- `AZURE_OPENAI_EMBEDDING_ENDPOINT`
- `AZURE_OPENAI_EMBEDDING_API_VERSION` (default: `2024-02-01`)
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` (e.g., `text-embedding-3-large`)

**UI Pattern**:
```typescript
{activeSelection === 'chat' ? (
  // Show chat-specific Azure fields
  <Input label="Chat Endpoint" value={AZURE_OPENAI_CHAT_ENDPOINT} />
  <Input label="Chat API Version" value={AZURE_OPENAI_CHAT_API_VERSION} />
  <Input label="Chat Deployment" value={AZURE_OPENAI_CHAT_DEPLOYMENT} />
) : (
  // Show embedding-specific Azure fields
  <Input label="Embedding Endpoint" value={AZURE_OPENAI_EMBEDDING_ENDPOINT} />
  <Input label="Embedding API Version" value={AZURE_OPENAI_EMBEDDING_API_VERSION} />
  <Input label="Embedding Deployment" value={AZURE_OPENAI_EMBEDDING_DEPLOYMENT} />
)}
```

**Configuration Gear Button**:
- Shows when Azure is selected provider
- Toggles `showAzureConfig` state
- Expands configuration panel below

#### 5. **Provider-Specific Model Persistence** (Lines 65-84, 362-394)

**localStorage Strategy**:
```typescript
const PROVIDER_MODELS_KEY = 'archon_provider_models';

interface ProviderModels {
  chatModel: string;
  embeddingModel: string;
}

type ProviderModelMap = Record<ProviderKey, ProviderModels>;
```

**Behavior**:
- When user selects OpenAI → Shows last OpenAI model used
- When user switches to Azure → Shows last Azure deployment used
- When user switches back to OpenAI → Previous OpenAI model restored
- Persists across page reloads

#### 6. **Test Connection Functionality** (Lines 1115-1199, 2437)

**Per-Provider Testing**:
```typescript
onTest={() => testProviderCredentials('azure-openai', activeSelection)}
```

**Testing States**:
- `testing: boolean` - Shows spinner during test
- `testResult: { ok: boolean, message: string }` - Stores result
- Visual indicators: ✓ green for success, ✗ red for failure

**Azure Test**:
- Validates API key exists
- Validates endpoint is configured
- Validates deployment name exists
- Makes actual API call to verify

#### 7. **Separate API Keys for Chat/Embedding** (Lines 259-280, 428-520)

**All providers support dual keys**:
```typescript
const [providerApiKeys, setProviderApiKeys] = useState({
  'openai-chat': '',
  'openai-embedding': '',
  'azure-openai-chat': '',
  'azure-openai-embedding': '',
  'google-chat': '',
  'google-embedding': '',
  // ... etc for all providers
});
```

**Benefit**: Different API keys for chat vs embedding on same provider

---

## 🏗️ Proposed Architecture for Next.js Dashboard

### Component Structure

```
RAGSettingsTab.tsx (Enhanced)
├── State Management
│   ├── activeSelection: 'chat' | 'embedding'
│   ├── chatProvider: ProviderKey
│   ├── embeddingProvider: ProviderKey
│   ├── providerModels: ProviderModelMap (localStorage)
│   ├── providerApiKeys: { [key: string]: string }
│   ├── showAzureConfig: boolean
│   ├── showOllamaConfig: boolean
│   ├── testingProvider: { provider: string, configType?: string }
│   └── testResults: { [key: string]: { ok: boolean, message: string } }
│
├── UI Sections
│   ├── 1. Selection Mode Toggle (Chat / Embedding)
│   ├── 2. Provider Grid (Context-Aware)
│   ├── 3. API Key Input (Inline, Context-Aware)
│   ├── 4. Model Input Field
│   ├── 5. Configuration Gear Button (Azure/Ollama)
│   ├── 6. Expandable Azure Config Panel
│   ├── 7. Expandable Ollama Config Panel
│   ├── 8. Save Settings Button
│   └── 9. Strategy Settings (existing - move to bottom)
│
└── Helper Functions
    ├── saveProviderModels(models: ProviderModelMap)
    ├── loadProviderModels(): ProviderModelMap
    ├── normalizeAzureEndpoint(url: string): string
    ├── handleProviderSwitch(provider: ProviderKey)
    ├── testProviderCredentials(provider, configType)
    └── saveAllSettings()
```

### Data Flow

```
User Action: Click "Chat Provider"
    ↓
setActiveSelection('chat')
    ↓
UI Updates:
  - Highlight "Chat Provider" button
  - Show 7 providers (all chat-capable)
  - Display chatProvider selection
  - Show chat API key input if non-Ollama
  - Show chat model input
  - If Azure: Show chat Azure config gear
    ↓
User Action: Select Azure OpenAI
    ↓
setChatProvider('azure-openai')
    ↓
Load last Azure chat model from localStorage
    ↓
setRagSettings({ MODEL_CHOICE: savedModel, LLM_PROVIDER: 'azure-openai' })
    ↓
Show Azure config gear button
    ↓
User Action: Click config gear
    ↓
setShowAzureConfig(true)
    ↓
Expand Azure configuration panel showing:
  - Azure OpenAI Chat API Key input
  - Chat Endpoint input (with normalization)
  - Chat API Version input (default: 2024-02-01)
  - Chat Deployment input
  - Test Connection button
    ↓
User Action: Fill fields and click "Test Connection"
    ↓
testProviderCredentials('azure-openai', 'chat')
    ↓
Validate:
  - API key exists
  - Endpoint configured
  - Deployment name exists
  - Make test API call
    ↓
Show result: ✓ Success or ✗ Error with message
    ↓
User Action: Click "Save Settings"
    ↓
saveAllSettings()
    ↓
Update backend via credentialsService:
  - AZURE_OPENAI_CHAT_API_KEY
  - AZURE_OPENAI_CHAT_ENDPOINT
  - AZURE_OPENAI_CHAT_API_VERSION
  - AZURE_OPENAI_CHAT_DEPLOYMENT
  - MODEL_CHOICE
  - LLM_PROVIDER
    ↓
Save provider models to localStorage
    ↓
Show success toast
```

---

## 🔧 Implementation Plan

### Phase 1: Backend API Enhancements

#### Required New Endpoints

**File**: `/python/src/server/api_routes/settings_api.py`

```python
# Azure Configuration Endpoints
@router.get("/azure-chat-config")
async def get_azure_chat_config():
    """Get Azure OpenAI chat configuration."""
    try:
        config = {
            "AZURE_OPENAI_CHAT_ENDPOINT": await credential_service.get_credential("AZURE_OPENAI_CHAT_ENDPOINT") or "",
            "AZURE_OPENAI_CHAT_API_VERSION": await credential_service.get_credential("AZURE_OPENAI_CHAT_API_VERSION") or "2024-02-01",
            "AZURE_OPENAI_CHAT_DEPLOYMENT": await credential_service.get_credential("AZURE_OPENAI_CHAT_DEPLOYMENT") or "",
        }
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/azure-chat-config")
async def update_azure_chat_config(config: dict[str, str]):
    """Update Azure OpenAI chat configuration."""
    try:
        for key, value in config.items():
            await credential_service.set_credential(
                key=key,
                value=value,
                is_encrypted=False,
                category="azure_config",
                description=f"Azure chat config: {key}"
            )
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/azure-embedding-config")
async def get_azure_embedding_config():
    """Get Azure OpenAI embedding configuration."""
    # Similar structure to chat config

@router.put("/azure-embedding-config")
async def update_azure_embedding_config(config: dict[str, str]):
    """Update Azure OpenAI embedding configuration."""
    # Similar structure to chat config

# Test Connection Endpoint
@router.post("/test-provider-connection")
async def test_provider_connection(
    provider: str,
    config_type: str,  # 'chat' or 'embedding'
    config: dict[str, str]
):
    """Test provider connection with given configuration."""
    try:
        if provider == "azure-openai":
            # Validate Azure config and make test call
            endpoint = config.get("endpoint")
            api_key = config.get("api_key")
            deployment = config.get("deployment")
            api_version = config.get("api_version", "2024-02-01")

            if not all([endpoint, api_key, deployment]):
                return {"ok": False, "message": "Missing required configuration"}

            # Make test API call (implement actual Azure API test)
            # For now, return success if all fields present
            return {"ok": True, "message": f"Azure OpenAI ({config_type}) connection successful"}

        # Add other providers as needed
        return {"ok": False, "message": "Provider not supported"}

    except Exception as e:
        return {"ok": False, "message": str(e)}
```

**Estimated LOC**: +150 lines

#### Updated RAG Settings Interface

**File**: `/archon-ui-nextjs/src/lib/services/credentialsService.ts`

```typescript
export interface RagSettings {
  // Existing fields
  USE_CONTEXTUAL_EMBEDDINGS: boolean;
  CONTEXTUAL_EMBEDDINGS_MAX_WORKERS: number;
  USE_HYBRID_SEARCH: boolean;
  USE_AGENTIC_RAG: boolean;
  USE_RERANKING: boolean;
  MODEL_CHOICE: string;

  // NEW: Provider selection
  LLM_PROVIDER?: string;  // 'openai' | 'azure-openai' | 'google' | etc.
  EMBEDDING_PROVIDER?: string;

  // NEW: Azure Chat Configuration
  AZURE_OPENAI_CHAT_ENDPOINT?: string;
  AZURE_OPENAI_CHAT_API_VERSION?: string;
  AZURE_OPENAI_CHAT_DEPLOYMENT?: string;

  // NEW: Azure Embedding Configuration
  AZURE_OPENAI_EMBEDDING_ENDPOINT?: string;
  AZURE_OPENAI_EMBEDDING_API_VERSION?: string;
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT?: string;

  // NEW: Ollama Configuration
  LLM_BASE_URL?: string;
  LLM_INSTANCE_NAME?: string;
  OLLAMA_EMBEDDING_URL?: string;
  OLLAMA_EMBEDDING_INSTANCE_NAME?: string;

  // Existing API keys (now with separate chat/embedding support)
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  // ... etc
}

// NEW: Azure-specific interfaces
export interface AzureChatConfig {
  AZURE_OPENAI_CHAT_ENDPOINT: string;
  AZURE_OPENAI_CHAT_API_VERSION: string;
  AZURE_OPENAI_CHAT_DEPLOYMENT: string;
}

export interface AzureEmbeddingConfig {
  AZURE_OPENAI_EMBEDDING_ENDPOINT: string;
  AZURE_OPENAI_EMBEDDING_API_VERSION: string;
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT: string;
}

// NEW: Service methods
async getAzureChatConfig(): Promise<AzureChatConfig>
async updateAzureChatConfig(config: AzureChatConfig): Promise<void>
async getAzureEmbeddingConfig(): Promise<AzureEmbeddingConfig>
async updateAzureEmbeddingConfig(config: AzureEmbeddingConfig): Promise<void>
async testProviderConnection(provider: string, configType: string, config: any): Promise<{ ok: boolean, message: string }>
```

**Estimated LOC**: +100 lines

### Phase 2: Enhanced RAGSettingsTab Component

#### Component Structure

**File**: `/archon-ui-nextjs/src/app/settings/components/RAGSettingsTab.tsx`

**Sections to Implement**:

##### 1. Type Definitions & Constants (Lines 1-100)

```typescript
type ProviderKey = 'openai' | 'azure-openai' | 'google' | 'ollama' | 'anthropic' | 'grok' | 'openrouter';

const EMBEDDING_CAPABLE_PROVIDERS: ProviderKey[] = ['openai', 'azure-openai', 'google', 'openrouter', 'ollama'];

interface ProviderModels {
  chatModel: string;
  embeddingModel: string;
}

type ProviderModelMap = Record<ProviderKey, ProviderModels>;

const PROVIDER_MODELS_KEY = 'archon_provider_models';

const providerDisplayNames: Record<ProviderKey, string> = {
  openai: 'OpenAI',
  'azure-openai': 'Azure OpenAI',
  google: 'Google',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  anthropic: 'Anthropic',
  grok: 'Grok',
};

const colorStyles: Record<ProviderKey, string> = {
  openai: 'border-green-500 bg-green-500/10',
  'azure-openai': 'border-teal-500 bg-teal-500/10',
  google: 'border-blue-500 bg-blue-500/10',
  openrouter: 'border-cyan-500 bg-cyan-500/10',
  ollama: 'border-purple-500 bg-purple-500/10',
  anthropic: 'border-orange-500 bg-orange-500/10',
  grok: 'border-yellow-500 bg-yellow-500/10',
};

const getDefaultModels = (provider: ProviderKey): ProviderModels => {
  // Return default models for each provider
};

const saveProviderModels = (models: ProviderModelMap): void => {
  localStorage.setItem(PROVIDER_MODELS_KEY, JSON.stringify(models));
};

const loadProviderModels = (): ProviderModelMap => {
  const saved = localStorage.getItem(PROVIDER_MODELS_KEY);
  return saved ? JSON.parse(saved) : getDefaultModelsForAllProviders();
};

const normalizeAzureEndpoint = (endpoint: string): string => {
  // Remove /openai/deployments/... paths
  try {
    const url = new URL(endpoint);
    return `${url.protocol}//${url.host}`;
  } catch {
    return endpoint.replace(/\/openai.*$/i, '').replace(/\?.*$/, '').replace(/\/+$/, '');
  }
};
```

##### 2. State Management (Lines 100-200)

```typescript
export default function RAGSettingsTab() {
  // Selection mode
  const [activeSelection, setActiveSelection] = useState<'chat' | 'embedding'>('chat');

  // Independent provider selection
  const [chatProvider, setChatProvider] = useState<ProviderKey>('openai');
  const [embeddingProvider, setEmbeddingProvider] = useState<ProviderKey>('openai');

  // Provider-specific model persistence
  const [providerModels, setProviderModels] = useState<ProviderModelMap>(() => loadProviderModels());

  // API keys (separate for chat/embedding)
  const [providerApiKeys, setProviderApiKeys] = useState<Record<string, string>>({
    'openai-chat': '',
    'openai-embedding': '',
    'azure-openai-chat': '',
    'azure-openai-embedding': '',
    'google-chat': '',
    'google-embedding': '',
    'anthropic-chat': '',
    'anthropic-embedding': '',
    'grok-chat': '',
    'grok-embedding': '',
    'openrouter-chat': '',
    'openrouter-embedding': '',
  });

  // Azure configuration
  const [azureChatConfig, setAzureChatConfig] = useState<AzureChatConfig>({
    AZURE_OPENAI_CHAT_ENDPOINT: '',
    AZURE_OPENAI_CHAT_API_VERSION: '2024-02-01',
    AZURE_OPENAI_CHAT_DEPLOYMENT: '',
  });

  const [azureEmbeddingConfig, setAzureEmbeddingConfig] = useState<AzureEmbeddingConfig>({
    AZURE_OPENAI_EMBEDDING_ENDPOINT: '',
    AZURE_OPENAI_EMBEDDING_API_VERSION: '2024-02-01',
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT: '',
  });

  // UI state
  const [showAzureConfig, setShowAzureConfig] = useState(false);
  const [showOllamaConfig, setShowOllamaConfig] = useState(false);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  // Testing state
  const [testingProvider, setTestingProvider] = useState<{
    provider: string;
    configType?: string;
  } | null>(null);

  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  // Loading/saving state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ... rest of state
}
```

##### 3. Data Loading (Lines 200-350)

```typescript
useEffect(() => {
  loadSettings();
}, []);

const loadSettings = async () => {
  try {
    setLoading(true);

    // Load RAG settings
    const ragSettings = await credentialsService.getRagSettings();

    // Load Azure configs
    const azureChat = await credentialsService.getAzureChatConfig();
    const azureEmbedding = await credentialsService.getAzureEmbeddingConfig();

    // Load API keys
    await loadProviderApiKeys();

    // Set providers from settings
    setChatProvider((ragSettings.LLM_PROVIDER as ProviderKey) || 'openai');
    setEmbeddingProvider((ragSettings.EMBEDDING_PROVIDER as ProviderKey) || 'openai');

    // Set Azure configs
    setAzureChatConfig(azureChat);
    setAzureEmbeddingConfig(azureEmbedding);

    // Load provider models from localStorage
    const savedModels = loadProviderModels();
    setProviderModels(savedModels);

  } catch (error) {
    console.error('Failed to load RAG settings:', error);
    showToast('Failed to load RAG settings', 'error');
  } finally {
    setLoading(false);
  }
};

const loadProviderApiKeys = async () => {
  // Load all provider API keys (chat and embedding)
  const keys = [
    'OPENAI_CHAT_API_KEY', 'OPENAI_EMBEDDING_API_KEY',
    'AZURE_OPENAI_CHAT_API_KEY', 'AZURE_OPENAI_EMBEDDING_API_KEY',
    // ... all providers
  ];

  const statusResults = await credentialsService.checkCredentialStatus(keys);

  const loadedKeys: Record<string, string> = {};
  // Map database keys to frontend keys
  // Set '[CONFIGURED]' if key exists

  setProviderApiKeys(loadedKeys);
};
```

##### 4. Handler Functions (Lines 350-550)

```typescript
const handleProviderSwitch = (provider: ProviderKey) => {
  if (activeSelection === 'chat') {
    setChatProvider(provider);

    // Load saved model for this provider
    const savedModels = providerModels[provider] || getDefaultModels(provider);
    setRagSettings(prev => ({
      ...prev,
      MODEL_CHOICE: savedModels.chatModel,
      LLM_PROVIDER: provider,
    }));
  } else {
    setEmbeddingProvider(provider);

    // Load saved embedding model
    const savedModels = providerModels[provider] || getDefaultModels(provider);
    setRagSettings(prev => ({
      ...prev,
      EMBEDDING_MODEL: savedModels.embeddingModel,
      EMBEDDING_PROVIDER: provider,
    }));
  }
};

const handleApiKeyChange = (provider: string, value: string) => {
  setProviderApiKeys(prev => ({ ...prev, [provider]: value }));
};

const testProviderCredentials = async (provider: string, configType: 'chat' | 'embedding') => {
  try {
    setTestingProvider({ provider, configType });

    let config: any = {};

    if (provider === 'azure-openai') {
      if (configType === 'chat') {
        config = {
          endpoint: azureChatConfig.AZURE_OPENAI_CHAT_ENDPOINT,
          api_key: providerApiKeys['azure-openai-chat'],
          deployment: azureChatConfig.AZURE_OPENAI_CHAT_DEPLOYMENT,
          api_version: azureChatConfig.AZURE_OPENAI_CHAT_API_VERSION,
        };
      } else {
        config = {
          endpoint: azureEmbeddingConfig.AZURE_OPENAI_EMBEDDING_ENDPOINT,
          api_key: providerApiKeys['azure-openai-embedding'],
          deployment: azureEmbeddingConfig.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
          api_version: azureEmbeddingConfig.AZURE_OPENAI_EMBEDDING_API_VERSION,
        };
      }
    }

    const result = await credentialsService.testProviderConnection(provider, configType, config);

    setTestResults(prev => ({
      ...prev,
      [`${provider}-${configType}`]: result,
    }));

    showToast(result.message, result.ok ? 'success' : 'error');

  } catch (error) {
    showToast(`Test failed: ${error}`, 'error');
  } finally {
    setTestingProvider(null);
  }
};

const saveAllSettings = async () => {
  try {
    setSaving(true);

    // Save RAG strategy settings
    await credentialsService.updateRagSettings(ragSettings);

    // Save Azure configs if Azure is selected
    if (chatProvider === 'azure-openai') {
      await credentialsService.updateAzureChatConfig(azureChatConfig);
    }
    if (embeddingProvider === 'azure-openai') {
      await credentialsService.updateAzureEmbeddingConfig(azureEmbeddingConfig);
    }

    // Save API keys that have changed
    for (const [key, value] of Object.entries(providerApiKeys)) {
      if (value && value !== '[CONFIGURED]') {
        const dbKey = key.toUpperCase().replace(/-/g, '_') + '_API_KEY';
        await credentialsService.updateCredential({
          key: dbKey,
          value,
          is_encrypted: true,
          category: 'api_keys',
        });
      }
    }

    // Save provider models to localStorage
    saveProviderModels(providerModels);

    showToast('Settings saved successfully', 'success');

  } catch (error) {
    console.error('Failed to save settings:', error);
    showToast('Failed to save settings', 'error');
  } finally {
    setSaving(false);
  }
};
```

##### 5. UI Rendering (Lines 550-1200)

```typescript
if (loading) {
  return <LoadingSpinner />;
}

return (
  <div className="space-y-6">
    {/* Toast Notifications */}
    {toast && <ToastNotification {...toast} />}

    {/* Section 1: Chat/Embedding Selection Toggle */}
    <div className="flex gap-3 mb-6">
      <button
        onClick={() => setActiveSelection('chat')}
        className={`
          flex-1 px-4 py-3 rounded-lg font-medium transition-all
          ${activeSelection === 'chat'
            ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
          }
        `}
      >
        🧠 Chat Provider
      </button>

      <button
        onClick={() => setActiveSelection('embedding')}
        className={`
          flex-1 px-4 py-3 rounded-lg font-medium transition-all
          ${activeSelection === 'embedding'
            ? 'bg-purple-600 text-white shadow-lg ring-2 ring-purple-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
          }
        `}
      >
        🗄️ Embedding Provider
      </button>
    </div>

    {/* Section 2: Provider Grid */}
    <div>
      <label className="block text-sm font-medium mb-3">
        Select {activeSelection === 'chat' ? 'Chat' : 'Embedding'} Provider
      </label>

      <div className={`grid gap-3 ${
        activeSelection === 'chat' ? 'grid-cols-7' : 'grid-cols-4'
      }`}>
        {[
          { key: 'openai', name: 'OpenAI', logo: '/img/OpenAI.png' },
          { key: 'azure-openai', name: 'Azure OpenAI', logo: '/img/AzureOpenAI.png' },
          { key: 'google', name: 'Google', logo: '/img/google-logo.svg' },
          { key: 'openrouter', name: 'OpenRouter', logo: '/img/openrouter.png' },
          { key: 'ollama', name: 'Ollama', logo: '/img/Ollama.png' },
          { key: 'anthropic', name: 'Anthropic', logo: '/img/claude-logo.svg' },
          { key: 'grok', name: 'Grok', logo: '/img/Grok.png' },
        ]
          .filter(p =>
            activeSelection === 'chat' ||
            EMBEDDING_CAPABLE_PROVIDERS.includes(p.key as ProviderKey)
          )
          .map(provider => (
            <button
              key={provider.key}
              onClick={() => handleProviderSwitch(provider.key as ProviderKey)}
              className={`
                p-3 rounded-lg border-2 transition-all
                ${(activeSelection === 'chat' ? chatProvider : embeddingProvider) === provider.key
                  ? `${colorStyles[provider.key as ProviderKey]} shadow-lg`
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }
              `}
            >
              <img src={provider.logo} alt={provider.name} className="w-full h-auto mb-2" />
              <span className="text-xs font-medium">{provider.name}</span>
            </button>
          ))
        }
      </div>
    </div>

    {/* Section 3: API Key Input (if not Ollama or Azure) */}
    {activeSelection === 'chat' && chatProvider !== 'ollama' && chatProvider !== 'azure-openai' && (
      <ApiKeyInput
        provider={`${chatProvider}-chat`}
        providerName={`${providerDisplayNames[chatProvider]} (Chat)`}
        value={providerApiKeys[`${chatProvider}-chat`]}
        onChange={(val) => handleApiKeyChange(`${chatProvider}-chat`, val)}
        onTest={() => testProviderCredentials(chatProvider, 'chat')}
        testing={testingProvider?.provider === chatProvider && testingProvider?.configType === 'chat'}
        testResult={testResults[`${chatProvider}-chat`]}
      />
    )}

    {/* Section 4: Model Input Field */}
    <div className="flex items-end gap-4">
      <div className="flex-1">
        <label className="block text-sm font-medium mb-2">
          {activeSelection === 'chat' ? 'Chat Model' : 'Embedding Model'}
        </label>
        <input
          type="text"
          value={activeSelection === 'chat' ? ragSettings.MODEL_CHOICE : ragSettings.EMBEDDING_MODEL}
          onChange={(e) => {
            const value = e.target.value;
            if (activeSelection === 'chat') {
              setRagSettings(prev => ({ ...prev, MODEL_CHOICE: value }));
              setProviderModels(prev => ({
                ...prev,
                [chatProvider]: { ...prev[chatProvider], chatModel: value }
              }));
            } else {
              setRagSettings(prev => ({ ...prev, EMBEDDING_MODEL: value }));
              setProviderModels(prev => ({
                ...prev,
                [embeddingProvider]: { ...prev[embeddingProvider], embeddingModel: value }
              }));
            }
          }}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder={activeSelection === 'chat' ? 'gpt-4o-mini' : 'text-embedding-3-small'}
        />
      </div>

      {/* Section 5: Configuration Gear Button */}
      {((activeSelection === 'chat' && chatProvider === 'azure-openai') ||
        (activeSelection === 'embedding' && embeddingProvider === 'azure-openai')) && (
        <button
          onClick={() => setShowAzureConfig(!showAzureConfig)}
          className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ⚙️ Configure
        </button>
      )}
    </div>

    {/* Section 6: Expandable Azure Config Panel */}
    {showAzureConfig &&
     ((activeSelection === 'chat' && chatProvider === 'azure-openai') ||
      (activeSelection === 'embedding' && embeddingProvider === 'azure-openai')) && (
      <div className="p-4 border rounded-lg bg-teal-500/5 border-teal-500/20">
        <h3 className="text-lg font-semibold mb-4">
          Azure OpenAI Configuration
        </h3>

        {/* API Key Input */}
        <ApiKeyInput
          provider={activeSelection === 'chat' ? 'azure-openai-chat' : 'azure-openai-embedding'}
          providerName={`Azure OpenAI (${activeSelection === 'chat' ? 'Chat' : 'Embedding'})`}
          value={providerApiKeys[activeSelection === 'chat' ? 'azure-openai-chat' : 'azure-openai-embedding']}
          onChange={(val) => handleApiKeyChange(
            activeSelection === 'chat' ? 'azure-openai-chat' : 'azure-openai-embedding',
            val
          )}
          onTest={() => testProviderCredentials('azure-openai', activeSelection)}
          testing={testingProvider?.provider === 'azure-openai'}
          testResult={testResults[`azure-openai-${activeSelection}`]}
        />

        {/* Configuration Fields */}
        <div className="space-y-4 mt-4">
          {activeSelection === 'chat' ? (
            <>
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-sm">
                Chat Provider Configuration
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Chat Endpoint</label>
                <input
                  type="text"
                  value={azureChatConfig.AZURE_OPENAI_CHAT_ENDPOINT}
                  onChange={(e) => setAzureChatConfig(prev => ({
                    ...prev,
                    AZURE_OPENAI_CHAT_ENDPOINT: normalizeAzureEndpoint(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="https://my-resource.openai.azure.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Base URL of your Azure OpenAI resource (deployment paths will be removed automatically)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Chat API Version</label>
                <input
                  type="text"
                  value={azureChatConfig.AZURE_OPENAI_CHAT_API_VERSION}
                  onChange={(e) => setAzureChatConfig(prev => ({
                    ...prev,
                    AZURE_OPENAI_CHAT_API_VERSION: e.target.value
                  }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="2024-02-01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Chat Deployment Name</label>
                <input
                  type="text"
                  value={azureChatConfig.AZURE_OPENAI_CHAT_DEPLOYMENT}
                  onChange={(e) => setAzureChatConfig(prev => ({
                    ...prev,
                    AZURE_OPENAI_CHAT_DEPLOYMENT: e.target.value
                  }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="gpt-4o-mini"
                />
              </div>
            </>
          ) : (
            <>
              <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded text-sm">
                Embedding Provider Configuration
              </div>

              {/* Similar structure for embedding fields */}
              <div>
                <label className="block text-sm font-medium mb-2">Embedding Endpoint</label>
                <input
                  type="text"
                  value={azureEmbeddingConfig.AZURE_OPENAI_EMBEDDING_ENDPOINT}
                  onChange={(e) => setAzureEmbeddingConfig(prev => ({
                    ...prev,
                    AZURE_OPENAI_EMBEDDING_ENDPOINT: normalizeAzureEndpoint(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="https://my-resource.openai.azure.com"
                />
              </div>

              {/* API Version and Deployment fields */}
            </>
          )}
        </div>
      </div>
    )}

    {/* Section 7: Ollama Config Panel (if needed) */}
    {/* Similar structure to Azure */}

    {/* Section 8: Save Button */}
    <div className="flex justify-end">
      <button
        onClick={saveAllSettings}
        disabled={saving}
        className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save All Settings'}
      </button>
    </div>

    {/* Section 9: Strategy Settings (Existing) */}
    <div className="border-t pt-6 mt-6">
      <h3 className="text-lg font-semibold mb-4">Strategy Settings</h3>
      {/* Existing strategy settings UI */}
    </div>
  </div>
);
```

**Estimated LOC**: ~1,200 lines (complete enhanced component)

---

## 📋 Implementation Checklist

### Backend (Phase 1)
- [ ] Add Azure chat config GET/PUT endpoints
- [ ] Add Azure embedding config GET/PUT endpoints
- [ ] Add test provider connection endpoint
- [ ] Update RAG settings schema with new fields
- [ ] Test all new endpoints with curl/Postman

### Service Layer (Phase 2)
- [ ] Extend `credentialsService.ts` with Azure methods
- [ ] Add `testProviderConnection` method
- [ ] Update `RagSettings` interface
- [ ] Create `AzureChatConfig` and `AzureEmbeddingConfig` types

### Frontend Component (Phase 3)
- [ ] Create enhanced `RAGSettingsTab.tsx`
- [ ] Implement type definitions and constants
- [ ] Add state management (11+ state variables)
- [ ] Implement localStorage persistence
- [ ] Create Chat/Embedding toggle buttons
- [ ] Build provider grid with context awareness
- [ ] Add API key inputs with show/hide
- [ ] Create Azure configuration panel
- [ ] Implement Test Connection functionality
- [ ] Add Ollama configuration panel (optional)
- [ ] Implement save functionality
- [ ] Add loading and error states
- [ ] Add toast notifications

### Testing (Phase 4)
- [ ] Test provider switching preserves models
- [ ] Test Azure config save/load
- [ ] Test API key management
- [ ] Test connection testing
- [ ] Test localStorage persistence
- [ ] Test error handling
- [ ] Test dark mode styling

### Documentation (Phase 5)
- [ ] Update README with new features
- [ ] Add inline code comments
- [ ] Create user guide for Azure setup
- [ ] Document provider model persistence

---

## 🎨 Visual Design

### Color Scheme
- **Chat Selection**: Emerald (Green) - `bg-emerald-600`, `ring-emerald-400`
- **Embedding Selection**: Purple - `bg-purple-600`, `ring-purple-400`
- **Azure Provider**: Teal - `border-teal-500`, `bg-teal-500/10`
- **Success States**: Green - `text-green-600`
- **Error States**: Red - `text-red-600`
- **Testing States**: Yellow - `text-yellow-600`

### Layout
- **Top**: Selection toggle (Chat/Embedding) - 2 buttons full width
- **Middle**: Provider grid (7 cols for chat, 4 for embedding)
- **Below**: API key input (conditional)
- **Below**: Model input + Config gear button
- **Expandable**: Azure/Ollama configuration panels
- **Bottom**: Strategy settings (existing)
- **Footer**: Save button (right-aligned)

---

## 🚀 Migration Strategy

### Step 1: Non-Breaking Changes
1. Add backend endpoints (no breaking changes to existing)
2. Extend interfaces with optional fields
3. Deploy backend first

### Step 2: Frontend Enhancement
1. Replace existing `RAGSettingsTab.tsx` with enhanced version
2. Maintain backward compatibility with existing settings
3. Add migration code for legacy format

### Step 3: Testing & Rollout
1. Test with existing data
2. Verify migrations work
3. Deploy to production

---

## 📊 Estimated Effort

| Phase | LOC | Time Estimate | Priority |
|-------|-----|---------------|----------|
| Backend API | ~150 | 2-3 hours | HIGH |
| Service Layer | ~100 | 1-2 hours | HIGH |
| Frontend Component | ~1,200 | 6-8 hours | HIGH |
| Testing | N/A | 2-3 hours | HIGH |
| Documentation | N/A | 1 hour | MEDIUM |
| **Total** | **~1,450** | **12-17 hours** | - |

---

## 🎯 Success Criteria

✅ User can independently select Chat and Embedding providers
✅ User can configure Azure OpenAI with separate chat/embedding settings
✅ Provider models persist when switching between providers
✅ User can test provider connections before saving
✅ All settings save correctly to backend
✅ UI matches original dashboard's UX pattern
✅ Dark mode support throughout
✅ No breaking changes to existing functionality

---

## 📝 Notes

- **Provider Logos**: Need to add logo images to `/public/img/` directory
- **Ollama Support**: Ollama config panel is optional for initial release
- **Legacy Support**: Maintain support for single `AZURE_OPENAI_API_KEY` as fallback
- **Testing**: Test connection requires actual API implementation (can mock initially)
- **Performance**: localStorage reads/writes are synchronous (acceptable for this use case)

---

**Next Steps**: Await user approval to proceed with implementation.

