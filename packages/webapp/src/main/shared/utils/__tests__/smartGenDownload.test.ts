import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchAndSaveSmartGenArtifact } from '../smartGenDownload';

vi.mock('../download', () => ({ downloadFile: vi.fn() }));

describe('fetchAndSaveSmartGenArtifact authentication', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the current owner session with the artifact request', async () => {
    vi.stubGlobal('window', {
      sessionStorage: { getItem: vi.fn(() => 'github-session') },
    });
    const fetchMock = vi.fn(async () =>
      new Response('zip', {
        status: 200,
        headers: { 'Content-Type': 'application/zip' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAndSaveSmartGenArtifact(
      'a'.repeat(32),
      'generated.zip',
      true,
    );

    expect(result).toEqual({ ok: true, sizeBytes: 3 });
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), {
      credentials: 'include',
      headers: { 'X-GitHub-Session': 'github-session' },
    });
  });

  it('uses the owned durable artifact route for durable done events', async () => {
    vi.stubGlobal('window', {
      sessionStorage: { getItem: vi.fn(() => null) },
    });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response('zip', { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const runId = 'b'.repeat(32);

    await fetchAndSaveSmartGenArtifact(
      runId,
      'generated.zip',
      true,
      `/besser_api/smart-gen/runs/${runId}/artifact`,
    );

    expect(fetchMock.mock.calls[0][0]).toContain(
      `/smart-gen/runs/${runId}/artifact`,
    );
  });
});
