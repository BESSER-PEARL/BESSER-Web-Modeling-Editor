/**
 * A progress status line must stop spinning when its work finishes.
 *
 * "Validation found 1 issue(s) — fixing it now…" is rendered as a status bar
 * with a live spinner and an "in progress" badge. Nothing ever removed it, and
 * the outcome was APPENDED as a second progress row — so the chat kept two
 * permanently spinning lines describing work that had finished minutes ago.
 *
 * The outcome now replaces the status line in place and clears `isProgress`.
 */
import { describe, expect, it } from 'vitest';

import { settleProgressMessage } from '@/main/features/assistant/hooks/settleProgressMessage';

type Msg = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  isProgress?: boolean;
  isError?: boolean;
};

/** Thin wrapper over the REAL reducer the hook uses. */
function settle(prev: Msg[], id: string | null, text: string, isError = false): Msg[] {
  return settleProgressMessage(
    prev,
    id,
    text,
    (body, err): Msg => ({
      id: 'new',
      role: 'assistant',
      content: body,
      isError: err || undefined,
    }),
    isError,
  );
}

const progressRow: Msg = {
  id: 'fix-1',
  role: 'assistant',
  content: 'Validation found 1 issue(s) — fixing it now…',
  isProgress: true,
};

describe('auto-fix status line', () => {
  it('replaces the spinner row instead of appending a second one', () => {
    const after = settle([progressRow], 'fix-1', 'Validation passed — the reported issues are resolved.');

    expect(after).toHaveLength(1);
    expect(after[0].content).toBe('Validation passed — the reported issues are resolved.');
    expect(after[0].isProgress).toBe(false);
  });

  it('leaves no spinning row behind on success', () => {
    const after = settle([progressRow], 'fix-1', 'Validation passed — the reported issues are resolved.');
    expect(after.filter((m) => m.isProgress)).toHaveLength(0);
  });

  it('settles to an error row when the repair did not resolve the issues', () => {
    const after = settle([progressRow], 'fix-1', 'The diagram still has 2 validation issue(s):\n\n• a\n• b', true);

    expect(after).toHaveLength(1);
    expect(after[0].isProgress).toBe(false);
    expect(after[0].isError).toBe(true);
    expect(after[0].content).toContain('still has 2 validation issue(s)');
  });

  it('preserves unrelated messages', () => {
    const history: Msg[] = [
      { id: 'u1', role: 'user', content: 'remove book copy' },
      progressRow,
    ];
    const after = settle(history, 'fix-1', 'Validation passed — the reported issues are resolved.');

    expect(after).toHaveLength(2);
    expect(after[0]).toEqual(history[0]);
    expect(after[1].isProgress).toBe(false);
  });

  it('appends when the row is gone (conversation cleared mid-repair)', () => {
    const after = settle([], 'fix-1', 'Validation passed — the reported issues are resolved.');
    expect(after).toHaveLength(1);
    expect(after[0].isProgress).toBeUndefined();
  });
});
