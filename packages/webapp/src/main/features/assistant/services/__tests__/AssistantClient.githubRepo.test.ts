/**
 * The agent learns about the project's repo with every message; dropping it
 * here would make a change request on a linked repo read as a new build.
 */
import { describe, expect, it } from 'vitest';

import { AssistantClient } from '../AssistantClient';

const REPO = { fullName: 'ana/library', hasCode: true, recap: 'Recent work' };

const sendWith = (provider: () => unknown, override?: Record<string, unknown>) => {
  const client = new AssistantClient('ws://never-connect.invalid');
  const sent: string[] = [];
  (client as unknown as { ws: unknown }).ws = { readyState: 1, send: (s: string) => sent.push(s) };
  (client as unknown as { isConnected: boolean }).isConnected = true;
  (client as unknown as { contextProvider: unknown }).contextProvider = provider;
  client.sendMessage('add a search bar', 'ClassDiagram', override);
  (client as unknown as { clearResponseTimer(): void }).clearResponseTimer();
  return JSON.parse(JSON.parse(sent[0]).message);
};

describe('AssistantClient: the linked repository', () => {
  it('goes out with the message', () => {
    expect(JSON.stringify(sendWith(() => ({ githubRepo: REPO })))).toContain('"fullName":"ana/library"');
  });

  it('a message-level context can name it too', () => {
    expect(JSON.stringify(sendWith(() => ({}), { githubRepo: REPO }))).toContain('"hasCode":true');
  });
});
