/**
 * The pre-run model comparison: read from POST /spec-driven/preview, and
 * never in the way of a run when it is unavailable.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchModelChange, modelChangeQuestion } from '../modelChange';
import type { ModelChange } from '../modelChange';

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
      json: async () => ({ model_change: { verdict: 'large', basis: 'attributes', gone: 0.64, removed: ['Room.price'] } }),
    }));
    expect(await fetchModelChange({ id: 'p' }, 'update it', BASE)).toEqual({
      verdict: 'large', basis: 'attributes', gone: 0.64, removed: ['Room.price'], added: [], renamed: [],
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
          verdict: 'large', gone: 0.4, overlap: 0.6, basis: 'classes',
          removed: [], added: [], changes: ['class Room renamed to Suite'],
          renamed: [{ from: 'Room', to: 'Suite' }, 'junk', { from: 'A' }],
        },
      }),
    }));
    expect(await fetchModelChange({}, 'x', BASE)).toEqual({
      verdict: 'large', basis: 'classes', gone: 0.4, removed: [], added: [],
      renamed: [{ from: 'Room', to: 'Suite' }],
    });
  });

  it('is null when the backend cannot tell, errors, or is unreachable; failures warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(async () => ({ ok: true, json: async () => ({ model_change: null }) }));
    expect(await fetchModelChange({}, 'x', BASE)).toBeNull();
    stubFetch(async () => ({ ok: true, json: async () => ({}) })); // an older backend
    expect(await fetchModelChange({}, 'x', BASE)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    expect(await fetchModelChange({}, 'x', BASE)).toBeNull();
    stubFetch(async () => { throw new TypeError('Failed to fetch'); });
    expect(await fetchModelChange({}, 'x', BASE)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('gives up quietly when the run is stopped', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch((async (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as never);
    const stop = new AbortController();
    const pending = fetchModelChange({}, 'x', BASE, stop.signal);
    stop.abort();
    expect(await pending).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('modelChangeQuestion', () => {
  const change: ModelChange = {
    verdict: 'large', basis: 'attributes', gone: 0.636,
    removed: ['Room.price'], added: ['Room.nightlyRate'], renamed: [],
  };

  it('offers start fresh as the confirm and updating as the safe default', () => {
    const q = modelChangeQuestion('large', change);
    expect(q.confirmLabel).toBe('Start fresh');
    expect(q.cancelLabel).toBe('Update the existing app');
    expect(q.description).toContain(
      'About 64% of the model your app was built from was removed or had attributes renamed.',
    );
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

  it('names only classes when the base run recorded class names only', () => {
    const q = modelChangeQuestion('large', { ...change, basis: 'classes' });
    expect(q.description).toContain('About 64% of the classes your app was built from were removed.');
    expect(modelChangeQuestion('unrelated', { ...change, basis: 'classes' }).description).toContain(
      'Most of the classes your app was built from were removed.',
    );
  });

  it('recommends starting fresh for another app', () => {
    const q = modelChangeQuestion('unrelated', { ...change, verdict: 'unrelated', gone: 1 });
    expect(q.title).toBe('This looks like a different app');
    expect(q.description).toContain(
      'Most of the model your app was built from was removed or had attributes renamed.',
    );
    expect(q.description).toContain('Starting fresh is recommended');
  });
});
