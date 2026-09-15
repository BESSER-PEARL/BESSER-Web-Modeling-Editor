/**
 * autoLayoutSignal — a one-shot request to ELK-auto-layout the UML editor on
 * its next (re)mount.
 *
 * When the assistant injects a freshly generated complete system, it writes the
 * model to Redux and bumps `editorRevision`, which tears down the live
 * ApollonEditor and creates a new one. There is therefore no stable editor
 * handle to lay out at injection time. Instead the injection side raises this
 * flag and `ApollonEditorComponent` consumes it once the new editor instance
 * has the model loaded, then calls `editor.autoLayout()`.
 *
 * Class diagrams only: the editor's auto-layout saga is a no-op for other
 * diagram types, so the injection side only raises the flag for ClassDiagram.
 * The request is one-shot — `consume` clears it — so a later plain diagram
 * switch (which also bumps `editorRevision`) does not re-trigger a layout.
 */

let pending = false;

/** Ask the next editor setup to run ELK auto-layout once it has the model. */
export function requestAutoLayoutOnNextSetup(): void {
  pending = true;
}

/** Return whether a layout was requested, clearing the request (one-shot). */
export function consumeAutoLayoutRequest(): boolean {
  if (!pending) return false;
  pending = false;
  return true;
}
