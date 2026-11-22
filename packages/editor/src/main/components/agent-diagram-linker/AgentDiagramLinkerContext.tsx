import { createHostProviderContext } from '../host-provider/host-provider';

/**
 * Supplied by the host at editor-init time.
 *
 * The editor stays storage-agnostic: project mutation (creating the
 * Agent diagram, switching the active diagram) lives in the host; the
 * editor only renders the affordance and dispatches the click via the
 * host-supplied callbacks.
 */
export interface AgentDiagramLinker {
  /** True iff `ref` resolves to an Agent diagram that currently exists in
   *  the project; the popup then offers "Open" instead of "Define". */
  isRefAlive: (ref: string) => boolean;
  /** Define click: the host creates an Agent diagram for the BPMN lane or
   *  task `laneId` (derived from the lane's tasks where possible), stores
   *  `agentDiagramRef` on that element and switches to the new diagram.
   *  Resolves to the new diagram id, or null on failure (the host has
   *  already told the user why). */
  createForLane: (suggestedTitle: string, laneId: string) => Promise<string | null>;
  /** Switch to the Agent diagram identified by `ref` (fire-and-forget). */
  openByRef: (ref: string) => void;
}

export const agentDiagramLinkerContext = createHostProviderContext<AgentDiagramLinker>();

export const useAgentDiagramLinker = agentDiagramLinkerContext.useValue;
