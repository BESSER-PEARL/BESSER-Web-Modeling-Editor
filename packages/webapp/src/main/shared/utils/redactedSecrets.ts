/**
 * A repo's `buml/diagrams.json` holds the agent's credentials as `[REDACTED]`
 * (backend `secret_redaction.redact_credentials`). Loading that model into a
 * project must not wipe the keys the user entered in this browser.
 */
export const REDACTED_SECRET = '[REDACTED]';

const yamlKey = (line: string): string => line.split(':', 1)[0];

/** A YAML text whose redacted lines take the same key's line from `local`, when both have the same lines. */
function restoreRedactedLines(incoming: string, local: string): string {
  const incomingLines = incoming.split('\n');
  const localLines = local.split('\n');
  if (incomingLines.length !== localLines.length) return incoming;
  return incomingLines
    .map((line, i) => (line.includes(REDACTED_SECRET) && yamlKey(line) === yamlKey(localLines[i]) ? localLines[i] : line))
    .join('\n');
}

/** `incoming` with each `[REDACTED]` value, or redacted YAML line, taken from `local` at the same place. */
export function restoreRedactedSecrets<T>(incoming: T, local: unknown): T {
  if (typeof incoming === 'string') {
    if (typeof local !== 'string' || !incoming.includes(REDACTED_SECRET)) return incoming;
    return (incoming === REDACTED_SECRET ? local : restoreRedactedLines(incoming, local)) as T;
  }
  if (Array.isArray(incoming)) {
    const localItems = Array.isArray(local) ? local : [];
    return incoming.map((item, i) => restoreRedactedSecrets(item, localItems[i])) as T;
  }
  if (incoming && typeof incoming === 'object') {
    const localObject = local && typeof local === 'object' ? (local as Record<string, unknown>) : {};
    return Object.fromEntries(
      Object.entries(incoming).map(([key, value]) => [key, restoreRedactedSecrets(value, localObject[key])]),
    ) as T;
  }
  return incoming;
}
