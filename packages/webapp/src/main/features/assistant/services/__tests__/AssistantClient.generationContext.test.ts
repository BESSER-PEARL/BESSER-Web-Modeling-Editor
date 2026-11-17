/**
 * `generationKey` and `lastGeneration` travel in the context of every user
 * message, so the agent's confirmation can name the key in use and a vague
 * follow-up can fall back on the last run's request.
 */
import { describe, expect, it } from 'vitest';

import { AssistantClient } from '../AssistantClient';

const sendWith = (provider: () => unknown) => {
  const client = new AssistantClient('ws://never-connect.invalid');
  const sent: string[] = [];
  (client as unknown as { ws: unknown }).ws = { readyState: 1, send: (s: string) => sent.push(s) };
  (client as unknown as { isConnected: boolean }).isConnected = true;
  (client as unknown as { contextProvider: unknown }).contextProvider = provider;
  client.sendMessage('try again', 'ClassDiagram');
  (client as unknown as { clearResponseTimer(): void }).clearResponseTimer();
  return JSON.parse(JSON.parse(sent[0]).message);
};

describe('AssistantClient: generation context', () => {
  it('sends what the next run uses and the last run', () => {
    const generationKey = { tier: 'own', provider: 'openai', model: null };
    const lastGeneration = { runId: 'c'.repeat(32), at: 1_000, expired: true, request: 'Build a task board.' };
    const payload = sendWith(() => ({ generationKey, lastGeneration }));
    expect(payload.context.generationKey).toEqual(generationKey);
    expect(payload.context.lastGeneration).toEqual(lastGeneration);
  });
});
