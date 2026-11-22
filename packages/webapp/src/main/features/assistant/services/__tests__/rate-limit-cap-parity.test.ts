/**
 * The browser, server, paste routing and hook override caps must agree.
 *
 * The client checks its own `maxMessageLength`, and then — because
 * `useServerSideLimit` defaults to true — asks the Express server for the
 * authoritative verdict and takes it. So the server's copy silently wins.
 * Raising only the client's left the server at 1000, and a pasted
 * requirements brief that passed in the browser came back as
 * "Message too long (max 1000 characters)" from the server.
 *
 * The server lives in a different npm workspace with no test runner of its
 * own, and importing it here would drag in express. So this reads the file
 * as text — enough to catch the drift, with no cross-package coupling.
 */
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MAX_CHAT_PASTE_CHARS } from '@/components/chatbot-kit/ui/paste-routing';

import { RateLimiterService } from '../RateLimiterService';

const SERVER_RESOURCE = path.resolve(
  __dirname,
  '../../../../../../../server/src/main/resources/uml-agent-rate-limiter-resource.ts',
);

function serverMaxMessageLength(): number {
  const source = readFileSync(SERVER_RESOURCE, 'utf-8');
  const match = source.match(/maxMessageLength:\s*(\d+)/);
  expect(match, `no maxMessageLength found in ${SERVER_RESOURCE}`).not.toBeNull();
  return Number(match![1]);
}

function clientMaxMessageLength(): number {
  // The service keeps its config private; the rejection reason carries it.
  const limiter = new RateLimiterService({ useServerSideLimit: false, persistLocally: false });
  return (limiter as unknown as { config: { maxMessageLength: number } }).config.maxMessageLength;
}

describe('message-length cap parity', () => {
  it('the server cap is not lower than the client cap', () => {
    // A lower server cap is the failure mode: the client accepts the message,
    // the server rejects it, and the user sees a limit the UI never mentioned.
    expect(serverMaxMessageLength()).toBeGreaterThanOrEqual(clientMaxMessageLength());
  });

  it('the paste threshold does not exceed what the server will accept', () => {
    // Paste routing keeps anything at or under this in chat. If the server
    // refuses it, that text has nowhere to go.
    expect(serverMaxMessageLength()).toBeGreaterThanOrEqual(MAX_CHAT_PASTE_CHARS);
  });

  it('all caps accept the full specification and reject oversize input explicitly', async () => {
    expect(serverMaxMessageLength()).toBe(clientMaxMessageLength());
    expect(clientMaxMessageLength()).toBe(MAX_CHAT_PASTE_CHARS);
    expect(MAX_CHAT_PASTE_CHARS).toBe(64000);
    const hook = readFileSync(path.resolve(__dirname, '../../hooks/useAssistantLogic.ts'), 'utf-8');
    expect(Number(hook.match(/maxMessageLength:\s*(\d+)/)?.[1])).toBe(MAX_CHAT_PASTE_CHARS);
    const limiter = new RateLimiterService({ useServerSideLimit: false, persistLocally: false });
    expect((await limiter.checkRateLimit('x'.repeat(64000))).allowed).toBe(true);
    const oversized = await limiter.checkRateLimit('x'.repeat(64001));
    expect(oversized.allowed).toBe(false);
    expect(oversized.reason).toContain('64000');
  });
});
