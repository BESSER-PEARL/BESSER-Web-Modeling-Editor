/**
 * suggestedActionRouting — decide what a post-generation suggestion chip does.
 *
 * The assistant surfaces backend-defined `{ label, prompt }` chips after a GUI
 * is generated. Most relay their prompt to the agent as a chat message
 * ("Generate web app", "Generate read frontend"). But a "Modify the GUI" chip
 * has no actionable prompt for the agent, so relaying it looks dead. Instead,
 * such chips should switch the editor to the GUI tab so the user can edit it
 * directly.
 *
 * This is a pure decision helper so it can be unit-tested and shared by the
 * drawer and widget handlers.
 */

export interface GuiActionRouteInput {
  label?: string;
  prompt?: string;
  /** Optional explicit routing hint the backend can send (e.g. 'open-gui'). */
  action?: string;
  /** `show-trace` chips: the Traceability view to open and, optionally, the artifact to start from. */
  traceView?: string;
  traceArtifactId?: string;
}

/**
 * Sentinel prompt the agent sends for the "Review the spec" chip after a
 * class diagram is built. It is NOT a message for the agent: the assistant
 * surfaces intercept it and collapse/close the assistant panel so the user
 * sees the diagram already rendered on the canvas.
 */
export const REVIEW_SPEC_PROMPT = 'wme:review-spec';

/**
 * True when a chip is the "Review the spec" action — it must close the
 * assistant panel to reveal the diagram, never relay its prompt to the agent.
 * Matches either the ``wme:review-spec`` sentinel prompt or an explicit
 * ``action: 'review-spec'`` hint.
 */
export function isReviewSpecAction(input: GuiActionRouteInput | null | undefined): boolean {
  if (!input) return false;
  if (input.action === 'review-spec') return true;
  return input.prompt === REVIEW_SPEC_PROMPT;
}

/** Matches "see/open/view/show/modify/edit … gui" in either the label or prompt. */
const GUI_OPEN_RE = /\b(see|open|view|show|modify|edit)\b[^.]*\bgui\b/i;

/**
 * A generate *command* must always relay its prompt, never hijack to the GUI
 * tab. Anchored at the start so it only catches actual generation chips
 * ("Generate web app", "Generate read frontend") — not a modify chip whose text
 * merely mentions the "generated" GUI.
 */
const GENERATE_RE = /^\s*generat/i;

/**
 * Returns true when the chip should switch to the GUI tab instead of relaying
 * its prompt to the agent.
 *
 * - An explicit `action: 'open-gui'` always routes to the GUI tab.
 * - "Generate …" actions always relay (so "Generate web app" / "Generate read
 *   frontend" are unaffected), even if their text happens to mention the GUI.
 * - Otherwise, a label/prompt that reads like "modify/open/view … GUI" routes
 *   to the GUI tab (makes the current "Modify the GUI" chip work with no
 *   backend change).
 */
export function shouldOpenGuiTab(input: GuiActionRouteInput | null | undefined): boolean {
  if (!input) return false;
  if (input.action === 'open-gui') return true;

  const label = input.label ?? '';
  const prompt = input.prompt ?? '';

  if (GENERATE_RE.test(label) || GENERATE_RE.test(prompt)) return false;

  return GUI_OPEN_RE.test(label) || GUI_OPEN_RE.test(prompt);
}

/** The `action` of a chip that opens the Traceability page (the agent's `show_trace` reply). */
export const SHOW_TRACE_CHIP_ACTION = 'show-trace';

/** The views the agent may ask for; each is a tab of the Traceability page. */
export const TRACE_VIEWS = ['lineage', 'coverage', 'timeline'] as const;
export type TraceView = (typeof TRACE_VIEWS)[number];

const MAX_TRACE_LABEL_CHARS = 120;
const MAX_TRACE_ID_CHARS = 200;

export interface ShowTraceChip {
  label: string;
  prompt: '';
  action: typeof SHOW_TRACE_CHIP_ACTION;
  traceView: TraceView;
  traceArtifactId?: string;
}

/**
 * The chip a `show_trace` reply of the agent stands for, or null when the payload is not usable: an unknown
 * `view`, or no label and no fallback. The payload is untrusted: only a known view, a short label and an id
 * string get through. It never navigates by itself; the user clicks the chip.
 */
export function readShowTrace(payload: Record<string, unknown>, fallbackLabel: string): ShowTraceChip | null {
  const view = payload.view;
  if (typeof view !== 'string' || !(TRACE_VIEWS as readonly string[]).includes(view)) return null;
  const message = typeof payload.message === 'string' ? payload.message.replace(/\s+/g, ' ').trim() : '';
  const label = (message || fallbackLabel).slice(0, MAX_TRACE_LABEL_CHARS);
  if (!label) return null;
  const id = typeof payload.artifactId === 'string' ? payload.artifactId.trim() : '';
  return {
    label,
    prompt: '',
    action: SHOW_TRACE_CHIP_ACTION,
    traceView: view as TraceView,
    ...(id && id.length <= MAX_TRACE_ID_CHARS ? { traceArtifactId: id } : {}),
  };
}

/** Where a chip leads in the Traceability page, or null when it is not a (valid) `show-trace` chip. */
export function traceTargetOf(
  input: GuiActionRouteInput | null | undefined,
): { tab: TraceView; root?: string } | null {
  if (!input || input.action !== SHOW_TRACE_CHIP_ACTION) return null;
  const view = input.traceView;
  if (typeof view !== 'string' || !(TRACE_VIEWS as readonly string[]).includes(view)) return null;
  const id = typeof input.traceArtifactId === 'string' ? input.traceArtifactId : '';
  return { tab: view as TraceView, ...(id ? { root: id } : {}) };
}
