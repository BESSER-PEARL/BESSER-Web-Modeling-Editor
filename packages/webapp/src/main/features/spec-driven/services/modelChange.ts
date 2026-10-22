/**
 * How the project's model relates to the model a base run was built from,
 * read from `POST /spec-driven/preview` (no LLM call, no key) before a modify
 * run starts. See `resolveRunMode`.
 */

import { SMART_GEN_PREVIEW_ENDPOINT } from '../../../shared/constants/constant';
import type { GlobalConfirmOptions } from '../../../shared/services/confirm/globalConfirm';

/**
 * `model_change` in the preview response; the backend side is
 * `ModelChange.to_dict` in `besser/spec_driven_agent/planning/model_change.py`.
 */
export interface ModelChange {
  verdict: 'small' | 'large' | 'unrelated';
  /** `classes` when the base run recorded class names only. */
  basis: 'attributes' | 'classes';
  /** Share of the base model's classes (and attributes) with no match in the new one; a recognised rename is a match. */
  gone: number;
  /** "Class" / "Class.attribute" names gone from, and new in, the model; renames excluded. */
  removed: string[];
  added: string[];
  renamed: { from: string; to: string }[];
}

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_CHANGE_TIMEOUT_MS);
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop);
  try {
    const response = await fetch(SMART_GEN_PREVIEW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project,
        instructions,
        mode: 'modify',
        base_run_id: baseRunId,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[modelChange] preview returned ${response.status}; modifying without the check`);
      return null;
    }
    const change = (await response.json())?.model_change;
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
    if (!signal?.aborted) {
      console.warn('[modelChange] preview failed; modifying without the check', err);
    }
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
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
  const elements = change.basis === 'classes' ? 'classes' : 'classes and attributes';
  return verdict === 'unrelated'
    ? {
        title: 'This looks like a different app',
        description:
          `Most of the ${elements} your app was built from have no match in the ` +
          `current diagram.${diff} ` +
          'Starting fresh is recommended: it builds a clean app from the current ' +
          'diagram. Updating adapts the existing code and can leave parts of the ' +
          'old app behind.',
        confirmLabel: 'Start fresh',
        cancelLabel: 'Update the existing app',
      }
    : {
        title: 'Your class diagram changed a lot',
        description:
          `About ${Math.round(change.gone * 100)}% of the ${elements} your app was ` +
          `built from have no match in the current diagram.${diff} Updating keeps ` +
          'the custom work in the existing app, but old enumerations, methods and relationships may ' +
          'stay in the code. Starting fresh builds a clean app from the current ' +
          'diagram, without that work.',
        confirmLabel: 'Start fresh',
        cancelLabel: 'Update the existing app',
      };
}
