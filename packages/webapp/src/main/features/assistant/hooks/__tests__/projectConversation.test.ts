/** BESSER#745: the conversation is kept on the project, so the specification outlives the chat session. */
import { describe, expect, it } from 'vitest';

import {
  MAX_PROJECT_CONVERSATION_CHARS,
  MAX_PROJECT_CONVERSATION_TURNS,
  messagesFromProjectConversation,
  projectConversationTurns,
  sameTurns,
  toProjectConversation,
} from '../projectConversation';

const msg = (role: string, content: string, extra: Record<string, unknown> = {}) =>
  ({ id: `${role}-${content.slice(0, 8)}`, role, content, ...extra }) as never;

describe('project conversation', () => {
  it('keeps the user and assistant turns, not the status lines', () => {
    const turns = projectConversationTurns([
      msg('user', 'A library system with books, members and loans'),
      msg('assistant', 'Still working on this…', { isProgress: true }),
      msg('assistant', 'Created Book, Member and Loan.'),
      msg('assistant', 'Could not reach the agent', { isError: true }),
    ]);
    expect(turns).toEqual([
      { role: 'user', content: 'A library system with books, members and loans' },
      { role: 'assistant', content: 'Created Book, Member and Loan.' },
    ]);
  });

  it('keeps the newest turns and cuts long ones', () => {
    const many = Array.from({ length: MAX_PROJECT_CONVERSATION_TURNS + 3 }, (_, i) =>
      msg(i % 2 ? 'assistant' : 'user', `turn ${i} ${'x'.repeat(MAX_PROJECT_CONVERSATION_CHARS)}`),
    );
    const turns = projectConversationTurns(many);
    expect(turns).toHaveLength(MAX_PROJECT_CONVERSATION_TURNS);
    expect(turns[0].content.startsWith('turn 3 ')).toBe(true);
    expect(turns.every((t) => t.content.length === MAX_PROJECT_CONVERSATION_CHARS)).toBe(true);
  });

  it('stores nothing for an empty conversation', () => {
    expect(toProjectConversation([])).toBeUndefined();
    expect(toProjectConversation([{ role: 'user', content: 'Hi' }])?.turns).toHaveLength(1);
  });

  it('compares turns by content', () => {
    const turns = [{ role: 'user' as const, content: 'Hi' }];
    expect(sameTurns(turns, [{ role: 'user', content: 'Hi' }])).toBe(true);
    expect(sameTurns(turns, undefined)).toBe(false);
    expect(sameTurns([], undefined)).toBe(true);
  });

  it('turns a saved conversation back into chat messages, skipping malformed turns', () => {
    const restored = messagesFromProjectConversation(
      {
        turns: [
          { role: 'user', content: 'My specification' },
          { role: 'system', content: 'ignored' } as never,
          { role: 'assistant', content: 'Created it.' },
        ],
        updatedAt: '2026-11-08T00:00:00Z',
      },
      (role, content) => msg(role, content),
    );
    expect(restored.map((m: { role: string; content: string }) => [m.role, m.content])).toEqual([
      ['user', 'My specification'],
      ['assistant', 'Created it.'],
    ]);
  });
});
