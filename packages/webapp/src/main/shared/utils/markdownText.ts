/**
 * Put untrusted text (repo file names, class names, server messages) into
 * markdown the chat renders, so it shows as typed and can never become a
 * link, an image, emphasis or HTML.
 */

// CommonMark lets a backslash escape any ASCII punctuation character.
const ASCII_PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g;
// GFM links bare URLs and e-mail addresses in text whatever their escapes.
const AUTOLINKABLE = /https?:\/\/|www\.|@/i;

/** `value` as plain markdown text; as a code span when it holds something GFM would link. */
export function escapeMarkdownText(value: string): string {
  const text = value.replace(/\s+/g, ' ');
  if (AUTOLINKABLE.test(text)) return markdownCode(text);
  return text.replace(ASCII_PUNCTUATION, '\\$&');
}

/** `value` as an inline code span, fenced with more backticks than any run inside it. */
export function markdownCode(value: string): string {
  const text = value.replace(/\s+/g, ' ');
  if (!text.trim()) return text;
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longestRun + 1);
  // A span that starts or ends with a backtick or a space needs one space of
  // padding on each side, which the renderer strips again.
  const pad = /^[` ]|[` ]$/.test(text) ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}
