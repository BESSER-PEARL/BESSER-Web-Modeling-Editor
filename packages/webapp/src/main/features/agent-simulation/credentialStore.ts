import type { AgentSimulationCredentials } from '@/main/shared/api/agentSimulation';

/**
 * Module-scoped holder for the LLM API keys of the current simulation.
 *
 * The keys are deliberately kept OUT of Redux (and out of thunk arguments, which
 * Redux DevTools records) so they are never serialized, persisted, or logged.
 * They are only kept so that "Restart" can recreate the session; they are
 * cleared when the simulation is stopped or the simulation page unmounts.
 */
let currentCredentials: AgentSimulationCredentials | undefined;

export const agentSimulationCredentialStore = {
  set(credentials: AgentSimulationCredentials | undefined): void {
    currentCredentials = credentials ? { ...credentials } : undefined;
  },
  get(): AgentSimulationCredentials | undefined {
    return currentCredentials ? { ...currentCredentials } : undefined;
  },
  clear(): void {
    currentCredentials = undefined;
  },
};
