/* @vitest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLabMode } from '../useLabMode';
import { _resetSpecDrivenConfigCacheForTests, getSpecDrivenConfig } from '../../services/specDrivenConfig';

const CONFIG = {
  caps: {
    max_cost_usd_hard_cap: 5,
    max_runtime_seconds_hard_cap: 2400,
    default_max_cost_usd: 5,
    default_max_runtime_seconds: 2400,
  },
};

const serve = (body: unknown) => {
  const fetchMock = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => {
  _resetSpecDrivenConfigCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  _resetSpecDrivenConfigCacheForTests();
});

describe('useLabMode', () => {
  it('starts false and turns true when the server config says the lab is on', async () => {
    serve({ ...CONFIG, lab: { enabled: true } });

    const { result } = renderHook(() => useLabMode());

    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('is true from the first render once the config is loaded, without another request', async () => {
    const fetchMock = serve({ ...CONFIG, lab: { enabled: true } });
    await getSpecDrivenConfig();

    const { result } = renderHook(() => useLabMode());

    expect(result.current).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stays false on an instance that is not a lab', async () => {
    const fetchMock = serve(CONFIG);

    const { result } = renderHook(() => useLabMode());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await getSpecDrivenConfig();
    expect(result.current).toBe(false);
  });
});
