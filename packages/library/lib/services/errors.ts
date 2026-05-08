/**
 * SA-FIX-Editor PC-12.7: tiny pub/sub for non-fatal warnings emitted
 * from inside the library. Kept in its own module (not in
 * `besser-editor.tsx`) so non-React modules like
 * `services/diagramBridge.ts` can publish without pulling React into
 * their import graph.
 *
 * Consumers subscribe via `BesserEditor.prototype.subscribeToBesserErrors`,
 * which wraps `addBesserErrorListener` below. Lib code calls
 * `emitBesserError(payload)` to notify all active subscribers.
 */

/**
 * Shape of a non-fatal warning. Payload kept loose because v3 call
 * sites historically passed strings, `Error` objects, or plain
 * `{ message }` records — `cause` lets callers thread the original
 * error through.
 */
export type BesserError = {
  /** Optional category for filtering (e.g. `"normalizeType"`). */
  kind?: string
  /** Human-readable explanation. */
  message: string
  /** Original cause when one is available. */
  cause?: unknown
}

const listeners: Set<(err: BesserError) => void> = new Set()

/** Subscribe a listener. Returns the unsubscribe function. */
export function addBesserErrorListener(
  callback: (err: BesserError) => void
): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

/** Publish a non-fatal warning to every active listener. */
export function emitBesserError(err: BesserError): void {
  listeners.forEach((cb) => {
    try {
      cb(err)
    } catch {
      // Listener errors must not break the publisher.
    }
  })
}
