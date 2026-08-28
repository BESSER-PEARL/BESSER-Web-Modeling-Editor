// Unified Refine KG hook.
//
// Orchestrates the two tabs of the Refine KG modal:
//   - Static (Automatic) tab → /analyze-kg-for-buml-conversion + apply via /apply-kg-refinement
//   - LLM (AI) tab → /llm-clean-kg or /classify-orphans-with-llm + apply via /apply-kg-refinement
//
// Both apply legs return a cleaned KG; this hook dispatches
// ``updateDiagramModelThunk`` and bumps ``editorRevision`` so the canvas
// reinitialises with the new graph.
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

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
  runStatic: () => Promise<KgPreflightReport | null>;
  applyStatic: (
    decisions: Array<{ issueId: string; decision: RowDecision }>,
    kgSignature: string,
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
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [staticStatus, setStaticStatus] = useState<RefineStatus>('idle');
  const [staticReport, setStaticReport] = useState<KgPreflightReport | null>(null);
  const [llmStatus, setLlmStatus] = useState<RefineStatus>('idle');
  const [llmReport, setLlmReport] = useState<KgPreflightReport | null>(null);

  const runStatic = useCallback(
    async (): Promise<KgPreflightReport | null> => {
      const active = getActiveKgDiagram();
      if (!active) return null;
      const { diagram: kgDiagram } = active;

      setStaticStatus('loading');
      try {
        const url = `${BACKEND_URL}/analyze-kg-for-buml-conversion`;
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
          const errorData = await response.json().catch(() => ({ detail: t('import.kg.preflight.unknownError') }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as KgPreflightReport;
        if (!data || !Array.isArray(data.issues)) {
          throw new Error(t('import.kg.preflight.invalidResponse'));
        }
        setStaticReport(data);
        setStaticStatus('success');
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : t('import.kg.refine.staticFailed');
        toast.error(message);
        setStaticStatus('error');
        setStaticReport(null);
        return null;
      }
    },
    [t],
  );

  const applyStatic = useCallback(
    async (
      decisions: Array<{ issueId: string; decision: RowDecision }>,
      kgSignature: string,
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
          `${BACKEND_URL}/apply-kg-refinement`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: t('import.kg.preflight.unknownError') }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!data?.model) {
          throw new Error(t('import.kg.refine.applyNoModel'));
        }
        await dispatch(updateDiagramModelThunk({ model: data.model })).unwrap();
        dispatch(bumpEditorRevision());
        toast.success(t('import.kg.refine.refined'));
        return {
          pendingOrphanClassification: data.pendingOrphanClassification ?? null,
          newKgSignature: data.kgSignature,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : t('import.kg.refine.applyFailed');
        dispatch(displayError(t('import.kg.refine.failedTitle'), message));
        toast.error(message);
        return null;
      }
    },
    [dispatch, t],
  );

  const runLlmFullCleanup = useCallback(
    async (description: string, apiKey: string): Promise<KgPreflightReport | null> => {
      const active = getActiveKgDiagram();
      if (!active) return null;
      const { diagram: kgDiagram } = active;

      const desc = (description || '').trim();
      const key = (apiKey || '').trim();
      if (!desc) {
        toast.error(t('import.kg.refine.describeSystemFirst'));
        return null;
      }
      if (!key) {
        toast.error(t('import.kg.refine.apiKeyRequired'));
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
          const errorData = await response.json().catch(() => ({ detail: t('import.kg.preflight.unknownError') }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as KgPreflightReport;
        if (!data || !Array.isArray(data.issues)) {
          throw new Error(t('import.kg.refine.invalidLlmResponse'));
        }
        setLlmReport(data);
        setLlmStatus('success');
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : t('import.kg.refine.aiFailed');
        toast.error(message);
        setLlmStatus('error');
        setLlmReport(null);
        return null;
      }
    },
    [t],
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
        toast.error(t('import.kg.refine.describeSystemFirst'));
        return null;
      }
      if (!key) {
        toast.error(t('import.kg.refine.apiKeyRequired'));
        return null;
      }
      if (!nodeIds.length) {
        toast.error(t('import.kg.refine.noOrphans'));
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
          const errorData = await response.json().catch(() => ({ detail: t('import.kg.preflight.unknownError') }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as KgPreflightReport;
        if (!data || !Array.isArray(data.issues)) {
          throw new Error(t('import.kg.refine.invalidOrphanResponse'));
        }
        setLlmReport(data);
        setLlmStatus('success');
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : t('import.kg.refine.orphanFailed');
        toast.error(message);
        setLlmStatus('error');
        setLlmReport(null);
        return null;
      }
    },
    [t],
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
          const errorData = await response.json().catch(() => ({ detail: t('import.kg.preflight.unknownError') }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!data?.model) {
          throw new Error(t('import.kg.refine.applyNoModel'));
        }
        await dispatch(updateDiagramModelThunk({ model: data.model })).unwrap();
        dispatch(bumpEditorRevision());
        toast.success(t('import.kg.refine.refined'));
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : t('import.kg.refine.applyLlmFailed');
        dispatch(displayError(t('import.kg.refine.failedTitle'), message));
        toast.error(message);
        return false;
      }
    },
    [dispatch, t],
  );

  const reset = useCallback(() => {
    setStaticStatus('idle');
    setStaticReport(null);
    setLlmStatus('idle');
    setLlmReport(null);
  }, []);

  return useMemo(
    () => ({
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
    }),
    [
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
    ],
  );
};
