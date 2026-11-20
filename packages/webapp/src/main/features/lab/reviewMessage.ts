/** A user's comment on lines of a change's diff, sent to the lab agent as part of the next chat message. */
export interface LabLineComment {
  /** The repository key (`besser`, `frontend`, `modeling_agent`). */
  repo: string;
  path: string;
  /** `old`: lines of the base version (deleted lines); `new`: lines of the changed file. */
  side: 'old' | 'new';
  /** Both null: a comment on the whole file. */
  startLine: number | null;
  endLine: number | null;
  /** The commented lines as they read on `side`; empty for a whole-file comment. */
  quoted: string;
  text: string;
}

/** A fence longer than any backtick run in `text`, so quoted code cannot close it. */
function fenceFor(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  return '`'.repeat(Math.max(3, longest + 1));
}

function formatOne(comment: LabLineComment, index: number): string {
  const where = `${index + 1}. ${comment.repo} \`${comment.path}\``;
  if (comment.startLine === null || comment.endLine === null) return `${where}, whole file:\n${comment.text}`;
  const lines =
    comment.startLine === comment.endLine
      ? `line ${comment.startLine}`
      : `lines ${comment.startLine}-${comment.endLine}`;
  const version = comment.side === 'old' ? 'previous version' : 'current file';
  const fence = fenceFor(comment.quoted);
  return `${where}, ${lines} (${version}):\n${fence}\n${comment.quoted}\n${fence}\n${comment.text}`;
}

/** One chat message carrying every comment, numbered, with the quoted lines it is about. */
export function formatLineComments(comments: LabLineComment[]): string {
  return `Review comments on the change:\n\n${comments.map(formatOne).join('\n\n')}`;
}
