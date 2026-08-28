import { checkConsistencyStream, type ConsistencyStreamMessage } from '../checkConsistencyModel';

const streamFromChunks = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
};

describe('checkConsistencyStream', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accumulates and dispatches each SSE data line to onMessage', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: streamFromChunks([
        'data: {"sat":null,"done":false,"message":"starting"}\n',
        'data: {"sat":true,"done":true,"message":"satisfiable"}\n',
      ]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const received: ConsistencyStreamMessage[] = [];
    await checkConsistencyStream({ elements: {} }, 'Class Diagram', (data) => received.push(data));

    expect(received).toHaveLength(2);
    expect(received[0].sat).toBeNull();
    expect(received[0].message).toBe('starting');
    expect(received[1]).toMatchObject({ sat: true, done: true, message: 'satisfiable' });
  });

  it('POSTs the JSON payload to the semantic-consistency-check endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, body: streamFromChunks([]) });
    vi.stubGlobal('fetch', fetchMock);

    const model = { elements: { a: { id: 'a' } } };
    await checkConsistencyStream(model, 'My Diagram', () => {});

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/semantic-consistency-check$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ title: 'My Diagram', model });
  });

  it('flushes a final SSE line without a trailing newline', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: streamFromChunks(['data: {"sat":false,"done":true,"message":"unsat"}']),
    });
    vi.stubGlobal('fetch', fetchMock);

    const received: ConsistencyStreamMessage[] = [];
    await checkConsistencyStream({}, 'Diagram', (data) => received.push(data));

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ sat: false, done: true, message: 'unsat' });
  });

  it('ignores malformed SSE lines and non-data lines', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: streamFromChunks([
        'event: foo\n',
        'data: {broken json\n',
        ': keep-alive comment\n',
        'data: {"sat":true,"done":true}\n',
      ]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const received: ConsistencyStreamMessage[] = [];
    const result = await checkConsistencyStream({}, 'Diagram', (data) => received.push(data));

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ sat: true, done: true });
  });

  it('rejects on a non-OK response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('boom'),
      body: null,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(checkConsistencyStream({}, 'Diagram', () => {})).rejects.toThrow();
  });
});
