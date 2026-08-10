// Convert a Knowledge Graph diagram into a Class or Object Diagram via the
// backend's deterministic /kg-to-class-diagram and /kg-to-object-diagram
// endpoints, then open the result in a new tab in the current project.
//
// Two-phase API:
//   - getActiveKgDiagram(): returns the active KG diagram or null + a toast.
//   - convertKgToUml(target, options?): runs the conversion. ``options`` may
//     include ``resolutions`` (decision array from the preflight modal) and
//     ``kgSignature`` (echoed from the analyze response).
//
// Triggered from the Generate menu when in a KnowledgeGraphDiagram context.
import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import i18n from '../../shared/i18n';

import { BACKEND_URL } from '../../shared/constants/constant';
import { useAppDispatch } from '../../app/store/hooks';
import {
  addDiagramThunk,
  switchDiagramIndexThunk,
  switchDiagramTypeThunk,
} from '../../app/store/workspaceSlice';
import { displayError } from '../../app/store/errorManagementSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { getActiveDiagram } from '../../shared/types/project';
import type {
  BesserProject,
  ConsistencyReport,
  SupportedDiagramType,
} from '../../shared/types/project';
import { useKgConsistencyCheck } from './useKgConsistencyCheck';

export type KgConversionTarget = 'kg_to_class' | 'kg_to_object';

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

const ENDPOINT_BY_TARGET: Record<KgConversionTarget, string> = {
  kg_to_class: '/kg-to-class-diagram',
  kg_to_object: '/kg-to-object-diagram',
};

const DIAGRAM_TYPE_BY_TARGET: Record<KgConversionTarget, SupportedDiagramType> = {
  kg_to_class: 'ClassDiagram',
  kg_to_object: 'ObjectDiagram',
};

/** Suffix appended to the generated diagram's TITLE. Deliberately English and
 *  untranslated: the title is persisted into the project, so localising it
 *  would leave a French-authored project showing stale French titles when
 *  reopened in another language. The user-facing toast uses `diagramTypes.*`. */
const TITLE_SUFFIX_BY_TARGET: Record<KgConversionTarget, string> = {
  kg_to_class: 'Class Diagram',
  kg_to_object: 'Object Diagram',
};

/** Localised display name for the same target, used in toasts only. */
const DIAGRAM_TYPE_KEY_BY_TARGET: Record<KgConversionTarget, string> = {
  kg_to_class: 'diagramTypes.ClassDiagram',
  kg_to_object: 'diagramTypes.ObjectDiagram',
};

/**
 * Surface unique warning codes from the backend response as toast warnings,
 * one per code, so users see anomalies (UNDECLARED_CLASS, BLANK_SKIPPED, …)
 * without being spammed when many edges trigger the same code.
 */
function reportWarnings(warnings: unknown): void {
  if (!Array.isArray(warnings)) return;
  const seen = new Set<string>();
  for (const warning of warnings as Array<Record<string, unknown>>) {
    const code = typeof warning?.code === 'string' ? warning.code : '';
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const message = typeof warning?.message === 'string' ? warning.message : code;
    toast.warn(message, { toastId: `kg-conv-${code}` });
  }
}

/**
 * Look up the currently-active KnowledgeGraphDiagram. Returns ``null`` and
 * shows a toast if no project / no KG diagram is active.
 */
export function getActiveKgDiagram(): { project: BesserProject; diagram: any } | null {
  // Plain module function, not a hook -- called from six sites across
  // useKgRefine / useKgPreflight. Reads the i18n singleton (resolved at call
  // time, so always the current language) rather than changing six signatures.
  const project = ProjectStorageRepository.getCurrentProject() as BesserProject | null;
  if (!project) {
    toast.error(i18n.t('import.kg.toUml.noProject'));
    return null;
  }
  const diagram = getActiveDiagram(project, 'KnowledgeGraphDiagram');
  if (!diagram || !diagram.model) {
    toast.error(i18n.t('import.kg.toUml.noDiagram'));
    return null;
  }
  return { project, diagram };
}

export const useKgToUmlConversion = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const checkConsistency = useKgConsistencyCheck();

  return useCallback(
    async (target: KgConversionTarget, options: KgConvertOptions = {}): Promise<void> => {
      const active = getActiveKgDiagram();
      if (!active) return;
      const { project, diagram: kgDiagram } = active;

      // Pre-conversion OWL/SHACL consistency gate. Skipped on explicit
      // request (e.g. when the gate's "Proceed anyway" callback re-runs
      // the conversion) or when no handler is wired up.
      if (!options.skipConsistencyGate && options.onConsistencyIssues) {
        try {
          const consistencyReport = await checkConsistency(kgDiagram);
          if (consistencyReport.issueCount > 0) {
            const decision = await options.onConsistencyIssues(consistencyReport);
            if (decision === 'cancel') return;
          }
        } catch (err) {
          // The check is advisory — if the endpoint fails we surface a toast
          // and continue with the conversion rather than blocking the user.
          const message = err instanceof Error ? err.message : t('import.kg.toUml.consistencyCheckFailed');
          toast.warn(t('import.kg.toUml.consistencyCheckSkipped', { message }));
        }
      }

      try {
        const body: Record<string, unknown> = {
          id: kgDiagram.id,
          title: kgDiagram.title,
          model: kgDiagram.model,
        };
        if (options.resolutions && options.resolutions.length) {
          body.resolutions = options.resolutions;
        }
        if (options.kgSignature) {
          body.kgSignature = options.kgSignature;
        }

        const response = await fetch(`${BACKEND_URL}${ENDPOINT_BY_TARGET[target]}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data?.model || !data?.diagramType) {
          throw new Error(t('import.kg.toUml.invalidResponse'));
        }

        reportWarnings(data.warnings);

        const targetType = DIAGRAM_TYPE_BY_TARGET[target];
        const baseTitle = kgDiagram.title || project.name || 'KG';
        const newTitle = `${baseTitle} (${TITLE_SUFFIX_BY_TARGET[target]})`;

        const addResult = await dispatch(
          addDiagramThunk({ diagramType: targetType, title: newTitle }),
        ).unwrap();

        ProjectStorageRepository.updateDiagram(
          project.id,
          targetType,
          {
            ...addResult.diagram,
            model: data.model,
            lastUpdate: new Date().toISOString(),
          },
          addResult.index,
        );

        await dispatch(switchDiagramTypeThunk({ diagramType: targetType }));
        await dispatch(switchDiagramIndexThunk({ diagramType: targetType, index: addResult.index }));

        toast.success(
          t('import.kg.toUml.generated', { diagram: t(DIAGRAM_TYPE_KEY_BY_TARGET[target]) }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : t('import.kg.toUml.conversionFailed');
        dispatch(displayError(t('import.kg.toUml.failedTitle'), message));
        toast.error(message);
      }
    },
    [dispatch, checkConsistency, t],
  );
};
