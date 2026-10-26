import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_FORECASTER_CONFIG, useGenerateCode } from '../useGenerateCode';
import type { ForecasterConfig } from '../useGenerateCode';
import { ProjectStorageRepository } from '../../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject } from '../../../../shared/types/project';
import type { GenerationResult } from '../../types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../../../shared/services/file-download/useFileDownload', () => ({ useFileDownload: () => vi.fn() }));
vi.mock('../../../../shared/services/githubStarPrompt', () => ({ promptForGitHubStarOnce: vi.fn() }));

const generate = async (config: ForecasterConfig): Promise<GenerationResult> => {
  const { result } = renderHook(() => useGenerateCode());
  let outcome: GenerationResult | undefined;
  await act(async () => {
    outcome = await result.current(null, 'forecaster', 'Forecaster', config);
  });
  return outcome!;
};

describe('useGenerateCode — forecaster', () => {
  beforeEach(() => {
    vi.spyOn(ProjectStorageRepository, 'getCurrentProject').mockReturnValue(createDefaultProject('Forecast', '', ''));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends the settings as the project generation config the backend reads', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['code'])),
      headers: { get: () => 'attachment; filename="forecaster_mlp.py"' },
    });
    vi.stubGlobal('fetch', fetch);

    expect((await generate({ ...DEFAULT_FORECASTER_CONFIG, window: 36, difference: 1 })).ok).toBe(true);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/generate-output-from-project$/);
    const body = JSON.parse(init.body);
    expect(body.settings.generator).toBe('forecaster');
    // exactly the keys ForecastConfig.from_dict takes (plus channel_last), with JSON types it accepts
    expect(body.settings.config).toEqual({
      window: 36,
      horizon: 12,
      season: 12,
      difference: 1,
      log: true,
      calendar: true,
      standardize: true,
      seed: 0,
      channel_last: false,
    });
  });

  it('sends a seasonal difference as null, which the backend reads as the season', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['code'])),
      headers: { get: () => 'attachment; filename="forecaster_mlp.py"' },
    });
    vi.stubGlobal('fetch', fetch);

    await generate(DEFAULT_FORECASTER_CONFIG);

    expect(JSON.parse(fetch.mock.calls[0][1].body).settings.config.difference).toBeNull();
  });

  it('reports the backend message when the network does not fit the settings', async () => {
    const detail =
      "NN 'mlp' cannot be generated as a forecaster:\n  - the last layer 'output' returns 12 values; the horizon is 6";
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: vi.fn().mockResolvedValue({ detail }) }),
    );

    const result = await generate({ ...DEFAULT_FORECASTER_CONFIG, horizon: 6 });

    expect(result).toEqual({ ok: false, error: detail });
  });
});
