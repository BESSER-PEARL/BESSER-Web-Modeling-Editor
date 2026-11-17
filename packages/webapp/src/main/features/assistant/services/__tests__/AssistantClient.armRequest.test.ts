/**
 * A key saved in a dialog that holds no client reaches the tab's open
 * assistant connection through `requestAssistantKeyArm`, at once, instead of
 * waiting for the next reconnect.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { getSharedAssistantClient } from '../AssistantClient';
import { requestAssistantKeyArm, writeLlmKey } from '../../../../shared/services/llmKeyStorage';

const client = getSharedAssistantClient('ws://never-connect.invalid');
const internals = client as unknown as { ws: unknown; isConnected: boolean };

afterEach(() => {
  window.sessionStorage.clear();
  internals.ws = null;
  internals.isConnected = false;
});

describe('the shared assistant client answers key-arm requests', () => {
  it('sends the stored key on the open connection', () => {
    const sent: string[] = [];
    internals.ws = { readyState: 1, send: (s: string) => sent.push(s) };
    internals.isConnected = true;
    writeLlmKey('openai', 'sk-saved-now', 'gpt-test-large');

    expect(requestAssistantKeyArm()).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]).message).toMatchObject({
      user_api_key: 'sk-saved-now',
      user_api_provider: 'openai',
      user_api_model: 'gpt-test-large',
    });
  });

  it('reports a closed connection so the dialog can say the key applies after reconnecting', () => {
    writeLlmKey('openai', 'sk-saved-now');
    expect(requestAssistantKeyArm()).toBe('error');
  });
});
