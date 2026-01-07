/**
 * Credentials Service
 * Manages API keys, RAG settings, code extraction settings, and feature toggles
 * Ported from archon-ui-main for full alignment
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface Credential {
  key: string;
  value?: string;
  is_encrypted?: boolean;
  category?: string;
  description?: string;
}

export interface RagSettings {
  // Core RAG Settings
  USE_CONTEXTUAL_EMBEDDINGS: boolean;
  CONTEXTUAL_EMBEDDINGS_MAX_WORKERS: number;
  USE_HYBRID_SEARCH: boolean;
  USE_AGENTIC_RAG: boolean;
  USE_RERANKING: boolean;
  MODEL_CHOICE: string;

  // NEW: Provider Selection
  LLM_PROVIDER?: string; // 'openai' | 'azure-openai' | 'google' | etc.
  EMBEDDING_PROVIDER?: string;
  EMBEDDING_MODEL?: string;

  // NEW: Ollama Configuration
  LLM_BASE_URL?: string;
  LLM_INSTANCE_NAME?: string;
  OLLAMA_EMBEDDING_URL?: string;
  OLLAMA_EMBEDDING_INSTANCE_NAME?: string;

  // Crawling Performance Settings
  CRAWL_BATCH_SIZE?: number;
  CRAWL_MAX_CONCURRENT?: number;
  CRAWL_WAIT_STRATEGY?: string;
  CRAWL_PAGE_TIMEOUT?: number;
  CRAWL_DELAY_BEFORE_HTML?: number;

  // Storage Performance Settings
  DOCUMENT_STORAGE_BATCH_SIZE?: number;
  EMBEDDING_BATCH_SIZE?: number;
  DELETE_BATCH_SIZE?: number;
  ENABLE_PARALLEL_BATCHES?: boolean;

  // Advanced Settings
  MEMORY_THRESHOLD_PERCENT?: number;
  DISPATCHER_CHECK_INTERVAL?: number;
  CODE_EXTRACTION_BATCH_SIZE?: number;
  CODE_SUMMARY_MAX_WORKERS?: number;

  // Provider API Keys
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  AZURE_OPENAI_API_KEY?: string;
  GROK_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

export interface AzureChatConfig {
  AZURE_OPENAI_CHAT_ENDPOINT: string;
  AZURE_OPENAI_CHAT_API_VERSION: string;
  AZURE_OPENAI_CHAT_DEPLOYMENT: string;
  AZURE_OPENAI_API_KEY: string;
  AZURE_OPENAI_API_KEY_SET?: boolean;  // Indicates if key is configured (from backend)
}

export interface AzureEmbeddingConfig {
  AZURE_OPENAI_EMBEDDING_ENDPOINT: string;
  AZURE_OPENAI_EMBEDDING_API_VERSION: string;
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT: string;
  AZURE_OPENAI_API_KEY: string;
  AZURE_OPENAI_API_KEY_SET?: boolean;  // Indicates if key is configured (from backend)
}

export interface TestProviderRequest {
  provider: string;
  config_type: 'chat' | 'embedding';
  config: {
    endpoint?: string;
    api_key?: string;
    deployment?: string;
    api_version?: string;
  };
}

export interface TestProviderResponse {
  ok: boolean;
  message: string;
}

export interface CodeExtractionSettings {
  MIN_CODE_BLOCK_LENGTH: number;
  MAX_CODE_BLOCK_LENGTH: number;
  ENABLE_COMPLETE_BLOCK_DETECTION: boolean;
  ENABLE_LANGUAGE_SPECIFIC_PATTERNS: boolean;
  ENABLE_PROSE_FILTERING: boolean;
  MAX_PROSE_RATIO: number;
  MIN_CODE_INDICATORS: number;
  ENABLE_DIAGRAM_FILTERING: boolean;
  ENABLE_CONTEXTUAL_LENGTH: boolean;
  CODE_EXTRACTION_MAX_WORKERS: number;
  CONTEXT_WINDOW_SIZE: number;
  ENABLE_CODE_SUMMARIES: boolean;
}

export interface OllamaInstance {
  id: string;
  name: string;
  baseUrl: string;
  isEnabled: boolean;
  isPrimary: boolean;
  instanceType?: "chat" | "embeddings" | "both";
  loadBalancingWeight?: number;
  isHealthy?: boolean;
  responseTimeMs?: number;
  modelsAvailable?: number;
  lastHealthCheck?: string;
}

export interface CredentialStatus {
  [key: string]: {
    exists: boolean;
    is_encrypted?: boolean;
  };
}

// ============================================================================
// Credentials Service Class
// ============================================================================

class CredentialsService {
  private baseUrl: string;
  private updateListeners: Set<(keys: string[]) => void> = new Set();

  constructor() {
    // Use environment variable or default to localhost
    this.baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181";
  }

  // ==========================================================================
  // Listener Management
  // ==========================================================================

  /**
   * Subscribe to credential updates
   */
  onCredentialUpdate(callback: (keys: string[]) => void): () => void {
    this.updateListeners.add(callback);
    return () => this.updateListeners.delete(callback);
  }

  /**
   * Notify all listeners of credential updates
   */
  private notifyCredentialUpdate(keys: string[]): void {
    this.updateListeners.forEach((listener) => listener(keys));
  }

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  private handleCredentialError(error: unknown, context: string): Error {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`[CredentialsService] ${context}:`, error);
    return new Error(`${context} failed: ${message}`);
  }

  // ==========================================================================
  // Core Credential Operations
  // ==========================================================================

  /**
   * Get all credentials from the database
   */
  async getAllCredentials(): Promise<Credential[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/credentials`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      throw this.handleCredentialError(error, "Fetching all credentials");
    }
  }

  /**
   * Get credentials filtered by category
   */
  async getCredentialsByCategory(category: string): Promise<Credential[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/credentials?category=${encodeURIComponent(category)}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      throw this.handleCredentialError(
        error,
        `Fetching credentials for category '${category}'`
      );
    }
  }

  /**
   * Get a single credential by key
   */
  async getCredential(
    key: string
  ): Promise<{ key: string; value?: string; is_encrypted?: boolean }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/credentials/${encodeURIComponent(key)}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return { key };
        }
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      throw this.handleCredentialError(error, `Fetching credential '${key}'`);
    }
  }

  /**
   * Check status of multiple credentials
   */
  async checkCredentialStatus(keys: string[]): Promise<CredentialStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/credentials/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keys }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      throw this.handleCredentialError(error, "Checking credential status");
    }
  }

  /**
   * Update an existing credential
   */
  async updateCredential(credential: Credential): Promise<Credential> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/credentials/${credential.key}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(credential),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const updated = await response.json();
      this.notifyCredentialUpdate([credential.key]);
      return updated;
    } catch (error) {
      throw this.handleCredentialError(
        error,
        `Updating credential '${credential.key}'`
      );
    }
  }

  /**
   * Create a new credential
   */
  async createCredential(credential: Credential): Promise<Credential> {
    try {
      const response = await fetch(`${this.baseUrl}/api/credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credential),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const created = await response.json();
      this.notifyCredentialUpdate([credential.key]);
      return created;
    } catch (error) {
      throw this.handleCredentialError(
        error,
        `Creating credential '${credential.key}'`
      );
    }
  }

  /**
   * Delete a credential
   */
  async deleteCredential(key: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/credentials/${key}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      this.notifyCredentialUpdate([key]);
    } catch (error) {
      throw this.handleCredentialError(error, `Deleting credential '${key}'`);
    }
  }

  // ==========================================================================
  // RAG Settings Operations
  // ==========================================================================

  /**
   * Get RAG settings (strategy + API keys)
   */
  async getRagSettings(): Promise<RagSettings> {
    try {
      const response = await fetch(`${this.baseUrl}/api/rag-settings`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const ragSettings = await response.json();

      // Get API keys separately
      const apiKeysCredentials = await this.getCredentialsByCategory(
        "api_keys"
      );

      // Merge API keys into RAG settings
      const settings: RagSettings = {
        ...ragSettings,
      };

      // Merge all API keys unconditionally (not just those already in settings)
      // This allows new API keys to be added even if not present in backend defaults
      apiKeysCredentials.forEach((cred) => {
        (settings as any)[cred.key] = cred.value;
      });

      return settings;
    } catch (error) {
      throw this.handleCredentialError(error, "Fetching RAG settings");
    }
  }

  /**
   * Update RAG settings
   */
  async updateRagSettings(settings: RagSettings): Promise<void> {
    const promises: Promise<any>[] = [];

    // Separate API keys from strategy settings
    const apiKeyFields = [
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "GOOGLE_API_KEY",
      "AZURE_OPENAI_API_KEY",
      "GROK_API_KEY",
      "OPENROUTER_API_KEY",
    ];

    const strategySettings: Record<string, any> = {};
    const apiKeySettings: Record<string, any> = {};

    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) continue;

      if (apiKeyFields.includes(key)) {
        apiKeySettings[key] = value;
      } else {
        strategySettings[key] = value;
      }
    }

    // Update RAG strategy settings via dedicated endpoint
    if (Object.keys(strategySettings).length > 0) {
      promises.push(
        fetch(`${this.baseUrl}/api/rag-settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(strategySettings),
        }).then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
        })
      );
    }

    // Update API keys via credentials endpoint
    for (const [key, value] of Object.entries(apiKeySettings)) {
      promises.push(
        this.updateCredential({
          key,
          value: value.toString(),
          is_encrypted: true,
          category: "api_keys",
        })
      );
    }

    await Promise.all(promises);
  }

  // ==========================================================================
  // Code Extraction Settings Operations
  // ==========================================================================

  /**
   * Get code extraction settings
   */
  async getCodeExtractionSettings(): Promise<CodeExtractionSettings> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/code-extraction-settings`
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      throw this.handleCredentialError(
        error,
        "Fetching code extraction settings"
      );
    }
  }

  /**
   * Update code extraction settings
   */
  async updateCodeExtractionSettings(
    settings: CodeExtractionSettings
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/code-extraction-settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settings),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      throw this.handleCredentialError(
        error,
        "Updating code extraction settings"
      );
    }
  }

  // ==========================================================================
  // Azure OpenAI Configuration
  // ==========================================================================

  /**
   * Get Azure OpenAI chat configuration
   */
  async getAzureChatConfig(): Promise<AzureChatConfig> {
    try {
      const response = await fetch(`${this.baseUrl}/api/azure-chat-config`);
      if (!response.ok) {
        throw new Error(`Failed to fetch Azure chat config: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching Azure chat config:", error);
      // Return defaults on error
      return {
        AZURE_OPENAI_CHAT_ENDPOINT: "",
        AZURE_OPENAI_CHAT_API_VERSION: "2024-02-01",
        AZURE_OPENAI_CHAT_DEPLOYMENT: "",
        AZURE_OPENAI_API_KEY: "",
        AZURE_OPENAI_API_KEY_SET: false,
      };
    }
  }

  /**
   * Update Azure OpenAI chat configuration
   */
  async updateAzureChatConfig(config: AzureChatConfig): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/azure-chat-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to update Azure chat config: ${response.statusText}`);
      }

      // Notify listeners
      this.notifyCredentialUpdate([
        "AZURE_OPENAI_CHAT_ENDPOINT",
        "AZURE_OPENAI_CHAT_API_VERSION",
        "AZURE_OPENAI_CHAT_DEPLOYMENT",
      ]);
    } catch (error) {
      console.error("Error updating Azure chat config:", error);
      throw error;
    }
  }

  /**
   * Get Azure OpenAI embedding configuration
   */
  async getAzureEmbeddingConfig(): Promise<AzureEmbeddingConfig> {
    try {
      const response = await fetch(`${this.baseUrl}/api/azure-embedding-config`);
      if (!response.ok) {
        throw new Error(`Failed to fetch Azure embedding config: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching Azure embedding config:", error);
      // Return defaults on error
      return {
        AZURE_OPENAI_EMBEDDING_ENDPOINT: "",
        AZURE_OPENAI_EMBEDDING_API_VERSION: "2024-02-01",
        AZURE_OPENAI_EMBEDDING_DEPLOYMENT: "",
        AZURE_OPENAI_API_KEY: "",
        AZURE_OPENAI_API_KEY_SET: false,
      };
    }
  }

  /**
   * Update Azure OpenAI embedding configuration
   */
  async updateAzureEmbeddingConfig(config: AzureEmbeddingConfig): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/azure-embedding-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to update Azure embedding config: ${response.statusText}`);
      }

      // Notify listeners
      this.notifyCredentialUpdate([
        "AZURE_OPENAI_EMBEDDING_ENDPOINT",
        "AZURE_OPENAI_EMBEDDING_API_VERSION",
        "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
      ]);
    } catch (error) {
      console.error("Error updating Azure embedding config:", error);
      throw error;
    }
  }

  // ==========================================================================
  // Provider Connection Testing
  // ==========================================================================

  /**
   * Test provider connection with given configuration
   *
   * @param provider - Provider name ('azure-openai', 'openai', 'google', etc.)
   * @param configType - Configuration type ('chat' or 'embedding')
   * @param config - Provider-specific configuration
   * @returns Test result with ok status and message
   */
  async testProviderConnection(
    provider: string,
    configType: 'chat' | 'embedding',
    config: {
      endpoint?: string;
      api_key?: string;
      deployment?: string;
      api_version?: string;
    }
  ): Promise<TestProviderResponse> {
    try {
      const request: TestProviderRequest = {
        provider,
        config_type: configType,
        config,
      };

      const response = await fetch(`${this.baseUrl}/api/test-provider-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: TestProviderResponse = await response.json();
      return result;
    } catch (error) {
      console.error("Error testing provider connection:", error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Connection test failed",
      };
    }
  }

  // ==========================================================================
  // Ollama Instance Management
  // ==========================================================================

  /**
   * Get all Ollama instances
   */
  async getOllamaInstances(): Promise<OllamaInstance[]> {
    try {
      const ollamaCredentials = await this.getCredentialsByCategory(
        "ollama_instances"
      );

      // Convert credentials to OllamaInstance objects
      const instances: OllamaInstance[] = [];
      const instanceMap: Record<string, Partial<OllamaInstance>> = {};

      // Group credentials by instance ID
      ollamaCredentials.forEach((cred) => {
        const parts = cred.key.split("_");
        if (
          parts.length >= 3 &&
          parts[0] === "ollama" &&
          parts[1] === "instance"
        ) {
          const instanceId = parts[2];
          const field = parts.slice(3).join("_");

          if (!instanceMap[instanceId]) {
            instanceMap[instanceId] = { id: instanceId };
          }

          // Parse the field value
          let value: any = cred.value;
          if (
            field === "isEnabled" ||
            field === "isPrimary" ||
            field === "isHealthy"
          ) {
            value = cred.value === "true";
          } else if (
            field === "responseTimeMs" ||
            field === "modelsAvailable" ||
            field === "loadBalancingWeight"
          ) {
            value = parseInt(cred.value || "0", 10);
          }

          (instanceMap[instanceId] as any)[field] = value;
        }
      });

      // Convert to array and ensure required fields
      Object.values(instanceMap).forEach((instance) => {
        if (instance.id && instance.name && instance.baseUrl) {
          instances.push({
            id: instance.id,
            name: instance.name,
            baseUrl: instance.baseUrl,
            isEnabled: instance.isEnabled ?? true,
            isPrimary: instance.isPrimary ?? false,
            instanceType: instance.instanceType ?? "both",
            loadBalancingWeight: instance.loadBalancingWeight ?? 100,
            isHealthy: instance.isHealthy,
            responseTimeMs: instance.responseTimeMs,
            modelsAvailable: instance.modelsAvailable,
            lastHealthCheck: instance.lastHealthCheck,
          });
        }
      });

      return instances;
    } catch (error) {
      console.error("Failed to load Ollama instances from database:", error);
      return [];
    }
  }

  /**
   * Set Ollama instances (replaces all)
   */
  async setOllamaInstances(instances: OllamaInstance[]): Promise<void> {
    try {
      // First, delete existing ollama instance credentials
      const existingCredentials = await this.getCredentialsByCategory(
        "ollama_instances"
      );
      for (const cred of existingCredentials) {
        await this.deleteCredential(cred.key);
      }

      // Add new instance credentials
      const promises: Promise<any>[] = [];

      instances.forEach((instance) => {
        const fields: Record<string, any> = {
          name: instance.name,
          baseUrl: instance.baseUrl,
          isEnabled: instance.isEnabled,
          isPrimary: instance.isPrimary,
          instanceType: instance.instanceType || "both",
          loadBalancingWeight: instance.loadBalancingWeight || 100,
        };

        // Add optional health-related fields
        if (instance.isHealthy !== undefined) {
          fields.isHealthy = instance.isHealthy;
        }
        if (instance.responseTimeMs !== undefined) {
          fields.responseTimeMs = instance.responseTimeMs;
        }
        if (instance.modelsAvailable !== undefined) {
          fields.modelsAvailable = instance.modelsAvailable;
        }
        if (instance.lastHealthCheck) {
          fields.lastHealthCheck = instance.lastHealthCheck;
        }

        // Create a credential for each field
        Object.entries(fields).forEach(([field, value]) => {
          promises.push(
            this.createCredential({
              key: `ollama_instance_${instance.id}_${field}`,
              value: value.toString(),
              is_encrypted: false,
              category: "ollama_instances",
            })
          );
        });
      });

      await Promise.all(promises);
    } catch (error) {
      throw this.handleCredentialError(error, "Saving Ollama instances");
    }
  }

  /**
   * Add a new Ollama instance
   */
  async addOllamaInstance(instance: OllamaInstance): Promise<void> {
    const instances = await this.getOllamaInstances();
    instances.push(instance);
    await this.setOllamaInstances(instances);
  }

  /**
   * Update an existing Ollama instance
   */
  async updateOllamaInstance(
    instanceId: string,
    updates: Partial<OllamaInstance>
  ): Promise<void> {
    const instances = await this.getOllamaInstances();
    const instanceIndex = instances.findIndex((inst) => inst.id === instanceId);

    if (instanceIndex === -1) {
      throw new Error(`Ollama instance with ID ${instanceId} not found`);
    }

    instances[instanceIndex] = { ...instances[instanceIndex], ...updates };
    await this.setOllamaInstances(instances);
  }

  /**
   * Remove an Ollama instance
   */
  async removeOllamaInstance(instanceId: string): Promise<void> {
    const instances = await this.getOllamaInstances();
    const filteredInstances = instances.filter(
      (inst) => inst.id !== instanceId
    );

    if (filteredInstances.length === instances.length) {
      throw new Error(`Ollama instance with ID ${instanceId} not found`);
    }

    await this.setOllamaInstances(filteredInstances);
  }

  /**
   * Migrate Ollama instances from localStorage to database
   */
  async migrateOllamaFromLocalStorage(): Promise<{
    migrated: boolean;
    instanceCount: number;
  }> {
    try {
      // Check if there are existing instances in the database
      const existingInstances = await this.getOllamaInstances();
      if (existingInstances.length > 0) {
        return { migrated: false, instanceCount: 0 };
      }

      // Try to load from localStorage
      const localStorageData = localStorage.getItem("ollama-instances");
      if (!localStorageData) {
        return { migrated: false, instanceCount: 0 };
      }

      const localInstances = JSON.parse(localStorageData);
      if (!Array.isArray(localInstances) || localInstances.length === 0) {
        return { migrated: false, instanceCount: 0 };
      }

      // Migrate to database
      await this.setOllamaInstances(localInstances);

      // Clean up localStorage
      localStorage.removeItem("ollama-instances");

      return { migrated: true, instanceCount: localInstances.length };
    } catch (error) {
      console.error(
        "Failed to migrate Ollama instances from localStorage:",
        error
      );
      return { migrated: false, instanceCount: 0 };
    }
  }
}

// Export singleton instance
export const credentialsService = new CredentialsService();
