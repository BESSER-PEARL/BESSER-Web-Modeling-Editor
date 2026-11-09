/**
 * Messages for the post-injection validate-and-repair loop. The "fixing…" line
 * is transient (it is replaced by the outcome), so the outcome itself names the
 * issues: a bare "the reported issues are resolved" referred to issues the user
 * never saw (BESSER#744).
 */

const bulletList = (issues: readonly string[]): string => issues.map((issue) => `• ${issue}`).join('\n');

/** The transient status line while the repair request is in flight. */
export const autoFixInProgressMessage = (issues: readonly string[]): string =>
  `Validation found ${issues.length} issue(s) in the diagram — fixing ${issues.length === 1 ? 'it' : 'them'} now…`;

/** The repair worked: say what was wrong and that it is fixed. */
export const autoFixResolvedMessage = (issues: readonly string[]): string =>
  issues.length === 0
    ? 'Validation passed.'
    : `Validation found ${issues.length} issue(s) in the diagram and they are now fixed:\n\n${bulletList(issues)}`;

/** The repair request was answered without a model (a refusal or an error). */
export const autoFixFailedMessage = (issues: readonly string[]): string =>
  `The assistant could not fix ${issues.length} validation issue(s) automatically:\n\n${bulletList(issues)}`;

/** The one repair attempt is spent and issues remain. */
export const autoFixRemainingMessage = (issues: readonly string[]): string =>
  `The diagram still has ${issues.length} validation issue(s):\n\n${bulletList(issues)}`;
