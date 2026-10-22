import { toast } from 'react-toastify';
import type { ApollonEditor, Patch } from '@besser/wme';
import { BACKEND_URL } from '../../constants/constant';
import i18n from '../../i18n';
import { describeNetworkError, isNetworkError } from '../../utils/describeNetworkError';

export interface SimplificationItem {
  elementId?: string | null;
  changed: boolean;
  expression?: string | null;
  original?: string | null;
}

export interface SimplificationResponse {
  constraints: SimplificationItem[];
  warnings?: string[];
}

const TOAST_ID = 'constraint-simplification';
const WARNING_TOAST_ID = 'constraint-simplification-warnings';

/**
 * Rewrite every invariant into chapter-3 normal form. When the text changes,
 * the box shows the normalized expression and a comment linked to it keeps
 * the original. An unchanged box is left alone and gets no comment.
 */
export async function runConstraintSimplification(
  editor: ApollonEditor | null | undefined,
  diagramTitle: string,
): Promise<SimplificationResponse | null> {
  const model = editor?.model;
  if (!model) {
    toast.error(i18n.t('menu.generate.simplification.noDiagram'));
    return null;
  }
  if (model.type !== 'ClassDiagram') {
    toast.error(i18n.t('menu.generate.simplification.notClassDiagram'));
    return null;
  }

  toast.dismiss(WARNING_TOAST_ID);
  toast.loading(i18n.t('menu.generate.simplification.running'), {
    toastId: TOAST_ID,
    position: 'top-right',
    autoClose: false,
    closeOnClick: false,
    closeButton: false,
  });

  try {
    const response = await fetch(`${BACKEND_URL}/ocl/constraint-simplification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: diagramTitle, model }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = typeof errorData.detail === 'string' ? errorData.detail : '';
      const errors = Array.isArray(errorData.errors) ? errorData.errors.join('\n') : '';
      throw new Error(detail || errors || i18n.t('menu.generate.simplification.failed'));
    }
    const result = (await response.json()) as SimplificationResponse;
    const patches = patchesForSimplification(model, result);
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
    const changed = result.constraints.filter((item) => item.changed).length;
    toast.success(
      changed > 0
        ? i18n.t('menu.generate.simplification.done')
        : result.constraints.length > 0
          ? i18n.t('menu.generate.simplification.unchanged')
          : i18n.t('menu.generate.simplification.none'),
      { position: 'top-right' },
    );
    return result;
  } catch (error) {
    toast.dismiss(TOAST_ID);
    const message = isNetworkError(error)
      ? describeNetworkError(error)
      : error instanceof Error
        ? error.message
        : i18n.t('menu.generate.simplification.failed');
    toast.error(message, { position: 'top-right' });
    return null;
  }
}

interface DiagramModel {
  elements?: Record<string, { type?: string; name?: string; bounds?: { x: number; y: number; width: number; height: number } }>;
  relationships?: Record<string, { type?: string; source?: { element?: string }; target?: { element?: string } }>;
}

/** Patches that show the normalized text and attach the original as a comment. */
export function patchesForSimplification(model: DiagramModel, result: SimplificationResponse): Patch {
  const elements = model.elements ?? {};
  const patches: Patch = [];
  for (const item of result.constraints) {
    if (!item.changed || !item.elementId || !item.expression || !item.original) {
      continue;
    }
    const box = elements[item.elementId];
    if (!box || box.type !== 'ClassOCLConstraint') {
      continue;
    }
    // `add` replaces an existing member, so the box shows the normalized text.
    patches.push({ op: 'add', path: `/elements/${item.elementId}/constraint`, value: item.expression });
    if (commentAlreadyLinked(model, item.elementId, item.original)) {
      continue;
    }
    const commentId = crypto.randomUUID();
    const linkId = crypto.randomUUID();
    const bounds = box.bounds ?? { x: 0, y: 0, width: 160, height: 70 };
    const width = 300;
    const lines = Math.max(2, Math.ceil(item.original.length / 34));
    const height = Math.min(240, 28 + lines * 16);
    patches.push({
      op: 'add',
      path: `/elements/${commentId}`,
      value: {
        id: commentId,
        name: item.original,
        type: 'Comments',
        owner: null,
        bounds: {
          x: bounds.x + bounds.width + 36,
          y: bounds.y,
          width,
          height,
        },
      },
    });
    // A Link is a relationship. Putting it under elements makes the editor
    // construct it with the element registry, which has no Link constructor.
    patches.push({
      op: 'add',
      path: `/relationships/${linkId}`,
      value: {
        id: linkId,
        name: '',
        type: 'Link',
        owner: null,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        path: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
        isManuallyLayouted: false,
        source: { direction: 'Left', element: commentId, multiplicity: '', role: '' },
        target: { direction: 'Right', element: item.elementId, multiplicity: '', role: '' },
      },
    });
  }
  return patches;
}

function commentAlreadyLinked(model: DiagramModel, constraintId: string, text: string): boolean {
  const elements = model.elements ?? {};
  for (const relationship of Object.values(model.relationships ?? {})) {
    if (relationship?.type !== 'Link') {
      continue;
    }
    const ends = [relationship.source?.element, relationship.target?.element];
    if (!ends.includes(constraintId)) {
      continue;
    }
    const other = ends.find((id) => id && id !== constraintId);
    const comment = other ? elements[other] : undefined;
    if (comment?.type === 'Comments' && comment.name === text) {
      return true;
    }
  }
  return false;
}
