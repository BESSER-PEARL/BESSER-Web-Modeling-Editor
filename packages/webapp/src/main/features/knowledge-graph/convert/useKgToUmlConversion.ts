// Convert a Knowledge Graph diagram into a Class Diagram via the backend's
// deterministic /kg/to-class-diagram endpoint, then open the result in a new
// tab in the current project.
//
// The hook returns `convert(options?)`. ``options`` may include
// ``resolutions`` (decision array from the preflight modal) and
// ``kgSignature`` (echoed from the analyze response).
//
// Triggered from the Generate menu when in a KnowledgeGraphDiagram context.
import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { checkKgConsistency, kgApiErrorMessage, kgToClassDiagram } from '../../../shared/api/knowledgeGraph';
import { reportKgWarnings } from '../../../shared/kg/reportKgWarnings';
import { useAppDispatch } from '../../../app/store/hooks';
import {
  addDiagramThunk,
  switchDiagramIndexThunk,
  switchDiagramTypeThunk,
} from '../../../app/store/workspaceSlice';
import { displayError } from '../../../app/store/errorManagementSlice';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import type { ConsistencyReport, SupportedDiagramType } from '../../../shared/types/project';
import { getActiveKgDiagram } from '../activeKgDiagram';

export interface KgConvertOptions {
  resolutions?: Array<{ issueId: string; decision: 'accept' | 'skip' }>;
  kgSignature?: string;
  /** Skip the pre-conversion consistency gate. Used when the gate's
   *  `onProceed` re-invokes the conversion — we don't want to ask twice. */
  skipConsistencyGate?: boolean;
  /** Optional handler called when the consistency check found at least one
   *  issue. Returns a promise that resolves with the user's choice:
   *    - `"proceed"`: continue with the conversion;
   *    - `"cancel"`: abort silently.
   *  When omitted, the conversion proceeds without showing a gate (back-compat). */
  onConsistencyIssues?: (report: ConsistencyReport) => Promise<'proceed' | 'cancel'>;
}

const TARGET_DIAGRAM_TYPE: SupportedDiagramType = 'ClassDiagram';

/** Suffix appended to the generated diagram's TITLE. Deliberately English and
 *  untranslated: the title is persisted into the project, so localising it
 *  would leave a French-authored project showing stale French titles when
 *  reopened in another language. The user-facing toast uses `diagramTypes.*`. */
const TITLE_SUFFIX = 'Class Diagram';

/** Localised display name for the same diagram, used in toasts only. */
const DIAGRAM_TYPE_KEY = 'diagramTypes.ClassDiagram';

export const useKgToUmlConversion = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return useCallback(
    async (options: KgConvertOptions = {}): Promise<void> => {
      const active = getActiveKgDiagram();
      if (!active) return;
      const { project, diagram: kgDiagram } = active;

      // Pre-conversion OWL/SHACL consistency gate. Skipped on explicit
      // request (e.g. when the gate's "Proceed anyway" callback re-runs
      // the conversion) or when no handler is wired up.
      if (!options.skipConsistencyGate && options.onConsistencyIssues) {
        try {
          const consistencyReport = await checkKgConsistency(kgDiagram);
          if (consistencyReport.issueCount > 0) {
            const decision = await options.onConsistencyIssues(consistencyReport);
            if (decision === 'cancel') return;
          }
        } catch (err) {
          // The check is advisory — if the endpoint fails we surface a toast
          // and continue with the conversion rather than blocking the user.
          const message = kgApiErrorMessage(err, t, t('import.kg.toUml.consistencyCheckFailed'));
          toast.warn(t('import.kg.toUml.consistencyCheckSkipped', { message }));
        }
      }

      try {
        const data = await kgToClassDiagram({
          diagram: kgDiagram,
          resolutions: options.resolutions,
          kgSignature: options.kgSignature,
        });
        if (!data?.model || !data?.diagramType) {
          throw new Error(t('import.kg.toUml.invalidResponse'));
        }

        reportKgWarnings(data.warnings, 'kg-conv');

        const baseTitle = kgDiagram.title || project.name || 'KG';
        const newTitle = `${baseTitle} (${TITLE_SUFFIX})`;

        const addResult = await dispatch(
          addDiagramThunk({ diagramType: TARGET_DIAGRAM_TYPE, title: newTitle }),
        ).unwrap();

        ProjectStorageRepository.updateDiagram(
          project.id,
          TARGET_DIAGRAM_TYPE,
          {
            ...addResult.diagram,
            model: data.model,
            lastUpdate: new Date().toISOString(),
          },
          addResult.index,
        );

        await dispatch(switchDiagramTypeThunk({ diagramType: TARGET_DIAGRAM_TYPE }));
        await dispatch(switchDiagramIndexThunk({ diagramType: TARGET_DIAGRAM_TYPE, index: addResult.index }));

        toast.success(t('import.kg.toUml.generated', { diagram: t(DIAGRAM_TYPE_KEY) }));
      } catch (error) {
        const message = kgApiErrorMessage(error, t, t('import.kg.toUml.conversionFailed'));
        dispatch(displayError(t('import.kg.toUml.failedTitle'), message));
        toast.error(message);
      }
    },
    [dispatch, t],
  );
};
