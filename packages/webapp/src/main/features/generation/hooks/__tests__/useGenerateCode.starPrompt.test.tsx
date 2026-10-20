import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGenerateCode } from '../useGenerateCode';
import { promptForGitHubStarOnce } from '../../../../shared/services/githubStarPrompt';
import { ProjectStorageRepository } from '../../../../shared/services/storage/ProjectStorageRepository';
import { createDefaultProject } from '../../../../shared/types/project';
import type { GenerationOptions, GenerationResult } from '../../types';

vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../../../../shared/services/file-download/useFileDownload', () => ({
  useFileDownload: () => vi.fn(),
}));

vi.mock('../../../../shared/services/githubStarPrompt', () => ({
  promptForGitHubStarOnce: vi.fn(),
}));

const okResponse = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    blob: vi.fn().mockResolvedValue(new Blob(['zip'])),
    headers: { get: () => 'attachment; filename="web_app.zip"' },
  });

const generate = async (opts?: GenerationOptions): Promise<GenerationResult> => {
  const { result } = renderHook(() => useGenerateCode());
  let outcome: GenerationResult | undefined;
  await act(async () => {
    outcome = await result.current(null, 'web_app', 'Web App', {}, undefined, undefined, opts);
  });
  return outcome!;
};

describe('useGenerateCode GitHub star prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(ProjectStorageRepository, 'getCurrentProject').mockReturnValue(createDefaultProject('My Project', '', ''));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('asks for a star after a successful generation', async () => {
    vi.stubGlobal('fetch', okResponse());

    expect((await generate()).ok).toBe(true);
    expect(promptForGitHubStarOnce).toHaveBeenCalledTimes(1);
  });

  it('asks for a star when the download is deferred to the assistant card', async () => {
    vi.stubGlobal('fetch', okResponse());

    expect((await generate({ autoDownload: false })).ok).toBe(true);
    expect(promptForGitHubStarOnce).toHaveBeenCalledTimes(1);
  });

  it('does not ask when the backend rejects the generation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: vi.fn().mockResolvedValue({ detail: 'boom' }) }),
    );

    expect((await generate()).ok).toBe(false);
    expect(promptForGitHubStarOnce).not.toHaveBeenCalled();
  });

  it('does not ask when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));

    expect((await generate()).ok).toBe(false);
    expect(promptForGitHubStarOnce).not.toHaveBeenCalled();
  });
});
