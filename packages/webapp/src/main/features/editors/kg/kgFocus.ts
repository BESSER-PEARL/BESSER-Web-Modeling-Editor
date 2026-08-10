// Module-level focus registry that lets code outside the KG editor (e.g.,
// the preflight modal in `features/import/`) tell the active
// KnowledgeGraphEditor to focus on a specific subgraph: the problematic
// node + its first-degree neighbors, capped to a small number with a
// preference for KGClass / KGProperty over KGIndividual / KGLiteral /
// KGBlank.
//
// The KG editor calls ``register(handler)`` on mount and disposes the
// returned unregister function on unmount. Callers invoke
// ``focus(nodeIds, opts)`` to ask the active editor to apply the focus.
//
// We intentionally keep this as a tiny module-level singleton rather than
// React context because the caller (a generator-execution hook in
// ``application.tsx``) sits as a sibling of EditorView, not an ancestor.

export interface KgFocusOptions {
  /** Maximum number of first-degree neighbours to display (default 15). */
  maxNeighbors?: number;
}

export type KgFocusHandler = (
  nodeIds: string[],
  opts: Required<KgFocusOptions>,
) => void;

let currentHandler: KgFocusHandler | null = null;

/**
 * Register a focus handler. Returns a function that unregisters this
 * particular handler — call it from the editor's effect cleanup so we
 * don't leak handlers on remount.
 */
export function register(handler: KgFocusHandler): () => void {
  currentHandler = handler;
  return () => {
    if (currentHandler === handler) {
      currentHandler = null;
    }
  };
}

/**
 * Ask the currently-mounted KG editor to focus on the given nodes plus
 * their immediate neighbourhood. Silently no-ops if no editor is
 * mounted (e.g., the user is on a different diagram).
 */
export function focus(
  nodeIds: string[],
  opts: KgFocusOptions = {},
): void {
  if (!currentHandler) return;
  currentHandler(nodeIds, { maxNeighbors: opts.maxNeighbors ?? 15 });
}

/** True when a KG editor is mounted and listening. Used by tests. */
export function hasActiveHandler(): boolean {
  return currentHandler !== null;
}

export const kgFocus = { register, focus, hasActiveHandler };
