import { describe, expect, it } from 'vitest';

import { autoFixInProgressMessage, autoFixRemainingMessage, autoFixResolvedMessage } from '../autoFixMessages';

describe('auto-fix messages (BESSER#744)', () => {
  const issues = ['Class "Brand" has two attributes named "aliases"', 'Association "owns" has no name'];

  it('names the issues the repair fixed, since the "fixing…" line disappears', () => {
    const text = autoFixResolvedMessage(issues);
    expect(text).toContain('2 issue(s)');
    expect(text).toContain('• Class "Brand" has two attributes named "aliases"');
    expect(text).toContain('• Association "owns" has no name');
    expect(text).not.toMatch(/reported issues/i);
  });

  it('lists what remains when the repair did not fix everything', () => {
    expect(autoFixRemainingMessage(issues.slice(1))).toBe(
      'The diagram still has 1 validation issue(s):\n\n• Association "owns" has no name',
    );
  });

  it('says "it" for one issue while fixing', () => {
    expect(autoFixInProgressMessage(issues.slice(0, 1))).toMatch(/fixing it now/);
  });
});
