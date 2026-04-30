// Run the KG → BUML preflight against the backend and return a structured
// list of issues for the user to review.
//
// One issue = one "non-1-to-1" mapping. Each issue carries a
// ``recommendedAction`` (pre-checked checkbox in the modal) and a
// ``skipAction`` ("drop from output"). The user's decision per issue —
// "accept" or "skip" — is later sent to ``/kg-to-class-diagram`` /
// ``/kg-to-object-diagram`` along with the ``kgSignature`` echoed here
// so the backend can detect a stale graph.
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { BACKEND_URL } from '../../shared/constants/constant';
import type { KgConversionTarget } from './useKgToUmlConversion';
import { getActiveKgDiagram } from './useKgToUmlConversion';

export interface KgAction {
  key: string;
  parameters: Record<string, unknown>;
  label: string;
}

export interface KgIssue {
  id: string;
  code: string;
  description: string;
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
  recommendedAction: KgAction | null;
  skipAction: KgAction | null;
}

export interface KgPreflightReport {
  kgSignature: string;
  diagramType: string;
  issueCount: number;
  issues: KgIssue[];
}

const DIAGRAM_TYPE_BY_TARGET: Record<KgConversionTarget, 'ClassDiagram' | 'ObjectDiagram'> = {
  kg_to_class: 'ClassDiagram',
  kg_to_object: 'ObjectDiagram',
};

export type PreflightStatus = 'idle' | 'loading' | 'success' | 'error';

export const useKgPreflight = () => {
  const [status, setStatus] = useState<PreflightStatus>('idle');
  const [report, setReport] = useState<KgPreflightReport | null>(null);

  const runPreflight = useCallback(
    async (target: KgConversionTarget): Promise<KgPreflightReport | null> => {
      const active = getActiveKgDiagram();
      if (!active) return null;
      const { diagram: kgDiagram } = active;

      setStatus('loading');
      try {
        const diagramType = DIAGRAM_TYPE_BY_TARGET[target];
        const url = `${BACKEND_URL}/analyze-kg-for-buml-conversion?diagramType=${diagramType}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: kgDiagram.id,
            title: kgDiagram.title,
            model: kgDiagram.model,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const data = (await response.json()) as KgPreflightReport;
        if (!data || !Array.isArray(data.issues)) {
          throw new Error('Invalid preflight response.');
        }
        setReport(data);
        setStatus('success');
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'KG preflight failed.';
        toast.error(message);
        setStatus('error');
        setReport(null);
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setReport(null);
  }, []);

  return { runPreflight, status, report, reset };
};
