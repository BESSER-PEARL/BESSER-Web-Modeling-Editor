import type { ConsistencyReport } from '../types/project';

/** Tabs of the Refine dialog. */
export type KgRefineTab = 'static' | 'consistency' | 'llm';

/** The pre-conversion consistency gate: shown with the report, closed otherwise.
 *  (The conversion's promise resolver is not state; the flow hook keeps it in a ref.) */
export interface KgConsistencyGate {
  open: boolean;
  report: ConsistencyReport | null;
}

export const CLOSED_KG_GATE: KgConsistencyGate = { open: false, report: null };

/**
 * What the Knowledge Graph dialogs (Refine, consistency gate) need to be open.
 *
 * Held with the app's other dialog state (`useDialogStates`) and handed to the
 * flow hook (`useKgFlows`), which drives it. Declared here so neither has to
 * import the other: features may not import from `app/`.
 */
export interface KgDialogState {
  isKgRefineOpen: boolean;
  setIsKgRefineOpen: (open: boolean) => void;
  /** Refine was opened because the preflight found issues; it converts once the graph is clean. */
  isKgConvertMode: boolean;
  setIsKgConvertMode: (convertMode: boolean) => void;
  kgRefineInitialTab: KgRefineTab | undefined;
  setKgRefineInitialTab: (tab: KgRefineTab | undefined) => void;
  kgConsistencyGate: KgConsistencyGate;
  setKgConsistencyGate: (gate: KgConsistencyGate) => void;
}
