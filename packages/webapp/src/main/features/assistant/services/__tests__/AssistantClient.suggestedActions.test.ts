/**
 * An assistant_message's quick-reply chips travel on the ChatMessage itself.
 *
 * Agent replies are appended in arrival order on the operation queue, behind
 * any injection still being applied. The chips used to be attached by the
 * action handler to "whichever assistant message is last right now", which —
 * with the reply not yet appended — was the previous message, so the chips
 * never rendered. Carrying them on the message binds them to the right bubble.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { AssistantClient } from '../AssistantClient';
import type { ChatMessage } from '../assistant-types';

const wire = (inner: Record<string, unknown>): MessageEvent =>
  ({ data: JSON.stringify({ action: 'agent_reply_str', message: JSON.stringify(inner) }) } as MessageEvent);

const clients: AssistantClient[] = [];

const setup = () => {
  const client = new AssistantClient('ws://never-connect.invalid');
  clients.push(client);
  const messages: ChatMessage[] = [];
  client.onMessage((m) => messages.push(m));
  const handleMessage = (e: MessageEvent) =>
    (client as unknown as { handleMessage(e: MessageEvent): void }).handleMessage(e);
  return { messages, handleMessage };
};

afterEach(() => {
  clients.splice(0).forEach((c) => (c as unknown as { clearResponseTimer(): void }).clearResponseTimer());
});

describe('AssistantClient — assistant_message suggestedActions', () => {
  it('carries the suggested actions on the emitted chat message', () => {
    const { messages, handleMessage } = setup();
    const suggestedActions = [
      { label: 'Auto-generate', prompt: 'auto' },
      { label: 'Experimental AI design', prompt: 'llm' },
    ];

    handleMessage(wire({ action: 'assistant_message', message: 'How should I build the GUI?', suggestedActions }));

    expect(messages).toHaveLength(1);
    expect(messages[0].message).toBe('How should I build the GUI?');
    expect(messages[0].suggestedActions).toEqual(suggestedActions);
  });

  it('omits the field when the reply has no suggested actions', () => {
    const { messages, handleMessage } = setup();

    handleMessage(wire({ action: 'assistant_message', message: 'Done.', suggestedActions: [] }));

    expect(messages).toHaveLength(1);
    expect(messages[0]).not.toHaveProperty('suggestedActions');
  });
});
