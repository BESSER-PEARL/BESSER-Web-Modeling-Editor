import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SMART_GEN_ENDPOINT,
  specDrivenRunEventsUrl,
} from '../../../../shared/constants/constant';
import {
  SseHttpError,
  streamSse,
} from '../../../../shared/services/sse/sseClient';
import {
  getOrCreateAssistantSessionId,
  getPilotParticipant,
} from '../../../../shared/services/telemetry/pilotTelemetry';
import {
  SPEC_DRIVEN_STREAM_STALL_TIMEOUT_MS,
  followSpecDrivenRun,
  startSpecDrivenRun,
} from '../specDrivenSseClient';

vi.mock('../../../../shared/services/sse/sseClient', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../shared/services/sse/sseClient')
  >();
  return {
    ...actual,
    streamSse: vi.fn(() => (async function* () {})()),
  };
});

vi.mock('../../../../shared/services/telemetry/pilotTelemetry', () => ({
  getPilotParticipant: vi.fn(() => null),
  getOrCreateAssistantSessionId: vi.fn(() => 'session-abc'),
}));

beforeEach(() => vi.clearAllMocks());

describe('startSpecDrivenRun request serialization', () => {
  it('serializes the approved from-scratch choice in snake_case', () => {
    const handle = startSpecDrivenRun({
      project: { id: 'p1' },
      instructions: 'Build from scratch',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      primaryKindOverride: 'bpmn',
      skipDeterministicGenerator: true,
    });

    expect(vi.mocked(streamSse)).toHaveBeenCalledWith(
      SMART_GEN_ENDPOINT,
      expect.objectContaining({
        primary_kind_override: 'bpmn',
        skip_deterministic_generator: true,
      }),
      {
        signal: handle.controller.signal,
        onResponse: expect.any(Function),
        // The run stream always opts into the dead-transport watchdog —
        // the backend heartbeats a cost tick every ~2s, so total silence
        // for the bound means the transport died (frozen-card bug).
        stallTimeoutMs: SPEC_DRIVEN_STREAM_STALL_TIMEOUT_MS,
      },
    );
    const body = vi.mocked(streamSse).mock.calls[0][1] as Record<string, unknown>;
    expect(body.target_generator_override).toBeUndefined();
  });

  it('omits the skip flag unless it was explicitly approved', () => {
    startSpecDrivenRun({
      project: {},
      instructions: 'Build normally',
      provider: 'openai',
      apiKey: 'sk-test',
      skipDeterministicGenerator: false,
    });

    const body = vi.mocked(streamSse).mock.calls[0][1] as Record<string, unknown>;
    expect(body.skip_deterministic_generator).toBeUndefined();
  });

  it('tags the request with the telemetry session + participant in pilot mode', () => {
    vi.mocked(getPilotParticipant).mockReturnValue('P3');
    vi.mocked(getOrCreateAssistantSessionId).mockReturnValue('session-abc');

    startSpecDrivenRun({
      project: {},
      instructions: 'Build the app',
      provider: 'openai',
      apiKey: 'sk-test',
    });

    const body = vi.mocked(streamSse).mock.calls[0][1] as Record<string, unknown>;
    expect(body.telemetry_participant).toBe('P3');
    expect(body.telemetry_session).toBe('session-abc');
  });

  it('sends no telemetry fields outside pilot mode', () => {
    vi.mocked(getPilotParticipant).mockReturnValue(null);

    startSpecDrivenRun({
      project: {},
      instructions: 'Build the app',
      provider: 'openai',
      apiKey: 'sk-test',
    });

    const body = vi.mocked(streamSse).mock.calls[0][1] as Record<string, unknown>;
    expect(body.telemetry_participant).toBeUndefined();
    expect(body.telemetry_session).toBeUndefined();
  });

  it('reconnects from the last sequence and suppresses replay duplicates', async () => {
    const runId = 'a'.repeat(32);
    vi.mocked(streamSse)
      .mockImplementationOnce(() => (async function* () {
        yield {
          event: 'start', runId, provider: 'openai', llmModel: 'test',
          maxCost: 1, maxRuntime: 60, sequence: 1,
        } as const;
        yield { event: 'phase', phase: 'generate', message: 'building', sequence: 2 } as const;
        throw new Error('transport dropped');
      })())
      .mockImplementationOnce(() => (async function* () {
        // The store may replay the cursor event if an intermediary changed the
        // query. Client-side sequence dedupe makes that harmless.
        yield { event: 'phase', phase: 'generate', message: 'duplicate', sequence: 2 } as const;
        yield {
          event: 'done', runId, downloadUrl: '/download', fileName: 'app.zip',
          isZip: true, recipe: {}, sequence: 3,
        } as const;
      })());

    const handle = startSpecDrivenRun({
      project: {},
      instructions: 'Build the app',
      provider: 'openai',
      apiKey: 'sk-test',
    });
    const events = [];
    for await (const event of handle.events) events.push(event);

    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(vi.mocked(streamSse)).toHaveBeenNthCalledWith(
      2,
      specDrivenRunEventsUrl(runId, 2),
      undefined,
      {
        method: 'GET',
        signal: handle.controller.signal,
        stallTimeoutMs: SPEC_DRIVEN_STREAM_STALL_TIMEOUT_MS,
      },
    );
  });

  it('reconnects from zero when the POST body drops before event #1', async () => {
    const runId = 'b'.repeat(32);
    const accepted = vi.fn();
    vi.mocked(streamSse)
      .mockImplementationOnce((_url, _body, options) => {
        options?.onResponse?.(
          new Response(null, {
            status: 200,
            headers: { 'X-BESSER-Run-Id': runId },
          }),
        );
        return (async function* () {
          throw new Error('body dropped before first event');
        })();
      })
      .mockImplementationOnce(() => (async function* () {
        yield {
          event: 'start', runId, provider: 'openai', llmModel: 'test',
          maxCost: 1, maxRuntime: 60, sequence: 1,
        } as const;
        yield {
          event: 'done', runId, downloadUrl: '/download', fileName: 'app.zip',
          isZip: true, recipe: {}, sequence: 2,
        } as const;
      })());

    const handle = startSpecDrivenRun({
      project: {},
      instructions: 'Build the app',
      provider: 'openai',
      apiKey: 'sk-test',
      onRunAccepted: accepted,
    });
    const events = [];
    for await (const event of handle.events) events.push(event);

    expect(accepted).toHaveBeenCalledWith(runId);
    expect(events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(vi.mocked(streamSse)).toHaveBeenNthCalledWith(
      2,
      specDrivenRunEventsUrl(runId, 0),
      undefined,
      {
        method: 'GET',
        signal: handle.controller.signal,
        stallTimeoutMs: SPEC_DRIVEN_STREAM_STALL_TIMEOUT_MS,
      },
    );
  });

  it('follows a saved run with a bodyless replay request', () => {
    const runId = 'f'.repeat(32);
    const handle = followSpecDrivenRun(runId, 17);

    expect(vi.mocked(streamSse)).toHaveBeenCalledWith(
      specDrivenRunEventsUrl(runId, 17),
      undefined,
      {
        method: 'GET',
        signal: handle.controller.signal,
        stallTimeoutMs: SPEC_DRIVEN_STREAM_STALL_TIMEOUT_MS,
      },
    );
  });

  it('does not retry a replay record that has expired', async () => {
    const runId = 'e'.repeat(32);
    vi.mocked(streamSse).mockImplementationOnce(() => (async function* () {
      throw new SseHttpError(404, 'not found');
    })());

    const handle = followSpecDrivenRun(runId);

    await expect(async () => {
      for await (const _event of handle.events) {
        // no events expected
      }
    }).rejects.toMatchObject({ status: 404 });
    expect(vi.mocked(streamSse)).toHaveBeenCalledTimes(1);
  });
});
