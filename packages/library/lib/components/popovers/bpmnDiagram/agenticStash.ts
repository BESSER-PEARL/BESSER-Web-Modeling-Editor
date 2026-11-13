/**
 * Agentic values of BPMN elements switched back to plain BPMN, kept for the
 * session so switching "Agentic" on again restores them (develop kept them on
 * the element instance). The stored JSON of a plain element carries none.
 * Keyed by element id; values stored on the element win over the stash, so
 * undo / redo of a toggle stays consistent.
 */
const stash = new Map<string, Record<string, unknown>>()

/** Remember `keys` of `data` for element `id` (called when switching off). */
export const stashAgenticFields = (
  id: string,
  data: object,
  keys: readonly string[]
): void => {
  const source = data as Record<string, unknown>
  const saved: Record<string, unknown> = {}
  for (const key of keys) {
    if (source[key] !== undefined) saved[key] = source[key]
  }
  stash.set(id, saved)
}

/** The values remembered for element `id`, or `{}`. */
export const stashedAgenticFields = (id: string): Record<string, unknown> =>
  stash.get(id) ?? {}
