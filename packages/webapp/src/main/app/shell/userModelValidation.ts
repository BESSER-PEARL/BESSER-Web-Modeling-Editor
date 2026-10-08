import { localStorageUserModelValidation } from '../../shared/constants/constant';
import type { QualityCheckState } from '../../features/generation/types';

/**
 * Per-diagram record of the last User Model validation, persisted so the
 * "validate before leaving" prompt survives reloads. `outcome: 'unvalidated'`
 * is a baseline taken when the diagram is first opened: leaving without edits
 * since then never prompts.
 */
export interface UserModelValidationRecord {
  validatedAt: string | null;
  outcome: 'valid' | 'errors' | 'unvalidated';
  fingerprint: string | null;
  /** Model state the user chose to leave without validating; not asked again for it. */
  dismissedFingerprint?: string | null;
}

export type UserModelValidationRecords = Record<string, UserModelValidationRecord>;

const fnv1a = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}.${text.length}`;
};

/**
 * Hash of what validation looks at. Layout (positions, sizes, edge bend
 * points, selection) is left out: moving a node does not need re-validation.
 */
export const semanticModelFingerprint = (model: unknown): string | null => {
  if (!model || typeof model !== 'object') return null;
  const { nodes, edges } = model as { nodes?: unknown; edges?: unknown };
  try {
    if (!Array.isArray(nodes) || !Array.isArray(edges)) return fnv1a(JSON.stringify(model));
    const semantic = {
      nodes: nodes.map((n: any) => [n?.id, n?.type, n?.parentId ?? null, n?.data ?? null]),
      edges: edges.map((e: any) => {
        const { points: _points, ...data } = (e?.data ?? {}) as Record<string, unknown>;
        return [e?.id, e?.type, e?.source, e?.target, data];
      }),
    };
    return fnv1a(JSON.stringify(semantic));
  } catch {
    return null;
  }
};

export const loadUserModelValidationRecords = (): UserModelValidationRecords => {
  try {
    const parsed = JSON.parse(localStorage.getItem(localStorageUserModelValidation) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const saveUserModelValidationRecords = (records: UserModelValidationRecords): void => {
  try {
    localStorage.setItem(localStorageUserModelValidation, JSON.stringify(records));
  } catch {
    // Storage full or unavailable: the records stay in memory for this tab.
  }
};

export const userModelValidationStatus = (
  record: UserModelValidationRecord | undefined,
  model: unknown,
): QualityCheckState => {
  if (!record || record.outcome === 'unvalidated') return 'not_validated';
  return record.fingerprint === semanticModelFingerprint(model) ? record.outcome : 'stale';
};

/**
 * True only when the model changed since it was last validated (or first
 * opened) and the user has not already declined to validate this state.
 */
export const shouldPromptBeforeLeaving = (record: UserModelValidationRecord | undefined, model: unknown): boolean => {
  if (!record) return false;
  const current = semanticModelFingerprint(model);
  return current !== record.fingerprint && current !== record.dismissedFingerprint;
};
