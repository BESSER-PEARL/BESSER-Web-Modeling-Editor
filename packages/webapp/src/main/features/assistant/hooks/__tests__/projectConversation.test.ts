/** BESSER#745: the conversation is kept on the project, so the specification outlives the chat session. */
import { afterEach, describe, expect, it } from 'vitest';

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

  it('restores nothing from a malformed field, and bounds what it restores', () => {
    const make = (role: string, content: string) => msg(role, content);
    expect(messagesFromProjectConversation({ turns: {} } as never, make)).toEqual([]);
    expect(messagesFromProjectConversation({ turns: 'x' } as never, make)).toEqual([]);
    expect(messagesFromProjectConversation({ turns: [null, 7, { role: 'user' }] } as never, make)).toEqual([]);
    expect(sameTurns([{ role: 'user', content: 'Hi' }], [null] as never)).toBe(false);

    const long = Array.from({ length: MAX_PROJECT_CONVERSATION_TURNS + 5 }, (_, i) => ({
      role: 'user' as const,
      content: `turn ${i} ${'x'.repeat(MAX_PROJECT_CONVERSATION_CHARS)}`,
    }));
    const restored = messagesFromProjectConversation({ turns: long, updatedAt: '' }, make);
    expect(restored).toHaveLength(MAX_PROJECT_CONVERSATION_TURNS);
    expect((restored[0] as { content: string }).content.startsWith('turn 5 ')).toBe(true);
    expect(restored.every((m: { content: string }) => m.content.length === MAX_PROJECT_CONVERSATION_CHARS)).toBe(true);
  });

  describe('with a stored API key', () => {
    afterEach(() => window.sessionStorage.clear());

    it('removes the key from the stored turns if it was pasted into the chat', () => {
      window.sessionStorage.setItem('besser_llm_api_key', 'sk-ant-secret123');
      window.sessionStorage.setItem('besser_llm_provider', 'anthropic');
      const turns = projectConversationTurns([msg('user', 'my key is sk-ant-secret123, use it')]);
      expect(turns).toEqual([{ role: 'user', content: 'my key is [API key removed], use it' }]);
    });
  });
});
