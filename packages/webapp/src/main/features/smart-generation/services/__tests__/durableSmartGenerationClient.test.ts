import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SMART_GEN_RUNS_ENDPOINT,
  smartGenRunEventsUrl,
} from '../../../../shared/constants/constant';
import { startDurableSmartGenRun } from '../durableSmartGenerationClient';

function storageWindow() {
  const values = new Map<string, string>();
  return {
    sessionStorage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    },
  };
}

const params = {
  project: { id: 'project-1' },
  instructions: 'Build a service',
  provider: 'openai' as const,
  apiKey: 'sk-test-secret',
};

describe('durable SmartGen client', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('enqueues with owner auth and keeps BYOK out of idempotency storage', async () => {
    const browser = storageWindow();
    browser.sessionStorage.getItem.mockImplementation((key: string) =>
      key === 'github_session' ? 'github-session' : null,
    );
    vi.stubGlobal('window', browser);
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ run_id: 'a'.repeat(32), status: 'queued' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const handle = await startDurableSmartGenRun(params);

    expect(handle.runId).toBe('a'.repeat(32));
    expect(fetchMock).toHaveBeenCalledWith(
      SMART_GEN_RUNS_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
          'X-GitHub-Session': 'github-session',
        }),
      }),
    );
    const stored = browser.sessionStorage.setItem.mock.calls[0]?.[1] ?? '';
    expect(stored).not.toContain('sk-test-secret');
  });

  it('reconnects after a clean drop using Last-Event-ID', async () => {
    vi.stubGlobal('window', storageWindow());
    vi.stubGlobal('setTimeout', (callback: () => void) => {
      callback();
      return 1;
    });
    const runId = 'b'.repeat(32);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ run_id: runId, status: 'queued' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          'id: 1\nevent: phase\ndata: {"event":"phase","phase":"select","message":"Run queued"}\n\n',
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          `id: 2\nevent: done\ndata: ${JSON.stringify({
            event: 'done',
            runId,
            downloadUrl: `/besser_api/smart-gen/runs/${runId}/artifact`,
            fileName: 'generated.zip',
            isZip: true,
            recipe: {},
          })}\n\n`,
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const handle = await startDurableSmartGenRun(params);
    const events = [];
    for await (const event of handle.events) events.push(event);

    expect(events.map((event) => event.event)).toEqual(['phase', 'done']);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      smartGenRunEventsUrl(runId),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Last-Event-ID': '1' }),
      }),
    );
  });

  it('requests owned cancellation only on explicit abort', async () => {
    const browser = storageWindow();
    vi.stubGlobal('window', browser);
    const runId = 'c'.repeat(32);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ run_id: runId, status: 'queued' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const handle = await startDurableSmartGenRun(params);
    handle.abort();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain(`/smart-gen/runs/${runId}/cancel`);
    // Cancellation is asynchronous and can fail. Keep the key so a retry
    // resolves to the same paid run instead of enqueueing duplicate work.
    expect(browser.sessionStorage.removeItem).not.toHaveBeenCalled();
  });
});
