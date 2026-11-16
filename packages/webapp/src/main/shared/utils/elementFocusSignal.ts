/**
 * elementFocusSignal — show one class-diagram element on the canvas: scroll to
 * it and mark it (the mark is drawn by `ModelFocusLayer`).
 *
 * Switching diagram type recreates the ApollonEditor, so a caller that switches
 * first has no editor to focus yet. It raises a one-shot request instead, and
 * `ApollonEditorComponent` consumes it after loading the model.
 */
import type { ApollonEditor } from '@besser/wme';

let pending: string | null = null;
const listeners = new Set<(elementId: string) => void>();

/** Scroll the editor to the element and mark it. */
export function focusElementOnCanvas(editor: ApollonEditor, elementId: string): void {
  editor.scrollToElement(elementId);
  listeners.forEach((listener) => listener(elementId));
}

/** Called with the id of every element focused from now on. */
export function subscribeToElementFocus(listener: (elementId: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ask the next editor setup to focus this element. */
export function requestElementFocusOnNextSetup(elementId: string): void {
  pending = elementId;
}

/** Drop a request that will not be consumed (the diagram switch failed). */
export function clearElementFocusRequest(): void {
  pending = null;
}

/** Return the requested element id, clearing the request (one-shot). */
export function consumeElementFocusRequest(): string | null {
  const id = pending;
  pending = null;
  return id;
}
