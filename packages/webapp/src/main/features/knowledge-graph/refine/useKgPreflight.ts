// Run the KG → BUML preflight against the backend and return a structured
// list of issues for the user to review.
//
// One issue = one "non-1-to-1" mapping. Each issue carries a
// ``recommendedAction`` (pre-checked checkbox in the modal) and a
// ``skipAction`` ("drop from output"). The user's decision per issue —
// "accept" or "skip" — is later sent to ``/kg/to-class-diagram`` along
// with the ``kgSignature`` echoed here so the backend can detect a stale
// graph.
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { analyzeKg, kgApiErrorMessage, type KgPreflightReport } from '../../../shared/api/knowledgeGraph';
import { getActiveKgDiagram } from '../activeKgDiagram';

export type PreflightStatus = 'idle' | 'loading' | 'success' | 'error';

/** `failedKey` is the i18n key of the message shown when the analysis fails
 *  without an explanation of its own (the Refine dialog names it differently). */
export const useKgPreflight = (failedKey = 'import.kg.preflight.failed') => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PreflightStatus>('idle');
  const [report, setReport] = useState<KgPreflightReport | null>(null);

  const runPreflight = useCallback(
    async (): Promise<KgPreflightReport | null> => {
      const active = getActiveKgDiagram();
      if (!active) return null;

      setStatus('loading');
      try {
        const data = await analyzeKg(active.diagram);
        if (!data || !Array.isArray(data.issues)) {
          throw new Error(t('import.kg.preflight.invalidResponse'));
        }
        setReport(data);
        setStatus('success');
        return data;
      } catch (error) {
        toast.error(kgApiErrorMessage(error, t, t(failedKey)));
        setStatus('error');
        setReport(null);
        return null;
      }
    },
    [t, failedKey],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setReport(null);
  }, []);

  return { runPreflight, status, report, reset };
};
