/**
 * How the project's model relates to the model a base run was built from,
 * read from `POST /spec-driven/preview` (no LLM call, no key) before a modify
 * run starts. See `decideRunMode`.
 */

import { SMART_GEN_PREVIEW_ENDPOINT } from '../../../shared/constants/constant';
import type { GlobalConfirmOptions } from '../../../shared/services/confirm/globalConfirm';
import type { ModelChange } from '../runModeDecision';

/** Short: the run is waiting on this answer. */
export const MODEL_CHANGE_TIMEOUT_MS = 8_000;

const VERDICTS = new Set(['small', 'large', 'unrelated']);

const names = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

/** `{from, to}` objects or `[from, to]` pairs; anything else is skipped. */
const renames = (value: unknown): { from: string; to: string }[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const [from, to] = Array.isArray(item) ? item : [item?.from, item?.to];
        return typeof from === 'string' && typeof to === 'string' ? [{ from, to }] : [];
      })
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
    if (!response.ok) return null;
    const change = (await response.json())?.model_change;
    if (!change || !VERDICTS.has(change.verdict) || typeof change.gone !== 'number') {
      return null;
    }
    return {
      verdict: change.verdict,
      gone: change.gone,
      removed: names(change.removed),
      added: names(change.added),
      renamed: renames(change.renamed),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

function listed(label: string, items: string[]): string {
  if (items.length === 0) return '';
  const shown = items.slice(0, 6).join(', ');
  const more = items.length > 6 ? ` and ${items.length - 6} more` : '';
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
    listed('Renamed', (change.renamed ?? []).map((r) => `${r.from} → ${r.to}`));
  return verdict === 'unrelated'
    ? {
        title: 'This looks like a different app',
        description:
          `Most of the model your app was built from is gone.${diff} ` +
          'Starting fresh is recommended: it builds a clean app from the current ' +
          'diagram. Updating adapts the existing code and can leave parts of the ' +
          'old app behind.',
        confirmLabel: 'Start fresh',
        cancelLabel: 'Update the existing app',
      }
    : {
        title: 'Your class diagram changed a lot',
        description:
          `About ${Math.round(change.gone * 100)}% of the model your app was built ` +
          `from was removed or renamed.${diff} Updating keeps the custom work in ` +
          'the existing app, but old enumerations, methods and relationships may ' +
          'stay in the code. Starting fresh builds a clean app from the current ' +
          'diagram, without that work.',
        confirmLabel: 'Start fresh',
        cancelLabel: 'Update the existing app',
      };
}
