/**
 * What a demo run puts on the wire.
 *
 * The `sponsored` tier spends the operator's own key, so the
 * backend refuses it without the demo secret. Two failure shapes are worth
 * locking down: the secret never travelling (every demo run silently 403s),
 * and the secret travelling on runs that are not demo runs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startSpecDrivenRun } from '../specDrivenSseClient';
import * as sse from '../../../../shared/services/sse/sseClient';

const DEMO_TOKEN = 'demo-token-abc123';

function streamOf(events: unknown[]): AsyncGenerator<any, void, void> {
  return (async function* () {
    for (const e of events) yield e;
  })();
}

async function drain(events: AsyncGenerator<any, void, void>) {
  try {
    for await (const _e of events) {
      /* body asserted from the spy, not from the events */
    }
  } catch {
    /* ignore */
  }
}

async function bodyOf(params: Record<string, unknown>) {
  const spy = vi.spyOn(sse, 'streamSse');
  spy.mockImplementation(() => streamOf([{ event: 'done', sequence: 1 }]) as any);
  const handle = startSpecDrivenRun({
    project: { id: 'p1' } as any,
    instructions: 'Build a simple web app',
    ...params,
  } as any);
  await drain(handle.events);
  return spy.mock.calls[0][1] as Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a demo run', () => {
  it('sends the sponsored provider with the demo secret', async () => {
    const body = await bodyOf({
      provider: 'sponsored',
      apiKey: '',
      demoToken: DEMO_TOKEN,
    });
    expect(body.provider).toBe('sponsored');
    expect(body.demo_token).toBe(DEMO_TOKEN);
  });

  it('carries no api_key or base_url — the server injects both', async () => {
    const body = await bodyOf({
      provider: 'sponsored',
      apiKey: 'sk-should-not-travel',
      baseUrl: 'https://should-not-travel.test/v1',
      demoToken: DEMO_TOKEN,
    });
    expect('api_key' in body).toBe(false);
    expect('base_url' in body).toBe(false);
  });

  it('leaves the model to the server', async () => {
    const body = await bodyOf({
      provider: 'sponsored',
      apiKey: '',
      demoToken: DEMO_TOKEN,
    });
    // BESSER_SPONSORED_LLM_MODEL decides — swapping it is an env edit.
    expect('llm_model' in body).toBe(false);
  });
});

describe('every other run', () => {
  it('never carries the demo secret on the free tier', async () => {
    const body = await bodyOf({
      provider: 'free',
      apiKey: '',
      demoToken: DEMO_TOKEN,
    });
    expect('demo_token' in body).toBe(false);
    expect('api_key' in body).toBe(false);
  });

  it('never carries the demo secret on a BYOK run', async () => {
    const body = await bodyOf({
      provider: 'anthropic',
      apiKey: 'sk-ant-user-key',
      demoToken: DEMO_TOKEN,
    });
    expect('demo_token' in body).toBe(false);
    expect(body.api_key).toBe('sk-ant-user-key');
  });
});
