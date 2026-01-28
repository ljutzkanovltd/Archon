/**
 * CopilotKit Provider Wrapper
 *
 * Wraps the dashboard with CopilotKit and AgentContextProvider.
 * Configures runtime URL, agent settings, and authentication.
 *
 * This is the top-level provider that should wrap the entire dashboard:
 * Layout → CopilotKitProvider → AgentContextProvider → Dashboard Components
 */

'use client';

import { CopilotKit } from '@copilotkit/react-core';
import { AgentContextProvider } from './AgentContextProvider';
import { useAuthStore } from '@/store/useAuthStore';

// ===========================
// CopilotKit Provider Props
// ===========================

export interface CopilotKitProviderProps {
  children: React.ReactNode;
  runtimeUrl?: string;
}

// ===========================
// CopilotKit Provider
// ===========================

export function CopilotKitProvider({
  children,
  runtimeUrl = '/api/copilot'
}: CopilotKitProviderProps) {
  // Get auth token for API calls
  const token = useAuthStore((state) => state.token);

  return (
    <CopilotKit
      runtimeUrl={runtimeUrl}
      // Pass authentication token to CopilotRuntime
      headers={{
        ...(token && { Authorization: `Bearer ${token}` })
      }}
      // Agent configuration
      agent="archon-assistant"
      // Enable streaming responses
      stream={true}
      // Show thinking indicator
      showDevConsole={process.env.NODE_ENV === 'development'}
    >
      {/* Expose user context to agent */}
      <AgentContextProvider>
        {children}
      </AgentContextProvider>
    </CopilotKit>
  );
}

// ===========================
// Exports
// ===========================

export default CopilotKitProvider;
