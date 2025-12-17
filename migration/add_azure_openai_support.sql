-- =====================================================
-- Azure OpenAI Support Migration
-- =====================================================
-- This migration adds Azure OpenAI provider support to Archon
-- by adding the necessary configuration settings to the
-- archon_settings table.
--
-- Run this script in your Supabase SQL Editor to enable
-- Azure OpenAI as an alternative LLM/embedding provider.
-- =====================================================
-- Date: 2025-12-12
-- Version: 1.0.0
-- =====================================================

-- =====================================================
-- SECTION 1: AZURE OPENAI API CREDENTIALS
-- =====================================================

-- Azure OpenAI API Key (encrypted)
-- Get this from your Azure OpenAI resource in the Azure Portal
-- Navigate to: Azure Portal > Your OpenAI Resource > Keys and Endpoint
INSERT INTO archon_settings (key, encrypted_value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_API_KEY', NULL, true, 'api_keys', 'Azure OpenAI API Key for authentication. Get from: Azure Portal > Your OpenAI Resource > Keys and Endpoint')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- SECTION 2: AZURE OPENAI CONFIGURATION
-- =====================================================

-- Azure OpenAI Endpoint URL
-- Format: https://your-resource-name.openai.azure.com
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_ENDPOINT', NULL, false, 'rag_strategy', 'Azure OpenAI endpoint URL (e.g., https://your-resource-name.openai.azure.com)')
ON CONFLICT (key) DO NOTHING;

-- Azure OpenAI API Version
-- Default: 2024-02-01 (latest stable version)
-- See: https://learn.microsoft.com/en-us/azure/ai-services/openai/reference
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_API_VERSION', '2024-02-01', false, 'rag_strategy', 'Azure OpenAI API version (e.g., 2024-02-01). See Azure OpenAI API reference for available versions.')
ON CONFLICT (key) DO NOTHING;

-- Azure OpenAI Chat Deployment Name
-- This is the deployment name you created in Azure Portal for your chat/LLM model
-- Example: gpt-4o-deployment, gpt-35-turbo-deployment
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_CHAT_DEPLOYMENT', NULL, false, 'rag_strategy', 'Azure OpenAI deployment name for chat/LLM (e.g., gpt-4o-deployment). Create deployments in Azure Portal > Your OpenAI Resource > Deployments.')
ON CONFLICT (key) DO NOTHING;

-- Azure OpenAI Embedding Deployment Name
-- This is the deployment name you created in Azure Portal for your embedding model
-- Example: text-embedding-3-small-deployment, text-embedding-ada-002-deployment
INSERT INTO archon_settings (key, value, is_encrypted, category, description) VALUES
('AZURE_OPENAI_EMBEDDING_DEPLOYMENT', NULL, false, 'rag_strategy', 'Azure OpenAI deployment name for embeddings (e.g., text-embedding-3-small-deployment). Create deployments in Azure Portal > Your OpenAI Resource > Deployments.')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
--
-- Next Steps:
-- 1. Configure Azure OpenAI settings in Archon Settings UI:
--    - Navigate to: Settings > RAG Strategy
--    - Set LLM_PROVIDER to: azure-openai
--    - Fill in Azure-specific configuration:
--      * AZURE_OPENAI_API_KEY (from Azure Portal)
--      * AZURE_OPENAI_ENDPOINT (your resource endpoint URL)
--      * AZURE_OPENAI_CHAT_DEPLOYMENT (your chat model deployment name)
--      * AZURE_OPENAI_EMBEDDING_DEPLOYMENT (your embedding model deployment name)
--      * AZURE_OPENAI_API_VERSION (keep default or update as needed)
--
-- 2. Test the configuration:
--    - Try a RAG search query to test embedding generation
--    - Try a chat completion to test LLM functionality
--
-- 3. Troubleshooting:
--    - Check Archon logs for any Azure-specific errors
--    - Verify your deployment names match exactly what's in Azure Portal
--    - Ensure your Azure OpenAI resource has sufficient quota
--    - Confirm API version is compatible with your deployments
--
-- =====================================================
