/**
 * suggestedActionRouting — decide what a post-generation suggestion chip does.
 *
 * The assistant surfaces backend-defined `{ label, prompt }` chips after a GUI
 * is generated. Most relay their prompt to the agent as a chat message
 * ("Generate web app", "Generate read frontend"). But a "Modify the GUI" chip
 * has no actionable prompt for the agent, so relaying it looks dead. Instead,
 * such chips should switch the editor to the GUI tab so the user can edit it
 * directly — matching the tester's "See GUI" suggestion.
 *
 * This is a pure decision helper so it can be unit-tested and shared by the
 * drawer and widget handlers.
 */

export interface GuiActionRouteInput {
  label?: string;
  prompt?: string;
  /** Optional explicit routing hint the backend can send (e.g. 'open-gui'). */
  action?: string;
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
