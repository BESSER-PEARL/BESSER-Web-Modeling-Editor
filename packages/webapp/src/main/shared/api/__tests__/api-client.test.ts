import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient, formatErrorDetail } from '../api-client';

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

describe('FastAPI error details', () => {
  const VALIDATION_422 = {
    detail: [
      { type: 'too_long', loc: ['body', 'node_ids'], msg: 'List should have at most 400 items', input: [] },
      { type: 'missing', loc: ['body', 'diagram', 'model'], msg: 'Field required' },
    ],
  };

  it('turns a 422 validation list into a readable message, not "[object Object]"', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(VALIDATION_422), { status: 422 }));

    const error = await apiClient.post('/classify-orphans-with-llm', {}).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.message).toBe('node_ids: List should have at most 400 items; diagram.model: Field required');
    expect(error.message).not.toContain('[object Object]');
  });

  it('formats the detail of uploads and downloads the same way', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(VALIDATION_422), { status: 422 }));

    const upload = await apiClient.upload('/import-owl', new FormData()).catch((e) => e);
    const download = await apiClient.downloadFile('/export', {}).catch((e) => e);

    expect(upload.message).toContain('node_ids: List should have at most 400 items');
    expect(download.message).toContain('diagram.model: Field required');
  });

  it.each([
    ['a plain string', 'Bad signature', 'Bad signature'],
    ['an empty string', '', 'fallback'],
    ['nothing', undefined, 'fallback'],
    ['an entry without loc', [{ msg: 'Value error, bad' }], 'Value error, bad'],
    ['a query parameter', [{ loc: ['query', 'fmt'], msg: 'bad' }], 'query.fmt: bad'],
    ['an entry without msg', [{ loc: ['body', 'x'] }], 'x: {"loc":["body","x"]}'],
    ['an empty list', [], 'fallback'],
    ['an object with a message', { message: 'Nope' }, 'Nope'],
    ['any other object', { code: 7 }, '{"code":7}'],
  ])('formats %s', (_label, detail, expected) => {
    expect(formatErrorDetail(detail, 'fallback')).toBe(expected);
  });
});
