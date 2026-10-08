/**
 * The agent keeps the BYOK key on its session, which is keyed by the
 * persistent `localStorage` user id, so every tab of the browser shares it.
 * Re-arming used to send `{ user_api_key: '' }` from a tab with no key, which
 * wiped the key another open tab had just set (its next request silently fell
 * back to the server key). A tab now re-sends only a key it holds; removing a
 * key clears it explicitly from the BYOK dialog.
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

  it("sends nothing when this tab stores no key (never clears another tab's key)", () => {
    const { sent, rearm } = connectedClient();
    rearm();
    expect(sent).toHaveLength(0);
  });

  it('re-sends a stored key', () => {
    window.sessionStorage.setItem(sessionStorageAssistantApiKey, 'sk-test');
    window.sessionStorage.setItem(sessionStorageAssistantProvider, 'openai');
    const { sent, rearm } = connectedClient();
    rearm();
    expect(JSON.parse(sent[0]).message).toMatchObject({ user_api_key: 'sk-test', user_api_provider: 'openai' });
  });
});
