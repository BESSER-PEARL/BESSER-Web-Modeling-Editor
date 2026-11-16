/**
 * elementFocusSignal — a one-shot request to select and scroll to an element
 * once the UML editor has (re)mounted.
 *
 * Switching diagram type recreates the ApollonEditor, so a caller that switches
 * first has no editor to focus yet. It raises this request and
 * `ApollonEditorComponent` consumes it after loading the model.
 */

let pending: string | null = null;

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
