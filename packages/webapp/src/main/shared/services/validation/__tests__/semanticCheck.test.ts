import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GENERATE_OBJECT_DIAGRAM_ENDPOINT, SEMANTIC_CHECK_ENDPOINT } from '../../../constants/constant';
import { SseStallError, streamSse } from '../../sse/sseClient';
import {
  SEMANTIC_CHECK_RESPONSE_TIMEOUT_MS,
  SEMANTIC_CHECK_STALL_TIMEOUT_MS,
  SemanticSearchIncompleteError,
  checkSemanticConsistency,
  generateObjectDiagram,
  semanticSearchErrorMessage,
  type SemanticSearchEvent,
} from '../semanticCheck';

vi.mock('../../sse/sseClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../sse/sseClient')>();
  return {
    ...actual,
    streamSse: vi.fn(() => (async function* () {})()),
  };
});

const searching: SemanticSearchEvent = { sat: null, done: false, message: 'Searching within 5 objects per class...' };
const found: SemanticSearchEvent = { sat: true, done: true, message: 'Instance found within 5 objects per class.' };

/** Makes `streamSse` yield `events`, then end. */
const streamOf = (...events: SemanticSearchEvent[]) =>
  vi.mocked(streamSse).mockImplementation(
    () =>
      (async function* () {
        yield* events;
      })() as AsyncGenerator<never, void, void>,
  );

beforeEach(() => vi.clearAllMocks());

describe('checkSemanticConsistency', () => {
  it('resolves with the done event', async () => {
    streamOf(searching, found);
    const result = await checkSemanticConsistency('Library', { elements: {} }, vi.fn());
    expect(result).toEqual(found);
  });

  it('passes the progress events to onProgress', async () => {
    streamOf(searching, found);
    const onProgress = vi.fn();
    await checkSemanticConsistency('Library', { elements: {} }, onProgress);
    expect(onProgress.mock.calls).toEqual([[searching]]);
  });

  it('posts the title and model to the semantic check endpoint', async () => {
    streamOf(found);
    const model = { elements: { a: { id: 'a' } } };
    await checkSemanticConsistency('Library', model, vi.fn());
    expect(vi.mocked(streamSse)).toHaveBeenCalledWith(
      SEMANTIC_CHECK_ENDPOINT,
      { title: 'Library', model },
      expect.anything(),
    );
  });

  it('bounds the liveness of the stream, not its duration', async () => {
    streamOf(found);
    await checkSemanticConsistency('Library', {}, vi.fn());
    expect(vi.mocked(streamSse)).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      stallTimeoutMs: SEMANTIC_CHECK_STALL_TIMEOUT_MS,
      responseTimeoutMs: SEMANTIC_CHECK_RESPONSE_TIMEOUT_MS,
    });
  });

  it('rejects a stream that ends without a done event', async () => {
    streamOf(searching);
    await expect(checkSemanticConsistency('Library', {}, vi.fn())).rejects.toBeInstanceOf(
      SemanticSearchIncompleteError,
    );
  });

  it('rejects a stalled stream', async () => {
    vi.mocked(streamSse).mockImplementation(
      () =>
        (async function* () {
          throw new SseStallError(60_000);
        })() as AsyncGenerator<never, void, void>,
    );
    await expect(checkSemanticConsistency('Library', {}, vi.fn())).rejects.toBeInstanceOf(SseStallError);
  });
});

describe('generateObjectDiagram', () => {
  it('posts to the object diagram endpoint', async () => {
    streamOf(found);
    await generateObjectDiagram('Library', {}, vi.fn());
    expect(vi.mocked(streamSse)).toHaveBeenCalledWith(
      GENERATE_OBJECT_DIAGRAM_ENDPOINT,
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('semanticSearchErrorMessage', () => {
  it('reports a stalled stream as a lost connection', () => {
    expect(semanticSearchErrorMessage(new SseStallError(60_000))).toBe(
      'The connection to the server was lost during the semantic check.',
    );
  });

  it('reports a stream without a result', () => {
    expect(semanticSearchErrorMessage(new SemanticSearchIncompleteError())).toBe(
      'The semantic check ended without a result.',
    );
  });

  it('reports any other error with its message', () => {
    expect(semanticSearchErrorMessage(new Error('boom'))).toBe('Semantic check failed: boom');
  });
});
