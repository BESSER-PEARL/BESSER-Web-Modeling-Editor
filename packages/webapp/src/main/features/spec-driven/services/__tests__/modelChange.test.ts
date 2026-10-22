/**
 * The pre-run model comparison: read from POST /spec-driven/preview, and
 * never in the way of a run when it is unavailable.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchModelChange, modelChangeQuestion } from '../modelChange';

const BASE = 'a'.repeat(32);

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: () => Promise<unknown>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('fetchModelChange', () => {
  it('asks the preview endpoint about a modify of the base run', async () => {
    const fetchMock = stubFetch(async () => ({
      ok: true,
      json: async () => ({ model_change: { verdict: 'large', gone: 0.64, removed: ['Room.price'] } }),
    }));
    expect(await fetchModelChange({ id: 'p' }, 'update it', BASE)).toEqual({
      verdict: 'large', gone: 0.64, removed: ['Room.price'], added: [], renamed: [],
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/spec-driven\/preview$/);
    expect(JSON.parse(init.body as string)).toMatchObject({ mode: 'modify', base_run_id: BASE, instructions: 'update it' });
  });

  it('keeps renames when the backend reports them and ignores extra fields', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => ({
        model_change: {
          verdict: 'large', gone: 0.4, overlap: 0.6, basis: 'attributes',
          removed: [], added: [],
          renamed: [{ from: 'Room', to: 'Suite' }, ['Guest.mail', 'Guest.email'], 'junk', [1, 2]],
        },
      }),
    }));
    expect(await fetchModelChange({}, 'x', BASE)).toEqual({
      verdict: 'large', gone: 0.4, removed: [], added: [],
      renamed: [{ from: 'Room', to: 'Suite' }, { from: 'Guest.mail', to: 'Guest.email' }],
    });
  });

  it('is null when the backend cannot tell, errors, or is unreachable', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ model_change: null }) }));
    expect(await fetchModelChange({}, 'x', BASE)).toBeNull();
    stubFetch(async () => ({ ok: true, json: async () => ({}) })); // an older backend
    expect(await fetchModelChange({}, 'x', BASE)).toBeNull();
    stubFetch(async () => ({ ok: false, json: async () => ({}) }));
    expect(await fetchModelChange({}, 'x', BASE)).toBeNull();
    stubFetch(async () => { throw new TypeError('Failed to fetch'); });
    expect(await fetchModelChange({}, 'x', BASE)).toBeNull();
  });

  it('gives up when the run is stopped', async () => {
    stubFetch((async (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as never);
    const stop = new AbortController();
    const pending = fetchModelChange({}, 'x', BASE, stop.signal);
    stop.abort();
    expect(await pending).toBeNull();
  });
});

describe('modelChangeQuestion', () => {
  const change = { verdict: 'large' as const, gone: 0.636, removed: ['Room.price'], added: ['Room.nightlyRate'] };

  it('offers start fresh as the confirm and updating as the safe default', () => {
    const q = modelChangeQuestion('large', change);
    expect(q.confirmLabel).toBe('Start fresh');
    expect(q.cancelLabel).toBe('Update the existing app');
    expect(q.description).toContain('About 64%');
  });

  it('names what changed and what updating leaves behind', () => {
    const q = modelChangeQuestion('large', change);
    expect(q.description).toContain('Removed: Room.price.');
    expect(q.description).toContain('Added: Room.nightlyRate.');
    expect(q.description).toContain('enumerations, methods and relationships');
    const many = { ...change, removed: Array.from({ length: 9 }, (_, i) => `C${i}`) };
    expect(modelChangeQuestion('large', many).description).toContain('C5 and 3 more');
  });

  it('names renames when the backend reports them', () => {
    const q = modelChangeQuestion('large', { ...change, renamed: [{ from: 'Room', to: 'Suite' }] });
    expect(q.description).toContain('Renamed: Room → Suite.');
    expect(modelChangeQuestion('large', change).description).not.toContain('Renamed');
  });

  it('recommends starting fresh for another app', () => {
    const q = modelChangeQuestion('unrelated', { ...change, verdict: 'unrelated', gone: 1 });
    expect(q.title).toBe('This looks like a different app');
    expect(q.description).toContain('Starting fresh is recommended');
  });
});
