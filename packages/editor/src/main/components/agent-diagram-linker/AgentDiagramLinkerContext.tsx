import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Supplied by the host at editor-init time.
 *
 * The editor stays storage-agnostic: project mutation (creating the
 * Agent diagram, switching the active diagram) lives in the host; the
 * editor only renders the affordance and dispatches the click via the
 * host-supplied callbacks.
 */
export interface AgentDiagramLinker {
  /** True iff `ref` resolves to an Agent diagram that currently exists
   *  in the project. Used by the popup to decide whether to render
   *  "Open Agent diagram" (alive) or "Define BESSER agent" (dead /
   *  absent). */
  isRefAlive: (ref: string) => boolean;
  /** Atomic for the Define click. The host:
   *   1. Flushes the editor's in-memory BPMN model to storage
   *      (captures any pending isAgentic/role/trust edits within the
   *      300ms debounce window).
   *   2. Creates a fresh empty Agent diagram, returns its UUID.
   *   3. Mutates the source BPMN lane in storage to add
   *      `agentDiagramRef = newUuid` (bypasses the editor model
   *      write entirely — the editor is being torn down by the
   *      switch anyway).
   *   4. Switches active diagram type to AgentDiagram.
   *  Returns the new UUID, or null on failure (toast already shown). */
  createForLane: (suggestedTitle: string, laneId: string) => Promise<string | null>;
  /** Switch the editor to the Agent diagram identified by `ref`.
   *  Fire-and-forget; the host dispatches the thunks and bumps
   *  `editorRevision`. */
  openByRef: (ref: string) => void;
}

const AgentDiagramLinkerContext = createContext<AgentDiagramLinker | null>(null);

export const AgentDiagramLinkerContextProvider: React.FC<{
  value: AgentDiagramLinker | null;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <AgentDiagramLinkerContext.Provider value={value}>{children}</AgentDiagramLinkerContext.Provider>
);

export const useAgentDiagramLinker = (): AgentDiagramLinker | null => useContext(AgentDiagramLinkerContext);

/**
 * Wraps `AgentDiagramLinkerContextProvider` so the editor can swap the
 * provider value imperatively (via `setAgentDiagramLinker(...)`)
 * without tearing down its React tree. Same pattern as 06's
 * `LineageProviderRoot`.
 */
export const AgentDiagramLinkerProviderRoot: React.FC<{
  initialValue: AgentDiagramLinker | null;
  register: (listener: (v: AgentDiagramLinker | null) => void) => void;
  children: React.ReactNode;
}> = ({ initialValue, register, children }) => {
  const [value, setValue] = useState<AgentDiagramLinker | null>(initialValue);
  useEffect(() => {
    register(setValue);
  }, [register]);
  return <AgentDiagramLinkerContextProvider value={value}>{children}</AgentDiagramLinkerContextProvider>;
};
