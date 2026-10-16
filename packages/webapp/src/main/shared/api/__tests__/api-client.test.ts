import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '../api-client';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('apiClient.downloadFile', () => {
  it('returns the blob together with the response headers', async () => {
    fetchMock.mockResolvedValue(
      new Response('@prefix : <#> .', { headers: { 'Content-Disposition': 'attachment; filename="kg.ttl"' } }),
    );

    const { blob, headers } = await apiClient.downloadFile('/export', { a: 1 });

    expect(await blob.text()).toBe('@prefix : <#> .');
    expect(headers.get('Content-Disposition')).toBe('attachment; filename="kg.ttl"');
  });

  it('posts the payload as JSON', async () => {
    fetchMock.mockResolvedValue(new Response('x'));

    await apiClient.downloadFile('/export', { a: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/export$/);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ a: 1 });
  });

  it("raises an ApiError that carries the server's explanation, unlike downloadBlob", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Unsupported format' }), { status: 400, statusText: 'Bad Request' }),
    );

    await expect(apiClient.downloadFile('/export', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Unsupported format',
    });
  });

  it('falls back to the status text when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));

    const error = await apiClient.downloadFile('/export', {}).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).toBe('Bad Gateway');
  });

  it('gives up after the per-request timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );

    const pending = apiClient.downloadFile('/export', {}, { timeout: 5_000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(5_001);

    const error = await pending;
    expect(error.name).toBe('TimeoutError');
  });
});
