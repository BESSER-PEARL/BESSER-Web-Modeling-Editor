/**
 * Reply latency for analytics. Module-level because the message is sent from one
 * surface while the single-dispatch reply handler may run on the other.
 */
let sentAt: number | null = null;

export function markMessageSent(): void {
  sentAt = performance.now();
}

/** Ms since the last send, once per send: later frames of the same reply get `undefined`. */
export function takeReplyLatency(): number | undefined {
  if (sentAt === null) return undefined;
  const ms = Math.round(performance.now() - sentAt);
  sentAt = null;
  return ms;
}
