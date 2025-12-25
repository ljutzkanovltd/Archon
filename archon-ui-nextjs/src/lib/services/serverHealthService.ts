/**
 * Server Health Service
 * Monitors backend server health and manages disconnect/reconnect events
 * Ported from archon-ui-main for full alignment
 */

import { credentialsService } from "./credentialsService";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface HealthCheckCallback {
  onDisconnected: () => void;
  onReconnected: () => void;
}

// ============================================================================
// Constants
// ============================================================================

// Health check interval - 30 seconds for reasonable balance
const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds

// ============================================================================
// Server Health Service Class
// ============================================================================

class ServerHealthService {
  private healthCheckInterval: number | null = null;
  private isConnected: boolean = true;
  private missedChecks: number = 0;
  private callbacks: HealthCheckCallback | null = null;

  // Settings
  private disconnectScreenEnabled: boolean = true;
  private maxMissedChecks: number = 2; // Show disconnect after 2 missed checks (60 seconds max with 30s interval)
  private checkInterval: number = HEALTH_CHECK_INTERVAL_MS;

  // ==========================================================================
  // Settings Management
  // ==========================================================================

  /**
   * Load disconnect screen settings from backend
   */
  async loadSettings() {
    try {
      // Load disconnect screen settings from API
      const enabledRes = await credentialsService
        .getCredential("DISCONNECT_SCREEN_ENABLED")
        .catch(() => ({ value: "true" }));
      this.disconnectScreenEnabled = enabledRes.value === "true";
    } catch (error) {
      console.error("Failed to load disconnect screen settings:", error);
    }
  }

  /**
   * Get current settings
   */
  getSettings() {
    return {
      enabled: this.disconnectScreenEnabled,
    };
  }

  /**
   * Update disconnect screen settings
   */
  async updateSettings(settings: { enabled?: boolean }) {
    if (settings.enabled !== undefined) {
      this.disconnectScreenEnabled = settings.enabled;
      await credentialsService.createCredential({
        key: "DISCONNECT_SCREEN_ENABLED",
        value: settings.enabled.toString(),
        is_encrypted: false,
        category: "features",
        description: "Enable disconnect screen when server is disconnected",
      });
    }
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Perform a health check against the backend server
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Use the /api/health endpoint (adjust as needed for Next.js routing)
      const response = await fetch("/api/health", {
        method: "GET",
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        // Accept healthy, online, or initializing (server is starting up)
        const isHealthy =
          data.status === "healthy" ||
          data.status === "online" ||
          data.status === "initializing";
        return isHealthy;
      }

      console.error("🏥 [Health] Response not OK:", response.status);
      return false;
    } catch (error) {
      console.error("🏥 [Health] Health check failed:", error);
      return false;
    }
  }

  // ==========================================================================
  // Monitoring
  // ==========================================================================

  /**
   * Start health monitoring with callbacks for disconnect/reconnect events
   */
  startMonitoring(callbacks: HealthCheckCallback) {
    // Guard: Prevent multiple intervals by clearing any existing one
    if (this.healthCheckInterval) {
      console.warn(
        "🏥 [Health] Health monitoring already active, stopping previous monitor"
      );
      this.stopMonitoring();
    }

    this.callbacks = callbacks;
    this.missedChecks = 0;
    this.isConnected = true;

    // Load settings first
    this.loadSettings();

    // Start HTTP health polling
    this.healthCheckInterval = window.setInterval(async () => {
      const isHealthy = await this.checkHealth();

      if (isHealthy) {
        // Server is healthy
        if (this.missedChecks > 0) {
          // Was disconnected, now reconnected
          this.missedChecks = 0;
          this.handleConnectionRestored();
        }
      } else {
        // Server is not responding
        this.missedChecks++;

        // After maxMissedChecks failures, trigger disconnect screen
        if (this.missedChecks >= this.maxMissedChecks && this.isConnected) {
          this.isConnected = false;
          if (this.disconnectScreenEnabled && this.callbacks) {
            console.log(
              "🏥 [Health] Triggering disconnect screen after multiple failures"
            );
            this.callbacks.onDisconnected();
          }
        }
      }
    }, this.checkInterval);

    // Do an immediate check
    this.checkHealth().then((isHealthy) => {
      if (!isHealthy) {
        this.missedChecks = 1;
      }
    });
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      window.clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.callbacks = null;
  }

  /**
   * Check if server is currently connected
   */
  isServerConnected(): boolean {
    return this.isConnected;
  }

  // ==========================================================================
  // Connection Event Handlers
  // ==========================================================================

  /**
   * Handle when connection is restored
   */
  private handleConnectionRestored() {
    if (!this.isConnected) {
      this.isConnected = true;
      console.log("🏥 [Health] Connection to server restored");
      if (this.callbacks) {
        this.callbacks.onReconnected();
      }
    }
  }

  /**
   * Immediately trigger disconnect screen without waiting for health checks
   * Used when services detect immediate disconnection (e.g., polling failures, fetch errors)
   */
  handleImmediateDisconnect() {
    console.log("🏥 [Health] Immediate disconnect triggered");
    this.isConnected = false;
    this.missedChecks = this.maxMissedChecks; // Set to max to ensure disconnect screen shows

    if (this.disconnectScreenEnabled && this.callbacks) {
      console.log("🏥 [Health] Triggering disconnect screen immediately");
      this.callbacks.onDisconnected();
    }
  }

  /**
   * Handle when connection reconnects - reset state but let health check confirm
   */
  handleConnectionReconnect() {
    console.log("🏥 [Health] Connection reconnected, resetting missed checks");
    this.missedChecks = 0;
    // Don't immediately mark as connected - let health check confirm server is actually healthy
  }
}

// Export singleton instance
export const serverHealthService = new ServerHealthService();
