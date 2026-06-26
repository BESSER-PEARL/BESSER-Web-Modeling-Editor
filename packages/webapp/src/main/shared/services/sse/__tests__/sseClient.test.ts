/**
 * Tests for the generic POST-body SSE client.
 *
 * We mock `fetch` to return a synthetic `Response` whose body is a
 * hand-crafted `ReadableStream` of bytes, covering:
 *  - simple single-frame parsing
 *  - split frames across chunks
 *  - multiple frames in one chunk
 *  - abort via AbortController
 *  - HTTP error path (non-2xx → SseHttpError)
 *  - malformed-JSON frame (skipped, doesn't poison the stream)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SseHttpError, streamSse } from '../sseClient';

const encoder = new TextEncoder();

function streamOf(chunks: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        if (typeof chunk === 'string') {
          controller.enqueue(encoder.encode(chunk));
        } else {
          controller.enqueue(chunk);
        }
      }
      controller.close();
    },
  });
}

function okResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('streamSse', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  async function collect<T>(gen: AsyncGenerator<T, void, void>): Promise<T[]> {
    const out: T[] = [];
    for await (const ev of gen) out.push(ev);
    return out;
  }

  it('parses a single complete frame', async () => {
    const body = streamOf(['event: hello\ndata: {"event":"hello","n":1}\n\n']);
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(body));

    const events = await collect(streamSse<{ event: string; n: number }>('/x', {}));
    expect(events).toEqual([{ event: 'hello', n: 1 }]);
  });

  it('parses frames split across chunks', async () => {
    const body = streamOf([
      'event: first\ndata: {"event":"first"',
      ',"a":1}\n\nevent: second\ndata: {"event":"sec',
      'ond","b":2}\n\n',
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(body));

    const events = await collect(streamSse<{ event: string; a?: number; b?: number }>('/x', {}));
    expect(events).toEqual([
      { event: 'first', a: 1 },
      { event: 'second', b: 2 },
    ]);
  });

  it('parses multiple frames in a single chunk', async () => {
    const body = streamOf([
      'event: a\ndata: {"event":"a"}\n\nevent: b\ndata: {"event":"b"}\n\n',
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(body));

    const events = await collect(streamSse<{ event: string }>('/x', {}));
    expect(events.map((e) => e.event)).toEqual(['a', 'b']);
  });

  it('skips malformed frames without breaking subsequent ones', async () => {
    const body = streamOf([
      'event: bad\ndata: {not json}\n\nevent: good\ndata: {"event":"good"}\n\n',
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(body));

    const events = await collect(streamSse<{ event: string }>('/x', {}));
    expect(events).toEqual([{ event: 'good' }]);
  });

  it('throws SseHttpError on non-2xx response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('boom', { status: 500 }),
    );

    await expect(async () => {
      for await (const _ of streamSse<unknown>('/x', {})) {
        // noop
      }
    }).rejects.toBeInstanceOf(SseHttpError);
  });

  it('aborts cleanly via AbortController', async () => {
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
    const body = new ReadableStream<Uint8Array>({
      start(c) { controllerRef = c; },
    });
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      // Reject the fetch when the signal aborts (mimicking real fetch).
      return new Promise((resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }
        resolve(okResponse(body));
      });
    });

    const abortCtl = new AbortController();
    const iterator = streamSse<unknown>('/x', {}, { signal: abortCtl.signal });

    // Emit one event, then abort before closing the stream.
    const reader = iterator[Symbol.asyncIterator]();
    const first = reader.next();
    controllerRef!.enqueue(encoder.encode('event: a\ndata: {"event":"a"}\n\n'));
    const firstValue = await first;
    expect(firstValue.done).toBe(false);
    expect(firstValue.value).toEqual({ event: 'a' });

    // Abort and ensure the generator returns cleanly without hanging.
    abortCtl.abort();
    controllerRef!.close();
    const tail = await reader.next();
    // Either we get `done: true` or we get nothing — but we must not hang.
    expect(tail.done).toBe(true);
  });

  it('handles CRLF frame separators', async () => {
    const body = streamOf(['event: crlf\r\ndata: {"event":"crlf"}\r\n\r\n']);
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(body));

    const events = await collect(streamSse<{ event: string }>('/x', {}));
    expect(events).toEqual([{ event: 'crlf' }]);
  });

  it('handles mixed LF and CRLF separators in the same stream', async () => {
    const body = streamOf([
      'event: one\ndata: {"event":"one"}\n\n',
      'event: two\r\ndata: {"event":"two"}\r\n\r\n',
      'event: three\ndata: {"event":"three"}\n\n',
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(body));

    const events = await collect(streamSse<{ event: string }>('/x', {}));
    expect(events.map((e) => e.event)).toEqual(['one', 'two', 'three']);
  });

  it('ignores SSE comment frames (heartbeats)', async () => {
    const body = streamOf([
      ':heartbeat\n\nevent: real\ndata: {"event":"real"}\n\n:another heartbeat\n\n',
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(body));

    const events = await collect(streamSse<{ event: string }>('/x', {}));
    expect(events).toEqual([{ event: 'real' }]);
  });

  it('skips empty data frames', async () => {
    const body = streamOf([
      'data:\n\nevent: ok\ndata: {"event":"ok"}\n\n',
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(body));

    const events = await collect(streamSse<{ event: string }>('/x', {}));
    expect(events).toEqual([{ event: 'ok' }]);
  });

  it('handles multi-line data fields joined with newlines', async () => {
    const body = streamOf([
      'event: multi\ndata: {"event":"multi",\ndata: "a":1}\n\n',
    ]);
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(body));

    const events = await collect(streamSse<{ event: string; a: number }>('/x', {}));
    // Per SSE spec, multi-line data is joined with \n, and the
    // resulting string is valid JSON: `{"event":"multi",\n"a":1}`
    expect(events).toEqual([{ event: 'multi', a: 1 }]);
  });

  it('throws SseHttpError with status when body is null', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await expect(async () => {
      for await (const _ of streamSse<unknown>('/x', {})) {
        // noop
      }
    }).rejects.toBeInstanceOf(SseHttpError);
  });

  it('handles response body that closes immediately', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) { c.close(); },
    });
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(body));

    const events = await collect(streamSse<unknown>('/x', {}));
    expect(events).toEqual([]);
  });

  it('passes body as JSON with Accept: text/event-stream', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse(streamOf(['event: ok\ndata: {"event":"ok"}\n\n'])),
    );
    globalThis.fetch = fetchMock;

    await collect(streamSse<unknown>('/besser_api/smart-generate', { hello: 'world' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/besser_api/smart-generate');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ hello: 'world' });
    expect(init.headers['Accept']).toBe('text/event-stream');
    expect(init.headers['Content-Type']).toBe('application/json');
  });
});
