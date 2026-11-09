/** The toast or dialog carries the status; drop the emoji the backend prefixes ("✅ Diagram is valid"). */
export const stripStatusEmoji = (text: string): string =>
  text.replace(/^\s*(?:✅|❌|⚠️?|ℹ️?)\s*/u, '');
