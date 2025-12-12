-- =====================================================
-- Separate Azure OpenAI Chat & Embedding Configurations
-- =====================================================
-- This migration separates Azure OpenAI configuration into
-- independent chat and embedding settings, allowing different
-- Azure resources/endpoints for each provider type.
--
-- Run this script in your Supabase SQL Editor or via docker exec.
-- =====================================================
-- Date: 2025-12-12
-- Version: 2.0.0
-- =====================================================

-- =====================================================
-- SECTION 1: CHAT-SPECIFIC AZURE OPENAI SETTINGS
-- =====================================================

-- Azure OpenAI Chat Endpoint
-- Format: https://your-chat-resource-name.openai.azure.com
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_CHAT_ENDPOINT', NULL, false, 'rag_strategy', 'Azure OpenAI endpoint URL for chat/LLM (e.g., https://your-chat-resource.openai.azure.com). This can be different from the embedding endpoint.')
ON CONFLICT (key) DO NOTHING;

-- Azure OpenAI Chat API Version
-- Default: 2024-02-01 (latest stable version)
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_CHAT_API_VERSION', '2024-02-01', false, 'rag_strategy', 'Azure OpenAI API version for chat/LLM (e.g., 2024-02-01). See Azure OpenAI API reference for available versions.')
ON CONFLICT (key) DO NOTHING;

-- Azure OpenAI Chat Deployment Name
-- This is the deployment name you created in Azure Portal for your chat/LLM model
-- Example: gpt-4o-deployment, gpt-35-turbo-deployment
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_CHAT_DEPLOYMENT', NULL, false, 'rag_strategy', 'Azure OpenAI deployment name for chat/LLM (e.g., gpt-4o-deployment). Create deployments in Azure Portal > Your OpenAI Resource > Deployments.')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- SECTION 2: EMBEDDING-SPECIFIC AZURE OPENAI SETTINGS
-- =====================================================

-- Azure OpenAI Embedding Endpoint
-- Format: https://your-embedding-resource-name.openai.azure.com
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_EMBEDDING_ENDPOINT', NULL, false, 'rag_strategy', 'Azure OpenAI endpoint URL for embeddings (e.g., https://your-embedding-resource.openai.azure.com). This can be different from the chat endpoint.')
ON CONFLICT (key) DO NOTHING;

-- Azure OpenAI Embedding API Version
-- Default: 2024-02-01 (latest stable version)
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_EMBEDDING_API_VERSION', '2024-02-01', false, 'rag_strategy', 'Azure OpenAI API version for embeddings (e.g., 2024-02-01). See Azure OpenAI API reference for available versions.')
ON CONFLICT (key) DO NOTHING;

-- Azure OpenAI Embedding Deployment Name
-- This is the deployment name you created in Azure Portal for your embedding model
-- Example: text-embedding-3-small-deployment, text-embedding-ada-002-deployment
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_EMBEDDING_DEPLOYMENT', NULL, false, 'rag_strategy', 'Azure OpenAI deployment name for embeddings (e.g., text-embedding-3-small-deployment). Create deployments in Azure Portal > Your OpenAI Resource > Deployments.')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- SECTION 3: DATA MIGRATION (Backward Compatibility)
-- =====================================================
-- Copy existing shared settings to new separated settings
-- This ensures users with existing Azure OpenAI config continue to work

-- Migrate shared endpoint to both chat and embedding endpoints
UPDATE archon_settings
SET value = (SELECT value FROM archon_settings WHERE key = 'AZURE_OPENAI_ENDPOINT')
WHERE key = 'AZURE_OPENAI_CHAT_ENDPOINT'
  AND value IS NULL
  AND EXISTS (SELECT 1 FROM archon_settings WHERE key = 'AZURE_OPENAI_ENDPOINT' AND value IS NOT NULL);

UPDATE archon_settings
SET value = (SELECT value FROM archon_settings WHERE key = 'AZURE_OPENAI_ENDPOINT')
WHERE key = 'AZURE_OPENAI_EMBEDDING_ENDPOINT'
  AND value IS NULL
  AND EXISTS (SELECT 1 FROM archon_settings WHERE key = 'AZURE_OPENAI_ENDPOINT' AND value IS NOT NULL);

-- Migrate shared API version to both chat and embedding API versions
UPDATE archon_settings
SET value = (SELECT value FROM archon_settings WHERE key = 'AZURE_OPENAI_API_VERSION')
WHERE key = 'AZURE_OPENAI_CHAT_API_VERSION'
  AND (value IS NULL OR value = '2024-02-01')
  AND EXISTS (SELECT 1 FROM archon_settings WHERE key = 'AZURE_OPENAI_API_VERSION' AND value IS NOT NULL AND value != '2024-02-01');

UPDATE archon_settings
SET value = (SELECT value FROM archon_settings WHERE key = 'AZURE_OPENAI_API_VERSION')
WHERE key = 'AZURE_OPENAI_EMBEDDING_API_VERSION'
  AND (value IS NULL OR value = '2024-02-01')
  AND EXISTS (SELECT 1 FROM archon_settings WHERE key = 'AZURE_OPENAI_API_VERSION' AND value IS NOT NULL AND value != '2024-02-01');

-- Migrate existing chat deployment name (already separate, just ensure consistency)
UPDATE archon_settings
SET value = (SELECT value FROM archon_settings WHERE key = 'AZURE_OPENAI_CHAT_DEPLOYMENT' WHERE value IS NOT NULL)
WHERE key = 'AZURE_OPENAI_CHAT_DEPLOYMENT'
  AND value IS NULL
  AND EXISTS (SELECT 1 FROM archon_settings WHERE key = 'AZURE_OPENAI_CHAT_DEPLOYMENT' AND value IS NOT NULL);

-- Migrate existing embedding deployment name (already separate, just ensure consistency)
UPDATE archon_settings
SET value = (SELECT value FROM archon_settings WHERE key = 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT' WHERE value IS NOT NULL)
WHERE key = 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT'
  AND value IS NULL
  AND EXISTS (SELECT 1 FROM archon_settings WHERE key = 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT' AND value IS NOT NULL);

-- =====================================================
-- SECTION 4: DEPRECATION NOTES (Keep for Rollback)
-- =====================================================
-- The following OLD settings are now DEPRECATED but kept for backward compatibility:
-- - AZURE_OPENAI_ENDPOINT (replaced by AZURE_OPENAI_CHAT_ENDPOINT and AZURE_OPENAI_EMBEDDING_ENDPOINT)
-- - AZURE_OPENAI_API_VERSION (replaced by AZURE_OPENAI_CHAT_API_VERSION and AZURE_OPENAI_EMBEDDING_API_VERSION)
--
-- These settings are NOT deleted to allow rollback if needed.
-- They should no longer be used by the application after this migration.

-- Mark deprecated settings with updated descriptions
UPDATE archon_settings
SET description = '[DEPRECATED] Use AZURE_OPENAI_CHAT_ENDPOINT and AZURE_OPENAI_EMBEDDING_ENDPOINT instead. ' || description
WHERE key = 'AZURE_OPENAI_ENDPOINT'
  AND description NOT LIKE '[DEPRECATED]%';

UPDATE archon_settings
SET description = '[DEPRECATED] Use AZURE_OPENAI_CHAT_API_VERSION and AZURE_OPENAI_EMBEDDING_API_VERSION instead. ' || description
WHERE key = 'AZURE_OPENAI_API_VERSION'
  AND description NOT LIKE '[DEPRECATED]%';

-- =====================================================
-- MIGRATION VERIFICATION
-- =====================================================
-- Verify all 6 new settings were created

DO $$
DECLARE
    new_settings_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO new_settings_count
    FROM archon_settings
    WHERE key IN (
        'AZURE_OPENAI_CHAT_ENDPOINT',
        'AZURE_OPENAI_CHAT_API_VERSION',
        'AZURE_OPENAI_CHAT_DEPLOYMENT',
        'AZURE_OPENAI_EMBEDDING_ENDPOINT',
        'AZURE_OPENAI_EMBEDDING_API_VERSION',
        'AZURE_OPENAI_EMBEDDING_DEPLOYMENT'
    );

    IF new_settings_count = 6 THEN
        RAISE NOTICE 'SUCCESS: All 6 new Azure OpenAI settings created successfully';
    ELSE
        RAISE WARNING 'WARNING: Only % out of 6 new settings were created', new_settings_count;
    END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
--
-- Next Steps:
-- 1. Configure separated Azure OpenAI settings in Archon Settings UI:
--
--    For Chat (LLM):
--    - Navigate to: Settings > RAG Settings > Chat Provider
--    - Select: Azure OpenAI
--    - Click "Azure Config" button
--    - Configure:
--      * AZURE_OPENAI_CHAT_ENDPOINT (e.g., https://chat-resource.openai.azure.com)
--      * AZURE_OPENAI_CHAT_API_VERSION (default: 2024-02-01)
--      * AZURE_OPENAI_CHAT_DEPLOYMENT (e.g., gpt-4o-deployment)
--
--    For Embeddings:
--    - Navigate to: Settings > RAG Settings > Embedding Provider
--    - Select: Azure OpenAI
--    - Click "Azure Config" button
--    - Configure:
--      * AZURE_OPENAI_EMBEDDING_ENDPOINT (e.g., https://embedding-resource.openai.azure.com)
--      * AZURE_OPENAI_EMBEDDING_API_VERSION (default: 2024-02-01)
--      * AZURE_OPENAI_EMBEDDING_DEPLOYMENT (e.g., text-embedding-3-small-deployment)
--
-- 2. Benefits of separated configuration:
--    - Use different Azure OpenAI resources for chat vs embeddings
--    - Different API versions for each service type
--    - Independent scaling and cost management
--    - Clearer configuration scope (chat vs embedding)
--
-- 3. Backward compatibility:
--    - Existing Azure OpenAI configurations automatically migrated
--    - Old settings kept for rollback safety
--    - No action required for existing deployments
--
-- 4. Troubleshooting:
--    - Check Archon backend logs for Azure-specific errors
--    - Verify deployment names match exactly what's in Azure Portal
--    - Ensure each endpoint URL is correct for its service type
--    - Test chat and embedding independently
--
-- =====================================================
