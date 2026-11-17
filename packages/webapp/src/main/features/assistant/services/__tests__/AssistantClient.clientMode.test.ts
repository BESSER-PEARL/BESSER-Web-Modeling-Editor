/**
 * The widget and the drawer share one client, so each message says which of
 * them sent it: the agent offers "Generate the code" after a class diagram in
 * the drawer (the agentic interface) and only modeling steps in the widget.
 */
import { describe, expect, it } from 'vitest';

import { AssistantClient } from '../AssistantClient';
import type { AssistantClientMode } from '../assistant-types';

type Internals = { ws: unknown; isConnected: boolean; clearResponseTimer(): void; processMessageQueue(): void };

const connect = (client: AssistantClient, sent: string[]) => {
  const internals = client as unknown as Internals;
  internals.ws = { readyState: 1, send: (s: string) => sent.push(s) };
  internals.isConnected = true;
};

const payloadOf = (raw: string) => JSON.parse(JSON.parse(raw).message);

describe('AssistantClient: the surface that sent a message', () => {
  it.each<[AssistantClientMode | undefined, AssistantClientMode]>([
    ['widget', 'widget'],
    ['workspace', 'workspace'],
    [undefined, 'workspace'],
  ])('sends clientMode %s as %s', (surface, expected) => {
    const client = new AssistantClient('ws://never-connect.invalid', { clientMode: 'workspace' });
    const sent: string[] = [];
    connect(client, sent);
    client.sendMessage('create a quiz app', 'ClassDiagram', undefined, undefined, surface);
    (client as unknown as Internals).clearResponseTimer();
    expect(payloadOf(sent[0]).clientMode).toBe(expected);
  });

  it('keeps the surface of a message queued while disconnected', () => {
    const client = new AssistantClient('ws://never-connect.invalid', { clientMode: 'workspace' });
    expect(client.sendMessage('add a Teacher class', 'ClassDiagram', undefined, undefined, 'widget')).toBe('queued');
    const sent: string[] = [];
    connect(client, sent);
    (client as unknown as Internals).processMessageQueue();
    (client as unknown as Internals).clearResponseTimer();
    expect(payloadOf(sent[0]).clientMode).toBe('widget');
  });
});
