/**
 * The agent keeps the BYOK key on its session, which is keyed by the
 * persistent `localStorage` user id, so every tab of the browser shares it.
 * Re-arming used to send `{ user_api_key: '' }` from a tab with no key, which
 * wiped the key another open tab had just set (its next request silently fell
 * back to the server key). A tab now re-sends only a key it holds; removing a
 * key clears it explicitly from the BYOK dialog.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  sessionStorageLlmApiKey,
  sessionStorageLlmProvider,
  sessionStorageLlmBaseUrl,
} from '../../../../shared/constants/constant';
import { AssistantClient } from '../AssistantClient';

// Every key provider is on the assistant's allowlist today; a test drops one to
// stand in for a future Spec-Driven-only provider.
const assistantAllowlist = vi.hoisted(() => ({ drop: null as string | null }));
vi.mock('../../../../shared/services/llmKeyStorage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../../shared/services/llmKeyStorage')>();
  return {
    ...mod,
    isAssistantKeyProvider: (value: unknown) =>
      value !== assistantAllowlist.drop && mod.isAssistantKeyProvider(value),
  };
});

const connectedClient = () => {
  const client = new AssistantClient('ws://never-connect.invalid');
  const sent: string[] = [];
  (client as unknown as { ws: unknown }).ws = { readyState: 1, send: (s: string) => sent.push(s) };
  (client as unknown as { isConnected: boolean }).isConnected = true;
  const rearm = () => (client as unknown as { rearmUserApiKey(): void }).rearmUserApiKey();
  return { sent, rearm };
};

describe('AssistantClient — BYOK re-arm on connect', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    assistantAllowlist.drop = null;
  });

  it("sends nothing when this tab stores no key (never clears another tab's key)", () => {
    const { sent, rearm } = connectedClient();
    rearm();
    expect(sent).toHaveLength(0);
  });

  it('re-sends a stored key', () => {
    window.sessionStorage.setItem(sessionStorageLlmApiKey, 'sk-test');
    window.sessionStorage.setItem(sessionStorageLlmProvider, 'openai');
    const { sent, rearm } = connectedClient();
    rearm();
    expect(JSON.parse(sent[0]).message).toMatchObject({ user_api_key: 'sk-test', user_api_provider: 'openai' });
  });

  it('sends a gateway key as itself, without a base URL: the agent resolves it', () => {
    window.sessionStorage.setItem(sessionStorageLlmApiKey, 'sk-gateway');
    window.sessionStorage.setItem(sessionStorageLlmProvider, 'pia');
    window.sessionStorage.setItem(sessionStorageLlmBaseUrl, 'https://stale-stored-url.test/v1');
    const { sent, rearm } = connectedClient();
    rearm();
    expect(JSON.parse(sent[0]).message).toEqual({
      user_api_key: 'sk-gateway',
      user_api_provider: 'pia',
    });
  });

  it('clears instead of re-sending a stored key whose provider is off the assistant allowlist', () => {
    assistantAllowlist.drop = 'mistral';
    window.sessionStorage.setItem(sessionStorageLlmApiKey, 'spec-driven-only-key');
    window.sessionStorage.setItem(sessionStorageLlmProvider, 'mistral');
    const { sent, rearm } = connectedClient();
    rearm();
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]).message).toEqual({ user_api_key: '' });
  });
});
