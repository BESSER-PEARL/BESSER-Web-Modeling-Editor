/**
 * Keyboard handling for the KG canvas, kept apart from Cytoscape so the focus
 * rules can be tested.
 *
 * The listeners are registered on `window` (a key press has no canvas target:
 * the canvas is a <canvas> that never holds focus itself), so they see every
 * key on the page. Space and Delete/Backspace are only the canvas's when the
 * canvas container has focus; otherwise they belong to whatever does, e.g. the
 * buttons of the delete-confirmation dialog, which must stay pressable with
 * Space. Escape is the one exception: it ends a connect gesture started from
 * the toolbar, so focus is typically on that toolbar button.
 */
import type { ConnectMode } from './KnowledgeGraphToolbar';

export interface CanvasSelection {
  nodeIds: string[];
  edgeIds: string[];
}

export interface CanvasKeyDeps {
  /** The element that holds focus while the user is working on the canvas. */
  getContainer: () => HTMLElement | null;
  /** Space held = pan instead of box-select. */
  setPanning: (on: boolean) => void;
  getSelection: () => CanvasSelection;
  getConnectMode: () => ConnectMode;
  exitConnectMode: () => void;
  /** Hand the selection to the editor, which confirms before deleting. */
  requestDelete: (selection: CanvasSelection) => void;
  undo: () => void;
  redo: () => void;
}

function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
}

export function createCanvasKeyHandlers(deps: CanvasKeyDeps) {
  const onKeyDown = (ev: KeyboardEvent) => {
    const container = deps.getContainer();
    if (!container) return;
    const active = document.activeElement;
    if (isTextEntry(active)) return;

    if (ev.key === 'Escape') {
      if (deps.getConnectMode() !== 'off') {
        deps.exitConnectMode();
        ev.preventDefault();
      }
      return;
    }

    // Everything below acts on the canvas, so it needs the canvas's focus.
    if (!active || !container.contains(active)) return;

    // Undo / redo. In a text field these belong to the browser (they undo
    // typing), which the early return above already guarantees.
    if (ev.ctrlKey || ev.metaKey) {
      const k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) {
        deps.undo();
        ev.preventDefault();
      } else if (k === 'y' || (k === 'z' && ev.shiftKey)) {
        deps.redo();
        ev.preventDefault();
      }
      return;
    }

    if (ev.key === ' ') {
      // Prevent the auto-repeats too, or holding Space to pan scrolls the page.
      if (!ev.repeat) deps.setPanning(true);
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      const selection = deps.getSelection();
      if (selection.nodeIds.length > 0 || selection.edgeIds.length > 0) {
        deps.requestDelete(selection);
        ev.preventDefault();
      }
    }
  };

  /** Unconditional on purpose: if focus moved while Space was held, panning
   *  must still end. */
  const onKeyUp = (ev: KeyboardEvent) => {
    if (ev.key === ' ') deps.setPanning(false);
  };

  return { onKeyDown, onKeyUp };
}
