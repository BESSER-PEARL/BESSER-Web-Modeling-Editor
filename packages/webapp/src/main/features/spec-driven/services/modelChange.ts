/**
 * How the project's model relates to the model a base run was built from,
 * read from `POST /spec-driven/preview` (no LLM call, no key) before a modify
 * run starts. See `resolveRunMode`.
 */

import { previewSpecDrivenRun } from '../../../shared/api/specDriven';
import { ApiError } from '../../../shared/api/api-client';
import type { GlobalConfirmOptions } from '../../../shared/services/confirm/globalConfirm';
import type { components } from '../../../shared/api/generated/besser-openapi';

/**
 * `model_change` in the preview response (backend `ModelChange.to_dict`), less
 * the `changes` lines the question does not show. `gone` is the share of the
 * base model's classes and attributes removed, or attributes renamed (a class
 * rename or a case-only rename does not count); renames are not in
 * `removed`/`added`.
 */
export type ModelChange = Omit<components['schemas']['ModelChangeResponse'], 'changes'>;

/** Short: the run is waiting on this answer. */
export const MODEL_CHANGE_TIMEOUT_MS = 8_000;

/** Names listed per kind in the question; the rest are counted. */
const MAX_LISTED_NAMES = 6;

const VERDICTS = new Set(['small', 'large', 'unrelated']);

const names = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

const renames = (value: unknown): ModelChange['renamed'] =>
  Array.isArray(value)
    ? value.filter((r) => typeof r?.from === 'string' && typeof r?.to === 'string')
        .map((r) => ({ from: r.from, to: r.to }))
    : [];

/** The comparison, or null when it is unavailable or `signal` aborts. Never rejects. */
export async function fetchModelChange(
  project: unknown,
  instructions: string,
  baseRunId: string,
  signal?: AbortSignal,
): Promise<ModelChange | null> {
  try {
    const response = await previewSpecDrivenRun(
      { project, instructions, mode: 'modify', base_run_id: baseRunId },
      { signal, timeout: MODEL_CHANGE_TIMEOUT_MS },
    );
    const change = response?.model_change;
    if (!change || !VERDICTS.has(change.verdict) || typeof change.gone !== 'number') {
      return null;
    }
    return {
      verdict: change.verdict,
      basis: change.basis === 'classes' ? 'classes' : 'attributes',
      gone: change.gone,
      removed: names(change.removed),
      added: names(change.added),
      renamed: renames(change.renamed),
    };
  } catch (err) {
    if (err instanceof ApiError) {
      console.warn(`[modelChange] preview returned ${err.status}; modifying without the check`);
    } else if (!signal?.aborted) {
      console.warn('[modelChange] preview failed; modifying without the check', err);
    }
    return null;
  }
}

function listed(label: string, items: string[]): string {
  if (items.length === 0) return '';
  const shown = items.slice(0, MAX_LISTED_NAMES).join(', ');
  const more =
    items.length > MAX_LISTED_NAMES ? ` and ${items.length - MAX_LISTED_NAMES} more` : '';
  return ` ${label}: ${shown}${more}.`;
}

/**
 * The question asked before such a run. Confirm = start fresh; cancel or
 * dismiss = update the existing app, which is what happened before asking.
 */
export function modelChangeQuestion(
  verdict: 'large' | 'unrelated',
  change: ModelChange,
): GlobalConfirmOptions {
  const diff =
    listed('Removed', change.removed) +
    listed('Added', change.added) +
    listed('Renamed', change.renamed.map((r) => `${r.from} → ${r.to}`));
  const goneText =
    change.basis === 'classes'
      ? 'of the classes your app was built from were removed'
      : 'of the model your app was built from was removed or had attributes renamed';
  return verdict === 'unrelated'
    ? {
        title: 'This looks like a different app',
        description:
          `Most ${goneText}.${diff} ` +
          'Starting fresh is recommended: it builds a clean app from the current ' +
          'diagram. Updating adapts the existing code and can leave parts of the ' +
          'old app behind.',
        confirmLabel: 'Start fresh',
        cancelLabel: 'Update the existing app',
      }
    : {
        title: 'Your class diagram changed a lot',
        description:
          `About ${Math.round(change.gone * 100)}% ${goneText}.${diff} Updating keeps ` +
          'the custom work in the existing app, but old enumerations, methods and relationships may ' +
          'stay in the code. Starting fresh builds a clean app from the current ' +
          'diagram, without that work.',
        confirmLabel: 'Start fresh',
        cancelLabel: 'Update the existing app',
      };
}
