/**
 * What the user sees when a generation request fails: the server's `detail`
 * for 400/422/500, the status otherwise, and the time-out message when the
 * request outlives its time limit (now `apiClient`'s `TimeoutError`).
 */
import { act, renderHook } from '@testing-library/react';
import { toast } from 'react-toastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGenerateCode } from '../useGenerateCode';
import { ProjectStorageRepository } from '../../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject } from '../../../../shared/types/project';
import type { GenerationResult } from '../../types';
import { ApiError } from '../../../../shared/api/api-client';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../../../shared/services/file-download/useFileDownload', () => ({ useFileDownload: () => vi.fn() }));
vi.mock('../../../../shared/services/githubStarPrompt', () => ({ promptForGitHubStarOnce: vi.fn() }));

/** Render the hook first (outside `act`), then return a call that starts a web-app generation. */
const renderGenerate = () => {
  const { result } = renderHook(() => useGenerateCode());
  return (): Promise<GenerationResult> => result.current(null, 'web_app', 'Web App', {});
};

const generate = async (): Promise<GenerationResult> => {
  const start = renderGenerate();
  let outcome: GenerationResult | undefined;
  await act(async () => {
    outcome = await start();
  });
  return outcome!;
};

const errorResponse = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('useGenerateCode failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ProjectStorageRepository, 'getCurrentProject').mockReturnValue(createDefaultProject('P', '', ''));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the server's detail for a 400", async () => {
    vi.stubGlobal('fetch', errorResponse(400, { detail: 'No class diagram in the project' }));
    const outcome = await generate();
    expect(outcome).toEqual({ ok: false, error: 'No class diagram in the project', cause: expect.any(ApiError) });
    expect(vi.mocked(toast.error).mock.calls[0][0]).toBe('No class diagram in the project');
  });

  it("shows a FastAPI 422 list readably, not as the bare status", async () => {
    vi.stubGlobal('fetch', errorResponse(422, { detail: [{ loc: ['body', 'settings'], msg: 'Field required' }] }));
    const outcome = await generate();
    expect(outcome).toEqual({ ok: false, error: 'settings: Field required', cause: expect.any(ApiError) });
  });

  it('shows the status when another status fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 502, statusText: 'Bad Gateway' })));
    const outcome = await generate();
    // The caught error rides along (never shown) so analytics can report its status.
    expect(outcome).toEqual({ ok: false, error: 'HTTP error! status: 502', cause: expect.any(ApiError) });
    expect((outcome as { cause: ApiError }).cause.status).toBe(502);
  });

  it('reports a time-out after five minutes', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason))),
      ),
    );
    const start = renderGenerate();
    let outcome: GenerationResult | undefined;
    await act(async () => {
      const pending = start().then((result) => {
        outcome = result;
      });
      await vi.advanceTimersByTimeAsync(300_000);
      await pending;
    });
    expect(outcome).toEqual({
      ok: false,
      error: 'Request timed out',
      cause: expect.objectContaining({ name: 'TimeoutError' }),
    });
    expect(vi.mocked(toast.error).mock.calls[0][0]).toBe('Request timed out. Please try again.');
  });
});
