import { toast } from 'react-toastify';
import type { ApollonEditor, Patch } from '@besser/wme';
import { BACKEND_URL } from '../../constants/constant';
import i18n from '../../i18n';
import { describeNetworkError, isNetworkError } from '../../utils/describeNetworkError';

export interface PreanalysisEvent {
  constraint?: string | null;
  kind: string;
  class?: string;
  attribute?: string;
  association?: string;
  approximated?: boolean;
}

export interface PreanalysisConstraint {
  name: string;
  elementId?: string | null;
  source?: string | null;
  warnings?: string[];
  events: PreanalysisEvent[];
}

export interface PreanalysisResponse {
  constraints: PreanalysisConstraint[];
  warnings?: string[];
}

const TOAST_ID = 'incremental-preanalysis';
const WARNING_TOAST_ID = 'incremental-preanalysis-warnings';

/**
 * Ask the backend which structural events may violate each invariant, then
 * store the result on the OCL boxes. The editor does not recompute this on edit.
 */
export async function runIncrementalPreanalysis(
  editor: ApollonEditor | null | undefined,
  diagramTitle: string,
): Promise<PreanalysisResponse | null> {
  const model = editor?.model;
  if (!model) {
    toast.error(i18n.t('menu.generate.preanalysis.noDiagram'));
    return null;
  }
  if (model.type !== 'ClassDiagram') {
    toast.error(i18n.t('menu.generate.preanalysis.notClassDiagram'));
    return null;
  }

  // A previous run's warning stays on screen (it does not auto-close). A new run replaces it.
  toast.dismiss(WARNING_TOAST_ID);
  toast.loading(i18n.t('menu.generate.preanalysis.running'), {
    toastId: TOAST_ID,
    position: 'top-right',
    autoClose: false,
    closeOnClick: false,
    closeButton: false,
  });

  try {
    const response = await fetch(`${BACKEND_URL}/ocl/incremental-preanalysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: diagramTitle, model }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = typeof errorData.detail === 'string' ? errorData.detail : '';
      const errors = Array.isArray(errorData.errors) ? errorData.errors.join('\n') : '';
      throw new Error(detail || errors || i18n.t('menu.generate.preanalysis.failed'));
    }
    const result = (await response.json()) as PreanalysisResponse;
    const patches = patchesFor(editor, result);
    if (patches.length > 0) {
      editor.importPatch(patches);
    }
    toast.dismiss(TOAST_ID);
    if (result.warnings && result.warnings.length > 0) {
      toast.warning(result.warnings.join('\n'), {
        toastId: WARNING_TOAST_ID,
        position: 'top-right',
        autoClose: false,
      });
    }
    toast.success(
      result.constraints.length > 0
        ? i18n.t('menu.generate.preanalysis.done')
        : i18n.t('menu.generate.preanalysis.none'),
      { position: 'top-right' },
    );
    return result;
  } catch (error) {
    toast.dismiss(TOAST_ID);
    const message = isNetworkError(error)
      ? describeNetworkError(error)
      : error instanceof Error
        ? error.message
        : i18n.t('menu.generate.preanalysis.failed');
    toast.error(message, { position: 'top-right' });
    return null;
  }
}

function patchesFor(editor: ApollonEditor, result: PreanalysisResponse): Patch {
  const elements = editor.model?.elements ?? {};
  const byElement = new Map<string, { events: PreanalysisEvent[]; source: string }>();
  for (const item of result.constraints) {
    if (!item.elementId || !elements[item.elementId]) {
      continue;
    }
    const current = byElement.get(item.elementId) ?? { events: [], source: item.source ?? '' };
    current.events.push(...(item.events ?? []));
    if (item.source) {
      current.source = item.source;
    }
    byElement.set(item.elementId, current);
  }
  const patches: Patch = [];
  for (const [id, value] of byElement) {
    // `add` replaces an existing member, so a second run overwrites the first.
    patches.push({ op: 'add', path: `/elements/${id}/violatingEvents`, value: value.events });
    patches.push({ op: 'add', path: `/elements/${id}/violatingEventsSource`, value: value.source });
  }
  return patches;
}
