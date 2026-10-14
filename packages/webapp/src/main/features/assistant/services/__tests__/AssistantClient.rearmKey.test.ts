/**
 * The agent keeps the BYOK key on its session, which is keyed by the
 * persistent user id and outlives the tab. Re-arming only ever SENT a stored
 * key, so a key removed in another dialog, or one that died with an old tab,
 * kept being used (and billed) by the agent.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  sessionStorageAssistantApiKey,
  sessionStorageAssistantProvider,
} from '../../../../shared/constants/constant';
import { AssistantClient } from '../AssistantClient';

const connectedClient = () => {
  const client = new AssistantClient('ws://never-connect.invalid');
  const sent: string[] = [];
  (client as unknown as { ws: unknown }).ws = { readyState: 1, send: (s: string) => sent.push(s) };
  (client as unknown as { isConnected: boolean }).isConnected = true;
  const rearm = () => (client as unknown as { rearmUserApiKey(): void }).rearmUserApiKey();
  return { sent, rearm };
};

describe('AssistantClient — BYOK re-arm on connect', () => {
  afterEach(() => window.sessionStorage.clear());

  it('clears the agent-side key when this tab stores none', () => {
    const { sent, rearm } = connectedClient();
    rearm();
    expect(sent).toHaveLength(1);
    const frame = JSON.parse(sent[0]);
    expect(frame.action).toBe('user_set_variable');
    expect(frame.message).toEqual({ user_api_key: '' });
  });

  it('re-sends a stored key', () => {
    window.sessionStorage.setItem(sessionStorageAssistantApiKey, 'sk-test');
    window.sessionStorage.setItem(sessionStorageAssistantProvider, 'openai');
    const { sent, rearm } = connectedClient();
    rearm();
    expect(JSON.parse(sent[0]).message).toMatchObject({ user_api_key: 'sk-test', user_api_provider: 'openai' });
  });
});
