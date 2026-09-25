/**
 * Where a pasted block of text should go: the chat message, or an attachment
 * that runs through file-conversion.
 *
 * Kept in its own module, free of `@/` imports, so the decision can be tested
 * without pulling in the whole message-input component (and its editor,
 * recorder and icon dependencies).
 */

/**
 * The chat path's own message cap. A paste longer than this cannot be sent as
 * text, so it becomes a file whatever its shape. Keep in sync with
 * `maxMessageLength` in the assistant's rate limiter.
 */
export const MAX_CHAT_PASTE_CHARS = 64000;

const SPLIT_LINES = /\r?\n/;
const DELIMITERS = [",", ";", "\t"];

/**
 * Does this paste look like a structured document rather than prose?
 *
 * Deliberately conservative: when in doubt it returns false and the text stays
 * in chat, because chat is the richer path (full intent routing) and prose is
 * the common case. Only shapes file-conversion can actually parse are diverted.
 */
export function looksStructured(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // JSON / JSON-lines, XML / XMI / HTML, PlantUML-family diagrams.
  if (/^[[{]/.test(trimmed)) return true;
  if (/^<\??[a-zA-Z]/.test(trimmed)) return true;
  if (/^@start[a-z]+/i.test(trimmed)) return true;

  // CSV/TSV: several lines sharing the same delimiter count, and enough
  // delimiters that it is a table rather than prose containing commas.
  const lines = trimmed.split(SPLIT_LINES).filter((l) => l.trim());
  if (lines.length >= 3) {
    for (const sep of DELIMITERS) {
      const counts = lines.slice(0, 10).map((l) => l.split(sep).length - 1);
      if (counts[0] >= 2 && counts.every((c) => c === counts[0])) return true;
    }
  }
  return false;
}

/**
 * True when a paste should become a file attachment instead of chat text.
 *
 * Structured documents go to file-conversion, which knows how to parse them.
 * Anything past the chat limit has to become a file regardless, or the send is
 * rejected. Everything else — including a long natural-language requirements
 * brief, the core input of a spec-driven tool — stays in chat.
 */
export function shouldAttachPaste(text: string): boolean {
  if (!text) return false;
  return looksStructured(text) || text.length > MAX_CHAT_PASTE_CHARS;
}
