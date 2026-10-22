// The Knowledge Graph flows that open dialogs: converting a graph into a class
// diagram (preflight -> refine -> consistency gate -> conversion) and refining
// it on its own. They used to live inside useGeneratorExecution, which put the
// open/close state of three modals into the generic code-generation hook.
//
// The open/close state of those dialogs lives with the app's other dialog
// state (`useDialogStates`) and arrives here as `dialogs`. This hook drives it
// and returns the props for the two modals the app renders (KgRefineModal,
// KgConsistencyConfirmModal). The one thing it keeps itself is the consistency
// gate's promise resolver, which is not render state.
import { useCallback, useRef, useState } from 'react';

import * as kgFocus from '../../shared/kg/kgFocus';
import { getPostHog } from '../../shared/services/analytics/lazy-analytics';
import type { KgIssue } from '../../shared/api/knowledgeGraph';
import { CLOSED_KG_GATE, type KgDialogState } from '../../shared/kg/dialogState';
import type { ConsistencyReport } from '../../shared/types/project';
import { isKnowledgeGraphData } from '../../shared/types/project';
import { getActiveKgDiagram } from './activeKgDiagram';
import { useKgToUmlConversion } from './convert/useKgToUmlConversion';
import { useKgPreflight } from './refine/useKgPreflight';

type GateDecision = 'proceed' | 'cancel';

/** How many first-degree neighbours "Fix in KG" brings onto the canvas. */
const FOCUS_MAX_NEIGHBORS = 15;

function trackFlow(flow: 'kg_to_class' | 'kg_refine'): void {
  const model = getActiveKgDiagram()?.diagram?.model;
  getPostHog()?.capture('generator_used', {
    generator_type: flow,
    diagram_type: 'KnowledgeGraphDiagram',
    nodes_count: isKnowledgeGraphData(model) ? model.nodes.length : 0,
    edges_count: isKnowledgeGraphData(model) ? model.edges.length : 0,
  });
}

export function useKgFlows(dialogs: KgDialogState) {
  const {
    isKgRefineOpen,
    setIsKgRefineOpen,
    isKgConvertMode,
    setIsKgConvertMode,
    kgRefineInitialTab,
    setKgRefineInitialTab,
    kgConsistencyGate,
    setKgConsistencyGate,
  } = dialogs;
  const runConversion = useKgToUmlConversion();
  const { runPreflight } = useKgPreflight();

  // Pre-conversion consistency gate: the conversion awaits the user's choice,
  // which the modal's buttons deliver through this resolver.
  const gateResolve = useRef<((decision: GateDecision) => void) | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const closeGate = useCallback(
    (decision: GateDecision) => {
      gateResolve.current?.(decision);
      gateResolve.current = null;
      setKgConsistencyGate(CLOSED_KG_GATE);
    },
    [setKgConsistencyGate],
  );

  const onConsistencyIssues = useCallback(
    (report: ConsistencyReport): Promise<GateDecision> =>
      new Promise((resolve) => {
        // A gate still waiting for an answer is abandoned, not left hanging.
        gateResolve.current?.('cancel');
        gateResolve.current = resolve;
        setKgConsistencyGate({ open: true, report });
      }),
    [setKgConsistencyGate],
  );

  /** Graph -> class diagram: preflight, then convert (after the consistency
   *  gate) when it is clean, or open Refine in convert mode when it is not. */
  const convertToClassDiagram = useCallback(async (): Promise<void> => {
    setIsConverting(true);
    try {
      const report = await runPreflight();
      if (!report) return;
      trackFlow('kg_to_class');
      if (report.issueCount === 0) {
        await runConversion({ kgSignature: report.kgSignature, onConsistencyIssues });
        return;
      }
      setIsKgConvertMode(true);
    } finally {
      setIsConverting(false);
    }
  }, [runPreflight, runConversion, onConsistencyIssues, setIsKgConvertMode]);

  const openRefine = useCallback(() => {
    trackFlow('kg_refine');
    setIsKgRefineOpen(true);
  }, [setIsKgRefineOpen]);

  const focusNodes = useCallback((ids: string[]) => {
    if (ids.length > 0) kgFocus.focus(ids, { maxNeighbors: FOCUS_MAX_NEIGHBORS });
  }, []);

  const refineModalProps = {
    open: isKgRefineOpen || isKgConvertMode,
    onClose: () => {
      setIsKgRefineOpen(false);
      setIsKgConvertMode(false);
      setKgRefineInitialTab(undefined);
    },
    onFixInKg: (issue: KgIssue) => focusNodes(issue?.affectedNodeIds ?? []),
    onFocusNodes: focusNodes,
    convertMode: isKgConvertMode,
    onConvert: (kgSignature: string) => {
      void runConversion({ kgSignature, onConsistencyIssues });
    },
    initialTab: kgRefineInitialTab,
  };

  const consistencyConfirmModalProps = {
    open: kgConsistencyGate.open,
    report: kgConsistencyGate.report,
    onOpenRefine: () => {
      // Not converting after all: send the user to the Refine dialog's
      // Consistency tab instead.
      closeGate('cancel');
      setKgRefineInitialTab('consistency');
      setIsKgRefineOpen(true);
    },
    onProceed: () => closeGate('proceed'),
    onCancel: () => closeGate('cancel'),
  };

  return { convertToClassDiagram, openRefine, isConverting, refineModalProps, consistencyConfirmModalProps };
}
