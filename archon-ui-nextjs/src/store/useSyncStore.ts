/**
 * Zustand Store for Database Sync State Management
 * Manages wizard step navigation, sync configuration, and progress state
 */

import { create } from 'zustand';

export type SyncDirection = 'local-to-remote' | 'remote-to-local';
export type SyncStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
export type WizardStep = 'direction' | 'preflight' | 'approval' | 'progress' | 'complete';

interface PreflightCheck {
  database_connectivity?: {
    local: { status: string; latency_ms: number };
    remote: { status: string; latency_ms: number };
  };
  disk_space?: {
    available_gb: number;
    required_gb: number;
    status: string;
  };
  schema_version?: {
    local: { version: string; postgres: string };
    remote: { version: string; postgres: string };
    compatible: boolean;
  };
  backup_exists?: {
    status: string;
    latest_backup: string;
    age_hours: number;
  };
}

interface SyncProgress {
  sync_id: string | null;
  direction: SyncDirection | null;
  status: SyncStatus;
  current_phase: string | null;
  percent_complete: number;
  total_rows: number | null;
  synced_rows: number | null;
  current_table: string | null;
  error_message: string | null;
  logs: string[];
}

interface DatabaseStats {
  local: {
    projects: number;
    tasks: number;
    documents: number;
    total_rows: number;
  };
  remote: {
    projects: number;
    tasks: number;
    documents: number;
    total_rows: number;
  };
}

interface SyncStore {
  // Wizard navigation
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  resetWizard: () => void;

  // Sync configuration
  direction: SyncDirection | null;
  setDirection: (direction: SyncDirection) => void;

  // Pre-flight checks
  preflightChecks: PreflightCheck | null;
  preflightWarnings: string[];
  preflightErrors: string[];
  setPreflightResults: (checks: PreflightCheck, warnings: string[], errors: string[]) => void;

  // Database stats
  databaseStats: DatabaseStats | null;
  setDatabaseStats: (stats: DatabaseStats) => void;

  // Safety approvals
  firstApprovalGiven: boolean;
  secondApprovalGiven: boolean;
  setFirstApproval: (approved: boolean) => void;
  setSecondApproval: (approved: boolean) => void;

  // Sync progress
  progress: SyncProgress;
  updateProgress: (updates: Partial<SyncProgress>) => void;
  addLog: (message: string) => void;

  // Actions
  startSync: (sync_id: string, direction: SyncDirection) => void;
  completeSync: () => void;
  failSync: (error: string) => void;
  cancelSync: () => void;
}

const wizardSteps: WizardStep[] = ['direction', 'preflight', 'approval', 'progress', 'complete'];

export const useSyncStore = create<SyncStore>((set, get) => ({
  // Initial state
  currentStep: 'direction',
  direction: null,
  preflightChecks: null,
  preflightWarnings: [],
  preflightErrors: [],
  databaseStats: null,
  firstApprovalGiven: false,
  secondApprovalGiven: false,
  progress: {
    sync_id: null,
    direction: null,
    status: 'idle',
    current_phase: null,
    percent_complete: 0,
    total_rows: null,
    synced_rows: null,
    current_table: null,
    error_message: null,
    logs: [],
  },

  // Wizard navigation
  setCurrentStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const { currentStep } = get();
    const currentIndex = wizardSteps.indexOf(currentStep);
    if (currentIndex < wizardSteps.length - 1) {
      set({ currentStep: wizardSteps[currentIndex + 1] });
    }
  },

  previousStep: () => {
    const { currentStep } = get();
    const currentIndex = wizardSteps.indexOf(currentStep);
    if (currentIndex > 0) {
      set({ currentStep: wizardSteps[currentIndex - 1] });
    }
  },

  resetWizard: () => set({
    currentStep: 'direction',
    direction: null,
    preflightChecks: null,
    preflightWarnings: [],
    preflightErrors: [],
    firstApprovalGiven: false,
    secondApprovalGiven: false,
    progress: {
      sync_id: null,
      direction: null,
      status: 'idle',
      current_phase: null,
      percent_complete: 0,
      total_rows: null,
      synced_rows: null,
      current_table: null,
      error_message: null,
      logs: [],
    },
  }),

  // Sync configuration
  setDirection: (direction) => set({ direction }),

  // Pre-flight checks
  setPreflightResults: (checks, warnings, errors) => set({
    preflightChecks: checks,
    preflightWarnings: warnings,
    preflightErrors: errors,
  }),

  // Database stats
  setDatabaseStats: (stats) => set({ databaseStats: stats }),

  // Safety approvals
  setFirstApproval: (approved) => set({ firstApprovalGiven: approved }),
  setSecondApproval: (approved) => set({ secondApprovalGiven: approved }),

  // Sync progress
  updateProgress: (updates) => set((state) => ({
    progress: {
      ...state.progress,
      ...updates,
    },
  })),

  addLog: (message) => set((state) => ({
    progress: {
      ...state.progress,
      logs: [...state.progress.logs, message],
    },
  })),

  // Actions
  startSync: (sync_id, direction) => set({
    progress: {
      sync_id,
      direction,
      status: 'running',
      current_phase: 'validation',
      percent_complete: 0,
      total_rows: null,
      synced_rows: null,
      current_table: null,
      error_message: null,
      logs: [],
    },
  }),

  completeSync: () => set((state) => ({
    progress: {
      ...state.progress,
      status: 'completed',
      percent_complete: 100,
    },
  })),

  failSync: (error) => set((state) => ({
    progress: {
      ...state.progress,
      status: 'failed',
      error_message: error,
    },
  })),

  cancelSync: () => set((state) => ({
    progress: {
      ...state.progress,
      status: 'cancelled',
    },
  })),
}));
