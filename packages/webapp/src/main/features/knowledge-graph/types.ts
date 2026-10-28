import type { KgDecision } from '../../shared/api/knowledgeGraph';
import type { ConsistencyReport } from '../../shared/types/project';

/** Tabs of the Refine dialog. */
export type KgRefineTab = 'static' | 'consistency' | 'llm';

/** What the user chose for one preflight issue: fix it, or leave it. */
export type RowDecision = KgDecision;

/** How a selected issue gets fixed: the rule-based recommendation, or the AI tab. */
export type RowRouting = 'recommended' | 'llm';

/** The pre-conversion consistency gate: shown with the report, closed otherwise. */
export interface KgConsistencyGate {
  open: boolean;
  report: ConsistencyReport | null;
}
