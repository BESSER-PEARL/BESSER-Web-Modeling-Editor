// Unified Refine KG hook.
//
// Orchestrates the two tabs of the Refine KG modal:
//   - Static (Automatic) tab → /analyze-kg-for-buml-conversion + apply via /apply-kg-refinement
//   - LLM (AI) tab → /llm-clean-kg or /classify-orphans-with-llm + apply via /apply-kg-refinement
//
// Both apply legs return a cleaned KG; this hook dispatches
// ``updateDiagramModelThunk`` and bumps ``editorRevision`` so the canvas
// reinitialises with the new graph.
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { BACKEND_URL } from '../../shared/constants/constant';
import { useAppDispatch } from '../../app/store/hooks';
import {
  bumpEditorRevision,
  updateDiagramModelThunk,
} from '../../app/store/workspaceSlice';
import { displayError } from '../../app/store/errorManagementSlice';
import { getActiveKgDiagram } from './useKgToUmlConversion';
import type { KgIssue, KgPreflightReport } from './useKgPreflight';
import type { RowDecision } from './KgPreflightIssueRow';

export type RefineStatus = 'idle' | 'loading' | 'success' | 'error';

export interface PendingOrphanClassification {
  nodeIds: string[];
  kgSignature: string;
}

export interface ApplyStaticResult {
  pendingOrphanClassification: PendingOrphanClassification | null;
  newKgSignature: string;
}

export interface UseKgRefineReturn {
  // Static tab
  staticStatus: RefineStatus;
  staticReport: KgPreflightReport | null;
  runStatic: (diagramType?: 'ClassDiagram' | 'ObjectDiagram') => Promise<KgPreflightReport | null>;
  applyStatic: (
    decisions: Array<{ issueId: string; decision: RowDecision }>,
    kgSignature: string,
    diagramType?: 'ClassDiagram' | 'ObjectDiagram',
  ) => Promise<ApplyStaticResult | null>;

  // LLM tab
  llmStatus: RefineStatus;
  llmReport: KgPreflightReport | null;
  runLlmFullCleanup: (description: string, apiKey: string) => Promise<KgPreflightReport | null>;
  runLlmOrphanClassification: (
    description: string,
    apiKey: string,
    nodeIds: string[],
    kgSignature: string,
  ) => Promise<KgPreflightReport | null>;
  applyLlm: (
    decisions: Array<{ issueId: string; decision: RowDecision }>,
    issues: KgIssue[],
    kgSignature: string,
  ) => Promise<boolean>;

  reset: () => void;
}

export const useKgRefine = (): UseKgRefineReturn => {
  const dispatch = useAppDispatch();

  const [staticStatus, setStaticStatus] = useState<RefineStatus>('idle');
  const [staticReport, setStaticReport] = useState<KgPreflightReport | null>(null);
  const [llmStatus, setLlmStatus] = useState<RefineStatus>('idle');
  const [llmReport, setLlmReport] = useState<KgPreflightReport | null>(null);

  const runStatic = useCallback(
    async (
      diagramType: 'ClassDiagram' | 'ObjectDiagram' = 'ClassDiagram',
    ): Promise<KgPreflightReport | null> => {
      const active = getActiveKgDiagram();
      if (!active) return null;
      const { diagram: kgDiagram } = active;

      setStaticStatus('loading');
      try {
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
        setStaticReport(data);
        setStaticStatus('success');
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Static refinement analysis failed.';
        toast.error(message);
        setStaticStatus('error');
        setStaticReport(null);
        return null;
      }
    },
    [],
  );

  const applyStatic = useCallback(
    async (
      decisions: Array<{ issueId: string; decision: RowDecision }>,
      kgSignature: string,
      diagramType: 'ClassDiagram' | 'ObjectDiagram' = 'ClassDiagram',
    ): Promise<ApplyStaticResult | null> => {
      const active = getActiveKgDiagram();
      if (!active) return null;
      const { diagram: kgDiagram } = active;
      try {
        const body = {
          id: kgDiagram.id,
          title: kgDiagram.title,
          model: kgDiagram.model,
          source: 'static',
          kgSignature,
          resolutions: decisions,
        };
        const response = await fetch(
          `${BACKEND_URL}/apply-kg-refinement?diagramType=${diagramType}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!data?.model) {
          throw new Error('Apply endpoint returned no model.');
        }
        await dispatch(updateDiagramModelThunk({ model: data.model })).unwrap();
        dispatch(bumpEditorRevision());
        toast.success('Knowledge Graph refined.');
        return {
          pendingOrphanClassification: data.pendingOrphanClassification ?? null,
          newKgSignature: data.kgSignature,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Apply refinement failed.';
        dispatch(displayError('Refine KG failed', message));
        toast.error(message);
        return null;
      }
    },
    [dispatch],
  );

  const runLlmFullCleanup = useCallback(
    async (description: string, apiKey: string): Promise<KgPreflightReport | null> => {
      const active = getActiveKgDiagram();
      if (!active) return null;
      const { diagram: kgDiagram } = active;

      const desc = (description || '').trim();
      const key = (apiKey || '').trim();
      if (!desc) {
        toast.error('Describe the system you want to build first.');
        return null;
      }
      if (!key) {
        toast.error('An OpenAI API key is required.');
        return null;
      }

      setLlmStatus('loading');
      try {
        const formData = new FormData();
        formData.append(
          'diagram',
          JSON.stringify({
            id: kgDiagram.id,
            title: kgDiagram.title,
            model: kgDiagram.model,
          }),
        );
        formData.append('description', desc);
        formData.append('api_key', key);

        const response = await fetch(`${BACKEND_URL}/llm-clean-kg`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as KgPreflightReport;
        if (!data || !Array.isArray(data.issues)) {
          throw new Error('Invalid LLM cleanup response.');
        }
        setLlmReport(data);
        setLlmStatus('success');
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI refinement analysis failed.';
        toast.error(message);
        setLlmStatus('error');
        setLlmReport(null);
        return null;
      }
    },
    [],
  );

  const runLlmOrphanClassification = useCallback(
    async (
      description: string,
      apiKey: string,
      nodeIds: string[],
      kgSignature: string,
    ): Promise<KgPreflightReport | null> => {
      const active = getActiveKgDiagram();
      if (!active) return null;
      const { diagram: kgDiagram } = active;

      const desc = (description || '').trim();
      const key = (apiKey || '').trim();
      if (!desc) {
        toast.error('Describe the system you want to build first.');
        return null;
      }
      if (!key) {
        toast.error('An OpenAI API key is required.');
        return null;
      }
      if (!nodeIds.length) {
        toast.error('No orphan nodes to classify.');
        return null;
      }

      setLlmStatus('loading');
      try {
        const formData = new FormData();
        formData.append(
          'diagram',
          JSON.stringify({
            id: kgDiagram.id,
            title: kgDiagram.title,
            model: kgDiagram.model,
            kgSignature,
          }),
        );
        formData.append('description', desc);
        formData.append('api_key', key);
        formData.append('node_ids', JSON.stringify(nodeIds));

        const response = await fetch(`${BACKEND_URL}/classify-orphans-with-llm`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as KgPreflightReport;
        if (!data || !Array.isArray(data.issues)) {
          throw new Error('Invalid orphan-classification response.');
        }
        setLlmReport(data);
        setLlmStatus('success');
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Orphan classification failed.';
        toast.error(message);
        setLlmStatus('error');
        setLlmReport(null);
        return null;
      }
    },
    [],
  );

  const applyLlm = useCallback(
    async (
      decisions: Array<{ issueId: string; decision: RowDecision }>,
      issues: KgIssue[],
      kgSignature: string,
    ): Promise<boolean> => {
      const active = getActiveKgDiagram();
      if (!active) return false;
      const { diagram: kgDiagram } = active;
      try {
        const body = {
          id: kgDiagram.id,
          title: kgDiagram.title,
          model: kgDiagram.model,
          source: 'llm',
          kgSignature,
          llmIssues: issues,
          resolutions: decisions,
        };
        const response = await fetch(`${BACKEND_URL}/apply-kg-refinement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!data?.model) {
          throw new Error('Apply endpoint returned no model.');
        }
        await dispatch(updateDiagramModelThunk({ model: data.model })).unwrap();
        dispatch(bumpEditorRevision());
        toast.success('Knowledge Graph refined.');
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Apply LLM refinement failed.';
        dispatch(displayError('Refine KG failed', message));
        toast.error(message);
        return false;
      }
    },
    [dispatch],
  );

  const reset = useCallback(() => {
    setStaticStatus('idle');
    setStaticReport(null);
    setLlmStatus('idle');
    setLlmReport(null);
  }, []);

  return {
    staticStatus,
    staticReport,
    runStatic,
    applyStatic,
    llmStatus,
    llmReport,
    runLlmFullCleanup,
    runLlmOrphanClassification,
    applyLlm,
    reset,
  };
};
