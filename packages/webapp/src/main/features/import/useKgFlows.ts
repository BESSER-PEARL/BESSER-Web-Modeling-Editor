// The Knowledge Graph flows that open dialogs: converting a graph into a class
// diagram (preflight -> refine -> consistency gate -> conversion) and refining
// it on its own. They used to live inside useGeneratorExecution, which put the
// open/close state of three modals into the generic code-generation hook.
//
// This hook owns that state and returns the props for the two modals the app
// renders (KgRefineModal, KgConsistencyConfirmModal).
import { useCallback, useState } from 'react';

import * as kgFocus from '../../shared/kg/kgFocus';
import { getPostHog } from '../../shared/services/analytics/lazy-analytics';
import type { KgIssue } from '../../shared/api/knowledgeGraph';
import type { ConsistencyReport } from '../../shared/types/project';
import { isKnowledgeGraphData } from '../../shared/types/project';
import { getActiveKgDiagram, useKgToUmlConversion } from './useKgToUmlConversion';
import { useKgPreflight } from './useKgPreflight';

type RefineTab = 'static' | 'consistency' | 'llm';
type GateDecision = 'proceed' | 'cancel';

/** How many first-degree neighbours "Fix in KG" brings onto the canvas. */
const FOCUS_MAX_NEIGHBORS = 15;

interface ConsistencyGate {
  open: boolean;
  report: ConsistencyReport | null;
  resolve: ((decision: GateDecision) => void) | null;
}
const CLOSED_GATE: ConsistencyGate = { open: false, report: null, resolve: null };

function trackFlow(flow: 'kg_to_class' | 'kg_refine'): void {
  const model = getActiveKgDiagram()?.diagram?.model;
  getPostHog()?.capture('generator_used', {
    generator_type: flow,
    diagram_type: 'KnowledgeGraphDiagram',
    nodes_count: isKnowledgeGraphData(model) ? model.nodes.length : 0,
    edges_count: isKnowledgeGraphData(model) ? model.edges.length : 0,
  });
}

export function useKgFlows() {
  const runConversion = useKgToUmlConversion();
  const { runPreflight } = useKgPreflight();

  const [refineOpen, setRefineOpen] = useState(false);
  // "Convert mode": the refine modal was opened because the preflight found
  // issues; it calls onConvert once the graph is clean.
  const [convertMode, setConvertMode] = useState(false);
  const [refineInitialTab, setRefineInitialTab] = useState<RefineTab | undefined>(undefined);
  // Pre-conversion consistency gate: the conversion awaits the user's choice,
  // which the modal's buttons deliver through `resolve`.
  const [gate, setGate] = useState<ConsistencyGate>(CLOSED_GATE);
  const [isConverting, setIsConverting] = useState(false);

  const onConsistencyIssues = useCallback(
    (report: ConsistencyReport): Promise<GateDecision> =>
      new Promise((resolve) => setGate({ open: true, report, resolve })),
    [],
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
      setConvertMode(true);
    } finally {
      setIsConverting(false);
    }
  }, [runPreflight, runConversion, onConsistencyIssues]);

  const openRefine = useCallback(() => {
    trackFlow('kg_refine');
    setRefineOpen(true);
  }, []);

  const focusNodes = useCallback((ids: string[]) => {
    if (ids.length > 0) kgFocus.focus(ids, { maxNeighbors: FOCUS_MAX_NEIGHBORS });
  }, []);

  const refineModalProps = {
    open: refineOpen || convertMode,
    onClose: () => {
      setRefineOpen(false);
      setConvertMode(false);
      setRefineInitialTab(undefined);
    },
    onFixInKg: (issue: KgIssue) => focusNodes(issue?.affectedNodeIds ?? []),
    onFocusNodes: focusNodes,
    convertMode,
    onConvert: (kgSignature: string) => {
      void runConversion({ kgSignature, onConsistencyIssues });
    },
    initialTab: refineInitialTab,
  };

  const consistencyConfirmModalProps = {
    open: gate.open,
    report: gate.report,
    onOpenRefine: () => {
      // Not converting after all: send the user to the Refine dialog's
      // Consistency tab instead.
      gate.resolve?.('cancel');
      setGate(CLOSED_GATE);
      setRefineInitialTab('consistency');
      setRefineOpen(true);
    },
    onProceed: () => {
      gate.resolve?.('proceed');
      setGate(CLOSED_GATE);
    },
    onCancel: () => {
      gate.resolve?.('cancel');
      setGate(CLOSED_GATE);
    },
  };

  return { convertToClassDiagram, openRefine, isConverting, refineModalProps, consistencyConfirmModalProps };
}
